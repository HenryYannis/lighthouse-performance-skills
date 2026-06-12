---
name: lighthouse-performance-skills
description: Automatically audit, analyze, and optimize web application performance (Lighthouse & Web Vitals).
version: 1.0.0
---

# Lighthouse & Web Vitals Performance Optimization Skill

This skill guides you through the process of diagnosing web application performance issues and automatically implementing modern optimization techniques to achieve perfect Lighthouse scores and pass Core Web Vitals.

## When to Use This Skill
- When a user asks to optimize their website's loading speed or performance.
- When you detect slow-loading pages, unoptimized asset sizes, or layout shifts (CLS).
- When preparing a website for production deployment and you want to ensure optimal user experience.

---

## Step-by-Step Optimization Workflow

### Step 1: Establish a Baseline Audit (性能诊断)
Before making any performance modifications, run a diagnostic audit to establish a baseline.

1. **Verify Environment**: Verify if `node_modules` exists in the `lighthouse-performance-skills` directory. If dependencies are not installed, run `npm install` first.
2. **Verify Dev Server**: Ensure the local development server (or production build server) is running.
3. **Run Lighthouse Script**: Use the helper script `run-lighthouse.js` to run a headless Chrome audit on the target URL:
   ```bash
   node scripts/run-lighthouse.js --url http://localhost:3000 --output reports/baseline.json
   ```
3. **Parse Metrics**: Check the generated report. Focus on the core Web Vitals:
   - **LCP (Largest Contentful Paint)**: Ideal is $\le$ 2.5s. (Main culprit: large images, slow server, render-blocking JS/CSS).
   - **INP (Interaction to Next Paint)**: Ideal is $\le$ 200ms. (Main culprit: long tasks blocking the main thread).
   - **CLS (Cumulative Layout Shift)**: Ideal is $\le$ 0.1. (Main culprit: images without dimensions, dynamically injected content).
   - **FCP (First Contentful Paint)**: Ideal is $\le$ 1.8s.

---

### Step 2: Asset Optimization (资源优化)

#### 1. Image Compression & Modern Formats
Images are usually the largest payload. Run `optimize-images.js` to batch-process local images:
```bash
node scripts/optimize-images.js --dir ./public/assets/images --quality 80
```
- **Action**: Convert images to WebP/AVIF.
- **HTML Modification**: Update standard `<img>` tags to use `<picture>` tags or modern image attributes:
  ```html
  <picture>
    <source srcset="image.webp" type="image/webp">
    <img src="image.jpg" alt="Description" loading="lazy" width="800" height="600">
  </picture>
  ```
- **Lazy Loading**: Ensure all offscreen images have `loading="lazy"`.
- **Eager Loading for LCP**: If an image is the Largest Contentful Paint element (e.g., hero image), **do not** lazy load it. Instead, use `fetchpriority="high"` and preconnect/preload the resource.

#### 2. Layout Shift (CLS) Prevention
- Always specify `width` and `height` dimensions on `<img>` and `<video>` tags, or reserve space with CSS Aspect Ratio:
  ```css
  .hero-banner {
    aspect-ratio: 16 / 9;
    background-color: #f0f0f0; /* Placeholder background */
  }
  ```
- Avoid inserting content dynamically above existing content unless reacting to a user interaction.

---

### Step 3: Script & Style Optimization (脚本与样式优化)

#### 1. Eliminate Render-Blocking Resources
- **CSS**: Extract critical inline styles for above-the-fold content, and load non-critical CSS asynchronously:
  ```html
  <link rel="preload" href="styles.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="styles.css"></noscript>
  ```
- **JS**: Move non-critical scripts to the bottom of the body, or load them using `defer` or `async`:
  ```html
  <script src="app.js" defer></script>
  ```

#### 2. Code Splitting & Dynamic Imports
For large single-page applications, split bundles dynamically:
- **React**: Use `React.lazy()` and `Suspense`.
- **Vanilla JS**: Use ES6 Dynamic Imports `import('./module.js').then(...)` for code blocks that are not required for initial page render.

#### 3. Font Optimization
- Add `font-display: swap` to `@font-face` rules to prevent Invisible Text (FOIT) during load.
- Preconnect to font domains:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ```

---

### Step 4: Run Verification Audit (效果验证)
After implementing performance changes:
1. Re-run the Lighthouse script on the same URL:
   ```bash
   node scripts/run-lighthouse.js --url http://localhost:3000 --output reports/optimized.json
   ```
2. Compare the baseline audit with the optimized audit.
3. Present a performance improvement table to the user (Metrics, Baseline Score, Optimized Score, % Improvement).

---

## Optimization Rules of Thumb
- **Prioritize the Critical Rendering Path**: Get the text and visual structure on the screen first.
- **Never Break UI/UX**: When compressing images or splitting code, verify that pages still render correctly and look premium.
- **Don't Over-Optimize**: Image quality below 75% often looks pixelated and cheap. Maintain visual excellence.
