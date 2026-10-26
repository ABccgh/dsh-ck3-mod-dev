/**
 * A 组测试：`ck3mod_check` / `ck3mod_build` / `ck3mod_deploy`。
 *
 * 全部 hermetic：只在 `os.tmpdir()` 下建临时目录，`deps.run` 是 fake（记录收到的
 * command/args/cwd 并返回预设 `{code,out}`），不碰真实 mod、真机目录、游戏和网络。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildTool } from '../lib/tools/build.js';
import { checkTool } from '../lib/tools/check.js';
import { deployTool } from '../lib/tools/deploy.js';

/** 测试里假 node 可执行文件：只用于断言 `command`，永远不真的执行。 */
const NODE_PATH = 'C:\\fake-node\\node.exe';

/**
 * 建一个测试用临时根目录，测试结束自动删除。
 * @param {import('node:test').TestContext} t - 测试上下文。
 * @returns {string} 临时根目录。
 */
function makeTempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3moddev-a-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/**
 * 写一个文件（自动建父目录）。
 * @param {string} file - 绝对路径。
 * @param {string} [text] - 内容。
 * @returns {void}
 */
function writeFile(file, text = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

/**
 * 建一个假的共享工具目录（只放一个空的 cli.mjs，够 fileExists 通过）。
 * @param {string} root - 临时根目录。
 * @returns {string} toolsDir 绝对路径。
 */
function makeToolsDir(root) {
  const toolsDir = path.join(root, 'ck3-modding-tools');
  writeFile(path.join(toolsDir, 'cli.mjs'), '// fake cli for tests\n');
  return toolsDir;
}

/**
 * 造一个注册表形状的 mod 描述（能力默认全 false）。
 * @param {string} root - 临时根目录。
 * @param {string} id - mod id。
 * @param {Record<string, unknown>} [overrides] - 覆盖字段。
 * @returns {any} mod 描述。
 */
function makeMod(root, id, overrides = {}) {
  const repo = path.join(root, `repo-${id}`);
  fs.mkdirSync(repo, { recursive: true });
  return {
    id,
    label: `${id} 标签`,
    repo,
    snapshot: path.join(repo, `${id}-v1.0`, id),
    folder: id,
    scripts: {
      validator: path.join(repo, '工具-静态校验.mjs'),
      reverse: path.join(repo, '工具-反向验证.mjs'),
      generate: path.join(repo, '工具-生成.mjs'),
      normalize: path.join(repo, '工具-规范化.mjs'),
      deploy: path.join(repo, '工具-部署.mjs'),
    },
    capabilities: {
      validator: false,
      reverse: false,
      generate: false,
      normalize: false,
      deploy: false,
      flags: { generate: [], normalize: [], deploy: [] },
    },
    deployDir: path.join(root, 'mods', id),
    deployMod: path.join(root, 'mods', `${id}.mod`),
    ...overrides,
  };
}

/**
 * 覆盖 mod 的脚本能力与开关探测结果。
 * @param {any} mod - `makeMod` 的产物。
 * @param {{ generate?: boolean, normalize?: boolean, deploy?: boolean,
 *   flags?: Record<string, string[]> }} [patch] - 能力覆盖。
 * @returns {any} 新的 mod 描述。
 */
function capable(mod, patch = {}) {
  const { generate, normalize, deploy, flags = {} } = patch;
  const capabilities = {
    ...mod.capabilities,
    ...(generate === undefined ? {} : { generate }),
    ...(normalize === undefined ? {} : { normalize }),
    ...(deploy === undefined ? {} : { deploy }),
    flags: { ...mod.capabilities.flags, ...flags },
  };
  return { ...mod, capabilities };
}

/**
 * 造 fake `run`：记录 spec，按回调返回预设结果。
 * @param {(spec: any, index: number) => { code: number, out: string, timedOut?: boolean,
 *   aborted?: boolean, error?: string }} handler - 结果回调。
 * @returns {{ run: (spec: any) => Promise<any>, calls: any[] }} fake run 与调用记录。
 */
function makeRun(handler) {
  const calls = [];
  const run = async (spec) => {
    calls.push(spec);
    return handler(spec, calls.length - 1);
  };
  return { run, calls };
}

/**
 * 默认结果：成功且无输出。
 * @returns {{ code: number, out: string }} 结果。
 */
function okNoOutput() {
  return { code: 0, out: '' };
}

/**
 * 造一个注册表对象。
 * @param {string} toolsDir - 共享工具目录。
 * @param {any[]} mods - mod 描述列表。
 * @returns {any} 注册表。
 */
function makeRegistry(toolsDir, mods) {
  return {
    toolsDir,
    mods: new Map(mods.map((mod) => [mod.id, mod])),
    ids: mods.map((mod) => mod.id),
    loadedAt: new Date(0).toISOString(),
    source: path.join(toolsDir, 'configs.mjs'),
  };
}

/**
 * 造工具依赖（测试注入版）。
 * @param {{ toolsDir: string, mods?: any[], run?: Function, getRegistry?: Function }} options - 参数。
 * @returns {any} deps。
 */
function makeDeps({ toolsDir, mods = [], run = async () => okNoOutput(), getRegistry }) {
  const registry = makeRegistry(toolsDir, mods);
  return {
    config: {
      workspaceRoot: path.dirname(toolsDir),
      toolsDir,
      modsDir: path.join(path.dirname(toolsDir), 'mods'),
      maxOutputChars: 12_000,
    },
    getRegistry: getRegistry ?? (async () => registry),
    getNode: () => ({ path: NODE_PATH, source: 'test' }),
    run,
    now: () => new Date('2026-01-02T03:04:05.000Z'),
  };
}

/* ============================== ck3mod_check ============================== */

test('check：单 mod PASS 渲染与参数拼装', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const report = {
    mod: 'curse',
    label: '降祸 Bring Woe',
    command: 'check',
    loc: { files: 3, entries: 122, errors: [], warnings: [], pass: true },
    validator: { status: 'pass', pass: true, code: 0, out: '', note: 'A–O + J2；K 项本机无副本时跳过' },
    pass: true,
    skipped: false,
  };
  const { run, calls } = makeRun(() => ({ code: 0, out: JSON.stringify(report) }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ task: 'check', mod: 'curse' }, { signal: undefined });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, NODE_PATH);
  assert.deepEqual(calls[0].args, [path.join(toolsDir, 'cli.mjs'), 'check', 'curse', '--json']);
  assert.equal(calls[0].cwd, toolsDir);
  assert.equal(calls[0].timeoutMs, 180_000);
  assert.match(result.text, /检查 · task=check · mods: curse/);
  assert.ok(result.text.includes('curse  PASS  loc 122 条 / 0 errors / 0 warnings  validator PASS（A–O + J2；K 项本机无副本时跳过）'));
  assert.ok(result.text.includes('RESULT: PASS（退出码 0）'));
});

