# ⚡ lighthouse-performance-skills

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub Stars](https://img.shields.io/github/stars/HenryYannis/lighthouse-performance-skills?style=flat-square&label=%E2%AD%90%20Stars)](https://github.com/HenryYannis/lighthouse-performance-skills)

> **A reusable performance optimization and web diagnostics Skill package for AI coding agents (like Antigravity, Cursor, and Claude Code). Let AI agents audit your page and boost your Lighthouse score to 95+ automatically!**

English | [中文说明文档](./README_ZH.md)

---

## 📸 Showcase (Before vs. After)

| Before (CLS: 0.79, Score: 75 🟡) | After (CLS: 0.054, Score: 98 🟢) |
| :---: | :---: |
| ![Baseline](./docs/assets/baseline.webp) | ![Optimized](./docs/assets/optimized.webp) |

---

## 💡 Why This Project?

With the rise of AI coding assistants like Cursor and Claude Code, we are delegating massive refactoring and coding chores to AI agents. However, **web performance optimization** is a highly complex engineering task. Directing an AI to optimize a website without structure often leads to:
- 🔴 Blindly compressing images, losing UI quality and premium aesthetics.
- 🔴 Missing critical rendering path styles, causing extended blank screen times.
- 🔴 Inadvertently introducing layout shifts (CLS) due to lacking Core Web Vitals knowledge.

**`lighthouse-performance-skills`** bridges this gap. By defining a structured **`SKILL.md` instruction set** and providing **Node.js helper scripts**, it establishes a standard, closed-loop performance auditing and optimization workflow for your AI agent.

---

## ✨ Features

- 📊 **Headless Auditing**: Integrated `Lighthouse` engine that launches headless Chrome to audit local or remote pages, generating standard markdown reports highlighting LCP, CLS, and TBT.
- 🖼️ **Asset Optimization**: Uses the `sharp` library to generate WebP (and optionally AVIF) versions of your images. Originals and existing `.webp`/`.avif` files are never touched unless you ask for it (`--out` for a separate folder, `--in-place` with `.orig` backups, `--force` to overwrite existing WebP/AVIF). JPEGs are compressed lossily with mozjpeg; PNGs are lossless by default.
- 🤖 **Agent-First Native Integration**: Built-in `SKILL.md` format tailored for AI context windows and custom rules.
- 📈 **Closed-Loop Verification**: Directs agents to benchmark baselines, optimize step-by-step, and re-run audits to generate before-and-after comparison metrics.

---

## 📂 Directory Structure

```text
lighthouse-performance-skills/
├── skills/
│   └── lighthouse-performance-skills/
│       └── SKILL.md          # Agent Skill instruction set (single source of truth)
├── rules/
│   └── lighthouse-performance.mdc # Cursor rule, generated from SKILL.md
├── bin/
│   └── cli.js                # `lighthouse-performance-skills audit|optimize` command
├── package.json              # Project dependencies and run commands
├── README.md                 # English documentation (This file)
├── README_ZH.md              # Chinese documentation
└── scripts/
    ├── run-lighthouse.js     # Script to launch headless Chrome and run audit
    ├── optimize-images.js    # Script to optimize images & generate WebP/AVIF
    └── sync-rules.js         # Regenerates the Cursor rule from SKILL.md
```

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

Clone this folder or place it inside your active workspace, then install dependencies:

```bash
cd lighthouse-performance-skills
npm install
```

> **Note**: Requires **Node.js 22.19+** (required by Lighthouse 13), and **Google Chrome** or **Chromium** installed on your operating system for the audit script. Chrome's sandbox stays on; it is turned off only when running as root (e.g. Docker), in CI (`CI=true`), or with `LH_NO_SANDBOX=1`.

### 🛠️ Troubleshooting (Sharp Installation issues)

If you see a warning like `npm warn allow-scripts sharp@...`, it comes from npm itself: newer npm versions (11.16+ / 12) block dependency install scripts unless they are approved. It has nothing to do with `ignore-scripts`.

- After cloning this repo, approve sharp once inside the project folder, then install again:
  ```bash
  npm approve-scripts sharp
  npm install
  ```
- When running through `npx` (there is no project `package.json` to record the approval), pass the flag instead. `--allow-remote=all` is needed on npm 12, which refuses packages fetched from a URL by default; older npm ignores it:
  ```bash
  npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5 optimize --dir ./public/images
  ```

### 2. Try the Demo (Test it in 1 minute!)

You can instantly test the audit and optimization workflow on the included `/example` project:

1. Start a local server to host the demo page:
   ```bash
   npx http-server ./example -p 8080
   ```
2. In another terminal, run the performance audit script:
   ```bash
   npm run audit -- --url http://localhost:8080 --output reports/demo-report.json
   ```
   *This will output `reports/demo-report.json`, `reports/demo-report.md`, and an interactive `reports/demo-report.html`.*
3. Optimize the large demo image (creates `large-photo.webp` next to it; the original JPG is left untouched):
   ```bash
   npm run optimize -- --dir ./example/images --quality 80
   ```

### 3. Manual CLI Usage

While these tools are optimized for AI automation, you can run them directly:

#### 🏃‍♂️ Run Performance Audit
```bash
# Audit a dev server or live URL
npm run audit -- --url http://localhost:3000 --output reports/baseline.json
```
This prints a summary dashboard in the console and saves `baseline.json` (full report), `baseline.html` (interactive report) and `baseline.md` (markdown summary) inside the `reports/` directory.

| Option | Default | Description |
| :--- | :--- | :--- |
| `--url` | `https://example.com` | Page to audit |
| `--output` | `reports/performance-report.json` | Report path; `.json`/`.html`/`.md` are written side by side (the extension is optional) |
| `--runs` | `3` | Number of runs; the median run is reported, since a single run can swing by ±5 points |
| `--preset` | `mobile` | `mobile` or `desktop` |

#### 🖼️ Optimize Local Images
```bash
# Generate WebP alternatives next to the originals (originals untouched)
npm run optimize -- --dir ./public/assets/images --quality 80

# Also write compressed copies of the originals to a separate folder
npm run optimize -- --dir ./public/assets/images --out ./public/assets/images-optimized

# Overwrite the originals (keeps a .orig backup, skips already-processed files next time)
npm run optimize -- --dir ./public/assets/images --in-place
```

| Option | Description |
| :--- | :--- |
| `--dir` | Image folder to scan (default `./images`); symbolic links inside it are skipped |
| `--quality` | Quality for lossy output, an integer from 1 to 100, default `80` |
| `--out <dir>` | Write compressed originals and WebP/AVIF to this folder, mirroring the structure; files that could not be made smaller (and existing `.webp`) are copied over unchanged |
| `--in-place` | Overwrite the originals, after backing each one up as `<file>.orig` (a replaced image gets `<file>.orig.2`, `.orig.3`…; old backups are never overwritten) |
| `--force` | Overwrite existing `.webp`/`.avif` files (kept by default), and with `--in-place` re-process files already listed in `.optimize-images-manifest.json` |
| `--avif` | Also generate AVIF |
| `--png-palette` | Quantize PNGs to 256 colors (lossy); PNGs are lossless by default |
| `--webp-only` | Only generate modern formats, never compress the originals |

#### 📦 Run Without Cloning
Both tools are also available as a command, so they can be run from any folder. The commands are pinned to a specific commit (`…/tar.gz/9154e24…`), so `npx` always runs code you can review instead of whatever is newest on `main`. To upgrade, replace the hash with a newer commit from this repo (maintainers: a GitHub Actions workflow does this automatically whenever code is pushed to `main`; to do it by hand, run `git fetch && npm run pin`). (The commands download a tarball of that commit instead of using `github:`, because `npx` cannot fetch a `github:` spec pinned to a commit on npm 10.)
```bash
npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5 audit --url http://localhost:3000 --output reports/baseline.json
npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5 optimize --dir ./public/assets/images
```

---

## 🤖 AI Agent Integration

### 1. In Antigravity / Gemini Code Agent
Keep the skill directory in your workspace. When asking Antigravity to "optimize loading speeds" or "raise the Lighthouse score", the agent will read and execute the instructions in `skills/lighthouse-performance-skills/SKILL.md` automatically.

### 2. In Cursor (.cursorrules & .mdc)
Copy `rules/lighthouse-performance.mdc` to `.cursor/rules/lighthouse-performance.mdc` in your project. The rule uses `alwaysApply: false`, so Cursor's agent loads it only when a task matches its description. Alternatively, reference the workflow in your `.cursorrules`:
```markdown
For any web performance optimization tasks, follow the workflow defined in:
1. Run `npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5 audit --url <url> --output reports/baseline.json` to establish a baseline.
2. Run `npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5 optimize --dir <image folder>` to optimize images.
3. Perform source code optimizations (defer scripts, lazy load, fix CLS dimensions).
4. Run audit again to verify improvements and render a before/after comparison table.
```

### 3. In Claude Code
Install the skill folder as a Claude Code skill, either for all projects or for one project:
```bash
# All projects
mkdir -p ~/.claude/skills && cp -r skills/lighthouse-performance-skills ~/.claude/skills/
# Or only the current project
mkdir -p .claude/skills && cp -r /path/to/lighthouse-performance-skills/skills/lighthouse-performance-skills .claude/skills/
```
Claude Code picks the skill up automatically from the `description` in `SKILL.md` when you ask it to speed up a page or raise the Lighthouse score; there is no need to tell it to read the file each time. When only the skill folder is installed, the skill runs the helper scripts through `npx -y --allow-remote=all --allow-scripts=sharp https://codeload.github.com/HenryYannis/lighthouse-performance-skills/tar.gz/9154e243ba84e832d352e1b722d658f714cd35e5`.

> **Editing the instructions**: `SKILL.md` is the single source. After changing it, run `node scripts/sync-rules.js` to regenerate the Cursor rule.

---

## 🛡️ License

Distributed under the [MIT License](LICENSE).

---

## 🌟 Support the Project

If this Skill saved you or your AI agent time, please give this repository a **Star** 🌟!
Contributions are welcome! If you have optimized scripts or instruction tweaks, feel free to open a Pull Request.
