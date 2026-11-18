---
name: ck3-modding
description: |
  Use for Crusader Kings III mod work in D:\DSH workspace: researching current
  mechanics on the CK3 Wiki, editing scripts, events, interactions, decisions,
  casus belli, localization, descriptors, thumbnails; running static validation,
  shared loc checks, reverse verification, headless smoke tests, local deployment,
  in-game acceptance, and Steam Workshop updates. Load this before touching any of
  the four published mods, the shared toolchain, or the wiki atlas.
metadata:
  author: "local workspace"
  version: "0.6.0"
---

# CK3 Modding — Workspace Playbook

## When to use

Load this skill when the task concerns:

- any of the four published mods: `ck3-auto-spread`, `ck3-curse`,
  `ck3-de-jure-conquest`, `ck3-free-resources`;
- the shared checker in `D:\DSH workspace\ck3-modding-tools`;
- **查 CK3 Wiki**：某个 trigger/effect/字段现在到底怎么写、1.21 改了什么；
- localization, script validation, headless checks, deployment, or Workshop uploads;
- the research report in `D:\DSH workspace\ck3-modding-survey`.

Do **not** load it for playing the game or for unrelated projects.

## Read first (in this order)

1. `D:\DSH workspace\工作区索引.md` — current state, version notes, which mod is where.
2. The mod's `README.md` — its "怎么改 / 下次 CK3 更新时 / 注意事项" sections are the operational truth.
3. `references/ck3-wiki-atlas.md`（本 skill 目录下，加载 skill 时会给 base dir）——
   Wiki 全量导航：67 个 modding 页 + 1.21 新内容 11 页 + 机制语义 25 页，含最后编辑、`{{version}}`、是否 1.21 口径。
4. `references/verified-notes.md` — **动手前**按路由表的「要点」列读对应小节（`[interaction]` / `[cb]` /
   `[district]` …）：1.21.0 实测结论，每条带 `.info` 行号，只读需要的那节。
5. `references/ingame-acceptance.md` — **要进游戏验收时**读它：准备/启动/四 mod 矩阵/证据/收尾。
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
- Game version: **1.21.0 "Florin"**（Wiki 记 2026-11-17 与 Silk & Silver 同日发布；本机 2026-11-18 更新，
  `launcher\launcher-settings.json` = `1.21.0 (Florin)`、`titus_branch.txt` = `release/1.21.0`、
  `appmanifest_1158310.acf` buildid `26622941` 可复核）。
- 四个 mod 的当前发布快照：`ck3-auto-spread` **2.0** · `ck3-curse` **1.0** ·
  `ck3-de-jure-conquest` **2.2** · `ck3-free-resources` **4.1**。
  **free 已按 1.21 发布**（2026-11-18 16:23 上传；仓库快照 `supported_version="1.21.*"`、
  工坊侧被启动器回写为 `1.21.0`、`file_size` 96,074 B）；其余三个仍声明 `1.20.*`，
  1.21 下静态/loc + 无头都 PASS，但**没重发工坊就别说"已支持 1.21"**。
- **新版本上手第一件事**：跑该 mod 的 `工具-静态校验.mjs`。H 段（引擎 token）与 H2 段（原版角色货币覆盖）
  会回答「只发兼容版，还是要功能更新」——free 的 H2 就是 2026-11-18 为此加的。
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

## 查资料：三层真相

写任何脚本前先想清楚「这条结论该信谁」。三层混用是这类工作最常见的错误来源。

| 层 | 来源 | 能回答什么 | 什么时候别信 |
|---|---|---|---|
| 1 | CK3 Wiki（`ck3wiki_*` 工具） | 语义、示例、工作流、补丁说明 | 页面 >1 年没动；`Effects list` / `Triggers list` 这类抄录页 |
| 2 | 本机原版 1.21.0：`.info` 文档与 `common/`（`ck3mod_vanilla`） | 键名、类型、参数、这个键现在还在不在 | 只有 DLC 新内容才可能缺 |
| 3 | 四个 mod 自己的 `数据-*.mjs` + `工具-静态校验.mjs` + loc 检查 | 我们自己的不变量与契约 | 只覆盖我们写过的规则 |

**1.21 期间的额外纪律**：Wiki 的 modding 层整体没跟上——`Category:1.21` 75 页里只有 `Console commands`
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
- `Category:1.21`（75 页）是编辑者标的「当前版本口径」，可以当起点，但不是免检章。
- 不抄正文进仓库：索引只存标题/日期/一句备注，正文用工具现读。

### 路由表：什么话题去哪个页面

「要点」列指向 `references/verified-notes.md` 里的实测小节（本 skill 目录下）：**按需只读一节，不要整篇读**；
`—` 表示这个域还没核过。每条都带 1.21.0 的 `.info` 行号。

