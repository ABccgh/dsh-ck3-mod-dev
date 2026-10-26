/**
 * B 组工具（只读工具）的离线测试：`ck3mod_status` / `ck3mod_logs` / `ck3mod_vanilla` / `ck3mod_workshop`。
 *
 * 全部用例 hermetic：每个 test 用 `os.tmpdir()` 下的临时目录造 fixture，跑完即删；
 * 不读真实游戏目录、不联网、不启动任何进程（`deps.run` / `deps.getRegistry` 都是假的）。
 *
 * 运行：`node --test test/tools-b.test.js`
 *
 * @module @local/ck3moddev/test/tools-b
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { normalizeConfig } from '../lib/config.js';
import { statusTool } from '../lib/tools/status.js';
import { logsTool } from '../lib/tools/logs.js';
import { vanillaTool } from '../lib/tools/vanilla.js';
import { workshopTool } from '../lib/tools/workshop.js';

/** 固定时间源：让 capOutput 的落盘文件名可预期。 */
const FIXED_NOW = () => new Date('2026-10-26T12:00:00Z');

/**
 * 建一个自动清理的临时目录。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @param {string} [prefix] - 目录前缀。
 * @returns {string} 临时目录绝对路径。
 */
function tempDir(t, prefix = 'ck3mod-b-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * 写文本文件（自动建父目录）。
 * @param {string} file - 目标文件。
 * @param {string} content - 内容。
 * @returns {string} 文件路径。
 */
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/**
 * 写二进制文件（自动建父目录）。
 * @param {string} file - 目标文件。
 * @param {Buffer} buffer - 内容。
 * @returns {string} 文件路径。
 */
function writeBuffer(file, buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
  return file;
}

/**
 * 造一份指向临时目录的生效配置。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @param {Record<string, unknown>} [overrides] - 覆盖项。
 * @returns {ReturnType<typeof normalizeConfig>} 生效配置（所有路径都在临时目录下）。
 */
function makeConfig(t, overrides = {}) {
  const root = tempDir(t);
  return normalizeConfig({
    workspaceRoot: root,
    toolsDir: path.join(root, 'tools'),
    gameRoot: path.join(root, 'ck3'),
    userDir: path.join(root, 'user'),
    maxOutputChars: 12_000,
    ...overrides,
  });
}

/**
 * 构造工具依赖（默认全部指向「不可用」，用例按需覆盖）。
 * @param {any} config - 生效配置。
 * @param {Record<string, unknown>} [overrides] - 覆盖项。
 * @returns {any} deps。
 */
function makeDeps(config, overrides = {}) {
  return {
    config,
    getRegistry: async () => {
      throw new Error('用例没有提供假注册表');
    },
    getNode: () => {
      throw new Error('用例没有提供假 node');
    },
    run: async () => ({ code: -1, out: '' }),
    now: FIXED_NOW,
    ...overrides,
  };
}

/**
 * 造一个只含一个 mod 的假注册表。
 * @param {any} mod - mod 描述。
 * @returns {{ mods: Map<string, any>, ids: string[], source: string }} 注册表。
 */
function fakeRegistry(...mods) {
  return {
    mods: new Map(mods.map((mod) => [mod.id, mod])),
    ids: mods.map((mod) => mod.id),
    source: 'C:\\fake\\configs.mjs',
  };
}

// ---------------------------------------------------------------------------
// ck3mod_status
// ---------------------------------------------------------------------------

test('status：环境、dlc_load、四个 mod 块与建议', async (t) => {
  const config = makeConfig(t);
  write(path.join(config.launcherSettings), '{"rawVersion":"1.20.3","version":"1.20.3 (Crozier)"}');
  write(
    path.join(config.userDir, 'dlc_load.json'),
    JSON.stringify({ enabled_mods: ['mod/a.mod', 'mod/b.mod'], disabled_dlcs: [] }),
  );
  write(path.join(config.logDir, 'error.log'), '[21:10:24][E][x.cpp:1]: boom\n');
  write(path.join(config.logDir, 'debug.log'), '[21:10:19][D][x.cpp:2]: Mounted Data: D:/mod/x\n');

  const ids = ['curse', 'dejure', 'free', 'auto'];
  const mods = [];
  for (const id of ids) {
    const repo = path.join(config.workspaceRoot, 'repos', id);
    fs.mkdirSync(repo, { recursive: true });
    const snapshot = path.join(repo, `${id}-v1`, id);
    if (id !== 'auto') write(path.join(snapshot, 'descriptor.mod'), `version="1.0"\nname="${id}"\n`);
    mods.push({
      id,
      label: `${id} 测试`,
      repo,
      snapshot,
      folder: id,
      deployDir: path.join(config.modsDir, id),
      deployMod: path.join(config.modsDir, `${id}.mod`),
      capabilities: {
        generate: true,
        normalize: id !== 'curse',
        deploy: true,
        reverse: id === 'curse',
        thumbnail: true,
      },
      workshopDescription: path.join(repo, '工坊描述-BBCode.txt'),
    });
  }
  const registry = fakeRegistry(...mods);

  const calls = [];
  const tool = statusTool(
    makeDeps(config, {
      getRegistry: async () => registry,
      getNode: () => ({ path: 'C:\\fake\\node.exe', source: 'test' }),
      run: async (spec) => {
        calls.push(spec);
        if (spec.args?.[0] === '--version') return { code: 0, out: 'v24.21.0\n' };
        if (spec.command === 'git') {
          return { code: 0, out: '## cn_curse-v1.0...origin/cn_curse-v1.0\n M a.txt\n?? b.txt\n' };
        }
        return { code: 0, out: '' };
      },
    }),
  );

  assert.equal(tool.name, 'ck3mod_status');
  assert.equal(tool.timeoutMs, 60_000);
  assert.equal(tool.isConcurrencySafe(), true);

  const { text } = await tool.execute({ mod: 'all' });
  assert.equal(typeof text, 'string');

  for (const id of ids) assert.match(text, new RegExp(`\\[${id}\\]`));
  assert.match(text, /node：C:\\fake\\node\.exe（来源 test） · v24\.21\.0/);
  assert.match(text, /游戏版本：1\.20\.3/);
  assert.match(text, /dlc_load\.json：2 条启用 mod，0 条禁用 DLC · SHA256 [0-9A-F]{64}/);
  assert.match(text, /error\.log：\d+ B · \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  assert.match(text, /debug\.log：\d+ B · /);
  assert.match(text, /快照：存在/);
  assert.match(text, /快照：缺失/);
  assert.match(text, /本机副本：目录 缺失 · \.mod 缺失/);
  assert.match(text, /能力：生成 ✓ \/ 规范化 - \/ 部署 ✓ \/ 反向 ✓ \/ 缩略图 ✓/);
  assert.match(text, /git：分支 cn_curse-v1\.0 · dirty 2 文件/);
  assert.match(text, /先跑 ck3mod_check mod=all/);

  assert.equal(calls.filter((spec) => spec.command === 'git').length, 4);
  assert.equal(calls.filter((spec) => spec.args?.[0] === '--version').length, 1);
  const gitCall = calls.find((spec) => spec.command === 'git');
  assert.equal(gitCall.timeoutMs, 8_000);
  assert.deepEqual(gitCall.args.slice(0, 3), ['-C', path.join(config.workspaceRoot, 'repos', 'curse'), 'status']);

  // mod 过滤：只渲染选中的 mod 块。
  const single = await tool.execute({ mod: 'curse' });
  assert.match(single.text, /\[curse\]/);
  assert.ok(!single.text.includes('[dejure]'));

  // 未知 id 是可执行的错误。
  await assert.rejects(tool.execute({ mod: 'nope' }), /未知 mod：nope/);
});

test('status：注册表失败不抛，其余照常输出', async (t) => {
  const config = makeConfig(t);
  const tool = statusTool(
    makeDeps(config, {
      getRegistry: async () => {
        throw new Error('configs.mjs 缺失');
      },
      getNode: () => {
        throw new Error('找不到 node 可执行文件');
      },
    }),
  );

  const { text } = await tool.execute({});
  assert.match(text, /mod 注册表：FAILED configs\.mjs 缺失/);
  assert.match(text, /node：未找到（找不到 node 可执行文件）/);
  assert.match(text, /游戏版本：读不到/);
  assert.match(text, /dlc_load\.json：FAILED/);
  assert.match(text, /error\.log：——/);
  assert.match(text, /debug\.log：——/);
  assert.match(text, /先跑 ck3mod_check mod=all/);
});

test('status：git 不可用时写 unknown', async (t) => {
  const config = makeConfig(t);
  const mod = {
    id: 'curse',
    label: 'cx',
    repo: path.join(config.workspaceRoot, 'repo'),
    snapshot: path.join(config.workspaceRoot, 'repo', 'cn_curse'),
    folder: 'cn_curse',
    deployDir: path.join(config.modsDir, 'cn_curse'),
    deployMod: path.join(config.modsDir, 'cn_curse.mod'),
    capabilities: {},
  };
  const tool = statusTool(
    makeDeps(config, {
      getRegistry: async () => fakeRegistry(mod),
      getNode: () => ({ path: 'node.exe', source: 'test' }),
      run: async (spec) => {
        if (spec.args?.[0] === '--version') return { code: 0, out: 'v24.0.0\n' };
        return { code: 128, out: 'fatal: not a git repository (or any of the parent directories): .git\n' };
      },
    }),
  );
  const { text } = await tool.execute({});
  assert.match(text, /git：unknown（fatal: not a git repository/);
});

// ---------------------------------------------------------------------------
// ck3mod_logs
// ---------------------------------------------------------------------------

/**
 * 造一份 logs 夹具（error.log / debug.log / game.log），返回配置与假注册表。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @returns {{ config: any, registry: any }} 夹具。
 */
function logsFixture(t) {
  const config = makeConfig(t);
  write(
    path.join(config.logDir, 'error.log'),
    [
      "[21:10:24][E][x.cpp:1]: Undefined entity 'foo'",
      '[21:10:24][E][y.cpp:2]: something in cn_curse',
      '[21:10:25][W][y.cpp:3]: just a warning',
      '[21:10:26][E][z.cpp:4]: mod/cn_curse/foo.txt',
      '[21:10:27][E][log.cpp:31]: Instance has not been created!',
    ].join('\n') + '\n',
  );
  write(
    path.join(config.logDir, 'debug.log'),
    [
      '天降横财 面板实验|mod/free_resources_panel_exp.mod|Enabled',
      '降祸 Bring Woe|mod/cn_curse.mod|Enabled',
      '[21:10:19][D][virtualfilesystem_physfs.cpp:814]: Mounted Data: D:/Program Files (x86)/Steam/steamapps/common/Crusader Kings III/game/dlc/dlc016_cp2',
      '[21:10:19][D][virtualfilesystem_physfs.cpp:814]: Mounted Data: C:/Users/11210/Documents/Paradox Interactive/Crusader Kings III/mod/free_resources_panel_exp',
      '[21:10:20][E][x.cpp:9]: debug 里的一个错误',
    ].join('\n') + '\n',
  );
  write(path.join(config.logDir, 'game.log'), ['line1', 'line2', 'line3', 'line4', 'line5'].join('\n') + '\n');

  const registry = fakeRegistry({ id: 'curse', label: '降祸 Bring Woe', folder: 'cn_curse' });
  return { config, registry };
}

/**
 * 造一个 logs 工具（带假注册表）。
 * @param {any} config - 配置。
 * @param {any} registry - 假注册表。
 * @returns {object} 工具。
 */
function makeLogsTool(config, registry) {
  return logsTool(makeDeps(config, { getRegistry: async () => registry }));
}

test('logs：file=all 汇总每个日志文件', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);
  assert.equal(tool.name, 'ck3mod_logs');
  assert.equal(tool.timeoutMs, 30_000);
  assert.equal(tool.isConcurrencySafe(), true);

  const { text } = await tool.execute({ file: 'all' });
  assert.match(text, /共 3 个 \*\.log/);
  assert.match(text, /- error\.log：.*\[E\] 4/);
  assert.match(text, /- debug\.log：.*\[E\] 1/);
  assert.match(text, /- game\.log：.*\[E\] 0/);
  assert.match(text, /file=error/);
});

