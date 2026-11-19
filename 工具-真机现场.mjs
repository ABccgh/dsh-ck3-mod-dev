#!/usr/bin/env node
/**
 * 真机验收现场保护：开游戏前快照，结束后按字节还原。
 *
 * 为什么需要它：2026-11-18 的一次 GUI 验收会话覆盖了用户的
 * `autosave*.ck3`、`last_save.ck3`、`continue_game.json`（14:44:12 三个文件同时被改），
 * 其中两个滚动自动存档不可恢复。CK3 没有「独立用户目录」开关，
 * `pdx_settings.txt` 的 `autosave=YEARLY` / `save_on_exit=yes` 又无法在游戏内可靠关掉，
 * 所以只能**先立字据再开游戏**：复制全部会被覆盖的文件，结束时按字节写回并核对 SHA256。
 *
 * 用法：
 *   $node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
 *   & $node .\工具-真机现场.mjs --begin --mods cn_dejure_conquest,free_resources,auto_spread,cn_scheme_mastery
 *   & $node .\工具-真机现场.mjs --check      # 会话中途体检：哪些文件被改、新增了哪些存档
 *   & $node .\工具-真机现场.mjs --end        # 先杀进程再跑；按字节还原 + 隔离新存档 + 核对哈希
 *   & $node .\工具-真机现场.mjs --clean      # 删除已结束会话的快照（默认保留供审计）
 *
 * 测试用：`--user-dir <假目录> --temp-dir <临时目录>`，不碰真实用户目录。
 *
 * @module dsh-ck3-mod-dev/工具-真机现场
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 快照格式版本；字段变化时加一。 */
const MANIFEST_VERSION = 1;

/** 用户数据目录默认值（Paradox 的固定位置）。 */
const DEFAULT_USER_DIR = path.join(
  os.homedir(),
  'Documents',
  'Paradox Interactive',
  'Crusader Kings III',
);

/** 快照根目录：`%TEMP%\ck3-ingame\<stamp>\`。 */
const DEFAULT_TEMP_ROOT = path.join(os.tmpdir(), 'ck3-ingame');

/** 存档子目录名。 */
const SAVE_DIR = 'save games';

/**
 * 逐个快照的「非存档」文件（相对用户目录）。
 * 顺序无关；不存在的会记为 `existed: false`，结束时把会话期间新建的同名文件删掉。
 */
const SINGLE_FILES = [
  'dlc_load.json',
  'pdx_settings.txt',
  path.join('player', 'game_rules', 'presets.txt'),
  'last_save.ck3',
  'continue_game.json',
];

/** 会改动用户数据的进程；任意一个在跑就拒绝开现场。 */
const BLOCKING_PROCESSES = ['ck3.exe', 'dowser.exe'];

/** @param {Buffer} bytes @returns {string} 大写 SHA256。 */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

/** @returns {string} 本地时间戳 `YYYYMMDD-HHmmss`。 */
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** @param {string} dir @returns {string} 建好的目录。 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 原子写 JSON：先写 `.tmp` 再改名，避免半截文件被当成有效现场。
 * @param {string} file 目标文件。
 * @param {unknown} value 内容。
 */
function writeJsonAtomic(file, value) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * 读 JSON；文件不存在返回 null。
 * @param {string} file 文件。
 * @returns {any|null} 内容。
 */
function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * 路径必须落在 root 内（防止 manifest 被改出目录穿越）。
 * @param {string} root 根。
 * @param {string} rel 相对路径。
 * @returns {string} 绝对路径。
 */
function resolveInside(root, rel) {
  const full = path.resolve(root, rel);
  const base = path.resolve(root) + path.sep;
  if (full !== path.resolve(root) && !full.startsWith(base)) {
    throw new Error(`路径越界：${rel}`);
  }
  return full;
}

/**
 * 游戏或启动器是否在跑。用 tasklist；非 Windows 直接当没跑。
 * 测试口径：`CK3_SCENE_SKIP_PROCESS_CHECK=1` 时跳过（否则测试会依赖「当前没开游戏」）。
 * @returns {string[]} 命中的进程名。
 */
function runningProcesses() {
  if (process.platform !== 'win32') return [];
  if (process.env.CK3_SCENE_SKIP_PROCESS_CHECK === '1') return [];
  const hits = [];
  for (const name of BLOCKING_PROCESSES) {
    try {
      const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/NH'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 10_000,
      });
      if (out.toLowerCase().includes(name.toLowerCase())) hits.push(name);
    } catch {
      // tasklist 失败不影响判断：当成没跑，后续开游戏自会暴露。
    }
  }
  return hits;
}

