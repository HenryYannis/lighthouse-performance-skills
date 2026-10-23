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
const outDir = getArg('--out');                     // 输出到单独目录，原图不动
const inPlace = args.includes('--in-place');        // 明确要求才覆盖原图（会先备份 .orig）
const force = args.includes('--force');             // 忽略 manifest，重新处理
const convertToWebpOnly = args.includes('--webp-only');
const generateAvif = args.includes('--avif');
const pngPalette = args.includes('--png-palette');  // PNG 默认无损，加这个才量化成 256 色

const MANIFEST_NAME = '.optimize-images-manifest.json';

console.log(`\n======================================================`);
console.log(`🖼️  Starting Image Optimization in: ${targetDir}`);
console.log(`🎯 Quality target: ${quality}%`);
if (outDir) console.log(`📁 Output directory: ${outDir} (originals untouched)`);
else if (inPlace) console.log(`✏️  In-place mode: originals are backed up as *.orig before overwriting`);
else console.log(`🔒 Safe mode: originals are not modified (use --out <dir> or --in-place to keep compressed copies)`);
console.log(`======================================================\n`);

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tiff', '.webp'];

async function walkDir(dir, fileList = [], skipDir = null) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (skipDir && path.resolve(filePath) === skipDir) continue;
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      await walkDir(filePath, fileList, skipDir);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

// 输出路径：有 --out 时镜像目录结构写到 out 目录，否则写在原图旁边
function outputPathFor(file, newExt) {
  const rel = path.relative(targetDir, file);
  const base = outDir ? path.join(outDir, rel) : file;
  return newExt ? base.substring(0, base.lastIndexOf('.')) + newExt : base;
}

// 生成 WebP/AVIF；比原图还大就删掉，没有意义
async function generateModern(file, originalSize, format) {
  const outPath = outputPathFor(file, `.${format}`);
  try {
    await fs.ensureDir(path.dirname(outPath));
    await sharp(file)[format]({ quality }).toFile(outPath);
    const size = (await fs.stat(outPath)).size;
    if (size >= originalSize) {
      await fs.remove(outPath);
      console.log(`   └─ ⏩ ${format.toUpperCase()} would be larger than the original, skipped.`);
      return;
    }
    console.log(`   └─ 🟢 Generated ${format.toUpperCase()}: ${path.basename(outPath)} (${formatBytes(size)}) [Saved ${((originalSize - size) / originalSize * 100).toFixed(1)}%]`);
  } catch (err) {
    console.error(`   └─ ⚠️  Failed to generate ${format.toUpperCase()}: ${err.message}`);
  }
}

async function runOptimization() {
  try {
    if (!(await fs.pathExists(targetDir))) {
      console.error(`❌ Target directory does not exist: ${targetDir}`);
      process.exit(1);
    }
    if (outDir && inPlace) {
      console.error('❌ Use either --out or --in-place, not both.');
      process.exit(1);
    }

    console.log('🔍 Scanning directory for images...');
    const imageFiles = await walkDir(targetDir, [], outDir ? path.resolve(outDir) : null);
    console.log(`ℹ️  Found ${imageFiles.length} image(s) to process.\n`);

    if (imageFiles.length === 0) {
      console.log('🎉 No images found to optimize!');
      return;
    }

    // manifest 记录 --in-place 处理过的文件，再次运行时跳过，避免一代代重复压缩
    const manifestPath = path.join(targetDir, MANIFEST_NAME);
    const manifest = inPlace && (await fs.pathExists(manifestPath)) ? await fs.readJson(manifestPath) : {};

    let totalSavedBytes = 0;
    let processedCount = 0;

    for (const file of imageFiles) {
      const ext = path.extname(file).toLowerCase();
      
      // .webp 已经是现代格式，跳过
      if (ext === '.webp') {
        continue;
      }

      const rel = path.relative(targetDir, file);
      const originalSize = (await fs.stat(file)).size;

      if (inPlace && !force && manifest[rel] && manifest[rel].size === originalSize) {
        console.log(`⏩ Skipping (already optimized, see ${MANIFEST_NAME}): ${rel}`);
        continue;
      }

      console.log(`⚙️  Processing: ${rel}`);

      // 1. Generate modern formats (highly recommended for web performance)
      await generateModern(file, originalSize, 'webp');
      if (generateAvif) {
        await generateModern(file, originalSize, 'avif');
      }

      // 2. Compress the original format unless --webp-only is specified
      if (!convertToWebpOnly) {
        const tempOutPath = file + '.tmp';
        try {
          let pipeline = sharp(file);
          
          if (ext === '.png') {
            pipeline = pngPalette
              ? pipeline.png({ quality, compressionLevel: 9, palette: true })
              : pipeline.png({ compressionLevel: 9 }); // 默认无损
          } else if (ext === '.jpg' || ext === '.jpeg') {
            pipeline = pipeline.jpeg({ quality, mozjpeg: true });
          }

          await pipeline.toFile(tempOutPath);
          
          const compressedSize = (await fs.stat(tempOutPath)).size;

          if (compressedSize < originalSize) {
            const saved = originalSize - compressedSize;
            const savedMsg = `${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} [Saved ${(saved / originalSize * 100).toFixed(1)}%]`;
            if (inPlace) {
              const backupPath = file + '.orig';
              if (!(await fs.pathExists(backupPath))) {
                await fs.copy(file, backupPath);
              }
              await fs.move(tempOutPath, file, { overwrite: true });
              manifest[rel] = { size: compressedSize, optimizedAt: new Date().toISOString() };
              totalSavedBytes += saved;
              console.log(`   └─ ⚡ Compressed original in place: ${savedMsg} (backup: ${path.basename(backupPath)})`);
            } else if (outDir) {
              const outPath = outputPathFor(file);
              await fs.ensureDir(path.dirname(outPath));
              await fs.move(tempOutPath, outPath, { overwrite: true });
              totalSavedBytes += saved;
              console.log(`   └─ ⚡ Compressed copy written to ${outPath}: ${savedMsg}`);
            } else {
              await fs.remove(tempOutPath);
              console.log(`   └─ 💡 Compression could save: ${savedMsg} (original untouched)`);
            }
          } else {
            await fs.remove(tempOutPath);
            if (inPlace) manifest[rel] = { size: originalSize, optimizedAt: new Date().toISOString() };
            console.log(`   └─ ⏩ Original already optimal.`);
          }
          processedCount++;
        } catch (compErr) {
          await fs.remove(tempOutPath);
          console.error(`   └─ ⚠️  Failed to compress original: ${compErr.message}`);
        }
      }
    }

    if (inPlace) {
      await fs.writeJson(manifestPath, manifest, { spaces: 2 });
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
