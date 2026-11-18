#!/usr/bin/env node
/**
 * 知识层 lint：把复盘（`.admin/retro-2026-11-18-ck3mod.md`）的映射表变成**可执行断言**。
 *
 * 为什么需要：复盘里的教训如果只写成规则，下一次改文档时删掉一条也没人知道——这正是 H7
 * 「写进清单的问题只有变成机器检查才算处理」。这个脚本把 A1…E3、H1–H7 的落点、硬规则编号、
 * 各节标题、版本口径、部署副本哈希都变成断言，跑一次即知映射是否断裂。
 *
 * 检查分五组：
 *   1. SKILL.md 硬规则：编号必须是 1..N 连续、无缺号无重号（N 与 EXPECTED_RULE_COUNT 一致）；
 *   2. 三份知识层文件的必需节（SKILL / verified-notes / ingame-acceptance）；
 *   3. 复盘映射锚点：每条编号对应的关键句必须还在原文件里（删了 = 复盘落地断链）；
 *   4. 版本口径：package.json / README 顶部 / README §13 最新条目 / SKILL metadata 互相一致；
 *   5. 部署副本：仓库 vs `~/.agents/skills/ck3-modding` vs `~/dsh-bundles/ck3moddev` 的哈希。
 *
 * 用法：
 *   $node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
 *   & $node .\工具-知识层检查.mjs              # 全部检查；部署副本缺失只给提示，不算失败
 *   & $node .\工具-知识层检查.mjs --no-deploy  # 只查知识层内容（没装 bundle 时用）
 *   & $node .\工具-知识层检查.mjs --repo D:\tmp\fixture   # 换仓库根（测试用）
 *
 * 退出码：0 = 全过；1 = 有失败项（提示项不算）。
 *
 * @module dsh-ck3-mod-dev/工具-知识层检查
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = path.dirname(fileURLToPath(import.meta.url));
const SKILL_REL = path.join('skills', 'ck3-modding');
const DEPLOY_DEFAULT = path.join(os.homedir(), '.agents', 'skills', 'ck3-modding');
const BUNDLE_DEFAULT = path.join(os.homedir(), 'dsh-bundles', 'ck3moddev');

/** 硬规则的期望条数。新增规则时**先改这里**，让「改了数字」成为一次有意识的动作。 */
const EXPECTED_RULE_COUNT = 20;

/** bundle 安装副本里参与比对的关键文件（其余是运行时无关文件）。 */
const BUNDLE_FILES = [
  'package.json',
  'cordis.patch.yml',
  'README.md',
  path.join('locale', 'en.json'),
  path.join('locale', 'zh.json'),
  path.join('lib', 'index.js'),
];

const SKILL_FILE = path.join(SKILL_REL, 'SKILL.md');
const NOTES_FILE = path.join(SKILL_REL, 'references', 'verified-notes.md');
const RUNBOOK_FILE = path.join(SKILL_REL, 'references', 'ingame-acceptance.md');

/** SKILL.md 必须有的二级标题。 */
const SKILL_SECTIONS = [
  '## When to use',
  '## Read first (in this order)',
  '## Environment',
  '## 1.21 变化（大版本迁移必读）',
  '## 查资料：三层真相',
  '## Shared checker (candidates 1/3)',
  '## Native tools (agent preset「CK3 模组开发」)',
  '## Per-mod pipeline',
  '## 覆盖与兼容（四个 mod 都靠这套边界活着）',
  '## 真机验收（in-game acceptance）',
  '## Hard rules',
  '## Verification layers',
  '## References',
];