test('check：FAIL 渲染（loc 错误最多 8 条 + validator 尾部 12 行）', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const locFile = path.join(curse.snapshot, 'localization', 'simp_chinese', 'cn_curse_l_simp_chinese.yml');
  const errors = Array.from({ length: 10 }, (_unused, index) => ({
    file: locFile,
    line: 10 + index,
    key: `k${index}`,
    kind: index === 9 ? 'unbalanced $' : 'cross-lang: missing $VALUE$ (base english)',
  }));
  const validatorOut = Array.from({ length: 20 }, (_unused, index) => `校验器输出 ${index + 1}`).join('\n');
  const report = {
    mod: 'curse',
    label: '降祸 Bring Woe',
    command: 'check',
    loc: { files: 3, entries: 130, errors, warnings: [], pass: false },
    validator: { status: 'fail', pass: false, code: 1, out: validatorOut, note: '' },
    pass: false,
    skipped: false,
  };
  const { run } = makeRun(() => ({ code: 1, out: JSON.stringify(report) }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ task: 'check', mod: 'curse' });

  assert.ok(result.text.includes('curse  FAIL  loc 130 条 / 10 errors / 0 warnings  validator FAIL'));
  assert.ok(result.text.includes('loc 错误（前 8 / 共 10）：'));
  assert.ok(result.text.includes('localization/simp_chinese/cn_curse_l_simp_chinese.yml:10  k0  cross-lang: missing $VALUE$ (base english)'));
  assert.ok(!result.text.includes('  k9  '));
  assert.ok(result.text.includes('validator 输出尾部（12 行）：'));
  assert.ok(result.text.includes('校验器输出 20'));
  assert.ok(!result.text.includes('校验器输出 8'));
  assert.ok(result.text.includes('RESULT: FAIL（退出码 1）'));
});

