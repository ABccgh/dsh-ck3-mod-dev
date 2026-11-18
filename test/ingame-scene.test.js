import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '工具-真机现场.mjs');

/** 本文件建过的临时根目录；跑完统一删，别在 %TEMP% 里留 `ck3-scene-*`。 */
const created = [];
after(() => {
  for (const root of created) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * 跑一次 CLI。测试统一跳过进程检查，避免依赖「当前没开游戏」。
 * @param {string[]} args 参数。
 * @returns {{ code: number, out: string }} 结果。
 */
function run(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CK3_SCENE_SKIP_PROCESS_CHECK: '1' },
  });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** 造一个假用户目录。`presets.txt` 故意不存在，用来测「会话期间新建要删掉」。 */
function makeUserDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-scene-'));
  created.push(root);
  const userDir = path.join(root, 'user');
  fs.mkdirSync(path.join(userDir, 'save games'), { recursive: true });
  fs.mkdirSync(path.join(userDir, 'mod'), { recursive: true });
  fs.mkdirSync(path.join(userDir, 'player', 'game_rules'), { recursive: true });
  fs.writeFileSync(path.join(userDir, 'dlc_load.json'), '{"enabled_mods":[],"disabled_dlcs":[]}');
  fs.writeFileSync(path.join(userDir, 'pdx_settings.txt'), 'settings-v1');
  fs.writeFileSync(path.join(userDir, 'last_save.ck3'), Buffer.from('LAST'));
  fs.writeFileSync(path.join(userDir, 'continue_game.json'), '{"save":"x"}');
  fs.writeFileSync(path.join(userDir, 'save games', 'autosave.ck3'), Buffer.from('AUTO1'));
  fs.writeFileSync(path.join(userDir, 'save games', 'autosave_2.ck3'), Buffer.from('AUTO2'));
  fs.writeFileSync(path.join(userDir, 'mod', 'cn_curse.mod'), 'name="curse"');
  return { root, userDir, tempRoot: path.join(root, 'temp') };
}

/** @param {string} userDir @returns {string} 目录。 */
function savesDir(userDir) {
  return path.join(userDir, 'save games');
}

test('begin：快照全部文件并改写播放集', () => {
  const { userDir, tempRoot } = makeUserDir();
  const { code, out } = run(['--begin', '--mods', 'cn_curse', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(code, 0, out);
  const playset = fs.readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8');
  assert.equal(playset, '{"enabled_mods":["mod/cn_curse.mod"],"disabled_dlcs":[]}');
  const current = JSON.parse(fs.readFileSync(path.join(tempRoot, 'current.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(current.sessionDir, 'manifest.json'), 'utf8'));
  const existed = manifest.files.filter((f) => f.existed).map((f) => f.rel).sort();
  assert.deepEqual(existed, [
    'continue_game.json',
    'dlc_load.json',
    'last_save.ck3',
    'pdx_settings.txt',
    path.join('save games', 'autosave.ck3'),
    path.join('save games', 'autosave_2.ck3'),
  ].sort());
  const presets = manifest.files.find((f) => f.rel.endsWith('presets.txt'));
  assert.equal(presets.existed, false);
});

test('begin：不带 --mods 时不动播放集', () => {
  const { userDir, tempRoot } = makeUserDir();
  const { code, out } = run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(code, 0, out);
  assert.equal(fs.readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8'), '{"enabled_mods":[],"disabled_dlcs":[]}');
});

test('begin：有未结束现场时拒绝', () => {
  const { userDir, tempRoot } = makeUserDir();
  assert.equal(run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  const second = run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(second.code, 1);
  assert.match(second.out, /已有未结束的现场/);
});

test('begin：缺本机 mod 副本时报可执行错误', () => {
  const { userDir, tempRoot } = makeUserDir();
  const { code, out } = run(['--begin', '--mods', 'nope', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(code, 1);
  assert.match(out, /缺少本机 mod 副本/);
});

test('check：改动快照文件后报漂移', () => {
  const { userDir, tempRoot } = makeUserDir();
  assert.equal(run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  fs.writeFileSync(path.join(userDir, 'pdx_settings.txt'), 'settings-v2');
  const { code, out } = run(['--check', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(code, 1);
  assert.match(out, /pdx_settings\.txt/);
});

test('end：按字节还原、隔离新存档、删除会话期间新建的文件', () => {
  const { userDir, tempRoot } = makeUserDir();
  assert.equal(run(['--begin', '--mods', 'cn_curse', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  const current = JSON.parse(fs.readFileSync(path.join(tempRoot, 'current.json'), 'utf8'));

  fs.writeFileSync(path.join(savesDir(userDir), 'autosave.ck3'), Buffer.from('OVERWRITTEN'));
  fs.writeFileSync(path.join(savesDir(userDir), 'autosave_1.ck3'), Buffer.from('NEW'));
  fs.writeFileSync(path.join(userDir, 'player', 'game_rules', 'presets.txt'), 'created-during-session');

  const { code, out } = run(['--end', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(code, 0, out);

  assert.equal(fs.readFileSync(path.join(savesDir(userDir), 'autosave.ck3'), 'utf8'), 'AUTO1');
  assert.equal(fs.readFileSync(path.join(savesDir(userDir), 'autosave_2.ck3'), 'utf8'), 'AUTO2');
  assert.equal(fs.existsSync(path.join(savesDir(userDir), 'autosave_1.ck3')), false);
  assert.equal(fs.readFileSync(path.join(current.sessionDir, 'new-saves', 'autosave_1.ck3'), 'utf8'), 'NEW');
  assert.equal(fs.existsSync(path.join(userDir, 'player', 'game_rules', 'presets.txt')), false);
  assert.equal(fs.readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8'), '{"enabled_mods":[],"disabled_dlcs":[]}');
  assert.equal(fs.existsSync(path.join(tempRoot, 'current.json')), false);
});

test('end 之后 check 报「没有活动现场」；clean 删除现场目录', () => {
  const { userDir, tempRoot } = makeUserDir();
  assert.equal(run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  assert.equal(run(['--end', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  const check = run(['--check', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(check.code, 0, check.out);
  assert.match(check.out, /没有活动的现场/);

  const clean = run(['--clean', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(clean.code, 0, clean.out);
  assert.equal(fs.existsSync(tempRoot), false);
});

test('clean：有活动现场时拒绝', () => {
  const { userDir, tempRoot } = makeUserDir();
  assert.equal(run(['--begin', '--user-dir', userDir, '--temp-dir', tempRoot]).code, 0);
  const clean = run(['--clean', '--user-dir', userDir, '--temp-dir', tempRoot]);
  assert.equal(clean.code, 1);
  assert.match(clean.out, /先 --end/);
});
