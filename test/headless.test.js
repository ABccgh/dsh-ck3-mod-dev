import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildDlcLoadBytes,
  clearPending,
  recoverInterrupted,
  runHeadless,
  sha256,
} from '../lib/headless.js';

/**
 * 造一个临时「用户目录 + 游戏目录 + 本机 mod 副本」。
 * @returns {Record<string, any>} 路径集合与原始 dlc_load 字节。
 */
function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3mod-headless-test-'));
  const userDir = path.join(root, 'user');
  const logDir = path.join(userDir, 'logs');
  const modsDir = path.join(userDir, 'mod');
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(modsDir, { recursive: true });

  const gameRoot = path.join(root, 'game');
  fs.mkdirSync(path.join(gameRoot, 'binaries'), { recursive: true });
  const gameExe = path.join(gameRoot, 'binaries', 'ck3.exe');
  fs.writeFileSync(gameExe, '');

  const deployDir = path.join(modsDir, 'cn_curse');
  fs.mkdirSync(deployDir, { recursive: true });
  const deployMod = path.join(modsDir, 'cn_curse.mod');
  fs.writeFileSync(deployMod, 'name="x"');

  const originalBytes = Buffer.from('{"enabled_mods":["mod/ugc_1.mod"],"disabled_dlcs":[]}', 'utf8');
  fs.writeFileSync(path.join(userDir, 'dlc_load.json'), originalBytes);

  return {
    root,
    userDir,
    logDir,
    modsDir,
    gameRoot,
    gameExe,
    deployDir,
    deployMod,
    originalBytes,
    tempDir: path.join(root, 'temp'),
    dlcLoad: path.join(userDir, 'dlc_load.json'),
  };
}

/**
 * 造生效配置。
 * @param {ReturnType<typeof makeWorkspace>} ws - 工作区。
 * @returns {Record<string, any>} 配置。
 */
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

/**
 * 造 mod 描述。
 * @param {ReturnType<typeof makeWorkspace>} ws - 工作区。
 * @returns {Record<string, any>} mod。
 */
function makeMod(ws) {
  return {
    id: 'curse',
    label: '降祸 Bring Woe',
    folder: 'cn_curse',
    enabledEntry: 'mod/cn_curse.mod',
    deployDir: ws.deployDir,
    deployMod: ws.deployMod,
  };
}

/** 只处理 tasklist 的 `run`；游戏启动走 `launch`。 */
function tasklistRun() {
  return async (spec) => {
    if (spec.command === 'tasklist') return { code: 1, out: '' };
    throw new Error(`测试里不应该用 run 启动游戏：${spec.command}`);
  };
}

/**
 * 造 fake launch：写日志并返回运行结果。
 * @param {ReturnType<typeof makeWorkspace>} ws - 工作区。
 * @param {{
 *   errorLines?: string[],
 *   enabledLine?: string,
 *   withHistory?: boolean,
 *   writeLogs?: boolean,
 *   code?: number,
 *   timedOut?: boolean,
 *   stoppedAfterHistory?: boolean,
 *   seen?: string[],
 * }} [options] - 行为选项。
 * @returns {(spec: any) => Promise<any>} fake launch。
 */
function fakeLaunch(ws, options = {}) {
  const errorLines = options.errorLines ?? [];
  const enabledLine = options.enabledLine ?? '降祸 Bring Woe|mod/cn_curse.mod|Enabled';
  return async () => {
    options.seen?.push(fs.readFileSync(ws.dlcLoad, 'utf8'));
    if (options.writeLogs !== false) {
      fs.writeFileSync(path.join(ws.logDir, 'error.log'), errorLines.join('\n'));
      const debugLines = [`${enabledLine}`, `[21:10:19][D][virtualfilesystem_physfs.cpp:814]: Mounted Data: ${ws.deployDir}`];
      if (options.withHistory !== false) {
        debugLines.push('[21:53:13][D][history.cpp:1497]: Start loading of history');
        debugLines.push('[21:53:13][I][gamestate.cpp:1096]: Start running through history.');
      }
      fs.writeFileSync(path.join(ws.logDir, 'debug.log'), debugLines.join('\n'));
    }
    return {
      code: options.code ?? 0,
      signal: null,
      timedOut: options.timedOut ?? false,
      stoppedAfterHistory: options.stoppedAfterHistory ?? false,
      aborted: false,
      durationSec: 12.3,
    };
  };
}

test('无头：只启用本 mod，到达 history 且正常退出 → PASS，按字节还原', async () => {
  const ws = makeWorkspace();
  const seen = [];
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, { seen }),
    now: () => new Date(),
    timeoutSec: 30,
    tempDir: ws.tempDir,
  });

  assert.equal(result.verdict, 'PASS');
  assert.equal(seen.length, 1);
  assert.deepEqual(JSON.parse(seen[0]).enabled_mods, ['mod/cn_curse.mod']);

  const after = fs.readFileSync(ws.dlcLoad);
  assert.deepEqual(after, ws.originalBytes);
  assert.equal(sha256(after), sha256(ws.originalBytes));
  assert.equal(fs.existsSync(path.join(ws.tempDir, 'pending.json')), false);
  assert.match(result.text, /还原：dlc_load\.json SHA256 一致/);
  assert.match(result.text, /加载：已到 Start running through history/);
  assert.match(result.text, /结论：PASS/);
});

