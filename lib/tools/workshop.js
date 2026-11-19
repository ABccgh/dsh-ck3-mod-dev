/**
 * `ck3mod_workshop`：工坊上传前的**只读**预检。
 *
 * 工坊上传只能由人手动完成，且上传后不可撤销；所以模型在提醒人上传之前，应该先把
 * 这几件容易出错的事核对一遍：
 * 1. 描述文件（`工坊描述-BBCode.txt`）**每段**的 UTF-8 字节数是否超过 Steam 的 8000 上限。
 *    注意 8000 是 `k_cchPublishedDocumentDescriptionMax`，按**每段**算：描述文件里
 *    「第 1 段：描述」与「第 2 段：修补程序说明」是分别粘到启动器两个字段的，所以
 *    整文件可以远超 8000 字节而仍然合法。分段标记有两种真实格式：
 *    - `########## 第 1 段：… ##########` … `########## 第 1 段结束 ##########`（free / auto 风格）；
 *    - 一行 `==================== 第 2 段：修补程序说明 ====================` 分隔（dejure 风格）；
 *    - 没有任何标记时，整个文件就是一段（无标记风格）。
 * 2. descriptor 的 `name` 是否超过 Steam 的 128 字节上限；BBCode 标签是否配平。
 * 3. 三份 descriptor（快照内层 `descriptor.mod`、仓库外层 `<快照>.mod`、本机副本
 *    `<modsDir>/<folder>.mod`）的关键字段是否一致，`remote_file_id` 是否为空。
 * 4. `thumbnail.png` 是否存在、尺寸是否读得出来。
 *
 * 本工具不写任何文件、不上传、不打开浏览器。
 *
 * @module @local/ck3moddev/tools/workshop
 */

import fs from 'node:fs';
import path from 'node:path';

import { selectMods } from '../registry.js';
import { TEXT_OUTPUT, alwaysSafe, capOutput, formatBytes } from '../text.js';
import { defineTool } from '../tool-kit.js';

/** Steam 工坊描述（BBCode）**每段**的字节上限（`k_cchPublishedDocumentDescriptionMax`）。 */
const DESCRIPTION_LIMIT = 8_000;

/** Steam 工坊 mod 名称的字节上限。 */
const NAME_LIMIT = 128;

/** 参与 BBCode 配平统计的标签（Steam 的解析器对未闭合标签很敏感）。 */
const BBCODE_TAGS = ['b', 'i', 'u', 'h1', 'h2', 'h3', 'list', 'url', 'quote', 'spoiler', 'table', 'tr', 'td', 'th', 'code'];

/** descriptor 对照时逐个比较的字段。 */
const COMPARE_FIELDS = ['remote_file_id', 'version', 'supported_version', 'name'];

/** `key="value"` 行。CK3 的 descriptor 字段名只由小写字母和下划线组成。 */
const FIELD_RE = /^\s*([a-z_]+)\s*=\s*"([^"]*)"/;

/** 纯 `"value"` 行：descriptor 里的 `tags={ ... }` 块成员。 */
const TAG_RE = /^\s*"([^"]*)"\s*$/;

/** 「第 2 段」分隔行（dejure 风格）。 */
const SEGMENT_SEPARATOR_RE = /^=+\s*第\s*2\s*段.*=+\s*$/m;

/** 「########## 第 N 段：标题 ########## … ########## 第 N 段结束 ##########」成对标记（free / auto 风格）。 */
const SEGMENT_MARKER_RE = /第\s*(\d+)\s*段([^\n]*?)##########([\s\S]*?)##########\s*第\s*\1\s*段结束/g;

/** PNG 文件签名（8 字节）。 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 创建 `ck3mod_workshop` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string }>,
 *   now: () => Date,
 * }} deps - 生效配置与宿主能力。
 * @returns {object} `defineTool` 产物。
 */
