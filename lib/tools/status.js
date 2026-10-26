/**
 * `ck3mod_status`：只读地把「这台机器上的 CK3 模组开发环境现在是什么样」摊开。
 *
 * 为什么要一个 status：出错时最常见的问题不是脚本写错，而是环境错位——node 指到了
 * Electron、gameRoot 指向不存在的目录、dlc_load.json 里启用的不是本机副本、日志还是
 * 上一轮的。这些事实分散在配置、注册表、日志目录与 git 里，模型先用一个工具一次看全，
 * 比逐个 pwsh 探测省事。
 *
 * 本工具**只读**：唯一的外部命令是 `git status`，用来报分支与 dirty 文件数。
 *
 * @module @local/ck3moddev/tools/status
 */

import fs from 'node:fs';
import path from 'node:path';

import { readDlcLoad, readGameVersion, selectMods } from '../registry.js';
import { TEXT_OUTPUT, alwaysSafe, capOutput, formatBytes } from '../text.js';
import { defineTool } from '../tool-kit.js';

/** 能力表字段 → 中文标签（顺序即展示顺序）。 */
const CAPABILITY_FIELDS = [
  ['generate', '生成'],
  ['normalize', '规范化'],
  ['deploy', '部署'],
  ['reverse', '反向'],
  ['thumbnail', '缩略图'],
];

/** 需要看时间/大小的两个日志文件。 */
const LOG_NAMES = ['error.log', 'debug.log'];

/**
 * 创建 `ck3mod_status` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean,
 *         aborted?: boolean, error?: string }>,
 *   now: () => Date,
 * }} deps - 生效配置与宿主能力。
 * @returns {object} `defineTool` 产物。
 */
