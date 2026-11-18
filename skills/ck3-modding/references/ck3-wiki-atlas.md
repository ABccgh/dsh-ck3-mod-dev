# CK3 Wiki 索引（生成物，勿手改表体）

> 生成时间：2026-11-18T07:22:58Z
> 站点：CK3 Wiki（MediaWiki 1.39.4）· https://ck3.paradoxwikis.com
> 体量：8307 页 / 494 条目 / 5485 文件
> 本机游戏：1.21.0 (Florin)
> 内容哈希：1e998d6a6ae053b8
>
> 这是**导航图，不是知识库**：只存标题、体积、最后编辑、`{{version}}` 声明与一句用法备注，不复制 Wiki 正文。
> 刷新：`node scripts/wiki-atlas.mjs`；验鲜：加 `--check`（有漂移退出码 1）。

---
<!-- atlas-body -->
## 怎么用这张表

1. 先定位：在下表找到话题 → 用 `ck3wiki_sections(title)` 看目录 → 再用 `ck3wiki_page(title, section=N)` 只读那节（整页动辄几十 KB，会吃满上下文）。
2. 「最后编辑」与「声明版本」是**新鲜度**判据：超过一年没动、又不在 `Category:1.21` 里的页，先当参考，结论回原版文件复核。
3. 「1.21」列 = 该页在 Wiki 的 `Category:1.21` 里，即被编辑者标为当前版本口径；空着不等于错，只是要多一分怀疑。
4. `Effects list` / `Triggers list` / `Data types` 是**抄录版**，Wiki 自己都写着 outdated → 只用来找名字，语法事实回 `ck3mod_vanilla`（`.info`）或控制台 `script_docs` 生成的日志。
5. 表里没有的话题 ≠ Wiki 没有：用 `ck3wiki_search` 全文检索，再用 `ck3wiki_page_info` 看最后编辑日期。
6. **1.21 期间 modding 页整体滞后**：`Category:1.21` 里只有 `Console commands` 一个 Modding 页。1.21 的结论默认走层 2（`.info`），Wiki 只取语义与示例。

## 入门与工程（7 页）

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| Console commands | 55.5 KB | 2026-11-17 | 1.21 | ✓ | 控制台命令全表（1.21 口径；含 scripted_tests / schedule_term_end / SplineNetwork.AppendAssets / replacebuilding） |
| Mod compatibility | 9.1 KB | 2025-12-30 | — |  | 整文件覆盖 vs 单对象覆盖、共享变量、探测他人 mod |
| Mod structure | 7.3 KB | 2023-10-13 | 1.1 |  | .mod 与 descriptor.mod 全部键（path / replace_path / supported_version / remote_file_id） |
| Mod troubleshooting | 10.6 KB | 2025-11-07 | — |  | 控制台、loc/scope 调试、热载、**run script 自动化** |
| Modding | 39.4 KB | 2026-10-07 | Timeless |  | 总入口：热重载、日志、覆盖规则、加载顺序、上传流程 |
| Modding tools | 5.9 KB | 2026-11-12 | Timeless |  | 社区工具表（ck3-tiger / PMT / meckt…），2026-11 仍在更新 |
| Modding: getting started | 20.7 KB | 2026-07-09 | — |  | 最短上手路径：debug_mode / release mode / 拿文档 |