test('logs：file=error 统计、尾部与崩溃标记', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);

  const { text } = await tool.execute({ file: 'error' });
  assert.match(text, /错误条目：\[E\] 共 4 条/);
  assert.match(text, /最后 4 条 \[E\]（共 4 条，显示尾部 4 条）/);
  assert.match(text, /崩溃标记：1 行/);
  assert.match(text, /Instance has not been created!/);
  assert.ok(!text.includes('just a warning'));

  const tailed = await tool.execute({ file: 'error', tail: 2 });
  assert.match(tailed.text, /最后 2 条 \[E\]（共 4 条，显示尾部 2 条）/);
  assert.ok(!tailed.text.includes('Undefined entity'));
  assert.ok(!tailed.text.includes('something in cn_curse'));
});

test('logs：按 mod 过滤并给 token 计数', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);

  const { text } = await tool.execute({ file: 'error', mod: 'curse' });
  assert.match(text, /mod 过滤：curse（降祸 Bring Woe）（token：cn_curse \/ 降祸 Bring Woe）命中 2 条/);
  assert.match(text, /token 计数：cn_curse=2 · 降祸 Bring Woe=0/);
  assert.match(text, /最后 2 条 \[E\]（共 2 条，显示尾部 2 条）/);
  assert.ok(!text.includes('Undefined entity'));

  await assert.rejects(tool.execute({ file: 'error', mod: 'nope' }), /未知 mod：nope/);
});

