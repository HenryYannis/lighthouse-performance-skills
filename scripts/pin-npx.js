#!/usr/bin/env node
// 把 README、README_ZH、SKILL.md 里 npx 命令固定的提交哈希换成新的，再重新生成 Cursor 规则。
// 用法：
//   node scripts/pin-npx.js           固定到 origin/main 的最新提交（先 git fetch）
//   node scripts/pin-npx.js <sha>     固定到指定提交（完整 40 位哈希）
//   node scripts/pin-npx.js --check   只检查三个文件用的是不是同一个哈希，不一致时退出码为 1
// 注意：哈希指向的提交必须已经推送到 GitHub，否则 npx 下载不到。

import { readFile, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['README.md', 'README_ZH.md', 'skills/lighthouse-performance-skills/SKILL.md'];
const prefix = 'https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/';
const urlRe = /https:\/\/codeload\.github\.com\/HenryYannis\/lighthouse-performance-skills\/tar\.gz\/([0-9a-f]{40})/g;
// 说明文字里的短哈希，例如 `…/tar.gz/14cb046…`
const shortRe = /…\/tar\.gz\/[0-9a-f]{7}…/g;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const arg = process.argv[2];
const contents = {};
const found = new Set();
for (const f of files) {
  contents[f] = await readFile(path.join(root, f), 'utf8');
  for (const m of contents[f].matchAll(urlRe)) found.add(m[1]);
}

if (arg === '--check') {
  if (found.size !== 1) {
    console.error(`❌ Expected one pinned commit across ${files.join(', ')}, found: ${[...found].join(', ') || 'none'}`);
    process.exit(1);
  }
  console.log(`✅ All npx commands are pinned to ${[...found][0]}`);
  process.exit(0);
}

let sha = arg;
if (!sha) {
  sha = git('rev-parse', 'origin/main');
}
if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error(`❌ "${sha}" is not a full 40-character commit hash.`);
  process.exit(1);
}
try {
  git('cat-file', '-e', `${sha}^{commit}`);
} catch {
  console.error(`❌ Commit ${sha} is not in this clone. Run "git fetch" first.`);
  process.exit(1);
}
if (!git('branch', '-r', '--contains', sha)) {
  console.error(`❌ Commit ${sha} has not been pushed to GitHub yet; npx would not be able to download it.`);
  process.exit(1);
}

for (const f of files) {
  const next = contents[f].replace(urlRe, prefix + sha).replace(shortRe, `…/tar.gz/${sha.slice(0, 7)}…`);
  if (next !== contents[f]) await writeFile(path.join(root, f), next);
}
console.log(`📌 Pinned npx commands to ${sha}`);
execFileSync(process.execPath, [path.join(root, 'scripts/sync-rules.js')], { stdio: 'inherit' });
