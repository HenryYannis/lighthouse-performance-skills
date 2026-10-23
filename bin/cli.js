#!/usr/bin/env node
// 命令行入口，方便在任何目录下用 npx 调用，不用关心脚本在哪：
//   npx lighthouse-performance-skills audit --url http://localhost:3000 --output reports/baseline.json
//   npx lighthouse-performance-skills optimize --dir ./public/images --out ./public/images-optimized

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const commands = {
  audit: 'run-lighthouse.js',
  optimize: 'optimize-images.js',
};

const [command, ...rest] = process.argv.slice(2);
if (!commands[command]) {
  console.log(`Usage: lighthouse-performance-skills <command> [options]

Commands:
  audit      Run a Lighthouse audit   (--url, --output, --runs, --preset mobile|desktop)
  optimize   Optimize local images    (--dir, --quality, --out, --in-place, --avif, --png-palette, --webp-only)`);
  process.exit(command ? 1 : 0);
}

const child = spawn(process.execPath, [path.join(scriptsDir, commands[command]), ...rest], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : code));