test('logs：file=debug 解析启用清单与 Mounted Data', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);

  const { text } = await tool.execute({ file: 'debug' });
  assert.match(text, /本次启用的 mod：2 个/);
  assert.match(text, /天降横财 面板实验 → mod\/free_resources_panel_exp\.mod/);
  assert.match(text, /降祸 Bring Woe → mod\/cn_curse\.mod/);
  assert.match(text, /本次启用了多个 mod，隔离不干净/);
  assert.match(text, /Mounted Data（mod 目录）：1 条/);
  assert.match(text, /mod\/free_resources_panel_exp/);
  assert.ok(!text.includes('dlc016_cp2'));
  assert.match(text, /debug\.log 里的 \[E\]：1 条/);
});

test('logs：file=game 显示尾部行', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);

  const { text } = await tool.execute({ file: 'game', tail: 2 });
  assert.match(text, /尾部 2 行（共 5 行）/);
  assert.ok(text.includes('line4'));
  assert.ok(text.includes('line5'));
  assert.ok(!text.includes('line1'));
});

test('logs：缺失文件报错并列出目录里现有的 *.log；空目录也能说明', async (t) => {
  const { config, registry } = logsFixture(t);
  const tool = makeLogsTool(config, registry);

  await assert.rejects(
    (async () => {
      fs.rmSync(path.join(config.logDir, 'error.log'), { force: true });
      return tool.execute({ file: 'error' });
    })(),
    (error) => error.message.includes('日志文件不存在') && error.message.includes('game.log') && error.message.includes('debug.log'),
  );

  await assert.rejects(tool.execute({ file: 'nope' }), /未知 file：nope/);

  const emptyConfig = makeConfig(t);
  fs.mkdirSync(emptyConfig.logDir, { recursive: true });
  const emptyTool = makeLogsTool(emptyConfig, registry);
  const { text } = await emptyTool.execute({ file: 'all' });
  assert.match(text, /没有任何 \*\.log/);
  await assert.rejects(emptyTool.execute({ file: 'error' }), /日志文件不存在/);
});

