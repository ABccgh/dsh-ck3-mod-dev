/**
 * `ck3mod_build`：按 mod 自己的流水线脚本做「生成 → 规范化」。
 *
 * 只调用 mod 仓库里的 `工具-生成.mjs` / `工具-规范化.mjs`（与五个 mod 手工跑的命令完全一致），
 * `--check` 只读比对、不写盘；写盘动作会重写发布快照，所以用一条提示把风险说清楚。
 *
 * @module @local/ck3moddev/tools/build
 */

import fs from 'node:fs';
import path from 'node:path';

import { defineTool } from '../tool-kit.js';
import { TEXT_OUTPUT, capOutput, tailLines } from '../text.js';
import { selectMods } from '../registry.js';

/** 支持的流水线动作。 */
const ACTIONS = ['generate', 'generate-check', 'normalize', 'normalize-check', 'pipeline'];

/** 流水线脚本的内部超时；工具自身 `timeoutMs` 更大，保证先拿到结果再被工具层杀。 */
const SCRIPT_TIMEOUT_MS = 120_000;

/** 成功步骤贴多少行输出。 */
const STEP_TAIL = 8;

/** 失败步骤贴多少行输出。 */
const FAIL_TAIL = 20;

/** 配置缺失时的输出上限兜底。 */
const FALLBACK_MAX_CHARS = 12_000;

/** 步骤名（渲染用）。 */
const STEP_LABELS = { generate: '生成', normalize: '规范化' };

/** 脚本文件名（报错与渲染用）。 */
const STEP_FILES = { generate: '工具-生成.mjs', normalize: '工具-规范化.mjs' };

/** 流水线顺序：先生成，再规范化。 */
const PIPELINE_ORDER = ['generate', 'normalize'];

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
 * 注册表里 mod 的脚本绝对路径。
 * @param {any} mod - mod 描述。
 * @param {'generate'|'normalize'} kind - 脚本种类。
 * @returns {string} 绝对路径；没有时为空串。
 */
function scriptPath(mod, kind) {
  const value = mod?.scripts?.[kind];
  return typeof value === 'string' && value !== '' ? value : '';
}

/**
 * 判断 mod 是否具备某个脚本能力（能力以注册表的探测结果为准）。
 * @param {any} mod - mod 描述。
 * @param {'generate'|'normalize'} kind - 脚本种类。
 * @returns {boolean} 有脚本且能力未被否认为 true。
 */
function supportsScript(mod, kind) {
  if (mod?.capabilities?.[kind] === false) return false;
  return scriptPath(mod, kind) !== '';
}

/**
 * 列出 mod 仓库里实际存在的 `工具-*.mjs` / `工具-*.py`，用于「可用的是 …」提示。
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
 * 把「可用的是 …」渲染成一句。
 * @param {string[]} available - `listToolScripts` 的结果。
 * @returns {string} 可读文本。
 */
function describeAvailable(available) {
  return available.length > 0 ? available.join('、') : '（仓库里没有 工具-*.mjs / 工具-*.py 脚本）';
}

/**
 * 缺少单个流水线脚本时的报错。
 * @param {any} mod - mod 描述。
 * @param {'generate'|'normalize'} kind - 缺失的脚本种类。
 * @returns {Error} 带绝对路径与可用脚本的错误。
 */
function missingScriptError(mod, kind) {
  const file = STEP_FILES[kind];
  const expected = path.join(String(mod?.repo ?? ''), file);
  return new Error(
    `该 mod 没有 ${file}：${expected}\n`
    + `可用的是：${describeAvailable(listToolScripts(mod?.repo))}\n`
    + `（ck3mod_build 只跑 ${STEP_FILES.generate} / ${STEP_FILES.normalize}；`
    + `检查请用 ck3mod_check mod=${mod?.id ?? '?'}，部署请用 ck3mod_deploy mod=${mod?.id ?? '?'}）`,
  );
}

/**
 * 两个流水线脚本都不存在时的报错。
 * @param {any} mod - mod 描述。
 * @returns {Error} 带绝对路径与可用脚本的错误。
 */