/**
 * 列出存档目录里的 `*.ck3`（只列文件名）。
 * @param {string} userDir 用户目录。
 * @returns {string[]} 文件名。
 */
function listSaves(userDir) {
  const dir = path.join(userDir, SAVE_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.ck3'))
    .sort();
}

/**
 * 把 `--mods a,b` 解析成 mod 文件夹名并校验存在。
 * @param {string} userDir 用户目录。
 * @param {string} raw 原始参数。
 * @returns {string[]} 文件夹名。
 */
function resolveMods(userDir, raw) {
  const folders = String(raw).split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (folders.length === 0) throw new Error('--mods 为空');
  for (const folder of folders) {
    if (!/^[A-Za-z0-9_-]+$/.test(folder)) {
      throw new Error(`mod 文件夹名不合法：${folder}（只允许字母/数字/_/-）`);
    }
    const modFile = path.join(userDir, 'mod', `${folder}.mod`);
    if (!fs.existsSync(modFile)) {
      throw new Error(
        `缺少本机 mod 副本：${modFile}\n先跑该 mod 的 工具-部署.mjs，再 --begin。`,
      );
    }
  }
  return folders;
}

/**
 * 生成测试播放集内容（与 lib/headless.js 的 buildDlcLoadBytes 完全一致）。
 * @param {string[]} folders mod 文件夹名。
 * @returns {Buffer} UTF-8、无 BOM、紧凑 JSON。
 */
function buildPlayset(folders) {
  return Buffer.from(JSON.stringify({
    enabled_mods: folders.map((folder) => `mod/${folder}.mod`),
    disabled_dlcs: [],
  }), 'utf8');
}

/**
 * 生成现场快照。
 * @param {{ userDir: string, tempRoot: string, mods?: string[] }} options 参数。
 * @returns {{ sessionDir: string, manifest: any }} 现场。
 */
function begin({ userDir, tempRoot, mods }) {
  if (!fs.existsSync(userDir)) throw new Error(`用户目录不存在：${userDir}`);
  const saveDir = path.join(userDir, SAVE_DIR);
  if (!fs.existsSync(saveDir)) throw new Error(`存档目录不存在：${saveDir}`);
  const running = runningProcesses();
  if (running.length > 0) {
    throw new Error(`这些进程在跑，先关掉再 --begin：${running.join(' / ')}`);
  }
  const currentFile = path.join(tempRoot, 'current.json');
  if (fs.existsSync(currentFile)) {
    const current = readJson(currentFile);
    throw new Error(
      `已有未结束的现场：${current?.sessionDir ?? currentFile}\n先 --end（或 --clean 前先 --end）再开新的。`,
    );
  }

  const sessionDir = ensureDir(path.join(tempRoot, stamp()));
  const filesDir = ensureDir(path.join(sessionDir, 'files'));
  /** @type {any[]} */
  const files = [];
  const copyOne = (rel) => {
    const src = resolveInside(userDir, rel);
    const existed = fs.existsSync(src);
    if (!existed) {
      files.push({ rel, existed: false, size: 0, sha256: '' });
      return;
    }
    const bytes = fs.readFileSync(src);
    const dest = resolveInside(filesDir, rel);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, bytes);
    files.push({ rel, existed: true, size: bytes.length, sha256: sha256(bytes) });
  };

  for (const rel of SINGLE_FILES) copyOne(rel);
  const saves = listSaves(userDir);
  for (const name of saves) copyOne(path.join(SAVE_DIR, name));

  /** @type {any} */
  const manifest = {
    version: MANIFEST_VERSION,
    createdAt: new Date().toISOString(),
    userDir,
    sessionDir,
    saves,
    mods: [],
    files,
  };

  if (mods !== undefined && mods.length > 0) {
    const folders = resolveMods(userDir, mods.join(','));
    const playset = buildPlayset(folders);
    fs.writeFileSync(path.join(userDir, 'dlc_load.json'), playset);
    manifest.mods = folders;
    manifest.playsetSha256 = sha256(playset);
  }

  writeJsonAtomic(path.join(sessionDir, 'manifest.json'), manifest);
  writeJsonAtomic(currentFile, { sessionDir, createdAt: manifest.createdAt });
  return { sessionDir, manifest };
}

/**
 * 读当前现场；没有就抛。
 * @param {string} tempRoot 快照根。
 * @returns {{ sessionDir: string, manifest: any }} 现场。
 */
