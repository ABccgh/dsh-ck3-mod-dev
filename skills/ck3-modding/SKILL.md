---
name: ck3-modding
description: |
  Use for Crusader Kings III mod work in D:\DSH workspace: researching current
  mechanics on the CK3 Wiki, editing scripts, events, interactions, decisions,
  casus belli, localization, descriptors, thumbnails; running static validation,
  shared loc checks, reverse verification, headless smoke tests, local deployment,
  in-game acceptance, and Steam Workshop updates. Load this before touching any of
  the five published mods, the shared toolchain, or the wiki atlas.
metadata:
  author: "local workspace"
  version: "0.10.0"
---

# CK3 Modding — Workspace Playbook

## When to use

Load this skill when the task concerns:

- any of the five in-service mods（在营 5 个）: `ck3-auto-spread`, `ck3-de-jure-conquest`,
  `ck3-de-jure-organizer`, `ck3-free-resources`, `ck3-scheme-mastery`;
- the shared checker in `D:\DSH workspace\ck3-modding-tools`;
- **查 CK3 Wiki**：某个 trigger/effect/字段现在到底怎么写、1.21 改了什么；
- localization, script validation, headless checks, deployment, or Workshop uploads;
- the research report in `D:\DSH workspace\ck3-modding-survey`.

Do **not** load it for playing the game or for unrelated projects.

## Read first (in this order)

1. `D:\DSH workspace\工作区索引.md` — current state, version notes, which mod is where.
2. The mod's `README.md` — its "怎么改 / 下次 CK3 更新时 / 注意事项" sections are the operational truth.
3. `references/ck3-wiki-atlas.md`（本 skill 目录下，加载 skill 时会给 base dir）——
   Wiki 全量导航：67 个 modding 页 + 1.21 新内容 11 页 + 机制语义 27 页 + 补丁链 7 条（含 `Patch 1.21.X` 双热修节），
   含最后编辑、`{{version}}`、是否 1.21 口径。
4. `references/verified-notes.md` — **动手前**按路由表的「要点」列读对应小节（`[interaction]` / `[cb]` /
   `[district]` …）：1.21.0 实测结论，每条带 `.info` 行号，只读需要的那节。
5. `references/ingame-acceptance.md` — **要进游戏验收时**读它：准备/启动/五 mod 矩阵/证据/收尾。
6. `D:\DSH workspace\ck3-modding-survey\06-落地候选.md` — if the task is "what should we do next".
7. `D:\DSH workspace\ck3-modding-survey\03-工具链与测试.md` — if the task involves tests/tooling.

Never infer a path or a command from memory; read the mod README first.

## Environment

- Game: `D:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III` (never edit it).
- User data: `C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III`.
- Node (not on PATH):
  `C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`
- Python (not on PATH):
  `C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
- Steam Workshop content: `D:\Program Files (x86)\Steam\steamapps\workshop\content\1158310`.
- Game version: **1.21.0.3 "Florin"**（Wiki 记 1.21.0 于 2026-11-17 与 Silk & Silver 同日发布；本机 2026-11-18 首次安装）。
  **两次热修**：① 2026-11-19 13:28，buildid `26622941 → 26757580`，81 个文件被替换
  （`game/common` 31 · `localization` 27 · `history` 11 · `events` 3 · `gui` 3 …）；
  ② 2026-11-19 23:12（本地），buildid `26757580 → 26785313`——Wiki 的 `Patch 1.21.X` 页现在有
  **`1.21.0.3`（2026-11-19）** 节，就是这一次。
  **版本串没变**：`titus_branch.txt` 仍 `release/1.21.0`、`binaries\ck3.exe` 仍嵌 `1.21.0`/`Florin`、
  `launcher-settings.json` 由启动器回写、可能滞后 → **判「吃没吃热修」看 buildid + 文件 mtime**，
  `ck3mod_status` 的「游戏构建」行已报；每次热修后第一件事仍是 `check --all`。详见 `[hotfix]`。
- 在营 5 个 mod 的当前发布快照（**五个都已按 1.21 发布**）：`ck3-auto-spread` **2.1** ·
  `ck3-de-jure-conquest` **2.3** · `ck3-free-resources` **4.1** · `ck3-scheme-mastery` **1.0** ·
  `ck3-de-jure-organizer` **1.0**。
  free 2026-11-18 16:23、auto 同日 20:21、de-jure 同日 22:41、mastery 2026-11-19（工坊 **3842327113**、
  tag `Gameplay`）、organizer 2026-11-20 15:05（工坊 **3842795131**）。仓库快照 `supported_version="1.21.*"`；
  free / auto / dejure / mastery 的工坊侧被启动器回写成 `1.21.0`，**organizer 首传后仍是 `1.21.*`**——
  首传的回写信号是 descriptor 新增 `remote_file_id`（见硬规则 40）。free 工坊 `file_size` 96,074 B，
  auto 内层 75,393 B、精确 `file_size` 记 **SKIP**——shell 拿不到 Steam API key；
  de-jure 的页面信号某轮断网 SKIP，只核到 descriptor 回写 + 双层字节形状 257/163 B 未变。
  mastery **首次**上传后两份 descriptor 是「回写 `1.21.0` **+ 新增一行 `remote_file_id`**」：235 / 142 B、
  末字节 `"`（回填前 207 / 114 B）；organizer 首传只 +28 B（233→261 / 138→166 B），`supported_version` 没动。
  见 `[release]`。
- **前置库 `ck3-de-jure-core`（法理核心 1.2，已上传 3843429156）**：`cn_dejure_core` 只有 2 个脚本文件
  （7 effects + 8 triggers），**无决议/事件/loc/入口**；dejure **2.6**（已上传 3803258931）/ organizer **1.3**（已上传 3842795131）
  的 descriptor 写 `dependencies={ "法理核心 - De Jure Core" }`，必须三件套一起装；单独启用消费者会报
  `Unknown effect/trigger`。加载顺序把 core 放消费者上面。`configs.mjs` 现有 **6 个条目**
  （5 个原已发布 + core 1.2 已上传），`check --all` 6/6、`reverse --all` 6/6（core 的 shared loc 变异按「无 loc」跳过）。
  **共享战后窗口**：flag `cn_dejure_core_recent_conquest` 365 天；dejure 胜利 mark；organizer 窗口内 cost 0/0；
  两者都用 core clear 消耗；**1.2 软合并标记** `SUITE_MARKER = cn_dejure_suite_organizer`（organizer on_action 设置，dejure 读取）；
  详见 `[dependency]`。**2026-11-21 项目收尾**：三件套全部上传（core 3843429156 / dejure 2.6 3803258931 / organizer 1.3 3842795131）；
  本机副本/`%TEMP%` 测试物已清，发布快照/审计保留；M1–M4b 用户 PASS、M5/M6 SKIP；见 `.admin/retro-2026-11-21-ck3mod-suite.md`。
- **降祸 mod（curse）已于 2026-11-19 彻底删除**：工坊下架、仓库整目录移除、`ck3-modding-tools/configs.mjs`
  条目摘除。历史只留在 `.admin` 与 `工作区索引.md`；**别再按它写命令、验收项或检查项**。
- **六个工坊条目的本机副本都已删**（三件套 + free/auto/mastery；改用工坊订阅，避免重复定义）；要本地测先跑各自
  `工具-部署.mjs` 重建（mastery / de-jure / auto / organizer 支持 `--clean`，free 只有 `--check`）。
  `mod` 下的 `ugc_*.mod` 是 launcher 的工坊描述符，不是本机副本；新 core（3843429156）需先订阅才会出现。
- **新版本上手第一件事**：跑该 mod 的 `工具-静态校验.mjs`。H 段（引擎 token）与 H2 段（原版角色货币覆盖）
  会回答「只发兼容版，还是要功能更新」——free 的 H2 就是 2026-11-18 为此加的。
  **判完若只是兼容发布，再用 L 段（`v_prev` ↔ `v_new` 差异断言）把「兼容发布 = 内容零改动」变成机器事实**，
  别停在口头承诺（auto v2.1 即此型）。