## 脚本核心参考（19 页）

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| Commands | 48.1 KB | 2024-12-11 | 1.0 |  | 旧版命令页；与控制台相关的以 Console commands 为准 |
| Customizable localization | 2.2 KB | 2026-07-18 | — |  | 可定制本地化的键结构 |
| Data types | 88.6 KB | 2022-02-27 | — |  | 数据类型表；2022 年最后实质更新，命名以 .info 为准 |
| Defines | 17.4 KB | 2026-03-28 | 1.2 |  | 00_defines.txt 键表 |
| Effects | 277.2 KB | 2024-04-30 | 1.7 |  | 效果语义与用法 |
| Effects list | 266.9 KB | 2026-08-30 | — |  | **抄录版，页面自称会缺/含废弃项** → 以 script_docs 生成为准 |
| Flavorization | 9.8 KB | 2025-11-18 | — |  | 头衔/文化名号生成 |
| Interface | 57.8 KB | 2026-08-28 | Timeless |  | GUI 文件、模板、类型、数据绑定 |
| Localization | 22.2 KB | 2026-01-02 | 1.4 |  | 本地化格式、BOM、颜色码、$变量$ |
| Modifier list | 34.4 KB | 2025-03-24 | 1.12 |  | modifier 键全表（改数值必查；1.21 新增 trade / road / district 修正，仍以 _modifiers.info 为准） |
| Scopes | 17.7 KB | 2025-04-10 | 1.1 |  | 作用域语义与切换规则 |
| Scopes list | 10.3 KB | 2024-03-26 | — |  | 作用域清单（抄录版，以 .info 为准） |
| Script values | 5.6 KB | 2026-07-18 | — |  | script value 计算块 |
| Scripted effects | 1.4 KB | 2021-05-11 | Timeless |  | scripted_effects 复用 |
| Scripting | 26.4 KB | 2026-03-08 | Timeless |  | 脚本语言总览：作用域、列表、变量、结构 |
| Triggers | 14.1 KB | 2025-02-10 | 1.7 |  | 触发器语义与用法 |
| Triggers list | 162.2 KB | 2026-03-03 | — |  | **抄录版，页面自称 outdated** → 以 script_docs 生成为准 |
| Variables | 5.0 KB | 2025-09-30 | — |  | 脚本变量（set_variable 一族） |
| Weight modifier | 3.3 KB | 2024-03-30 | — |  | AI 权重修饰 |

## 内容域（*.modding）（21 页）

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| AI modding | 3.4 KB | 2026-07-18 | — |  | AI 权重、行为参数 |
| Artifact modding | 8.6 KB | 2026-01-21 | 1.8 |  | 宝物、词条、历史宝物 |
| Bookmarks modding | 6.2 KB | 2024-02-08 | 1.1 |  | 书签与开局角色 |
| Characters modding | 13.7 KB | 2026-10-16 | Timeless |  | 角色历史与属性；2026-10 更新 |
| Council modding | 3.9 KB | 2026-02-28 | — |  | 职位+任务；**special_council_position / max_amount 在 1.20 起已不可用** |
| Culture modding | 11.4 KB | 2026-05-04 | 1.4 |  | 文化、传统、革新 |
| Decisions modding | 12.7 KB | 2025-01-17 | 1.14 |  | 决策结构（含 major/minor、AI 权重） |
| Dynasties modding | 3.5 KB | 2021-02-01 | Timeless |  | 2021 年页， dynasty 字段以 common/dynasties 为准 |
| Event modding | 65.3 KB | 2026-10-19 | Timeless |  | 事件结构；2026-10 已按 1.20.1 更新（含触发/选项/动画表） |
| Governments modding | 2.5 KB | 2021-08-15 | — |  | 2021 页，**字段层级已变**（council 等在 government_rules 内）→ 以 .info 为准 |
| History modding | 8.7 KB | 2023-05-17 | 1.1 |  | 历史文件（角色/头衔/省份）；**1.21 省份历史改成按王国 k_*.txt** |
| Holdings modding | 9.9 KB | 2026-02-06 | 1.3 |  | 地产与建筑挂点；1.21 起 district 是独立数据库（common/districts） |
| Interactions modding | 1.4 KB | 2024-05-19 | — |  | **仅 1 个示例（1.4 KB）** → 细节看 common/character_interactions 的 .info；1.21 可指向贸易市场 / 贸易路线 |
| Lifestyles modding | 21.3 KB | 2026-07-18 | — |  | 生活方式树与 perk |
| Regiments modding | 4.6 KB | 2022-12-30 | 1.3 |  | 兵种与常备军；1.21 起 MAA 可存成 scope，政体有 title_maa_setup |
| Religions modding | 23.1 KB | 2026-10-10 | 1.20 |  | 信仰/教义/圣地；2026-10 更新 |
| Resources modding | 690 B | 2026-07-09 | 1.2 |  | **0.7 KB 且标题误导**：讲的是虔诚档位；1.21 仍无 common/resources/ → 资源硬编码 |
| Story cycles modding | 3.0 KB | 2024-10-14 | — |  | 结构对，但**漏了 visible/icon/visualization**（看不到的那一半） |
| Struggle modding | 16.9 KB | 2026-09-12 | — |  | 2026-09 更新，三域里最靠谱；路径 common/struggle/struggles/，起停在 history/struggles/ |
| Title modding | 11.4 KB | 2025-12-29 | 1.1 |  | 头衔层级、历史、法理；1.21 新增 market_capital 覆盖与静态 title type |
| Trait modding | 12.2 KB | 2026-09-04 | 1.0 |  | 特质字段与图标 |

