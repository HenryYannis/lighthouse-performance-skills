#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const url = getArg('--url') || 'https://example.com';
const outputPath = getArg('--output') || 'reports/performance-report.json';

console.log(`\n======================================================`);
console.log(`⚡ Starting Lighthouse Audit for: ${url}`);
console.log(`======================================================\n`);

async function runAudit() {
  let chrome;

  // Setup clean exit on interruption to prevent process leaks
  const cleanExit = async () => {
    if (chrome) {
      console.log('\n🛑 Audit interrupted. Killing Chrome...');
      await chrome.kill();
    }
    process.exit(1);
  };
  process.on('SIGINT', cleanExit);
  process.on('SIGTERM', cleanExit);

  try {
    // Validate URL input
    new URL(url);
  } catch (e) {
    console.error(`❌ Invalid URL provided: "${url}". Please provide a valid HTTP/HTTPS URL.`);
    process.exit(1);
  }

  try {
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    console.log('🌐 Launching headless Chrome...');
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']
    });

    console.log(`🚦 Running audit on port ${chrome.port}...`);
    const options = {
      logLevel: 'silent',
      output: ['json', 'html'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
    };

    const runnerResult = await lighthouse(url, options);
    const [jsonReport, htmlReport] = runnerResult.report;
    
    // Write full JSON report
    await fs.writeJson(outputPath, runnerResult.lhr, { spaces: 2 });
    console.log(`✅ Detailed JSON report written to: ${outputPath}`);

    // Write HTML report
    const htmlPath = outputPath.replace('.json', '.html');
    await fs.writeFile(htmlPath, htmlReport);
    console.log(`✅ Interactive HTML report written to: ${htmlPath}`);

    // Parse main scores
    const scores = {
      performance: runnerResult.lhr.categories.performance.score * 100,
      accessibility: runnerResult.lhr.categories.accessibility.score * 100,
      bestPractices: runnerResult.lhr.categories['best-practices'].score * 100,
      seo: runnerResult.lhr.categories.seo.score * 100,
    };

    // Parse key Web Vitals
    const audits = runnerResult.lhr.audits;
    const metrics = {
      fcp: audits['first-contentful-paint'].displayValue,
      lcp: audits['largest-contentful-paint'].displayValue,
      tbt: audits['total-blocking-time'].displayValue,
      cls: audits['cumulative-layout-shift'].displayValue,
      speedIndex: audits['speed-index'].displayValue,
    };

    // Print summary to console
    console.log('\n======================================================');
    console.log('📈 LIGHTHOUSE RUN SUMMARY');
    console.log('======================================================');
    console.log(`Performance:      [ ${getScoreColor(scores.performance)} ] ${scores.performance.toFixed(0)}/100`);
    console.log(`Accessibility:    [ ${getScoreColor(scores.accessibility)} ] ${scores.accessibility.toFixed(0)}/100`);
    console.log(`Best Practices:   [ ${getScoreColor(scores.bestPractices)} ] ${scores.bestPractices.toFixed(0)}/100`);
    console.log(`SEO:              [ ${getScoreColor(scores.seo)} ] ${scores.seo.toFixed(0)}/100`);
    console.log('------------------------------------------------------');
    console.log(`First Contentful Paint (FCP):       ${metrics.fcp}`);
    console.log(`Largest Contentful Paint (LCP):     ${metrics.lcp}`);
    console.log(`Total Blocking Time (TBT):          ${metrics.tbt}`);
    console.log(`Cumulative Layout Shift (CLS):      ${metrics.cls}`);
    console.log(`Speed Index:                        ${metrics.speedIndex}`);
    console.log('======================================================\n');

    // Create a markdown summary file
    const mdPath = outputPath.replace('.json', '.md');
    const mdReport = generateMarkdownSummary(url, scores, metrics, runnerResult.lhr);
    await fs.writeFile(mdPath, mdReport);
    console.log(`📝 Markdown summary report written to: ${mdPath}`);

  } catch (err) {
    console.error('❌ Error running Lighthouse audit:', err.message);
    if (err.message.includes('Chrome debugging port')) {
      console.error('💡 Ensure Google Chrome or Chromium is installed on your system.');
    }
    process.exit(1);
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
}

function getScoreColor(score) {
  if (score >= 90) return '🟢 Excellent';
  if (score >= 50) return '🟡 Needs Work';
  return '🔴 Poor';
}

function generateMarkdownSummary(targetUrl, scores, metrics, lhr) {
  const getBadge = (score) => {
    const color = score >= 90 ? 'green' : score >= 50 ? 'orange' : 'red';
    return `![${score}](https://img.shields.io/badge/Score-${score.toFixed(0)}%2F100-${color}?style=for-the-badge)`;
  };

  // Extract top performance opportunities
  const opportunities = Object.values(lhr.audits)
    .filter(audit => audit.details && audit.details.type === 'opportunity' && audit.details.overallSavingsMs > 0)
    .sort((a, b) => b.details.overallSavingsMs - a.details.overallSavingsMs)
    .slice(0, 5);

  let opportunitiesMd = '';
  if (opportunities.length > 0) {
    opportunitiesMd = '\n### 🔍 Top Performance Opportunities\n| Opportunity | Estimated Savings |\n| :--- | :--- |\n';
    opportunities.forEach(op => {
      const savings = (op.details.overallSavingsMs / 1000).toFixed(2);
      opportunitiesMd += `| **${op.title}**<br>${op.description.split('.')[0]}. | ${savings}s |\n`;
    });
  } else {
    opportunitiesMd = '\n🎉 No major performance opportunities found!';
  }

  return `# Lighthouse Audit Report for ${targetUrl}

Date: ${new Date().toLocaleString()}

## 📊 Category Scores
| Category | Score | Status |
| :--- | :--- | :--- |
| **Performance** | ${getBadge(scores.performance)} | ${getScoreColor(scores.performance)} |
| **Accessibility** | ${getBadge(scores.accessibility)} | ${getScoreColor(scores.accessibility)} |
| **Best Practices** | ${getBadge(scores.bestPractices)} | ${getScoreColor(scores.bestPractices)} |
| **SEO** | ${getBadge(scores.seo)} | ${getScoreColor(scores.seo)} |

## ⏱️ Core Web Vitals & Metrics
- **First Contentful Paint (FCP)**: \`${metrics.fcp}\`
- **Largest Contentful Paint (LCP)**: \`${metrics.lcp}\`
- **Total Blocking Time (TBT)**: \`${metrics.tbt}\`
- **Cumulative Layout Shift (CLS)**: \`${metrics.cls}\`
- **Speed Index**: \`${metrics.speedIndex}\`

${opportunitiesMd}
`;
}

runAudit();