| 要做的事 | Wiki（层 1） | 语法真相（层 2） | 要点 |
|---|---|---|---|
| 事件 | `Event modding`（2026-10 按 1.20.1 更新） | `events/` + `events/*.info` | — |
| 角色互动 | `Interactions modding`（**只有 1 个示例，1.4 KB**） | `common/character_interactions/` + `.info` | `[interaction]` |
| 决策 | `Decisions modding`；玩家向 `Character decisions` | `common/decisions/` + `.info` | — |
| 特质 | `Trait modding`；玩家向 `Traits` | `common/traits/` + `.info` | — |
| 宣战理由 CB | **无专页**；`Casus belli` 是玩家向机制页 | `common/casus_belli_types/` + `_casus_belli.info`；**组在 `common/casus_belli_groups/`** | `[cb]` |
| 头衔 / 法理 | `Title modding`；机制语义 `Titles` | `common/titles/`、`history/titles/` | — |
| 文化 / 传统 | `Culture modding`；`Culture`、`Traditions` | `common/culture/` | — |
| 宗教 / 教义 | `Religions modding`（1.20 口径）；`Religion`、`Doctrines`、`Tenet` | `common/religion/` | — |
| 政体 | `Governments modding`（2021 页，旧） | `common/governments/` + `.info` | `[government]` |
| 议会 | `Council modding`；玩家向 `Council` | `common/council_positions/`、`common/council_tasks/` | `[council]` |
| 地产 / 区划 | `Holdings modding`（旧）；1.21 玩家向 `Districts`、`Special districts`、`Great project districts` | `common/holdings/`、**`common/districts/`**、`common/buildings/` | `[district]` |
| 建筑 / 市场修正 | `Building`；1.21 玩家向 `Market` | `common/buildings/_buildings.info` | `[district]` |
| 贸易 / 商业共和国 | **无 modding 页**；`Market`、`Merchant`、`Merchant lifestyle`、`Republican`、`Trade company` | `common/trade/**`、`common/trade_tasks/` | `[trade]` |
| 道路 / 地图样条 | **无专页**；`Map modding` | `common/roads/**` + `gfx/map/spline_network/` | `[road]` |
| 法律 | `Laws`（1.21 口径） | `common/laws/_laws.info`、`common/law_groups/` | `[laws]` |
| 兵种 / 常备军 | `Regiments modding`；`Army`、`Hired forces` | `common/men_at_arms_types/` | — |
| 生活方式 | `Lifestyles modding`；`Lifestyle`、`Merchant lifestyle` | `common/lifestyle_perks/` | — |
| 宝物 | `Artifact modding`；`Artifacts` | `common/artifacts/` | — |
| 历史（角色/头衔/省份） | `History modding` | `history/`（**省份已按王国分文件**） | — |
| 故事循环 | `Story cycles modding`；`Stories` | `common/story_cycles/` + `create_story` | `[story]` |
| 斗争 | `Struggle modding`（2026-09，质量较好） | `common/struggle/struggles/`、`history/struggles/` | `[struggle]` |
| 局势 / 活动 | `Situation`、`Activity` | `common/situation/`、`common/activities/` | — |
| 计谋 | `Schemes` | `common/schemes/` | — |
| AI 权重 | `AI modding`、`Weight modifier` | `common/scripted_*`、`ai_*.info` | — |
| 变量 / 脚本值 | `Variables`、`Script values` | `.info` | — |
| 资源 / 成本档位 | `Resources modding`（**标题误导**：实为虔诚档位） | `common/script_values/00_basic_values.txt` | `[resources]` |
| modifier 键 | `Modifier list`（35 KB，1.12 口径） | `common/modifier_definition_formats/*.txt` | — |
| 本地化 | `Localization`、`Customizable localization` | `localization/**/*.yml` | — |
| GUI | `Interface` | `gui/**/*.gui`、`interface.info` | — |
| 地图 / 地形 | `Map modding`、`Terrain modding` | `map_data/` | — |
| 控制台与调试 | `Mod troubleshooting`、`Console commands`（1.21） | `_commandline_options.info` | — |
| 真机验收 / 启动参数 / 存档保护 | —（`_commandline_options.info` 就是文档） | `_commandline_options.info`、`pdx_settings.txt`、`game/tests/` | `[ingame]` |
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
cd "D:\DSH workspace\ck3-curse"
& $node .\工具-检查.mjs check
& $node .\工具-检查.mjs loc
& $node .\工具-检查.mjs reverse
```

Baseline at 2026-11-18 (1.21.0): curse loc 122 / de-jure 36 (v2.2) / free 84 / auto 94, all 0 errors,
`check --all` 4/4 PASS. `auto`'s static validator supports `--root`; `check` runs it against the release
snapshot and it passes. Passing `--root` is preferred over deploying a local copy.
Spelling: `ck3spell` is blocked by hosts; `spellcheck.py` (pyspellchecker + game English corpus)
found 0 real typos in the four mods; only the `behaviour`/`behavior` style variant.

## Native tools (agent preset「CK3 模组开发」)

If this session runs the `ck3mod` preset, the host exposes 8 `ck3mod_*` tools. They wrap this
checker and each mod's own `工具-*.mjs`; prefer them over hand-written PowerShell:

| Tool | Use it for | Writes |
|---|---|---|
| `ck3mod_status` | env + four-mod overview before starting: snapshot / local copy / capabilities / git / game version | — |
| `ck3mod_check` | `check` / `loc` / `reverse` / `selftest` (structured PASS/FAIL + loc counts) | — |
| `ck3mod_build` | `generate` / `normalize` (write), or `*-check` to compare only | release snapshot |
| `ck3mod_deploy` | `deploy` / `check` / `clean` through the mod's own 部署 script | `Documents\...\mod` |
| `ck3mod_headless` | backup → single-mod playset → ck3.exe → restore + SHA256 → log triage | `dlc_load.json` (restored) |
| `ck3mod_logs` | `error.log` `[E]` lines; `debug.log` Enabled / Mounted isolation | — |
| `ck3mod_vanilla` | search the installed 1.21 scripts / loc / `.info` docs for real triggers and effects | — |
| `ck3mod_workshop` | per-segment description bytes (≤ 8000), descriptor fields, empty `remote_file_id` | — |

Wiki 工具（同一会话里保留可见，只读）：

| Tool | 用来 |
|---|---|
| `ck3wiki_category` | 取清单：`Modding`（67 页）/ `1.21`（75 页） |
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
| `ck3-curse` | `数据-mod表.mjs` + hand-written script/loc | `工具-生成.mjs`, `工具-规范化.mjs`, `工具-缩略图.py` | `工具-检查.mjs` (`A–O` via `工具-静态校验.mjs`; reverse via `工具-反向验证.mjs`) | 4 interactions, 24 traits, no Vanilla overrides |
| `ck3-de-jure-conquest` | `数据-mod表.mjs` + CB script/loc | `工具-生成.mjs`, `工具-规范化.mjs` | `工具-检查.mjs` (`--root` v1.0 must report **16**) | CB is hand-written; v2.0 settlement checklist in `发布说明.md` |
| `ck3-free-resources` | `数据-资源表.mjs` | `工具-生成.mjs` (golden check), `工具-部署.mjs` | `工具-检查.mjs` | generated events/loc; never hand-edit products |
| `ck3-auto-spread` | hand-written script/loc | no generator (v2.0), **no deploy script** | `工具-检查.mjs` (`--root` static validator + loc) | settings via global variables + game rules; 1.20 rite fields already used |

After editing, always run the mod's `工具-检查.mjs check` (or the original `工具-静态校验.mjs`)
and keep it output green. Do not "fix" a check by deleting it; if a check is stale, update its
documented expected count and say so.

## 覆盖与兼容（四个 mod 都靠这套边界活着）

来自 Wiki `Modding §Override rules`、`Mod compatibility`、`Mod structure`：

- **整文件覆盖**：mod 里放 `同路径同名` 文件 → 原版整个文件被替换。危险：原版后续补的内容全丢。
- **单对象覆盖**：同一 ID 重新定义（defines / on_actions / 本地化 / UI types 各有各的规则），
  只替换那个对象。我们的四个 mod 一律走这条，能加就不改。
- **`replace_path`**：让原版某个目录完全不加载，只给总转换用——我们不用，别在四个 mod 里加。
- **加载顺序**：多人游戏要求所有人同一套 mod、同一顺序；发布说明里要写清依赖。
- **探测别的 mod**：共享全局变量 + `scripted_trigger`（`Mod compatibility` 的 pattern），
  只在真需要软依赖时用；否则保持零依赖。
- **`.mod` 键**：`name` / `version` / `supported_version` / `path` / `tags` / `remote_file_id` /
  `picture` / `replace_path`；`remote_file_id` 为空 = 上传会另建条目（不可撤销）。

## 真机验收（in-game acceptance）

无头只验加载期；互动、UI、tooltip、决策面板只有进游戏才知道。完整 runbook（准备 → 启动 → 四 mod 矩阵 →
证据 → 收尾）在 `references/ingame-acceptance.md`；这里只留铁律和闭环工具。

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

**启动**：`ck3.exe -debug_mode -suppress_error_log -skip -play=<title_key>`（路线 A，已文档化）或走主菜单
（路线 B，已验证）。**`-develop` 不存在**：`_commandline_options.info` 无此项，exe 里也搜不到；
热载用 `-debug_mode` + 控制台 `reload`。

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
   → **可重复的路径只有「人工控制台 + run 脚本 / `scripted_tests`」**。别给四个 mod 加 `tests/`，除非哪天证明自动入口。
10. **Do not trust `dlc_load.json` alone for isolation.** 启动器另有一套播放集数据库；另外
    `Documents\...\player\game_rules\presets.txt` 里的旧 game rule 引用会在每次启动报
    `Failed to read key reference`（例如 `on_auto_spread_ai`），**那是残留、不是加载错误**，判读基线时要先扣掉。
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
    点上传时它会把 `supported_version` 从通配回写成实测版本（`1.21.*`→`1.21.0`）并吃掉行尾 1 字节，
    所以静态校验对这两个文件按字段比，`file_size` 比本地少 1 字节是正常现象。
17. **前提先于功能**：现象是「功能没生效」时，先逐条确认前置条件真的成立——目标对象还活着
    （拿死人做 `add_hook` 会静默失败）、对象过得了代码里的闸门（AI 受害者被 `is_ai = no` 挡掉）、
    命令在零售版被接受（Wiki 只证明「存在」）。前置条件不成立时，代码看起来就是「写错了」。
18. **抄原版片段先看包裹结构，再读原版注释**：照抄下来的常常只是更大结构里的一截——`scope:<flag>`
    是选区不是条件（勾选后写 `scope:x = { … }` 会变成切作用域，表现为「没勾也全加」，条件要写
    `always = scope:x`）；原版在那一行的注释就是设计意图，先读再判 bug。
19. **校验判据要能区分「有意产物」与「真故障」**：启动器回写 descriptor（`1.21.*`→`1.21.0`、
    `file_size` −1 字节）是有意产物；把有意产物判成故障、或让两条判据互相矛盾，比没有检查更糟。
    判据过期时改判据、并从真源取（`META`、表导出），**别放宽整条规则，也别删检查来变绿**。
20. **写进清单的问题只有变成机器检查才算处理**：候选清单/复盘里记下的问题，没有落成脚本断言就等于
    没发现；收进实现前先问「这条会不会被 `工具-检查.mjs` / golden check 拦住」。

## Verification layers

| Layer | Tool | What it catches |
|---|---|---|
| Loc structure | shared `loc` | BOM, header, `$...$`, `[...]`, `#tag`, cross-language `$` sets |
| Static rules | per-mod `工具-静态校验.mjs` | braces, descriptors, loc keys, Vanilla token existence, mod-specific invariants |
| Reverse | shared `reverse` + per-mod reverse | whether checks actually fire on deliberate defects |
| Headless | `ck3.exe -debug_mode -nographics -shutdown_after_history` | load-time errors only; not interactions/on_game_start |
| Console run-script（手动） | `run/` + 控制台 `run x.txt` | 条件搭建与效果链，可重复；仍需人开游戏 |
| Console `scripted_tests`（1.21，手动） | 游戏内控制台 `scripted_tests [pattern]` | 原版自带 20 个测试文件；需要已载入存档；无人值守入口未打通 |
| In-game（人点、机记；用户明确要求时可机器代点） | `工具-真机现场.mjs` + 点击 + 截图 + `error.log` token 计数 | 互动 / UI / tooltip / 决策 / 宣战界面；不能证明数值平衡与长期运行 |
| Workshop | launcher upload + page check | packaging/size/ID, not logic |

