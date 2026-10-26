/**
 * 无头冒烟的核心逻辑：**先立字据，再改播放集**。
 *
 * 这个文件是整个插件里唯一会改动游戏状态的代码，所以每一步都要能自证：
 * 1. 任何写盘之前，先把 `dlc_load.json` 的原始字节 + SHA256 写进 `pending.json`（含 base64 副本）；
 * 2. 进程退出后（含异常、超时、abort）在 finally 里按字节写回并核对哈希；
 * 3. 万一 DSH 被强杀，下次调用会先读 `pending.json` 把上一条命救回来；
 * 4. 启动前拒绝一切已知的冲突：启动器/游戏在跑、本机副本不存在、node/游戏 exe 缺失。
 *
 * 为什么要这么重：`dlc_load.json` 是用户自己的 playset，被写坏一次就得手动重建。
 *
 * @module @local/ck3moddev/headless
 */

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { killTree } from './exec.js';
import * as gamelog from './gamelog.js';
import { readDlcLoad } from './registry.js';

/** 临时目录：pending 标记、备份副本、以后可能的日志。 */
export const TEMP_DIR = path.join(os.tmpdir(), 'ck3mod-headless');

/** pending 标记文件名。 */
export const PENDING_FILE = path.join(TEMP_DIR, 'pending.json');

/** 无头启动参数（与 curse README 的实测命令一致）。 */
export const GAME_ARGS = [
  '-debug_mode',
  '-nographics',
  '-shutdown_after_history',
  // 只关「启动时自动打开错误日志窗口」，不影响日志写入（game/_commandline_options.info）。
  '-suppress_error_log',
  '-gdpr-compliant',
];

/** debug.log 里「历史开始跑」的标记；到这一步说明加载期已经走完。 */
export const HISTORY_MARKER = 'Start running through history.';

/** 出现就拒绝启动的进程名。 */
export const BLOCKING_PROCESSES = ['ck3.exe', 'dowser.exe'];

/**
 * 计算字节的 SHA256（大写十六进制，与清理记录里的写法一致）。
 * @param {Buffer} bytes - 字节。
 * @returns {string} 十六进制摘要。
 */
export function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

/**
 * 生成 `dlc_load.json` 的测试内容（UTF-8 无 BOM、LF、紧凑 JSON）。
 * @param {string[]} enabledEntries - 形如 `mod/cn_curse.mod`。
 * @returns {Buffer} 要写盘的内容。
 */
export function buildDlcLoadBytes(enabledEntries) {
  return Buffer.from(
    JSON.stringify({ enabled_mods: enabledEntries, disabled_dlcs: [] }),
    'utf8',
  );
}

/**
 * 确保临时目录存在。
 * @param {string} [dir] - 临时目录（测试可注入）。
 * @returns {string} 临时目录。
 */
export function ensureTempDir(dir = TEMP_DIR) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * pending 标记的完整路径。
 * @param {string} [dir] - 临时目录。
 * @returns {string} 路径。
 */
export function pendingFile(dir = TEMP_DIR) {
  return path.join(dir, 'pending.json');
}

/**
 * 读 pending 标记。
 * @param {string} [dir] - 临时目录。
 * @returns {null | {
 *   version: number, mod: string, folder: string, at: string, dlcLoadPath: string,
 *   sha256: string, originalBase64: string, backupPath: string,
 * }} pending 记录；不存在返回 null。
 * @throws {Error} 标记存在但损坏时（宁可报错，也不猜）。
 */
export function readPending(dir = TEMP_DIR) {
  const file = pendingFile(dir);
  if (!fs.existsSync(file)) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `pending 标记损坏：${file}\n`
      + `${error instanceof Error ? error.message : String(error)}\n`
      + '原始 dlc_load.json 的备份可能在同目录的备份文件里；确认后再手动删除该标记。',
    );
  }
  if (
    parsed === null
    || typeof parsed !== 'object'
    || typeof parsed.dlcLoadPath !== 'string'
    || typeof parsed.sha256 !== 'string'
    || typeof parsed.originalBase64 !== 'string'
  ) {
    throw new Error(`pending 标记字段不完整：${file}`);
  }
  return parsed;
}

/**
 * 原子写 pending 标记（先写临时文件再 rename）。
 * @param {Record<string, unknown>} payload - 标记内容。
 * @param {string} [dir] - 临时目录。
 * @returns {void}
 */