## 1.21 新内容（Silk & Silver / Florin）（11 页）

1.21 / Silk & Silver 新增的玩家向页面。**Wiki 还没有对应的 `*modding` 页**：语义看这里，键名与参数一律回 `common/trade`、`common/districts`、`common/roads` 的 `.info`。

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| Adventurer lifestyle | 28.2 KB | 2026-11-18 | — | ✓ | 冒险者生活方式（1.21 新页） |
| Districts | 60.0 KB | 2026-11-18 | — | ✓ | 1.21 新页：地产区划（district）玩家向说明；脚本面看 common/districts/_districts.info |
| Education focus | 2.0 KB | 2026-11-17 | — | ✓ | 教育焦点（1.21 新页） |
| Great project districts | 9.3 KB | 2026-11-17 | — | ✓ | 大型工程区划（1.21 新页） |
| Market | 22.9 KB | 2026-11-17 | — | ✓ | 1.21 新机制：市场 / 贸易路线 / 商品需求；建贸易站的前置都在这 |
| Merchant | 29.2 KB | 2026-11-17 | — | ✓ | 商业共和国的 Trader 与 Trade Acumen（1.21 新页） |
| Merchant decisions | 10.9 KB | 2026-11-17 | — | ✓ | Trader 专属决策清单（1.21 新页） |
| Merchant lifestyle | 26.8 KB | 2026-11-17 | — | ✓ | Merchant 生活方式三条线（1.21 新页） |
| Republican | 34.0 KB | 2026-11-17 | — | ✓ | 商业共和国玩法（1.21 新页） |
| Special districts | 198.9 KB | 2026-11-17 | — | ✓ | 特殊区划清单（1.21 新页） |
| Trade company | 31.9 KB | 2026-11-17 | — | ✓ | 贸易公司（1.21 新页） |

## 机制语义（非 Modding 分类，按 modding 用途挑选）（25 页）

