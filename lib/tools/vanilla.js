/**
 * `ck3mod_vanilla`：在 CK3 **原版**游戏文件里逐行检索文本（只读）。
 *
 * 用途：改脚本/本地化时确认「原版到底怎么写」。例如查一个 scripted trigger 的实现、
 * 一个 event 的字段、一条本地化 key 的原文。模型不需要记住原版内容，查一下就行。
 *
 * 范围由 `scope` 决定，避免一次扫描整个游戏目录：
 * - common / events / tests：对应 `game/` 下的脚本目录；
 * - loc：英文本地化与中文本地化（`.yml`）；
 * - docs：整个 `game/` 下的 `*.info`（游戏自带的文档，约 200 个 / 0.8 MB）；
 * - all：common + events + tests + 全部 `*.info`，**不含 localization**（太大）。
 *
 * 安全绳：8 MiB 以上的单文件跳过；总预算 20000 文件 / 120 MiB / 8 秒，触顶时标注「部分结果」。
 * 本工具**只读**，不写、不删任何文件。
 *
 * @module @local/ck3moddev/tools/vanilla
 */

import fs from 'node:fs';
import path from 'node:path';

import { TEXT_OUTPUT, alwaysSafe, capOutput, clampInt, formatBytes, requireText } from '../text.js';
import { defineTool } from '../tool-kit.js';

/** 允许检索的文本扩展名（小写，含点）。 */
const TEXT_EXTS = new Set(['.txt', '.info', '.yml', '.csv', '.json']);

/** `docs` 只检索的文件扩展名。 */
const DOC_EXTS = new Set(['.info']);

/** `scope` → 相对 `game/` 的目录列表；`docs` 与 `all` 单独处理。 */
const SCOPE_DIRS = {
  common: ['common'],
  events: ['events'],
  loc: ['localization/english', 'localization/simp_chinese'],
  tests: ['tests'],
};

/** 允许的 `scope` 取值。 */
const SCOPES = new Set(['common', 'events', 'loc', 'docs', 'tests', 'all']);

/** 单个文件跳过阈值：8 MiB。 */
const MAX_FILE_BYTES = 8 * 1024 * 1024;
/** 总文件数预算。 */
const MAX_FILES = 20_000;
/** 总扫描字节预算：120 MiB。 */
const MAX_BYTES = 120 * 1024 * 1024;
/** 总耗时预算：8 秒。 */
const MAX_MS = 8_000;
/** 每条命中渲染的行文本上限。 */
const HIT_RENDER_CHARS = 200;

/**
 * 创建 `ck3mod_vanilla` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string }>,
 *   now: () => Date,
 * }} deps - 生效配置与宿主能力。
 * @returns {object} `defineTool` 产物。
 */
export function vanillaTool(deps) {
  const { config } = deps;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();

  return defineTool({
    name: 'ck3mod_vanilla',
    description:
      '在 CK3 原版游戏文件里逐行检索文本（只读）：查原版脚本/事件的写法、字段、本地化 key。scope 选范围：common（默认，游戏规则脚本）、events、loc（英/中本地化）、docs（游戏自带 *.info 文档）、tests、all（不含本地化）。返回 game/<相对路径>:<行号>: <行内容>。不改任何文件。',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: '要检索的文本，逐行做子串包含匹配（例如 scripted trigger 名、字段名、loc key）。',
      },
      scope: {
        type: 'string',
        enum: ['common', 'events', 'loc', 'docs', 'tests', 'all'],
        description: '检索范围：common（默认）、events、loc、docs、tests、all（common+events+tests+*.info，不含本地化）。',
      },
      subdir: {
        type: 'string',
        description: '可选，只搜某个子目录（相对游戏安装目录写，如 game/common/decisions；也接受相对 game/ 的写法）。不能是绝对路径、不能含 ".."。',
      },
      limit: {
        type: 'integer',
        description: '最多显示多少条命中，默认 40（范围 1–100）。总数仍会完整统计。',
      },
      caseSensitive: {
        type: 'boolean',
        description: '是否大小写敏感，默认 false（忽略大小写）。',
      },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: alwaysSafe,
    timeoutMs: 25_000,
    async execute(args) {
      const query = requireText(args.query, 'query');
      const scope = requireScope(args.scope);
      const limit = clampInt(args.limit, 40, 1, 100);
      const caseSensitive = args.caseSensitive === true;

      const base = path.join(config.gameRoot, 'game');
      if (!isDirectory(base)) {
        throw new Error(
          `找不到游戏目录：${base}\n`
          + '把插件配置的 gameRoot 指向 CK3 安装目录（它下面应该有 game\\common、game\\events 等目录）。',
        );
      }

      const plan = buildWalkPlan(config, base, scope, args.subdir);
      const started = Date.now();
      const budget = { bytes: 0, partial: '', skippedDirs: 0, skippedLarge: 0 };
      const files = collectFiles(plan, base, budget, started);

      const { total, hits, scanned } = scanFiles(files, base, query, { caseSensitive, limit, started, budget });

      return {
        text: capOutput(
          renderResult({ config, scope, query, plan, budget, files, scanned, total, hits }),
          config.maxOutputChars,
          'vanilla',
          now,
        ),
      };
    },
  });
}