// ---------------------------------------------------------------------------
// ck3mod_vanilla
// ---------------------------------------------------------------------------

/**
 * 造一棵假的原版游戏目录树。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @returns {{ config: any, base: string }} 夹具。
 */
function vanillaFixture(t) {
  const config = makeConfig(t);
  const base = path.join(config.gameRoot, 'game');
  write(path.join(base, 'common', 'foo.txt'), ['# comment', 'max_development = 100', 'MALE_ONLY = yes'].join('\n') + '\n');
  write(
    path.join(base, 'common', 'bar.txt'),
    ['max_development = 5', 'max_development = 6', 'max_development = 7', 'max_development = 8', 'max_development = 9'].join('\n') + '\n',
  );
  write(path.join(base, 'common', 'data.info'), 'info max_development\n');
  write(path.join(base, 'events', 'ev.txt'), 'max_development = 1\n');
  write(path.join(base, 'tests', 't.txt'), 'max_development = 42\n');
  write(path.join(base, 'localization', 'english', 'x_l_english.yml'), ' KEY:0 "max_development"\n');
  write(path.join(base, '_commandline_options.info'), 'max_development info\n');
  write(path.join(base, 'music', 'ignored.ogg'), 'max_development is not text\n');
  return { config, base };
}

test('vanilla：默认 common 检索命中与渲染格式', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));
  assert.equal(tool.name, 'ck3mod_vanilla');
  assert.equal(tool.timeoutMs, 25_000);
  assert.equal(tool.isConcurrencySafe(), true);

  const { text } = await tool.execute({ query: 'max_development' });
  assert.match(text, /检索 "max_development" · scope=common · 扫描 3 文件 \/ /);
  assert.match(text, /game\/common\/bar\.txt:1: max_development = 5/);
  assert.match(text, /game\/common\/foo\.txt:2: max_development = 100/);
  assert.match(text, /命中 7 行，显示 7 行/);
  assert.match(text, /看上下文用 read 工具打开 .*game\\common\\bar\.txt/);
  assert.ok(!text.includes('ignored.ogg'));
});