function pipelineMissingError(mod) {
  const id = mod?.id ?? '?';
  return new Error(
    `该 mod 既没有 ${STEP_FILES.generate} 也没有 ${STEP_FILES.normalize}（${id} 的仓库：${mod?.repo ?? '?'}）\n`
    + `可用的是：${describeAvailable(listToolScripts(mod?.repo))}\n`
    + `（${mod?.label ?? id} 没有生成/规范化流水线：改动后直接用 ck3mod_check mod=${id} 验证，`
    + '或按该 mod 仓库 README 的手工流程处理）',
  );
}

/**
 * 从注册表里解析出唯一一个 mod。
 * @param {any} deps - 工具依赖。
 * @param {unknown} value - 原始 `mod` 参数。
 * @param {string} toolName - 工具名（写进错误消息）。
 * @returns {Promise<any>} mod 描述。
 * @throws {Error} 未知 mod、`all` 或空值时。
 */
async function resolveSingleMod(deps, value, toolName) {
  const registry = await deps.getRegistry();
  const mods = selectMods(registry, value);
  const wanted = String(value ?? '').trim();
  if (mods.length !== 1 || wanted === '' || /^all$/i.test(wanted)) {
    const ids = Array.isArray(registry?.ids) && registry.ids.length > 0
      ? registry.ids.join(' / ')
      : '（注册表为空）';
    throw new Error(
      `${toolName} 一次只能处理一个 mod（收到 ${wanted === '' ? '（空）' : wanted}）。\n`
      + `可用：${ids}`,
    );
  }
  return mods[0];
}

/**
 * 构造一步流水线的描述。
 * @param {any} mod - mod 描述。
 * @param {'generate'|'normalize'} kind - 步骤种类。
 * @param {string[]} args - 传给脚本的参数。
 * @param {boolean} supported - 脚本是否存在。
 * @returns {{ kind: string, label: string, file: string, script: string, args: string[],
 *   check: boolean, supported: boolean }} 步骤描述。
 */
function makeStep(mod, kind, args, supported) {
  return {
    kind,
    label: STEP_LABELS[kind],
    file: STEP_FILES[kind],
    script: scriptPath(mod, kind),
    args,
    check: args.includes('--check'),
    supported,
  };
}

/**
 * 按动作规划步骤。
 * @param {any} mod - mod 描述。
 * @param {string} action - 已校验的动作名。
 * @returns {ReturnType<typeof makeStep>[]} 步骤列表（pipeline 含缺失项，便于渲染「跳过」）。
 * @throws {Error} 单动作脚本缺失、或 pipeline 两个脚本都缺失时。
 */
function planSteps(mod, action) {
  if (action === 'pipeline') {
    const steps = PIPELINE_ORDER.map((kind) => makeStep(mod, kind, [], supportsScript(mod, kind)));
    if (!steps.some((step) => step.supported)) throw pipelineMissingError(mod);
    return steps;
  }

  const kind = action.startsWith('generate') ? 'generate' : 'normalize';
  const check = action.endsWith('-check');
  if (!supportsScript(mod, kind)) throw missingScriptError(mod, kind);
  return [makeStep(mod, kind, check ? ['--check'] : [], true)];
}

/**
 * 渲染一步的标题行。
 * @param {any} step - 步骤描述。
 * @param {boolean} pass - 是否通过。
 * @param {number} code - 退出码。
 * @param {any} result - `deps.run` 的结果（用于补超时/错误说明）。
 * @returns {string} 标题行。
 */
function renderStepHead(step, pass, code, result) {
  const suffix = step.check ? ' --check' : '';
  const notes = [];
  if (result?.timedOut === true) notes.push('超时已终止');
  if (typeof result?.error === 'string' && result.error !== '') notes.push(oneLine(result.error));
  const note = notes.length > 0 ? `（${notes.join('；')}）` : '';
  return `${step.label}${suffix}  ${pass ? 'PASS' : 'FAIL'}  退出码 ${code}${note}`;
}

/**
 * 创建 `ck3mod_build` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean, aborted?: boolean, error?: string }>,
 *   now: () => Date,
 * }} deps - 插件依赖（测试里可注入 fake `run`）。
 * @returns {object} `defineTool` 产物。
 */
