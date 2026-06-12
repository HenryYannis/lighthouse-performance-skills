# ⚡ lighthouse-performance-skills

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub Stars](https://img.shields.io/github/stars/your-username/lighthouse-performance-skills?style=flat-square&label=%E2%AD%90%20Stars)](https://github.com/your-username/lighthouse-performance-skills)

> **A reusable performance optimization and web diagnostics Skill package for AI coding agents (like Antigravity, Cursor, and Claude Code). Let AI agents audit your page and boost your Lighthouse score to 95+ automatically!**

English | [中文说明文档](./README_ZH.md)

---

## 📸 Showcase (Before vs. After)

| Before (CLS: 0.79, Score: 75 🟡) | After (CLS: 0.054, Score: 98 🟢) |
| :---: | :---: |
| ![Baseline](./docs/assets/baseline.png) | ![Optimized](./docs/assets/optimized.png) |

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
- 🖼️ **Asset Optimization**: Uses the powerful `sharp` library to compress images losslessly/lossily and generate modern WebP files while preserving visual excellence.
- 🤖 **Agent-First Native Integration**: Built-in `SKILL.md` format tailored for AI context windows and custom rules.
- 📈 **Closed-Loop Verification**: Directs agents to benchmark baselines, optimize step-by-step, and re-run audits to generate before-and-after comparison metrics.

---

## 📂 Directory Structure

```text
lighthouse-performance-skills/
├── skills/
│   └── lighthouse-performance-skills/
│       └── SKILL.md          # Open Plugins format instruction set for agents
├── rules/
│   └── lighthouse-performance.mdc # Cursor MDC rules format instructions
├── package.json              # Project dependencies and run commands
├── README.md                 # English documentation (This file)
├── README_ZH.md              # Chinese documentation
└── scripts/
    ├── run-lighthouse.js     # Script to launch headless Chrome and run audit
    └── optimize-images.js    # Script to optimize images & compile WebP
```

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies

Clone this folder or place it inside your active workspace, then install dependencies:

```bash
cd lighthouse-performance-skills
npm install
```

> **Note**: Running the Lighthouse audit script requires **Google Chrome** or **Chromium** browser to be installed on your operating system.

### 🛠️ Troubleshooting (Sharp Installation issues)

If you encounter installation warnings or permissions errors related to `sharp` (e.g., `npm warn allow-scripts sharp@0.33.x`), this is due to Node blocklisting postinstall scripts on restricted systems. You can resolve this by running:
```bash
npm config set ignore-scripts false
npm install
```
Or manually approving the package build scripts:
```bash
npm approve-scripts sharp
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
3. Optimize the large demo image:
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
This prints a summary dashboard in the console and saves a full `baseline.json` report along with a `baseline.md` markdown summary inside the `reports/` directory.

#### 🖼️ Optimize Local Images
```bash
# Compress images and compile WebP alternatives
npm run optimize -- --dir ./public/assets/images --quality 80
```

---

## 🤖 AI Agent Integration

### 1. In Antigravity / Gemini Code Agent
Keep the skill directory in your workspace. When asking Antigravity to "optimize loading speeds" or "raise the Lighthouse score", the agent will read and execute the instructions in `skills/lighthouse-performance-skills/SKILL.md` automatically.

### 2. In Cursor (.cursorrules & .mdc)
Because this repository conforms to the Open Plugins standard, Cursor can auto-detect the rule `rules/lighthouse-performance.mdc` when submitted to the registry. Alternatively, you can copy the contents of `rules/lighthouse-performance.mdc` to `.cursor/rules/lighthouse-performance.mdc` in your local project, or reference the workflow in your `.cursorrules`:
```markdown
For any web performance optimization tasks, follow the workflow defined in:
1. Run `node scripts/run-lighthouse.js` to establish a baseline.
2. Run `node scripts/optimize-images.js` to optimize images.
3. Perform source code optimizations (defer scripts, lazy load, fix CLS dimensions).
4. Run audit again to verify improvements and render a before/after comparison table.
```

### 3. In Claude Code
You can pass the skill file as context when interacting with Claude:
```bash
claude "Read skills/lighthouse-performance-skills/SKILL.md and optimize the landing page performance"
```

---

## 🛡️ License

Distributed under the [MIT License](LICENSE).

---

## 🌟 Support the Project

If this Skill saved you or your AI agent time, please give this repository a **Star** 🌟!
Contributions are welcome! If you have optimized scripts or instruction tweaks, feel free to open a Pull Request.
