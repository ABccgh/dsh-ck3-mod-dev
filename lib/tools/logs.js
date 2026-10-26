/**
 * `ck3mod_logs`：只读地复查 CK3 的日志。
 *
 * 无头测试与真机试玩之后，模型真正需要的是三件事：
 * 1. `error.log` 里有没有跟本次改动相关的 `[E]`（以及有没有崩溃标记）；
 * 2. `debug.log` 里这一轮到底启用了哪些 mod（多个 mod 同时启用时归因不干净）；
 * 3. `game.log` 尾部的启动信息。
 *
 * 解析规则全部来自 `gamelog.js`，与 `ck3mod_headless` 共用同一套判断，避免两个工具
 * 对同一份日志给出相反结论。本工具**只读**，不写、不删、不启动游戏。
 *
 * @module @local/ck3moddev/tools/logs
 */

import fs from 'node:fs';
import path from 'node:path';

import { crashLines, countByToken, enabledMods, entriesMatching, errorEntries, mountedData } from '../gamelog.js';
import { modTokens, selectMods } from '../registry.js';
import { TEXT_OUTPUT, alwaysSafe, capOutput, clampInt, formatBytes, tailLines } from '../text.js';
import { defineTool } from '../tool-kit.js';

/** `file` 参数允许的取值。 */
const LOG_FILES = new Set(['error', 'debug', 'game', 'all']);

/** 单条错误行渲染上限（原始行可能带超长资源路径）。 */
const ENTRY_RENDER_CHARS = 300;

/** `Mounted Data` 列表最多逐条列多少行。 */
const MOUNTED_LIST_LIMIT = 20;

/**
 * 创建 `ck3mod_logs` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string }>,
 *   now: () => Date,
 * }} deps - 生效配置与宿主能力。
 * @returns {object} `defineTool` 产物。
 */
