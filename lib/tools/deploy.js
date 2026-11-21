/**
 * `ck3mod_deploy`：调用 mod 仓库自己的 `工具-部署.mjs`，把发布快照部署成本机 mod 副本
 * （或只比对、或清场）。
 *
 * 部署脚本不是同一份代码（dejure 支持 `--clean --allow-launcher-rewrite`，mastery 支持 `--clean`，free 只有 `--check`），
 * 所以「支持哪些开关」以注册表探测出的 `capabilities.flags.deploy` 为准：插件只做参数映射与
 * 校验，绝不复制部署逻辑。
 *
 * @module @local/ck3moddev/tools/deploy
 */

import fs from 'node:fs';
import path from 'node:path';

import { defineTool } from '../tool-kit.js';
import { TEXT_OUTPUT, capOutput, tailLines } from '../text.js';
import { selectMods } from '../registry.js';

/** 支持的部署动作。 */
const ACTIONS = ['deploy', 'check', 'clean'];

/** 部署脚本的内部超时；工具自身 `timeoutMs` 更大，保证先拿到结果再被工具层杀。 */
const SCRIPT_TIMEOUT_MS = 120_000;

/** 输出贴多少行（部署脚本的关键结论在尾部）。 */
const OUTPUT_TAIL = 15;

/** 配置缺失时的输出上限兜底。 */
const FALLBACK_MAX_CHARS = 12_000;

/** 动作 → 基础开关。 */
const ACTION_FLAGS = { deploy: null, check: '--check', clean: '--clean' };

/** 动作的额外参数（prune / allowLauncherRewrite）名称，用于报错时列出。 */
const EXTRA_FLAGS = {
  prune: '--prune',
  allowLauncherRewrite: '--allow-launcher-rewrite',
};

/**
 * 把多行片断压成一行。
 * @param {unknown} value - 原始值。
 * @returns {string} 单行文本。
 */
function oneLine(value) {
  return String(value ?? '').replace(/\r?\n/g, ' / ').trim();
}

/**
 * 给一段文本的每一行加前缀。
 * @param {string} text - 原文。
 * @param {string} prefix - 前缀。
 * @returns {string} 缩进后的文本。
 */
