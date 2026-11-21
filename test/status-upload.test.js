/**
 * `ck3mod_status` 的上传 ID / ugc / mod 目录计数（2026-11-21 reto S13–S17 落点）。
 *
 * 全部 hermetic：临时用户目录 + 假注册表，不读真实游戏安装、不跑 git 以外的进程。
 *
 * @module @local/ck3moddev/test/status-upload
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { normalizeConfig } from '../lib/config.js';
import { statusTool } from '../lib/tools/status.js';

/**
 * 临时目录。
 * @param {import('node:test').TestContext} t 上下文。
 * @returns {string} 目录。
 */
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3mod-status-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * 写文件（自动建父目录）。
 * @param {string} file 文件。
 * @param {string} [content] 内容。
 * @returns {void}
 */
function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/**
 * 配置。
 * @param {import('node:test').TestContext} t 上下文。
 * @returns {any} 配置。
 */
function makeConfig(t) {
  const root = tempDir(t);
  return normalizeConfig({
    workspaceRoot: root,
    toolsDir: path.join(root, 'tools'),
    gameRoot: path.join(root, 'steamapps', 'common', 'ck3'),
    userDir: path.join(root, 'user'),
    maxOutputChars: 12_000,
  });
}

/**
 * 造一个已上传的 mod（含快照内层/外层 descriptor）。
 * @param {any} config 配置。
 * @param {{ id?: string, version?: string }} [options] 变体。
 * @returns {any} mod。
 */
function makeMod(config, options = {}) {
  const { id = '3813133358', version = '1.0' } = options;
  const repo = path.join(config.workspaceRoot, 'ck3-test');
  const snapshot = path.join(repo, 'cn_test-v1.0', 'cn_test');
  const body = [
    `version="${version}"`,
    'tags={',
    '\t"Gameplay"',
    '}',
    'name="测试 Mod"',
    'supported_version="1.21.*"',
    ...(id === '' ? [] : [`remote_file_id="${id}"`]),
  ].join('\n');
  write(path.join(snapshot, 'descriptor.mod'), body);
  write(`${snapshot}.mod`, body);
  return {
    id: 'test',
    label: '测试 Mod',
    repo,
    snapshot,
    folder: 'cn_test',
    deployDir: path.join(config.modsDir, 'cn_test'),
    deployMod: path.join(config.modsDir, 'cn_test.mod'),
    capabilities: {},
  };
}

/**
 * 造 status 工具。
 * @param {any} config 配置。
 * @param {any[]} mods mod 列表。
 * @returns {any} 工具。
 */
function makeTool(config, mods) {
  return statusTool({
    config,
    getRegistry: async () => ({ mods: new Map(mods.map((mod) => [mod.id, mod])), ids: mods.map((mod) => mod.id), source: 'test' }),
    getNode: () => ({ path: 'C:\\fake\\node.exe', source: 'test' }),
    run: async (spec) => {
      if (Array.isArray(spec.args) && spec.args.includes('--version')) return { code: 0, out: 'v24.0.0' };
      return { code: 0, out: '## main\n' };
    },
    now: () => new Date('2026-11-21T12:00:00Z'),
  });
}

test('status：已上传 + ugc 存在 + 本机副本缺失', async (t) => {
  const config = makeConfig(t);
  const mod = makeMod(config);
  write(path.join(config.modsDir, 'ugc_3813133358.mod'), 'name="x"');
  const { text } = await makeTool(config, [mod]).execute({ mod: 'all' });

  assert.match(text, /工坊：已上传 3813133358 · ugc_3813133358\.mod 存在/);
  assert.match(text, /mod 目录：1 条（本机副本 0 \/ ugc_\*\.mod 1）/);
  assert.match(text, /建议：先跑 ck3mod_check mod=all/);
  assert.match(text, /提示：本机没有 mod 副本/);
});

test('status：未上传与 ugc 缺失都给可执行提示', async (t) => {
  const config = makeConfig(t);
  const mod = makeMod(config, { id: '3813133358' });
  const { text } = await makeTool(config, [mod]).execute({ mod: 'all' });

  assert.match(text, /工坊：已上传 3813133358 · ugc_3813133358\.mod 缺失（需在启动器订阅）/);

  const unuploaded = makeMod(config, { id: '' });
  const second = await makeTool(config, [unuploaded]).execute({ mod: 'all' });
  assert.match(second.text, /工坊：未上传（三份 descriptor 的 remote_file_id 都为空；首传会新建条目）/);
});
