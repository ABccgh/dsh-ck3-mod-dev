#!/usr/bin/env node
/**
 * 知识层 lint：把复盘（`.admin/retro-2026-11-18-ck3mod.md`、续篇 `retro-2026-11-18b-ck3mod-auto-v2.1.md`、
 * `retro-2026-11-18c-ck3mod-dejure-v2.3.md`、`retro-2026-11-19-ck3mod-hotfix.md` 与
 * `retro-2026-11-19-ck3mod-mastery.md`）的映射表变成**可执行断言**。
 *
 * 为什么需要：复盘里的教训如果只写成规则，下一次改文档时删掉一条也没人知道——这正是 H7
 * 「写进清单的问题只有变成机器检查才算处理」。这个脚本把 A1…H7、P1–P16、Q1–Q12、R1–R3、M1–M12 的落点、
 * 硬规则编号、各节标题、版本口径、部署副本哈希都变成断言，跑一次即知映射是否断裂。
 *
 * 检查分六组：
 *   1. SKILL.md 硬规则：编号必须是 1..N 连续、无缺号无重号（N 与 EXPECTED_RULE_COUNT 一致，当前 41）；
 *   2. 三份知识层文件的必需节（SKILL / verified-notes / ingame-acceptance）；
 *   3. 复盘映射锚点：每条编号对应的关键句必须还在原文件里（删了 = 复盘落地断链）；
 *      锚点集 = 11-18 的 A1…H7（28 条）+ 11-18b 的 P1–P16（23 条）+ 11-18c 的 Q1–Q12（13 条）
 *      + 11-19 hotfix 的 R1–R3（7 条）+ 11-19 mastery 的 M1–M12（21 条）+ 11-20 organizer 的 O1–O26（43 条）
 *      + 在营 5 个不变量（2 条）+ 人格层与 cli 的 8 条 = 145 条；另外断言**锚点总数**与
 *      **每个复盘编号至少 1 条**（删锚点 = 少查几项，不能让它悄悄变绿——这正是复盘 Q2「判据自己变弱也是 bug」）；
 *   4. 人格层 `cordis.patch.yml`：必备判断句在、会漂的旧话（dejure 2.2 / 吃掉行尾 / 少 1 属正常 /
 *      七层 / 版本枚举 / 退役 mod）不在；SKILL 的 References 必须点到六份复盘；
 *      另断言 SKILL 与人格层都不再出现退役 mod 的仓库名（历史只许留在 `.admin` 与 工作区索引）；
 *   5. 版本口径：package.json / README 顶部 / README §13 最新条目 / SKILL metadata 互相一致；
 *   6. 部署副本：仓库 vs `~/.agents/skills/ck3-modding` vs `~/dsh-bundles/ck3moddev` 的哈希。
 *
 * 用法：
 *   $node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
 *   & $node .\工具-知识层检查.mjs              # 全部检查；部署副本缺失只给提示，不算失败
 *   & $node .\工具-知识层检查.mjs --no-deploy  # 只查知识层内容（没装 bundle 时用）
 *   & $node .\工具-知识层检查.mjs --repo D:\tmp\fixture   # 换仓库根（测试用）
 *   & $node .\工具-知识层检查.mjs --list-anchors         # 打印锚点总数与逐编号条数
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
const EXPECTED_RULE_COUNT = 41;

/**
 * 锚点总数的期望值。删/改锚点时**先改这里**：它是「判据自己变弱也是 bug」的兜底——
 * 以前删一条锚点只是通过项少一个，照样打印「✓ 通过」。
 */
const EXPECTED_ANCHOR_COUNT = 145;

/** 人格层（预设的 system prompt）文件；它是最先被模型读到的一层，最容易漂。 */
const PATCH_FILE = 'cordis.patch.yml';

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
  '## 覆盖与兼容（五个 mod 都靠这套边界活着）',
  '## 真机验收（in-game acceptance）',
  '## Hard rules',
  '## Verification layers',
  '## References',
];