/**
 * 算本次要遍历哪些目录（已经过滤掉不存在的）。
 * @param {any} config - 生效配置。
 * @param {string} base - `<gameRoot>/game`。
 * @param {string} scope - 已校验的 scope。
 * @param {unknown} rawSubdir - `subdir` 参数。
 * @returns {{ tasks: { dir: string, infoOnly: boolean }[], missing: string[], subdirLabel: string }} 遍历计划。
 * @throws {Error} `subdir` 非法或不存在时。
 */
function buildWalkPlan(config, base, scope, rawSubdir) {
  const raw = rawSubdir === undefined || rawSubdir === null ? '' : String(rawSubdir).trim();
  if (raw !== '') {
    const resolved = resolveSubdir(config.gameRoot, base, raw);
    return {
      tasks: [{ dir: resolved, infoOnly: scope === 'docs' }],
      missing: [],
      subdirLabel: raw.replace(/\\/g, '/'),
    };
  }

  /** @type {{ dir: string, infoOnly: boolean }[]} */
  let tasks;
  if (scope === 'docs') {
    tasks = [{ dir: base, infoOnly: true }];
  } else if (scope === 'all') {
    tasks = [
      ...SCOPE_DIRS.common.map((rel) => ({ dir: path.join(base, rel), infoOnly: false })),
      ...SCOPE_DIRS.events.map((rel) => ({ dir: path.join(base, rel), infoOnly: false })),
      ...SCOPE_DIRS.tests.map((rel) => ({ dir: path.join(base, rel), infoOnly: false })),
      // `all` 的 *.info 覆盖整个 game/（不含 localization），与上面三个目录去重后合并。
      { dir: base, infoOnly: true },
    ];
  } else {
    tasks = SCOPE_DIRS[scope].map((rel) => ({ dir: path.join(base, rel), infoOnly: false }));
  }

  const missing = [];
  const existing = [];
  for (const task of tasks) {
    if (isDirectory(task.dir)) existing.push(task);
    else missing.push(path.relative(base, task.dir).replace(/\\/g, '/'));
  }
  return { tasks: existing, missing, subdirLabel: '' };
}

/**
 * 解析 `subdir`：相对 `gameRoot`（也接受相对 `game/` 的写法），并做路径穿越检查。
 * @param {string} gameRoot - 游戏安装目录。
 * @param {string} base - `<gameRoot>/game`。
 * @param {string} raw - 原始 `subdir`。
 * @returns {string} 已存在的绝对目录。
 * @throws {Error} 绝对路径、含 `..`、越出 gameRoot 或不存在时。
 */