/** verified-notes.md 必须有的分节（14 组实测要点）。 */
const NOTES_SECTIONS = [
  '## 1.21 改名与「patch note ≠ 实机名」',
  '## [interaction] 角色互动（character interaction）',
  '## [cb] 宣战理由（casus belli）',
  '## [government] 政体（government）',
  '## [resources] 资源 / 虔诚档位',
  '## [council] 议会（council）',
  '## [story] 故事循环（story cycle）',
  '## [struggle] 斗争（struggle）',
  '## [district] 地产 / 区划（district）',
  '## [trade] 贸易 / 市场 / 商业共和国',
  '## [road] 道路（road）',
  '## [laws] 法律（law）',
  '## [ingame] 真机验收（启动参数 / 存档 / 1.21 UI）',
  '## [automation] 真机自动化（agent 代点，2026-11-18 实跑 free v4.1）',
  '## [release] 发布与工坊核对（2026-11-18 free v4.0 → v4.1）',
];

/** ingame-acceptance.md 必须有的节（含 §9 机器代点）。 */
const RUNBOOK_SECTIONS = [
  '## 0. 什么时候必须跑',
  '## 1. 三条铁律',
  '## 2. 准备（五步，全部在开游戏之前）',
  '## 3. 启动',
  '## 4. 四个 mod 的验收矩阵',
  '### 4.1 curse（降祸）',
  '### 4.4 auto（自动传播）',
  '## 5. 证据规范',
  '## 6. 收尾（六步，顺序不能换）',
  '## 7. 判定边界',
  '## 8. 1.21 已知事实（先看再验）',
  '## 9. 机器代点（仅在用户当次明确要求时）',
  '### 9.1 前提（三步，缺一不可）',
  '### 9.2 五个动作（PowerShell，user32）',
  '### 9.3 探针 mod 模板（不点菜单就能截到面板）',
  '### 9.4 能自动 / 不能自动（free v4.1 实测）',
  '### 9.5 证据',
];

/**
 * 复盘映射锚点：`id` 就是复盘里的编号，`needle` 必须原样出现在 `file` 里。
 * 删掉任何一条 = 复盘落地断链；改文档时要么保留句子，要么连锚点一起改。
 * @type {Array<{ id: string, file: string, needle: string, label: string }>}
 */
const ANCHORS = [
  { id: 'A1', file: NOTES_FILE, needle: 'build_queue_reserve_categories', label: 'H/H2 机器判据' },
  { id: 'A1', file: SKILL_FILE, needle: '新版本上手第一件事', label: '环境段判据入口' },
  { id: 'A2', file: SKILL_FILE, needle: 'Wiki 不是语法真相', label: '层 2 优先' },
  { id: 'B1', file: NOTES_FILE, needle: 'genInnerDescriptor()', label: 'descriptor 由表生成' },
  { id: 'B2', file: NOTES_FILE, needle: 'buildInnerDir', label: '快照路径表导出' },
  { id: 'B3', file: NOTES_FILE, needle: '别在校验器里留一遍', label: '不做重复逐字节循环' },
  { id: 'B4', file: NOTES_FILE, needle: '校验器自己也会过期', label: '断言不写死版本' },
  { id: 'B4', file: NOTES_FILE, needle: 'META.supportedVersion', label: '容差由 META 推' },
  { id: 'C1', file: NOTES_FILE, needle: '96,074', label: '启动器回写 −1 字节' },
  { id: 'C2', file: NOTES_FILE, needle: 'GetPublishedFileDetails', label: '工坊详情 POST API' },
  { id: 'C3', file: NOTES_FILE, needle: '自己上传的条目不会出现在', label: '自上传不进工坊副本' },
  { id: 'C4', file: NOTES_FILE, needle: '上传前先 deploy', label: '上传前先部署' },
  { id: 'D1', file: NOTES_FILE, needle: 'Raw Input', label: '全屏吞注入输入' },
  { id: 'D2', file: NOTES_FILE, needle: '键盘打不通', label: '键盘注入失败' },
  { id: 'D3', file: NOTES_FILE, needle: 'SetProcessDPIAware()', label: 'DPI-aware 坐标' },
  { id: 'D4', file: SKILL_FILE, needle: 'on_actions = { my_action }', label: 'on_action 只能追加' },
  { id: 'D5', file: NOTES_FILE, needle: 'debug_log', label: 'debug_log 不解析数据函数' },
  { id: 'D6', file: NOTES_FILE, needle: '-play=<title>', label: '-play 不锁定头衔' },
  { id: 'D7', file: NOTES_FILE, needle: '重建现场', label: '加 mod 要重建现场' },
  { id: 'D8', file: NOTES_FILE, needle: '要求本机副本存在', label: '无头前先 deploy' },
  { id: 'D9', file: NOTES_FILE, needle: '能自动 / 不能自动', label: '能力清单' },
  { id: 'E1', file: SKILL_FILE, needle: '无头只验加载期', label: '静态+无头 ≠ 功能正确' },
  { id: 'E2', file: SKILL_FILE, needle: '先快照，后开游戏', label: '用户数据保护' },
  { id: 'E3', file: NOTES_FILE, needle: 'JPEG q82', label: '证据压缩入库' },
  { id: 'H1', file: SKILL_FILE, needle: '前提先于功能', label: 'H1/H2/H3 归并' },
  { id: 'H4', file: SKILL_FILE, needle: '有意产物', label: 'H4 判据区分' },
  { id: 'H5', file: SKILL_FILE, needle: '包裹结构', label: 'H5/H6 抄片段' },
  { id: 'H7', file: SKILL_FILE, needle: '工具-知识层检查.mjs', label: 'H7 已检查化' },
];