- 改之前先复核：`ck3mod_status`（预设内）或 `cli.mjs check --all`，确认基线还是绿的。

## 1.21 变化（大版本迁移必读）

1.20 → 1.21 是本项目遇到的最大一次脚本面变动。**先扫这段，再按路由表去读 `references/verified-notes.md` 的对应节。**

- **`development` 在脚本里已改名 `prosperity`**：county 属性、修正、档位全换（`prosperity_growth`、
  `terrible/bad/medium/good/great/max_prosperity_level`）。写 `development` 不会再命中。
- **收入拆家**：角色侧仍是 `monthly_income`；province 侧 patch note 说叫 `monthly_tax`，但 1.21 安装目录里
  **`monthly_tax` 0 处**，实际是 `total_monthly_tax_income` 与 `monthly_<税种>_tax`。名字以 grep 为准。
- **省份历史重构**：`history/provinces/` 不再有 `00_*.txt` 总表，改成按王国分文件（`k_england.txt` …）；
  `province_mapping` 已移除。动 history 前先看 `history/_provinces.info`。
- **新区划系统**：`common/districts/` 独立数据库（`district_type`），holding 侧对称有 `primary_district`/`districts`；
  `has_free_building_slot` 现在跑 **district** scope，`has_free_district_slot` 跑 province。见 `[district]`。
- **新贸易系统**：`common/trade/{trade_good_types,trade_good_categories,county_potential_trade_goods,trade_market_toll_levels}`、
  `common/trade_tasks/`、政体 `trade_post` 规则。Wiki **没有** modding 页。见 `[trade]`。
- **新道路系统**：`common/roads/{road_types,road_modifiers}` + spline；Documents 里的 `spline_network.splnet`
  副本会永久盖住原版，是硬坑。见 `[road]`。
- **法律可作 scope**：1.21 起 law 能当 scope（flavorization 可用），elections 对 Realm 与 Title law 都有效。
  见 `[laws]`。
- **其他改名/移除**：`has_ongoing_construction` 拆成 `has_ongoing_holding_construction` /
  `has_ongoing_trade_post_construction`；`monthly_income_per_piety_level` 移除；`scheme_discovery_chance_mult`
  说移除但定义还在；驻军 MAA 维护修正只剩 `men_at_arms_maintenance`；虔诚档位改名成
  `miniscule_piety_value`…`monumental_piety_value`（旧的 `LEVEL_piety_value` 已不存在）。
- **CB 重构**：`_casus_belli_groups.info` 搬到 `common/casus_belli_groups/`，新增 `should_invalidate` 等字段；
  CB 的 cost / AI score / trigger 被"清理成更易 patch"的形式。见 `[cb]`。
- **`game/tests/` + `scripted_tests`**：1.21 自带 20 个脚本测试文件，`tests/_tests.info` 写明用控制台
  `scripted_tests [pattern]` 运行。但**自动入口仍未打通**（见硬规则 9）。
- **两次热修（2026-11-18 / 2026-11-19，Wiki 页 `Patch 1.21.X`）**：① `1.21 hotfix`（2026-11-18）纯平衡
  （867/1066 起始军队、Norse/Varangian 入侵规模、MAA 招募与维护折扣、Yangzhou 改产丝绸）+ 崩溃修复 +
  贸易/选举若干 bugfix；② **`1.21.0.3`（2026-11-19）**：起始领地宽限恢复、村庄/城墙/庄园补征召兵、
  行政/天朝/贤能政体的征召兵惩罚减半、**建衔与篡位金币成本下调**、修「不可见的 Guelphs & Ghibellines
  开局暂停」。两节都**没有 Modding 段**；Wiki 现已给出 `1.21.0.3` 编号（别再写「页面没版本号」）。
  本机 11-19 收到两次；在营 **5 个** `check --all` 仍 **5/5** → 与我们的脚本面不相交。见 `[hotfix]`。

## 查资料：三层真相

写任何脚本前先想清楚「这条结论该信谁」。三层混用是这类工作最常见的错误来源。

| 层 | 来源 | 能回答什么 | 什么时候别信 |
|---|---|---|---|
| 1 | CK3 Wiki（`ck3wiki_*` 工具） | 语义、示例、工作流、补丁说明 | 页面 >1 年没动；`Effects list` / `Triggers list` 这类抄录页 |
| 2 | 本机原版 1.21.0.3：`.info` 文档与 `common/`（`ck3mod_vanilla`） | 键名、类型、参数、这个键现在还在不在 | 只有 DLC 新内容才可能缺 |
| 3 | 在营 5 个 mod 自己的 `数据-*.mjs` + `工具-静态校验.mjs` + loc 检查 | 我们自己的不变量与契约 | 只覆盖我们写过的规则 |

**1.21 期间的额外纪律**：Wiki 的 modding 层整体没跟上——`Category:1.21` 79 页里只有 `Console commands`
一个 Modding 页。所以 **1.21 的结论默认先走层 2（`.info` + 现行脚本），Wiki 只取语义与示例**；
patch note 也不可信到名字级别（见 `verified-notes.md` 顶部「改名与落差」表）。

### Wiki 怎么查（工具顺序，省 token）

1. `references/ck3-wiki-atlas.md` 查页面名与新鲜度（离线，零成本）；
2. `ck3wiki_sections(title)` 看目录 → `ck3wiki_page(title, section=N)` 只读那一节
   （整页动辄 40–280 KB，直接读会吃满上下文；`maxChars` 默认 20000，上限 60000）；
3. 表里没有的 → `ck3wiki_search` 全文；名字不确定 → `ck3wiki_titles`；
   判新鲜度 → `ck3wiki_page_info`（最后编辑/字节数/分类）；
   跟版本 → `ck3wiki_recent_changes`；
4. 工具报错先 `ck3wiki_status`。

**硬规定**

- `Effects list`（267 KB）与 `Triggers list`（162 KB）是**抄录版**，Wiki 自己写着
  「outdated，有废弃的、也有缺的」——只用来找名字，语法一律回层 2 复核。
- 页首 `{{version|X}}` 与「最后编辑」都给新鲜度：停在 `1.1` / 2020–2023 的页先当参考。
- `Category:1.21`（79 页）是编辑者标的「当前版本口径」，可以当起点，但不是免检章。
- 不抄正文进仓库：索引只存标题/日期/一句备注，正文用工具现读。

### 路由表：什么话题去哪个页面

「要点」列指向 `references/verified-notes.md` 里的实测小节（本 skill 目录下）：**按需只读一节，不要整篇读**；
`—` 表示这个域还没核过。每条都带 1.21.0.3 的 `.info` 行号或原版脚本行号。