不在 `Category:Modding` 里、但 modding 常要查语义的机制页。Wiki 只答「是什么」，脚本怎么写仍回层 2。

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| Activity | 87.2 KB | 2026-11-17 | — | ✓ | 活动（狩猎 / 宴会 / 朝圣…）框架 |
| Army | 94.7 KB | 2026-11-18 | — | ✓ | 军队 / 常备军 / 补给（1.21 口径） |
| Artifacts | 36.4 KB | 2026-11-17 | — | ✓ | 宝物与词条 |
| Barony | 37.4 KB | 2026-11-17 | — | ✓ | 男爵领（最低级头衔） |
| Building | 19.3 KB | 2026-09-30 | — |  | 建筑清单与效果 |
| Casus belli | 49.8 KB | 2026-11-17 | — | ✓ | CB 玩家向语义；脚本字段看 _casus_belli.info 与 [cb] |
| Council | 39.4 KB | 2026-11-17 | — | ✓ | 议会玩法与任务（脚本面见 [council]） |
| County | 24.0 KB | 2026-11-17 | — | ✓ | 伯爵领：控制力 / 繁荣 / 民意 |
| Culture | 146.6 KB | 2026-11-17 | — | ✓ | 文化 / 传统 / 革新语义 |
| Doctrines | 80.3 KB | 2026-11-17 | — | ✓ | 教义清单与互斥 |
| Government | 44.7 KB | 2026-11-17 | — | ✓ | 政体玩法；脚本字段看 _governments.info 与 [government] |
| Hired forces | 12.4 KB | 2026-11-17 | — | ✓ | 雇佣兵与骑士团 |
| Innovation | 80.1 KB | 2026-11-17 | — | ✓ | 革新与时代 |
| Laws | 10.6 KB | 2026-11-17 | — | ✓ | 法律体系；1.21 起 law 可作 scope（见 [laws]） |
| Modifiers | 84.0 KB | 2026-11-17 | — | ✓ | 修正语义与来源；键表仍以 _modifiers.info 为准 |
| Religion | 47.3 KB | 2026-11-17 | — | ✓ | 宗教体系语义 |
| Schemes | 80.6 KB | 2026-11-17 | — | ✓ | 阴谋 / 计谋（含 1.21 贸易计谋） |
| Situation | 87.2 KB | 2026-11-17 | — | ✓ | 局势（Situation）机制 |
| Stories | 29.9 KB | 2026-11-17 | — | ✓ | 故事循环（玩家向；脚本面见 [story]） |
| Struggles | 45.4 KB | 2026-11-17 | — | ✓ | 斗争（玩家向；脚本面见 [struggle]） |
| Tenet | 141.6 KB | 2026-11-17 | — | ✓ | 信条 |
| Titles | 33.1 KB | 2026-11-17 | — | ✓ | 头衔层级 / 法理 / 继承（1.21 口径） |
| Traditions | 388.8 KB | 2026-11-17 | — |  | 传统清单（1.21 口径） |
| Traits | 175.7 KB | 2026-11-17 | — | ✓ | 特质玩家向效果表（找 ID 用） |
| Warfare | 37.6 KB | 2026-11-17 | — | ✓ | 战争流程与战争分数 |

## 美术 / 地图 / 音频（9 页）

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| 3D models | 12.2 KB | 2025-04-05 | Timeless |  | 模型与 .mesh 资产 |
| Coat of arms modding | 14.3 KB | 2025-02-13 | Timeless |  | 纹章图案与分层 |
| Exporters | 3.1 KB | 2020-10-01 | Timeless |  | Paradox 官方导出器 |
| Fonts | 3.7 KB | 2026-08-02 | — |  | 字体与字形 |
| Graphical assets | 323 B | 2024-02-26 | Timeless |  | 0.3 KB 目录页，按需再展开 |
| Map modding | 32.1 KB | 2026-05-17 | 1.1 |  | 地图、省份、高度图 |
| Music modding | 1.9 KB | 2026-06-08 | — |  | 音乐挂载 |
| Sound modding | 12.4 KB | 2025-09-03 | — |  | 音效事件与 bank |
| Terrain modding | 8.0 KB | 2025-10-28 | — |  | 地形类型与贴图 |

## 数据列表（2 页）

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| List of baronies | 53.2 KB | 2026-07-18 | — |  | 男爵领全表（找 ID 用） |
| Lists | 3.3 KB | 2024-07-06 | — |  | 数据列表索引页 |

## 非通用（Paradox 自家 mod 文档）（9 页）

Paradox 自家 mod 的机制文档。只有在研究「官方 mod 怎么组织内容」时才看；我们四个 mod 不依赖其中任何一条。

| 页面 | 体积 | 最后编辑 | 声明版本 | 1.21 | 备注 |
|---|---:|---|---|:--:|---|
| Kingdom of Heaven | 2.3 KB | 2021-11-25 | — |  | — |
| Way of Kings | 22.6 KB | 2024-10-04 | — |  | — |
| Way of Kings/Boons | 5.4 KB | 2021-11-17 | — |  | — |
| Way of Kings/Consent | 2.0 KB | 2021-11-18 | — |  | — |
| Way of Kings/Dungeon Delve | 5.8 KB | 2021-11-15 | — |  | — |
| Way of Kings/Game Pass | 818 B | 2021-11-16 | — |  | — |
| Way of Kings/Governments | 6.1 KB | 2021-11-18 | — |  | — |
| Way of Kings/Knights Radiant | 13.5 KB | 2021-11-19 | — |  | — |
| Way of Kings/Shardic Victories | 7.6 KB | 2023-09-27 | — |  | — |