/** verified-notes.md 必须有的分节（17 组实测要点 + 改名表 + 验证判据）。 */
const NOTES_SECTIONS = [
  '## 1.21 改名与「patch note ≠ 实机名」',
  '## [hotfix] 热修与版本口径（1.21 hotfix 2026-11-18 / 1.21.0.3 2026-11-19）',
  '## [interaction] 角色互动（character interaction）',
  '## [cb] 宣战理由（casus belli）',
  '## [government] 政体（government）',
  '## [title] 头衔 / 法理 / 封臣树（title & de jure）',
  '## [resources] 资源 / 虔诚档位',
  '## [council] 议会（council）',
  '## [story] 故事循环（story cycle）',
  '## [struggle] 斗争（struggle）',
  '## [district] 地产 / 区划（district）',
  '## [trade] 贸易 / 市场 / 商业共和国',
  '## [road] 道路（road）',
  '## [laws] 法律（law）',
  '## [scheme] 计谋（scheme）',
  '## [ingame] 真机验收（启动参数 / 存档 / 1.21 UI）',
  '## [automation] 真机自动化（agent 代点，2026-11-18 实跑 free v4.1）',
  '## [release] 发布与工坊核对（2026-11-18 free v4.0 → v4.1）',
  '## [verify] 验证判据（无头 / A5 / 反向显示）',
];

/** ingame-acceptance.md 必须有的节（含 §9 机器代点）。 */
const RUNBOOK_SECTIONS = [
  '## 0. 什么时候必须跑',
  '## 1. 三条铁律',
  '## 2. 准备（五步，全部在开游戏之前）',
  '## 3. 启动',
  '## 4. 五个 mod 的验收矩阵',
  '### 4.1 mastery（谋略）',
  '### 4.4 auto（自动传播）',
  '### 4.5 organizer（法理整顿）',
  '## 5. 证据规范',
  '## 6. 收尾（六步，顺序不能换）',
  '## 7. 判定边界',
  '## 8. 1.21 已知事实（先看再验）',
  '## 9. 机器代点（仅在用户当次明确要求时）',
  '### 9.1 前提（三步，缺一不可）',
  '### 9.2 五个动作（PowerShell，user32）',
  '### 9.3 探针 mod 模板（不点菜单就能截到面板）',
  '### 9.4 能自动 / 不能自动（free v4.1 + mastery v1.0 实测）',
  '### 9.5 证据',
  '### 9.6 点击纪律与人机分工（2026-11-18b / 2026-11-19 实测）',
];

/**
 * 每一轮复盘用掉的编号段。每个编号**至少要有一条锚点**——缺了说明那一条的落点被删了。
 * 编号来源：11-18 的 A–E/H（H2/H3 已并入 H1）、11-18b 的 P1–P16 + P24、11-18c 的 Q1–Q12、
 * 11-19 hotfix 的 R1–R3、11-19 mastery 的 M1–M12。
 */
const RETRO_IDS = [
  'A1', 'A2',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9',
  'E1', 'E2', 'E3',
  'H1', 'H4', 'H5', 'H7',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
  'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P24',
  'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12',
  'R1', 'R2', 'R3',
  'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12',
  'O1', 'O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10', 'O11', 'O12', 'O13',
  'O14', 'O15', 'O16', 'O17', 'O18', 'O19', 'O20', 'O21', 'O22', 'O23', 'O24', 'O25', 'O26',
];

/** 人格层必须出现的判断句/关键词（11-18c 与 11-19 mastery 的结论，缺了就等于人格又漂回去了）。 */
const PERSONA_REQUIRED = [
  '别在这里背版本号',
  '清理 / 重构',
  '这一局观测不到',
  '功能移除也要机器可证',
  '末字节',
  '--root',
  '删本机副本前',
  '需求先分类',
  '按枚举写满',
  '剥注释',
  '一次只回答一个问题',
  '终局状态',
  'remote_file_id',
  '链首',
  'is_vassal_or_below_of',
  '在营 5 个',
];