function requireCurrent(tempRoot) {
  const currentFile = path.join(tempRoot, 'current.json');
  const current = readJson(currentFile);
  if (current === null) {
    throw new Error(`没有活动的现场（${currentFile}）。先 --begin。`);
  }
  const manifest = readJson(path.join(current.sessionDir, 'manifest.json'));
  if (manifest === null) throw new Error(`现场残缺，缺 manifest：${current.sessionDir}`);
  return { sessionDir: current.sessionDir, manifest };
}

/**
 * 体检：快照文件是否漂移、有没有新存档。没有活动现场时返回 null。
 * @param {{ userDir: string, tempRoot: string }} options 参数。
 * @returns {{ drifted: any[], missing: any[], changed: any[], newSaves: string[] } | null} 报告。
 */
function check({ userDir, tempRoot }) {
  if (!fs.existsSync(path.join(tempRoot, 'current.json'))) return null;
  const { manifest } = requireCurrent(tempRoot);
  const n = manifest;
  const dir = n.userDir ?? userDir;
  const drifted = [];
  const missing = [];
  const changed = [];
  for (const entry of n.files) {
    const full = resolveInside(dir, entry.rel);
    if (!entry.existed) {
      if (fs.existsSync(full)) missing.push(entry);
      continue;
    }
    if (!fs.existsSync(full)) {
      missing.push(entry);
      continue;
    }
    const now = sha256(fs.readFileSync(full));
    if (now !== entry.sha256) changed.push({ ...entry, now });
  }
  drifted.push(...changed, ...missing);
  const before = new Set(n.saves ?? []);
  const newSaves = listSaves(dir).filter((name) => !before.has(name));
  return { drifted, missing, changed, newSaves };
}

/**
 * 收尾：隔离新存档 → 按字节还原 → 核对哈希。
 * @param {{ userDir: string, tempRoot: string }} options 参数。
 * @returns {{ sessionDir: string, restored: number, quarantined: string[], mismatched: any[] }} 结果。
 */
function end({ userDir, tempRoot }) {
  const running = runningProcesses();
  if (running.length > 0) {
    throw new Error(
      `游戏/启动器还在跑（${running.join(' / ')}），先结束它再 --end。\n`
      + '推荐：Stop-Process -Name ck3 -Force（不要走游戏内「退出游戏」，那会写 autosave_exit/last_save）。',
    );
  }
  const { sessionDir, manifest } = requireCurrent(tempRoot);
  const n = manifest;
  const dir = n.userDir ?? userDir;

  // 1) 会话期间新增的存档：隔离，绝不删除。
  const before = new Set(n.saves ?? []);
  const quarantineDir = ensureDir(path.join(sessionDir, 'new-saves'));
  const quarantined = [];
  for (const name of listSaves(dir)) {
    if (before.has(name)) continue;
    const src = path.join(dir, SAVE_DIR, name);
    const dest = path.join(quarantineDir, name);
    fs.renameSync(src, dest);
    quarantined.push(name);
  }

  // 2) 按字节还原；会话期间新建的（existed: false）删掉。
  let restored = 0;
  const mismatched = [];
  for (const entry of n.files) {
    const dest = resolveInside(dir, entry.rel);
    if (!entry.existed) {
      if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
      continue;
    }
    const snapshot = resolveInside(path.join(sessionDir, 'files'), entry.rel);
    if (!fs.existsSync(snapshot)) {
      mismatched.push({ rel: entry.rel, reason: '快照文件丢失' });
      continue;
    }
    const bytes = fs.readFileSync(snapshot);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, bytes);
    restored += 1;
    if (sha256(bytes) !== entry.sha256) {
      mismatched.push({ rel: entry.rel, reason: '快照哈希与 manifest 不符' });
      continue;
    }
    if (sha256(fs.readFileSync(dest)) !== entry.sha256) {
      mismatched.push({ rel: entry.rel, reason: '写回后哈希不符' });
    }
  }

  if (mismatched.length > 0) {
    throw new Error(
      `还原后校验失败，现场保留未删：${sessionDir}\n`
      + mismatched.map((m) => `  - ${m.rel}：${m.reason}`).join('\n'),
    );
  }
  fs.rmSync(path.join(tempRoot, 'current.json'), { force: true });
  return { sessionDir, restored, quarantined, mismatched };
}

/**
 * 删除快照目录（只允许在没有活动现场时做）。
 * @param {{ tempRoot: string, session?: string }} options 参数。
 * @returns {string[]} 删掉的目录。
 */
