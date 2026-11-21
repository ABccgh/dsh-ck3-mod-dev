/**
 * descriptor 解析（纯读，无写）。
 *
 * workshop 预检与 status 都要回答「这个 mod 上传了吗 / 本机副本是哪一版」，
 * 以前解析逻辑埋在 `lib/tools/workshop.js` 里；0.9.0 抽出来给两个工具共用，
 * 免得出现「预检说 ID 一致、status 说没上传」这种自相矛盾。
 *
 * @module @local/ck3moddev/descriptor
 */

import fs from 'node:fs';
import path from 'node:path';

/** `key="value"` 行；descriptor 里只有这一种标量写法。 */
const FIELD_RE = /^\s*([a-z_]+)\s*=\s*"([^"]*)"/;

/** `tags` 块里的 `"值"` 行。 */
const TAG_RE = /^\s*"([^"]+)"\s*$/;

/**
 * 解析一个 descriptor 文件（缺文件不算错，返回 `exists: false`）。
 * @param {string} file - 绝对路径；空串表示未配置。
 * @returns {{ file: string, exists: boolean, fields: Record<string, string>, tags: string[] }} 解析结果。
 */
export function parseDescriptor(file) {
  if (typeof file !== 'string' || file === '') return { file: '', exists: false, fields: {}, tags: [] };
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { file, exists: false, fields: {}, tags: [] };
  }

  /** @type {Record<string, string>} */
  const fields = {};
  /** @type {string[]} */
  const tags = [];
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const tagMatch = line.match(TAG_RE);
    if (tagMatch !== null) {
      tags.push(tagMatch[1]);
      continue;
    }
    const fieldMatch = line.match(FIELD_RE);
    if (fieldMatch !== null) fields[fieldMatch[1]] = fieldMatch[2];
  }
  return { file, exists: true, fields, tags };
}

/**
 * 三份 descriptor：快照内层 / 快照外层 `.mod` / 本机副本 `.mod`。
 *
 * `mod` 是注册表补全后的描述（`deployMod` 是**外层 .mod 的路径**，内层目录用 `deployDir`）。
 * @param {any} mod - 注册表里的 mod 描述。
 * @returns {{ inner: ReturnType<typeof parseDescriptor>, outer: ReturnType<typeof parseDescriptor>,
 *   local: ReturnType<typeof parseDescriptor> }} 三份解析结果。
 */
export function descriptorViews(mod) {
  const snapshot = typeof mod?.snapshot === 'string' ? mod.snapshot : '';
  return {
    inner: parseDescriptor(snapshot === '' ? '' : path.join(snapshot, 'descriptor.mod')),
    outer: parseDescriptor(snapshot === '' ? '' : `${snapshot}.mod`),
    local: parseDescriptor(typeof mod?.deployMod === 'string' ? mod.deployMod : ''),
  };
}

/**
 * 三份 descriptor 里出现的 `remote_file_id`（去空、去重，保持内层优先）。
 * @param {ReturnType<typeof descriptorViews>} views - 三份解析结果。
 * @returns {string[]} 非空 ID 列表。
 */
export function remoteFileIds(views) {
  /** @type {string[]} */
  const out = [];
  for (const view of [views.inner, views.outer, views.local]) {
    if (view.exists !== true) continue;
    const id = String(view.fields.remote_file_id ?? '').trim();
    if (id !== '' && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * `1.21.*` 与 `1.21.0` 是否只差启动器回写（同 major.minor）。
 *
 * 启动器在上传/更新时会把它回写成实测版本；形状纪律不变，但字段对比要能区分
 * 「有意回写」与「真不一致」，否则 `ck3mod_workshop` 会把每次更新都判成 WARN。
 * @param {unknown} a - 一个 supported_version。
 * @param {unknown} b - 另一个 supported_version。
 * @returns {boolean} 同 major.minor 则为 true。
 */
export function isLauncherRewrite(a, b) {
  const left = String(a ?? '').trim();
  const right = String(b ?? '').trim();
  if (left === '' || right === '') return false;
  const leftBase = left.split('.').slice(0, 2).join('.');
  const rightBase = right.split('.').slice(0, 2).join('.');
  return leftBase !== '' && leftBase === rightBase;
}
