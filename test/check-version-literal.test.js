/**
 * `ck3mod_check` 的脚本卫生提示与可读报错（2026-11-21 reto S21–S28 落点）。
 *
 * 全部 hermetic：fake `run` 直接返回 cli.mjs 的 JSON，临时仓库里放校验器脚本供 lint 读。
 *
 * @module @local/ck3moddev/test/check-version-literal
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkTool } from '../lib/tools/check.js';

const NODE_PATH = 'C:\\fake-node\\node.exe';

/** @param {import('node:test').TestContext} t 上下文。 @returns {string} 临时根。 */
function makeTempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3moddev-check-'));
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
 * mod + 临时仓库 + 可选校验器源码。
 * @param {string} root 临时根。
 * @param {{ validator?: string, reverse?: string }} [scripts] 脚本内容。
 * @returns {any} mod。
 */
function makeMod(root, scripts = {}) {
  const repo = path.join(root, 'repo-organizer');
  fs.mkdirSync(repo, { recursive: true });
  const mod = {
    id: 'organizer',
    label: '法理整顿',
    repo,
    snapshot: path.join(repo, 'cn_dejure_organizer-v1.3', 'cn_dejure_organizer'),
    folder: 'cn_dejure_organizer',
    scripts: {
      validator: path.join(repo, '工具-静态校验.mjs'),
      reverse: path.join(repo, '工具-反向验证.mjs'),
    },
    capabilities: {},
    deployDir: path.join(root, 'mods', 'cn_dejure_organizer'),
    deployMod: path.join(root, 'mods', 'cn_dejure_organizer.mod'),
  };
  if (scripts.validator !== undefined) writeFile(mod.scripts.validator, scripts.validator);
  if (scripts.reverse !== undefined) writeFile(mod.scripts.reverse, scripts.reverse);
  return mod;
}

/**
 * 造 check 工具。
 * @param {string} root 临时根。
 * @param {any} mod mod。
 * @param {(spec: any) => { code: number, out: string }} handler run。
 * @returns {any} 工具。
 */
function makeTool(root, mod, handler) {
  const toolsDir = path.join(root, 'ck3-modding-tools');
  writeFile(path.join(toolsDir, 'cli.mjs'), '// fake cli\n');
  return checkTool({
    config: { workspaceRoot: root, toolsDir, modsDir: path.join(root, 'mods'), maxOutputChars: 12_000 },
    getRegistry: async () => ({ toolsDir, mods: new Map([[mod.id, mod]]), ids: [mod.id], source: 'test' }),
    getNode: () => ({ path: NODE_PATH, source: 'test' }),
    run: async (spec) => handler(spec),
    now: () => new Date('2026-11-21T12:00:00Z'),
  });
}

/** @param {any} mod mod。 @param {Record<string, unknown>} extra 额外字段。 @returns {string} JSON。 */
function reportJson(mod, extra) {
  return JSON.stringify({ mod: mod.id, label: mod.label, command: 'check', loc: null, pass: true, ...extra });
}

test('check：硬编码快照目录不存在时给卫生提示（不影响 PASS）', async (t) => {
  const root = makeTempRoot(t);
  const mod = makeMod(root, {
    validator: "const p = path.join(HERE, '..', 'ck3-de-jure-core', 'cn_dejure_core-v9.9', 'x.txt');\n",
  });
  const tool = makeTool(root, mod, () => ({ code: 0, out: reportJson(mod, { validator: { status: 'pass', pass: true, code: 0, out: '' } }) }));

  const result = await tool.execute({ task: 'check', mod: 'organizer' }, { signal: undefined });
  assert.match(result.text, /脚本卫生提示（不影响 PASS\/FAIL）/);
  assert.match(result.text, /硬编码快照目录「cn_dejure_core-v9\.9」在本机不存在/);
  assert.match(result.text, /RESULT: PASS/);
});

test('check：version 字面量提示，但 .replace 的变异样本不误报', async (t) => {
  const root = makeTempRoot(t);
  const mod = makeMod(root, {
    validator: 'if (src.includes(\'version="1.2"\')) { /* stale */ }\n',
    reverse: "patch(f, (s) => s.replace(/^version=\"[^\"]+\"/m, 'version=\"9.9\"'));\n",
  });
  const tool = makeTool(root, mod, () => ({ code: 0, out: reportJson(mod, { validator: { status: 'pass', pass: true, code: 0, out: '' } }) }));

  const result = await tool.execute({ task: 'check', mod: 'organizer' }, { signal: undefined });
  assert.match(result.text, /硬编码 version="1\.2"/);
  assert.doesNotMatch(result.text, /硬编码 version="9\.9"/);
});

test('check：校验器 ReferenceError 给可读结论与 --root 复现命令', async (t) => {
  const root = makeTempRoot(t);
  const mod = makeMod(root, { validator: '// broken\n' });
  const out = 'ReferenceError: exists is not defined\n    at file:///x/工具-静态校验.mjs:1:1\n';
  const tool = makeTool(root, mod, () => ({
    code: 1,
    out: reportJson(mod, { pass: false, validator: { status: 'fail', pass: false, code: 1, out } }),
  }));

  const result = await tool.execute({ task: 'check', mod: 'organizer' }, { signal: undefined });
  assert.match(result.text, /校验器自检失败（不是 mod 脚本的问题）/);
  assert.match(result.text, /ReferenceError: exists is not defined/);
  assert.match(result.text, /工具-静态校验\.mjs --root/);
  assert.match(result.text, /RESULT: FAIL/);
});

test('check：反向验证失败时提示 expect 可能过期', async (t) => {
  const root = makeTempRoot(t);
  const mod = makeMod(root, { reverse: '// noop\n' });
  const report = {
    mod: mod.id,
    label: mod.label,
    command: 'reverse',
    pass: false,
    reverse: { cases: [{ name: 'core snapshot', pass: false, count: 0 }] },
  };
  const tool = makeTool(root, mod, () => ({ code: 1, out: JSON.stringify(report) }));

  const result = await tool.execute({ task: 'reverse', mod: 'organizer' }, { signal: undefined });
  assert.match(result.text, /反向样本或 ck3-modding-tools\/configs\.mjs 的 expect 可能过期/);
  assert.match(result.text, /反向验证\.mjs/);
});