export function buildTool(deps) {
  return defineTool({
    name: 'ck3mod_build',
    description:
      '按 mod 自己的流水线脚本生成发布快照：pipeline 依次跑 工具-生成.mjs 与 工具-规范化.mjs；'
      + 'generate / normalize 无参数执行会写盘，generate-check / normalize-check 传 --check 只读比对。'
      + '不自动部署、不自动校验。',
    parameters: {
      mod: {
        type: 'string',
        required: true,
        description: 'mod id（可用值来自注册表：dejure / free / auto / mastery）',
      },
      action: {
        type: 'string',
        enum: [...ACTIONS],
        default: 'pipeline',
        description:
          'pipeline=生成+规范化按顺序跑（会写发布快照）；generate / normalize=单步写盘；'
          + 'generate-check / normalize-check=只读比对（不一致时退出码非 0）',
      },
    },
    output: TEXT_OUTPUT,
    timeoutMs: 140_000,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const requestedAction = String(args.action ?? 'pipeline').trim().toLowerCase();
      const action = requestedAction === '' ? 'pipeline' : requestedAction;
      if (!ACTIONS.includes(action)) {
        throw new Error(`未知 action：${action}\n可用：${ACTIONS.join(' / ')}（默认 pipeline）`);
      }

      const mod = await resolveSingleMod(deps, args.mod, 'ck3mod_build');
      const steps = planSteps(mod, action);
      const nodePath = deps.getNode().path;
      const signal = exec?.signal;

      const stepLine = steps
        .map((step) => (step.check ? `${step.file} --check` : `${step.file}（无参数）`))
        .join(' → ');
      const blocks = [];
      /** @type {{ code: number, label: string } | null} */
      let failure = null;
      let blockedBy = null;

      for (const step of steps) {
        if (!step.supported) {
          blocks.push(`${step.label}  跳过（该 mod 没有 ${step.file}）`);
          continue;
        }
        if (blockedBy !== null) {
          blocks.push(`${step.label}${step.check ? ' --check' : ''}  跳过（${blockedBy} 失败，未执行）`);
          continue;
        }

        const result = await deps.run({
          command: nodePath,
          args: [step.script, ...step.args],
          cwd: mod.repo,
          timeoutMs: SCRIPT_TIMEOUT_MS,
          signal,
        });
        if (result?.aborted === true) {
          throw new Error(`构建被取消（工具调用已中止）：${step.script}`);
        }
        const code = Number.isFinite(result?.code) ? Math.trunc(result.code) : -1;
        const pass = result?.timedOut !== true && code === 0;
        const head = renderStepHead(step, pass, code, result);
        const tail = tailLines(result?.out, pass ? STEP_TAIL : FAIL_TAIL);
        const body = tail === ''
          ? '  （无输出）'
          : indentBlock(pass ? tail : `输出尾部（${FAIL_TAIL} 行）：\n${tail}`, '  ');
        blocks.push(`${head}\n${body}`);

        if (!pass) {
          failure = { code, label: `${step.label}${step.check ? ' --check' : ''}` };
          blockedBy = step.label;
        }
      }

      const remaining = steps.filter((step) => step.supported).length;
      const ok = failure === null && remaining > 0;
      const exitCode = failure === null ? 0 : failure.code;
      const writesSnapshot = steps.some((step) => step.supported && !step.check);
      const lines = [
        `构建 · ${mod.id} · action=${action}${writesSnapshot ? '（会写发布快照）' : '（--check 只读比对，不写盘）'}`,
        `  仓库：${mod.repo ?? '（注册表未提供 repo）'}`,
        `  步骤：${stepLine}`,
        '',
        blocks.join('\n\n'),
        '',
        `RESULT: ${ok ? 'PASS' : 'FAIL'}（退出码 ${exitCode}）`,
        `下一步：ck3mod_check mod=${mod.id}`,
      ];
      if (writesSnapshot) {
        lines.push(
          `注意：generate / normalize / pipeline 会重写发布快照（${mod.snapshot ?? '注册表里的 snapshot 目录'}）；`
          + '先提交或 stash 未提交改动，别覆盖正在编辑的文件。',
        );
      } else {
        lines.push('说明：--check 只读比对；磁盘与生成器不一致时退出码非 0，需要写盘请用不带 -check 的动作。');
      }

      const text = lines.join('\n');
      return { text: capOutput(text, maxOutputChars(deps), `build-${mod.id}`, typeof deps.now === 'function' ? deps.now : () => new Date()) };
    },
  });
}
