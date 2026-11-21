/**
 * `ck3mod_check`：调用共享工具目录里的 `cli.mjs`，汇总 loc 检查、静态校验、
 * 反向验证与共享 loc 规则自检。
 *
 * 为什么这里不实现任何校验规则：loc 的 BOM / `$` / `[]` / 跨语言一致性判定在
 * `ck3-modding-tools/lib/loc.mjs`，各 mod 的静态校验器在各自仓库里。插件再抄一份必然漂移，
 * 所以本模块只负责三件事：拼命令行、解析 `--json`、把结果压成模型能读的几行。
 *
 * @module @local/ck3moddev/tools/check
 */

import path from 'node:path';

import { defineTool } from '../tool-kit.js';
import { lintModScripts } from '../lint.js';
import { TEXT_OUTPUT, alwaysSafe, capOutput, tailLines } from '../text.js';
import { fileExists, selectMods } from '../registry.js';

/** 支持的子任务（与 `cli.mjs` 的 `KNOWN_COMMANDS` 对齐）。 */
const TASKS = ['check', 'loc', 'reverse', 'selftest'];

/** 共享脚本的内部超时；工具自身的 `timeoutMs` 更大，保证先拿到结果再被工具层杀。 */
const SCRIPT_TIMEOUT_MS = 180_000;

/** loc 错误最多渲染几条：失败时模型只需要知道「哪里红了」。 */
const MAX_LOC_ERRORS = 8;

/** validator 失败时贴多少行输出。 */
const VALIDATOR_TAIL = 12;

/** JSON 解析失败时贴多少行输出。 */
const PARSE_ERROR_TAIL = 20;

/** 配置缺失时的输出上限兜底。 */
const FALLBACK_MAX_CHARS = 12_000;

/**
 * 把多行片断压成一行（`found` / validator 的尾行经常自带换行）。
 * @param {unknown} value - 原始值。
 * @returns {string} 单行文本。
 */
function oneLine(value) {
  return String(value ?? '').replace(/\r?\n/g, ' / ').trim();
}

/**
 * 安全取数组长度。
 * @param {unknown} value - 原始值。
 * @returns {number} 长度；不是数组时为 0。
 */
function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * 安全取整数（报告里的计数也可能是缺省）。
 * @param {unknown} value - 原始值。
 * @returns {number|string} 整数或 `?`。
 */
function numberOrQuestion(value) {
  return Number.isFinite(value) ? Number(value) : '?';
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
 * 从右往左找第一个属于给定字符集的字符。
 * @param {string} text - 文本。
 * @param {string} chars - 字符集（如 `']}'`）。
 * @returns {number} 下标；找不到为 -1。
 */
function lastIndexInSet(text, chars) {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (chars.includes(text[index])) return index;
  }
  return -1;
}

/**
 * 尝试解析 JSON。
 * @param {string} text - 候选文本。
 * @returns {{ ok: boolean, value?: unknown }} 解析结果。
 */
function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * 稳地解析 `cli.mjs --json` 的输出。
 *
 * 为什么需要兜底：CLI 的 JSON 是 `console.log(JSON.stringify(...))`，但脚本在打印之前
 * 可能有别的东西进 stdout/stderr（版本提示、Node 的 ExperimentalWarning 等），
 * 而 `--json` 一旦没生效就是纯人读文本。所以先按整段解析，失败再切「第一个 `[`/`{`
 * 到最后一个 `]`/`}`」，都不行才报错并附输出尾部。
 * @param {string} out - 子进程输出（stdout + stderr）。
 * @param {string} cliPath - `cli.mjs` 的绝对路径（写进错误消息）。
 * @returns {unknown} 解析出的 JSON 值。
 * @throws {Error} 两种解析都失败时。
 */
function parseJsonText(out, cliPath) {
  const text = String(out ?? '');
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct.ok) return direct.value;

  const start = trimmed.search(/[[{]/);
  const end = lastIndexInSet(trimmed, ']}');
  if (start >= 0 && end > start) {
    const sliced = tryParseJson(trimmed.slice(start, end + 1));
    if (sliced.ok) return sliced.value;
  }

  const tail = tailLines(text, PARSE_ERROR_TAIL);
  throw new Error(
    `无法解析 cli.mjs 的 JSON 输出：${cliPath}\n`
    + '（脚本可能在打印 JSON 之前就报错了；先手工跑一次 `node cli.mjs <task> --json` 看看到底输出了什么）\n'
    + `输出尾部 ${PARSE_ERROR_TAIL} 行：\n${tail === '' ? '（无输出）' : tail}`,
  );
}

/**
 * 把 JSON 报告统一成数组：`--all` 时是数组，单 mod 时是对象。
 * @param {unknown} parsed - 解析结果。
 * @param {string} cliPath - `cli.mjs` 的绝对路径（写进错误消息）。
 * @returns {any[]} mod 报告数组。
 * @throws {Error} 结构无法识别时。
 */
function asReportArray(parsed, cliPath) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed !== null && typeof parsed === 'object' && typeof parsed.mod === 'string') return [parsed];
  throw new Error(
    `cli.mjs 返回了无法识别的 JSON 结构（既不是 mod 数组，也不是带 mod 字段的对象）：${cliPath}\n`
    + `收到：${oneLine(JSON.stringify(parsed)).slice(0, 200)}`,
  );
}

