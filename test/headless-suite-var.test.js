import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

import { runHeadless } from '../lib/headless.js';
import { logsTool } from '../lib/tools/logs.js';

/** 造过的临时工作区；跑完统一删。 */
const created = [];
after(() => {
  for (const dir of created) fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * 临时工作区：用户目录 + 游戏 exe + 本机 mod 副本 + dlc_load。
 * @returns {Record<string, any>} 路径集合。
 */
function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3mod-suite-var-'));
  created.push(root);
  const userDir = path.join(root, 'user');
  const logDir = path.join(userDir, 'logs');
  const modsDir = path.join(userDir, 'mod');
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(modsDir, { recursive: true });

  const gameRoot = path.join(root, 'game');
  fs.mkdirSync(path.join(gameRoot, 'binaries'), { recursive: true });
  const gameExe = path.join(gameRoot, 'binaries', 'ck3.exe');
  fs.writeFileSync(gameExe, '');

  const deployDir = path.join(modsDir, 'cn_test');
  fs.mkdirSync(deployDir, { recursive: true });
  const deployMod = path.join(modsDir, 'cn_test.mod');
  fs.writeFileSync(deployMod, 'name="x"');

  fs.writeFileSync(
    path.join(userDir, 'dlc_load.json'),
    '{"enabled_mods":["mod/ugc_1.mod"],"disabled_dlcs":[]}',
  );

  return {
    root,
    userDir,
    logDir,
    modsDir,
    gameRoot,
    gameExe,
    deployDir,
    deployMod,
    tempDir: path.join(root, 'temp'),
    dlcLoad: path.join(userDir, 'dlc_load.json'),
  };
}

/** @param {ReturnType<typeof makeWorkspace>} ws 工作区。 @returns {Record<string, any>} 配置。 */
function makeConfig(ws) {
  return {
    userDir: ws.userDir,
    logDir: ws.logDir,
    modsDir: ws.modsDir,
    gameRoot: ws.gameRoot,
    gameExe: ws.gameExe,
    enableGameLaunch: true,
    headlessTimeoutSec: 60,
    maxOutputChars: 12_000,
    allowGlobalToolPrefixes: ['ck3wiki_', 'steam_'],
  };
}

/** @param {ReturnType<typeof makeWorkspace>} ws 工作区。 @returns {Record<string, any>} mod。 */
function makeMod(ws) {
  return {
    id: 'test',
    label: '测试 Mod',
    folder: 'cn_test',
    enabledEntry: 'mod/cn_test.mod',
    deployDir: ws.deployDir,
    deployMod: ws.deployMod,
  };
}

/** 只处理 tasklist 的 run。 */
function tasklistRun() {
  return async (spec) => {
    if (spec.command === 'tasklist') return { code: 1, out: '' };
    throw new Error(`测试里不应该用 run 启动游戏：${spec.command}`);
  };
}

/**
 * fake launch：写日志并返回运行结果。
 * @param {ReturnType<typeof makeWorkspace>} ws 工作区。
 * @param {string[]} errorLines error.log 行。
 * @returns {(spec: any) => Promise<any>} fake launch。
 */
function fakeLaunch(ws, errorLines) {
  return async () => {
    fs.writeFileSync(path.join(ws.logDir, 'error.log'), errorLines.join('\n'));
    fs.writeFileSync(
      path.join(ws.logDir, 'debug.log'),
      [
        '测试 Mod|mod/cn_test.mod|Enabled',
        `[21:10:19][D][virtualfilesystem_physfs.cpp:814]: Mounted Data: ${ws.deployDir}`,
        '[21:53:13][I][gamestate.cpp:1096]: Start running through history.',
      ].join('\n'),
    );
    return {
      code: 0,
      signal: null,
      timedOut: false,
      stoppedAfterHistory: false,
      aborted: false,
      durationSec: 12.3,
    };
  };
}

/**
 * 在「本机副本」里写一个设置全局变量的脚本。
 * @param {ReturnType<typeof makeWorkspace>} ws 工作区。
 * @param {string} name 变量名。
 * @returns {void}
 */
function writeVariableScript(ws, name) {
  const file = path.join(ws.deployDir, 'common', 'on_action', 'zz_test_on_action.txt');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    'zz_test_marker = {\n\teffect = {\n\t\tset_global_variable = { name = ' + name + ' }\n\t}\n}\n',
    'utf8',
  );
}

test('无头：变量 set but never used 计入本 mod 报错并判 FAIL', async () => {
  const ws = makeWorkspace();
  writeVariableScript(ws, 'cn_test_marker');
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, [
      "[21:10:24][E][jomini_effect.cpp:1151]: Variable 'cn_test_marker' is set but is never used",
    ]),
    now: () => new Date(),
    timeoutSec: 60,
  });

  assert.equal(result.verdict, 'FAIL', result.text);
  assert.equal(result.modErrors, 1, result.text);
  assert.match(result.text, /其中 suite 变量未使用 1/);
  assert.match(result.text, /cn_test_marker/);
});

test('无头：没有未使用变量时输出与旧口径一致', async () => {
  const ws = makeWorkspace();
  writeVariableScript(ws, 'cn_test_marker');
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, []),
    now: () => new Date(),
    timeoutSec: 60,
  });

  assert.equal(result.verdict, 'PASS', result.text);
  assert.match(result.text, /其中本 mod 0 条/);
  assert.doesNotMatch(result.text, /suite 变量未使用/);
});

test('无头：本机副本缺目录时变量扫描不炸（返回空列表）', async () => {
  const ws = makeWorkspace();
  fs.rmSync(path.join(ws.deployDir), { recursive: true, force: true });
  fs.rmSync(ws.deployMod, { force: true });
  await assert.rejects(
    runHeadless({
      config: makeConfig(ws),
      mod: makeMod(ws),
      run: tasklistRun(),
      launch: fakeLaunch(ws, []),
      now: () => new Date(),
      timeoutSec: 60,
    }),
    /本机没有 test 的 mod 副本/,
  );
});

test('logs：全局变量未使用单列，变量名并入 token 过滤', async () => {
  const ws = makeWorkspace();
  writeVariableScript(ws, 'cn_test_marker');
  fs.writeFileSync(
    path.join(ws.logDir, 'error.log'),
    "[21:10:24][E][jomini_effect.cpp:1151]: Variable 'cn_test_marker' is set but is never used\n",
  );
  const mod = makeMod(ws);
  const tool = logsTool({
    config: makeConfig(ws),
    getRegistry: async () => ({ mods: new Map([[mod.id, mod]]), ids: [mod.id], source: 'test' }),
    now: () => new Date(0),
  });

  const result = await tool.execute({ file: 'error', mod: 'test' });
  assert.match(result.text, /全局变量未使用：1 条/);
  assert.match(result.text, /jomini_effect\.cpp:1151/);
  assert.match(result.text, /cn_test_marker/);
  assert.match(result.text, /token：cn_test \/ 测试 Mod \/ cn_test_marker/);
});
