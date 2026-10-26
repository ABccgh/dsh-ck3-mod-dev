/**
 * `ck3mod_headless` 工具：把 headless.js 的安全流程包成模型可见的工具。
 *
 * 这里是**唯一**会临时改写 `dlc_load.json` 并启动 `ck3.exe` 的入口，
 * 所以除了 headless.js 自带的备份/还原，还加了一把进程内互斥锁：
 * 同一时刻只允许一次无头，避免两次调用互相覆盖播放集。
 *
 * @module @local/ck3moddev/tools/headless
 */

import { runHeadless } from '../headless.js';
import { selectMods } from '../registry.js';
import { TEXT_OUTPUT, capOutput, clampInt } from '../text.js';
import { defineTool } from '../tool-kit.js';

/**
 * 造 `ck3mod_headless` 工具。
 * @param {{
 *   config: any,
 *   getRegistry: () => Promise<any>,
 *   run: (spec: object) => Promise<any>,
 *   now: () => Date,
 *   tempDir?: string,
 * }} deps - 依赖。
 * @returns {object} 工具定义。
 */
export function headlessTool(deps) {
  /** 进程内互斥：预设作用域里只有一个实例，模块级变量就够了。 */
  let inflight = false;

  return defineTool({
    name: 'ck3mod_headless',
    description:
      '无头冒烟：备份 dlc_load.json → 只启用该 mod → 启动 ck3.exe（-debug_mode -nographics '
      + '-shutdown_after_history -suppress_error_log）→ 到达 history 后若进程不退出会自动杀进程树 → '
      + '按字节还原并核对 SHA256 → 解析日志给出本 mod 报错数与隔离情况。'
      + '会临时改写你的播放集、约 30–60 秒；启动器或游戏在跑时会拒绝执行。',
    parameters: {
      mod: { type: 'string', required: true, description: 'mod id（curse / dejure / free / auto）。' },
      timeoutSec: {
        type: 'integer',
        description: `单次运行上限秒数（30–600），默认取插件配置 ${deps.config.headlessTimeoutSec}。`,
      },
      baseline: {
        type: 'boolean',
        description: '为 true 时再跑一轮空播放集做基线对照（耗时翻倍），对应 README 的「基线对照」步骤。',
      },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    timeoutMs: (deps.config.headlessTimeoutSec * 2 + 120) * 1000,
    async execute(args, exec) {
      if (inflight) {
        throw new Error('已有一次无头冒烟在运行。等它结束后再试（播放集不能同时被两次改写）。');
      }
      inflight = true;
      try {
        const registry = await deps.getRegistry();
        const [mod] = selectMods(registry, args.mod);
        const timeoutSec = clampInt(args.timeoutSec, deps.config.headlessTimeoutSec, 30, 600);
        const result = await runHeadless({
          config: deps.config,
          mod,
          run: deps.run,
          now: deps.now,
          timeoutSec,
          baseline: args.baseline === true,
          signal: exec.signal,
          ...(typeof deps.tempDir === 'string' ? { tempDir: deps.tempDir } : {}),
          ...(typeof deps.launch === 'function' ? { launch: deps.launch } : {}),
        });
        return {
          text: capOutput(result.text, deps.config.maxOutputChars, `headless-${mod.id}`, deps.now),
        };
      } finally {
        inflight = false;
      }
    },
  });
}