test('check：未知 mod / 未知 task 报可执行的中文错误', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const dejure = makeMod(root, 'dejure');
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse, dejure] }));

  await assert.rejects(
    tool.execute({ task: 'check', mod: 'nope' }),
    /未知 mod：nope[\s\S]*可用：curse \/ dejure/,
  );
  await assert.rejects(
    tool.execute({ task: 'bogus' }),
    /未知 task：bogus[\s\S]*可用：check \/ loc \/ reverse \/ selftest/,
  );
});

test('check：JSON 解析兜底（切出前后噪声里的 JSON）', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const report = {
    mod: 'curse',
    label: '降祸 Bring Woe',
    command: 'loc',
    loc: { files: 3, entries: 122, errors: [], warnings: [], pass: true },
    pass: true,
  };
  const { run } = makeRun(() => ({
    code: 0,
    out: `ExperimentalWarning: 噪声一行\n${JSON.stringify(report, null, 2)}\n零散尾行\n`,
  }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ task: 'loc', mod: 'curse' });
  assert.ok(result.text.includes('检查 · task=loc · mods: curse'));
  assert.ok(result.text.includes('RESULT: PASS（退出码 0）'));
});

test('check：JSON 完全解析失败时报错并附输出尾部', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const { run } = makeRun(() => ({
    code: 2,
    out: 'Error: cli.mjs 自己炸了\n    at Object.<anonymous> (cli.mjs:12:3)',
  }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse], run }));

  await assert.rejects(
    tool.execute({ task: 'check', mod: 'curse' }),
    (error) => {
      assert.match(error.message, /无法解析 cli\.mjs 的 JSON 输出/);
      assert.match(error.message, /cli\.mjs/);
      assert.match(error.message, /at Object\.<anonymous>/);
      return true;
    },
  );
});

test('check：selftest 不读注册表也能跑', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const selftest = {
    command: 'selftest',
    pass: true,
    samples: 5,
    findings: 6,
    errors: [{ lang: 'english', key: 'bad_dollar', kind: 'unbalanced $' }],
  };
  const { run, calls } = makeRun(() => ({ code: 0, out: JSON.stringify(selftest) }));
  const deps = {
    ...makeDeps({ toolsDir, run }),
    getRegistry: async () => {
      throw new Error('selftest 不应该读注册表');
    },
  };
  const tool = checkTool(deps);

  const result = await tool.execute({ task: 'selftest' });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [path.join(toolsDir, 'cli.mjs'), 'selftest', '--json']);
  assert.equal(calls[0].cwd, toolsDir);
  assert.ok(result.text.includes('检查 · task=selftest'));
  assert.ok(result.text.includes('自检 PASS  坏样本 5 → 发现 6'));
  assert.ok(result.text.includes('english  bad_dollar  unbalanced $'));
  assert.ok(result.text.includes('RESULT: PASS（退出码 0）'));
});

test('check：reverse 逐 case 渲染', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const report = {
    mod: 'curse',
    label: '降祸 Bring Woe',
    command: 'reverse',
    reverse: {
      cases: [
        { name: 'loc 缺 $ 闭合', pass: true, found: ['unbalanced $'], count: 1 },
        { name: 'v1.0 旧包反例', pass: false, found: ['exit=1 problems=15 expected=16'], count: 1 },
      ],
      pass: false,
    },
    pass: false,
  };
  const { run, calls } = makeRun(() => ({ code: 1, out: JSON.stringify(report) }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ task: 'reverse', mod: 'curse' });

  assert.deepEqual(calls[0].args, [path.join(toolsDir, 'cli.mjs'), 'reverse', 'curse', '--json']);
  assert.ok(result.text.includes('curse  FAIL  reverse 1/2 cases'));
  assert.ok(result.text.includes('PASS  loc 缺 $ 闭合  unbalanced $'));
  assert.ok(result.text.includes('FAIL  v1.0 旧包反例  exit=1 problems=15 expected=16'));
  assert.ok(result.text.includes('RESULT: FAIL（退出码 1）'));
});