/**
 * 把 loc 错误里的绝对路径相对化到发布快照。
 * @param {any} mod - mod 描述（用 `snapshot`）。
 * @param {unknown} file - 报错文件路径。
 * @returns {string} 相对路径（统一成 `/`）。
 */
function relativize(mod, file) {
  const raw = typeof file === 'string' ? file : '';
  if (raw === '') return '(未知文件)';
  const snapshot = typeof mod?.snapshot === 'string' ? mod.snapshot : '';
  if (snapshot === '') return raw.replace(/\\/g, '/');
  const rel = path.relative(snapshot, raw);
  return (rel === '' ? raw : rel).replace(/\\/g, '/');
}

/**
 * 渲染一条 loc 错误。
 * @param {any} mod - mod 描述。
 * @param {any} error - `{file,line,key,kind}`。
 * @returns {string} 渲染行。
 */
function renderLocError(mod, error) {
  return `    ${relativize(mod, error?.file)}:${error?.line ?? '?'}  ${error?.key ?? '(file)'}  ${error?.kind ?? '?'}`;
}

/**
 * 判断 mod 选择是不是「全选」。
 * @param {unknown} value - 原始 `mod` 参数。
 * @returns {boolean} 全选则为 true。
 */
function isAllSelection(value) {
  const text = String(value ?? '').trim();
  return text === '' || /^all$/i.test(text);
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
 * 取子进程退出码。
 * @param {any} result - `deps.run` 的结果。
 * @returns {number} 退出码；拿不到时为 -1。
 */
function readCode(result) {
  return Number.isFinite(result?.code) ? Math.trunc(result.code) : -1;
}

/**
 * 中断类结果直接抛错：超时/取消时没有可信结论，不应该渲染成 PASS/FAIL。
 * @param {any} result - `deps.run` 的结果。
 * @param {string} label - 动作名（写进错误消息）。
 * @param {string} cliPath - `cli.mjs` 的绝对路径（写进错误消息）。
 * @returns {void}
 * @throws {Error} 被取消或超时时。
 */
function throwIfInterrupted(result, label, cliPath) {
  if (result?.aborted === true) {
    throw new Error(`${label}被取消（工具调用已中止），没有产生结论。\n脚本：${cliPath}`);
  }
  if (result?.timedOut === true) {
    const tail = tailLines(result?.out, 10);
    throw new Error(
      `${label}超时（${SCRIPT_TIMEOUT_MS / 1000} 秒）已终止：${cliPath}\n`
      + `输出尾部 10 行：\n${tail === '' ? '（无输出）' : tail}`,
    );
  }
}

/**
 * 渲染一个 mod 的 check/loc 结果。
 * @param {any} report - CLI 的 JSON 报告。
 * @param {any} mod - 注册表里的 mod 描述（用于相对化路径）。
 * @returns {string} 渲染块。
 */
function renderCheckBlock(report, mod) {
  const loc = report?.loc !== null && typeof report?.loc === 'object' ? report.loc : null;
  const validator = report?.validator !== null && typeof report?.validator === 'object' ? report.validator : null;
  const headline = [`${report?.mod ?? mod?.id ?? '?'}  ${report?.pass === true ? 'PASS' : 'FAIL'}`];

  if (loc !== null) {
    headline.push(
      `loc ${numberOrQuestion(loc.entries)} 条 / `
      + `${countOf(loc.errors)} errors / ${countOf(loc.warnings)} warnings`,
    );
  }
  if (validator !== null) {
    const status = validator.status === 'skip' ? 'SKIP' : (validator.pass === true ? 'PASS' : 'FAIL');
    const note = typeof validator.note === 'string' && validator.note !== '' ? `（${oneLine(validator.note)}）` : '';
    headline.push(`validator ${status}${note}`);
  }

  const lines = [headline.join('  ')];
  const locErrors = Array.isArray(loc?.errors) ? loc.errors : [];
  if (loc !== null && report?.pass !== true && (locErrors.length > 0 || loc.pass === false)) {
    const shown = locErrors.slice(0, MAX_LOC_ERRORS);
    const scope = locErrors.length > shown.length
      ? `（前 ${shown.length} / 共 ${locErrors.length}）`
      : `（共 ${locErrors.length}）`;
    lines.push(`   loc 错误${scope}：`);
    for (const error of shown) lines.push(renderLocError(mod, error));
    if (shown.length === 0) lines.push('    （loc 判定失败但没有给出 errors 列表）');
  }

  if (validator !== null && validator.status !== 'skip' && validator.pass !== true) {
    const out = typeof validator.out === 'string' ? validator.out : '';
    if (/ReferenceError|is not defined/.test(out)) {
      const firstLineHit = out.split(/\r?\n/).map((line) => line.trim()).find((line) => /ReferenceError|is not defined/.test(line)) ?? '';
      lines.push(
        '   校验器自检失败（不是 mod 脚本的问题）：'
        + `${oneLine(firstLineHit) || 'ReferenceError'}；先跑 `
        + `\`node 工具-静态校验.mjs --root ${mod?.snapshot ?? '<快照>'}\` 复现并修校验器。`,
      );
    }
    lines.push(`   validator 输出尾部（${VALIDATOR_TAIL} 行）：`);
    lines.push(indentBlock(tailLines(out, VALIDATOR_TAIL) || '（无输出）', '    '));
  }

  const findings = lintModScripts(mod);
  if (findings.length > 0) {
    lines.push('   脚本卫生提示（不影响 PASS/FAIL）：');
    for (const finding of findings) lines.push(`     - ${finding}`);
  }
  return lines.join('\n');
}

/**
 * 渲染一个 mod 的 reverse 结果。
 * @param {any} report - CLI 的 JSON 报告。
 * @param {any} mod - 注册表里的 mod 描述。
 * @returns {string} 渲染块。
 */
function renderReverseBlock(report, mod) {
  const cases = Array.isArray(report?.reverse?.cases) ? report.reverse.cases : [];
  const passed = cases.filter((item) => item?.pass === true).length;
  const lines = [
    `${report?.mod ?? mod?.id ?? '?'}  ${report?.pass === true ? 'PASS' : 'FAIL'}  reverse ${passed}/${cases.length} cases`,
  ];
  for (const item of cases) {
    const found = Array.isArray(item?.found)
      ? item.found.map(oneLine).filter((text) => text !== '')
      : [];
    const detail = found.length > 0 ? found.join(' | ') : `count=${item?.count ?? '?'}`;
    lines.push(`   ${item?.pass === true ? 'PASS' : 'FAIL'}  ${oneLine(item?.name) || '(未命名 case)'}  ${detail}`);
  }
  if (report?.pass !== true) {
    lines.push(
      '   提示：反向样本或 ck3-modding-tools/configs.mjs 的 expect 可能过期——'
      + `先跑 \`node ${mod?.id ?? '<mod>'}/工具-反向验证.mjs\` 看实际「N / M 项如期报错」，再同步 expect。`,
    );
  }
  return lines.join('\n');
}

/**
 * 渲染 selftest 报告。
 * @param {any} report - `{command:'selftest', pass, samples, findings, errors}`。
 * @param {number} code - CLI 退出码。
 * @returns {string} 渲染块。
 */
function renderSelftest(report, code) {
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  const lines = [
    `自检 ${report?.pass === true ? 'PASS' : 'FAIL'}  `
    + `坏样本 ${numberOrQuestion(report?.samples)} → 发现 ${numberOrQuestion(report?.findings)}`,
  ];
  if (errors.length > 0) {
    lines.push(`  发现清单（共 ${errors.length} 条，最多列 12）：`);
    for (const error of errors.slice(0, 12)) {
      lines.push(`    ${oneLine(error?.lang) || '?'}  ${oneLine(error?.key) || '?'}  ${oneLine(error?.kind) || '?'}`);
    }
  }
  lines.push(`  CLI 退出码：${code}`);
  return lines.join('\n');
}

/**
 * 创建 `ck3mod_check` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   getNode: () => { path: string, source: string },
 *   run: (spec: object) => Promise<{ code: number, out: string, timedOut?: boolean, aborted?: boolean, error?: string }>,
 *   now: () => Date,
 * }} deps - 插件依赖（测试里可注入 fake `run`）。
 * @returns {object} `defineTool` 产物。
 */
export function checkTool(deps) {
  return defineTool({
    name: 'ck3mod_check',
    description:
      '调用共享工具目录的 cli.mjs 做 loc 检查（BOM / $ / [] / 跨语言一致性）、'
      + '各 mod 的静态校验、反向验证（变异样本应报错）与共享 loc 规则自检。'
      + '只汇总结果，不在插件里复制任何校验规则。',
    parameters: {
      task: {
        type: 'string',
        enum: [...TASKS],
        default: 'check',
        description:
          '检查种类：check=loc+静态校验；loc=只查本地化；reverse=反向验证（故意弄坏的样本应被抓到）；'
          + 'selftest=共享 loc 规则自检（与具体 mod 无关）',
      },
      mod: {
        type: 'string',
        default: 'all',
        description: 'mod id（可用值来自注册表，当前 6 个条目），all 表示全部',
      },
    },
    output: TEXT_OUTPUT,
    timeoutMs: 200_000,
    isConcurrencySafe: alwaysSafe,
    async execute(args, exec) {
      const requestedTask = String(args.task ?? 'check').trim().toLowerCase();
      const task = requestedTask === '' ? 'check' : requestedTask;
      if (!TASKS.includes(task)) {
        throw new Error(`未知 task：${task}\n可用：${TASKS.join(' / ')}（默认 check）`);
      }

      const toolsDir = typeof deps?.config?.toolsDir === 'string' ? deps.config.toolsDir : '';
      const cliPath = path.join(toolsDir, 'cli.mjs');
      if (toolsDir === '' || !fileExists(cliPath)) {
        throw new Error(
          `找不到共享校验入口：${cliPath}\n`
          + `（插件配置 toolsDir=${toolsDir === '' ? '（空）' : toolsDir}；`
          + '本插件不复制校验规则，只调用这个目录里的 cli.mjs）',
        );
      }

      const nodePath = deps.getNode().path;
      const signal = exec?.signal;
      const maxChars = maxOutputChars(deps);
      const now = typeof deps.now === 'function' ? deps.now : () => new Date();

      if (task === 'selftest') {
        const result = await deps.run({
          command: nodePath,
          args: [cliPath, 'selftest', '--json'],
          cwd: toolsDir,
          timeoutMs: SCRIPT_TIMEOUT_MS,
          signal,
        });
        const code = readCode(result);
        throwIfInterrupted(result, '共享 loc 自检', cliPath);

        const parsed = parseJsonText(result?.out, cliPath);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error(
            `selftest 返回了无法识别的 JSON 结构（应为对象）：${cliPath}\n`
            + `收到：${oneLine(JSON.stringify(parsed)).slice(0, 200)}`,
          );
        }
        const ok = parsed.pass === true && code === 0;
        const text = [
          '检查 · task=selftest · 共享 loc 规则自检（与具体 mod 无关）',
          '',
          renderSelftest(parsed, code),
          '',
          `RESULT: ${ok ? 'PASS' : 'FAIL'}（退出码 ${code}）`,
        ].join('\n');
        return { text: capOutput(text, maxChars, 'check-selftest', now) };
      }

      const registry = await deps.getRegistry();
      const mods = selectMods(registry, args.mod);
      const scriptArgs = isAllSelection(args.mod)
        ? ['--all', '--json']
        : [`${mods[0].id}`, '--json'];

      const result = await deps.run({
        command: nodePath,
        args: [cliPath, task, ...scriptArgs],
        cwd: toolsDir,
        timeoutMs: SCRIPT_TIMEOUT_MS,
        signal,
      });
      const code = readCode(result);
      throwIfInterrupted(result, '检查', cliPath);

      const reports = asReportArray(parseJsonText(result?.out, cliPath), cliPath);
      const byId = new Map(mods.map((mod) => [mod.id, mod]));
      const blocks = reports.map((report, index) => {
        const mod = byId.get(report?.mod) ?? mods[index];
        return task === 'reverse' ? renderReverseBlock(report, mod) : renderCheckBlock(report, mod);
      });

      const allPass = reports.length > 0 && reports.every((report) => report?.pass === true);
      const ok = code === 0 && allPass;
      const lines = [
        `检查 · task=${task} · mods: ${mods.map((mod) => mod.id).join(', ')}`,
        '',
        blocks.length > 0 ? blocks.join('\n\n') : '（cli 没有返回任何 mod 结果）',
        '',
      ];
      if ((code === 0) !== allPass && reports.length > 0) {
        lines.push(`注意：CLI 退出码 ${code} 与报告结论（${allPass ? 'PASS' : 'FAIL'}）不一致；本次按 ${allPass ? 'PASS' : 'FAIL'} 报。`);
      }
      lines.push(`RESULT: ${ok ? 'PASS' : 'FAIL'}（退出码 ${code}）`);

      const tag = mods.length === 1 ? `check-${mods[0].id}` : 'check-all';
      return { text: capOutput(lines.join('\n'), maxChars, tag, now) };
    },
  });
}