| 要做的事 | Wiki（层 1） | 语法真相（层 2） | 要点 |
|---|---|---|---|
| 事件 | `Event modding`（2026-10 按 1.20.1 更新） | `events/` + `events/*.info` | — |
| 角色互动 | `Interactions modding`（**只有 1 个示例，1.4 KB**） | `common/character_interactions/` + `.info` | `[interaction]` |
| 决策 | `Decisions modding`；玩家向 `Character decisions` | `common/decisions/` + `.info` | — |
| 特质 | `Trait modding`；玩家向 `Traits` | `common/traits/` + `.info` | — |
| 宣战理由 CB | **无专页**；`Casus belli` 是玩家向机制页 | `common/casus_belli_types/` + `_casus_belli.info`；**组在 `common/casus_belli_groups/`** | `[cb]` |
| 头衔 / 法理 | `Title modding`；机制语义 `Titles`（§De Jure 给阈值语义） | `common/titles/`、`history/titles/` | `[title]` |
| 头衔变更 / 封臣树 / 建档 | `Titles`；`Effects list`（`change_title_holder` / `create_title_and_vassal_change` / `resolve_title_and_vassal_change` / `every_alert_creatable_title`）、`Triggers list`（`is_vassal_or_below_of` / `is_de_jure_liege_or_above_target`）、`Scopes list`（`title_capital_county`）；**`Mod troubleshooting §9` 是可运行的批量易手范例** | `common/character_interactions/`、`on_action/title_on_actions.txt`、`_scripted_character_templates.info` | `[title]` |
| 文化 / 传统 | `Culture modding`；`Culture`、`Traditions` | `common/culture/` | — |
| 宗教 / 教义 | `Religions modding`（1.20 口径）；`Religion`、`Doctrines`、`Tenet` | `common/religion/` | — |
| 政体 | `Governments modding`（2021 页，旧） | `common/governments/` + `.info`；跨政体/封臣树判定见 `[title]` | `[government]` |
| 议会 | `Council modding`；玩家向 `Council` | `common/council_positions/`、`common/council_tasks/` | `[council]` |
| 地产 / 区划 | `Holdings modding`（旧）；1.21 玩家向 `Districts`、`Special districts`、`Great project districts` | `common/holdings/`、**`common/districts/`**、`common/buildings/` | `[district]` |
| 建筑 / 市场修正 | `Buildings`（2026-11-19 被清成 **85 B 占位页**，清单已并入 `Districts`）；1.21 玩家向 `Market` | `common/buildings/_buildings.info` | `[district]` |
| 贸易 / 商业共和国 | **无 modding 页**；`Market`、`Merchant`、`Merchant lifestyle`、`Republican`、`Trade company` | `common/trade/**`、`common/trade_tasks/` | `[trade]` |
| 道路 / 地图样条 | **无专页**；`Map modding` | `common/roads/**` + `gfx/map/spline_network/` | `[road]` |
| 法律 | `Laws`（1.21 口径） | `common/laws/_laws.info`、`common/law_groups/` | `[laws]` |
| 兵种 / 常备军 | `Regiments modding`；`Army`、`Hired forces`；成本表由 `Base Army Cost` 驱动 | `common/men_at_arms_types/` | — |
| 生活方式 | `Lifestyles modding`；`Lifestyle`（枢纽）、`Ruler lifestyle`、`Adventurer lifestyle`、`Merchant lifestyle` | `common/lifestyle_perks/` | — |
| 宝物 | `Artifact modding`；`Artifacts` | `common/artifacts/` | — |
| 历史（角色/头衔/省份） | `History modding` | `history/`（**省份已按王国分文件**） | — |
| 故事循环 | `Story cycles modding`；`Stories` | `common/story_cycles/` + `create_story` | `[story]` |
| 斗争 | `Struggle modding`（2026-09，质量较好） | `common/struggle/struggles/`、`history/struggles/` | `[struggle]` |
| 局势 / 活动 | `Situation`、`Activity` | `common/situation/`、`common/activities/` | — |
| 计谋 | `Schemes`（玩家向机制页，**无 modding 页**） | `common/schemes/scheme_types/` + `_schemes.info`；成功率键在 `modifier_definition_formats/00_definitions.txt` | `[scheme]` |
| AI 权重 | `AI modding`、`Weight modifier` | `common/scripted_*`、`ai_*.info` | — |
| 变量 / 脚本值 | `Variables`、`Script values` | `.info` | — |
| 资源 / 成本档位 | `Resources modding`（**标题误导**：实为虔诚档位） | `common/script_values/00_basic_values.txt` | `[resources]` |
| modifier 键 | `Modifier list`（35 KB，1.12 口径） | `common/modifier_definition_formats/*.txt` | — |
| 本地化 | `Localization`、`Customizable localization` | `localization/**/*.yml` | — |
| GUI | `Interface` | `gui/**/*.gui`、`interface.info` | — |
| 地图 / 地形 | `Map modding`、`Terrain modding` | `map_data/` | — |
| 控制台与调试 | `Mod troubleshooting`、`Console commands`（1.21） | `_commandline_options.info` | — |
| 真机验收 / 启动参数 / 存档保护 | —（`_commandline_options.info` 就是文档） | `_commandline_options.info`、`pdx_settings.txt`、`game/tests/` | `[ingame]` |
| 发布 / 工坊核对 / descriptor 形状 | `Mod structure`（2023 页，键表仍准） | 各 mod 的 `.mod` / `descriptor.mod`、`数据-元数据.mjs` | `[release]` |
| 热修 / 版本口径 | `Patches`、`Patch 1.21`、`Patch 1.21.X` | `appmanifest_1158310.acf` 的 buildid + `ck3.exe` mtime（`ck3mod_status` 会报）；`_commandline_options.info` | `[hotfix]` |
| 机器代点 / 探针 / 点击纪律 | — | `references/ingame-acceptance.md` §9 | `[automation]` |
| 打包 / descriptor | `Mod structure`（2023 页，键表仍准） | 各 mod 的 `.mod` / `descriptor.mod` | — |
| 兼容 / 覆盖 | `Mod compatibility`、`Modding` 的 Override rules | — | — |

## Shared checker (candidates 1/3)

`D:\DSH workspace\ck3-modding-tools`:

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\ck3-modding-tools"

& $node .\cli.mjs selftest          # loc 检查自测：5 bad samples -> 6 findings
& $node .\cli.mjs check --all       # loc + existing static validators
& $node .\cli.mjs loc --all         # loc only
& $node .\cli.mjs reverse --all     # 5 generic loc mutations + project-specific reversals
& $node .\cli.mjs check --all --json

$py = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
& $py .\spellcheck.py              # English spelling fallback（ck3spell 下载被 hosts 阻断）
```

Per-mod wrapper (same semantics):

```powershell
cd "D:\DSH workspace\ck3-scheme-mastery"
& $node .\工具-检查.mjs check
& $node .\工具-检查.mjs loc
& $node .\工具-检查.mjs reverse

