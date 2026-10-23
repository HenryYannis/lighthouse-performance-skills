#!/usr/bin/env node
// 以 SKILL.md 为唯一来源，生成 Cursor 规则 rules/lighthouse-performance.mdc。
// 用法：node scripts/sync-rules.js          生成/更新 .mdc
//      node scripts/sync-rules.js --check  只检查是否同步，不同步时退出码为 1

import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillPath = path.join(root, 'skills/lighthouse-performance-skills/SKILL.md');
const rulePath = path.join(root, 'rules/lighthouse-performance.mdc');

const skill = (await readFile(skillPath, 'utf8')).replace(/\r\n/g, '\n');
const match = skill.match(/^---\n([\s\S]*?)\n---\n/);
if (!match) {
  console.error('❌ SKILL.md is missing its front matter.');
  process.exit(1);
}
const description = (match[1].match(/^description:\s*(.+)$/m) || [])[1];
const body = skill.slice(match[0].length).replace(/^\n+/, '');

// Cursor：不写 globs、alwaysApply: false，让 Agent 按 description 需要时再加载
const rule = `---
description: ${description}
alwaysApply: false
---

<!-- Generated from skills/lighthouse-performance-skills/SKILL.md by scripts/sync-rules.js. Do not edit by hand. -->

${body}`;

if (process.argv.includes('--check')) {
  const current = await readFile(rulePath, 'utf8').catch(() => '');
  if (current !== rule) {
    console.error('❌ rules/lighthouse-performance.mdc is out of sync. Run: node scripts/sync-rules.js');
    process.exit(1);
  }
  console.log('✅ rules/lighthouse-performance.mdc is in sync with SKILL.md');
} else {
  await writeFile(rulePath, rule);
  console.log(`✅ Wrote ${path.relative(root, rulePath)}`);
}
