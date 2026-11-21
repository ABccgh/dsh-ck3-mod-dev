/**
 * `ck3mod_deploy` 的冒烟 extra 归因与 `--prune` 提示（2026-11-21 reto S21–S28 落点）。
 *
 * 全部 hermetic：fake `run` 返回部署脚本的预设输出，不写真实 mod 目录。
 *
 * @module @local/ck3moddev/test/deploy-prune
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { deployTool } from '../lib/tools/deploy.js';

const NODE_PATH = 'C:\\fake-node\\node.exe';

/** @param {import('node:test').TestContext} t 上下文。 @returns {string} 临时根。 */
function makeTempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3moddev-deploy-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/**
 * 写文件（自动建父目录）。
 * @param {string} file 文件。
 * @param {string} [text] 内容。
 * @returns {void}
 */
function writeFile(file, text = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

/**
 * 假共享工具目录。
 * @param {string} root 临时根。
 * @returns {string} toolsDir。
 */
function makeToolsDir(root) {
  const toolsDir = path.join(root, 'ck3-modding-tools');
  writeFile(path.join(toolsDir, 'cli.mjs'), '// fake cli\n');
  return toolsDir;
}

/**
 * 注册表形状的 mod。
 * @param {string} root 临时根。
 * @param {string} id id。
 * @param {string} folder 内层文件夹名。
 * @param {string[]} deployFlags 部署脚本支持的开关。
 * @returns {any} mod。
 */
function makeMod(root, id, folder, deployFlags) {
  const repo = path.join(root, `repo-${id}`);
  fs.mkdirSync(repo, { recursive: true });
  return {
    id,
    label: `${id} 标签`,
    repo,
    snapshot: path.join(repo, `${folder}-v1.0`, folder),
    folder,
    scripts: { deploy: path.join(repo, '工具-部署.mjs') },
    capabilities: { deploy: true, flags: { generate: [], normalize: [], deploy: deployFlags } },
    deployDir: path.join(root, 'mods', folder),
    deployMod: path.join(root, 'mods', `${folder}.mod`),
  };
}

/**
 * deps。
 * @param {string} toolsDir tools 目录。
 * @param {any[]} mods mod 列表。
 * @param {(spec: any) => { code: number, out: string }} handler run。
 * @returns {any} deps。
 */
function makeDeps(toolsDir, mods, handler) {
  return {
    config: { workspaceRoot: path.dirname(toolsDir), toolsDir, modsDir: path.join(path.dirname(toolsDir), 'mods'), maxOutputChars: 12_000 },
    getRegistry: async () => ({
      toolsDir,
      mods: new Map(mods.map((mod) => [mod.id, mod])),
      ids: mods.map((mod) => mod.id),
      source: path.join(toolsDir, 'configs.mjs'),
    }),
    getNode: () => ({ path: NODE_PATH, source: 'test' }),
    run: async (spec) => handler(spec),
    now: () => new Date('2026-11-21T12:00:00Z'),
  };
}

test('deploy：请求 --prune 而脚本不支持时给出 clean 提示', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const mod = makeMod(root, 'free', 'free_resources', ['--check']);
  const tool = deployTool(makeDeps(toolsDir, [mod], () => ({ code: 0, out: '' })));

  await assert.rejects(
    tool.execute({ mod: 'free', prune: true }),
    (error) => {
      assert.match(error.message, /该 mod 的部署脚本不支持 --prune/);
      assert.match(error.message, /先 action=clean 再 deploy/);
      return true;
    },
  );
});

test('deploy：本机多出文件时归因到合并副本冒烟（core）', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const core = makeMod(root, 'core', 'cn_dejure_core', ['--check', '--clean']);
  const organizer = makeMod(root, 'organizer', 'cn_dejure_organizer', ['--check', '--clean']);
  const tool = deployTool(makeDeps(toolsDir, [core, organizer], () => ({
    code: 1,
    out: '部署完成\n本地多出文件（未处理）：common/scripted_effects/cn_dejure_core_effects.txt\n',
  })));

  const result = await tool.execute({ mod: 'organizer' });
  assert.match(result.text, /归因：输出里提到「多出文件」/);
  assert.match(result.text, /疑似合并副本冒烟遗留（来自 core \/ cn_dejure_core）/);
  assert.match(result.text, /先 action=clean 再 deploy/);
  assert.match(result.text, /RESULT: FAIL/);
});

test('deploy：普通失败不误归因，仍保留脚本尾部与 FAIL', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const mod = makeMod(root, 'organizer', 'cn_dejure_organizer', ['--check', '--clean']);
  const tool = deployTool(makeDeps(toolsDir, [mod], () => ({
    code: 1,
    out: '不一致 2 项\n内容不一致：common/decisions/x.txt\n',
  })));

  const result = await tool.execute({ mod: 'organizer' });
  assert.doesNotMatch(result.text, /疑似合并副本冒烟遗留/);
  assert.match(result.text, /不一致 2 项/);
  assert.match(result.text, /RESULT: FAIL/);
});

test('deploy：成功时 RESULT 仍为 PASS（二值契约不变）', async (t) => {
  const root = makeTempRoot(t);
  const toolsDir = makeToolsDir(root);
  const mod = makeMod(root, 'organizer', 'cn_dejure_organizer', ['--check', '--clean']);
  const tool = deployTool(makeDeps(toolsDir, [mod], () => ({ code: 0, out: '一致 6 / 不一致 0' })));

  const result = await tool.execute({ mod: 'organizer', action: 'check' });
  assert.match(result.text, /RESULT: PASS/);
  assert.doesNotMatch(result.text, /归因：/);
});
