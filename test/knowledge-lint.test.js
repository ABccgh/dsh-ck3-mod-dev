import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(REPO, '工具-知识层检查.mjs');
const SKILL_REL = path.join('skills', 'ck3-modding', 'SKILL.md');
const NOTES_REL = path.join('skills', 'ck3-modding', 'references', 'verified-notes.md');
const RUNBOOK_REL = path.join('skills', 'ck3-modding', 'references', 'ingame-acceptance.md');
const PATCH_REL = 'cordis.patch.yml';

/** 本文件建过的临时根目录；跑完统一删，别在 %TEMP% 里留 `ck3-lint-*`。 */
const created = [];
after(() => {
  for (const root of created) fs.rmSync(root, { recursive: true, force: true });
});

/**
 * 造一份「当前仓库的副本」：只复制 lint 需要的三样（package.json / README.md / skills）。
 * 用真实内容做基线，避免测试里再抄一份断言清单。
 * @returns {string} 临时仓库根。
 */
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-lint-'));
  created.push(root);
  for (const rel of ['package.json', 'README.md', PATCH_REL, 'skills']) {
    fs.cpSync(path.join(REPO, rel), path.join(root, rel), { recursive: true });
  }
  return root;
}

/**
 * 跑一次 CLI。
 * @param {string[]} args 参数。
 * @returns {{ code: number, out: string }} 结果。
 */
function run(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** @param {string} root 仓库根。 @param {string} rel 相对路径。 @returns {string} 文本。 */
function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

/** @param {string} root 仓库根。 @param {string} rel 相对路径。 @param {string} text 文本。 @returns {void} */
function write(root, rel, text) {
  fs.writeFileSync(path.join(root, rel), text);
}

/** @param {string} root 仓库根。 @returns {string} 不存在的路径（保证不存在）。 */
function missing(root) {
  return path.join(root, 'not-installed');
}

test('真实知识层副本通过（--no-deploy）', () => {
  const { code, out } = run(['--repo', makeRepo(), '--no-deploy']);
  assert.equal(code, 0, out);
  assert.match(out, /知识层检查通过/);
});

test('删掉硬规则 26 报 SKILL/rules', () => {
  const root = makeRepo();
  write(root, SKILL_REL, read(root, SKILL_REL).replace(/^26\. \*\*.*$/m, ''));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[SKILL\/rules\]/);
  assert.match(out, /应为 1–29/);
});

test('改掉 Q5 的锚点句时报 Q5', () => {
  const root = makeRepo();
  write(root, NOTES_REL, read(root, NOTES_REL).replaceAll('形状对了就不再 −1', '形状随便'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[Q5\]/);
});

test('人格层缺判断句时报 PERSONA', () => {
  const root = makeRepo();
  write(root, PATCH_REL, read(root, PATCH_REL).replaceAll('功能移除也要机器可证', '随便'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[PERSONA\]/);
  assert.match(out, /缺 1 句/);
});

test('人格层写回版本枚举时报 PERSONA', () => {
  const root = makeRepo();
  write(root, PATCH_REL, read(root, PATCH_REL).replace('别在这里背版本号', '版本记牢：free 4.1'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[PERSONA\]/);
  assert.match(out, /版本枚举/);
});

test('References 漏掉 11-18c 时报 REFS', () => {
  const root = makeRepo();
  write(root, SKILL_REL, read(root, SKILL_REL).replaceAll('retro-2026-11-18c-ck3mod-dejure-v2.3.md', 'retro-x.md'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[REFS\]/);
});

test('--list-anchors 总数与期望一致、复盘编号有落点', () => {
  const { code, out } = run(['--list-anchors']);
  assert.equal(code, 0, out);
  const matched = /锚点：(\d+) 条 \/ \d+ 个编号（期望 (\d+)）/.exec(out);
  assert.ok(matched, out);
  assert.equal(Number(matched[1]), Number(matched[2]), out);
  for (const id of ['Q1', 'Q12', 'P1', 'P24', 'H7', 'CLI']) {
    assert.match(out, new RegExp(`^  ${id} \\d+$`, 'm'), `缺少 ${id} 的锚点`);
  }
});

test('package.json 与 README 版本不一致报 VERSION', () => {
  const root = makeRepo();
  const pkg = JSON.parse(read(root, 'package.json'));
  pkg.version = '9.9.9';
  write(root, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[VERSION\]/);
  assert.match(out, /README/);
});

test('复盘锚点被改掉时报对应编号', () => {
  const root = makeRepo();
  write(root, NOTES_REL, read(root, NOTES_REL).replaceAll('96,074', '96,999'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[C1\]/);
  assert.match(out, /96,074/);
});

test('runbook 的坐标系数被改掉时报 P9', () => {
  const root = makeRepo();
  write(root, RUNBOOK_REL, read(root, RUNBOOK_REL).replaceAll('1.1241', '9.9999'));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[P9\]/);
});

test('删掉 [verify] 节报 NOTES/sections', () => {
  const root = makeRepo();
  write(root, NOTES_REL, read(root, NOTES_REL).replace(/^## \[verify\].*$/m, ''));
  const { code, out } = run(['--repo', root, '--no-deploy']);
  assert.equal(code, 1, out);
  assert.match(out, /\[NOTES\/sections\]/);
});

test('部署副本缺失只提示、不算失败', () => {
  const root = makeRepo();
  const { code, out } = run([
    '--repo', root,
    '--deploy', missing(root),
    '--bundle', missing(root),
  ]);
  assert.equal(code, 0, out);
  assert.match(out, /提示 \[DEPLOY\/skill\]/);
  assert.match(out, /提示 \[DEPLOY\/bundle\]/);
});

test('部署副本存在但不一致报 DEPLOY/skill', () => {
  const root = makeRepo();
  const deploy = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-lint-deploy-'));
  created.push(deploy);
  const { code, out } = run([
    '--repo', root,
    '--deploy', deploy,
    '--bundle', missing(root),
  ]);
  assert.equal(code, 1, out);
  assert.match(out, /\[DEPLOY\/skill\]/);
  assert.match(out, /部署副本缺/);
});

test('--help 退出 0', () => {
  const { code, out } = run(['--help']);
  assert.equal(code, 0, out);
  assert.match(out, /用法: node 工具-知识层检查\.mjs/);
});

test('未知参数退出 1', () => {
  const { code, out } = run(['--bogus']);
  assert.equal(code, 1, out);
  assert.match(out, /未知参数/);
});
