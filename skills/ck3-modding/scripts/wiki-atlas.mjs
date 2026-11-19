#!/usr/bin/env node
/**
 * 生成 ≤CK3 Wiki 索引≥（ck3-modding skill 的导航图）。
 *
 * 为什么要有它：Wiki 有 8300+ 页，人工抄一遍既贵又会腐坏。这个脚本从 MediaWiki API
 * 拉「Category:Modding 全量 + Category:1.21 校验集 + 1.21 新内容 / 机制语义页 + 补丁链」，
 * 渲染成一张带日期的表；
 *
 * 两个**机器兜底**（2026-11-19 加，起因是 Wiki 新建了 `Patch 1.21.X` 而表里没有）：
 * - `assertCoverage`：Category:Modding 有页面没归桶 → 报错；表里点名的页面不存在（改名/删除）→ 报错；
 * - `assertPatchCoverage`：`Category:Patches` 里属于当前 / 上一个大版本的 `Patch 1.x(.X)` 页
 *   必须全部在 `PATCHES` 里，否则报错并点名。
 * 以前这两种情况只会「静默少几行」，判据自己变弱了也不会有人知道。
 * 只存**元数据**（标题/字节/最后编辑/{{version}} 声明）和本文件里手写的一句备注，
 * 不复制 Wiki 正文——正文用 ck3wiki_page 现读，永远跟着 Wiki 走。
 *
 * 用法（Node 不在 PATH，用 DSH 自带的那份）：
 *   $node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
 *   & $node .\scripts\wiki-atlas.mjs              # 重新生成（默认写 ../references/ck3-wiki-atlas.md）
 *   & $node .\scripts\wiki-atlas.mjs --check      # 只比对：有漂移就退出码 1，不写文件
 *   & $node .\scripts\wiki-atlas.mjs --out D:\tmp\atlas.md
 *
 * 注意：必须带描述性 User-Agent。实测默认 Node UA 会被站点 WAF 回 HTML 挑战页
 * （报 "Unexpected token '<'"），加上 UA 后 200。
 *
 * @module ck3-modding/scripts/wiki-atlas
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.resolve(HERE, '..', 'references', 'ck3-wiki-atlas.md');
const DEFAULT_SITE = 'https://ck3.paradoxwikis.com';
const USER_AGENT = 'dsh-ck3mod-wiki-atlas/1.0 (+https://github.com/ABccgh/dsh-ck3-mod-dev; read-only)';
const BODY_MARKER = '<!-- atlas-body -->';

/**
 * 单次请求超时。别设太小：带正文的 Category:Modding 查询实测要 80 秒左右
 * （站点一次吐 1.2 MB），30 秒会直接被 abort。
 */
let timeoutMs = 180_000;

/** 本机游戏版本：CK3 大版本更新后，改这里 + SKILL.md 的 Environment 段。 */
const GAME_VERSION = '1.21.0 (Florin)';

/**
 * 「当前版本口径」分类：Wiki 编辑者会把整页标进 `Category:1.<minor>`。
 * 大版本更新时只改这一个常量（以及 GAME_VERSION），其余文案跟着走。
 */
const VALIDITY_CATEGORY = '1.21';

/**
 * 上一个机制大版本。补丁链自动核对用它组成「当前 / 上一版本家族」，
 * 保证 Wiki 新开的热修页（如 `Patch 1.21.X`）不会因为没人记得而漏进表。
 * 大版本更新时与 VALIDITY_CATEGORY 一起改。
 */
const PREVIOUS_MINOR = '1.20';