test('check：mod=all 传 --all 并汇总数组结果', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = makeMod(root, 'curse');
  const dejure = makeMod(root, 'dejure');
  const reports = [curse, dejure].map((mod) => ({
    mod: mod.id,
    label: mod.label,
    command: 'loc',
    loc: { files: 1, entries: 2, errors: [], warnings: [], pass: true },
    pass: true,
  }));
  const { run, calls } = makeRun(() => ({ code: 0, out: JSON.stringify(reports) }));
  const tool = checkTool(makeDeps({ toolsDir, mods: [curse, dejure], run }));

  const result = await tool.execute({ task: 'loc', mod: 'all' });

  assert.deepEqual(calls[0].args, [path.join(toolsDir, 'cli.mjs'), 'loc', '--all', '--json']);
  assert.ok(result.text.includes('检查 · task=loc · mods: curse, dejure'));
  assert.ok(result.text.includes('curse  PASS  loc 2 条 / 0 errors / 0 warnings'));
  assert.ok(result.text.includes('dejure  PASS  loc 2 条 / 0 errors / 0 warnings'));
  assert.ok(result.text.includes('RESULT: PASS（退出码 0）'));
});

test('check：共享 cli.mjs 缺失时报绝对路径', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = path.join(root, 'missing-tools');
  const tool = checkTool(makeDeps({ toolsDir, mods: [makeMod(root, 'curse')], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ task: 'check' }),
    (error) => {
      assert.match(error.message, /找不到共享校验入口/);
      assert.ok(error.message.includes(path.join(toolsDir, 'cli.mjs')));
      return true;
    },
  );
});

/* ============================== ck3mod_build ============================== */

test('build：pipeline 跳过缺失的规范化脚本并提示写盘风险', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    generate: true,
    normalize: false,
    flags: { generate: ['--check'] },
  });
  const { run, calls } = makeRun(() => ({ code: 0, out: '写入 descriptor.mod\n生成完成' }));
  const tool = buildTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ mod: 'curse', action: 'pipeline' });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [curse.scripts.generate]);
  assert.equal(calls[0].cwd, curse.repo);
  assert.equal(calls[0].timeoutMs, 120_000);
  assert.ok(result.text.includes('构建 · curse · action=pipeline（会写发布快照）'));
  assert.ok(result.text.includes('生成  PASS  退出码 0'));
  assert.ok(result.text.includes('写入 descriptor.mod'));
  assert.ok(result.text.includes('规范化  跳过（该 mod 没有 工具-规范化.mjs）'));
  assert.ok(result.text.includes('RESULT: PASS（退出码 0）'));
  assert.ok(result.text.includes('下一步：ck3mod_check mod=curse'));
  assert.ok(result.text.includes('会重写发布快照'));
});

test('build：generate-check 传 --check 且只读提示', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    generate: true,
    flags: { generate: ['--check'] },
  });
  const { run, calls } = makeRun(() => ({ code: 0, out: '✔ descriptor.mod' }));
  const tool = buildTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ mod: 'curse', action: 'generate-check' });

  assert.deepEqual(calls[0].args, [curse.scripts.generate, '--check']);
  assert.ok(result.text.includes('生成 --check  PASS  退出码 0'));
  assert.ok(result.text.includes('action=generate-check（--check 只读比对，不写盘）'));
  assert.ok(result.text.includes('说明：--check 只读比对'));
  assert.ok(!result.text.includes('会重写发布快照'));
});

test('build：两个流水线脚本都不存在时列出实际可用脚本', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const auto = makeMod(root, 'auto');
  writeFile(path.join(auto.repo, '工具-静态校验.mjs'), '// real validator\n');
  writeFile(path.join(auto.repo, 'README.md'), '# auto\n');
  const tool = buildTool(makeDeps({ toolsDir, mods: [auto], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ mod: 'auto', action: 'pipeline' }),
    (error) => {
      assert.match(error.message, /既没有 工具-生成\.mjs 也没有 工具-规范化\.mjs/);
      assert.match(error.message, /可用的是：工具-静态校验\.mjs/);
      return true;
    },
  );
});

