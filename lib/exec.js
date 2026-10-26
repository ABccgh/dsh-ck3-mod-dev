/**
 * 子进程执行：统一超时、abort、进程树杀灭与输出采集。
 *
 * 为什么要自己实现：Host 跑在 Electron 主进程里，`process.execPath` 是
 * `DeepSeek Harness.exe` 而不是 node.exe，所以**执行 mod 脚本必须显式给 node 路径**
 * （见 registry.js 的 resolveNodePath）。另外 `spawnSync` 会卡住整个 Host，
 * 长任务（校验器、无头）只能走异步 spawn + 轮询。
 *
 * @module @local/ck3moddev/exec
 */

import { spawn } from 'node:child_process';

/** 单流最多收集多少字节，防止一个刷屏的校验器把内存吃光。 */
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
/** 超时后等进程收尾的额外时间；过了就强行结算，避免工具永远挂着。 */
const KILL_GRACE_MS = 5_000;

/**
 * 杀掉整个进程树。
 * Windows 上 `child.kill()` 只杀直接子进程，`ck3.exe` / 校验器可能留下孙进程，
 * 所以统一用 `taskkill /T /F`；其它平台退回 `SIGKILL`。
 * @param {import('node:child_process').ChildProcess | null} child - 子进程。
 * @returns {void}
 */
export function killTree(child) {
  if (child === null || child === undefined) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32' && typeof child.pid === 'number') {
    try {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    } catch {
      // taskkill 不存在也无所谓，下面还有 child.kill。
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    // 已经退出。
  }
}

/**
 * 跑一个进程并把 stdout/stderr 合并成一段文本。
 * @param {{
 *   command: string, args?: string[], cwd?: string, timeoutMs?: number,
 *   signal?: AbortSignal, env?: Record<string, string|undefined>, maxBytes?: number,
 *   windowsHide?: boolean,
 * }} spec - 执行规格。
 * @returns {Promise<{
 *   code: number, signal: string|null, out: string, timedOut: boolean,
 *   aborted: boolean, truncated: boolean, error?: string,
 * }>} 执行结果：`code` 为 -1 表示没有拿到正常退出码。
 */
export function runProcess(spec) {
  const {
    command,
    args = [],
    cwd,
    timeoutMs = 60_000,
    signal,
    env,
    maxBytes = MAX_CAPTURE_BYTES,
    windowsHide = true,
  } = spec ?? {};

  return new Promise((resolve) => {
    /** @type {import('node:child_process').ChildProcess | null} */
    let child = null;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let truncated = false;
    let settled = false;
    /** @type {NodeJS.Timeout | null} */
    let timer = null;
    /** @type {NodeJS.Timeout | null} */
    let graceTimer = null;

    const cleanup = () => {
      if (timer !== null) clearTimeout(timer);
      if (graceTimer !== null) clearTimeout(graceTimer);
      if (signal !== undefined && signal !== null && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        code: typeof result.code === 'number' ? result.code : -1,
        signal: result.signal ?? null,
        out: `${stdout}${stderr}`,
        timedOut: result.timedOut === true,
        aborted: result.aborted === true,
        truncated,
        ...(result.error === undefined ? {} : { error: result.error }),
      });
    };

    const onAbort = () => {
      aborted = true;
      killTree(child);
    };

    if (signal !== undefined && signal !== null && signal.aborted === true) {
      resolve({ code: -1, signal: null, out: '', timedOut: false, aborted: true, truncated: false });
      return;
    }

    try {
      child = spawn(command, args, {
        cwd,
        env: env === undefined ? process.env : { ...process.env, ...env },
        windowsHide,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      resolve({
        code: -1,
        signal: null,
        out: '',
        timedOut: false,
        aborted: false,
        truncated: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const append = (bucket, chunk) => {
      if (bucket === 'out') {
        if (stdout.length >= maxBytes) {
          truncated = true;
          return;
        }
        stdout += chunk;
      } else {
        if (stderr.length >= maxBytes) {
          truncated = true;
          return;
        }
        stderr += chunk;
      }
      if (stdout.length + stderr.length > maxBytes) truncated = true;
    };

    child.stdout?.on('data', (chunk) => append('out', chunk.toString('utf8')));
    child.stderr?.on('data', (chunk) => append('err', chunk.toString('utf8')));
    child.on('error', (error) => {
      finish({ code: -1, error: error instanceof Error ? error.message : String(error) });
    });
    child.on('close', (code, closeSignal) => {
      finish({ code: typeof code === 'number' ? code : -1, signal: closeSignal });
    });

    if (signal !== undefined && signal !== null && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        killTree(child);
        graceTimer = setTimeout(() => {
          finish({ code: -1, timedOut: true });
        }, KILL_GRACE_MS);
      }, timeoutMs);
      timer.unref?.();
      graceTimer?.unref?.();
    }
  });
}

/**
 * 用指定 node 可执行文件跑一个 `.mjs` 脚本。
 * @param {{ nodePath: string, script: string, args?: string[], cwd?: string,
 *   timeoutMs?: number, signal?: AbortSignal, env?: Record<string, string|undefined> }} spec
 *   执行规格。
 * @returns {ReturnType<typeof runProcess>} 执行结果。
 */
export function runNode(spec) {
  const { nodePath, script, args = [], cwd, timeoutMs, signal, env } = spec ?? {};
  return runProcess({ command: nodePath, args: [script, ...args], cwd, timeoutMs, signal, env });
}

/**
 * 跑一个短命令并取输出（用于 `tasklist`、`git` 这类几秒内返回的查询）。
 * @param {string} command - 可执行文件。
 * @param {string[]} args - 参数。
 * @param {{ cwd?: string, timeoutMs?: number, signal?: AbortSignal }} [options] - 选项。
 * @returns {Promise<{ code: number, out: string, error?: string }>} 结果。
 */
export async function capture(command, args = [], options = {}) {
  const result = await runProcess({
    command,
    args,
    cwd: options.cwd,
    timeoutMs: options.timeoutMs ?? 15_000,
    signal: options.signal,
  });
  return {
    code: result.code,
    out: result.out,
    ...(result.error === undefined ? {} : { error: result.error }),
  };
}

export { MAX_CAPTURE_BYTES };
