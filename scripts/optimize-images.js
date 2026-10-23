#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// 原来用 fs-extra 的几个方法，改用 Node 自带的 fs/promises 实现
const pathExists = (p) => fs.access(p).then(() => true, () => false);
async function moveFile(from, to) {
  try {
    await fs.rename(from, to);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    // 跨磁盘时 rename 会失败，退回复制 + 删除
    await fs.copyFile(from, to);
    await fs.rm(from, { force: true });
  }
}

// Parse arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const targetDir = getArg('--dir') || './images';
const qualityArg = getArg('--quality') || '80';
const quality = /^\d+$/.test(qualityArg) ? Number(qualityArg) : NaN;
const outDir = getArg('--out');                     // 输出到单独目录，原图不动
const inPlace = args.includes('--in-place');        // 明确要求才覆盖原图（会先备份 .orig）
const force = args.includes('--force');             // 忽略 manifest 重新处理；覆盖已存在的 .webp/.avif
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
    // 用 lstat，不跟随符号链接：避免循环链接、坏链接让整批中止，也避免改到目录外的文件
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink()) {
      console.log(`⏩ Skipping symbolic link: ${filePath}`);
      continue;
    }
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

// 生成 WebP/AVIF：先写到临时文件，比原图小才改名成正式文件。
// 已经存在的同名 .webp/.avif 默认不覆盖、更不删除（可能是用户自己做的），加 --force 才覆盖。
// 返回新文件大小；没有生成返回 null。
async function generateModern(file, originalSize, format) {
  const outPath = outputPathFor(file, `.${format}`);
  const label = format.toUpperCase();
  if (!force && (await pathExists(outPath))) {
    console.log(`   └─ ⏩ ${label} already exists, kept as is (use --force to overwrite): ${path.basename(outPath)}`);
    return null;
  }
  const tmpPath = `${outPath}.tmp-${process.pid}`;
  try {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await sharp(file)[format]({ quality }).toFile(tmpPath);
    const size = (await fs.stat(tmpPath)).size;
    if (size >= originalSize) {
      await fs.rm(tmpPath, { force: true });
      console.log(`   └─ ⏩ ${label} would be larger than the original, skipped.`);
      return null;
    }
    await moveFile(tmpPath, outPath);
    console.log(`   └─ 🟢 Generated ${label}: ${path.basename(outPath)} (${formatBytes(size)}) [Saved ${((originalSize - size) / originalSize * 100).toFixed(1)}%]`);
    return size;
  } catch (err) {
    await fs.rm(tmpPath, { force: true });
    console.error(`   └─ ⚠️  Failed to generate ${label}: ${err.message}`);
    return null;
  }
}

// --in-place 的备份：没有 .orig 就备份成 .orig；.orig 已存在但内容不同（中途换了新图），
// 就另存为 .orig.2、.orig.3……，绝不覆盖旧备份，也不让新原图丢失
async function backupOriginal(file) {
  const first = file + '.orig';
  if (!(await pathExists(first))) {
    await fs.copyFile(file, first);
    return first;
  }
  const current = await fs.readFile(file);
  let candidate = first;
  let n = 2;
  while (await pathExists(candidate)) {
    if (current.equals(await fs.readFile(candidate))) return candidate;
    candidate = `${first}.${n}`;
    n++;
  }
  await fs.copyFile(file, candidate);
  return candidate;
}

// --out 模式：没压缩的文件原样拷到输出目录（已存在就不动，除非 --force）
async function copyIntoOut(file) {
  const outPath = outputPathFor(file);
  if (!force && (await pathExists(outPath))) return;
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.copyFile(file, outPath);
  console.log(`   └─ 📄 Copied unchanged to ${outPath}`);
}

// 最新的一份备份（.orig、.orig.2、.orig.3 里编号最大的）
async function latestBackup(file) {
  let latest = file + '.orig';
  for (let n = 2; await pathExists(`${file}.orig.${n}`); n++) latest = `${file}.orig.${n}`;
  return latest;
}