function clean({ tempRoot, session }) {
  const currentFile = path.join(tempRoot, 'current.json');
  if (fs.existsSync(currentFile)) {
    throw new Error('还有活动现场；先 --end 再 --clean。');
  }
  if (!fs.existsSync(tempRoot)) return [];
  const targets = session === undefined
    ? fs.readdirSync(tempRoot).map((name) => path.join(tempRoot, name)).filter((p) => fs.statSync(p).isDirectory())
    : [path.resolve(tempRoot, session)];
  const removed = [];
  for (const target of targets) {
    if (!target.startsWith(path.resolve(tempRoot) + path.sep)) {
      throw new Error(`拒绝删除快照根之外的目录：${target}`);
    }
    if (!fs.existsSync(target)) continue;
    fs.rmSync(target, { recursive: true, force: true });
    removed.push(target);
  }
  // 全清时把空根目录也收掉，免得下次 --check 看到空壳。
  if (session === undefined && fs.existsSync(tempRoot) && fs.readdirSync(tempRoot).length === 0) {
    fs.rmdirSync(tempRoot);
  }
  return removed;
}

/**
 * 解析命令行。
 * @param {string[]} argv 参数。
 * @returns {any} 选项。
 */
function parseArgs(argv) {
  const options = {
    command: '',
    mods: undefined,
    userDir: DEFAULT_USER_DIR,
    tempRoot: DEFAULT_TEMP_ROOT,
    session: undefined,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--begin' || arg === '--check' || arg === '--end' || arg === '--clean') {
      options.command = arg.slice(2);
    } else if (arg === '--mods') options.mods = argv[(i += 1)];
    else if (arg === '--user-dir') options.userDir = path.resolve(argv[(i += 1)]);
    else if (arg === '--temp-dir') options.tempRoot = path.resolve(argv[(i += 1)]);
    else if (arg === '--session') options.session = argv[(i += 1)];
    else if (arg === '--help' || arg === '-h') options.command = 'help';
    else throw new Error(`未知参数：${arg}`);
  }
  if (options.command === '') throw new Error('必须给一个子命令：--begin / --check / --end / --clean');
  return options;
}

function printHelp() {
  console.log('用法: node 工具-真机现场.mjs --begin [--mods a,b] | --check | --end | --clean [--session <stamp>]');
  console.log('      [--user-dir <用户目录>] [--temp-dir <快照根>]');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === 'help') {
    printHelp();
    return;
  }
  if (options.command === 'begin') {
    const mods = options.mods === undefined ? [] : options.mods.split(',');
    const { sessionDir, manifest } = begin({
      userDir: options.userDir,
      tempRoot: options.tempRoot,
      mods,
    });
    const snap = manifest.files.filter((f) => f.existed).length;
    console.log(`✓ 现场已建立：${sessionDir}`);
    console.log(`  快照 ${snap} 个文件（含 ${manifest.saves.length} 个存档）· 未存在 ${manifest.files.length - snap} 个`);
    if (manifest.mods.length > 0) {
      console.log(`  播放集已改写：${manifest.mods.map((m) => `mod/${m}.mod`).join(', ')}`);
    }
    console.log('  下一步：启动游戏做验收；结束后先杀进程，再 --end。');
    return;
  }
  if (options.command === 'check') {
    const report = check({ userDir: options.userDir, tempRoot: options.tempRoot });
    if (report === null) {
      console.log('没有活动的现场（未开始或已结束）。');
      return;
    }
    console.log(`漂移 ${report.drifted.length} · 新增存档 ${report.newSaves.length}`);
    for (const item of report.changed) console.log(`  ~ ${item.rel}`);
    for (const item of report.missing) console.log(`  ! ${item.rel}（丢失或会话期间新建）`);
    for (const name of report.newSaves) console.log(`  + ${SAVE_DIR}/${name}`);
    if (report.drifted.length === 0 && report.newSaves.length === 0) {
      console.log('✓ 与快照一致');
      return;
    }
    process.exitCode = 1;
    return;
  }
  if (options.command === 'end') {
    const result = end({ userDir: options.userDir, tempRoot: options.tempRoot });
    console.log(`✓ 已还原 ${result.restored} 个文件（逐字节）· 现场：${result.sessionDir}`);
    if (result.quarantined.length > 0) {
      console.log(`  会话期间新增的存档已隔离（未删除）：${result.quarantined.join(', ')}`);
    }
    console.log('  下一步：确认 --check 干净，然后按需 --clean。');
    return;
  }
  if (options.command === 'clean') {
    const removed = clean({ tempRoot: options.tempRoot, session: options.session });
    console.log(removed.length === 0 ? '没有可清理的现场。' : `✓ 已删除 ${removed.length} 个现场目录`);
    for (const dir of removed) console.log(`  - ${dir}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