/** 域分桶：Category:Modding 的 67 页全部在这里有归属，漏了会报错。 */
const DOMAINS = [
  {
    key: 'start',
    title: '入门与工程',
    pages: [
      'Modding',
      'Modding: getting started',
      'Mod structure',
      'Mod compatibility',
      'Mod troubleshooting',
      'Modding tools',
      'Console commands',
    ],
  },
  {
    key: 'script',
    title: '脚本核心参考',
    pages: [
      'Scripting',
      'Scopes',
      'Scopes list',
      'Effects',
      'Effects list',
      'Triggers',
      'Triggers list',
      'Variables',
      'Script values',
      'Scripted effects',
      'Data types',
      'Defines',
      'Modifier list',
      'Weight modifier',
      'Flavorization',
      'Localization',
      'Customizable localization',
      'Interface',
      'Commands',
    ],
  },
  {
    key: 'content',
    title: '内容域（*.modding）',
    pages: [
      'AI modding',
      'Artifact modding',
      'Bookmarks modding',
      'Characters modding',
      'Council modding',
      'Culture modding',
      'Decisions modding',
      'Dynasties modding',
      'Event modding',
      'Governments modding',
      'History modding',
      'Holdings modding',
      'Interactions modding',
      'Lifestyles modding',
      'Regiments modding',
      'Religions modding',
      'Resources modding',
      'Story cycles modding',
      'Struggle modding',
      'Title modding',
      'Trait modding',
    ],
  },
  {
    key: 'new121',
    title: '1.21 新内容（Silk & Silver / Florin）',
    pages: [
      'Market',
      'Merchant',
      'Merchant decisions',
      'Merchant lifestyle',
      'Republican',
      'Trade company',
      'Districts',
      'Special districts',
      'Great project districts',
      'Education focus',
      'Adventurer lifestyle',
    ],
  },
  {
    key: 'mech',
    title: '机制语义（非 Modding 分类，按 modding 用途挑选）',
    pages: [
      'Casus belli',
      'Titles',
      'Modifiers',
      'Traits',
      'Culture',
      'Traditions',
      'Religion',
      'Doctrines',
      'Tenet',
      'Laws',
      'Lifestyle',
      'Ruler lifestyle',
      'Government',
      'Council',
      'Army',
      'Hired forces',
      'Warfare',
      'Barony',
      'County',
      'Building',
      'Activity',
      'Schemes',
      'Situation',
      'Struggles',
      'Stories',
      'Artifacts',
      'Innovation',
    ],
  },
  {
    key: 'art',
    title: '美术 / 地图 / 音频',
    pages: [
      '3D models',
      'Exporters',
      'Graphical assets',
      'Fonts',
      'Coat of arms modding',
      'Map modding',
      'Terrain modding',
      'Music modding',
      'Sound modding',
    ],
  },
  {
    key: 'data',
    title: '数据列表',
    pages: ['Lists', 'List of baronies', 'Base Army Cost'],
  },
  {
    key: 'other',
    title: '非通用（Paradox 自家 mod 文档）',
    pages: [
      'Kingdom of Heaven',
      'Way of Kings',
      'Way of Kings/Boons',
      'Way of Kings/Consent',
      'Way of Kings/Dungeon Delve',
      'Way of Kings/Game Pass',
      'Way of Kings/Governments',
      'Way of Kings/Knights Radiant',
      'Way of Kings/Shardic Victories',
    ],
  },
];