test('build：失败即停，失败步贴 20 行尾部', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    generate: true,
    normalize: true,
    flags: { generate: ['--check'], normalize: ['--check'] },
  });
  const longOutput = Array.from({ length: 25 }, (_unused, index) => `L${String(index + 1).padStart(2, '0')} 某行`).join('\n');
  const { run, calls } = makeRun(() => ({ code: 1, out: longOutput }));
  const tool = buildTool(makeDeps({ toolsDir, mods: [curse], run }));

  const result = await tool.execute({ mod: 'curse', action: 'pipeline' });

  assert.equal(calls.length, 1, '生成失败后不应再跑规范化');
  assert.ok(result.text.includes('生成  FAIL  退出码 1'));
  assert.ok(result.text.includes('输出尾部（20 行）：'));
  assert.ok(result.text.includes('L25 某行'));
  assert.ok(!result.text.includes('L05 某行'));
  assert.ok(result.text.includes('规范化  跳过（生成 失败，未执行）'));
  assert.ok(result.text.includes('RESULT: FAIL（退出码 1）'));
});

test('build：mod 必填且只能是单个 id', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), { generate: true });
  const tool = buildTool(makeDeps({ toolsDir, mods: [curse], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ mod: 'all', action: 'pipeline' }),
    /ck3mod_build 一次只能处理一个 mod[\s\S]*可用：curse/,
  );
  await assert.rejects(
    tool.execute({ mod: 'nope', action: 'generate' }),
    /未知 mod：nope[\s\S]*可用：curse/,
  );
});

/* ============================== ck3mod_deploy ============================= */

test('deploy：action 映射 --check / --clean 与目标路径渲染', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    deploy: true,
    flags: { deploy: ['--allow-launcher-rewrite', '--check', '--clean', '--prune'] },
  });
  const { run, calls } = makeRun(() => ({ code: 0, out: '结果：一致 6 / 不一致 0' }));
  const tool = deployTool(makeDeps({ toolsDir, mods: [curse], run }));

  const checked = await tool.execute({ mod: 'curse', action: 'check' });
  const cleaned = await tool.execute({ mod: 'curse', action: 'clean' });

  assert.deepEqual(calls[0].args, [curse.scripts.deploy, '--check']);
  assert.deepEqual(calls[1].args, [curse.scripts.deploy, '--clean']);
  assert.equal(calls[0].cwd, curse.repo);
  assert.equal(calls[0].timeoutMs, 120_000);
  assert.ok(checked.text.includes('部署 · curse · action=check'));
  assert.ok(checked.text.includes(`内层目标：${curse.deployDir}`));
  assert.ok(checked.text.includes(`外层 .mod：${curse.deployMod}`));
  assert.ok(checked.text.includes('说明：--check 只比对，不写盘'));
  assert.ok(checked.text.includes('退出码：0'));
  assert.ok(checked.text.includes('输出尾部（15 行）：'));
  assert.ok(checked.text.includes('RESULT: PASS'));
  assert.ok(cleaned.text.includes('部署 · curse · action=clean'));
  assert.ok(cleaned.text.includes('清理范围：上面两项'));
  assert.ok(cleaned.text.includes('本机副本与工坊订阅版不要同时启用'));
  assert.ok(cleaned.text.includes('测完用 action=clean 清场'));
});

test('deploy：默认 deploy 不传开关；prune / allowLauncherRewrite 追加参数', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    deploy: true,
    flags: { deploy: ['--allow-launcher-rewrite', '--check', '--clean', '--prune'] },
  });
  const { run, calls } = makeRun(() => ({ code: 0, out: '部署完成' }));
  const tool = deployTool(makeDeps({ toolsDir, mods: [curse], run }));

  const plain = await tool.execute({ mod: 'curse' });
  const extra = await tool.execute({ mod: 'curse', action: 'deploy', prune: true, allowLauncherRewrite: true });

  assert.deepEqual(calls[0].args, [curse.scripts.deploy]);
  assert.deepEqual(calls[1].args, [curse.scripts.deploy, '--prune', '--allow-launcher-rewrite']);
  assert.ok(plain.text.includes('部署 · curse · action=deploy'));
  assert.ok(plain.text.includes('参数：（无）'));
  assert.ok(extra.text.includes('参数：--prune --allow-launcher-rewrite'));
});

