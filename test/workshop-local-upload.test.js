/**
 * `ck3mod_workshop` 的本机副本 / 首传 / 更新 / ugc 断言（2026-11-21 reto S13–S17 落点）。
 *
 * 全部离线：临时目录造三份 descriptor，不读真实工坊、不联网、不启动进程。
 *
 * @module @local/ck3moddev/test/workshop-local-upload
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { normalizeConfig } from '../lib/config.js';
import { workshopTool } from '../lib/tools/workshop.js';

const FIXED_NOW = () => new Date('2026-11-21T12:00:00Z');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 临时目录。
 * @param {import('node:test').TestContext} t 上下文。
 * @returns {string} 目录。
 */
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3mod-ws-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * 写文本（自动建父目录）。
 * @param {string} file 文件。
 * @param {string} content 内容。
 * @returns {string} 文件。
 */
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** 512×512 的最小 PNG 头。 */
function makePng() {
  const buffer = Buffer.alloc(33);
  Buffer.from(PNG_SIGNATURE).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'latin1');
  buffer.writeUInt32BE(512, 16);
  buffer.writeUInt32BE(512, 20);
  return buffer;
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
 * descriptor 文本。
 * @param {{ id?: string, version?: string, supported?: string }} options 字段。
 * @returns {string} 文本。
 */
function descriptorText(options = {}) {
  const { id = '', version = '1.0', supported = '1.21.*' } = options;
  const lines = [
    `version="${version}"`,
    'tags={',
    '\t"Gameplay"',
    '}',
    'name="测试 Mod"',
    'picture="thumbnail.png"',
    `supported_version="${supported}"`,
  ];
  if (id !== '') lines.push(`remote_file_id="${id}"`);
  return lines.join('\n');
}

/**
 * 夹具：快照内层/外层 + 可选本机副本 + 可选 ugc。
 * @param {import('node:test').TestContext} t 上下文。
 * @param {{ id?: string, local?: boolean, localId?: string, localSupported?: string, ugc?: boolean }} [options] 变体。
 * @returns {{ config: any, mod: any }} 夹具。
 */
function fixture(t, options = {}) {
  const {
    id = '3813133358',
    local = false,
    localId = id,
    localSupported = '1.21.0',
    ugc = false,
  } = options;
  const config = makeConfig(t);
  const repo = path.join(config.workspaceRoot, 'ck3-test');
  const snapshot = path.join(repo, 'cn_test-v1.0', 'cn_test');
  write(path.join(snapshot, 'descriptor.mod'), descriptorText({ id }));
  write(`${snapshot}.mod`, descriptorText({ id }));
  fs.writeFileSync(path.join(snapshot, 'thumbnail.png'), makePng());
  write(path.join(repo, '工坊描述-BBCode.txt'), 'x'.repeat(100));

  const deployDir = path.join(config.modsDir, 'cn_test');
  const deployMod = path.join(config.modsDir, 'cn_test.mod');
  if (local) {
    fs.mkdirSync(deployDir, { recursive: true });
    write(deployMod, descriptorText({ id: localId, supported: localSupported }));
  }
  if (ugc) write(path.join(config.modsDir, `ugc_${id}.mod`), 'name="x"');

  return {
    config,
    mod: {
      id: 'test',
      label: '测试 Mod',
      repo,
      snapshot,
      folder: 'cn_test',
      workshopDescription: path.join(repo, '工坊描述-BBCode.txt'),
      deployDir,
      deployMod,
      capabilities: {},
    },
  };
}

/**
 * 造工具。
 * @param {any} config 配置。
 * @param {any} mod mod。
 * @returns {any} 工具。
 */
function makeTool(config, mod) {
  return workshopTool({
    config,
    getRegistry: async () => ({ mods: new Map([[mod.id, mod]]), ids: [mod.id], source: 'test' }),
    now: FIXED_NOW,
  });
}

test('workshop：本机副本缺失只提示、不拖成 WARN', async (t) => {
  const { config, mod } = fixture(t);
  const { text } = await makeTool(config, mod).execute({ mod: 'test' });

  assert.match(text, /本机副本：缺失/);
  assert.match(text, /上传前置：启动器「上传 Mod」只列/);
  assert.match(text, /先 ck3mod_deploy mod=test/);
  assert.match(text, /不要点「创建 MOD」/);
  assert.match(text, /结论：PASS/, text);
});

test('workshop：三份 ID 全空时明确首传、上传后回填 META', async (t) => {
  const { config, mod } = fixture(t, { id: '' });
  const { text } = await makeTool(config, mod).execute({ mod: 'test' });

  assert.match(text, /remote_file_id 为空：上传会新建一个工坊条目，且不可撤销/);
  assert.match(text, /三份 descriptor 都没有 ID，这是首传/);
  assert.match(text, /回填 数据-元数据\.mjs 的 remoteFileId/);
  assert.match(text, /结论：WARN .*首传会新建工坊条目/);
});

test('workshop：本机 supported_version 被 launcher 回写时按字段豁免', async (t) => {
  const { config, mod } = fixture(t, { local: true, localSupported: '1.21.0' });
  const { text } = await makeTool(config, mod).execute({ mod: 'test' });

  assert.match(text, /supported_version 1\.21\.\* \/ 1\.21\.0（launcher 回写，按字段豁免/);
  assert.doesNotMatch(text, /字段对比：不一致/);
  assert.match(text, /结论：PASS/, text);
});

test('workshop：真不一致仍报 WARN（version 1.0 vs 2.0）', async (t) => {
  const { config, mod } = fixture(t, { local: true });
  write(mod.deployMod, descriptorText({ id: '3813133358', version: '2.0', supported: '1.21.0' }));
  const { text } = await makeTool(config, mod).execute({ mod: 'test' });

  assert.match(text, /字段对比：不一致/);
  assert.match(text, /version：/);
  assert.match(text, /结论：WARN .*descriptor 字段不一致/);
});

test('workshop：ugc 存在/缺失与 SKIP 行', async (t) => {
  const missing = fixture(t);
  const missingText = (await makeTool(missing.config, missing.mod).execute({ mod: 'test' })).text;
  assert.match(missingText, /ugc_3813133358\.mod 缺失（需在启动器订阅）/);
  assert.match(missingText, /精确 file_size \/ 工坊页面内容：SKIP/);

  const present = fixture(t, { ugc: true });
  const presentText = (await makeTool(present.config, present.mod).execute({ mod: 'test' })).text;
  assert.match(presentText, /ugc_3813133358\.mod 存在/);
});

test('workshop：全部 mod 都没有本机副本时给「无可用 Mod」提示', async (t) => {
  const { config, mod } = fixture(t);
  const { text } = await makeTool(config, mod).execute({ mod: 'test' });

  assert.match(text, /本机 mod 目录里没有可上传的副本——启动器「上传 Mod」会显示「无可用 Mod」/);
});