# 反例样本：--root 只对单个 mod 的 check 生效（相对路径按调用方 cwd 解析）
& $node .\工具-检查.mjs check --root "..\ck3-de-jure-conquest\cn_dejure_conquest-v1.0"
```

`--root` 由 `cli.mjs` 原样转给该 mod 的静态校验器；`--all` / `loc` / `reverse` 配 `--root`、
以及任何**未知参数都会报错退出 2**——2026-11-18 之前它们被静默忽略，`check --root <目录>`
会照常跑发布快照并 PASS，等于「以为验了反例、其实没验」。

Baseline at 2026-11-20 (1.21.0.3): mastery loc 34 / de-jure 28（v2.3，移除战后报告后 36→28）/ free 84 / auto 94 /
organizer 20, all 0 errors, `check --all` **5/5 PASS**、`reverse --all` **5/5 PASS**
（organizer 29 例、mastery 13 例、auto 7 例，其余按各自脚本）。
`auto` / `dejure` / `mastery` / `organizer` 的静态校验都支持 `--root`；
`check` runs against the release snapshot and passes. Passing `--root` is preferred over deploying a local copy.
Spelling: `ck3spell` is blocked by hosts; `spellcheck.py` (pyspellchecker + game English corpus)
found 0 real typos in the five mods; only the `behaviour`/`behavior` style variant.

## Native tools (agent preset「CK3 模组开发」)

If this session runs the `ck3mod` preset, the host exposes 8 `ck3mod_*` tools. They wrap this
checker and each mod's own `工具-*.mjs`; prefer them over hand-written PowerShell:

| Tool | Use it for | Writes |
|---|---|---|
| `ck3mod_status` | env + 在营 5 个 overview before starting: snapshot / local copy / capabilities / git / game version + **Steam buildid 与安装时间**（判热修用） | — |
| `ck3mod_check` | `check` / `loc` / `reverse` / `selftest` (structured PASS/FAIL + loc counts) | — |
| `ck3mod_build` | `generate` / `normalize` (write), or `*-check` to compare only | release snapshot |
| `ck3mod_deploy` | `deploy` / `check` / `clean` through the mod's own 部署 script | `Documents\...\mod` |
| `ck3mod_headless` | backup → single-mod playset → ck3.exe → restore + SHA256 → log triage | `dlc_load.json` (restored) |
| `ck3mod_logs` | `error.log` `[E]` lines; `debug.log` Enabled / Mounted isolation | — |
| `ck3mod_vanilla` | search the installed 1.21.0.3 scripts / loc / `.info` docs for real triggers and effects | — |
| `ck3mod_workshop` | per-segment description bytes (≤ 8000), descriptor fields, empty `remote_file_id` | — |

Wiki 工具（同一会话里保留可见，只读）：

| Tool | 用来 |
|---|---|
| `ck3wiki_category` | 取清单：`Modding`（67 页）/ `1.21`（79 页） |
| `ck3wiki_search` | 全文检索（支持 `incategory:` / `insource:` / `intitle:`） |
| `ck3wiki_titles` | 名字对不准时先搜标题 |
| `ck3wiki_sections` | 长页先看目录，再按节读 |
| `ck3wiki_page` | 读正文（`section=N` 或 `format=wikitext`） |
| `ck3wiki_page_info` | 最后编辑 / 字节数 / 分类 → 判新鲜度 |
| `ck3wiki_recent_changes` | 最近改动，跟版本 |
| `ck3wiki_status` | 连不通时先查 |

`ck3mod_headless` is the **only** sanctioned way to touch `dlc_load.json` — never hand-write it.
Tools absent (another preset)? fall back to the commands above.

## Per-mod pipeline

Common order: **edit source → generate (if table-driven) → normalize → check → headless → deploy → in-game → upload**.

| Mod | Source of truth | Generate/normalize | Check | Notes |
|---|---|---|---|---|
| `ck3-scheme-mastery` | `数据-设计.mjs`（三档数值 / 5 个类别 / loc 键）+ hand-written modifiers / decisions / events / loc | `工具-生成.mjs`（**只生成两份 descriptor**）、`工具-规范化.mjs`、`工具-缩略图.py` | `工具-检查.mjs`（静态 **A–N**，核心 **L0 类别覆盖率**：扫安装目录 `scheme_types` 反查类别；反向 **13**；`--root` 可验任意目录） | 决议「豢养刺客」+ 3 档角色修正 + 1 个面板事件；成功率上限 95%（contract 100%）；「所有计谋」靠 L0 机器证明，见 `[scheme]` |
| `ck3-de-jure-conquest` | `数据-mod表.mjs` + CB script/loc | `工具-生成.mjs`, `工具-规范化.mjs` | `工具-检查.mjs`（静态 **A–O**：B 含 descriptor 字节形状 + `dependencies`；H 跳 core 调用 + 交叉核对 mark；M 决策只调 core（0 内联）+ 窗口 trigger/clear + 软合并标记锚点；N v2.5↔v2.6 差异；O configs↔快照；`--root` v1.0 must report **20**） | CB is hand-written; **2.6 = 软合并**（organizer 在场 + 公爵级 + 有首都时本决议隐藏）；2.5 = 共享窗口；2.4 = 决策循环体搬到 core；v2.3 = 1.21 兼容 |
| `ck3-free-resources` | `数据-资源表.mjs` | `工具-生成.mjs` (golden check), `工具-部署.mjs` | `工具-检查.mjs` | generated events/loc; never hand-edit products |
| `ck3-auto-spread` | `数据-元数据.mjs`（META / 快照路径）+ hand-written script/loc | `工具-生成.mjs`（**只生成两份 descriptor**，`--check` golden） | `工具-检查.mjs`（静态 A–M，含 L 段差异；loc 94；reverse 7） | settings via global variables + game rules；v2.1 起有 `工具-部署.mjs`（`--check` / `--clean`），**没有内容生成器** |
| `ck3-de-jure-organizer` | `数据-设计.mjs`（5 阶段 / 12 事务 / 补建与授予级数 / 窗口成本）+ `数据-元数据.mjs`；effects / triggers / decisions / values / on_action 手写 | `工具-生成.mjs`（**只生成两份 descriptor**）、`工具-规范化.mjs`、`工具-缩略图.py` | `工具-检查.mjs`（静态 **A–P**：H4 调 core 契约 + 窗口预建衔/clear + marker 使用点；H5/H7/H8/H9；H6 cost 脚本值；**H10 on_action 只追加**；**L0–L11**；L5；P v1.2↔v1.3；反向 **40**；部署 `--check` / `--clean`） | 单决议「一键法理整顿」；**1.3 = 唯一合并决议（窗口内先建衔再整顿、dejure 让位）**；1.2 = 窗口 0/0；1.1 = P3/P4/新伯爵/7 守卫搬到 core；「所有政体」= 7 政体 + 封臣统治者探针 8/8，见 `[title]` |
| `ck3-de-jure-core` | `数据-接口.mjs`（7 effects + 8 triggers + `SUITE_MARKER`，唯一事实来源）+ `数据-元数据.mjs`；effects / triggers 手写 | `工具-生成.mjs`（**只生成两份 descriptor**）、`工具-规范化.mjs`、`工具-缩略图.py` | `工具-检查.mjs`（静态 **A–M**：D 导出集合与接口表**完全相等**；E 参数/事务；F 迁移结构（新伯爵九项/补建两分支/授予两分支/给 root 自开事务/7 守卫/窗口 mark-clear-trigger）；G 原版 token；L 无 localization（script-only）；M configs↔快照；反向 **27**；无 loc → shared `reverse` 跳过 5 条 loc 变异） | **前置库，无决议/事件/loc/入口**；被 dejure 2.6 / organizer 1.3 依赖；共享窗口 flag + 软合并标记 `cn_dejure_suite_organizer`；单独启用无任何游戏内效果；见 `[dependency]` |

After editing, always run the mod's `工具-检查.mjs check` (or the original `工具-静态校验.mjs`)
and keep it output green. Do not "fix" a check by deleting it; if a check is stale, update its
documented expected count and say so.

## 覆盖与兼容（五个 mod 都靠这套边界活着）

来自 Wiki `Modding §Override rules`、`Mod compatibility`、`Mod structure`：

- **整文件覆盖**：mod 里放 `同路径同名` 文件 → 原版整个文件被替换。危险：原版后续补的内容全丢。
- **单对象覆盖**：同一 ID 重新定义（defines / on_actions / 本地化 / UI types 各有各的规则），
  只替换那个对象。在营 5 个一律走这条，能加就不改。
- **`replace_path`**：让原版某个目录完全不加载，只给总转换用——我们不用，别在五个 mod 里加。
- **加载顺序**：多人游戏要求所有人同一套 mod、同一顺序；发布说明里要写清依赖。
- **探测别的 mod**：共享全局变量 + `scripted_trigger`（`Mod compatibility` 的 pattern），
  只在真需要软依赖时用；否则保持零依赖。
- **`.mod` 键**：`name` / `version` / `supported_version` / `path` / `tags` / `remote_file_id` /
  `picture` / `replace_path` / `dependencies`；`remote_file_id` 为空 = 上传会另建条目（不可撤销）。
- **跨 mod 前置库（2026-11-21 core）**：`.mod` 支持 `dependencies={ "库的显示名" }`（值 = 库 descriptor 的
  `name`，不是文件夹名）。消费者只写依赖；库缺失时消费者会报 `Unknown effect/trigger`（load 期或点击时），
  所以**上传顺序 = 库先、消费者后**，工坊描述必须写「需要前置库」。`ck3mod_headless` 一次只启用一个条目，
  无法直接测「库 + 消费者」：用**合并副本冒烟**（把库的 scripts 复制进消费者本机副本，跑完 clean）
  + 真机三件套联测。见 `[dependency]`。**2026-11-21 实测：core 1.2 首传成功（3843429156，空 ID 新建条目），
  `remote_file_id` 新增、`supported_version` 仍 `1.21.*`；dejure 2.6 / organizer 1.3 更新也已上传（ID 不变、supported_version 未回写）。**
- **共享状态联动（2026-11-21 core 1.2）**：dejure 胜利 → core 的 `mark_recent_conquest`（flag 365 天）；
  organizer 的 `cost` 用 **script_values** 读 core 的 `recent_conquest_trigger`，窗口内 0/0；点击后总效果末尾
  `clear`（一次胜利一次）；dejure 的战后建衔也读同一 window。**软联动**：dejure 不在 → trigger 恒 false，
  organizer 永远 300/300；organizer 不在 → dejure 窗口照常。两者仍只硬依赖 core。
- **软合并标记（2026-11-21 core 1.2）**：organizer 的 `on_game_start` / `on_game_start_after_lobby` 只追加
  `on_actions = { marker }`，marker 设 save 级全局变量 `cn_dejure_suite_organizer`；dejure 的战后决议在
  「标记 + 公爵级 + 有首都」时隐藏，伯爵级/单独装保留。标记是 save 级：旧存档可能没有、禁用 organizer 后可能残留；
  控制台 `set_global_variable` / `remove_global_variable` 处理。**organizer 单独装要用一次该变量**（例如决议里的
  `custom_tooltip`），否则引擎刷 `Variable ... is set but is never used`（实测 2 条）。

## 真机验收（in-game acceptance）

无头只验加载期；互动、UI、tooltip、决策面板只有进游戏才知道。完整 runbook（准备 → 启动 → 五 mod 矩阵 →
证据 → 收尾）在 `references/ingame-acceptance.md`（organizer 的矩阵在 §4.5）；这里只留铁律和闭环工具。

**三条铁律**

1. **人点、机记**：agent 只准备现场、读日志、出结论，**不代点验收项**（用户 2026-11-18 明确要求）。
   只有用户当次明确同意才谈 GUI 自动化；`input_*` 在 ck3mod 预设里被屏蔽，只能用 pwsh 注入——
   而**全屏 + Raw Input 会吞掉注入输入**，必须先切窗口模式并声明 DPI-aware，且只信鼠标。
   配方与探针 mod 模板见 `references/ingame-acceptance.md §9`（2026-11-18 实跑过 F2–F8）。
2. **先快照，后开游戏**：`工具-真机现场.mjs --begin` 会快照 `dlc_load.json` / `pdx_settings.txt` /
   `last_save.ck3` / `continue_game.json` / 全部 `*.ck3`，并可同时改写播放集。一次 GUI 会话会覆盖这些文件——
   2026-11-18 实测（14:44 三个文件同时被改，两个滚动自动存档不可恢复）。
3. **杀进程收场**：`Stop-Process -Name ck3 -Force` → `--end`。**绝不点游戏内「退出游戏」**，
   它会写 `autosave_exit.ck3` / `last_save.ck3`，冲掉用户上一次的退出存档。

**任何数值承诺，先找到它天花板的来源**（mastery：成功率显示上限 = **潜力**，由同谋/技能决定，
define 的 95 只是硬顶、contract 是 100——别把「没到 100%」当成 mod 没生效；见 `[scheme]`）。

**代点两步（仅用户当次明确同意时）**：① 探针 mod **两个开局钩子都要挂**——`on_game_start` +
`on_game_start_after_lobby`（单人新开局常走后者；只挂前者时面板不出现、日志却无报错），
用全局变量去重；但 **`on_game_start` 的 root 是 `none`**，探针不能在 root 上判角色条件：用
`random_independent_ruler` / `random_ruler`（可按政体 limit）选人 → `trigger_event` 隐藏事件，事件里 root 才是该角色；
`every_ruler` + 全局变量去重**不生效**（会在整张地图跑成百上千次）。② **凡「必须连续跑时间」的项一开始就划给人**（原版事件会自动暂停游戏），
点击纪律（全尺寸截图量坐标、行高 36 px、间隔 ≥1.2–1.5 s、选角色先 hover）见 runbook §9.6；
③ **事件面板选项每点一次都可能整体位移**——每次点击前重新 hover、读 tooltip 核对**选项名**，别沿用上一次的像素
（2026-11-19 实测把「收敛锋芒」当「先这样」点到）；debug 顶栏的调试开关会把文案变成原始 loc 串，取证前先确认文案正常；
HUD 入口靠 hover 读快捷键（F4 内阁 / F5 贸易 / F6 廷臣 / F7 谋略 / **F9 决议**）。

**启动**：`ck3.exe -debug_mode -suppress_error_log -skip -play=<title_key>`（路线 A，已文档化）或走主菜单
（路线 B，已验证）。**`-develop` 不存在**：`_commandline_options.info` 无此项，exe 里也搜不到；
热载用 `-debug_mode` + 控制台 `reload`。注：`-skip` 会**直接落到新游戏选人界面**（不是主菜单），
游戏规则按钮在该界面右下。

**闭环工具**（细节在 runbook）

- 控制台：debug_mode 下 `event <ns>.<id>` 触发事件，`effect add_gold = 100` / `trigger is_adult = yes` 试效果与触发器。
- 生成文档：`script_docs` + `dump_data_types` → `logs/`，这是层 2 的最新来源。
- 错误计数：`release_mode` 开 Errorhoof；`log_viewer` 看游戏内日志；`debug_log` / `error_log` 埋点。
- Explorer：Ctrl+click 切角色、Alt+click 杀角色、Ctrl+Alt+click 在 Explorer 打开对象。
- `run` 脚本：`Documents\...\run\<name>.txt` + 控制台 `run <name>.txt`，可重复的半自动路径。
- `scripted_tests`（1.21）：`game/tests/*.txt`，控制台 `scripted_tests [pattern]` 跑；需已载入存档，
  **没有无人值守入口**（见硬规则 9）。

## Hard rules

1. **Never edit the game install directory.** All work is in the mod repo, then deploy a copy.
2. **播放集与存档都归用户。** 任何会改 `dlc_load.json` 或产生存档的会话都要先快照：真机用
   `工具-真机现场.mjs --begin/--end`，无头用 `ck3mod_headless`；结束按字节还原并核对 SHA256。
   CK3 没有独立用户目录，一次 GUI 会话会覆盖 `autosave*.ck3` / `last_save.ck3` / `continue_game.json`
   （2026-11-18 实测）。
3. **BOM + LF** for CK3 `.txt`/`.yml`/`.mod` text files, unless the specific file is proven otherwise.
   `工具-规范化.mjs` is the normalizer; the loc checker treats a missing BOM as an error.
4. **Do not use `Start-Process -Wait` on `ck3.exe`.** Poll "process appears → process disappears";
   `-Wait` hangs on Steam children and holds log handles.
5. **Never upload to Workshop without explicit confirmation.** Confirm the existing `remote_file_id`
   before uploading; an empty ID creates a second entry and is hard to undo.
6. **Local copy and Workshop subscription are duplicates.** Do not enable both; clean up with
   `工具-部署.mjs --clean` after testing.
7. **Each workshop description segment ≤ 8000 bytes** (UTF-8 bytes, not characters; Chinese is
   ~3 bytes/char). The 8000 cap applies to the text copied into **one** Steam field, so multi-segment
   files (`工坊描述-BBCode.txt`) are split by their own markers — `########## 第 N 段 … ########## 第 N 段结束`
   or a `====… 第 2 段 …====` line — and each segment is checked separately. A whole file over 8000
   bytes is fine as long as every segment is under it (free/auto are like that).
8. **Don't copy Workshop mod code/text.** JTD/BPC/Create All have no open-source license; study patterns only.
9. **`scripted_tests` 仍无无人值守入口（2026-11-18 在 1.21 复测）**：`tests/_tests.info` 只给了控制台命令
   `scripted_tests [pattern]`；`-automated_test` 会起一局全自动 AI 对局、150 s 不退出且日志里没有测试结果；
   `-run_console_action=scripted_tests` 10 s 退出 0 但**不产生任何 `ScriptedTests` 输出**（应用初始化阶段还没有游戏状态）。
   → **可重复的路径只有「人工控制台 + run 脚本 / `scripted_tests`」**。别给五个 mod 加 `tests/`，除非哪天证明自动入口。
10. **Do not trust `dlc_load.json` alone for isolation.** 启动器另有一套播放集数据库；另外
    `Documents\...\player\game_rules\presets.txt` 的 `LastAppliedRules` 记着**各 mod 游戏规则的当前取值**
    （例如 `on_auto_spread_ai`）。播放集里**没有那个 mod 时**，每次启动会报一条
    `Failed to read key reference: on_auto_spread_ai`——那是找不到规则定义，不是加载错误；
    **启用该 mod 后就不再出现**。判读基线时先看 `dlc_load.json` 里有没有它，再决定要不要扣掉这一行。
11. **Wiki 不是语法真相**：抄录列表页会过期；键名/参数一律回层 2（`.info` / `script_docs`）。
    1.21 还多一层：**patch note 的名字也可能对不上**（见 `verified-notes.md` 顶部表）。
12. **别把 `spline_network.splnet` 留在 Documents**：改 `common/roads` 会生成
    `Documents\...\gfx\map\spline_network\spline_network.splnet`，它**永久覆盖**原版（游戏更新后仍在）。
    要随 mod 发布就挪进 mod 的 `gfx/map/spline_network/`，并删掉 Documents 副本。
13. **真机收场用杀进程**（`Stop-Process -Name ck3 -Force`），不走游戏内「退出游戏」。
    `-develop` **不存在**，别写进任何文档；热载用 `-debug_mode` + 控制台 `reload`。
14. **真机默认不代点**：agent 只准备现场、读日志、出结论；用户当次明确同意才谈 GUI 自动化
    （`input_*` 在 ck3mod 预设里被屏蔽，只在标准会话可见）。
    **真的代点时**：全屏 + Raw Input 会吞掉注入输入，先把 `pdx_settings.txt` 的 `display_mode` 切成
    `windowed`、进程声明 DPI-aware，并且**只信鼠标**；完整配方见 `references/ingame-acceptance.md §9`。
15. **给 on_action 加东西只能追加，不能重写**：直接写 `on_game_start = { effect = { … } }` 会**整块覆盖**
    原版（实测：开局局势 intro 立刻变成 `ERROR:[ghibelline_leader…]` 占位）。正确写法
    `on_game_start = { on_actions = { my_action } }` + `my_action = { effect = { … } }`。
16. **工坊流程的两个顺序**：① **上传前先 `ck3mod_deploy`** —— 启动器 Mod 库只认
    `Documents\...\mod\*.mod`，清场后它会显示空库、没有可上传物；② **两个 descriptor 归启动器管** ——
    点上传会重写这两份文件，**首传与更新形状不同**（首传新增 `remote_file_id`、`supported_version` 可能
    仍是通配；更新才回写实测版本），**判据见硬规则 40**。快照末字节是 `"`、没有行尾换行时**字节数不变**
    （de-jure v2.3 实测 257 / 163 B 原样；organizer 首传 233→261 / 138→166 B，只 +28 B），
    所以静态校验对这两个文件按字段比。「`file_size` 少 1」只出现在**快照带行尾换行**的旧形状里
    （free v4.1 实测 96,075 → 96,074），不是常态。它读的是外层 `.mod`，但**内层 `descriptor.mod` 也会被
    一起回写** → 按字段比必须覆盖内外两份（容差 `1.21.*` / `1.21.x`）。
17. **前提先于功能**：现象是「功能没生效」时，先逐条确认前置条件真的成立——目标对象还活着
    （拿死人做 `add_hook` 会静默失败）、对象过得了代码里的闸门（AI 受害者被 `is_ai = no` 挡掉）、
    命令在零售版被接受（Wiki 只证明「存在」）。前置条件不成立时，代码看起来就是「写错了」。
18. **抄原版片段先看包裹结构，再读原版注释**：照抄下来的常常只是更大结构里的一截——`scope:<flag>`
    是选区不是条件（勾选后写 `scope:x = { … }` 会变成切作用域，表现为「没勾也全加」，条件要写
    `always = scope:x`）；原版在那一行的注释就是设计意图，先读再判 bug。
19. **校验判据要能区分「有意产物」与「真故障」**：启动器回写 descriptor（`1.21.*`→`1.21.0`、
    `file_size` −1 字节）是有意产物；把有意产物判成故障、或让两条判据互相矛盾，比没有检查更糟。
    判据过期时改判据、并从真源取（`META`、表导出），**别放宽整条规则，也别删检查来变绿**。
    **判据还要与部署状态解耦**：拿反例样本跑 `--root` 时，不要让它去比「当前本机副本」——本机部署的是哪一版，
    反例就会多出几条假的「不一致」（de-jure 实测 20 → 23）。
20. **写进清单的问题只有变成机器检查才算处理**：候选清单/复盘里记下的问题，没有落成脚本断言就等于
    没发现；收进实现前先问「这条会不会被 `工具-检查.mjs` / golden check 拦住」。
    **知识层自己也有兜底**：`工具-知识层检查.mjs` 断言硬规则编号（1–N 连续）、三份文件的必需节、
    复盘映射锚点（11-18 的 A1…H7 + 11-18b 的 P1–P16 + 11-18c 的 Q1–Q12）、**锚点总数与逐编号覆盖**、
    人格层（`cordis.patch.yml`）必备词/禁词、版本口径与部署副本哈希——删了规则、断了映射、少了锚点、
    忘了同步，它都会报红；**文档索引**由 `.admin\工具-文档链接检查.mjs` 兜底，收尾必跑。
    **判据自己也防削弱**：以前删一条锚点只是「少查几项、照样绿」，现在直接报 `ANCHORS/count` 或
    `ANCHORS/coverage`。
21. **知识层只改仓库副本**。skill 的源在 `dsh-ck3-mod-dev\skills\ck3-modding\`，DSH 实际加载的是
    `~\.agents\skills\ck3-modding`（部署副本）；`工具-同步技能.mjs` 方向固定为**仓库 → 部署副本**。
    直接改部署副本会被下一次同步覆盖（2026-11-18 实测）。改完必须同步 + `--check` + `工具-知识层检查.mjs`。
22. **校验器的结论行不许硬编码样本数**。各 mod 的反向样本数不同（历史：curse 32；现在 mastery 13、auto 7），显示必须从脚本
    输出解析（`反向验证：N / N 项如期报错`）；期望值只写在 `configs.mjs` 的 `expect` 里，
    断言的是「显示等于实际」，不是断言常量。
23. **探针两个开局钩子都要挂，且 root 不会自动是「某个角色」**。单人新开局常走
    `on_game_start_after_lobby`（`game_start.txt:2806`），只挂 `on_game_start` 时面板不出现、日志却无报错；
    两个钩子都写 `on_actions = { zz_probe_game_start }`，用全局变量去重。**但 `on_game_start` 的 root 是 `none`**：
    在 root 上判角色条件会报 `Wrong scope for trigger: none`——先 `random_independent_ruler` / `random_ruler`
    （可按政体加 limit）选人，再 `trigger_event` 隐藏事件，事件里 root 才是那个角色；
    `every_ruler` + 全局变量去重**不生效**（实测在整张地图跑成百上千次）。模板见 `references/ingame-acceptance.md §9.3`。
24. **代点点击纪律；要跑时间的项一开始就划给人**。坐标从**全尺寸截图**量（预览 1708 宽，系数 1.1241），
    事件面板每行约 36 px；两次点击间隔 ≥1.2–1.5 s（选项点击会 `trigger_event` 重绘事件）；
    选角色先 hover 出 tooltip 再单点（点海面/不可通行地形会清空已选、点男爵领会打开角色档案）；
    原版事件会**自动暂停**游戏，「跑一年」这类必须连续跑时间的项不要试图自动化。细则见 runbook §9.6。
25. **无头判据固定；「没自退」不单独算失败；日志先按 `Script location` 分组**。判据三件套：
    到 `Start running through history.` + 本 mod 报错 0 + 播放集 SHA256 还原；到 history 但没自退是
    概率性的（同一部署 33.1 s 未退、30 秒后复跑 25.9 s exit 0），先复跑一次再下结论。A5 两条：
    mod token 0 条 **且** 没有 `Script location` 指向本 mod 的文件；1.21 原版噪声可达 8,094 条 [E]，
    不先按位置分组就会误判（基线见 `verified-notes.md [ingame]`）。**块的归属看链首**——见硬规则 41。
26. **发布快照是发布物：字节形状跟启动器一致，上传确认只认机器信号**。两份 descriptor 上传后末字节是 `"`、
    没有行尾换行；生成器不许带 `\n`，快照做到「与上一版逐字节只差两处值」（静态校验 L 段守住）。
    没有生成器的 mod 补一个只生成 descriptor 的 `工具-生成.mjs` + `数据-元数据.mjs`（内容文件仍手写）。
    上传后确认只认机器信号：**更新** = descriptor 被回写成实测版本（mtime 变了）+
    `steam_workshop_search` 的日期/体积 + 条目 ID 未变；**首传** = descriptor 新增 `remote_file_id`
    （与拿到的条目 ID 一致），`supported_version` **可能仍是 `1.21.*` 不动**（organizer 实测）——
    见硬规则 40。精确 `file_size` 拿不到就写 **SKIP**，别猜。
    **形状对了就不会再 −1**：快照末字节本来没有 `\n` 时，上传后长度不变（de-jure v2.3 实测 257 / 163 B
    原样，只把 `1.21.*` 回写成 `1.21.0`）——把「−1 字节」当常态，会把正常误判成异常。
    另外：`工具-部署.mjs` 对外层 `.mod` 有「语义等价就跳过写盘」的兜底，生成器改了形状它也**不会**重写旧文件；
    要逐字节一致得先 `--clean` 再 deploy。
27. **「清理 / 重构」类 patch note 要当语义变更审；判据自己也会变弱**。1.21 只写 "Cleaned up casus belli …
    effects"，实际把每个抢地 CB 的战争结束块抽成了 wrapper（`00_war_effects.txt:3170/3178/3243`）——
    抄 1.20 内联写法的 mod 会**静默少结算**（行政政体 Influence、防御方无地冒险者失地提示），
    而 grep 旧 token 依旧命中、静态校验照样绿。判定时去层 2 对比原版正文，别看条目标题。
    反过来的坑：wrapper 化会让「按 `= yes` 抽取」的存在性校验从 12 个对象掉到 5 个——**判据悄悄变弱也是 bug**，
    要补「按名直调清单」（de-jure 的 `DIRECT_CALLS` 7 项）并把清单长度打进结论行。
28. **开测前先确认「这一局能观测到本次改动」**。政体 / 等级 / 阶段不匹配时，那一项等于没测：
    de-jure v2.3 的头号改动是行政政体的 Influence，而第一轮用户新开的是**部落**局，全程看不到它，
    靠第二轮拜占庭局才闭合。准备阶段写清「本次改动的可观测条件」，不满足就换局或明确 SKIP——
    别用「他说没问题」代替「测到了」。
29. **变更范围要机器可证，功能移除也一样**。「删掉一个功能」不是口头承诺：de-jure v2.3 移除战后报告时，
    A 段断言两个文件**不存在**、M 段断言脚本与 loc 里 0 处 `cn_report` / `cn_dejure.0001`、
    N 段允许「文件集合只少这两个 + loc 只删 8 行」。需求可以在验收中变更，但必须**纳入同一版**（未上传时）
    并让差异断言把「只改了这些」钉死。
30. **热修不一定改版本号：判「吃没吃热修」看 buildid + 文件 mtime**。`launcher-settings.json` 由启动器回写、
    可能落后于实际安装；`ck3.exe` 也可能仍嵌旧版本串（2026-11-19 实测：buildid `26622941 → 26757580`、
    81 个文件被替换，而 exe 仍写 `1.21.0`/`Florin`）。判据用 `ck3mod_status` 的「游戏构建」行
    （`appmanifest_1158310.acf` 的 buildid + 安装时间 + `binaries\ck3.exe` mtime）。**热修后第一件事仍是
    `check --all`**，绿了才能说「与在营 5 个的脚本面不相交」；Wiki 的 `Patch 1.21.X` 页现在给出
    **`1.21.0.3`（2026-11-19）**，按「Wiki 编号 + buildid」记——版本串不变，**别用版本串判热修**。
31. **需求先分类再出计划**：一句话问自己「用户要的是**新内容**（scheme / 事件 / CB / 决策 / 互动）
    还是**开关或数值**（修正 / 游戏规则 / 面板）？」主题词（谋杀、计谋、海战…）只影响文案与选材，
    **不决定交付形态**。分类不清就先问一个问题确认，别先画三份计划——2026-11-19 mastery 需求改了 4 次、
    前三份计划都是「内容型」，最后要的是「数值开关」。
32. **「所有 X」先找通用键；没有就按枚举写满，并加一条从安装目录反查枚举集合的断言**。引擎经常没有跨类别键
    （计谋的成功率/成长/上限/阶段时长/栏位就是 5 类各一套，`00_definitions.txt:2168-2353`）。
    做法：枚举写进 `数据-*.mjs`，断言每次从安装目录解析实际出现的集合（缺一类就红）——将来原版新增类别
    会自动报警，而不是靠人记得补（mastery 的 L0 段，当前 5 类）。反过来，「所有政体」也有通用解：
    `is_vassal_or_below_of` 把「独立统治者」推广到任意深度的封臣树——**先找这种通用键**，再按政体逐项跑探针
    证明（organizer 7 政体 + 封臣统治者 8/8）。
33. **结构性判据一律跑在剥离注释的文本上；反向样本必须证明「真的改到了」**。注释里出现的示例片段不算数：
    mastery 的 L5 被决策文件注释里的 `is_shown = { is_ai = no }` 满足，「删掉闸门」的坏样本照样 PASS；
    括号配平还要先剥字符串。反向样本改完必须断言 `next !== src`（`if (next === src) throw`）——
    样本没生效会被误判成「判据没开火」，白跑一轮。**用 `replaceAll` 或先剥注释**：organizer 实测
    `replace('is_vassal_or_below_of = root', 'top_liege = root')` 只改到**文件头注释里的示例**，
    代码没动、校验器照样 PASS——等于没测。
34. **探针一次只回答一个问题**。一条 on_action 里塞两件互相覆盖的事（两次 `start_scheme`）时，第一个失败
    会被第二个掩盖：mastery G7 个人侧 `sway` 没起来，两次都只有 1 张卡，既证不了基线也证不了 +1，只能交回人工。
    多步实验拆成多次启动，或让每一步都有**独立可观测的产物**。
35. **需求先要「终局状态」，过程动作不是需求**。让用户用「点完之后我的头衔列表 / 领地长什么样」描述验收，
    再倒推算法。organizer 第一版按「实时法理归位」写（补建 + 转封 + 归位，6 事务），静态 / 反向 / 无头全绿，
    真机直接不通过——用户要的是**终局**（只留首都链条、封臣每级 1 个、高等头衔给首都县持有人），不是过程。
    先写「终局定义表」，再逐条对应可观测验收项（G1–G10）。
36. **`create_character` 必须显式给性别**。模板可能不带性别（`_scripted_character_templates.info:50` 原文
    「If no gender data is set here or in a base template: create_character logs an error」），否则无头直接
    3 条 `PostValidate of effect 'create_character' returned false`。`gender` / `opposite_gender` /
    `gender_female_chance` 三选一；新角色九项结构（template / gender / culture / faith / rite / location /
    dynasty / save_scope_as / set_employer）要有静态断言（organizer 的 H8）。
37. **「我的领域」用 `is_vassal_or_below_of = root`，不要用 `top_liege = root`**。`is_vassal_of` 只判直属封臣，
    `top_liege = root` 只在独立统治者时成立——拿它当范围判定，「所有政体可用」就是假的（封臣统治者、行政总督
    全被挡）。无地 / 雇佣兵团长用 `exists = capital_county` 挡；`change_government` 只吃字面 key
    （全安装目录 0 处 scope 用法），想复制政体只能枚举。
38. **触发器 / 效果先核作用域类型**。`is_mercenary_company` / `is_holy_order` 是**头衔**触发器，写在角色
    作用域会报 `Inconsistent trigger scopes (character vs. landed_title)`——放进 `primary_title = { }`。
    抄任何触发器前先在 `Triggers list` / `.info` 的 scope 列确认它吃哪种 scope。
39. **游戏不变量要写进 UI 与文档**。引擎不允许把同级或更高头衔封给封臣（`resolve_title_and_vassal_change`
    报 `same or higher tier`），任命制头衔还受 `has_appointment_level_for_title` 限制——这些「做不到」必须
    写进决议 `is_valid` tooltip 与 README，否则会被当 bug 报（例：国王的第二个王国只能留在玩家名下）。
40. **首传只看 `remote_file_id`，随后必须回填 META 再重生成**。organizer 首传后两份 descriptor 各 +28 B
    （233→261 / 138→166 B），**`supported_version` 仍是 `1.21.*`**——「点上传会把 supported_version 回写成
    实测版本」在首传**不成立**（更新时才回写）。拿到编号后必须回填 `数据-元数据.mjs` 的 `remoteFileId`
    → `工具-生成.mjs` 重生成 → 部署比对：未回填 **6/8**、回填后 **8/8**。
41. **日志归属看错误块的链首**。取每个 `Script system error` 块的**第一个** `file:` / `Script location` 行，
    以本 mod 文件名开头才算我们的错。organizer 用户会话 242 块里 36 块末端指向本 mod 决议、**0 块起于本 mod
    脚本**（23 GDP 商业共和国建政链 / 7 商人家族头衔 / 6 日本 `previous_holder`）——这 36 条要作为
    「已知原版噪声」写进 README 与工坊描述，别把链条末端当证据。

## Verification layers

| Layer | Tool | What it catches |
|---|---|---|
| Loc structure | shared `loc` | BOM, header, `$...$`, `[...]`, `#tag`, cross-language `$` sets |
| Static rules | per-mod `工具-静态校验.mjs` | braces, descriptors, loc keys, Vanilla token existence, mod-specific invariants |
| Reverse | shared `reverse` + per-mod reverse | whether checks actually fire on deliberate defects |
| Headless | `ck3.exe -debug_mode -nographics -shutdown_after_history` | load-time errors only; 判据 = 到 history + 本 mod 0 报错 + 播放集还原；「没自退」先复跑；not interactions/on_game_start |
| Console run-script（手动） | `run/` + 控制台 `run x.txt` | 条件搭建与效果链，可重复；仍需人开游戏 |
| 探针（临时 on_action → 隐藏事件） | `zz_probe_*.txt` + `debug_log` 埋点 | 「整段效果能不能跑完」（organizer 8/8 政体）；不证明 UI / 数值；一次只答一个问题，跑完删并用文件哈希证明回到已验证状态 |
| Console `scripted_tests`（1.21，手动） | 游戏内控制台 `scripted_tests [pattern]` | 原版自带 20 个测试文件；需要已载入存档；无人值守入口未打通 |
| In-game（人点、机记；用户明确要求时可机器代点） | `工具-真机现场.mjs` + 点击 + 截图 + `error.log` token 计数 | 互动 / UI / tooltip / 决策 / 宣战界面；不能证明数值平衡与长期运行；**必须连续跑时间的项留给人** |
| Workshop | launcher upload + page check | packaging/size/ID, not logic |
| 知识层 / 文档索引 | `工具-知识层检查.mjs` + `.admin\工具-文档链接检查.mjs` | 硬规则编号、必需节、复盘锚点断链、版本口径、部署副本漂移、索引里的死链 |

Never claim a layer passed if it was skipped; say **SKIP** and why.

> 1.21 实测：空播放集无头 **26.5 s 到 `Start running through history.` 后自行退出、exit 0**，
> 1.20 那个「到 history 必崩」的现象没有复现。但装 mod 后是否仍干净，要按当次报告判。
> auto v2.1（1.21）另见：第 1 轮 33.1 s 到 history **未自退**（判 WARN），复跑 25.9 s、exit 0、PASS
> ——「没自退」是概率性的，先复跑再判（硬规则 25）。

## References

- Wiki 索引（本次勘察生成）：`references/ck3-wiki-atlas.md`
- 实测要点（按域，带 `.info` 行号）：`references/verified-notes.md`（含 `[hotfix]` 热修与版本口径、
  `[title]` 头衔/法理/封臣树、`[scheme]` 计谋类别与成功率天花板、`[release]` 发布/工坊核对、
  `[automation]` 真机自动化、`[verify]` 无头/A5/反向判据）
- 真机验收 runbook（含 §9 机器代点与 §9.6 点击纪律）：`references/ingame-acceptance.md`
- 踩坑总账（2026-11-18 项目收尾）：`D:\DSH workspace\.admin\retro-2026-11-18-ck3mod.md`
- 踩坑续篇（2026-11-18b auto v2.1）：`D:\DSH workspace\.admin\retro-2026-11-18b-ck3mod-auto-v2.1.md`
  —— 16 条新坑（P1–P16），落点见硬规则 21–26（插件 0.5.0 / skill 0.7.0 落地）
- 踩坑续篇（2026-11-18c 法理征服 v2.3）：`D:\DSH workspace\.admin\retro-2026-11-18c-ck3mod-dejure-v2.3.md`
  —— Q1–Q12（判定 / 校验器 / 发布 / 真机 / 收尾），落点见硬规则 19、26、27–29 与
  `[cb]` / `[verify]` / `[release]` / `[ingame]`；人格层同样吃这套事实（`cordis.patch.yml`）
- 热修复盘（2026-11-19 全站复核）：`D:\DSH workspace\.admin\retro-2026-11-19-ck3mod-hotfix.md`
  —— R1–R3（版本串不是热修信号 / 不编版本号 / 影响面取证），落点见硬规则 30 与 `[hotfix]`
- 复盘续篇（2026-11-19 谋略 Scheme Mastery v1.0）：`D:\DSH workspace\.admin\retro-2026-11-19-ck3mod-mastery.md`
  —— M1–M12（需求先分类 / 「所有 X」→ 枚举 + 反查 / 潜力天花板 / `SCHEMES_PER_TYPE` / 注释喂饱判据 /
  死工坊 ID / 面板行位漂移 / 调试 UI 陷阱 / HUD 快捷盘 / 探针一事一件 / 首次上传形状 / 预检有意差异），
  落点见硬规则 31–34 与 `[scheme]` / `[release]` / `[verify]` / `[automation]` 及 runbook §4.1、§9.6
- 复盘续篇（2026-11-20 法理整顿 De Jure Organizer v1.0）：`D:\DSH workspace\.admin\retro-2026-11-20-ck3mod-organizer.md`
  —— O1–O26（终局状态 / create_character 性别 / `is_vassal_or_below_of` / 触发器作用域 / 同级例外写进 UI /
  首传 `remote_file_id` / 日志链首归属 / 政体矩阵探针 / 注释骗过反向样本 / 商业共和国与日本噪声），
  落点见硬规则 35–41 与 `[title]` / `[release]` / `[verify]` / `[ingame]` / `[automation]` 及 runbook §4.5
- 文档索引兜底：`D:\DSH workspace\.admin\工具-文档链接检查.mjs`（收尾必跑；`--all` 扫整个 `.admin`）
- auto 的 L 段与回滚：`D:\DSH workspace\ck3-auto-spread\README.md`、`发布说明.md`
- 索引生成器：`scripts/wiki-atlas.mjs`（`--check` 验鲜，`--out` 改输出位置；补丁链与页面改名都有
  机器断言：`assertPatchCoverage` / `assertCoverage`，缺页直接退出 1）
- Shared tools: `D:\DSH workspace\ck3-modding-tools\README.md`
- Survey / decisions: `D:\DSH workspace\ck3-modding-survey\README.md`, `06-落地候选.md`
- Tests/tooling details: `D:\DSH workspace\ck3-modding-survey\03-工具链与测试.md`
- Game file notes: `D:\DSH workspace\ck3-modding-survey\02-机制与脚本借鉴.md`
- De-jure reverse baseline: `D:\DSH workspace\ck3-de-jure-conquest\README.md` and `发布说明.md`