/** 人格层禁词：被推翻的旧结论 / 已知会漂的写法 / 已删除的 mod。 */
const PERSONA_FORBIDDEN = ['dejure 2.2', '吃掉行尾', '少 1 属正常', '七层', 'curse'];

/** 人格层禁止出现的 mod 版本枚举（版本以 工作区索引 / META 为准，写死在 prompt 里必漂）。 */
const PERSONA_VERSION_ENUM = /(?:free|auto|dejure|de-jure|mastery)\s+\d+\.\d+/;

/**
 * 退役 mod 的标识：知识层与人格层里不许再出现（历史只许留在 `.admin` 与 工作区索引）。
 * SKILL 只禁仓库名（`ck3-curse`），人格层连 `curse` 这个词一起禁——那是预设最先读到的摘要，
 * 留着就会让下一个会话去找一个已经不存在的 mod。
 */
const RETIRED_IN_SKILL = ['ck3-curse'];
const RETIRED_IN_PERSONA = ['ck3-curse', 'curse'];

/** SKILL 的 References 必须点到的复盘文件（否则下一个会话按 References 找不到证据）。 */
const SKILL_REQUIRED_REFS = [
  'retro-2026-11-18-ck3mod.md',
  'retro-2026-11-18b-ck3mod-auto-v2.1.md',
  'retro-2026-11-18c-ck3mod-dejure-v2.3.md',
  'retro-2026-11-19-ck3mod-hotfix.md',
  'retro-2026-11-19-ck3mod-mastery.md',
  'retro-2026-11-20-ck3mod-organizer.md',
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
  // 2026-11-18b（auto v2.1）16 条新坑的落点：P1–P16，共 23 条锚点。
  { id: 'P1', file: SKILL_FILE, needle: '兼容发布 = 内容零改动', label: '判断层：L 段差异断言' },
  { id: 'P2', file: NOTES_FILE, needle: '末字节是', label: 'descriptor 字节形状' },
  { id: 'P2', file: SKILL_FILE, needle: '没有行尾换行', label: '规则 26 形状' },
  { id: 'P3', file: NOTES_FILE, needle: '只生成 descriptor', label: '无内容生成器只补 descriptor' },
  { id: 'P4', file: NOTES_FILE, needle: '三个机器信号', label: '上传确认与 SKIP' },
  { id: 'P5', file: NOTES_FILE, needle: '也会被一起回写', label: '内层 descriptor 回写' },
  { id: 'P6', file: RUNBOOK_FILE, needle: 'on_game_start_after_lobby = {', label: '探针双钩子模板' },
  { id: 'P6', file: SKILL_FILE, needle: '两个开局钩子', label: '规则 23' },
  { id: 'P7', file: NOTES_FILE, needle: '新游戏选人界面', label: '-skip 落点' },
  { id: 'P8', file: RUNBOOK_FILE, needle: '清空已选', label: '选角色点击纪律' },
  { id: 'P9', file: RUNBOOK_FILE, needle: '1.1241', label: '全尺寸截图坐标系数' },
  { id: 'P9', file: RUNBOOK_FILE, needle: '36 px', label: '事件面板行高' },
  { id: 'P10', file: RUNBOOK_FILE, needle: '1.2–1.5 s', label: '点击间隔' },
  { id: 'P11', file: RUNBOOK_FILE, needle: '自动暂停', label: '跑时间项归人' },
  { id: 'P12', file: NOTES_FILE, needle: '没自退', label: '无头未自退判据' },
  { id: 'P12', file: SKILL_FILE, needle: '没自退', label: '规则 25' },
  { id: 'P13', file: NOTES_FILE, needle: 'Script location', label: 'A5 判据' },
  { id: 'P13', file: SKILL_FILE, needle: 'Script location', label: '规则 25 日志分组' },
  { id: 'P14', file: SKILL_FILE, needle: '不许硬编码样本数', label: '规则 22' },
  { id: 'P14', file: NOTES_FILE, needle: '32/32', label: '反向结论行' },
  { id: 'P15', file: SKILL_FILE, needle: '只改仓库副本', label: '规则 21' },
  { id: 'P16', file: SKILL_FILE, needle: '工具-文档链接检查.mjs', label: '规则 20 文档链接兜底' },
  { id: 'P24', file: SKILL_FILE, needle: '一开始就划给人', label: '规则 24 人机分工' },
  // 2026-11-18c · 法理征服 v2.3（Q1–Q12）
  { id: 'Q1', file: SKILL_FILE, needle: '清理 / 重构', label: '规则 27：patch note「清理」是语义变更' },
  { id: 'Q2', file: NOTES_FILE, needle: 'DIRECT_CALLS', label: 'wrapper 化让 H 段覆盖退化' },
  { id: 'Q3', file: NOTES_FILE, needle: '模式跳过部署比对', label: '判据与部署状态解耦' },
  { id: 'Q4', file: NOTES_FILE, needle: '旧版校验器', label: '换判据要证明差值来源' },
  { id: 'Q5', file: NOTES_FILE, needle: '形状对了就不再 −1', label: 'descriptor 形状对了就不掉字节' },
  { id: 'Q6', file: NOTES_FILE, needle: '语义等价就跳过写盘', label: '部署脚本按语义跳过写盘' },
  { id: 'Q7', file: SKILL_FILE, needle: '能观测到本次改动', label: '规则 28：验收场景可观测性' },
  { id: 'Q7', file: RUNBOOK_FILE, needle: '本局能观测到本次改动', label: '§2 第 0 步' },
  { id: 'Q8', file: SKILL_FILE, needle: '功能移除也一样', label: '规则 29：变更范围机器可证' },
  { id: 'Q9', file: NOTES_FILE, needle: '证不了', label: '取证边界' },
  { id: 'Q10', file: NOTES_FILE, needle: '上传动作会改播放集', label: '上传会写 dlc_load.json' },
  { id: 'Q11', file: RUNBOOK_FILE, needle: '删之前先把上传后的 descriptor', label: '删副本前留证据' },
  { id: 'Q12', file: NOTES_FILE, needle: 'api.steampowered.com', label: '断网时三信号降级 SKIP' },
  // 人格层（cordis.patch.yml）：预设最先读到的摘要，最容易和知识层脱节。
  { id: 'Q1', file: PATCH_FILE, needle: '清理 / 重构', label: '人格层：清理/重构 = 语义变更' },
  { id: 'Q3', file: PATCH_FILE, needle: '--root', label: '人格层：判据与部署解耦' },
  { id: 'Q5', file: PATCH_FILE, needle: '末字节', label: '人格层：descriptor 字节形状' },
  { id: 'Q7', file: PATCH_FILE, needle: '这一局观测不到', label: '人格层：验收场景可观测性' },
  { id: 'Q8', file: PATCH_FILE, needle: '功能移除也要机器可证', label: '人格层：功能移除机器可证' },
  { id: 'Q11', file: PATCH_FILE, needle: '删本机副本前', label: '人格层：删副本前先留证据' },
  { id: 'Q12', file: PATCH_FILE, needle: '断网时三信号', label: '人格层：断网降级 SKIP' },
  // 工具链：--root 会转发、未知参数会报错（SKILL 的 Shared checker 段）。
  { id: 'CLI', file: SKILL_FILE, needle: '未知参数都会报错退出 2', label: 'cli：参数不再静默忽略' },
  // 2026-11-19 · 1.21 hotfix（全站复核）：R1–R3，共 7 条。
  { id: 'R1', file: SKILL_FILE, needle: 'buildid', label: '规则 30：buildid + mtime 判热修' },
  { id: 'R1', file: NOTES_FILE, needle: '26757580', label: 'hotfix 节：buildid 前后值' },
  { id: 'R1', file: PATCH_FILE, needle: 'buildid', label: '人格层：热修看 buildid' },
  { id: 'R2', file: NOTES_FILE, needle: '1.21.0.3', label: 'hotfix 节：Wiki 已给 1.21.0.3 编号' },
  { id: 'R2', file: SKILL_FILE, needle: '1.21.0.3', label: '规则 30：编号以 Wiki 为准、版本串不变' },
  { id: 'R3', file: NOTES_FILE, needle: '81 个文件', label: 'hotfix 节：影响面文件清单' },
  { id: 'R3', file: SKILL_FILE, needle: '热修后第一件事', label: '规则 30：热修后先跑 check' },
  // 2026-11-19 · 谋略 Scheme Mastery v1.0（M1–M12）：21 条映射 + 在营 4 个不变量 2 条。
  { id: 'M1', file: SKILL_FILE, needle: '需求先分类', label: '规则 31：需求先分类再出计划' },
  { id: 'M1', file: PATCH_FILE, needle: '需求先分类', label: '人格层：需求先分类' },
  { id: 'M2', file: SKILL_FILE, needle: '从安装目录反查枚举', label: '规则 32：「所有 X」按枚举写满 + 反查' },
  { id: 'M2', file: NOTES_FILE, needle: '136 个类型', label: '[scheme]：安装目录实况 136 / 5 类' },
  { id: 'M3', file: NOTES_FILE, needle: 'base_maximum_success', label: '[scheme]：显示上限 = 潜力' },
  { id: 'M3', file: NOTES_FILE, needle: '54.0%', label: '[scheme]：54 / 34 / 95 实测口径' },
  { id: 'M4', file: NOTES_FILE, needle: 'SCHEMES_PER_TYPE', label: '[scheme]：同类型只能同时一个' },
  { id: 'M4', file: RUNBOOK_FILE, needle: '不同类型', label: 'G7：验栏位要换类型' },
  { id: 'M5', file: SKILL_FILE, needle: '剥离注释', label: '规则 33：结构性判据先剥注释' },
  { id: 'M5', file: NOTES_FILE, needle: 'stripComments', label: '[verify]：注释喂饱判据' },
  { id: 'M6', file: NOTES_FILE, needle: '死 ID', label: '[release]：死标识保留原值' },
  { id: 'M7', file: RUNBOOK_FILE, needle: '行位会漂', label: '§9.6：事件面板重排' },
  { id: 'M8', file: RUNBOOK_FILE, needle: '切换数据系统', label: '§9.6：调试 UI 陷阱' },
  { id: 'M9', file: RUNBOOK_FILE, needle: 'F9 决议', label: '§9.6：HUD 快捷盘' },
  { id: 'M9', file: RUNBOOK_FILE, needle: '决议（7）', label: '§9.6：决议分组要滚动' },
  { id: 'M10', file: SKILL_FILE, needle: '一次只回答一个问题', label: '规则 34：探针一事一件' },
  { id: 'M10', file: NOTES_FILE, needle: '第一个失败会被第二个掩盖', label: '[automation]：探针不可塞两件事' },
  { id: 'M11', file: NOTES_FILE, needle: '首次上传', label: '[release]：首次上传形状' },
  { id: 'M11', file: NOTES_FILE, needle: '235 / 142 B', label: '[release]：新增 remote_file_id 行' },
  { id: 'M12', file: NOTES_FILE, needle: '本机副本还在', label: '[release]：预检有意报不一致' },
  { id: 'M12', file: NOTES_FILE, needle: '预期差异', label: '[release]：读成预期差异而非故障' },
  { id: 'INV', file: SKILL_FILE, needle: '在营 5 个', label: '环境段：在营 5 个 mod' },
  { id: 'INV', file: PATCH_FILE, needle: 'organizer', label: '人格层：在营 5 个含 organizer' },
  // 2026-11-20 · 法理整顿 De Jure Organizer v1.0（O1–O26）：43 条落点。
  { id: 'O1', file: SKILL_FILE, needle: '终局状态', label: '规则 35：需求先要终局状态' },
  { id: 'O1', file: PATCH_FILE, needle: '终局状态', label: '人格层：需求先要终局状态' },
  { id: 'O2', file: SKILL_FILE, needle: '先找通用键', label: '规则 32：「所有 X」先找通用键' },
  { id: 'O2', file: RUNBOOK_FILE, needle: '任意政体', label: '§4.5：所有政体的验收前置' },
  { id: 'O3', file: NOTES_FILE, needle: 'title_capital_county.holder', label: '[title]：受让人 = 首都县持有人' },
  { id: 'O4', file: SKILL_FILE, needle: '同级或更高', label: '规则 39：同级不能分封' },
  { id: 'O4', file: NOTES_FILE, needle: '同级/更高', label: '[title]：同级/更高头衔分不出去' },
  { id: 'O5', file: NOTES_FILE, needle: '只留首都伯爵领', label: '[title]：只留首都伯爵领的字面口径' },
  { id: 'O6', file: SKILL_FILE, needle: 'gender_female_chance', label: '规则 36：create_character 性别' },
  { id: 'O6', file: NOTES_FILE, needle: 'gender_female_chance', label: '[title]：性别三选一' },
  { id: 'O7', file: SKILL_FILE, needle: 'Inconsistent trigger scopes', label: '规则 38：触发器作用域' },
  { id: 'O7', file: NOTES_FILE, needle: 'is_mercenary_company', label: '[title]：title 触发器' },
  { id: 'O8', file: SKILL_FILE, needle: 'is_vassal_or_below_of', label: '规则 37：领域判定' },
  { id: 'O8', file: NOTES_FILE, needle: 'is_vassal_or_below_of', label: '[title]：任意深度封臣树' },
  { id: 'O9', file: NOTES_FILE, needle: 'top_liege = root', label: '[title]：top_liege 只对独立统治者' },
  { id: 'O10', file: NOTES_FILE, needle: 'change_government', label: '[title]：change_government 只吃字面 key' },
  { id: 'O11', file: NOTES_FILE, needle: 'has_appointment_level_for_title', label: '[title]：任命制等级守卫' },
  { id: 'O12', file: SKILL_FILE, needle: 'capital_county', label: '规则 37：无地 guard' },
  { id: 'O12', file: RUNBOOK_FILE, needle: '有首都伯爵领', label: '§4.5：前置含首都伯爵领' },
  { id: 'O13', file: SKILL_FILE, needle: 'same or higher tier', label: '规则 39：原版拒绝同级转封' },
  { id: 'O13', file: NOTES_FILE, needle: 'gdp_found_a_republic_effect', label: '[ingame]：商业共和国建政链噪声' },
  { id: 'O13', file: RUNBOOK_FILE, needle: '商业共和国', label: '§4.5：商业共和国判读' },
  { id: 'O14', file: NOTES_FILE, needle: 'previous_holder', label: '[ingame]：日本 previous_holder 噪声' },
  { id: 'O15', file: SKILL_FILE, needle: 'Wrong scope for trigger: none', label: '规则 23：root 是 none' },
  { id: 'O15', file: RUNBOOK_FILE, needle: 'Wrong scope for trigger: none', label: '§9.3：探针先落到角色' },
  { id: 'O16', file: SKILL_FILE, needle: 'random_independent_ruler', label: '规则 23：随机选人' },
  { id: 'O16', file: NOTES_FILE, needle: 'random_ruler', label: '[automation]：random_ruler 抽封臣' },
  { id: 'O17', file: NOTES_FILE, needle: '8 个文件', label: '[verify]：探针哈希回到已验证态' },
  { id: 'O17', file: RUNBOOK_FILE, needle: '哈希一致', label: '§6：收尾核对哈希' },
  { id: 'O18', file: SKILL_FILE, needle: 'replaceAll', label: '规则 33：反向样本 replaceAll' },
  { id: 'O18', file: NOTES_FILE, needle: 'replaceAll', label: '[verify]：样本只改到注释' },
  { id: 'O19', file: SKILL_FILE, needle: '判据过期', label: '规则 19：判据随需求更新' },
  { id: 'O20', file: SKILL_FILE, needle: '先复跑', label: '规则 25：未自退先复跑' },
  { id: 'O21', file: SKILL_FILE, needle: '链首', label: '规则 41：日志归属看链首' },
  { id: 'O21', file: NOTES_FILE, needle: '链首', label: '[ingame]：块首归属法' },
  { id: 'O22', file: NOTES_FILE, needle: '整篇', label: '[release]：描述整篇不分段' },
  { id: 'O23', file: NOTES_FILE, needle: '工坊改动说明', label: '[release]：改动说明两形态' },
  { id: 'O24', file: SKILL_FILE, needle: 'remote_file_id', label: '规则 40：首传信号' },
  { id: 'O24', file: NOTES_FILE, needle: 'remote_file_id', label: '[release]：首传 +28 B' },
  { id: 'O24', file: PATCH_FILE, needle: 'remote_file_id', label: '人格层：首传只看 remote_file_id' },
  { id: 'O25', file: SKILL_FILE, needle: '6/8', label: '规则 40：回填 META 前 6/8' },
  { id: 'O25', file: NOTES_FILE, needle: '8/8', label: '[release]：回填后 8/8' },
  { id: 'O26', file: NOTES_FILE, needle: '末字节', label: '[release]：删副本前记末字节' },
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

/** 打印锚点总数与逐编号条数（供单测断言「每个复盘编号都有落点」）。 */
function printAnchors() {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const anchor of ANCHORS) counts.set(anchor.id, (counts.get(anchor.id) ?? 0) + 1);
  console.log(`锚点：${ANCHORS.length} 条 / ${counts.size} 个编号（期望 ${EXPECTED_ANCHOR_COUNT}）`);
  for (const [id, count] of counts) console.log(`  ${id} ${count}`);
}