test('vanilla：limit 截断显示但完整统计', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));

  const { text } = await tool.execute({ query: 'max_development', limit: 2 });
  assert.match(text, /命中 7 行，显示 2 行（还有 5 行未显示/);
  assert.equal(text.match(/^game\//gm)?.length, 2);
});

test('vanilla：大小写敏感开关', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));

  const insensitive = await tool.execute({ query: 'male_only' });
  assert.match(insensitive.text, /game\/common\/foo\.txt:3: MALE_ONLY = yes/);

  const sensitiveMiss = await tool.execute({ query: 'male_only', caseSensitive: true });
  assert.match(sensitiveMiss.text, /命中 0 行，显示 0 行/);

  const sensitiveHit = await tool.execute({ query: 'MALE_ONLY', caseSensitive: true });
  assert.match(sensitiveHit.text, /game\/common\/foo\.txt:3/);
});

test('vanilla：scope 映射（events / loc / docs / all）', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));

  const events = await tool.execute({ query: 'max_development', scope: 'events' });
  assert.match(events.text, /scope=events · 扫描 1 文件/);
  assert.match(events.text, /命中 1 行，显示 1 行/);

  const loc = await tool.execute({ query: 'max_development', scope: 'loc' });
  assert.match(loc.text, /scope=loc · 扫描 1 文件/);
  assert.match(loc.text, /game\/localization\/english\/x_l_english\.yml:1/);

  const docs = await tool.execute({ query: 'max_development', scope: 'docs' });
  assert.match(docs.text, /scope=docs · 扫描 2 文件/);
  assert.match(docs.text, /命中 2 行，显示 2 行/);
  assert.match(docs.text, /data\.info:1/);
  assert.match(docs.text, /_commandline_options\.info:1/);

  const all = await tool.execute({ query: 'max_development', scope: 'all' });
  assert.match(all.text, /scope=all · 扫描 6 文件/);
  assert.match(all.text, /命中 10 行，显示 10 行/);
  // all 不含 localization。
  assert.ok(!all.text.includes('x_l_english.yml'));
});

test('vanilla：subdir 收窄范围、路径穿越被拒', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));

  const sub = await tool.execute({ query: 'max_development', scope: 'common', subdir: 'game/common' });
  assert.match(sub.text, /subdir=game\/common/);
  assert.match(sub.text, /扫描 3 文件/);
  assert.match(sub.text, /命中 7 行/);

  const short = await tool.execute({ query: 'max_development', scope: 'common', subdir: 'common' });
  assert.match(short.text, /扫描 3 文件/);

  await assert.rejects(tool.execute({ query: 'x', subdir: '../secret' }), /不能包含 "\.\."/);
  await assert.rejects(tool.execute({ query: 'x', subdir: 'C:\\Windows' }), /不能是绝对路径/);
  await assert.rejects(tool.execute({ query: 'x', subdir: 'game\\does-not-exist' }), /不存在/);
});