test('deploy：未探测到的开关直接报错', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const free = capable(makeMod(root, 'free'), {
    deploy: true,
    flags: { deploy: ['--check'] },
  });
  const tool = deployTool(makeDeps({ toolsDir, mods: [free], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ mod: 'free', action: 'deploy', prune: true }),
    /该 mod 的部署脚本不支持 --prune（free 支持：--check）/,
  );
  await assert.rejects(
    tool.execute({ mod: 'free', action: 'clean' }),
    /该 mod 的部署脚本不支持 --clean（free 支持：--check）/,
  );
});

test('deploy：没有部署脚本时报路径、可用脚本与手工流程提示', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const auto = capable(makeMod(root, 'auto'), { deploy: false, flags: { deploy: [] } });
  writeFile(path.join(auto.repo, '工具-静态校验.mjs'), '// real validator\n');
  const tool = deployTool(makeDeps({ toolsDir, mods: [auto], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ mod: 'auto', action: 'deploy' }),
    (error) => {
      assert.match(error.message, /该 mod 没有 工具-部署\.mjs/);
      assert.ok(error.message.includes(path.join(auto.repo, '工具-部署.mjs')));
      assert.match(error.message, /可用的是：工具-静态校验\.mjs/);
      assert.match(error.message, /README/);
      return true;
    },
  );
});

test('deploy：一次只能处理一个 mod', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const curse = capable(makeMod(root, 'curse'), {
    deploy: true,
    flags: { deploy: ['--check', '--clean'] },
  });
  const dejure = capable(makeMod(root, 'dejure'), {
    deploy: true,
    flags: { deploy: ['--check', '--clean'] },
  });
  const tool = deployTool(makeDeps({ toolsDir, mods: [curse, dejure], run: async () => okNoOutput() }));

  await assert.rejects(
    tool.execute({ mod: 'all' }),
    /ck3mod_deploy 一次只能处理一个 mod[\s\S]*可用：curse \/ dejure/,
  );
});

/* ================================ 元数据 ================================= */

test('三个工具都声明中文描述、输出形状、超时与并发标志', (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const deps = makeDeps({ toolsDir, mods: [makeMod(root, 'curse')] });

  const check = checkTool(deps);
  assert.equal(check.name, 'ck3mod_check');
  assert.equal(check.timeoutMs, 200_000);
  assert.equal(check.isConcurrencySafe(), true);
  assert.match(check.description, /[\u4e00-\u9fa5]/);
  assert.deepEqual(check.parameters.properties.task.enum, ['check', 'loc', 'reverse', 'selftest']);
  assert.equal(check.parameters.properties.mod.type, 'string');
  assert.equal(check.output.schema.properties.text.type, 'string');

  const build = buildTool(deps);
  assert.equal(build.name, 'ck3mod_build');
  assert.equal(build.timeoutMs, 140_000);
  assert.equal(build.isConcurrencySafe(), false);
  assert.match(build.description, /[\u4e00-\u9fa5]/);
  assert.deepEqual(build.parameters.required, ['mod']);
  assert.deepEqual(build.parameters.properties.action.enum, [
    'generate', 'generate-check', 'normalize', 'normalize-check', 'pipeline',
  ]);

  const deploy = deployTool(deps);
  assert.equal(deploy.name, 'ck3mod_deploy');
  assert.equal(deploy.timeoutMs, 140_000);
  assert.equal(deploy.isConcurrencySafe(), false);
  assert.match(deploy.description, /[\u4e00-\u9fa5]/);
  assert.deepEqual(deploy.parameters.required, ['mod']);
  assert.deepEqual(deploy.parameters.properties.action.enum, ['deploy', 'check', 'clean']);
  assert.equal(deploy.parameters.properties.prune.type, 'boolean');
  assert.equal(deploy.parameters.properties.allowLauncherRewrite.type, 'boolean');
});