export function writePending(payload, dir = TEMP_DIR) {
  ensureTempDir(dir);
  const file = pendingFile(dir);
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

/**
 * 删掉 pending 标记（仅在核对通过后调用）。
 * @param {string} [dir] - 临时目录。
 * @returns {void}
 */
export function clearPending(dir = TEMP_DIR) {
  fs.rmSync(pendingFile(dir), { force: true });
}

/**
 * 把 pending 里的原始字节写回 `dlc_load.json` 并核对 SHA256。
 * @param {NonNullable<ReturnType<typeof readPending>>} pending - 标记。
 * @returns {{ file: string, hash: string, matched: boolean }} 还原结果。
 */
export function restoreFromPending(pending) {
  const bytes = Buffer.from(pending.originalBase64, 'base64');
  const hash = sha256(bytes);
  if (hash !== pending.sha256) {
    throw new Error(
      `pending 里的原始字节自校验失败（记录 ${pending.sha256}，实际 ${hash}）。\n`
      + `未写入 ${pending.dlcLoadPath}；备份：${pending.backupPath}`,
    );
  }
  fs.writeFileSync(pending.dlcLoadPath, bytes);
  const written = fs.readFileSync(pending.dlcLoadPath);
  const matched = sha256(written) === pending.sha256;
  if (!matched) {
    throw new Error(
      `还原 dlc_load.json 后哈希不一致：${pending.dlcLoadPath}\n`
      + `期望 ${pending.sha256}，实际 ${sha256(written)}\n备份：${pending.backupPath}`,
    );
  }
  return { file: pending.dlcLoadPath, hash, matched };
}

/**
 * 处理「上次运行留下的 pending」：先救回来，再返回说明。
 * @param {string} [dir] - 临时目录。
 * @returns {{ restored: boolean, file?: string, hash?: string }} 结果。
 */
export function recoverInterrupted(dir = TEMP_DIR) {
  const pending = readPending(dir);
  if (pending === null) return { restored: false };
  const result = restoreFromPending(pending);
  clearPending(dir);
  return { restored: true, file: result.file, hash: result.hash };
}

/**
 * 查一组进程名里哪些在跑。
 * @param {string[]} names - 进程名（含扩展名）。
 * @param {(spec: object) => Promise<{ code: number, out: string }>} run - 执行器。
 * @returns {Promise<string[]>} 正在运行的进程名。
 */
export async function findProcesses(names, run) {
  const found = [];
  for (const name of names) {
    try {
      const result = await run({
        command: 'tasklist',
        args: ['/FI', `IMAGENAME eq ${name}`, '/FO', 'CSV', '/NH'],
        timeoutMs: 15_000,
      });
      if (result.code !== 0) continue;
      const rows = result.out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith('"'));
      if (rows.length > 0) found.push(name);
    } catch {
      // 查不到就当没在跑：后面启动时游戏自己会报错。
    }
  }
  return found;
}

/**
 * 读文件末尾若干字节（轮询 debug.log 用，避免每 500 ms 读 200 KB）。
 * @param {string} file - 文件路径。
 * @param {number} [bytes] - 最多读多少字节。
 * @returns {string} 尾部文本；读不到返回空串。
 */