export function workshopTool(deps) {
  const { config } = deps;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();

  return defineTool({
    name: 'ck3mod_workshop',
    description:
      '工坊上传前的只读预检：描述文件（工坊描述-BBCode.txt）按「段」核对 UTF-8 字节数（Steam 上限是每段 8000 字节，不是整个文件；自动识别 ########## 成对标记与 ===== 第 2 段 ===== 分隔行）、descriptor 的 name 是否 ≤128 字节、BBCode 标签是否配平、三份 descriptor（快照内层/仓库外层/本机副本）的 remote_file_id / version / supported_version / name 是否一致、remote_file_id 是否为空（空 ID 上传会新建条目且不可撤销）、thumbnail.png 是否存在及宽高。不上传、不写文件。',
    parameters: {
      mod: {
        type: 'string',
        description: '预检哪个 mod（dejure / free / auto / mastery）；省略或 all 预检全部。',
      },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: alwaysSafe,
    timeoutMs: 30_000,
    async execute(args) {
      let registry;
      try {
        registry = await deps.getRegistry();
      } catch (error) {
        throw new Error(
          `读不到 mod 注册表，无法做工坊预检：${errorMessage(error)}\n`
          + '把插件配置的 toolsDir 指向 D:\\DSH workspace\\ck3-modding-tools 后重试。',
        );
      }

      const mods = selectMods(registry, args.mod);
      const blocks = mods.map((mod) => renderMod(mod));
      blocks.push('说明：本工具只做只读预检；工坊上传只能由人手动执行，remote_file_id 为空时先停下确认。');

      return { text: capOutput(blocks.join('\n\n'), config.maxOutputChars, 'workshop', now) };
    },
  });
}

/**
 * 预检单个 mod 并渲染成文本块。
 * @param {any} mod - 注册表里的 mod 描述。
 * @returns {string} 文本块。
 */
function renderMod(mod) {
  const lines = [`[${mod.id}] ${mod.label ?? ''}`];
  /** @type {string[]} */
  const reasons = [];
  const addReason = (reason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  const snapshotDir = typeof mod.snapshot === 'string' ? mod.snapshot : '';
  if (!isDirectory(snapshotDir)) {
    lines.push(`快照目录：缺失（${snapshotDir === '' ? '未配置' : snapshotDir}）`);
    addReason('快照目录缺失');
  }

  // ① 描述文件：按「段」判定（Steam 的 8000 是每段上限，不是整个文件）。
  const descriptionFile = typeof mod.workshopDescription === 'string' ? mod.workshopDescription : '';
  const description = readDescription(descriptionFile);
  if (!description.exists) {
    lines.push(`工坊描述：无描述文件（${descriptionFile === '' ? '未配置' : descriptionFile}）`);
    addReason('工坊描述文件缺失');
  } else {
    lines.push(`工坊描述：${descriptionFile}`);
    lines.push(`  整文件：${description.bytes} B（信息性，不参与判定）`);

    const segments = splitDescriptionSegments(description.text);
    const oversize = [];
    for (const segment of segments) {
      const bytes = Buffer.byteLength(segment.content, 'utf8');
      const margin = DESCRIPTION_LIMIT - bytes;
      lines.push(
        `  ${segment.label}：${bytes} B / 上限 ${DESCRIPTION_LIMIT} B`
          + `（${margin >= 0 ? `余量 ${margin} B` : `超出 ${-margin} B`}）· ${margin >= 0 ? 'PASS' : 'WARN'}`,
      );
      if (margin < 0) oversize.push(segment.label);
    }
    if (oversize.length > 0) {
      addReason(`工坊描述超限（${oversize.join(' / ')} > ${DESCRIPTION_LIMIT} 字节）`);
    }

    // BBCode 配平只统计真正会被粘贴的段内容：文件顶部的说明文字里出现的 [h1] 等不是标签。
    const body = segments.map((segment) => segment.content).join('\n');
    const unbalanced = [];
    for (const tag of BBCODE_TAGS) {
      const open = countOccurrences(body, `[${tag}]`);
      const close = countOccurrences(body, `[/${tag}]`);
      if (open !== close) unbalanced.push({ tag, open, close });
    }
    if (unbalanced.length === 0) {
      lines.push(`  BBCode 配平：PASS（${BBCODE_TAGS.length} 类标签开闭一致）`);
    } else {
      lines.push(
        `  BBCode 配平：WARN —— ${unbalanced.map((item) => `[${item.tag}] 开 ${item.open} / 闭 ${item.close}`).join('；')}`,
      );
      addReason(`BBCode 标签不配平（${unbalanced.map((item) => item.tag).join('、')}）`);
    }
  }

  // ② 三份 descriptor 对照。
  const descriptors = [
    ['内层', parseDescriptor(snapshotDir === '' ? '' : path.join(snapshotDir, 'descriptor.mod'))],
    ['外层', parseDescriptor(snapshotDir === '' ? '' : `${snapshotDir}.mod`)],
    ['本机', parseDescriptor(typeof mod.deployMod === 'string' ? mod.deployMod : '')],
  ];
  lines.push('descriptor 对照：');
  for (const [label, parsed] of descriptors) {
    if (!parsed.exists) {
      lines.push(`  ${label}：缺失（${parsed.file === '' ? '未配置' : parsed.file}）`);
      continue;
    }
    lines.push(
      `  ${label}：存在（${parsed.file}）· 字段 ${Object.keys(parsed.fields).length} 个 · tags ${parsed.tags.length} 个`,
    );
  }

  const present = descriptors.filter(([, parsed]) => parsed.exists);
  if (present.length < 2) {
    lines.push('  字段对比：可对比的文件不足 2 个，跳过');
  } else {
    const mismatches = [];
    for (const field of COMPARE_FIELDS) {
      const values = present.map(([label, parsed]) => [label, parsed.fields[field] ?? '']);
      const defined = values.filter(([, value]) => value !== '');
      if (defined.length === 0) continue;
      if (new Set(defined.map(([, value]) => value)).size > 1) {
        mismatches.push(
          `${field}：${values.map(([label, value]) => `${label}=${value === '' ? '（空）' : value}`).join(' · ')}`,
        );
      }
    }
    if (mismatches.length === 0) {
      lines.push('  字段对比：remote_file_id / version / supported_version / name 一致');
    } else {
      lines.push(`  字段对比：不一致 ${mismatches.length} 项`);
      for (const mismatch of mismatches) lines.push(`    ${mismatch}`);
      addReason(`descriptor 字段不一致（${mismatches.map((item) => item.split('：')[0]).join(' / ')}）`);
    }
  }

  // 名称长度：Steam 的 mod 名称上限 128 字节（取自 descriptor 的 name，内层优先）。
  const name = present.map(([, parsed]) => parsed.fields.name).find((value) => typeof value === 'string' && value !== '');
  if (name === undefined) {
    lines.push('  名称：读不到（descriptor 里没有 name 字段）');
  } else {
    const nameBytes = Buffer.byteLength(name, 'utf8');
    const overName = nameBytes > NAME_LIMIT;
    lines.push(`  名称：${name} · ${nameBytes} B / 上限 ${NAME_LIMIT} B · ${overName ? 'WARN' : 'PASS'}`);
    if (overName) addReason(`mod 名称超限（${nameBytes} > ${NAME_LIMIT} 字节）`);
  }

  const primary = present.find(([label]) => label === '内层') ?? present[0] ?? null;
  const remoteFileId = primary === null ? '' : String(primary[1].fields.remote_file_id ?? '');
  if (remoteFileId.trim() === '') {
    lines.push(
      '  ⚠ remote_file_id 为空：上传会新建一个工坊条目，且不可撤销。'
      + '如果只是更新已有条目，先补上它的数字 ID；如果确实是首次发布，先让人确认。',
    );
    addReason('remote_file_id 为空（上传会新建工坊条目）');
  } else {
    lines.push(`  remote_file_id：${remoteFileId}`);
  }

  // ③ 缩略图。
  const thumbnailFile = snapshotDir === '' ? '' : path.join(snapshotDir, 'thumbnail.png');
  const thumbnail = readThumbnail(thumbnailFile);
  if (!thumbnail.exists) {
    lines.push(`缩略图：缺失（${thumbnailFile === '' ? '未配置' : thumbnailFile}）`);
    addReason('缩略图缺失');
  } else if (thumbnail.width > 0 && thumbnail.height > 0) {
    lines.push(`缩略图：存在 · ${thumbnail.bytes} B（${formatBytes(thumbnail.bytes)}）· ${thumbnail.width}×${thumbnail.height}`);
  } else {
    lines.push(`缩略图：存在 · ${thumbnail.bytes} B（${formatBytes(thumbnail.bytes)}）· 不是可解析的 PNG，读不到宽高`);
  }

  if (reasons.length === 0) lines.push('', '结论：PASS');
  else lines.push('', `结论：WARN ${reasons.join('；')}`);

  return lines.join('\n');
}

/**
 * 把工坊描述文件切成「上传时分别粘贴的段」。
 *
 * 真实格式有三种（按优先级）：
 * 1. `==================== 第 2 段：修补程序说明 ====================` 分隔行（dejure 风格）；
 * 2. `########## 第 1 段：… ##########` … `########## 第 1 段结束 ##########` 成对标记（free / auto 风格）；
 * 3. 没有标记：整个文件是一段（无标记风格）。
 *
 * 段名取标记里的标题；没有标题就写「第 N 段」。
 * @param {string} rawText - 描述文件全文。
 * @returns {{ label: string, content: string }[]} 段列表（至少一段）。
 */
function splitDescriptionSegments(rawText) {
  const text = String(rawText ?? '').replace(/^\uFEFF/, '');

  const separator = text.match(SEGMENT_SEPARATOR_RE);
  if (separator !== null) {
    const index = separator.index ?? 0;
    const title = separatorTitle(separator[0]);
    return [
      { label: '第 1 段', content: text.slice(0, index).trim() },
      { label: title === '' ? '第 2 段' : `第 2 段（${title}）`, content: text.slice(index + separator[0].length).trim() },
    ];
  }

  /** @type {{ label: string, content: string }[]} */
  const segments = [];
  for (const match of text.matchAll(SEGMENT_MARKER_RE)) {
    const title = cleanSegmentTitle(match[2]);
    segments.push({
      label: title === '' ? `第 ${match[1]} 段` : `第 ${match[1]} 段（${title}）`,
      content: match[3].trim(),
    });
  }
  if (segments.length > 0) return segments;

  return [{ label: '第 1 段', content: text.trim() }];
}

/**
 * 从 `==== 第 2 段：修补程序说明 ====` 分隔行里取标题。
 * @param {string} line - 分隔行原文。
 * @returns {string} 标题；没有则空串。
 */
function separatorTitle(line) {
  return String(line ?? '')
    .replace(/^=+\s*/, '')
    .replace(/\s*=+\s*$/, '')
    .replace(/^第\s*2\s*段\s*[：:]?\s*/, '')
    .trim();
}

/**
 * 从 `########## 第 N 段：标题（从这里开始整段复制）##########` 的开标记后缀里取标题。
 * @param {string} raw - 段号之后、`##########` 之前的原文。
 * @returns {string} 标题（已去掉开头的冒号与「从这里开始整段复制」提示）；没有则空串。
 */
function cleanSegmentTitle(raw) {
  return String(raw ?? '')
    .replace(/^[：:\s]+/, '')
    .replace(/（[^）]*从这里开始整段复制[^）]*）/g, '')
    .trim();
}

/**
 * 统计子串出现次数。
 * @param {string} text - 原文。
 * @param {string} needle - 子串。
 * @returns {number} 次数。
 */
function countOccurrences(text, needle) {
  if (needle === '') return 0;
  return text.split(needle).length - 1;
}

/**
 * 读描述文件（UTF-8）：实际字节数 + 全文（分段用）。
 * @param {string} file - 描述文件路径。
 * @returns {{ exists: boolean, bytes: number, text: string }} 读取结果。
 */
function readDescription(file) {
  if (file === '') return { exists: false, bytes: 0, text: '' };
  try {
    const buffer = fs.readFileSync(file);
    return { exists: true, bytes: buffer.length, text: buffer.toString('utf8') };
  } catch {
    return { exists: false, bytes: 0, text: '' };
  }
}

/**
 * 解析一个 descriptor 文件（缺文件不算错，返回 `exists: false`）。
 * @param {string} file - 绝对路径。
 * @returns {{ file: string, exists: boolean, fields: Record<string, string>, tags: string[] }} 解析结果。
 */
function parseDescriptor(file) {
  if (file === '') return { file: '', exists: false, fields: {}, tags: [] };
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
 * 读 thumbnail.png：存在性、字节数，能解析就把 IHDR 里的宽高拿出来。
 * @param {string} file - 缩略图路径。
 * @returns {{ exists: boolean, bytes: number, width: number, height: number }} 结果。
 */
function readThumbnail(file) {
  if (file === '') return { exists: false, bytes: 0, width: 0, height: 0 };
  let buffer;
  try {
    buffer = fs.readFileSync(file);
  } catch {
    return { exists: false, bytes: 0, width: 0, height: 0 };
  }

  const result = { exists: true, bytes: buffer.length, width: 0, height: 0 };
  if (buffer.length < 24) return result;
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (buffer[index] !== PNG_SIGNATURE[index]) return result;
  }
  if (buffer.toString('latin1', 12, 16) !== 'IHDR') return result;
  result.width = buffer.readUInt32BE(16);
  result.height = buffer.readUInt32BE(20);
  return result;
}

/**
 * 判断路径是不是存在的目录。
 * @param {string} dir - 路径。
 * @returns {boolean} 存在则为 true。
 */
function isDirectory(dir) {
  if (dir === '') return false;
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
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
