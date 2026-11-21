/**
 * 游戏日志解析（纯函数，无 IO）。
 *
 * 实测格式（`logs/error.log`）：
 *   `[21:10:24][E][portrait_type.cpp:76]: Undefined entity 'xxx' ...`
 * 崩溃栈是没有前缀的裸行；`logs/debug.log` 里还有启动器写下的 mod 启用清单：
 *   `天降横财 面板实验|mod/free_resources_panel_exp.mod|Enabled`
 * 以及数据挂载行：
 *   `[21:10:19][D][virtualfilesystem_physfs.cpp:814]: Mounted Data: <path>`
 *
 * 把这些格式集中在这里，是为了让 `ck3mod_logs` 与 `ck3mod_headless` 用同一套判断，
 * 不会出现「日志工具说干净、无头工具说脏」这种自相矛盾。
 *
 * @module @local/ck3moddev/gamelog
 */

/** 出现即视为崩溃的字符串（实测 `Instance has not been created!` 是常见收尾崩溃）。 */
export const CRASH_MARKERS = [
  'Instance has not been created!',
  'Unhandled exception',
  'EXCEPTION_ACCESS_VIOLATION',
  'Stack trace',
];

const ENTRY_RE = /^\[(\d{2}:\d{2}:\d{2})\]\[([A-Za-z])\]\[([^\]]*)\]:\s?(.*)$/;
const ENABLED_RE = /^([^|\r\n]+?)\|(mod\/[^|\r\n]+?\.mod)\|Enabled\s*$/gm;
const MOUNTED_RE = /Mounted Data:\s*(.+?)\s*$/;

/**
 * 把一整份日志切成条目。
 * @param {string} text - 日志全文。
 * @returns {{ time: string, level: string, source: string, message: string, raw: string }[]}
 *   条目；无前缀的裸行 `level` 为空。
 */
export function parseEntries(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    if (raw === '') continue;
    const match = raw.match(ENTRY_RE);
    if (match === null) {
      out.push({ time: '', level: '', source: '', message: raw, raw });
      continue;
    }
    out.push({ time: match[1], level: match[2], source: match[3], message: match[4], raw });
  }
  return out;
}

/**
 * 取错误级条目（`[E]`）。
 * @param {string} text - 日志全文。
 * @returns {ReturnType<typeof parseEntries>} 错误条目。
 */
export function errorEntries(text) {
  return parseEntries(text).filter((entry) => entry.level === 'E');
}

/**
 * 从 `debug.log` 里读启动器写下的「本次启用了哪些 mod」。
 * @param {string} text - debug.log 全文。
 * @returns {{ name: string, entry: string }[]} 启用的 mod（按出现顺序去重）。
 */
export function enabledMods(text) {
  const out = [];
  const seen = new Set();
  for (const match of String(text ?? '').matchAll(ENABLED_RE)) {
    const name = match[1].trim();
    const entry = match[2].trim();
    if (seen.has(entry)) continue;
    seen.add(entry);
    out.push({ name, entry });
  }
  return out;
}

/**
 * 从 `debug.log` 里读 `Mounted Data:` 行，默认只保留 mod 目录。
 * @param {string} text - debug.log 全文。
 * @param {{ onlyMods?: boolean }} [options] - `onlyMods` 默认 true。
 * @returns {string[]} 挂载路径（去重，保持顺序）。
 */