Never claim a layer passed if it was skipped; say **SKIP** and why.

> 1.21 实测：空播放集无头 **26.5 s 到 `Start running through history.` 后自行退出、exit 0**，
> 1.20 那个「到 history 必崩」的现象没有复现。但装 mod 后是否仍干净，要按当次报告判。

## References

- Wiki 索引（本次勘察生成）：`references/ck3-wiki-atlas.md`
- 实测要点（按域，带 `.info` 行号）：`references/verified-notes.md`（含 `[release]` 发布/工坊核对、`[automation]` 真机自动化）
- 真机验收 runbook（含 §9 机器代点）：`references/ingame-acceptance.md`
- 踩坑总账（2026-11-18 项目收尾）：`D:\DSH workspace\.admin\retro-2026-11-18-ck3mod.md`
- 索引生成器：`scripts/wiki-atlas.mjs`（`--check` 验鲜，`--out` 改输出位置）
- Shared tools: `D:\DSH workspace\ck3-modding-tools\README.md`
- Survey / decisions: `D:\DSH workspace\ck3-modding-survey\README.md`, `06-落地候选.md`
- Tests/tooling details: `D:\DSH workspace\ck3-modding-survey\03-工具链与测试.md`
- Game file notes: `D:\DSH workspace\ck3-modding-survey\02-机制与脚本借鉴.md`
- De-jure reverse baseline: `D:\DSH workspace\ck3-de-jure-conquest\README.md` and `发布说明.md`