export function logsTool(deps) {
  const { config } = deps;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();

  return defineTool({
    name: 'ck3mod_logs',
    description:
      '只读复查 CK3 日志（logs/ 目录）：file=error 看 error.log 的 [E] 条目、崩溃标记，并可按 mod 过滤与计数；file=debug 看本次启用了哪些 mod、Mounted Data 与错误；file=game 看 game.log 尾部；file=all 看所有日志文件的摘要。不修改任何文件，不启动游戏。',
    parameters: {
      file: {
        type: 'string',
        enum: ['error', 'debug', 'game', 'all'],
        description: '看哪个日志：error（默认，报错条目 + 崩溃标记）、debug（本次启用的 mod + 挂载 + 错误）、game（game.log 尾部）、all（所有日志文件摘要）。',
      },
      mod: {
        type: 'string',
        description: '按 mod 注册表 id 过滤 error.log 的 [E] 条目并给每个 token 的计数（curse / dejure / free / auto，或 all）；只在 file=error 时生效。',
      },
      tail: {
        type: 'integer',
        description: '显示最后多少条/行，默认 60（范围 1–200）。',
      },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: alwaysSafe,
    timeoutMs: 30_000,
    async execute(args) {
      const file = requireLogFile(args.file);
      const tail = clampInt(args.tail, 60, 1, 200);
      const text = file === 'all'
        ? renderAll(config)
        : await renderSingle(deps, config, file, args, tail);
      return { text: capOutput(text, config.maxOutputChars, 'logs', now) };
    },
  });
}

/**
 * 渲染单个日志文件。
 * @param {{ getRegistry: () => Promise<any> }} deps - 宿主能力（按 mod 过滤时要用）。
 * @param {any} config - 生效配置。
 * @param {'error' | 'debug' | 'game'} file - 日志种类。
 * @param {{ mod?: unknown }} args - 工具参数。
 * @param {number} tail - 显示条数/行数。
 * @returns {Promise<string>} 文本。
 */
async function renderSingle(deps, config, file, args, tail) {
  const target = path.join(config.logDir, `${file}.log`);
  if (!isFile(target)) throw new Error(missingLogMessage(config.logDir, target));

  const text = readLogText(target);
  if (file === 'error') return renderError(deps, target, text, args, tail);
  if (file === 'debug') return renderDebug(target, text, tail);
  return renderGame(target, text, tail);
}

/**
 * 渲染 `error.log`：总数、按 mod 过滤与计数、尾部条目、崩溃标记。
 * @param {{ getRegistry: () => Promise<any> }} deps - 宿主能力。
 * @param {string} target - error.log 路径。
 * @param {string} text - 日志全文。
 * @param {{ mod?: unknown }} args - 工具参数。
 * @param {number} tail - 显示条数。
 * @returns {Promise<string>} 文本。
 */
async function renderError(deps, target, text, args, tail) {
  const lines = [describeFile(target)];
  const entries = errorEntries(text);
  lines.push(`错误条目：[E] 共 ${entries.length} 条`);

  let selected = entries;
  const modArg = String(args.mod ?? '').trim();
  if (modArg !== '') {
    const filter = await filterByMod(deps, modArg, entries);
    if (filter.warning !== '') {
      lines.push(filter.warning);
    } else {
      lines.push(`mod 过滤：${filter.label}（token：${filter.tokens.join(' / ')}）命中 ${filter.matched.length} 条`);
      lines.push(`token 计数：${filter.counts.map((item) => `${item.token}=${item.count}`).join(' · ')}`);
      selected = filter.matched;
    }
  }

  const shown = selected.slice(Math.max(0, selected.length - tail));
  if (shown.length === 0) {
    lines.push(modArg === '' ? '最后 0 条：error.log 里没有 [E] 条目。' : `最后 0 条：${modArg} 没有匹配的 [E] 条目。`);
  } else {
    lines.push('', `最后 ${shown.length} 条 [E]（共 ${selected.length} 条，显示尾部 ${shown.length} 条）：`);
    for (const entry of shown) lines.push(`  ${truncate(entry.raw, ENTRY_RENDER_CHARS)}`);
  }

  const crashes = crashLines(entries);
  if (crashes.length === 0) {
    lines.push('', '崩溃标记：无');
  } else {
    lines.push('', `崩溃标记：${crashes.length} 行`);
    for (const line of crashes.slice(0, 10)) lines.push(`  ${truncate(line, ENTRY_RENDER_CHARS)}`);
    if (crashes.length > 10) lines.push(`  …（还有 ${crashes.length - 10} 行）`);
    lines.push('崩溃标记说明游戏进程异常收尾；先用 file=debug 确认只启用了一个 mod，再跑 ck3mod_headless 复现。');
  }

  return lines.join('\n');
}

/**
 * 渲染 `debug.log`：启用清单、Mounted Data、[E] 尾部。
 * @param {string} target - debug.log 路径。
 * @param {string} text - 日志全文。
 * @param {number} tail - 错误条目显示条数。
 * @returns {string} 文本。
 */
function renderDebug(target, text, tail) {
  const lines = [describeFile(target)];

  const enabled = enabledMods(text);
  if (enabled.length === 0) {
    lines.push('本次启用的 mod：读不到（debug.log 里没有 "名字|mod/xxx.mod|Enabled" 行）。');
  } else {
    lines.push(`本次启用的 mod：${enabled.length} 个`);
    for (const item of enabled) lines.push(`  - ${item.name} → ${item.entry}`);
    if (enabled.length > 1) {
      lines.push('⚠ 本次启用了多个 mod，隔离不干净：无头测试/报错归因前只留一个 mod。');
    }
  }

  const mounted = mountedData(text);
  lines.push('', `Mounted Data（mod 目录）：${mounted.length} 条`);
  for (const item of mounted.slice(0, MOUNTED_LIST_LIMIT)) lines.push(`  - ${item}`);
  if (mounted.length > MOUNTED_LIST_LIMIT) lines.push(`  …（还有 ${mounted.length - MOUNTED_LIST_LIMIT} 条）`);

  const errors = errorEntries(text);
  lines.push('', `debug.log 里的 [E]：${errors.length} 条`);
  for (const entry of errors.slice(Math.max(0, errors.length - tail))) {
    lines.push(`  ${truncate(entry.raw, ENTRY_RENDER_CHARS)}`);
  }

  return lines.join('\n');
}

/**
 * 渲染 `game.log` 尾部。
 * @param {string} target - game.log 路径。
 * @param {string} text - 日志全文。
 * @param {number} tail - 显示行数。
 * @returns {string} 文本。
 */
function renderGame(target, text, tail) {
  const lines = [describeFile(target)];
  const rows = text.trimEnd() === '' ? [] : text.trimEnd().split(/\r?\n/);
  if (rows.length === 0) {
    lines.push('（空文件）');
    return lines.join('\n');
  }
  lines.push(`尾部 ${Math.min(tail, rows.length)} 行（共 ${rows.length} 行）：`);
  for (const line of tailLines(text, tail).split('\n')) lines.push(`  ${line}`);
  return lines.join('\n');
}

/**
 * 渲染 `file=all`：每个 `*.log` 一段摘要。
 * @param {any} config - 生效配置。
 * @returns {string} 文本。
 */
function renderAll(config) {
  let names;
  try {
    names = fs.readdirSync(config.logDir).filter((name) => /\.log$/i.test(name)).sort();
  } catch (error) {
    throw new Error(
      `日志目录不存在或读不了：${config.logDir}\n${firstLine(errorMessage(error))}\n`
      + '先启动一次游戏（或跑一次 ck3mod_headless），让游戏把日志写出来。',
    );
  }

  if (names.length === 0) {
    return `日志目录：${config.logDir}\n里面没有任何 *.log 文件。先启动一次游戏（或跑一次 ck3mod_headless）让游戏写日志。`;
  }

  const lines = [`日志目录：${config.logDir}`, `共 ${names.length} 个 *.log：`];
  for (const name of names) {
    const file = path.join(config.logDir, name);
    try {
      const stat = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
      lines.push(`  - ${name}：${formatBytes(stat.size)} · ${formatTime(stat.mtime)} · [E] ${errorEntries(content).length}`);
    } catch (error) {
      lines.push(`  - ${name}：读取失败（${firstLine(errorMessage(error))}）`);
    }
  }
  lines.push('', '用 file=error 看报错细节（可加 mod=... 过滤），file=debug 看本次启用了哪些 mod，file=game 看 game.log 尾部。');
  return lines.join('\n');
}

/**
 * 按 mod 过滤 `[E]` 条目并统计 token 计数。
 *
 * 注册表读不到时**不抛**：给出警告后按全部条目继续展示，日志工具本身仍然有用。
 * @param {{ getRegistry: () => Promise<any> }} deps - 宿主能力。
 * @param {string} modArg - `mod` 参数。
 * @param {ReturnType<typeof errorEntries>} entries - 全部 [E] 条目。
 * @returns {Promise<{ warning: string, label: string, tokens: string[], counts: { token: string, count: number }[], matched: ReturnType<typeof errorEntries> }>}
 *   过滤结果。
 */
async function filterByMod(deps, modArg, entries) {
  let registry;
  try {
    registry = await deps.getRegistry();
  } catch (error) {
    return {
      warning: `mod 过滤失败：读不到 mod 注册表 —— ${firstLine(errorMessage(error))}（下面显示全部 [E]）`,
      label: '',
      tokens: [],
      counts: [],
      matched: entries,
    };
  }

  // 未知 id 是调用方错误：让 selectMods 的中文说明（含可用 id）抛出去。
  const mods = selectMods(registry, modArg);
  const tokens = [...new Set(mods.flatMap((mod) => modTokens(mod)))];
  return {
    warning: '',
    label: mods.map((mod) => `${mod.id}（${mod.label}）`).join(' / '),
    tokens,
    counts: countByToken(entries, tokens),
    matched: entriesMatching(entries, tokens),
  };
}

/**
 * 校验 `file` 参数（enum 不会被 defineTool 校验，这里自己收）。
 * @param {unknown} raw - 原始值。
 * @returns {'error' | 'debug' | 'game' | 'all'} 日志种类。
 * @throws {Error} 未知取值时。
 */
function requireLogFile(raw) {
  if (raw === undefined || raw === null) return 'error';
  const value = String(raw).trim().toLowerCase();
  if (value === '') return 'error';
  if (!LOG_FILES.has(value)) throw new Error(`未知 file：${raw}（可用 error / debug / game / all）`);
  return /** @type {'error' | 'debug' | 'game' | 'all'} */ (value);
}

/**
 * 日志文件缺失时的可执行错误消息：顺便列出目录里真实存在的 `*.log`。
 * @param {string} logDir - 日志目录。
 * @param {string} target - 缺失的目标文件。
 * @returns {string} 错误消息。
 */
function missingLogMessage(logDir, target) {
  const lines = [`日志文件不存在：${target}`];
  try {
    const names = fs.readdirSync(logDir).filter((name) => /\.log$/i.test(name)).sort();
    lines.push(
      names.length > 0
        ? `日志目录里现有的 *.log：${names.join(' / ')}`
        : `日志目录里没有任何 *.log：${logDir}`,
    );
  } catch {
    lines.push(`日志目录本身不存在或读不了：${logDir}`);
    lines.push('先启动一次游戏（或跑一次 ck3mod_headless），让游戏把日志写出来。');
  }
  lines.push('用 file=all 看所有日志文件的摘要。');
  return lines.join('\n');
}

/**
 * 读日志文本并去掉 UTF-8 BOM（否则第一行会解析失败）。
 * @param {string} file - 日志路径。
 * @returns {string} 文本。
 * @throws {Error} 读取失败时。
 */
function readLogText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    throw new Error(`读不到日志文件：${file}\n${firstLine(errorMessage(error))}`);
  }
}

