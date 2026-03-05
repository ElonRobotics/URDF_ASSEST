const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');

const EXCLUDE_DIRS = new Set(['bundle', 'utils', '.github', '.git']);

/**
 * 计算文件夹内容的 hash
 * @param {string} dirPath 源文件夹路径
 * @returns {Promise<string>} 6位 hash 字符串
 */
async function getFolderHash(dirPath) {
  const hash = crypto.createHash('md5');
  const files = [];

  async function readDir(currentDir) {
    const items = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(currentDir, item.name);
      if (item.isDirectory()) {
        await readDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  await readDir(dirPath);
  files.sort();
  for (const file of files) {
    const relativePath = path.relative(dirPath, file);
    hash.update(relativePath.split(path.sep).join('/'));
    const fileContent = fs.readFileSync(file);
    hash.update(fileContent);
  }
  return hash.digest('hex').substring(0, 6);
}

/**
 * 压缩单个文件夹
 * @param {string} sourceDir 源文件夹路径
 * @param {string} outPath 输出 zip 文件路径
 * @param {string} rootDir 仓库根目录，用于计算相对路径
 * @returns {Promise<void>}
 */
function zipDirectory(sourceDir, outPath, rootDir) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 设置压缩级别
    });

    output.on('close', () => {
      console.log(`压缩完成: ${archive.pointer()} total bytes`);
      resolve();
    });

    archive.on('error', err => {
      reject(err);
    });

    archive.pipe(output);

    // 获取文件夹名称，作为 zip 内部的根路径
    const dirName = path.basename(sourceDir);

    // 将文件夹内容添加到压缩包
    // 注意：我们希望 zip 内部包含文件夹本身（即 fourier_n1/file1, fourier_n1/file2...）
    // 这与原 python 逻辑 `arcname = os.path.relpath(file_path, root_dir)` 一致
    archive.directory(sourceDir, dirName);

    archive.finalize();
  });
}

async function main() {
  // 获取仓库根目录（脚本所在目录的上级）
  const scriptDir = __dirname;
  const rootDir = path.dirname(scriptDir);

  // bundle 输出目录
  const bundleDir = path.join(rootDir, 'bundle');

  // 如果 bundle 目录已存在，先清空
  if (fs.existsSync(bundleDir)) {
    console.log(`正在清空现有目录: ${bundleDir}`);
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
  fs.mkdirSync(bundleDir, { recursive: true });

  // 遍历根目录下的所有文件夹
  const items = fs.readdirSync(rootDir, { withFileTypes: true });
  const dirsToZip = items
    .filter(item => item.isDirectory() && !EXCLUDE_DIRS.has(item.name))
    .map(item => item.name)
    .sort();

  const buildTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const files = [];
  const hashes = {};

  for (const dirName of dirsToZip) {
    const dirPath = path.join(rootDir, dirName);
    const zipName = `${dirName}.zip`;
    const zipPath = path.join(bundleDir, zipName);

    console.log(`正在处理: ${dirName} -> ${zipName}`);

    try {
      // 并发执行压缩和 hash 计算
      const [_, dirHash] = await Promise.all([zipDirectory(dirPath, zipPath, rootDir), getFolderHash(dirPath)]);

      files.push(zipName);
      hashes[dirName] = dirHash;
    } catch (error) {
      console.error(`处理 ${dirName} 失败:`, error.message);
    }
  }

  const listData = {
    build_time: buildTime,
    files: files,
    hash: hashes,
  };

  const listJsonPath = path.join(bundleDir, 'list.json');
  fs.writeFileSync(listJsonPath, JSON.stringify(listData, null, 2), 'utf-8');

  console.log(`完成！共压缩 ${files.length} 个文件夹`);
  console.log(`生成Hash: ${JSON.stringify(hashes)}`)
  console.log(`构建时间: ${buildTime}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('运行失败:', err);
    process.exit(1);
  });
}
