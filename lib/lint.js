/**
 * 脚本卫生 lint：只提示，**不参与 PASS/FAIL**。
 *
 * 来源（2026-11-21 复盘 S21–S28）：校验器/反向验证里写死 `cn_dejure_core-v1.0`
 * 这类快照目录，或写死 `version="1.2"`，版本一升就静默失效——organizer 的
 * L8/L10/L11 就因此跳过了一整年。插件不复制校验规则，只在结果旁边把这类
 * 「会随版本漂的写法」指出来，让人回去改成从 META 解析。
 *
 * @module @local/ck3moddev/lint
 */

import fs from 'node:fs';
import path from 'node:path';

/** `'cn_dejure_core-v1.2'` / `"auto_spread-v2.1"` 这类快照目录字面量。 */
const SNAPSHOT_LITERAL_RE = /(['"])([A-Za-z0-9_]+-v\d+\.\d+)\1/g;

/** `version="1.2"`（不含 `1.21.*` 这种通配写法）。 */
const VERSION_LITERAL_RE = /version="(\d+\.\d+)"/g;

/** 读脚本；读不到返回空串（脚本不存在时 lint 静默跳过，由 check 的状态行负责报错）。 */
function readScript(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** 目录存在性（不抛异常）。 */
function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 快照字面量在本机是否有对应目录。
 *
 * 跨仓引用有三种写法：`<repo>/<literal>`、`<workspace>/<literal>`、
 * `<workspace>/<另一个仓>/<literal>`（`path.join(HERE, '..', 'ck3-de-jure-core', 'cn_dejure_core-v1.0')`）。
 * 找不到任何一个才算「硬编码了一个不存在的快照」。
 * @param {string} repo - 当前 mod 仓库根。
 * @param {string} literal - 快照目录名。
 * @returns {boolean} 有任意一个候选目录存在则为 true。
 */
function snapshotLiteralExists(repo, literal) {
  const workspace = path.dirname(repo);
  if (isDirectory(path.join(repo, literal))) return true;
  if (isDirectory(path.join(workspace, literal))) return true;
  try {
    for (const entry of fs.readdirSync(workspace, { withFileTypes: true })) {
      if (entry.isDirectory() !== true) continue;
      if (isDirectory(path.join(workspace, entry.name, literal))) return true;
    }
  } catch {
    // workspace 读不到时只按前两个候选判；宁可多提示，不静默放过。
  }
  return false;
}

/**
 * 扫描一个 mod 的校验器与反向验证脚本，返回卫生提示。
 * @param {any} mod - 注册表里的 mod 描述（需要 `repo` 与 `scripts.validator/reverse`）。
 * @returns {string[]} 提示列表（已去重）；空数组表示没发现。
 */
export function lintModScripts(mod) {
  /** @type {string[]} */
  const findings = [];
  const repo = typeof mod?.repo === 'string' ? mod.repo : '';
  if (repo === '') return findings;
  const scripts = mod?.scripts ?? {};
  const files = [
    ['静态校验', scripts.validator],
    ['反向验证', scripts.reverse],
  ];
  for (const [label, file] of files) {
    if (typeof file !== 'string' || file === '') continue;
    const text = readScript(file);
    if (text === '') continue;
    const name = `${label}（${path.basename(file)}）`;

    const seen = new Set();
    for (const match of text.matchAll(SNAPSHOT_LITERAL_RE)) {
      const literal = match[2];
      if (seen.has(literal)) continue;
      seen.add(literal);
      if (snapshotLiteralExists(repo, literal)) continue;
      findings.push(
        `${name}：硬编码快照目录「${literal}」在本机不存在——`
        + '从前置库/本仓 数据-元数据.mjs 的 buildDir 解析，别写死 vX.Y（否则整段检查会静默跳过）',
      );
    }

    for (const line of text.split(/\r?\n/)) {
      if (!line.includes('version="')) continue;
      // 反向验证的变异样本写在 .replace(...) 里，是「故意改坏」的目标值，不该被指责。
      if (line.includes('.replace(')) continue;
      for (const match of line.matchAll(VERSION_LITERAL_RE)) {
        findings.push(`${name}：硬编码 version="${match[1]}"——改用 ^version="[^"]+" 或从 META 取，版本升了就不会失效`);
      }
    }
  }
  return [...new Set(findings)];
}