export function tailText(file, bytes = 96 * 1024) {
  try {
    const stat = fs.statSync(file);
    if (stat.size === 0) return '';
    const length = Math.min(bytes, stat.size);
    const start = stat.size - length;
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, start);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

/**
 * 启动游戏并看守：到达 history 后给一段宽限，宽限内不退出就杀进程树。
 *
 * 为什么需要看门狗：本机 1.20.x 的无头运行在 `Start running through history.` 处会崩溃
 * （每次运行都生成 `crashes\ck3_*`），进程可能一直不退出。没有看门狗时一次调用要白等到
 * `timeoutSec`；有它之后，加载期一结束就能收工，判定照常基于日志证据。
 *
 * 用 `stdio: 'ignore'` 而不是管道：崩溃处理进程可能继承管道句柄，让 Node 的 `close`
 * 事件永远不触发（实测：进程早已崩溃，180 s 后仍显示「运行中」）。
 *
 * @param {{
 *   config: { gameExe: string, gameRoot: string, logDir: string },
 *   timeoutSec: number,
 *   signal?: AbortSignal,
 *   pollMs?: number,
 *   historyGraceMs?: number,
 * }} spec - 启动参数。
 * @returns {Promise<{
 *   code: number, signal: string|null, timedOut: boolean, stoppedAfterHistory: boolean,
 *   aborted: boolean, durationSec: number, error?: string,
 * }>} 运行结果。
 */
export function launchWithWatchdog(spec) {
  const { config, timeoutSec, signal } = spec;
  const pollMs = Number.isFinite(spec.pollMs) ? Math.max(100, spec.pollMs) : 500;
  const historyGraceMs = Number.isFinite(spec.historyGraceMs) ? Math.max(0, spec.historyGraceMs) : 20_000;
  const debugFile = path.join(config.logDir, 'debug.log');
  const hardTimeoutMs = Math.max(30, timeoutSec) * 1000;

  return new Promise((resolve) => {
    const startedAt = Date.now();
    /** @type {import('node:child_process').ChildProcess | null} */
    let child = null;
    let settled = false;
    let timedOut = false;
    let stoppedAfterHistory = false;
    let aborted = false;
    /** @type {NodeJS.Timeout | null} */
    let graceTimer = null;
    /** @type {NodeJS.Timeout | null} */
    let pollTimer = null;
    /** @type {NodeJS.Timeout | null} */
    let hardTimer = null;
    /** @type {NodeJS.Timeout | null} */
    let forceTimer = null;

    const cleanup = () => {
      if (pollTimer !== null) clearInterval(pollTimer);
      if (graceTimer !== null) clearTimeout(graceTimer);
      if (hardTimer !== null) clearTimeout(hardTimer);
      if (forceTimer !== null) clearTimeout(forceTimer);
      if (signal !== undefined && signal !== null && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const finish = (code, closeSignal, error) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        code: typeof code === 'number' ? code : -1,
        signal: closeSignal ?? null,
        timedOut,
        stoppedAfterHistory,
        aborted,
        durationSec: Math.round((Date.now() - startedAt) / 100) / 10,
        ...(error === undefined ? {} : { error }),
      });
    };

    const onAbort = () => {
      aborted = true;
      killTree(child);
    };

    if (signal !== undefined && signal !== null && signal.aborted === true) {
      resolve({
        code: -1,
        signal: null,
        timedOut: false,
        stoppedAfterHistory: false,
        aborted: true,
        durationSec: 0,
      });
      return;
    }

    try {
      child = spawn(config.gameExe, GAME_ARGS, {
        cwd: config.gameRoot,
        windowsHide: true,
        stdio: 'ignore',
        env: process.env,
      });
    } catch (error) {
      finish(-1, null, error instanceof Error ? error.message : String(error));
      return;
    }

    child.on('error', (error) => finish(-1, null, error instanceof Error ? error.message : String(error)));
    child.on('close', (code, closeSignal) => finish(code, closeSignal));

    if (signal !== undefined && signal !== null && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    hardTimer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, hardTimeoutMs);
    // 杀完之后 close 不一定来（孙进程可能拖着），到点强制结算。
    forceTimer = setTimeout(() => finish(-1, null), hardTimeoutMs + 15_000);

    let seenHistory = false;
    pollTimer = setInterval(() => {
      if (seenHistory) return;
      if (!tailText(debugFile).includes(HISTORY_MARKER)) return;
      seenHistory = true;
      graceTimer = setTimeout(() => {
        if (settled) return;
        stoppedAfterHistory = true;
        killTree(child);
      }, historyGraceMs);
    }, pollMs);
  });
}

/**
 * 读一个日志文件（不存在返回空串）。
 * @param {string} file - 路径。
 * @returns {{ text: string, size: number, mtimeMs: number }} 内容与元数据。
 */