/** 手写备注：只写「怎么用」这一句，正文不复制。 */
const NOTES = {
  Modding: '总入口：热重载、日志、覆盖规则、加载顺序、上传流程',
  'Modding: getting started': '最短上手路径：debug_mode / release mode / 拿文档',
  'Mod structure': '.mod 与 descriptor.mod 全部键（path / replace_path / supported_version / remote_file_id）',
  'Mod compatibility': '整文件覆盖 vs 单对象覆盖、共享变量、探测他人 mod',
  'Mod troubleshooting': '控制台、loc/scope 调试、热载、**run script 自动化**',
  'Modding tools': '社区工具表（ck3-tiger / PMT / meckt…），2026-11 仍在更新',
  'Console commands': '控制台命令全表（1.21 口径；含 scripted_tests / schedule_term_end / SplineNetwork.AppendAssets / replacebuilding）',
  Commands: '旧版命令页；与控制台相关的以 Console commands 为准',
  Scripting: '脚本语言总览：作用域、列表、变量、结构',
  Scopes: '作用域语义与切换规则',
  'Scopes list': '作用域清单（抄录版，以 .info 为准）',
  Effects: '效果语义与用法',
  'Effects list': '**抄录版，页面自称会缺/含废弃项** → 以 script_docs 生成为准',
  Triggers: '触发器语义与用法',
  'Triggers list': '**抄录版，页面自称 outdated** → 以 script_docs 生成为准',
  Variables: '脚本变量（set_variable 一族）',
  'Script values': 'script value 计算块',
  'Scripted effects': 'scripted_effects 复用',
  'Data types': '数据类型表；2022 年最后实质更新，命名以 .info 为准',
  Defines: '00_defines.txt 键表',
  'Modifier list': 'modifier 键全表（改数值必查；1.21 新增 trade / road / district 修正，仍以 _modifiers.info 为准）',
  'Weight modifier': 'AI 权重修饰',
  Flavorization: '头衔/文化名号生成',
  Localization: '本地化格式、BOM、颜色码、$变量$',
  'Customizable localization': '可定制本地化的键结构',
  Interface: 'GUI 文件、模板、类型、数据绑定',
  'AI modding': 'AI 权重、行为参数',
  'Event modding': '事件结构；2026-10 已按 1.20.1 更新（含触发/选项/动画表）',
  'Interactions modding': '**仅 1 个示例（1.4 KB）** → 细节看 common/character_interactions 的 .info；1.21 可指向贸易市场 / 贸易路线',
  'Resources modding': '**0.7 KB 且标题误导**：讲的是虔诚档位；1.21 仍无 common/resources/ → 资源硬编码',
  'Trait modding': '特质字段与图标',
  'Title modding': '头衔层级、历史、法理；1.21 新增 market_capital 覆盖与静态 title type',
  'Decisions modding': '决策结构（含 major/minor、AI 权重）',
  'Characters modding': '角色历史与属性；2026-10 更新',
  'Religions modding': '信仰/教义/圣地；2026-10 更新',
  'Governments modding': '2021 页，**字段层级已变**（council 等在 government_rules 内）→ 以 .info 为准',
  'History modding': '历史文件（角色/头衔/省份）；**1.21 省份历史改成按王国 k_*.txt**',
  'Holdings modding': '地产与建筑挂点；1.21 起 district 是独立数据库（common/districts）',
  'Lifestyles modding': '生活方式树与 perk',
  'Artifact modding': '宝物、词条、历史宝物',
  'Bookmarks modding': '书签与开局角色',
  'Council modding': '职位+任务；**special_council_position / max_amount 在 1.20 起已不可用**',
  'Culture modding': '文化、传统、革新',
  'Dynasties modding': '2021 年页， dynasty 字段以 common/dynasties 为准',
  'Regiments modding': '兵种与常备军；1.21 起 MAA 可存成 scope，政体有 title_maa_setup',
  'Story cycles modding': '结构对，但**漏了 visible/icon/visualization**（看不到的那一半）',
  'Struggle modding': '2026-09 更新，三域里最靠谱；路径 common/struggle/struggles/，起停在 history/struggles/',
  '3D models': '模型与 .mesh 资产',
  Exporters: 'Paradox 官方导出器',
  'Graphical assets': '0.3 KB 目录页，按需再展开',
  Fonts: '字体与字形',
  'Coat of arms modding': '纹章图案与分层',
  'Map modding': '地图、省份、高度图',
  'Terrain modding': '地形类型与贴图',
  'Music modding': '音乐挂载',
  'Sound modding': '音效事件与 bank',
  Lists: '数据列表索引页',
  'List of baronies': '男爵领全表（找 ID 用）',
  'Base Army Cost': 'MAA 基础成本与补给档位变量页（Army 用 LST 引用）',

  // ---- 1.21 新内容（Silk & Silver）——Wiki 目前没有对应的 *modding 页，语义看这里，语法回 .info
  Market: '1.21 新机制：市场 / 贸易路线 / 商品需求；建贸易站的前置都在这',
  Merchant: '商业共和国的 Trader 与 Trade Acumen（1.21 新页）',
  'Merchant decisions': 'Trader 专属决策清单（1.21 新页）',
  'Merchant lifestyle': 'Merchant 生活方式三条线（1.21 新页）',
  Republican: '商业共和国玩法（1.21 新页）',
  'Trade company': '贸易公司（1.21 新页）',
  Districts: '1.21 新页：地产区划（district）玩家向说明；脚本面看 common/districts/_districts.info',
  'Special districts': '特殊区划清单（1.21 新页）',
  'Great project districts': '大型工程区划（1.21 新页）',
  'Education focus': '教育焦点（1.21 新页）',
  'Adventurer lifestyle': '冒险者生活方式（1.21 新页）',

  // ---- 机制语义页：Wiki 的「答案层」，脚本字段仍回层 2
  'Casus belli': 'CB 玩家向语义；脚本字段看 _casus_belli.info 与 [cb]',
  Titles: '头衔层级 / 法理 / 继承（1.21 口径）',
  Modifiers: '修正语义与来源；键表仍以 _modifiers.info 为准',
  Traits: '特质玩家向效果表（找 ID 用）',
  Culture: '文化 / 传统 / 革新语义；2026-11-18 重排：全部文化并入主表 + 新增 Unique cultural mechanics 节',
  Traditions: '传统清单（1.21 口径）',
  Religion: '宗教体系语义',
  Doctrines: '教义清单与互斥',
  Tenet: '信条',
  Laws: '法律体系；1.21 起 law 可作 scope（见 [laws]）',
  Lifestyle: '生活方式枢纽页（2026-11-18 拆分）：Ruler / Adventurer / Merchant 三套 perk 树',
  'Ruler lifestyle': '6 条统治者生活方式与 perk 树（2026-11-18 从 Lifestyle 拆出）',
  Government: '政体玩法；**2026-11-18 把 non-dynastic governments 改名 minor governments**；脚本字段看 _governments.info 与 [government]',
  Council: '议会玩法与任务（脚本面见 [council]）',
  Army: '军队 / 常备军 / 补给（1.21 口径）；2026-11-18 重写：MAA 成本表改由 Base Army Cost 变量页驱动',
  'Hired forces': '雇佣兵与骑士团',
  Warfare: '战争流程与战争分数',
  Barony: '男爵领（最低级头衔）',
  County: '伯爵领：控制力 / 繁荣 / 民意',
  Building: '建筑清单与效果',
  Activity: '活动（狩猎 / 宴会 / 朝圣…）框架',
  Schemes: '阴谋 / 计谋（含 1.21 贸易计谋）',
  Situation: '局势（Situation）机制',
  Struggles: '斗争（玩家向；脚本面见 [struggle]）',
  Stories: '故事循环（玩家向；脚本面见 [story]）',
  Artifacts: '宝物与词条',
  Innovation: '革新与时代',
};