export function statusTool(deps) {
  const { config } = deps;
  const now = typeof deps.now === 'function' ? deps.now : () => new Date();

  return defineTool({
    name: 'ck3mod_status',
    description:
      '查看 CK3 模组开发环境与本机四个 mod 的现状（只读）：node 可执行文件与版本、游戏版本、dlc_load.json 的条数与 SHA256、error/debug 日志的时间与大小、mod 注册表，以及每个 mod 的快照目录、本机副本、能力表、git 分支与 dirty 文件数。开工前先跑它，能提前发现环境错位。',
    parameters: {
      mod: {
        type: 'string',
        description: '只看某个 mod 的块（curse / dejure / free / auto）；省略或 all 看全部。',
      },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: alwaysSafe,
    timeoutMs: 60_000,
    async execute(args) {
      const lines = ['CK3 模组开发状态（只读）', ''];

      const environment = await renderEnvironment(deps, config);
      const registry = await renderRegistry(deps, args);

      lines.push(...environment, '', ...registry, '');
      lines.push('建议：先跑 ck3mod_check mod=all 确认四个 mod 全绿；红了按 check 的提示修。');
      return { text: capOutput(lines.join('\n'), config.maxOutputChars, 'status', now) };
    },
  });
}

/**
 * 渲染环境段：node、游戏版本、dlc_load.json、两个日志文件。
 * @param {{
 *   config: any,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean,
 *         aborted?: boolean, error?: string }>,
 * }} deps - 宿主能力。
 * @param {any} config - 生效配置。
 * @returns {Promise<string[]>} 文本行。
 */
async function renderEnvironment(deps, config) {
  const lines = ['【环境】'];

  let node = null;
  try {
    node = await deps.getNode();
  } catch (error) {
    lines.push(`node：未找到（${firstLine(errorMessage(error))}）`);
  }
  if (node !== null && node !== undefined) {
    let version = '';
    try {
      const result = await deps.run({ command: node.path, args: ['--version'], timeoutMs: 5_000 });
      if (result !== null && result !== undefined && result.code === 0 && typeof result.out === 'string') {
        version = firstLine(result.out).trim();
      }
    } catch {
      // `--version` 失败不影响其它事实，按「版本未知」处理。
    }
    const source = typeof node.source === 'string' && node.source !== '' ? node.source : '未知来源';
    lines.push(`node：${node.path}（来源 ${source}）${version === '' ? ' · 版本未知' : ` · ${version}`}`);
  }

  const gameVersion = readGameVersion(config);
  if (gameVersion.version === '') {
    lines.push(`游戏版本：读不到（${config.launcherSettings}）`);
  } else {
    const raw = gameVersion.raw !== '' && gameVersion.raw !== gameVersion.version ? `（rawVersion ${gameVersion.raw}）` : '';
    lines.push(`游戏版本：${gameVersion.version}${raw}`);
  }

  try {
    const dlc = readDlcLoad(config);
    const parseNote = dlc.error === '' ? '' : `（JSON 解析失败：${dlc.error}）`;
    lines.push(
      `dlc_load.json：${dlc.enabled.length} 条启用 mod，${dlc.disabledDlcs.length} 条禁用 DLC · SHA256 ${dlc.hash}${parseNote}`,
    );
  } catch (error) {
    lines.push(`dlc_load.json：FAILED ${firstLine(errorMessage(error))}`);
  }

  for (const name of LOG_NAMES) {
    const stat = statQuietly(path.join(config.logDir, name));
    lines.push(`${name}：${stat === null ? '——' : `${formatBytes(stat.size)} · ${formatTime(stat.mtime)}`}`);
  }

  return lines;
}

/**
 * 渲染 mod 注册表段。注册表加载失败**不抛**：其余环境信息仍然有用。
 * @param {{
 *   getRegistry: () => Promise<any>,
 *   run: (spec: object) => Promise<{ code: number, out: string }>,
 * }} deps - 宿主能力。
 * @param {{ mod?: unknown }} args - 工具参数。
 * @returns {Promise<string[]>} 文本行。
 */
async function renderRegistry(deps, args) {
  const lines = ['【mod 注册表】'];

  let registry;
  try {
    registry = await deps.getRegistry();
  } catch (error) {
    lines.push(`mod 注册表：FAILED ${errorMessage(error)}`);
    lines.push('');
    lines.push('注册表读不到时其它工具也会失败：把插件配置的 toolsDir 指向 D:\\DSH workspace\\ck3-modding-tools。');
    return lines;
  }

  const ids = Array.isArray(registry.ids) ? registry.ids : [...(registry.mods?.keys?.() ?? [])];
  const source = typeof registry.source === 'string' && registry.source !== '' ? registry.source : String(registry.toolsDir ?? '?');
  lines.push(`mod 注册表：${ids.length} 个 mod · ${source}`);

  // 未知 id 属于调用方错误，直接抛出 selectMods 的中文说明（含可用 id）。
  const mods = selectMods(registry, args.mod);
  const blocks = await Promise.all(mods.map((mod) => renderModBlock(deps, mod)));
  for (const block of blocks) lines.push(...block);

  return lines;
}

/**
 * 渲染单个 mod 的块。
 * @param {{ run: (spec: object) => Promise<{ code: number, out: string }> }} deps - 宿主能力。
 * @param {any} mod - 注册表里的 mod 描述。
 * @returns {Promise<string[]>} 文本行。
 */
async function renderModBlock(deps, mod) {
  const lines = [`[${mod.id}] ${mod.label ?? ''}`];

  const snapshot = typeof mod.snapshot === 'string' ? mod.snapshot : '';
  lines.push(`  快照：${isDirectory(snapshot) || isFile(snapshot) ? '存在' : '缺失'} ${snapshot === '' ? '（未配置）' : snapshot}`);
  lines.push(
    `  本机副本：目录 ${isDirectory(mod.deployDir) ? '存在' : '缺失'} · .mod ${isFile(mod.deployMod) ? '存在' : '缺失'}`
      + `（${typeof mod.deployMod === 'string' && mod.deployMod !== '' ? mod.deployMod : '?'}）`,
  );

  const capabilities = CAPABILITY_FIELDS
    .map(([key, label]) => `${label} ${mod.capabilities?.[key] === true ? '✓' : '-'}`)
    .join(' / ');
  lines.push(`  能力：${capabilities}`);

  const git = await readGit(deps, mod.repo);
  lines.push(`  git：${git.ok ? `分支 ${git.branch} · dirty ${git.dirty} 文件` : `unknown（${git.reason}）`}`);

  return lines;
}

/**
 * 跑 `git status --porcelain=v1 --branch`，解析分支名与 dirty 文件数。
 *
 * 解析规则：第一行是 `## <branch>...<upstream>`，其余非空行每行一个改动文件。
 * git 不可用（没装、不是仓库、超时）时返回 `ok: false`，由调用方写 `unknown`。
 * @param {{ run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean,
 *   aborted?: boolean, error?: string }> }} deps - 宿主能力。
 * @param {unknown} repo - mod 仓库目录。
 * @returns {Promise<{ ok: boolean, branch: string, dirty: number, reason: string }>} 结果。
 */
async function readGit(deps, repo) {
  const cwd = typeof repo === 'string' ? repo : '';
  if (cwd === '') return { ok: false, branch: '', dirty: 0, reason: 'mod 没有配置 repo 路径' };

  try {
    const result = await deps.run({
      command: 'git',
      args: ['-C', cwd, 'status', '--porcelain=v1', '--branch'],
      timeoutMs: 8_000,
    });
    if (result !== null && result !== undefined && typeof result.error === 'string' && result.error !== '') {
      return { ok: false, branch: '', dirty: 0, reason: firstLine(result.error) };
    }
    if (result !== null && result !== undefined && result.timedOut === true) {
      return { ok: false, branch: '', dirty: 0, reason: 'git 超时（8 秒）' };
    }
    if (result !== null && result !== undefined && result.aborted === true) {
      return { ok: false, branch: '', dirty: 0, reason: 'git 被中断' };
    }
    if (result === null || result === undefined || result.code !== 0) {
      const exitCode = result === null || result === undefined ? '?' : String(result.code);
      const detail = firstLine(String(result?.out ?? ''));
      return { ok: false, branch: '', dirty: 0, reason: detail === '' ? `git 退出码 ${exitCode}` : detail };
    }

    const rows = String(result.out ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
    const head = rows.length > 0 && rows[0].startsWith('## ') ? rows[0].slice(3) : '';
    if (head === '') return { ok: false, branch: '', dirty: 0, reason: 'git 输出里没有 "## 分支" 行（可能不是 git 仓库）' };

    const branch = head.split('...')[0].trim() === '' ? '?' : head.split('...')[0].trim();
    return { ok: true, branch, dirty: Math.max(0, rows.length - 1), reason: '' };
  } catch (error) {
    return { ok: false, branch: '', dirty: 0, reason: firstLine(errorMessage(error)) };
  }
}

/**
 * 判断路径是不是存在的普通文件。
 * @param {unknown} file - 路径。
 * @returns {boolean} 存在则为 true。
 */
function isFile(file) {
  if (typeof file !== 'string' || file === '') return false;
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * 判断路径是不是存在的目录。
 * @param {unknown} dir - 路径。
 * @returns {boolean} 存在则为 true。
 */
function isDirectory(dir) {
  if (typeof dir !== 'string' || dir === '') return false;
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 静默 stat 一个文件。
 * @param {string} file - 绝对路径。
 * @returns {{ size: number, mtime: Date } | null} 不存在/读不到时为 null。
 */
function statQuietly(file) {
  try {
    const stat = fs.statSync(file);
    return { size: stat.size, mtime: stat.mtime };
  } catch {
    return null;
  }
}

/**
 * 把多个来源的 mtime 统一格式化成 `YYYY-MM-DD HH:mm:ss`（本地时区）。
 * @param {Date} date - 时间。
 * @returns {string} 文本。
 */
function formatTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 取文本第一行（错误消息渲染成单行时用）。
 * @param {unknown} text - 文本或错误对象。
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