export function readLogFile(file) {
  try {
    const stat = fs.statSync(file);
    return { text: fs.readFileSync(file, 'utf8'), size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return { text: '', size: -1, mtimeMs: 0 };
  }
}

/**
 * 从本轮日志里取证据。
 * @param {{
 *   config: { logDir: string },
 *   mod: { folder: string, enabledEntry: string },
 *   runStartedAt: number,
 * }} spec - 取值参数。
 * @returns {{
 *   errorText: string, debugText: string, errorTotal: number,
 *   modErrorLines: string[], enabled: {name: string, entry: string}[],
 *   mountedHit: string[], crashes: string[], logFresh: boolean,
 *   errorSize: number, debugSize: number,
 * }} 证据。
 */
export function collectEvidence(spec) {
  const { config, mod, runStartedAt } = spec;
  const errorFile = path.join(config.logDir, 'error.log');
  const debugFile = path.join(config.logDir, 'debug.log');
  const errorLog = readLogFile(errorFile);
  const debugLog = readLogFile(debugFile);

  const errors = gamelog.errorEntries(errorLog.text);
  const modErrorLines = gamelog
    .entriesMatching(errors, [mod.folder])
    .map((entry) => entry.raw.trim());
  const enabled = gamelog.enabledMods(debugLog.text);
  const mounted = gamelog.mountedData(debugLog.text);
  const mountedHit = mounted.filter((item) => item.replace(/\\/g, '/').includes(mod.folder));
  const crashes = gamelog.crashLines(gamelog.parseEntries(errorLog.text));
  const logFresh = Math.max(errorLog.mtimeMs, debugLog.mtimeMs) >= runStartedAt - 5_000;
  const isolationClean = enabled.length === 1 && enabled[0].entry === mod.enabledEntry;
  const reachedHistory = debugLog.text.includes(HISTORY_MARKER);

  return {
    errorText: errorLog.text,
    debugText: debugLog.text,
    errorTotal: errors.length,
    modErrorLines,
    enabled,
    mountedHit,
    crashes,
    logFresh,
    isolationClean,
    reachedHistory,
    errorSize: errorLog.size,
    debugSize: debugLog.size,
  };
}

/**
 * 无头冒烟主流程。
 *
 * @param {{
 *   config: any,
 *   mod: any,
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean,
 *     aborted?: boolean, error?: string }>,
 *   now: () => Date,
 *   timeoutSec: number,
 *   baseline?: boolean,
 *   signal?: AbortSignal,
 * }} spec - 执行参数。
 * @returns {Promise<{
 *   text: string, pass: boolean, verdict: 'PASS'|'WARN'|'FAIL',
 *   restored: boolean, modErrors: number,
 * }>} 渲染好的文本与结论。
 */
export async function runHeadless(spec) {
  const { config, mod, run, now, timeoutSec, baseline = false, signal } = spec;
  const launch = typeof spec.launch === 'function' ? spec.launch : launchWithWatchdog;
  const tempDir = typeof spec.tempDir === 'string' && spec.tempDir !== '' ? spec.tempDir : TEMP_DIR;
  const notes = [];

  // 0) 先把上一次的残局收掉。
  const recovery = recoverInterrupted(tempDir);
  if (recovery.restored) notes.push(`已恢复上次中断的运行：${recovery.file}（SHA256 ${recovery.hash}）`);

  // 1) 前置条件：任何一个不满足都不写盘。
  if (config.enableGameLaunch !== true) {
    throw new Error('已禁用启动游戏（enableGameLaunch=false）。把配置改成 true 才会真正跑无头。');
  }
  if (!fs.existsSync(config.gameExe)) {
    throw new Error(`找不到游戏可执行文件：${config.gameExe}\n检查插件配置 gameRoot。`);
  }
  if (!fs.existsSync(mod.deployDir) || !fs.existsSync(mod.deployMod)) {
    throw new Error(
      `本机没有 ${mod.id} 的 mod 副本：\n  目录 ${mod.deployDir}\n  文件 ${mod.deployMod}\n`
      + `先跑 ck3mod_deploy mod=${mod.id}，再跑无头。`,
    );
  }
  const running = await findProcesses(BLOCKING_PROCESSES, run);
  if (running.length > 0) {
    throw new Error(
      `这些进程正在运行：${running.join(' / ')}\n`
      + '无头冒烟会改写 dlc_load.json，必须先关掉游戏与启动器（启动器会把播放集写回去）。',
    );
  }

  const original = readDlcLoad(config);
  const originalHash = original.hash;
  if (original.error !== '') {
    throw new Error(`dlc_load.json 不是合法 JSON：${original.file}\n${original.error}\n先手动修好再跑无头。`);
  }

  ensureTempDir(tempDir);
  const stamp = now().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(tempDir, `dlc_load-${stamp}.json`);
  fs.writeFileSync(backupPath, original.bytes);

  const pending = {
    version: 1,
    mod: mod.id,
    folder: mod.folder,
    at: now().toISOString(),
    dlcLoadPath: original.file,
    sha256: originalHash,
    originalBase64: original.bytes.toString('base64'),
    backupPath,
  };
  writePending(pending, tempDir);

  /** @type {Awaited<ReturnType<typeof run>> | null} */
  let firstRun = null;
  /** @type {Awaited<ReturnType<typeof run>> | null} */
  let baselineRun = null;
  /** @type {ReturnType<typeof collectEvidence>} */
  let firstEvidence;
  /** @type {ReturnType<typeof collectEvidence>} */
  let baselineEvidence;
  let restore = { file: original.file, hash: '', matched: false };
  let restoreError = '';

  try {
    // 2) 只启用本 mod。
    fs.writeFileSync(original.file, buildDlcLoadBytes([mod.enabledEntry]));

    const startedAt = Date.now();
    firstRun = await launch({ config, timeoutSec, signal });
    firstEvidence = collectEvidence({ config, mod, runStartedAt: startedAt });

    // 3) 可选基线：空播放集再跑一轮。
    if (baseline === true) {
      fs.writeFileSync(original.file, buildDlcLoadBytes([]));
      const baselineStartedAt = Date.now();
      baselineRun = await launch({ config, timeoutSec, signal });
      const baselineDuration = (Date.now() - baselineStartedAt) / 1000;
      baselineEvidence = collectEvidence({ config, mod, runStartedAt: baselineStartedAt });
      notes.push(`基线轮：${baselineDuration.toFixed(1)} s / 退出码 ${baselineRun.code}`);
    }

    // 4) 还原（放在 try 内联，确保异常路径也走同一段代码）。
    restore = restoreFromPending(pending);
    clearPending(tempDir);

    // 5) 渲染。
    const text = renderReport({
      mod,
      config,
      original,
      originalHash,
      backupPath,
      firstRun,
      firstEvidence,
      baselineRun,
      baselineEvidence,
      restore,
      notes,
      timeoutSec,
    });
    const verdict = decideVerdict({ firstRun, firstEvidence, restore });
    return { text, pass: verdict === 'PASS', verdict, restored: restore.matched, modErrors: firstEvidence.modErrorLines.length };
  } catch (error) {
    // 兜底：任何异常都要先还原，再把原始错误抛出去。
    if (restore.matched !== true) {
      try {
        restore = restoreFromPending(pending);
        clearPending(tempDir);
      } catch (restoreFailure) {
        restoreError = restoreFailure instanceof Error ? restoreFailure.message : String(restoreFailure);
      }
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${detail}\n\n`
      + (restore.matched
        ? `dlc_load.json 已还原（SHA256 ${restore.hash}）。`
        : `⚠ dlc_load.json 还原失败：${restoreError === '' ? '未知原因' : restoreError}\n`
          + `原始备份：${backupPath}\npending 标记：${pendingFile(tempDir)}`),
    );
  } finally {
    // 正常路径已删；异常路径若还原成功也会删；这里再兜一次，避免「已还原但标记还在」。
    if (restore.matched === true && fs.existsSync(pendingFile(tempDir))) {
      try {
        clearPending(tempDir);
      } catch {
        // 忽略：标记留着的后果只是下次多恢复一次，不影响正确性。
      }
    }
  }
}

/**
 * 渲染无头冒烟报告。
 * @param {Record<string, any>} input - 报告数据。
 * @returns {string} 文本。
 */
export function renderReport(input) {
  const {
    mod, original, originalHash, backupPath, firstRun, firstEvidence,
    baselineRun, baselineEvidence, restore, notes,
  } = input;
  const lines = [];
  lines.push(`无头冒烟 · ${mod.id}（${mod.label}）`);
  lines.push(`播放集：原 ${original.enabled.length} 项 → 测试 1 项（${mod.enabledEntry}）`);
  lines.push(`备份：${backupPath}（SHA256 ${originalHash}）`);
  lines.push(`命令：ck3.exe ${GAME_ARGS.join(' ')}`);
  if (notes.length > 0) for (const note of notes) lines.push(`提示：${note}`);

  if (firstRun !== null) {
    const parts = [];
    if (firstRun.aborted === true) parts.push('被中断（abort）');
    else if (firstRun.timedOut === true) parts.push(`超时（>${input.timeoutSec} s，已杀进程树）`);
    else if (firstRun.stoppedAfterHistory === true) parts.push('到达 history 后未自行退出（看门狗已杀进程树）');
    else parts.push(`退出码 ${firstRun.code}`);
    if (Number.isFinite(firstRun.durationSec)) parts.push(`${firstRun.durationSec} s`);
    lines.push(`运行：${parts.join(' · ')}`);
  }

  lines.push(
    `还原：dlc_load.json ${restore.matched ? `SHA256 一致 ✓（${restore.hash}）` : '失败 ✗'}`,
  );

  if (firstEvidence !== undefined) {
    const ev = firstEvidence;
    lines.push(
      `加载：${ev.reachedHistory ? '已到 Start running through history（加载期走完）' : '未到 history（加载期没走完）'}`
      + ` · error.log ${ev.errorTotal} 条 [E] / 其中本 mod ${ev.modErrorLines.length} 条`
      + ` · debug.log Enabled ${ev.enabled.length} 项 · Mounted 命中 ${ev.mountedHit.length} 条`
      + (ev.logFresh ? '' : ' · ⚠ 日志没有更新'),
    );
    if (ev.enabled.length > 0) {
      lines.push(`Enabled：${ev.enabled.map((item) => item.entry).join(', ')}`);
    }
    if (ev.modErrorLines.length > 0) {
      lines.push('本 mod 报错：');
      for (const line of ev.modErrorLines.slice(0, 10)) lines.push(`  ${line.slice(0, 300)}`);
      if (ev.modErrorLines.length > 10) lines.push(`  … 另有 ${ev.modErrorLines.length - 10} 条`);
    }
    if (ev.crashes.length > 0) {
      lines.push(`崩溃标记：${ev.crashes.slice(0, 3).join(' | ')}`);
      if (ev.crashes.some((line) => line.includes('Instance has not been created!'))) {
        lines.push(
          '  （本机既有记录：无头运行每次到 history 起点都会出现这条并生成 crashes\\ck3_*；'
          + '判定仍以本 mod 报错数为准）',
        );
      }
    }
    const others = ev.enabled.filter((item) => item.entry !== mod.enabledEntry);
    if (others.length > 0) {
      lines.push(`⚠ 隔离不干净：还启用了 ${others.map((item) => item.entry).join(', ')}`);
    } else if (ev.enabled.length === 0) {
      lines.push('⚠ debug.log 里没有 Enabled 清单，无法确认本次只启用了本 mod');
    } else {
      lines.push('隔离：干净（只启用本 mod）');
    }
  }

  if (baselineEvidence !== undefined && firstEvidence !== undefined) {
    const diff = gamelog.diffSignatures(
      gamelog.signatures(baselineEvidence.errorText),
      gamelog.signatures(firstEvidence.errorText),
    );
    lines.push(
      `基线对照：新增 ${diff.added.length} 行 / 消失 ${diff.removed.length} 行`
      + `（基线退出码 ${baselineRun?.code}）`,
    );
    if (diff.added.length > 0) {
      lines.push('基线差异（前 10 行）：');
      for (const line of diff.added.slice(0, 10)) lines.push(`  + ${line.slice(0, 300)}`);
    }
  }

  const verdict = decideVerdict({ firstRun, firstEvidence, restore });
  lines.push(`结论：${verdict}`);
  if (
    verdict !== 'PASS'
    && firstEvidence !== undefined
    && firstEvidence.reachedHistory === true
    && firstEvidence.modErrorLines.length === 0
  ) {
    lines.push(
      '判据：已到 history + 本 mod 报错 0 + 隔离干净 = 「加载期干净」；'
      + '进程退出码与已知的 history 起点崩溃不影响这个结论，仍按 WARN 如实标出。',
    );
  }
  return lines.join('\n');
}

/**
 * 判定结论。
 * @param {{ firstRun: any, firstEvidence: any, restore: { matched: boolean } }} input - 判定输入。
 * @returns {'PASS'|'WARN'|'FAIL'} 结论。
 */
export function decideVerdict(input) {
  const { firstRun, firstEvidence, restore } = input;
  if (restore.matched !== true) return 'FAIL';
  if (firstEvidence === undefined) return 'WARN';
  if (firstEvidence.modErrorLines.length > 0) return 'FAIL';
  // 没到 history 说明加载期没走完：无论是崩溃还是超时，都不能算「加载期干净」。
  if (firstEvidence.reachedHistory !== true) return 'FAIL';
  if (firstEvidence.logFresh !== true) return 'WARN';
  if (firstEvidence.isolationClean !== true) return 'WARN';
  const stopped = firstRun === null || firstRun === undefined
    || firstRun.timedOut === true
    || firstRun.stoppedAfterHistory === true
    || firstRun.aborted === true;
  if (stopped) return 'WARN';
  if (firstRun.code !== 0) return 'WARN';
  if (firstEvidence.crashes.length > 0) return 'WARN';
  return 'PASS';
}