/** 补丁链：只留与 mod 相关的一句话。 */
const PATCHES = [
  { title: 'Patches', note: '版本总表' },
  { title: 'Patch 1.21', note: '2026-11-17 与 Silk & Silver 同日；trade / districts / roads / laws 的脚本面源头' },
  { title: 'Patch 1.21.X', note: '1.21 hotfix（2026-11-18）：平衡 + 崩溃修复，**无 Modding 段**；页面未给版本号' },
  { title: 'Patch 1.20', note: '2026-09-30 与 By God Alone 同日；上一个机制大版本' },
  { title: 'Patch 1.20.X', note: '1.20.0.3 / 0.4 / 1.20.1 / 1.20.1.2 修复链' },
  { title: 'Patch 1.19', note: '2026-04-20；1.20 之前的基线' },
  { title: 'Patch 1.19.X', note: '1.19.x 修复链' },
];

// ---------------------------------------------------------------- HTTP

/**
 * 调 API 并解析 JSON。必须带 UA，否则可能拿到 HTML 挑战页。
 * @param {string} site 站点根。
 * @param {Record<string, string|number>} params 查询参数。
 * @returns {Promise<any>} JSON。
 */
async function api(site, params) {
  const url = new URL('/api.php', site);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} ${url.pathname}${url.search.slice(0, 120)}`);
      if (!text.trimStart().startsWith('{')) {
        throw new Error(`返回的不是 JSON（多半被 WAF 拦了）：${text.slice(0, 80).replace(/\s+/g, ' ')}`);
      }
      const json = JSON.parse(text);
      if (json.error) throw new Error(`API 错误 ${json.error.code}: ${json.error.info}`);
      return json;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

/**
 * 分页跑同一条查询。
 * @param {string} site 站点根。
 * @param {Record<string, string|number>} params 基础参数。
 * @returns {Promise<any[]>} 每页的 `query`。
 */
async function paged(site, params) {
  /** @type {any[]} */
  const queries = [];
  let cont = null;
  for (let i = 0; i < 20; i += 1) {
    const json = await api(site, { ...params, ...(cont ?? {}) });
    if (json.query) queries.push(json.query);
    cont = json.continue ?? null;
    if (cont === null) break;
  }
  return queries;
}

/** 从 wikitext 里抽 `{{version|X}}`；没有就 undefined。 */
function versionBanner(content) {
  if (typeof content !== 'string') return undefined;
  const head = content.slice(0, 2000);
  const match = /\{\{\s*version\s*\|\s*([^}|\n]+)/i.exec(head);
  if (match === null) return undefined;
  const value = match[1].trim();
  if (value === '') return undefined;
  return value.toLowerCase() === 'timeless' ? 'Timeless' : value;
}

/** 字节 → 人类可读。 */
function humanBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** ISO 时间 → YYYY-MM-DD。 */
function day(iso) {
  return typeof iso === 'string' ? iso.slice(0, 10) : '?';
}

// ---------------------------------------------------------------- collect

/**
 * 拉全量数据。
 * @param {string} site 站点根。
 * @returns {Promise<{ pages: Map<string, any>, validitySet: Set<string>, patchTitles: Set<string>,
 *   missing: string[], moddingTitles: Set<string>, stats: any, siteinfo: any, site: string }>}
 */
async function collect(site) {
  const meta = await api(site, { action: 'query', meta: 'siteinfo', siprop: 'statistics|general' });
  const statistics = meta.query.statistics;
  const general = meta.query.general;

  /** @type {Map<string, any>} */
  const pages = new Map();

  // 1) 元数据：Category:Modding 成员 + 体积 + 最后编辑。
  const metaQueries = await paged(site, {
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: 'Category:Modding',
    gcmtype: 'page',
    gcmlimit: '500',
    prop: 'info|revisions',
    rvprop: 'timestamp|user',
  });
  for (const query of metaQueries) {
    for (const page of query.pages ?? []) {
      pages.set(page.title, {
        title: page.title,
        bytes: page.length ?? 0,
        edited: page.revisions?.[0]?.timestamp ?? '',
        editor: page.revisions?.[0]?.user ?? '',
        version: undefined,
      });
    }
  }
  // Category:Modding 的真实成员（后面会往 pages 里并入非分类页，统计口径要单独留一份）。
  const moddingTitles = new Set(pages.keys());

  // 2) 正文：只为抽 {{version|…}} 横幅。整批一次约 1.2 MB / 80 秒，
  //    所以拿齐所有标题就停，不跟着 rvcontinue 去把 166 KB 的 Triggers list 读完。
  const wanted = new Set(pages.keys());
  /** @type {Record<string, string> | null} */
  let cont = null;
  for (let round = 0; round < 10; round += 1) {
    const json = await api(site, {
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: 'Category:Modding',
      gcmtype: 'page',
      gcmlimit: '500',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      ...(cont ?? {}),
    });
    for (const page of json.query?.pages ?? []) {
      const entry = pages.get(page.title);
      if (entry === undefined) continue;
      entry.version = versionBanner(page.revisions?.[0]?.slots?.main?.content);
      wanted.delete(page.title);
    }
    cont = json.continue ?? null;
    if (cont === null || wanted.size === 0) break;
  }

  // 3) Category:1.21 —— Wiki 自己标注「当前版本口径」的集合。
  const validitySet = new Set();
  const catQueries = await paged(site, {
    action: 'query',
    list: 'categorymembers',
    cmtitle: `Category:${VALIDITY_CATEGORY}`,
    cmlimit: '500',
    cmtype: 'page',
  });
  for (const query of catQueries) {
    // 只要主命名空间：分类里混着 User: 页，对 mod 开发没意义。
    for (const member of query.categorymembers ?? []) {
      if (member.ns === 0) validitySet.add(member.title);
    }
  }

  // 4) 补丁链 + 桶内非分类页（1.21 新内容 / 机制语义 / 数据页）：只补拉还没拿到元数据的标题。
  //    分类成员在上面已带 {{version}} 取过，不能覆盖；改名 / 删除的页进 missing，由 assertCoverage 报错。
  const knownTitles = new Set([
    ...PATCHES.map((patch) => patch.title),
    ...DOMAINS.flatMap((domain) => domain.pages),
  ]);
  const metadataTitles = [...knownTitles].filter((title) => !pages.has(title));
  const missing = [];
  if (metadataTitles.length > 0) {
    const extra = await api(site, {
      action: 'query',
      titles: metadataTitles.join('|'),
      prop: 'info|revisions',
      rvprop: 'timestamp',
    });
    for (const page of extra.query.pages ?? []) {
      // 改名 / 删除的页先记下来，由 assertCoverage 统一报错——静默跳过等于判据变弱。
      if (page.missing === true) {
        missing.push(page.title);
        continue;
      }
      pages.set(page.title, {
        title: page.title,
        bytes: page.length ?? 0,
        edited: page.revisions?.[0]?.timestamp ?? '',
        editor: '',
        version: undefined,
      });
    }
  }

  // 5) Category:Patches —— 补丁链自动核对（新开的热修页必须被 PATCHES 认领）。
  const patchTitles = new Set();
  const patchQueries = await paged(site, {
    action: 'query',
    list: 'categorymembers',
    cmtitle: 'Category:Patches',
    cmlimit: '500',
    cmtype: 'page',
  });
  for (const query of patchQueries) {
    for (const member of query.categorymembers ?? []) {
      if (member.ns === 0) patchTitles.add(member.title);
    }
  }

  return { pages, validitySet, patchTitles, missing, moddingTitles, stats: statistics, siteinfo: general, site };
}

/**
 * 校验两件事：
 * 1. Category:Modding 的每一页都落了桶（Wiki 新增页面不允许被静默丢掉）；
 * 2. 表里点名的页面都还在（改名 / 删除必须显式更新 DOMAINS / PATCHES / NOTES，不能少一行还装绿）。
 * @param {Map<string, any>} pages 已取到的页面。
 * @param {string[]} missing 按标题取但 API 报 missing 的页面。
 * @returns {void}
 */
function assertCoverage(pages, missing = []) {
  const bucketed = new Set(DOMAINS.flatMap((domain) => domain.pages));
  const unbucketed = [...pages.keys()].filter(
    (title) => !PATCHES.some((p) => p.title === title) && !bucketed.has(title),
  );
  const problems = [];
  if (unbucketed.length > 0) {
    problems.push(`有 ${unbucketed.length} 页没归入任何域，请在 DOMAINS 里补：\n  - ${unbucketed.join('\n  - ')}`);
  }
  if (missing.length > 0) {
    problems.push(
      `有 ${missing.length} 页不存在（多半已改名 / 删除），请更新 DOMAINS / PATCHES / NOTES：\n  - ${missing.join('\n  - ')}`,
    );
  }
  if (problems.length > 0) throw new Error(problems.join('\n\n'));
}

/**
 * 补丁链自动核对：`Category:Patches` 里属于当前 / 上一个机制大版本的 `Patch 1.x(.X)` 页
 * 必须全部在 `PATCHES` 里。2026-11-19 的教训——Wiki 新建 `Patch 1.21.X`（hotfix）时，
 * 旧脚本只会生成一张「少一行」的表，没人会注意到；现在直接报错并点名。
 * @param {Set<string>} patchTitles Category:Patches 的 ns0 成员。
 * @returns {void}
 */
function assertPatchCoverage(patchTitles) {
  const known = new Set(PATCHES.map((patch) => patch.title));
  const families = [VALIDITY_CATEGORY, PREVIOUS_MINOR]
    .map((minor) => minor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`^Patch (?:${families.join('|')})(?:\\.|$)`);
  const forgotten = [...patchTitles].filter((title) => pattern.test(title) && !known.has(title)).sort();
  if (forgotten.length === 0) return;
  throw new Error(
    `Wiki 有 ${forgotten.length} 个补丁页没进 PATCHES（${VALIDITY_CATEGORY} / ${PREVIOUS_MINOR} 家族）：\n`
    + `  - ${forgotten.join('\n  - ')}\n`
    + '在 PATCHES 里补一行（标题 + 一句用途），再重跑。',
  );
}

// ---------------------------------------------------------------- render

/** 渲染表体（不含头部，`--check` 只比对这一部分）。 */
function renderBody({ pages, validitySet, moddingTitles }) {
  const moddingCount = moddingTitles instanceof Set ? moddingTitles.size : '?';
  const lines = [];
  lines.push('## 怎么用这张表');
  lines.push('');
  lines.push('1. 先定位：在下表找到话题 → 用 `ck3wiki_sections(title)` 看目录 → 再用 `ck3wiki_page(title, section=N)` 只读那节（整页动辄几十 KB，会吃满上下文）。');
  lines.push(`2. 「最后编辑」与「声明版本」是**新鲜度**判据：超过一年没动、又不在 \`Category:${VALIDITY_CATEGORY}\` 里的页，先当参考，结论回原版文件复核。`);
  lines.push(`3. 「${VALIDITY_CATEGORY}」列 = 该页在 Wiki 的 \`Category:${VALIDITY_CATEGORY}\` 里，即被编辑者标为当前版本口径；空着不等于错，只是要多一分怀疑。`);
  lines.push('4. `Effects list` / `Triggers list` / `Data types` 是**抄录版**，Wiki 自己都写着 outdated → 只用来找名字，语法事实回 `ck3mod_vanilla`（`.info`）或控制台 `script_docs` 生成的日志。');
  lines.push('5. 表里没有的话题 ≠ Wiki 没有：用 `ck3wiki_search` 全文检索，再用 `ck3wiki_page_info` 看最后编辑日期。');
  lines.push(`6. **1.21 期间 modding 页整体滞后**：\`Category:${VALIDITY_CATEGORY}\` 里只有 \`Console commands\` 一个 Modding 页。1.21 的结论默认走层 2（\`.info\`），Wiki 只取语义与示例。`);
  lines.push('');

  for (const domain of DOMAINS) {
    lines.push(`## ${domain.title}（${domain.pages.length} 页）`);
    lines.push('');
    if (domain.key === 'other') {
      lines.push('Paradox 自家 mod 的机制文档。只有在研究「官方 mod 怎么组织内容」时才看；我们四个 mod 不依赖其中任何一条。');
      lines.push('');
    }
    if (domain.key === 'new121') {
      lines.push('1.21 / Silk & Silver 新增的玩家向页面。**Wiki 还没有对应的 `*modding` 页**：语义看这里，键名与参数一律回 `common/trade`、`common/districts`、`common/roads` 的 `.info`。');
      lines.push('');
    }
    if (domain.key === 'mech') {
      lines.push('不在 `Category:Modding` 里、但 modding 常要查语义的机制页。Wiki 只答「是什么」，脚本怎么写仍回层 2。');
      lines.push('');
    }
    if (domain.key === 'data') {
      const extras = domain.pages.filter((title) => !(moddingTitles instanceof Set) || !moddingTitles.has(title));
      if (extras.length > 0) {
        lines.push(`其中 ${extras.join(' / ')} 不在 \`Category:Modding\` 里（按 modding 用途收录）。`);
        lines.push('');
      }
    }
    lines.push(`| 页面 | 体积 | 最后编辑 | 声明版本 | ${VALIDITY_CATEGORY} | 备注 |`);
    lines.push('|---|---:|---|---|:--:|---|');
    for (const title of [...domain.pages].sort((a, b) => a.localeCompare(b))) {
      const page = pages.get(title);
      const bytes = page === undefined ? '?' : humanBytes(page.bytes);
      const edited = page === undefined ? '?' : day(page.edited);
      const version = page?.version === undefined ? '—' : page.version;
      const fresh = validitySet.has(title) ? '✓' : '';
      const note = NOTES[title] ?? '—';
      lines.push(`| ${title} | ${bytes} | ${edited} | ${version} | ${fresh} | ${note} |`);
    }
    lines.push('');
  }

  const verified = [...validitySet].sort((a, b) => a.localeCompare(b));
  lines.push(`## Category:${VALIDITY_CATEGORY} 校验集（${verified.length} 页）`);
  lines.push('');
  lines.push(`Wiki 编辑者标注为「${VALIDITY_CATEGORY} 口径」的页面。做 ${VALIDITY_CATEGORY} 相关改动时优先从这批起步；**本版里面只有 \`Console commands\` 一个 Modding 页**，其余全是玩家向，modding 结论不能拿它免检。`);
  lines.push('');
  for (let i = 0; i < verified.length; i += 4) {
    lines.push(`- ${verified.slice(i, i + 4).join(' · ')}`);
  }
  lines.push('');

  lines.push('## 补丁链');
  lines.push('');
  lines.push('| 页面 | 体积 | 最后编辑 | 用途 |');
  lines.push('|---|---:|---|---|');
  for (const patch of PATCHES) {
    const page = pages.get(patch.title);
    lines.push(
      `| ${patch.title} | ${page === undefined ? '?' : humanBytes(page.bytes)} | ${page === undefined ? '?' : day(page.edited)} | ${patch.note} |`,
    );
  }
  lines.push('');

  lines.push('## 三层真相（写改动前默念一遍）');
  lines.push('');
  lines.push('| 层 | 来源 | 能回答什么 | 什么时候别信 |');
  lines.push('|---|---|---|---|');
  lines.push('| 1 | 本 Wiki | 语义、示例、工作流、补丁说明 | 页面 >1 年未动；`*list` 抄录页 |');
  lines.push(`| 2 | 本机原版 ${GAME_VERSION}（\`.info\` / \`common\`，经 \`ck3mod_vanilla\`；或控制台 \`script_docs\`） | 键名、类型、参数、是否仍存在 | 只有 DLC 新内容时才可能缺 |`);
  lines.push('| 3 | 四个 mod 自己的 `数据-*.mjs` + 工具-静态校验 + loc 检查 | 我们自己的不变量与契约 | 只覆盖我们写过的规则 |');
  lines.push('');

  lines.push('## 范围与排除');
  lines.push('');
  lines.push(`- 本表覆盖 \`Category:Modding\` 全部 ${moddingCount} 页，外加 **1.21 新内容（${DOMAINS.find((d) => d.key === 'new121')?.pages.length ?? 0} 页）**、**机制语义（${DOMAINS.find((d) => d.key === 'mech')?.pages.length ?? 0} 页）**、少量非分类数据页与补丁链；\`Category:${VALIDITY_CATEGORY}\` 只用来判新鲜度，不逐条展开。`);
  lines.push('- **不收录**：`Category:Mods` 下 9 个第三方 mod 分类（CK3AGOT · LotR:RiE · RICE · Rajas of Asia · The Fallen Eagle · Way of Kings · When the World Stopped Making Sense · WCGOA · Mod images），合计约 115 页。我们只借鉴模式，不抄工坊 mod 的代码与文案（skill 硬规则 8）。');
  lines.push('- 机制语义那一桶是**按 modding 用途手挑的**，不是 Category:Modding 的成员；没挑进来的玩家向页面（如 `Achievement`、`Beginner\'s guide`）用 `ck3wiki_search` 现查即可。');
  lines.push('- 表是生成时的快照（生成时间见文件头）；下次 CK3 更新后先跑一次 `node scripts/wiki-atlas.mjs` 再开工。');
  lines.push('');
  return lines.join('\n');
}

