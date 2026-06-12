#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const targetDir = getArg('--dir') || './images';
const quality = parseInt(getArg('--quality') || '80', 10);
const convertToWebpOnly = args.includes('--webp-only');

console.log(`\n======================================================`);
console.log(`🖼️  Starting Image Optimization in: ${targetDir}`);
console.log(`🎯 Quality target: ${quality}%`);
console.log(`======================================================\n`);

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.webp'];

async function walkDir(dir, fileList = []) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await walkDir(filePath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

async function runOptimization() {
  try {
    if (!(await fs.pathExists(targetDir))) {
      console.error(`❌ Target directory does not exist: ${targetDir}`);
      process.exit(1);
    }

    console.log('🔍 Scanning directory for images...');
    const imageFiles = await walkDir(targetDir);
    console.log(`ℹ️  Found ${imageFiles.length} image(s) to process.\n`);

    if (imageFiles.length === 0) {
      console.log('🎉 No images found to optimize!');
      return;
    }

    let totalSavedBytes = 0;
    let processedCount = 0;

    for (const file of imageFiles) {
      const ext = path.extname(file).toLowerCase();
      
      // Skip already optimized webp images if we're generating new webp files
      if (ext === '.webp' && !convertToWebpOnly) {
        continue;
      }

      console.log(`⚙️  Processing: ${path.basename(file)}`);
      
      const fileStat = await fs.stat(file);
      const originalSize = fileStat.size;

      // 1. Generate WebP alternative (highly recommended for web performance)
      if (ext !== '.webp') {
        const webpPath = file.substring(0, file.lastIndexOf('.')) + '.webp';
        try {
          await sharp(file)
            .webp({ quality })
            .toFile(webpPath);
          
          const webpStat = await fs.stat(webpPath);
          const webpSize = webpStat.size;
          const webpSavings = originalSize - webpSize;
          
          console.log(`   └─ 🟢 Generated WebP: ${path.basename(webpPath)} (${formatBytes(webpSize)}) [Saved ${(webpSavings / originalSize * 100).toFixed(1)}%]`);
        } catch (webpErr) {
          console.error(`   └─ ⚠️  Failed to generate WebP: ${webpErr.message}`);
        }
      }

      // 2. Compress the original format (in place) unless --webp-only is specified
      if (!convertToWebpOnly && ext !== '.webp') {
        try {
          const tempOutPath = file + '.tmp';
          let pipeline = sharp(file);
          
          if (ext === '.png') {
            pipeline = pipeline.png({ quality, compressionLevel: 8, palette: true });
          } else if (ext === '.jpg' || ext === '.jpeg') {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          }

          await pipeline.toFile(tempOutPath);
          
          const compressedStat = await fs.stat(tempOutPath);
          const compressedSize = compressedStat.size;

          if (compressedSize < originalSize) {
            // Overwrite original with compressed version
            await fs.move(tempOutPath, file, { overwrite: true });
            const saved = originalSize - compressedSize;
            totalSavedBytes += saved;
            console.log(`   └─ ⚡ Compressed original: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} [Saved ${(saved / originalSize * 100).toFixed(1)}%]`);
          } else {
            // Compressed size was larger, discard temp
            await fs.remove(tempOutPath);
            console.log(`   └─ ⏩ Original already optimal.`);
          }
          processedCount++;
        } catch (compErr) {
          console.error(`   └─ ⚠️  Failed to compress original: ${compErr.message}`);
        }
      }
    }

    console.log('\n======================================================');
    console.log('📊 IMAGE OPTIMIZATION SUMMARY');
    console.log('======================================================');
    console.log(`Images processed:  ${processedCount}`);
    console.log(`Total Space Saved: ${formatBytes(totalSavedBytes)}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ An error occurred during image optimization:', err.message);
    process.exit(1);
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

runOptimization();