function resolveSubdir(gameRoot, base, raw) {
  if (path.isAbsolute(raw) || /^[A-Za-z]:/.test(raw) || /^[\\/]/.test(raw)) {
    throw new Error(`subdir 必须是相对路径，不能是绝对路径：${raw}`);
  }
  const normalized = path.normalize(raw);
  const segments = normalized.split(/[\\/]+/).filter((item) => item !== '' && item !== '.');
  if (segments.includes('..')) {
    throw new Error(`subdir 不能包含 ".."（会跑出游戏目录）：${raw}`);
  }

  const root = path.resolve(gameRoot);
  const candidates = [path.resolve(root, normalized), path.resolve(base, normalized)];
  for (const candidate of candidates) {
    if (!isInside(root, candidate)) continue;
    if (isDirectory(candidate)) return candidate;
  }
  throw new Error(
    `subdir 指向的目录不存在：${candidates[0]}\n`
    + `（相对游戏安装目录写，例如 game/common/decisions 或 common；不确定就先不带 subdir 用 scope。）`,
  );
}

/**
 * 判断 `target` 是否在 `root` 之内（含 root 自身）。
 * @param {string} root - 根目录（绝对路径）。
 * @param {string} target - 目标（绝对路径）。
 * @returns {boolean} 在内部则为 true。
 */
function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * 递归收集要扫描的文件（就地更新预算）。
 * @param {{ tasks: { dir: string, infoOnly: boolean }[] }} plan - 遍历计划。
 * @param {string} base - `<gameRoot>/game`，用于去重与展示。
 * @param {{ bytes: number, partial: string, skippedDirs: number, skippedLarge: number }} budget - 预算。
 * @param {number} started - 开始时间（毫秒）。
 * @returns {string[]} 文件绝对路径（按遍历顺序去重）。
 */
function collectFiles(plan, base, budget, started) {
  /** @type {string[]} */
  const files = [];
  const seen = new Set();

  for (const task of plan.tasks) {
    if (budget.partial !== '') break;
    if (Date.now() - started > MAX_MS) {
      budget.partial = '8 秒';
      break;
    }
    walk(task, files, seen, budget, started);
  }
  return files;
}

/**
 * 单个目录树的深度优先遍历（跳过符号链接，按目录项名排序保证结果稳定）。
 * @param {{ dir: string, infoOnly: boolean }} task - 遍历任务。
 * @param {string[]} files - 输出文件列表。
 * @param {Set<string>} seen - 已收集文件的绝对路径（去重用）。
 * @param {{ bytes: number, partial: string, skippedDirs: number, skippedLarge: number }} budget - 预算。
 * @param {number} started - 开始时间（毫秒）。
 * @returns {void}
 */
function walk(task, files, seen, budget, started) {
  const allowed = task.infoOnly ? DOC_EXTS : TEXT_EXTS;
  const stack = [task.dir];

  while (stack.length > 0) {
    if (budget.partial !== '') return;
    if (Date.now() - started > MAX_MS) {
      budget.partial = '8 秒';
      return;
    }

    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      budget.skippedDirs += 1;
      continue;
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!allowed.has(path.extname(entry.name).toLowerCase())) continue;

      let size;
      try {
        size = fs.statSync(full).size;
      } catch {
        continue;
      }
      if (size > MAX_FILE_BYTES) {
        budget.skippedLarge += 1;
        continue;
      }
      if (seen.has(full)) continue;
      if (files.length >= MAX_FILES) {
        budget.partial = `文件数上限 ${MAX_FILES}`;
        return;
      }
      if (budget.bytes + size > MAX_BYTES) {
        budget.partial = `总大小上限 ${formatBytes(MAX_BYTES)}`;
        return;
      }
      seen.add(full);
      budget.bytes += size;
      files.push(full);
    }
  }
}

/**
 * 逐文件逐行检索。
 * @param {string[]} files - 文件绝对路径。
 * @param {string} base - `<gameRoot>/game`。
 * @param {string} query - 检索词。
 * @param {{ caseSensitive: boolean, limit: number, started: number,
 *   budget: { partial: string } }} options - 选项。
 * @returns {{ total: number, hits: { rel: string, line: number, text: string }[], scanned: number }} 结果。
 */