test('vanilla：无命中不是错误；参数错误可执行', async (t) => {
  const { config } = vanillaFixture(t);
  const tool = vanillaTool(makeDeps(config));

  const { text } = await tool.execute({ query: 'zzz_不存在的词_123' });
  assert.match(text, /命中 0 行，显示 0 行/);
  assert.match(text, /没命中不是错误/);

  await assert.rejects(tool.execute({ query: '   ' }), /query 不能为空/);
  await assert.rejects(tool.execute({}), /缺少必填参数 query/);
  await assert.rejects(tool.execute({ query: 'x', scope: 'nope' }), /未知 scope：nope/);
});

test('vanilla：gameRoot 不存在时报可执行的错误', async (t) => {
  const root = tempDir(t);
  const config = normalizeConfig({
    workspaceRoot: root,
    toolsDir: path.join(root, 'tools'),
    gameRoot: path.join(root, 'missing-game'),
    userDir: path.join(root, 'user'),
  });
  const tool = vanillaTool(makeDeps(config));
  await assert.rejects(tool.execute({ query: 'x' }), /找不到游戏目录/);
});

// ---------------------------------------------------------------------------
// ck3mod_workshop
// ---------------------------------------------------------------------------

/** PNG 文件签名。 */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 造一个最小可解析的 PNG（只够 IHDR 读宽高，测试不校验 CRC）。
 * @param {number} width - 宽。
 * @param {number} height - 高。
 * @returns {Buffer} PNG 字节。
 */
