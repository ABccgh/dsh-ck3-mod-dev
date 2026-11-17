#!/usr/bin/env node
/**
 * 把仓库里的知识层（`skills/ck3-modding/`）部署到 DSH 实际加载的 skill 目录。
 *
 * 为什么需要：skill 的**源**在仓库里（跟着 GitHub 走），但 DSH 读的是
 * `%USERPROFILE%\.agents\skills\ck3-modding`。两边各存一份，必须有单向同步 + 漂移检测，
 * 否则改了仓库那份、会话里用的还是旧的。
 *
 * 方向固定为「仓库 → 用户目录」，不反向覆盖：用户目录里多出来的文件只在 `--check` 里报，
 * 不会被删。
 *
 * 用法：
 *   $node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
 *   & $node .\工具-同步技能.mjs            # 部署（覆盖写，不删多余文件）
 *   & $node .\工具-同步技能.mjs --check    # 只比对；有漂移退出码 1
 *   & $node .\工具-同步技能.mjs --dest D:\tmp\skills   # 换目标目录
 *
 * @module dsh-ck3-mod-dev/工具-同步技能
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(REPO, 'skills', 'ck3-modding');
const DEFAULT_DEST = path.join(os.homedir(), '.agents', 'skills', 'ck3-modding');

/**
 * 列出一棵目录下的所有文件（相对路径，用 / 分隔，便于跨平台比较）。
 * @param {string} root 目录。
 * @returns {string[]} 排序后的相对路径。
 */
function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir 当前目录。 @param {string} prefix 相对前缀。 */
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk(root, '');
  return out.sort();
}

/** @param {string} file 路径。 @returns {string} SHA256 十六进制。 */
function hashFile(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * 采集一侧的「相对路径 → 哈希」。
 * @param {string} root 目录。
 * @returns {Map<string, string>} 映射。
 */
function snapshot(root) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const rel of listFiles(root)) map.set(rel, hashFile(path.join(root, rel)));
  return map;
}

function parseArgs(argv) {
  const options = { check: false, dest: DEFAULT_DEST };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--dest') options.dest = path.resolve(argv[(i += 1)]);
    else if (arg === '--help' || arg === '-h') {
      console.log('用法: node 工具-同步技能.mjs [--check] [--dest <dir>]');
      console.log(`默认目标：${DEFAULT_DEST}`);
      process.exit(0);
    } else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const src = snapshot(SRC);
  if (src.size === 0) {
    console.error(`✗ 源目录为空或不存在：${SRC}`);
    process.exit(1);
  }
  const dest = snapshot(options.dest);

  const missing = [...src.keys()].filter((rel) => !dest.has(rel));
  const different = [...src.keys()].filter((rel) => dest.has(rel) && dest.get(rel) !== src.get(rel));
  const extra = [...dest.keys()].filter((rel) => !src.has(rel));
  const drifted = missing.length + different.length;

  if (options.check) {
    if (drifted === 0) {
      console.log(`✓ 目标与仓库一致（${src.size} 文件，${options.dest}）`);
      if (extra.length > 0) console.log(`  提示：目标多出 ${extra.length} 个仓库没有的文件（不自动删除）：${extra.join(', ')}`);
      return;
    }
    console.error(`✗ 目标与仓库不一致（${options.dest}）`);
    if (missing.length > 0) console.error(`  缺：${missing.join(', ')}`);
    if (different.length > 0) console.error(`  异：${different.join(', ')}`);
    if (extra.length > 0) console.error(`  多（不自动删）：${extra.join(', ')}`);
    console.error('  修复：node 工具-同步技能.mjs');
    process.exit(1);
  }

  let bytes = 0;
  for (const rel of src.keys()) {
    const target = path.join(options.dest, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const buffer = fs.readFileSync(path.join(SRC, rel));
    fs.writeFileSync(target, buffer);
    bytes += buffer.length;
  }
  console.log(`✓ 已同步 ${src.size} 个文件 / ${(bytes / 1024).toFixed(1)} KB → ${options.dest}`);
  if (missing.length + different.length > 0) {
    const touched = [...missing, ...different];
    console.log(`  本次更新：${touched.join(', ')}`);
  } else {
    console.log('  （内容本来就一致）');
  }
  if (extra.length > 0) console.log(`  目标多出 ${extra.length} 个仓库没有的文件（保留）：${extra.join(', ')}`);
}

try {
  main();
} catch (error) {
  console.error(`✗ 同步失败：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