## Category:1.21 校验集（75 页）

Wiki 编辑者标注为「1.21 口径」的页面。做 1.21 相关改动时优先从这批起步；**本版里面只有 `Console commands` 一个 Modding 页**，其余全是玩家向，modding 结论不能拿它免检。

- Abrahamic religions · Achievement · Activity · Administrative
- Administrative estate · Adventurer · Adventurer decisions · Adventurer lifestyle
- Alliance · Army · Artifacts · Attributes
- Authority laws · Barony · Camp · Casus belli
- Celestial · Celestial estate · Character · Character decisions
- Console commands · Council · County · Court
- Culture · Dharmic religions · Districts · Doctrines
- Domicile · Dynasty · Ecclesiastical estate · Education focus
- Government · Great project districts · Great projects · Hired forces
- Historical artifacts · Holy relics · Holy sites · Hooks
- Innovation · Knight · Laws · Lifestyle
- List of hegemonies · Manor · Market · Merchant
- Merchant decisions · Merchant lifestyle · Meritocratic · Modifiers
- Nomadic capital · Pagan religions · Power sharing · Prisoner
- Religion · Republican · Resources · Ritsuryō
- Royal court · Schemes · Sinitic religions · Situation
- Special districts · Stories · Struggles · Subjects
- Succession laws · Tenet · Titles · Trade company
- Traits · Travel · Warfare

## 补丁链

| 页面 | 体积 | 最后编辑 | 用途 |
|---|---:|---|---|
| Patches | 8.1 KB | 2026-11-17 | 版本总表 |
| Patch 1.21 | 212.0 KB | 2026-11-17 | 2026-11-17 与 Silk & Silver 同日；trade / districts / roads / laws 的脚本面源头 |
| Patch 1.20 | 85.5 KB | 2026-09-30 | 2026-09-30 与 By God Alone 同日；上一个机制大版本 |
| Patch 1.20.X | 43.9 KB | 2026-11-17 | 1.20.0.3 / 0.4 / 1.20.1 / 1.20.1.2 修复链 |
| Patch 1.19 | 49.8 KB | 2026-09-30 | 2026-04-20；1.20 之前的基线 |
| Patch 1.19.X | 2.6 KB | 2026-09-30 | 1.19.x 修复链 |

## 三层真相（写改动前默念一遍）

| 层 | 来源 | 能回答什么 | 什么时候别信 |
|---|---|---|---|
| 1 | 本 Wiki | 语义、示例、工作流、补丁说明 | 页面 >1 年未动；`*list` 抄录页 |
| 2 | 本机原版 1.21.0 (Florin)（`.info` / `common`，经 `ck3mod_vanilla`；或控制台 `script_docs`） | 键名、类型、参数、是否仍存在 | 只有 DLC 新内容时才可能缺 |
| 3 | 四个 mod 自己的 `数据-*.mjs` + 工具-静态校验 + loc 检查 | 我们自己的不变量与契约 | 只覆盖我们写过的规则 |

## 范围与排除

- 本表覆盖 `Category:Modding` 全部页面 + **1.21 新内容（11 页）** + **机制语义（25 页）** + 补丁链；`Category:1.21` 只用来判新鲜度，不逐条展开。
- **不收录**：`Category:Mods` 下 9 个第三方 mod 分类（CK3AGOT · LotR:RiE · RICE · Rajas of Asia · The Fallen Eagle · Way of Kings · When the World Stopped Making Sense · WCGOA · Mod images），合计约 115 页。我们只借鉴模式，不抄工坊 mod 的代码与文案（skill 硬规则 8）。
- 机制语义那一桶是**按 modding 用途手挑的**，不是 Category:Modding 的成员；没挑进来的玩家向页面（如 `Achievement`、`Beginner's guide`）用 `ck3wiki_search` 现查即可。
- 表是生成时的快照（生成时间见文件头）；下次 CK3 更新后先跑一次 `node scripts/wiki-atlas.mjs` 再开工。