/**
 * 读一个仓库内文件；不存在返回 null。
 * @param {string} repo 仓库根。
 * @param {string} rel 相对路径。
 * @returns {string | null} 文本。
 */
function readText(repo, rel) {
  const file = path.join(repo, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** @param {string} file 路径。 @returns {string} SHA256 十六进制。 */
function hashFile(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * 列出一棵目录下的所有文件（相对路径，用 / 分隔）。
 * @param {string} root 目录。
 * @returns {string[]} 排序后的相对路径。
 */
function listFiles(root) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir 当前目录。 @param {string} prefix 相对前缀。 */
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  if (fs.existsSync(root)) walk(root, '');
  return out.sort();
}

function parseArgs(argv) {
  const options = {
    repo: SELF,
    deploy: DEPLOY_DEFAULT,
    bundle: BUNDLE_DEFAULT,
    checkDeploy: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') options.repo = path.resolve(argv[(i += 1)]);
    else if (arg === '--deploy') options.deploy = path.resolve(argv[(i += 1)]);
    else if (arg === '--bundle') options.bundle = path.resolve(argv[(i += 1)]);
    else if (arg === '--no-deploy') options.checkDeploy = false;
    else if (arg === '--help' || arg === '-h') {
      console.log('用法: node 工具-知识层检查.mjs [--repo <dir>] [--deploy <dir>] [--bundle <dir>] [--no-deploy]');
      console.log(`默认仓库：${SELF}`);
      console.log(`默认部署副本：${DEPLOY_DEFAULT}`);
      console.log(`默认 bundle 副本：${BUNDLE_DEFAULT}`);
      process.exit(0);
    } else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

/**
 * 检查结果收集器。
 * @returns {{ errors: Array<{ id: string, message: string }>, notes: Array<{ id: string, message: string }>, passed: number }} 结果。
 */
function createReport() {
  return { errors: [], notes: [], passed: 0 };
}

/**
 * 记一条失败。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} id 断言编号。
 * @param {string} message 说明。
 * @returns {void}
 */
function fail(report, id, message) {
  report.errors.push({ id, message });
}

/**
 * 记一条通过。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @returns {void}
 */
function pass(report) {
  report.passed += 1;
}

/**
 * 某文件里必须出现的字面量。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @param {{ id: string, file: string, needle: string, label: string }} anchor 锚点。
 * @returns {void}
 */
function checkAnchor(report, repo, anchor) {
  const text = readText(repo, anchor.file);
  if (text === null) {
    fail(report, anchor.id, `缺文件 ${anchor.file}`);
    return;
  }
  if (!text.includes(anchor.needle)) {
    fail(report, anchor.id, `${anchor.file}：缺「${anchor.needle}」（${anchor.label}）`);
    return;
  }
  pass(report);
}

/**
 * 检查硬规则编号：1..EXPECTED_RULE_COUNT 连续、无缺号无重号。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} text SKILL.md 文本。
 * @returns {void}
 */
function checkRuleNumbers(report, text) {
  const section = /## Hard rules([\s\S]*?)## Verification layers/.exec(text);
  if (section === null) {
    fail(report, 'SKILL/rules', '找不到 Hard rules 段（或 Verification layers 段头）');
    return;
  }
  const numbers = [...section[1].matchAll(/^(\d+)\. \*\*/gm)].map((m) => Number(m[1]));
  const expected = Array.from({ length: EXPECTED_RULE_COUNT }, (_, i) => i + 1);
  const same = numbers.length === expected.length && numbers.every((n, i) => n === expected[i]);
  if (!same) {
    fail(
      report,
      'SKILL/rules',
      `硬规则编号应为 1–${EXPECTED_RULE_COUNT}，实际 ${numbers.length} 条：${numbers.join(',') || '（无）'}`,
    );
    return;
  }
  pass(report);
}

/**
 * 检查一份文本里的必需标题。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @param {string} rel 文件相对路径。
 * @param {string[]} headings 必需标题。
 * @param {string} id 断言编号。
 * @returns {void}
 */
function checkHeadings(report, repo, rel, headings, id) {
  const text = readText(repo, rel);
  if (text === null) {
    fail(report, id, `缺文件 ${rel}`);
    return;
  }
  const missing = headings.filter((heading) => !text.includes(heading));
  if (missing.length > 0) {
    fail(report, id, `${rel}：缺 ${missing.length} 节 —— ${missing.join(' / ')}`);
    return;
  }
  pass(report);
}

/**
 * 版本口径：package.json / README 顶部 / README §13 最新条目 / SKILL metadata 互相一致。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @returns {void}
 */
function checkVersions(report, repo) {
  let version = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
    version = typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    fail(report, 'VERSION', 'package.json 读不出或不是合法 JSON');
    return;
  }
  if (version === null) {
    fail(report, 'VERSION', 'package.json 缺 version');
    return;
  }
  const readme = readText(repo, 'README.md');
  if (readme === null) {
    fail(report, 'VERSION', '缺 README.md');
    return;
  }
  const top = /版本 (\d+\.\d+\.\d+) · MIT/.exec(readme);
  if (top === null || top[1] !== version) {
    fail(report, 'VERSION', `README 顶部版本「${top === null ? '（缺）' : top[1]}」≠ package.json ${version}`);
  } else pass(report);

  const latest = /^### (\d+\.\d+\.\d+)（/m.exec(readme);
  if (latest === null || latest[1] !== version) {
    fail(report, 'VERSION', `README §13 最新条目「${latest === null ? '（缺）' : latest[1]}」≠ package.json ${version}`);
  } else pass(report);

  const skill = readText(repo, SKILL_FILE);
  if (skill === null) {
    fail(report, 'VERSION', `缺 ${SKILL_FILE}`);
    return;
  }
  const meta = /^  version: "([^"]+)"/m.exec(skill);
  if (meta === null || !/^\d+\.\d+\.\d+$/.test(meta[1])) {
    fail(report, 'VERSION', `SKILL metadata.version 不是语义化版本：「${meta === null ? '（缺）' : meta[1]}」`);
    return;
  }
  pass(report);
  if (!readme.includes(`SKILL.md ${meta[1]}`)) {
    fail(report, 'VERSION', `README §13 最新条目没提当前 skill 版本 SKILL.md ${meta[1]}`);
  } else pass(report);
}

/**
 * 部署副本：仓库 skill 与 bundle 关键文件必须与源一致。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @param {{ deploy: string, bundle: string }} options 目录。
 * @returns {void}
 */
function checkDeploy(report, repo, options) {
  const srcRoot = path.join(repo, SKILL_REL);
  if (!fs.existsSync(options.deploy)) {
    report.notes.push({ id: 'DEPLOY/skill', message: `部署副本不存在，跳过：${options.deploy}` });
  } else {
    const src = new Map(listFiles(srcRoot).map((rel) => [rel, hashFile(path.join(srcRoot, rel))]));
    const dst = new Map(listFiles(options.deploy).map((rel) => [rel, hashFile(path.join(options.deploy, rel))]));
    let missing = 0;
    let different = 0;
    for (const [rel, hash] of src) {
      if (!dst.has(rel)) {
        fail(report, 'DEPLOY/skill', `部署副本缺 ${rel}`);
        missing += 1;
      } else if (dst.get(rel) !== hash) {
        fail(report, 'DEPLOY/skill', `部署副本与仓库不一致：${rel}（先跑 工具-同步技能.mjs）`);
        different += 1;
      }
    }
    const extra = [...dst.keys()].filter((rel) => !src.has(rel));
    if (extra.length > 0) {
      report.notes.push({ id: 'DEPLOY/skill', message: `部署副本多出 ${extra.length} 个仓库没有的文件（不自动删）：${extra.join(', ')}` });
    }
    if (missing === 0 && different === 0) pass(report);
  }

  if (!fs.existsSync(options.bundle)) {
    report.notes.push({ id: 'DEPLOY/bundle', message: `bundle 副本不存在，跳过：${options.bundle}` });
    return;
  }
  let bad = 0;
  for (const rel of BUNDLE_FILES) {
    const src = path.join(repo, rel);
    const dst = path.join(options.bundle, rel);
    if (!fs.existsSync(src)) {
      fail(report, 'DEPLOY/bundle', `仓库缺 ${rel}`);
      bad += 1;
    } else if (!fs.existsSync(dst)) {
      fail(report, 'DEPLOY/bundle', `bundle 副本缺 ${rel}`);
      bad += 1;
    } else if (hashFile(src) !== hashFile(dst)) {
      fail(report, 'DEPLOY/bundle', `bundle 副本与仓库不一致：${rel}（robocopy 后关开 bundle）`);
      bad += 1;
    }
  }
  if (bad === 0) pass(report);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createReport();
  const repo = options.repo;

  const skill = readText(repo, SKILL_FILE);
  if (skill === null) {
    fail(report, 'SKILL', `缺 ${SKILL_FILE}`);
  } else {
    checkRuleNumbers(report, skill);
  }
  checkHeadings(report, repo, SKILL_FILE, SKILL_SECTIONS, 'SKILL/sections');
  checkHeadings(report, repo, NOTES_FILE, NOTES_SECTIONS, 'NOTES/sections');
  checkHeadings(report, repo, RUNBOOK_FILE, RUNBOOK_SECTIONS, 'RUNBOOK/sections');
  for (const anchor of ANCHORS) checkAnchor(report, repo, anchor);
  checkVersions(report, repo);
  if (options.checkDeploy) checkDeploy(report, repo, options);

  const total = report.passed + report.errors.length;
  for (const note of report.notes) console.log(`提示 [${note.id}] ${note.message}`);
  for (const error of report.errors) console.log(`✗ [${error.id}] ${error.message}`);
  if (report.errors.length === 0) {
    console.log(`✓ 知识层检查通过（${report.passed} 项；repo: ${repo}）`);
    return;
  }
  console.error(`✗ 知识层检查失败：${report.errors.length} / ${total} 项未通过（repo: ${repo}）`);
  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(`✗ 知识层检查出错：${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