export function mountedData(text, options = {}) {
  const onlyMods = options.onlyMods !== false;
  const out = [];
  const seen = new Set();
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = line.match(MOUNTED_RE);
    if (match === null) continue;
    const value = match[1];
    if (onlyMods && !/(^|[\\/])mod[\\/]/.test(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * 用 mod token 过滤条目（路径里出现内层文件夹名最常见）。
 * @param {ReturnType<typeof parseEntries>} entries - 条目。
 * @param {string[]} tokens - token 列表。
 * @returns {ReturnType<typeof parseEntries>} 命中的条目。
 */
export function entriesMatching(entries, tokens) {
  const list = tokens.filter((token) => typeof token === 'string' && token !== '');
  if (list.length === 0) return [];
  return entries.filter((entry) => list.some((token) => entry.raw.includes(token)));
}

/**
 * 统计每个 token 命中多少条（用于「error.log 里 cn_scheme_mastery 计数为 0」这类验收）。
 * @param {ReturnType<typeof parseEntries>} entries - 条目。
 * @param {string[]} tokens - token 列表。
 * @returns {{ token: string, count: number }[]} 计数（按传入顺序）。
 */
export function countByToken(entries, tokens) {
  return tokens
    .filter((token) => typeof token === 'string' && token !== '')
    .map((token) => ({ token, count: entries.filter((entry) => entry.raw.includes(token)).length }));
}

/**
 * 找出崩溃标记行。
 * @param {ReturnType<typeof parseEntries>} entries - 条目。
 * @returns {string[]} 命中的原始行。
 */
export function crashLines(entries) {
  return entries
    .filter((entry) => CRASH_MARKERS.some((marker) => entry.raw.includes(marker)))
    .map((entry) => entry.raw.trim());
}

/** 引擎「设了但没用」的错误来源文件名（1.21 实测）。 */
export const UNUSED_VARIABLE_SOURCE = 'jomini_effect.cpp:1151';

const UNUSED_VARIABLE_RE = /Variable '([^']+)' is set but is never used/;
const SET_GLOBAL_VARIABLE_RE = /set_global_variable\s*=\s*\{\s*name\s*=\s*([A-Za-z0-9_]+)/g;

/**
 * 从 mod 脚本里收集 `set_global_variable = { name = X }` 的 X。
 *
 * 这是 `ck3mod_headless` 归因的第二组 token：引擎报
 * `Variable 'cn_dejure_suite_organizer' is set but is never used` 时，
 * 变量名里往往**没有** mod 文件夹名，只按 folder 过滤会漏（2026-11-21 实测 2 条）。
 * @param {string} text - 脚本全文。
 * @returns {string[]} 变量名（去重，保持出现顺序）。
 */
export function setGlobalVariableNames(text) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const match of String(text ?? '').matchAll(SET_GLOBAL_VARIABLE_RE)) out.add(match[1]);
  return [...out];
}

/**
 * 找出「变量设了但没用」的错误条目。
 *
 * 返回变量名而不是只返回行：日志工具要按名字显示、headless 要判断是不是本 mod 设的。
 * @param {ReturnType<typeof parseEntries>} entries - 条目。
 * @returns {{ name: string, entry: ReturnType<typeof parseEntries>[number] }[]} 命中项。
 */
export function unusedVariableEntries(entries) {
  /** @type {{ name: string, entry: ReturnType<typeof parseEntries>[number] }[]} */
  const out = [];
  for (const entry of entries) {
    const match = String(entry.raw ?? '').match(UNUSED_VARIABLE_RE);
    if (match === null) continue;
    out.push({ name: match[1], entry });
  }
  return out;
}

/**
 * 只取「变量设了但没用」的变量名。
 * @param {ReturnType<typeof parseEntries>} entries - 条目。
 * @returns {string[]} 变量名（去重）。
 */
export function unusedVariableNames(entries) {
  return [...new Set(unusedVariableEntries(entries).map((item) => item.name))];
}

/**
 * 去掉时间戳并排序，得到可直接做差集的行签名。
 *
 * 无头基线对照用的是「两轮日志去掉时间戳排序后应 0 差异」，
 * 所以时间戳必须剥掉，否则同一份日志永远有差异。
 * @param {string} text - 日志全文。
 * @returns {string[]} 排序后的行签名。
 */
export function signatures(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\[\d{2}:\d{2}:\d{2}\]/, '').trimEnd())
    .filter((line) => line !== '')
    .sort();
}

/**
 * 两份日志签名的差异（只在 b 里 = 新增；只在 a 里 = 消失）。
 * @param {string[]} a - 基线签名。
 * @param {string[]} b - 对照签名。
 * @returns {{ added: string[], removed: string[] }} 差异。
 */
export function diffSignatures(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    added: b.filter((line) => !setA.has(line)),
    removed: a.filter((line) => !setB.has(line)),
  };
}
