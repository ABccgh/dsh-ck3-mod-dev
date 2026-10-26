/**
 * 插件配置：默认值 + 归一。
 *
 * 设计原则（与 dsh-ck3-wiki 一致）：**不抛错**。一个写错的字段不应该让整个预设挂不上，
 * 回退到默认值并让工具在真正用到该路径时报出可执行的错误，更符合本插件的定位。
 *
 * @module @local/ck3moddev/config
 */

import os from 'node:os';
import path from 'node:path';

/**
 * 默认配置。**按「任意本机」推导**，不是作者机器的快照：
 * 本机的实际路径由 `cordis.patch.yml` 里的 `ck3mod-tools.config` 显式覆盖。
 *
 * 换到非默认 Steam 库或自定义工作区时，改 patch 即可，不需要动代码。
 */
export const DEFAULTS = {
  workspaceRoot: path.join(os.homedir(), 'DSH workspace'),
  toolsDir: '',
  gameRoot: path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Steam',
    'steamapps',
    'common',
    'Crusader Kings III',
  ),
  userDir: path.join(os.homedir(), 'Documents', 'Paradox Interactive', 'Crusader Kings III'),
  nodePath: '',
  allowGlobalToolPrefixes: ['ck3wiki_', 'steam_'],
  enableGameLaunch: true,
  headlessTimeoutSec: 240,
  maxOutputChars: 12_000,
};

/** 头部白名单前缀的兜底上限，防止一个写错的配置把工具表全放出来。 */
const MAX_PREFIXES = 32;

/**
 * 把 loader 传来的配置收进合法范围，并派生常用路径。
 * @param {Record<string, unknown>} [raw] - loader 校验后的配置。
 * @returns {{
 *   workspaceRoot: string, toolsDir: string, gameRoot: string, userDir: string,
 *   modsDir: string, logDir: string, gameExe: string, launcherSettings: string,
 *   nodePath: string, allowGlobalToolPrefixes: string[], enableGameLaunch: boolean,
 *   headlessTimeoutSec: number, maxOutputChars: number,
 * }} 生效配置（所有路径均为绝对路径）。
 */
export function normalizeConfig(raw = {}) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const text = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim().replace(/^"(.*)"$/, '$1');
    return trimmed === '' ? fallback : trimmed;
  };
  const bool = (value, fallback) => (typeof value === 'boolean' ? value : value === 'true' ? true : value === 'false' ? false : fallback);
  const int = (value, fallback, min, max) => {
    const parsed = typeof value === 'number' ? Math.trunc(value) : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
  };

  const workspaceRoot = text(source.workspaceRoot, DEFAULTS.workspaceRoot);
  const userDir = text(source.userDir, DEFAULTS.userDir);
  const gameRoot = text(source.gameRoot, DEFAULTS.gameRoot);
  const toolsDir = text(source.toolsDir, path.join(workspaceRoot, 'ck3-modding-tools'));

  const prefixes = Array.isArray(source.allowGlobalToolPrefixes)
    ? source.allowGlobalToolPrefixes
      .filter((item) => typeof item === 'string' && item.trim() !== '')
      .map((item) => item.trim())
      .slice(0, MAX_PREFIXES)
    : [...DEFAULTS.allowGlobalToolPrefixes];

  return {
    workspaceRoot,
    toolsDir,
    gameRoot,
    userDir,
    modsDir: path.join(userDir, 'mod'),
    logDir: path.join(userDir, 'logs'),
    gameExe: path.join(gameRoot, 'binaries', 'ck3.exe'),
    launcherSettings: path.join(gameRoot, 'launcher', 'launcher-settings.json'),
    nodePath: text(source.nodePath, ''),
    allowGlobalToolPrefixes: prefixes,
    enableGameLaunch: bool(source.enableGameLaunch, DEFAULTS.enableGameLaunch),
    // 下限 30 s：再短没有意义，游戏光加载就要几十秒。
    headlessTimeoutSec: int(source.headlessTimeoutSec, DEFAULTS.headlessTimeoutSec, 30, 900),
    maxOutputChars: int(source.maxOutputChars, DEFAULTS.maxOutputChars, 2_000, 60_000),
  };
}