async function runOptimization() {
  try {
    if (!(await pathExists(targetDir))) {
      console.error(`❌ Target directory does not exist: ${targetDir}`);
      process.exit(1);
    }
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      console.error(`❌ Invalid --quality "${qualityArg}". Use an integer from 1 to 100.`);
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
    const manifest = inPlace && (await pathExists(manifestPath)) ? JSON.parse(await fs.readFile(manifestPath, 'utf8')) : {};

    let totalSavedBytes = 0;
    let processedCount = 0;
    let skippedCount = 0;
    let potentialSavedBytes = 0;   // 安全模式下：压缩原图能省多少（没有写入）
    // 生成的现代格式：原图总大小 vs 新文件总大小
    const modernStats = { webp: { count: 0, original: 0, output: 0 }, avif: { count: 0, original: 0, output: 0 } };
    const recordModern = (originalSize, format, size) => {
      if (size == null) return;
      modernStats[format].count++;
      modernStats[format].original += originalSize;
      modernStats[format].output += size;
    };

    // photo.jpg 和 photo.png 都会生成 photo.webp，互相覆盖。这类同名图一律不生成现代格式，只提示
    const stemCount = new Map();
    for (const file of imageFiles) {
      if (path.extname(file).toLowerCase() === '.webp') continue;
      const stem = outputPathFor(file, '.x');
      stemCount.set(stem, (stemCount.get(stem) || 0) + 1);
    }

    for (const file of imageFiles) {
      const ext = path.extname(file).toLowerCase();
      
      // .webp 已经是现代格式，不再处理；--out 模式下原样拷进输出目录，保证输出目录完整
      if (ext === '.webp') {
        if (outDir) await copyIntoOut(file);
        continue;
      }

      const rel = path.relative(targetDir, file);
      const originalSize = (await fs.stat(file)).size;

      if (inPlace && !force && manifest[rel] && manifest[rel].size === originalSize) {
        console.log(`⏩ Skipping (already optimized, see ${MANIFEST_NAME}): ${rel}`);
        skippedCount++;
        continue;
      }

      console.log(`⚙️  Processing: ${rel}`);

      // 1. Generate modern formats (highly recommended for web performance)
      if (stemCount.get(outputPathFor(file, '.x')) > 1) {
        console.log(`   └─ ⚠️  Another image has the same name with a different extension, so WebP/AVIF is skipped to avoid overwriting. Rename one of them.`);
      } else {
        recordModern(originalSize, 'webp', await generateModern(file, originalSize, 'webp'));
        if (generateAvif) {
          recordModern(originalSize, 'avif', await generateModern(file, originalSize, 'avif'));
        }
      }
      if (convertToWebpOnly) processedCount++;

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
              // --force 重跑时当前文件就是上次压缩的结果，原图已在 .orig 里，不用再备份
              const isOurOutput = manifest[rel] && manifest[rel].size === originalSize && (await pathExists(file + '.orig'));
              const backupPath = isOurOutput ? await latestBackup(file) : await backupOriginal(file);
              await moveFile(tempOutPath, file);
              manifest[rel] = { size: compressedSize, optimizedAt: new Date().toISOString() };
              totalSavedBytes += saved;
              console.log(`   └─ ⚡ Compressed original in place: ${savedMsg} (backup: ${path.basename(backupPath)})`);
            } else if (outDir) {
              const outPath = outputPathFor(file);
              await fs.mkdir(path.dirname(outPath), { recursive: true });
              await moveFile(tempOutPath, outPath);
              totalSavedBytes += saved;
              console.log(`   └─ ⚡ Compressed copy written to ${outPath}: ${savedMsg}`);
            } else {
              await fs.rm(tempOutPath, { force: true });
              console.log(`   └─ 💡 Compression could save: ${savedMsg} (original untouched)`);
              potentialSavedBytes += saved;
            }
          } else {
            await fs.rm(tempOutPath, { force: true });
            if (inPlace) manifest[rel] = { size: originalSize, optimizedAt: new Date().toISOString() };
            console.log(`   └─ ⏩ Original already optimal.`);
            if (outDir) await copyIntoOut(file);
          }
          processedCount++;
        } catch (compErr) {
          await fs.rm(tempOutPath, { force: true });
          console.error(`   └─ ⚠️  Failed to compress original: ${compErr.message}`);
        }
      }
    }

    if (inPlace) {
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    }

    console.log('\n======================================================');
    console.log('📊 IMAGE OPTIMIZATION SUMMARY');
    console.log('======================================================');
    console.log(`Images processed:  ${processedCount}`);
    if (skippedCount) console.log(`Skipped:           ${skippedCount} (already optimized, see ${MANIFEST_NAME})`);
    for (const [format, st] of Object.entries(modernStats)) {
      if (format === 'avif' && !generateAvif) continue;
      if (st.count === 0) {
        console.log(`${format.toUpperCase()} generated:    0`);
        continue;
      }
      const pct = ((st.original - st.output) / st.original * 100).toFixed(1);
      console.log(`${format.toUpperCase()} generated:    ${st.count} file(s), ${formatBytes(st.original)} -> ${formatBytes(st.output)} [Saved ${formatBytes(st.original - st.output)}, ${pct}% vs originals]`);
    }
    if (convertToWebpOnly) {
      console.log('Originals:         not compressed (--webp-only)');
    } else if (inPlace) {
      console.log(`Originals:         compressed in place, saved ${formatBytes(totalSavedBytes)} (backups: *.orig)`);
    } else if (outDir) {
      console.log(`Originals:         compressed copies in ${outDir}, saved ${formatBytes(totalSavedBytes)}; originals untouched`);
    } else {
      console.log(`Originals:         untouched (safe mode); compressing them could save ${formatBytes(potentialSavedBytes)}`);
      console.log('                   use --out <dir> or --in-place to keep compressed copies');
    }
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