/**
 * 渲染文件的时间与大小行，如 `error.log：3.4 KiB · 2026-10-26 21:10:27`。
 * @param {string} file - 文件路径。
 * @returns {string} 文本行。
 */
function describeFile(file) {
  const name = path.basename(file);
  try {
    const stat = fs.statSync(file);
    return `${name}：${formatBytes(stat.size)} · ${formatTime(stat.mtime)}`;
  } catch (error) {
    return `${name}：状态读不到（${firstLine(errorMessage(error))}）`;
  }
}

/**
 * 判断路径是不是存在的普通文件。
 * @param {string} file - 路径。
 * @returns {boolean} 存在则为 true。
 */
function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * 把文本截断到指定长度。
 * @param {unknown} text - 原文。
 * @param {number} maxChars - 上限。
 * @returns {string} 截断后的文本。
 */
function truncate(text, maxChars) {
  const value = String(text ?? '');
  return value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1))}…`;
}

/**
 * 把 mtime 格式化成 `YYYY-MM-DD HH:mm:ss`（本地时区）。
 * @param {Date} date - 时间。
 * @returns {string} 文本。
 */
function formatTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 取文本第一行。
 * @param {unknown} text - 文本。
 * @returns {string} 第一行去空白后的文本。
 */
function firstLine(text) {
  const value = typeof text === 'string' ? text : String(text ?? '');
  const line = value.split(/\r?\n/).find((item) => item.trim() !== '');
  return line === undefined ? '' : line.trim();
}

/**
 * 从任意值里取出错误消息文本。
 * @param {unknown} error - 错误。
 * @returns {string} 文本。
 */
function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error ?? '未知错误');
}
