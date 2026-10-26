/**
 * 插件入口：注册 8 个 `ck3mod_*` 工具，并在**本预设作用域内**屏蔽无关的全局工具。
 *
 * 注意三件事：
 * 1. **不 import 任何 `@deepseek-ai/*`**。本包是 `link:` 安装的 profile bundle，
 *    代码在 DSH 安装作用域之外，这类 import 会以 `ERR_MODULE_NOT_FOUND` 让预设挂不上。
 * 2. **`apply` 不返回值**。Cordis 会把返回值当 effect 收集，返回数组会让插件激活失败。
 * 3. 所有注册都包在 `ctx.effect` 里，取得 disposer，HMR/卸载时才能干净地回收。
 *
 * @module @local/ck3moddev
 */

import { normalizeConfig } from './config.js';
import { runProcess } from './exec.js';
import { loadRegistry, resolveNodePath } from './registry.js';
import { buildTool } from './tools/build.js';
import { checkTool } from './tools/check.js';
import { deployTool } from './tools/deploy.js';
import { headlessTool } from './tools/headless.js';
import { logsTool } from './tools/logs.js';
import { statusTool } from './tools/status.js';
import { vanillaTool } from './tools/vanilla.js';
import { workshopTool } from './tools/workshop.js';

/** 插件名（日志与 Loader 行里的标识）。 */
export const name = 'ck3moddev';

/** 强依赖：工具注册表。 */
export const inject = ['tools'];

/**
 * 组装工具依赖。
 *
 * `overrides` 是测试接缝：注入 `run` 可以在不启动真实进程的情况下验证参数拼装。
 * @param {ReturnType<typeof normalizeConfig>} config - 生效配置。
 * @param {{ run?: Function, launch?: Function, now?: Function, tempDir?: string }} [overrides] - 测试接缝。
 * @returns {{
 *   config: any, getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: Function, now: () => Date, tempDir?: string, launch?: Function,
 * }} 依赖对象。
 */
export function createDeps(config, overrides = {}) {
  /** @type {{ path: string, source: string } | null} */
  let node = null;
  return {
    config,
    getRegistry: () => loadRegistry(config),
    getNode: () => {
      if (node === null) node = resolveNodePath(config);
      return node;
    },
    run: typeof overrides.run === 'function' ? overrides.run : runProcess,
    now: typeof overrides.now === 'function' ? overrides.now : () => new Date(),
    ...(typeof overrides.tempDir === 'string' ? { tempDir: overrides.tempDir } : {}),
    ...(typeof overrides.launch === 'function' ? { launch: overrides.launch } : {}),
  };
}

/**
 * 造全部工具定义（顺序即工具表顺序，status 在最前）。
 * @param {ReturnType<typeof createDeps>} deps - 依赖。
 * @returns {object[]} 工具定义。
 */
export function createTools(deps) {
  return [
    statusTool(deps),
    checkTool(deps),
    buildTool(deps),
    deployTool(deps),
    headlessTool(deps),
    logsTool(deps),
    vanillaTool(deps),
    workshopTool(deps),
  ];
}

/**
 * 在调用方作用域内屏蔽无关的全局工具。
 *
 * 只 deny **确实存在**的全局工具名（`restrict` 遇到未知名字会抛），所以先读
 * `ctx.tools.schemas()` 再求差集；整段 try/catch，屏蔽失败不影响工具本身。
 *
 * 预设是急切激活的，Host 插件可能还没注册完，所以 2 秒后再补一次
 * （restrictions 取交集，重复调用无害）。
 *
 * @param {{ tools: any, effect?: Function, setTimeout?: Function, logger?: any }} ctx - 插件上下文。
 * @param {ReturnType<typeof normalizeConfig>} config - 生效配置。
 * @returns {{ skip: boolean, deny: () => string[] }} 诊断信息。
 */
export function installGlobalToolMask(ctx, config) {
  const prefixes = config.allowGlobalToolPrefixes;
  const log = (level, message) => {
    try {
      ctx.logger?.[level]?.(`[ck3moddev] ${message}`);
    } catch {
      // 日志失败不影响插件。
    }
  };

  let lastDeny = [];
  if (!Array.isArray(prefixes) || prefixes.length === 0) {
    return { skip: true, deny: () => lastDeny };
  }

  const computeDeny = () => {
    let schemas;
    try {
      schemas = ctx.tools.schemas();
    } catch (error) {
      log('warn', `读取全局工具表失败，跳过屏蔽：${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
    if (!Array.isArray(schemas)) return null;
    const names = schemas
      .map((schema) => String(schema?.name ?? ''))
      .filter((toolName) => toolName !== '' && toolName !== 'run_code');
    return names.filter((toolName) => !prefixes.some((prefix) => toolName.startsWith(prefix)));
  };

  const applyMask = () => {
    const deny = computeDeny();
    if (deny === null || deny.length === 0) return undefined;
    try {
      lastDeny = deny;
      log('info', `在 CK3 会话内隐藏 ${deny.length} 个无关全局工具（保留 ${prefixes.join(' / ')}）。`);
      return ctx.tools.restrict({ deny });
    } catch (error) {
      log('warn', `屏蔽全局工具失败（不影响工具本身）：${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  };

  const effect = typeof ctx.effect === 'function' ? ctx.effect.bind(ctx) : (callback) => callback();
  effect(() => applyMask());
  if (typeof ctx.setTimeout === 'function') {
    ctx.setTimeout(() => applyMask(), 2000);
  }
  return { skip: false, deny: () => lastDeny };
}

/**
 * 装配插件。
 * @param {any} ctx - Cordis 上下文（硬依赖 `tools`）。
 * @param {Record<string, unknown>} config - loader 校验后的配置。
 * @param {{ run?: Function, now?: Function, tempDir?: string }} [overrides] - 测试接缝。
 * @returns {Promise<void>} 无。**不要返回任何值**。
 */
export async function apply(ctx, config, overrides = {}) {
  const effective = normalizeConfig(config);
  const deps = createDeps(effective, overrides);
  const tools = createTools(deps);

  const effect = typeof ctx.effect === 'function' ? ctx.effect.bind(ctx) : (callback) => callback();
  for (const definition of tools) effect(() => ctx.tools.register(definition));

  const mask = installGlobalToolMask(ctx, effective);

  try {
    ctx.logger?.info?.(
      `[ck3moddev] 就绪：${tools.length} 个工具（${tools.map((tool) => tool.name).join(', ')}）；`
      + `mod 注册表 ${effective.toolsDir}；`
      + (mask.skip ? '未配置全局工具白名单，跳过屏蔽。' : `全局工具白名单 ${effective.allowGlobalToolPrefixes.join(' / ')}。`),
    );
  } catch {
    // 日志不可用无所谓。
  }
}