/** 渲染完整文件：头部（含内容哈希）+ 表体。 */
function render(data) {
  const body = renderBody(data);
  const hash = createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 16);
  const generatedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const header = [
    '# CK3 Wiki 索引（生成物，勿手改表体）',
    '',
    `> 生成时间：${generatedAt}`,
    `> 站点：${data.siteinfo?.sitename ?? 'CK3 Wiki'}（MediaWiki ${data.siteinfo?.generator?.replace('MediaWiki ', '') ?? '?'}）· ${data.site ?? DEFAULT_SITE}`,
    `> 体量：${data.stats?.pages ?? '?'} 页 / ${data.stats?.articles ?? '?'} 条目 / ${data.stats?.images ?? '?'} 文件`,
    `> 本机游戏：${GAME_VERSION}`,
    `> 内容哈希：${hash}`,
    '>',
    '> 这是**导航图，不是知识库**：只存标题、体积、最后编辑、`{{version}}` 声明与一句用法备注，不复制 Wiki 正文。',
    '> 刷新：`node scripts/wiki-atlas.mjs`；验鲜：加 `--check`（有漂移退出码 1）。',
    '',
    '---',
    '',
  ].join('\n');
  return `${header}${BODY_MARKER}\n${body}`;
}

/** 取文件里的表体（拿不到返回 null）。 */
function readBody(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const at = text.indexOf(`${BODY_MARKER}\n`);
  if (at < 0) return null;
  return text.slice(at + BODY_MARKER.length + 1);
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const options = { out: DEFAULT_OUT, check: false, site: DEFAULT_SITE };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') options.out = path.resolve(argv[(i += 1)]);
    else if (arg === '--check') options.check = true;
    else if (arg === '--site') options.site = argv[(i += 1)].replace(/\/+$/, '');
    else if (arg === '--timeout') {
      const seconds = Number(argv[(i += 1)]);
      if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('--timeout 需要一个秒数');
      timeoutMs = Math.round(seconds * 1000);
    } else if (arg === '--help' || arg === '-h') {
      console.log('用法: node wiki-atlas.mjs [--out <file>] [--check] [--site <url>] [--timeout <秒>]');
      console.log(`默认：--out <skill>/references/ck3-wiki-atlas.md，--site ${DEFAULT_SITE}，--timeout 180`);
      process.exit(0);
    } else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await collect(options.site);
  assertCoverage(data.pages, data.missing);
  assertPatchCoverage(data.patchTitles);
  const markdown = render(data);

  if (options.check) {
    const existing = readBody(options.out);
    const fresh = markdown.slice(markdown.indexOf(`${BODY_MARKER}\n`) + BODY_MARKER.length + 1);
    if (existing === null) {
      console.error(`✗ 没有可比的索引：${options.out}（先不带 --check 生成一次）`);
      process.exit(1);
    }
    if (existing !== fresh) {
      const a = existing.split('\n');
      const b = fresh.split('\n');
      const at = a.findIndex((line, i) => line !== b[i]);
      console.error(`✗ 索引已漂移：${options.out}`);
      console.error(`  第 ${at + 1} 行起不同：`);
      console.error(`  - ${(a[at] ?? '<文件结束>').slice(0, 160)}`);
      console.error(`  + ${(b[at] ?? '<文件结束>').slice(0, 160)}`);
      console.error('  刷新：node scripts/wiki-atlas.mjs');
      process.exit(1);
    }
    console.log(`✓ 索引与线上 Wiki 一致（${data.pages.size} 页元数据，${data.validitySet.size} 页 ${VALIDITY_CATEGORY} 校验集）`);
    return;
  }

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, markdown, 'utf8');
  const bucketRows = DOMAINS.filter((d) => d.key !== 'new121' && d.key !== 'mech')
    .flatMap((d) => d.pages).length;
  const extraRows = DOMAINS.filter((d) => d.key !== 'new121' && d.key !== 'mech')
    .flatMap((d) => d.pages).filter((title) => !data.moddingTitles.has(title)).length;
  console.log(`✓ 已写入 ${options.out}`);
  console.log(
    `  Category:Modding ${data.moddingTitles.size} 页（表内 ${bucketRows} 行${extraRows > 0 ? `，含 ${extraRows} 个非分类页` : ''}）`
    + ` · 1.21 新内容 ${DOMAINS.find((d) => d.key === 'new121').pages.length} 页`
    + ` · 机制语义 ${DOMAINS.find((d) => d.key === 'mech').pages.length} 页`
    + ` · Category:${VALIDITY_CATEGORY} ${data.validitySet.size} 页 · 补丁 ${PATCHES.length} 条`,
  );
}

main().catch((error) => {
  console.error(`✗ 生成失败：${error instanceof Error ? error.message : String(error)}`);
  console.error('  现有索引未被修改；修好网络/参数后重跑。');
  process.exit(1);
});