function parseArgs(argv) {
  const options = {
    repo: SELF,
    deploy: DEPLOY_DEFAULT,
    bundle: BUNDLE_DEFAULT,
    checkDeploy: true,
    listAnchors: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') options.repo = path.resolve(argv[(i += 1)]);
    else if (arg === '--deploy') options.deploy = path.resolve(argv[(i += 1)]);
    else if (arg === '--bundle') options.bundle = path.resolve(argv[(i += 1)]);
    else if (arg === '--no-deploy') options.checkDeploy = false;
    else if (arg === '--list-anchors') options.listAnchors = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('用法: node 工具-知识层检查.mjs [--repo <dir>] [--deploy <dir>] [--bundle <dir>] [--no-deploy] [--list-anchors]');
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
 * 锚点总数：少了 = 判据变弱。复盘 Q2 的教训用在 lint 自己身上——
 * 以前删一条锚点只是通过项少一个，输出照样「✓ 通过」。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {Array<{ id: string }>} anchors 锚点。
 * @returns {void}
 */
function checkAnchorCount(report, anchors) {
  if (anchors.length === EXPECTED_ANCHOR_COUNT) {
    pass(report);
    return;
  }
  fail(
    report,
    'ANCHORS/count',
    `锚点数应为 ${EXPECTED_ANCHOR_COUNT}，实际 ${anchors.length}——删锚点等于少查，先同步 EXPECTED_ANCHOR_COUNT 并说明原因`,
  );
}

/**
 * 逐编号覆盖：每个复盘编号至少一条锚点，缺了就是那一条的落点没了。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {Array<{ id: string }>} anchors 锚点。
 * @returns {void}
 */
function checkAnchorCoverage(report, anchors) {
  const covered = new Set(anchors.map((anchor) => anchor.id));
  const missing = RETRO_IDS.filter((id) => !covered.has(id));
  if (missing.length === 0) {
    pass(report);
    return;
  }
  fail(report, 'ANCHORS/coverage', `${missing.length} 个复盘编号没有锚点：${missing.join(', ')}——落点丢了`);
}

/**
 * 人格层：必备判断句在不在、旧话还在不在、有没有写死会漂的版本号。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @returns {void}
 */
function checkPersona(report, repo) {
  const text = readText(repo, PATCH_FILE);
  if (text === null) {
    fail(report, 'PERSONA', `缺 ${PATCH_FILE}`);
    return;
  }
  const missing = PERSONA_REQUIRED.filter((needle) => !text.includes(needle));
  if (missing.length === 0) pass(report);
  else fail(report, 'PERSONA', `${PATCH_FILE} 缺 ${missing.length} 句：${missing.join(' / ')}`);

  const stale = PERSONA_FORBIDDEN.filter((needle) => text.includes(needle));
  const enumerated = PERSONA_VERSION_ENUM.exec(text);
  const details = [...stale];
  if (enumerated !== null) details.push(`版本枚举「${enumerated[0]}」`);
  if (details.length === 0) pass(report);
  else fail(report, 'PERSONA', `${PATCH_FILE} 还留着会漂的旧话：${details.join(' / ')}（版本以 工作区索引 / META 为准）`);
}

/**
 * SKILL 的 References 必须点到三份复盘，否则下一个会话按 References 找不到证据。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @returns {void}
 */
function checkSkillRefs(report, repo) {
  const text = readText(repo, SKILL_FILE);
  if (text === null) {
    fail(report, 'REFS', `缺 ${SKILL_FILE}`);
    return;
  }
  const missing = SKILL_REQUIRED_REFS.filter((name) => !text.includes(name));
  if (missing.length === 0) pass(report);
  else fail(report, 'REFS', `References 少 ${missing.length} 份复盘：${missing.join(', ')}`);
}

/**
 * 退役 mod 不许再出现在 SKILL 与人格层。历史记录只留在 `.admin` 与 工作区索引——
 * 知识层里留着它，下一个会话就会照着它写命令、验收项甚至「重发流程」。
 * @param {ReturnType<typeof createReport>} report 报告。
 * @param {string} repo 仓库根。
 * @returns {void}
 */
function checkNoRetired(report, repo) {
  const skill = readText(repo, SKILL_FILE);
  const persona = readText(repo, PATCH_FILE);
  if (skill === null || persona === null) {
    fail(report, 'RETIRED', `缺 ${SKILL_FILE} 或 ${PATCH_FILE}`);
    return;
  }
  const hits = [];
  for (const needle of RETIRED_IN_SKILL) if (skill.includes(needle)) hits.push(`SKILL.md 里有「${needle}」`);
  for (const needle of RETIRED_IN_PERSONA) if (persona.includes(needle)) hits.push(`${PATCH_FILE} 里有「${needle}」`);
  if (hits.length === 0) pass(report);
  else fail(report, 'RETIRED', `${hits.join(' / ')}——退役 mod 只许留在 .admin 与 工作区索引`);
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
  if (options.listAnchors) {
    printAnchors();
    return;
  }
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
  checkAnchorCount(report, ANCHORS);
  checkAnchorCoverage(report, ANCHORS);
  for (const anchor of ANCHORS) checkAnchor(report, repo, anchor);
  checkPersona(report, repo);
  checkSkillRefs(report, repo);
  checkNoRetired(report, repo);
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