function indentBlock(text, prefix = '  ') {
  return String(text)
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

/**
 * 从配置里取输出上限。
 * @param {any} deps - 工具依赖。
 * @returns {number} 展示上限字符数。
 */
function maxOutputChars(deps) {
  const configured = deps?.config?.maxOutputChars;
  return Number.isFinite(configured) ? configured : FALLBACK_MAX_CHARS;
}

/**
 * 列出 mod 仓库里实际存在的 `工具-*.mjs` / `工具-*.py`。
 * @param {unknown} repo - mod 仓库绝对路径。
 * @returns {string[]} 文件名列表（已排序）。
 */
function listToolScripts(repo) {
  if (typeof repo !== 'string' || repo === '') return [];
  try {
    return fs
      .readdirSync(repo)
      .filter((name) => /^工具-.*\.(?:mjs|py)$/.test(name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * 「可用的是 …」的一句话。
 * @param {string[]} available - `listToolScripts` 的结果。
 * @returns {string} 可读文本。
 */
function describeAvailable(available) {
  return available.length > 0 ? available.join('、') : '（仓库里没有 工具-*.mjs / 工具-*.py 脚本）';
}

/**
 * 从注册表里解析出唯一一个 mod。
 * @param {any} deps - 工具依赖。
 * @param {unknown} value - 原始 `mod` 参数。
 * @returns {Promise<any>} mod 描述。
 * @throws {Error} 未知 mod、`all` 或空值时。
 */
async function resolveSingleMod(deps, value) {
  const registry = await deps.getRegistry();
  const mods = selectMods(registry, value);
  const wanted = String(value ?? '').trim();
  if (mods.length !== 1 || wanted === '' || /^all$/i.test(wanted)) {
    const ids = Array.isArray(registry?.ids) && registry.ids.length > 0
      ? registry.ids.join(' / ')
      : '（注册表为空）';
    throw new Error(
      `ck3mod_deploy 一次只能处理一个 mod（收到 ${wanted === '' ? '（空）' : wanted}）。\n`
      + `可用：${ids}`,
    );
  }
  return mods[0];
}

/**
 * 部署脚本缺失时的报错（消息里说明该 mod 有什么、以及手工流程在哪）。
 * @param {any} mod - mod 描述。
 * @returns {Error} 可执行的错误。
 */
function missingDeployScriptError(mod) {
  const id = mod?.id ?? '?';
  const expected = path.join(String(mod?.repo ?? ''), '工具-部署.mjs');
  const hint = id === 'auto'
    ? '自动传播（auto-spread）没有部署脚本：按它仓库 README 的手工流程部署'
      + '（启动器 → Mods → 上传，或手工把发布快照拷到 Documents 的 mod 目录）。'
    : `本插件只调用 mod 自己的脚本；没有部署脚本时按 ${mod?.label ?? id} 仓库 README 的手工流程部署。`;
  return new Error(
    `该 mod 没有 工具-部署.mjs：${expected}\n`
    + `可用的是：${describeAvailable(listToolScripts(mod?.repo))}\n`
    + `提示：${hint}`,
  );
}

/**
 * 部署脚本报「本地多出文件」时给一行归因：是不是合并副本冒烟留下的 core scripts。
 *
 * 插件不解析校验规则，只看脚本输出里有没有其它 mod 的文件夹名；判断不了就让人逐条修。
 * @param {any} registry - mod 注册表。
 * @param {unknown} out - 脚本输出。
 * @param {string} selfId - 当前 mod id。
 * @returns {string[]} 要追加到报告里的行（空数组表示不追加）。
 */
function describeExtraHint(registry, out, selfId) {
  const text = String(out ?? '');
  if (!text.includes('多出文件')) return [];
  const others = [...(registry?.mods?.values?.() ?? [])].filter((mod) => mod.id !== selfId);
  const hit = others.find((mod) => typeof mod.folder === 'string' && mod.folder !== '' && text.includes(mod.folder));
  const lines = ['  归因：输出里提到「多出文件」——'];
  if (hit !== undefined) {
    lines.push(`  疑似合并副本冒烟遗留（来自 ${hit.id} / ${hit.folder}），不是内容故障。`);
  } else {
    lines.push('  未识别为冒烟遗留（没匹配到其它 mod 的文件夹名），按脚本输出逐条修。');
  }
  lines.push('  处理：先 action=clean 再 deploy（本机 6 个部署脚本都没有 --prune）。');
  return lines;
}

/**
 * 创建 `ck3mod_deploy` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean, aborted?: boolean, error?: string }>,
 *   now: () => Date,
 * }} deps - 插件依赖（测试里可注入 fake `run`）。
 * @returns {object} `defineTool` 产物。
 */
export function deployTool(deps) {
  return defineTool({
    name: 'ck3mod_deploy',
    description:
      '把发布快照部署成本机 mod 副本（deploy）、只比对不写盘（check）、或删除本机副本清场（clean）。'
      + '只调用 mod 自己的 工具-部署.mjs；本机副本与工坊订阅版不要同时启用，测完记得清场。',
    parameters: {
      mod: {
        type: 'string',
        required: true,
        description: 'mod id（可用值来自注册表，当前 6 个条目）',
      },
      action: {
        type: 'string',
        enum: [...ACTIONS],
        default: 'deploy',
        description: 'deploy=写本机副本并逐字节校验；check=只比对不写盘；clean=删除本机副本（清场）',
      },
      prune: {
        type: 'boolean',
        description: '只在部署脚本探测到 --prune 时可用：连本机多出的残留文件一起删（快照里删过文件时用）',
      },
      allowLauncherRewrite: {
        type: 'boolean',
        description: '只在部署脚本探测到 --allow-launcher-rewrite 时可用：外层 .mod 按字段比对（启动器会吃掉尾部空行）',
      },
    },
    output: TEXT_OUTPUT,
    timeoutMs: 140_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const requestedAction = String(args.action ?? 'deploy').trim().toLowerCase();
      const action = requestedAction === '' ? 'deploy' : requestedAction;
      if (!ACTIONS.includes(action)) {
        throw new Error(`未知 action：${action}\n可用：${ACTIONS.join(' / ')}（默认 deploy）`);
      }

      const mod = await resolveSingleMod(deps, args.mod);
      const id = mod.id;
      const deploySupported = mod?.capabilities?.deploy;
      const script = typeof mod?.scripts?.deploy === 'string' ? mod.scripts.deploy : '';
      if (deploySupported === false || script === '') throw missingDeployScriptError(mod);

      /** @type {string[]} */
      const scriptArgs = [];
      const actionFlag = ACTION_FLAGS[action];
      if (actionFlag !== null) scriptArgs.push(actionFlag);
      for (const [key, flag] of Object.entries(EXTRA_FLAGS)) {
        if (args[key] === true) scriptArgs.push(flag);
      }

      const flags = Array.isArray(mod?.capabilities?.flags?.deploy)
        ? mod.capabilities.flags.deploy
        : [];
      for (const flag of scriptArgs) {
        if (!flags.includes(flag)) {
          const pruneHint = flag === '--prune'
            ? `\n提示：本机 6 个部署脚本都没有 --prune；先 action=clean 再 deploy（或手工删掉多出的文件）。`
            : '';
          throw new Error(
            `该 mod 的部署脚本不支持 ${flag}（${id} 支持：${flags.length > 0 ? flags.join(' / ') : '无额外开关'}）\n`
            + `脚本：${script}${pruneHint}`,
          );
        }
      }

      const nodePath = deps.getNode().path;
      const result = await deps.run({
        command: nodePath,
        args: [script, ...scriptArgs],
        cwd: mod.repo,
        timeoutMs: SCRIPT_TIMEOUT_MS,
        signal: exec?.signal,
      });
      if (result?.aborted === true) {
        throw new Error(`部署被取消（工具调用已中止）：${script}`);
      }

      const code = Number.isFinite(result?.code) ? Math.trunc(result.code) : -1;
      const pass = result?.timedOut !== true && code === 0;
      const tail = tailLines(result?.out, OUTPUT_TAIL) || '（无输出）';
      const registry = await deps.getRegistry();
      const extraHint = describeExtraHint(registry, result?.out, id);
      const scope = action === 'clean'
        ? '  清理范围：上面两项（本机副本 + 外层 .mod）'
        : action === 'check'
          ? '  说明：--check 只比对，不写盘'
          : `  说明：写入后本机副本与工坊订阅版内容一致，注意别同时启用`;

      const text = [
        `部署 · ${id} · action=${action}`,
        `  脚本：${script}`,
        `  内层目标：${mod.deployDir ?? '（注册表未提供 deployDir）'}`,
        `  外层 .mod：${mod.deployMod ?? '（注册表未提供 deployMod）'}`,
        `  参数：${scriptArgs.length > 0 ? scriptArgs.join(' ') : '（无）'}`,
        scope,
        `  退出码：${code}${result?.timedOut === true ? '（超时，已终止）' : ''}`,
        '',
        `  输出尾部（${OUTPUT_TAIL} 行）：`,
        indentBlock(tail, '    '),
        '',
        ...(extraHint.length > 0 ? [...extraHint, ''] : []),
        `RESULT: ${pass ? 'PASS' : 'FAIL'}`,
        '安全提示：本机副本与工坊订阅版不要同时启用（会重复定义同一批内容）；'
          + '测完用 action=clean 清场，或去 playset 里关掉本地版。',
      ].join('\n');

      const now = typeof deps.now === 'function' ? deps.now : () => new Date();
      return { text: capOutput(text, maxOutputChars(deps), `deploy-${id}`, now) };
    },
  });
}
