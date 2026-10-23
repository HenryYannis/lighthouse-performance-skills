#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import {computeMedianRun} from 'lighthouse/core/lib/median-run.js';

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const url = getArg('--url') || 'https://example.com';
const outputPath = getArg('--output') || 'reports/performance-report.json';
// 单次跑分常有 ±5 分波动，默认跑 3 次取中位数
const runs = parseInt(getArg('--runs') || '3', 10);
const preset = (getArg('--preset') || 'mobile').toLowerCase();

// 不管 --output 写的是 reports/baseline 还是 reports/baseline.json，
// 都统一拼成 baseline.json / baseline.html / baseline.md，避免互相覆盖
const parsedOutput = path.parse(outputPath);
const outputBase = path.join(parsedOutput.dir, ['.json', '.html', '.md'].includes(parsedOutput.ext.toLowerCase()) ? parsedOutput.name : parsedOutput.base);
const jsonPath = `${outputBase}.json`;
const htmlPath = `${outputBase}.html`;
const mdPath = `${outputBase}.md`;

console.log(`\n======================================================`);
console.log(`⚡ Starting Lighthouse Audit for: ${url}`);
console.log(`📱 Preset: ${preset} | Runs: ${runs}`);
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

  if (!Number.isInteger(runs) || runs < 1) {
    console.error(`❌ Invalid --runs value. Please provide a positive integer.`);
    process.exit(1);
  }
  if (!['mobile', 'desktop'].includes(preset)) {
    console.error(`❌ Invalid --preset "${preset}". Use "mobile" or "desktop".`);
    process.exit(1);
  }

  try {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });

    console.log('🌐 Launching headless Chrome...');
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox']
    });

    console.log(`🚦 Running audit on port ${chrome.port}...`);
    const options = {
      logLevel: 'silent',
      output: ['json', 'html'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
    };

    const config = preset === 'desktop' ? desktopConfig : undefined;
    const results = [];
    for (let i = 1; i <= runs; i++) {
      const result = await lighthouse(url, options, config);
      const perf = result.lhr.categories.performance.score * 100;
      console.log(`   Run ${i}/${runs}: Performance ${perf.toFixed(0)}`);
      results.push(result);
    }

    // 取中位数那一次（Lighthouse 官方的 computeMedianRun）作为最终报告
    const medianLhr = runs > 1 ? computeMedianRun(results.map((r) => r.lhr)) : results[0].lhr;
    const runnerResult = results.find((r) => r.lhr === medianLhr) || results[0];
    const [, htmlReport] = runnerResult.report;
    if (runs > 1) {
      console.log(`📌 Using the median run (Performance ${(runnerResult.lhr.categories.performance.score * 100).toFixed(0)})`);
    }
    
    // Write full JSON report
    await fs.writeFile(jsonPath, JSON.stringify(runnerResult.lhr, null, 2) + '\n');
    console.log(`✅ Detailed JSON report written to: ${jsonPath}`);

    // Write HTML report
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

  // Extract top performance opportunities.
  // Lighthouse 12+ 把大部分 "opportunity" 换成了 "*-insight" 审计（用 metricSavings 表示可节省的时间），
  // 这里两种都读，避免升级后摘要变空。
  const opportunities = Object.entries(lhr.audits)
    .map(([id, audit]) => {
      const details = audit.details || {};
      if (details.type === 'opportunity' && details.overallSavingsMs > 0) {
        return { audit, savingsMs: details.overallSavingsMs };
      }
      if (id.endsWith('-insight') && typeof audit.score === 'number' && audit.score < 1) {
        const ms = audit.metricSavings || {};
        return { audit, savingsMs: Math.max(ms.LCP || 0, ms.FCP || 0) };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 5);

  let opportunitiesMd = '';
  if (opportunities.length > 0) {
    opportunitiesMd = '\n### 🔍 Top Performance Opportunities\n| Opportunity | Estimated Savings |\n| :--- | :--- |\n';
    opportunities.forEach(({ audit, savingsMs }) => {
      const savings = savingsMs > 0 ? `${(savingsMs / 1000).toFixed(2)}s` : '-';
      // 去掉 markdown 链接再取第一句，避免把链接截断
      const firstSentence = (audit.description || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').split('. ')[0].replace(/\.$/, '');
      opportunitiesMd += `| **${audit.title}**<br>${firstSentence}. | ${savings} |\n`;
    });
  } else {
    opportunitiesMd = '\n🎉 No major performance opportunities found!';
  }

  return `# Lighthouse Audit Report for ${targetUrl}

Date: ${new Date().toLocaleString()}
Preset: ${preset} | Runs: ${runs} (median run shown)

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
