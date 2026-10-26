/**
 * 工具输出与参数的小工具：统一文本输出形状、数值夹紧、必填文本、超长输出落盘。
 *
 * 所有 `ck3mod_*` 工具都返回 `{ text }`：模型真正需要的是可读文本，
 * 而结构化对象一旦 schema 写错会在调用时变成校验失败。
 *
 * @module @local/ck3moddev/text
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 所有 `ck3mod_*` 工具的输出形状。 */
export const TEXT_OUTPUT = {
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string', required: true, description: '给模型阅读的文本结果' },
    },
  },
  render: (_args, value) => [{ type: 'text', text: String(value.text) }],
};

/** 只读工具都可以并发执行。 */
export function alwaysSafe() {
  return true;
}

/**
 * 把可选的整数参数收进合法范围（用于 `tail` / `limit` / `timeoutSec`）。
 * @param {unknown} value - 原始值。
 * @param {number} fallback - 默认值。
 * @param {number} min - 下限（含）。
 * @param {number} max - 上限（含）。
 * @returns {number} 夹紧后的整数。
 */
export function clampInt(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = typeof value === 'number' ? Math.trunc(value) : Number.parseInt(String(value ?? ''), 10);
  const base = Number.isFinite(parsed) ? parsed : Math.trunc(fallback);
  return Math.min(Math.max(base, min), max);
}

/**
 * 取一个必填的非空文本参数。
 * @param {unknown} value - 原始值。
 * @param {string} name - 参数名（写进错误消息）。
 * @returns {string} 去空白后的文本。
 * @throws {Error} 为空时。
 */
export function requireText(value, name) {
  const text = String(value ?? '').trim();
  if (text === '') throw new Error(`${name} 不能为空。`);
  return text;
}

/**
 * 把字节数变成可读形式（B / KiB / MiB）。
 * @param {number} bytes - 字节数。
 * @returns {string} 可读文本。
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

/**
 * 取文本末尾 n 行（去掉尾部空行）。
 * @param {string} text - 原文。
 * @param {number} n - 行数。
 * @returns {string} 尾部文本。
 */
export function tailLines(text, n) {
  const lines = String(text ?? '').trimEnd().split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - n)).join('\n');
}

/**
 * 取文本开头 n 行。
 * @param {string} text - 原文。
 * @param {number} n - 行数。
 * @returns {string} 头部文本。
 */
export function headLines(text, n) {
  const lines = String(text ?? '').trimEnd().split(/\r?\n/);
  return lines.slice(0, Math.max(0, n)).join('\n');
}

/**
 * 截断超长输出：保留头尾，并把完整文本写到 `%TEMP%\ck3mod\`。
 *
 * 为什么需要：`工具-静态校验.mjs` 失败时能刷几十行，而模型只需要「哪里红了」；
 * 但完整输出经常是唯一的证据，所以不能丢，只能挪到磁盘上并给出路径。
 * @param {string} text - 完整输出。
 * @param {number} maxChars - 展示上限。
 * @param {string} tag - 用于命名落盘文件（如 `check-curse`）。
 * @param {() => Date} [now] - 时间源（测试用）。
 * @returns {string} 截断后的文本（足够短时原样返回）。
 */
export function capOutput(text, maxChars, tag, now = () => new Date()) {
  const value = String(text ?? '');
  if (value.length <= maxChars) return value;

  const headLen = Math.max(1, Math.floor(maxChars * 0.65));
  const tailLen = Math.max(1, maxChars - headLen);
  const head = value.slice(0, headLen);
  const tail = value.slice(value.length - tailLen);

  let note = `\n…（输出被截断：原始 ${value.length} 字符，上限 ${maxChars}）`;
  try {
    const dir = path.join(os.tmpdir(), 'ck3mod');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = now().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `${stamp}-${String(tag).replace(/[^\w.-]+/g, '_')}.log`);
    fs.writeFileSync(file, value, 'utf8');
    note += `\n完整输出：${file}`;
  } catch {
    note += '\n（完整输出落盘失败）';
  }
  return `${head}\n${note}\n${tail}`;
}