function makePng(width, height) {
  const buffer = Buffer.alloc(33);
  Buffer.from(PNG_SIGNATURE).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

/**
 * 造一个 mod 仓库 + 快照 + descriptor + 描述文件 + 缩略图的夹具。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @param {{ descriptionBytes?: number, descriptionContent?: string, name?: string,
 *   remoteFileId?: string, innerVersion?: string, outerVersion?: string,
 *   thumbnail?: boolean, writeDescription?: boolean }} [options] - 变体。
 * @returns {{ config: any, mod: any, registry: any }} 夹具。
 */
function workshopFixture(t, options = {}) {
  const {
    descriptionBytes = 2_247,
    descriptionContent,
    name = '降祸 - Bring Woe',
    remoteFileId = '3813133358',
    innerVersion = '1.0',
    outerVersion = '1.0',
    thumbnail = true,
    writeDescription = true,
  } = options;

  const config = makeConfig(t);
  const repo = path.join(config.workspaceRoot, 'ck3-curse');
  const snapshot = path.join(repo, 'cn_curse-v1.0', 'cn_curse');
  const descriptionFile = path.join(repo, '工坊描述-BBCode.txt');

  const lines = [
    `version="${innerVersion}"`,
    'tags={',
    '\t"Gameplay"',
    '\t"Cheats"',
    '}',
    `name="${name}"`,
    'picture="thumbnail.png"',
    'supported_version="1.20.*"',
  ];
  if (remoteFileId !== '') lines.push(`remote_file_id="${remoteFileId}"`);
  write(path.join(snapshot, 'descriptor.mod'), lines.join('\n') + '\n');

  const outerLines = lines.map((line) => (line.startsWith('version=') ? `version="${outerVersion}"` : line));
  write(`${snapshot}.mod`, outerLines.join('\n') + '\n');

  if (writeDescription) {
    fs.mkdirSync(path.dirname(descriptionFile), { recursive: true });
    const content = descriptionContent === undefined ? 'x'.repeat(descriptionBytes) : descriptionContent;
    fs.writeFileSync(descriptionFile, content, 'utf8');
  }
  if (thumbnail) writeBuffer(path.join(snapshot, 'thumbnail.png'), makePng(512, 512));

  const mod = {
    id: 'curse',
    label: '降祸 Bring Woe',
    repo,
    snapshot,
    folder: 'cn_curse',
    workshopDescription: descriptionFile,
    deployDir: path.join(config.modsDir, 'cn_curse'),
    deployMod: path.join(config.modsDir, 'cn_curse.mod'),
    capabilities: {},
  };
  return { config, mod, registry: fakeRegistry(mod) };
}

/**
 * 造一个 workshop 工具（带假注册表）。
 * @param {any} config - 配置。
 * @param {any} registry - 假注册表。
 * @returns {object} 工具。
 */
function makeWorkshopTool(config, registry) {
  return workshopTool(makeDeps(config, { getRegistry: async () => registry }));
}

test('workshop：描述文件 7999/8000 字节 PASS，8001 字节 WARN', async (t) => {
  const cases = [
    { bytes: 7_999, verdict: 'PASS', margin: '余量 1 B' },
    { bytes: 8_000, verdict: 'PASS', margin: '余量 0 B' },
    { bytes: 8_001, verdict: 'WARN', margin: '超出 1 B' },
  ];
  for (const item of cases) {
    const { config, registry } = workshopFixture(t, { descriptionBytes: item.bytes });
    const tool = makeWorkshopTool(config, registry);
    const { text } = await tool.execute({ mod: 'curse' });
    assert.match(
      text,
      new RegExp(`第 1 段：${item.bytes} B / 上限 8000 B（${item.margin}）· ${item.verdict}`),
    );
    if (item.verdict === 'PASS') assert.match(text, /结论：PASS/);
    else assert.match(text, /结论：WARN .*工坊描述超限（第 1 段 > 8000 字节）/);
  }
});

test('workshop：########## 分段——两段各自 ≤8000 但合计 >8000 判 PASS', async (t) => {
  // free / auto 的真实形状：整文件 8000+ 字节，但粘到启动器的两段各自在 8000 内。
  const descriptionContent = [
    '########## 第 1 段：描述（从这里开始整段复制）##########',
    '[h1]测试 Mod[/h1]',
    'x'.repeat(6_000),
    '########## 第 1 段结束 ##########',
    '########## 第 2 段：修补程序说明（从这里开始整段复制）##########',
    '[b]修补说明[/b]',
    'y'.repeat(3_000),
    '########## 第 2 段结束 ##########',
    '',
  ].join('\n');
  const { config, registry } = workshopFixture(t, { descriptionContent });
  const { text } = await makeWorkshopTool(config, registry).execute({ mod: 'curse' });

  const total = Number(text.match(/整文件：(\d+) B/)?.[1]);
  const first = Number(text.match(/第 1 段（描述）：(\d+) B/)?.[1]);
  const second = Number(text.match(/第 2 段（修补程序说明）：(\d+) B/)?.[1]);
  assert.ok(total > 8000, `整文件应超过 8000 字节，实际 ${total}`);
  assert.ok(first <= 8000, `第 1 段应 ≤8000 字节，实际 ${first}`);
  assert.ok(second <= 8000, `第 2 段应 ≤8000 字节，实际 ${second}`);
  assert.match(text, /第 1 段（描述）：\d+ B \/ 上限 8000 B（余量 \d+ B）· PASS/);
  assert.match(text, /第 2 段（修补程序说明）：\d+ B \/ 上限 8000 B（余量 \d+ B）· PASS/);
  assert.match(text, /BBCode 配平：PASS/);
  assert.match(text, /结论：PASS/);
});

test('workshop：==== 第 2 段 ==== 分隔行风格——分段判定 PASS', async (t) => {
  // de-jure 的真实形状：用一行 ==== 第 2 段：修补程序说明 ==== 分隔两段。
  const descriptionContent = [
    '[h1]法理测试[/h1]',
    'x'.repeat(6_000),
    '==================== 第 2 段：修补程序说明 ====================',
    '[h1]更新日志[/h1]',
    'y'.repeat(3_000),
    '',
  ].join('\n');
  const { config, registry } = workshopFixture(t, { descriptionContent });
  const { text } = await makeWorkshopTool(config, registry).execute({ mod: 'curse' });

  const total = Number(text.match(/整文件：(\d+) B/)?.[1]);
  assert.ok(total > 8000, `整文件应超过 8000 字节，实际 ${total}`);
  assert.match(text, /第 1 段：\d+ B \/ 上限 8000 B（余量 \d+ B）· PASS/);
  assert.match(text, /第 2 段（修补程序说明）：\d+ B \/ 上限 8000 B（余量 \d+ B）· PASS/);
  // 分隔行本身不能被算进任何一段的体积。
  assert.ok(!text.includes('第 2 段（）'));
  assert.match(text, /结论：PASS/);
});

test('workshop：名称超过 128 字节 WARN', async (t) => {
  const { config, registry } = workshopFixture(t, { name: 'x'.repeat(129) });
  const { text } = await makeWorkshopTool(config, registry).execute({ mod: 'curse' });

  assert.match(text, /名称：x{129} · 129 B \/ 上限 128 B · WARN/);
  assert.match(text, /结论：WARN .*mod 名称超限（129 > 128 字节）/);
});

test('workshop：BBCode 标签不配平 WARN 并列出标签', async (t) => {
  const { config, registry } = workshopFixture(t, { descriptionContent: '[b]未闭合的粗体\n[h1]未闭合的标题\n' });
  const { text } = await makeWorkshopTool(config, registry).execute({ mod: 'curse' });

  assert.match(text, /BBCode 配平：WARN —— \[b\] 开 1 \/ 闭 0；\[h1\] 开 1 \/ 闭 0/);
  assert.match(text, /结论：WARN .*BBCode 标签不配平（b、h1）/);
});

test('workshop：descriptor 缺 remote_file_id 时明确警告不可撤销', async (t) => {
  const { config, registry } = workshopFixture(t, { remoteFileId: '' });
  const tool = makeWorkshopTool(config, registry);

  const { text } = await tool.execute({});
  assert.match(text, /remote_file_id 为空：上传会新建一个工坊条目，且不可撤销/);
  assert.match(text, /结论：WARN .*remote_file_id 为空/);
  assert.match(text, /说明：本工具只做只读预检/);
});

test('workshop：descriptor 字段不一致逐条列出', async (t) => {
  const { config, registry } = workshopFixture(t, { innerVersion: '1.0', outerVersion: '0.9' });
  const tool = makeWorkshopTool(config, registry);

  const { text } = await tool.execute({ mod: 'curse' });
  assert.match(text, /descriptor 对照：/);
  assert.match(text, /内层：存在.*descriptor\.mod/);
  assert.match(text, /外层：存在.*cn_curse\.mod/);
  assert.match(text, /本机：缺失/);
  assert.match(text, /字段对比：不一致 1 项/);
  assert.match(text, /version：内层=1\.0 · 外层=0\.9/);
  assert.match(text, /结论：WARN .*descriptor 字段不一致（version）/);
});

test('workshop：descriptor 一致时 PASS，并解析缩略图宽高', async (t) => {
  const { config, registry } = workshopFixture(t);
  const tool = makeWorkshopTool(config, registry);

  assert.equal(tool.name, 'ck3mod_workshop');
  assert.equal(tool.timeoutMs, 30_000);
  assert.equal(tool.isConcurrencySafe(), true);

  const { text } = await tool.execute({ mod: 'curse' });
  assert.match(text, /字段对比：remote_file_id \/ version \/ supported_version \/ name 一致/);
  assert.match(text, /名称：降祸 - Bring Woe · 18 B \/ 上限 128 B · PASS/);
  assert.match(text, /缩略图：存在 · 33 B（33 B）· 512×512/);
  assert.match(text, /结论：PASS/);
});

test('workshop：缩略图/描述文件缺失时 WARN', async (t) => {
  const missingThumb = workshopFixture(t, { thumbnail: false });
  const thumbText = (await makeWorkshopTool(missingThumb.config, missingThumb.registry).execute({})).text;
  assert.match(thumbText, /缩略图：缺失/);
  assert.match(thumbText, /结论：WARN .*缩略图缺失/);

  const missingDesc = workshopFixture(t, { writeDescription: false });
  const descText = (await makeWorkshopTool(missingDesc.config, missingDesc.registry).execute({})).text;
  assert.match(descText, /工坊描述：无描述文件/);
  assert.match(descText, /结论：WARN .*工坊描述文件缺失/);
});

test('workshop：未知 mod 与注册表失败都是可执行错误', async (t) => {
  const { config, registry } = workshopFixture(t);
  const tool = makeWorkshopTool(config, registry);
  await assert.rejects(tool.execute({ mod: 'nope' }), /未知 mod：nope/);

  const broken = workshopTool(makeDeps(config));
  await assert.rejects(broken.execute({}), /读不到 mod 注册表，无法做工坊预检/);
});
