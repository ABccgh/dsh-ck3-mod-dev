/**
 * mod 注册表：把 `ck3-modding-tools/configs.mjs` 当作**唯一事实来源**，派生出本机路径与
 * 每个 mod 的「能力表」。
 *
 * 为什么不在插件里再抄一份 mod 列表：那个文件已经是四个 mod 的路径/校验器/反向验证表，
 * 抄一份必然漂移。同理，插件**不复制任何校验规则**，只负责调用与汇总。
 *
 * @module @local/ck3moddev/registry
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 注册表缓存时长：改 `configs.mjs` 后最多半分钟就能被工具看到。 */
const REGISTRY_TTL_MS = 30_000;

/** @type {{ at: number, key: string, value: any } | null} */
let cache = null;

/**
 * 判断一个路径是不是存在的普通文件。
 * @param {string} file - 绝对路径。
 * @returns {boolean} 存在则为 true。
 */
export function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * 读文本文件；失败返回空串（调用方自己决定怎么报错）。
 * @param {string} file - 绝对路径。
 * @returns {string} 文本。
 */
export function readTextOrEmpty(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/**
 * 从脚本源码里探测它接受哪些 `--flag`。
 *
 * 在营 4 个的部署/生成器不是同一份代码（dejure 支持 `--clean --allow-launcher-rewrite`，mastery 支持 `--clean`，free 只有 `--check`），
 * 为了不把「支持哪些开关」硬编码进插件，直接读脚本文本里出现过的 `'--xxx'` 字面量。
 * @param {string} scriptPath - 脚本路径。
 * @returns {string[]} 探测到的开关（不带引号，已排序）。
 */
export function detectFlags(scriptPath) {
  const text = readTextOrEmpty(scriptPath);
  /** @type {Set<string>} */
  const found = new Set();
  for (const match of text.matchAll(/'--[a-z][a-z-]*'/g)) found.add(match[0].slice(1, -1));
  return [...found].sort();
}

/**
 * 探测一个 mod 有哪些流水线脚本，以及它们支持哪些开关。
 * @param {Record<string, string>} scripts - 脚本名 → 绝对路径。
 * @returns {Record<string, any>} 能力表。
 */
export function probeCapabilities(scripts) {
  /** @type {Record<string, string[]>} */
  const flags = {};
  for (const key of ['generate', 'normalize', 'deploy']) {
    flags[key] = fileExists(scripts[key]) ? detectFlags(scripts[key]) : [];
  }
  return {
    validator: fileExists(scripts.validator),
    reverse: fileExists(scripts.reverse),
    generate: fileExists(scripts.generate),
    normalize: fileExists(scripts.normalize),
    deploy: fileExists(scripts.deploy),
    thumbnail: fileExists(scripts.thumbnail),
    readiness: fileExists(scripts.readiness),
    checkWrapper: fileExists(scripts.checkWrapper),
    flags,
  };
}

/**
 * 把一个 configs.mjs 条目补全成本插件使用的形状。
 * @param {string} id - 注册表键（dejure / free / auto / mastery）。
 * @param {any} raw - configs.mjs 的原始条目。
 * @param {{ modsDir: string }} config - 生效配置（需要 `modsDir`）。
 * @returns {Record<string, any>} 补全后的 mod 描述。
 */
export function normalizeMod(id, raw, config) {
  const repo = String(raw.repo);
  const snapshot = String(raw.snapshot);
  const folder = path.basename(snapshot);
  const scripts = {
    validator: path.join(repo, '工具-静态校验.mjs'),
    reverse: path.join(repo, '工具-反向验证.mjs'),
    generate: path.join(repo, '工具-生成.mjs'),
    normalize: path.join(repo, '工具-规范化.mjs'),
    deploy: path.join(repo, '工具-部署.mjs'),
    thumbnail: path.join(repo, '工具-缩略图.py'),
    readiness: path.join(repo, '工具-测试就绪.mjs'),
    checkWrapper: path.join(repo, '工具-检查.mjs'),
  };
  return {
    id,
    label: typeof raw.label === 'string' && raw.label !== '' ? raw.label : id,
    repo,
    snapshot,
    folder,
    loc: Array.isArray(raw.loc) ? raw.loc : ['localization'],
    deployDir: path.join(config.modsDir, folder),
    deployMod: path.join(config.modsDir, `${folder}.mod`),
    /** `dlc_load.json` 里的写法，实测格式就是 `mod/<folder>.mod`。 */
    enabledEntry: `mod/${folder}.mod`,
    workshopDescription: path.join(repo, '工坊描述-BBCode.txt'),
    scripts,
    capabilities: probeCapabilities(scripts),
  };
}

/**
 * 加载 mod 注册表（带 30 秒缓存与 mtime 级缓存失效）。
 * @param {{ toolsDir: string, modsDir: string }} config - 生效配置。
 * @param {() => number} [now] - 时间源（测试用）。
 * @returns {Promise<{ toolsDir: string, mods: Map<string, any>, ids: string[],
 *   loadedAt: string, source: string }>} 注册表。
 * @throws {Error} 找不到或加载失败时，错误消息带绝对路径。
 */
export async function loadRegistry(config, now = Date.now) {
  const key = config.toolsDir;
  if (cache !== null && cache.key === key && now() - cache.at < REGISTRY_TTL_MS) return cache.value;

  const file = path.join(key, 'configs.mjs');
  if (!fileExists(file)) {
    throw new Error(
      `找不到 mod 注册表：${file}\n`
      + `（插件配置 toolsDir=${key}；把它指向 D:\\DSH workspace\\ck3-modding-tools）`,
    );
  }

  const stat = fs.statSync(file);
  const url = `${pathToFileURL(file).href}?v=${stat.mtimeMs}`;
  let loaded;
  try {
    loaded = await import(url);
  } catch (error) {
    throw new Error(
      `加载 mod 注册表失败：${file}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const rawMods = loaded?.MODS;
  if (rawMods === null || typeof rawMods !== 'object' || Array.isArray(rawMods)) {
    throw new Error(`mod 注册表没有导出 MODS 对象：${file}`);
  }

  /** @type {Map<string, any>} */
  const mods = new Map();
  for (const [id, raw] of Object.entries(rawMods)) mods.set(id, normalizeMod(id, raw, config));

  const value = {
    toolsDir: key,
    mods,
    ids: [...mods.keys()],
    loadedAt: new Date(now()).toISOString(),
    source: file,
  };
  cache = { at: now(), key, value };
  return value;
}

/**
 * 把 `mod` 参数解析成一组 mod。
 * @param {{ mods: Map<string, any>, ids: string[] }} registry - 注册表。
 * @param {unknown} value - 参数值（省略或 `all` 表示全部）。
 * @returns {any[]} 选中的 mod。
 * @throws {Error} 未知 id 时（消息里列出可用 id）。
 */
export function selectMods(registry, value) {
  const wanted = String(value ?? 'all').trim();
  if (wanted === '' || /^all$/i.test(wanted)) return [...registry.mods.values()];
  const mod = registry.mods.get(wanted);
  if (mod === undefined) {
    throw new Error(`未知 mod：${wanted}\n可用：${registry.ids.join(' / ')}（或 all）`);
  }
  return [mod];
}

/**
 * 解析 mod 的报错 token（用于在日志里按 mod 计数）。
 *
 * 实测 `error.log` 里的报错多半带文件路径，所以内层文件夹名（`cn_scheme_mastery`）是最可靠的 token；
 * 显示名（含中文）只作为补充。
 * @param {any} mod - mod 描述。
 * @returns {string[]} token 列表。
 */
export function modTokens(mod) {
  return [...new Set([mod.folder, mod.label].filter((item) => typeof item === 'string' && item !== ''))];
}

/**
 * 解析 node 可执行文件。
 *
 * Host 跑在 Electron 里，`process.execPath` 是 `DeepSeek Harness.exe`，**不能**拿来跑脚本；
 * 顺序：配置 → `$DSH_HOME/dsh-runtimes/<runtime>/dependencies/node/bin/node{,.exe}` → PATH。
 * @param {{ nodePath: string }} config - 生效配置。
 * @returns {{ path: string, source: string }} 可执行文件路径与来源。
 * @throws {Error} 一个都找不到时。
 */
export function resolveNodePath(config) {
  /** @type {{ path: string, source: string }[]} */
  const candidates = [];
  if (typeof config.nodePath === 'string' && config.nodePath !== '') {
    candidates.push({ path: config.nodePath, source: 'config' });
  }

  const home = process.env.DSH_HOME || path.join(process.env.USERPROFILE || '', '.dsh');
  const runtimesRoot = path.join(home, 'dsh-runtimes');
  try {
    for (const entry of fs.readdirSync(runtimesRoot, { withFileTypes: true })) {
      if (entry.isDirectory() !== true) continue;
      const binDir = path.join(runtimesRoot, entry.name, 'dependencies', 'node', 'bin');
      candidates.push({ path: path.join(binDir, 'node.exe'), source: `runtime:${entry.name}` });
      candidates.push({ path: path.join(binDir, 'node'), source: `runtime:${entry.name}` });
    }
  } catch {
    // 没有 dsh-runtimes（非 Desktop 部署），继续看 PATH。
  }

  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';').filter((ext) => ext !== '')
    : [''];
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) {
    if (dir === '') continue;
    for (const ext of extensions) {
      candidates.push({ path: path.join(dir, `node${ext.toLowerCase()}`), source: 'path' });
    }
  }

  for (const candidate of candidates) {
    if (fileExists(candidate.path)) return candidate;
  }
  throw new Error(
    '找不到 node 可执行文件。\n'
    + `已尝试 ${candidates.length} 个候选（DSH_HOME=${home}）。`
    + '把插件配置的 nodePath 指向一个 node.exe 即可。',
  );
}

/**
 * 读游戏版本（launcher-settings.json 的 rawVersion / version）。
 * @param {{ launcherSettings: string }} config - 生效配置。
 * @returns {{ version: string, raw: string }} 版本信息；读不到时为空串。
 */
export function readGameVersion(config) {
  const text = readTextOrEmpty(config.launcherSettings);
  if (text === '') return { version: '', raw: '' };
  const rawMatch = text.match(/"rawVersion"\s*:\s*"([^"]+)"/);
  const fullMatch = text.match(/"version"\s*:\s*"([^"]+)"/);
  return {
    raw: rawMatch === null ? '' : rawMatch[1],
    version: fullMatch === null ? (rawMatch === null ? '' : rawMatch[1]) : fullMatch[1],
  };
}

/**
 * 读 Steam 的 `appmanifest_1158310.acf`：构建号、Steam 安装时间、状态位。
 *
 * 为什么需要：Paradox 的热修**不一定改版本串**——2026-11-19 的 1.21 hotfix 把 buildid 从
 * `26622941` 换成 `26757580`、替换了 81 个文件，而 `launcher-settings.json`、
 * `titus_branch.txt` 和 exe 里的版本串都还写着 `1.21.0`。判「本机吃没吃热修」只能看
 * buildid 与文件 mtime（见 skill 的 `[hotfix]`）。
 *
 * 只读、不抛：文件缺失 / 不是 Steam 安装 / 字段变了都返回空值 + `error`，由调用方决定怎么显示。
 * @param {{ appManifest: string }} config - 生效配置。
 * @returns {{ buildId: string, updatedAt: Date | null, stateFlags: string, error: string }}
 *   构建信息；读不到时 buildId 为空串。
 */
export function readGameBuild(config) {
  const file = typeof config?.appManifest === 'string' ? config.appManifest : '';
  if (file === '') return { buildId: '', updatedAt: null, stateFlags: '', error: '配置里没有 appManifest 路径' };
  const text = readTextOrEmpty(file);
  if (text === '') return { buildId: '', updatedAt: null, stateFlags: '', error: `读不到 ${file}` };

  const buildId = /"buildid"\s+"(\d+)"/.exec(text)?.[1] ?? '';
  const stateFlags = /"StateFlags"\s+"(\d+)"/.exec(text)?.[1] ?? '';
  const updatedRaw = /"LastUpdated"\s+"(\d+)"/.exec(text)?.[1];
  const seconds = updatedRaw === undefined ? Number.NaN : Number.parseInt(updatedRaw, 10);
  const updatedAt = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : null;
  if (buildId === '') return { buildId: '', updatedAt, stateFlags, error: 'appmanifest 里没有 buildid' };
  return { buildId, updatedAt, stateFlags, error: '' };
}

/**
 * 读 `dlc_load.json`：原始字节、SHA256、已启用条目。
 *
 * 注意：这里**只读**。真正改写它的只有 headless 工具，且必须按字节还原。
 * @param {{ userDir: string }} config - 生效配置。
 * @returns {{ file: string, bytes: Buffer, hash: string, enabled: string[],
 *   disabledDlcs: string[], error: string }} 解析结果。
 * @throws {Error} 文件读不到时。
 */
export function readDlcLoad(config) {
  const file = path.join(config.userDir, 'dlc_load.json');
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    throw new Error(
      `读不到 dlc_load.json：${file}\n${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  let data = null;
  let parseError = '';
  try {
    data = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
  const enabled = Array.isArray(data?.enabled_mods)
    ? data.enabled_mods.filter((item) => typeof item === 'string')
    : [];
  const disabledDlcs = Array.isArray(data?.disabled_dlcs)
    ? data.disabled_dlcs.filter((item) => typeof item === 'string')
    : [];
  return { file, bytes, hash, enabled, disabledDlcs, error: parseError };
}