test('无头：本 mod 报错 → FAIL，但仍按字节还原', async () => {
  const ws = makeWorkspace();
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, {
      errorLines: ['[21:10:24][E][x.cpp:1]: bad thing in cn_curse', '[21:10:25][E][y.cpp:2]: unrelated'],
    }),
    now: () => new Date(),
    timeoutSec: 30,
    tempDir: ws.tempDir,
  });

  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.modErrors, 1);
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
  assert.match(result.text, /其中本 mod 1 条/);
});

test('无头：到达 history 后挂住 → WARN（加载期干净），仍还原', async () => {
  const ws = makeWorkspace();
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, {
      stoppedAfterHistory: true,
      errorLines: ['[21:53:13][E][log.cpp:31]: Instance has not been created!'],
    }),
    now: () => new Date(),
    timeoutSec: 30,
    tempDir: ws.tempDir,
  });

  assert.equal(result.verdict, 'WARN');
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
  assert.match(result.text, /到达 history 后未自行退出/);
  assert.match(result.text, /本机既有记录/);
});

test('无头：没到 history 就超时 → FAIL，并还原', async () => {
  const ws = makeWorkspace();
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch: fakeLaunch(ws, { timedOut: true, withHistory: false, writeLogs: false }),
    now: () => new Date(),
    timeoutSec: 30,
    tempDir: ws.tempDir,
  });

  assert.equal(result.verdict, 'FAIL');
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
  assert.match(result.text, /未到 history/);
});

test('无头：启动器在跑时拒绝执行，不写任何字节', async () => {
  const ws = makeWorkspace();
  const run = async (spec) => {
    if (spec.command === 'tasklist') {
      return String(spec.args?.[1] ?? '').includes('dowser')
        ? { code: 0, out: '"dowser.exe","1234","Console","1","10,000 K"' }
        : { code: 1, out: '' };
    }
    throw new Error('不应该启动游戏');
  };
  const launch = async () => {
    throw new Error('不应该启动游戏');
  };

  await assert.rejects(
    runHeadless({ config: makeConfig(ws), mod: makeMod(ws), run, launch, now: () => new Date(), timeoutSec: 30, tempDir: ws.tempDir }),
    /这些进程正在运行：dowser\.exe/,
  );
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
  assert.equal(fs.existsSync(path.join(ws.tempDir, 'pending.json')), false);
});

test('无头：本机没有 mod 副本时拒绝执行', async () => {
  const ws = makeWorkspace();
  fs.rmSync(ws.deployDir, { recursive: true, force: true });

  await assert.rejects(
    runHeadless({
      config: makeConfig(ws),
      mod: makeMod(ws),
      run: tasklistRun(),
      launch: fakeLaunch(ws),
      now: () => new Date(),
      timeoutSec: 30,
      tempDir: ws.tempDir,
    }),
    /本机没有 curse 的 mod 副本/,
  );
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
});

test('无头：enableGameLaunch=false 时拒绝执行', async () => {
  const ws = makeWorkspace();
  const config = { ...makeConfig(ws), enableGameLaunch: false };

  await assert.rejects(
    runHeadless({
      config,
      mod: makeMod(ws),
      run: tasklistRun(),
      launch: fakeLaunch(ws),
      now: () => new Date(),
      timeoutSec: 30,
      tempDir: ws.tempDir,
    }),
    /已禁用启动游戏/,
  );
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
});

test('无头：baseline=true 时跑两轮并给出基线对照', async () => {
  const ws = makeWorkspace();
  const seen = [];
  const launch = fakeLaunch(ws, { seen });
  const result = await runHeadless({
    config: makeConfig(ws),
    mod: makeMod(ws),
    run: tasklistRun(),
    launch,
    now: () => new Date(),
    timeoutSec: 30,
    baseline: true,
    tempDir: ws.tempDir,
  });

  assert.equal(seen.length, 2);
  assert.deepEqual(JSON.parse(seen[0]).enabled_mods, ['mod/cn_curse.mod']);
  assert.deepEqual(JSON.parse(seen[1]).enabled_mods, []);
  assert.match(result.text, /基线对照/);
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), ws.originalBytes);
});

test('恢复：pending 存在时先救回原始 dlc_load.json', () => {
  const ws = makeWorkspace();
  const original = ws.originalBytes;
  fs.mkdirSync(ws.tempDir, { recursive: true });
  fs.writeFileSync(
    path.join(ws.tempDir, 'pending.json'),
    JSON.stringify({
      version: 1,
      mod: 'curse',
      folder: 'cn_curse',
      at: new Date().toISOString(),
      dlcLoadPath: ws.dlcLoad,
      sha256: sha256(original),
      originalBase64: original.toString('base64'),
      backupPath: path.join(ws.tempDir, 'backup.json'),
    }),
  );
  fs.writeFileSync(ws.dlcLoad, buildDlcLoadBytes(['mod/cn_curse.mod']));

  const recovered = recoverInterrupted(ws.tempDir);
  assert.equal(recovered.restored, true);
  assert.deepEqual(fs.readFileSync(ws.dlcLoad), original);
  assert.equal(fs.existsSync(path.join(ws.tempDir, 'pending.json')), false);
});

test('恢复：pending 损坏时报错而不是猜', () => {
  const ws = makeWorkspace();
  fs.mkdirSync(ws.tempDir, { recursive: true });
  fs.writeFileSync(path.join(ws.tempDir, 'pending.json'), '{not json');
  assert.throws(() => recoverInterrupted(ws.tempDir), /pending 标记损坏/);
  clearPending(ws.tempDir);
});