function scanFiles(files, base, query, options) {
  const { caseSensitive, limit, started, budget } = options;
  const needle = caseSensitive ? query : query.toLowerCase();
  /** @type {{ rel: string, line: number, text: string }[]} */
  const hits = [];
  let total = 0;
  let scanned = 0;

  for (const file of files) {
    if (Date.now() - started > MAX_MS) {
      budget.partial = '8 秒';
      break;
    }
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    scanned += 1;

    const rel = path.relative(base, file).replace(/\\/g, '/');
    const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const haystack = caseSensitive ? row : row.toLowerCase();
      if (!haystack.includes(needle)) continue;
      total += 1;
      if (hits.length < limit) hits.push({ rel, line: index + 1, text: truncate(row.trim(), HIT_RENDER_CHARS) });
    }
  }

  return { total, hits, scanned };
}

/**
 * 渲染最终文本。
 * @param {{
 *   config: any,
 *   scope: string,
 *   query: string,
 *   plan: { subdirLabel: string, missing: string[] },
 *   budget: { bytes: number, partial: string, skippedDirs: number, skippedLarge: number },
 *   files: string[],
 *   scanned: number,
 *   total: number,
 *   hits: { rel: string, line: number, text: string }[],
 * }} input - 渲染素材。
 * @returns {string} 文本。
 */
function renderResult(input) {
  const { scope, query, plan, budget, files, scanned, total, hits } = input;

  const header = [`检索 "${query}"`, `scope=${scope}`];
  if (plan.subdirLabel !== '') header.push(`subdir=${plan.subdirLabel}`);
  header.push(`扫描 ${files.length} 文件 / ${formatBytes(budget.bytes)}`);
  if (budget.partial !== '') header.push(`部分结果（触发预算：${budget.partial}）`);

  const lines = [header.join(' · ')];
  if (plan.missing.length > 0) lines.push(`跳过缺失目录：${plan.missing.join(' / ')}`);
  if (budget.skippedDirs > 0 || budget.skippedLarge > 0) {
    lines.push(`跳过：${budget.skippedDirs} 个读不了的目录 · ${budget.skippedLarge} 个超过 ${formatBytes(MAX_FILE_BYTES)} 的文件`);
  }

  for (const hit of hits) lines.push(`game/${hit.rel}:${hit.line}: ${hit.text}`);

  let summary = `命中 ${total} 行，显示 ${hits.length} 行`;
  if (total > hits.length) summary += `（还有 ${total - hits.length} 行未显示；调大 limit 或收窄 query）`;
  lines.push('', summary);

  if (hits.length > 0) {
    const first = path.join(input.config.gameRoot, 'game', hits[0].rel);
    lines.push(`提示：看上下文用 read 工具打开 ${first}（第 ${hits[0].line} 行附近；read 支持 offset/limit）`);
  } else if (scanned === 0 && budget.partial !== '') {
    lines.push(`提示：因为触发预算（${budget.partial}）一个文件都没扫到——先用 subdir 收窄目录，或换更小的 scope。`);
  } else if (scanned === 0) {
    lines.push('提示：没有扫描到任何文件——检查 gameRoot 配置，或换 scope（docs=游戏自带 *.info 文档；all=不含本地化）。');
  } else {
    lines.push('提示：没命中不是错误。换更短的 query、换 scope（docs=游戏自带 *.info 文档；all=不含本地化），或去掉 subdir。');
  }

  return lines.join('\n');
}

/**
 * 校验 `scope` 参数。
 * @param {unknown} raw - 原始值。
 * @returns {string} 合法 scope（默认 `common`）。
 * @throws {Error} 未知取值时。
 */
function requireScope(raw) {
  if (raw === undefined || raw === null) return 'common';
  const value = String(raw).trim().toLowerCase();
  if (value === '') return 'common';
  if (!SCOPES.has(value)) {
    throw new Error(`未知 scope：${raw}（可用 common / events / loc / docs / tests / all）`);
  }
  return value;
}

/**
 * 判断路径是不是存在的目录。
 * @param {string} dir - 路径。
 * @returns {boolean} 存在则为 true。
 */
function isDirectory(dir) {
  try {
    return fs.statSync(dir).isDirectory();
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
