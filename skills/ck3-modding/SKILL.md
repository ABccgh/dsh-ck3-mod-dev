---
name: ck3-modding
description: |
  Use for Crusader Kings III mod work in D:\DSH workspace: researching current
  mechanics on the CK3 Wiki, editing scripts, events, interactions, decisions,
  casus belli, localization, descriptors, thumbnails; running static validation,
  shared loc checks, reverse verification, headless smoke tests, local deployment,
  and Steam Workshop updates. Load this before touching any of the four published
  mods, the shared toolchain, or the wiki atlas.
metadata:
  author: "local workspace"
  version: "0.2.4"
---

# CK3 Modding — Workspace Playbook

## When to use

Load this skill when the task concerns:

- any of the four published mods: `ck3-auto-spread`, `ck3-curse`,
  `ck3-de-jure-conquest`, `ck3-free-resources`;
- the shared checker in `D:\DSH workspace\ck3-modding-tools`;
- **查 CK3 Wiki**：某个 trigger/effect/字段现在到底怎么写、1.20 改了什么；
- localization, script validation, headless checks, deployment, or Workshop uploads;
- the research report in `D:\DSH workspace\ck3-modding-survey`.

Do **not** load it for playing the game or for unrelated projects.

## Read first (in this order)

1. `D:\DSH workspace\工作区索引.md` — current state, version notes, which mod is where.
2. The mod's `README.md` — its "怎么改 / 下次 CK3 更新时 / 注意事项" sections are the operational truth.
3. `references/ck3-wiki-atlas.md`（本 skill 目录下，加载 skill 时会给 base dir）——
   Wiki 全量导航：67 个 modding 页的最后编辑、`{{version}}` 声明、是否 1.20 口径。
4. `references/verified-notes.md` — **动手前**按路由表的「要点」列读对应小节（`[interaction]` / `[cb]` /
   `[council]` …）：1.20.1.2 实测结论，每条带 `.info` 行号，只读需要的那节。
5. `D:\DSH workspace\ck3-modding-survey\06-落地候选.md` — if the task is "what should we do next".
6. `D:\DSH workspace\ck3-modding-survey\03-工具链与测试.md` — if the task involves tests/tooling.

Never infer a path or a command from memory; read the mod README first.

## Environment

- Game: `D:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III` (never edit it).
- User data: `C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III`.
- Node (not on PATH):
  `C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`
- Python (not on PATH):
  `C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe`
- Steam Workshop content: `D:\Program Files (x86)\Steam\steamapps\workshop\content\1158310`.
- Game version: **1.20.1.2 "Crozier"**（Wiki 记 2026-10-21 发布；本机 2026-10-27 更新，
  `launcher\launcher-settings.json` 与 `titus_branch.txt` 可复核）。
- 四个 mod 的当前发布快照：`ck3-auto-spread` **2.0** · `ck3-curse` **1.0** ·
  `ck3-de-jure-conquest` **2.2** · `ck3-free-resources` **4.0**，均 `supported_version="1.20.*"`。
  仓里还留着 v1.0/v3.1 等旧快照（`1.19.0.6`），那是历史归档，别拿它当现状。
- 改之前先复核：`ck3mod_status`（预设内）或 `cli.mjs check --all`，确认基线还是绿的。

## 查资料：三层真相

写任何脚本前先想清楚「这条结论该信谁」。三层混用是这类工作最常见的错误来源。

| 层 | 来源 | 能回答什么 | 什么时候别信 |
|---|---|---|---|
| 1 | CK3 Wiki（`ck3wiki_*` 工具） | 语义、示例、工作流、补丁说明 | 页面 >1 年没动；`Effects list` / `Triggers list` 这类抄录页 |
| 2 | 本机原版 1.20.1.2：`.info` 文档与 `common/`（`ck3mod_vanilla`） | 键名、类型、参数、这个键现在还在不在 | 只有 DLC 新内容才可能缺 |
| 3 | 四个 mod 自己的 `数据-*.mjs` + `工具-静态校验.mjs` + loc 检查 | 我们自己的不变量与契约 | 只覆盖我们写过的规则 |

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
- `Category:1.20`（84 页）是编辑者标的「当前版本口径」，可以当起点，但不是免检章。
- 不抄正文进仓库：索引只存标题/日期/一句备注，正文用工具现读。

### 路由表：什么话题去哪个页面

「要点」列指向 `references/verified-notes.md` 里的实测小节（本 skill 目录下）：**按需只读一节，不要整篇读**；
`—` 表示这个域还没核过。每条都带 1.20.1.2 的 `.info` 行号。

| 要做的事 | Wiki（层 1） | 语法真相（层 2） | 要点 |
|---|---|---|---|
| 事件 | `Event modding`（2026-10 已按 1.20.1 更新） | `events/` + `events/*.info` | — |
| 角色互动 | `Interactions modding`（**只有 1 个示例，1.4 KB**） | `common/character_interactions/` + `.info` | `[interaction]` |
| 决策 | `Decisions modding` | `common/decisions/` + `.info` | — |
| 特质 | `Trait modding` | `common/traits/` + `.info` | — |
| 宣战理由 CB | **无专页**；`Casus belli` 是玩家向机制页 | `common/casus_belli_types/` + `.info` | `[cb]` |
| 头衔 / 法理 | `Title modding`；机制语义看 `Titles`（1.20） | `common/titles/`、`history/titles/` | — |
| 文化 / 传统 | `Culture modding`；`Culture`、`Traditions`（1.20） | `common/culture/` | — |
| 宗教 / 教义 | `Religions modding`（1.20 口径） | `common/religion/` | — |
| 政体 | `Governments modding`（2021 页，旧） | `common/governments/` + `.info` | `[government]` |
| 议会 | `Council modding` | `common/council_positions/`、`common/council_tasks/` | `[council]` |
| 地产 / 建筑 | `Holdings modding`；`Building`（1.20） | `common/holdings/`、`common/buildings/` | — |
| 兵种 / 常备军 | `Regiments modding` | `common/men_at_arms_types/` | — |
| 生活方式 | `Lifestyles modding` | `common/lifestyle_perks/` | — |
| 宝物 | `Artifact modding` | `common/artifacts/` | — |
| 历史（角色/头衔/省份） | `History modding` | `history/` | — |
| 故事循环 | `Story cycles modding` | `common/story_cycles/` + `create_story` | `[story]` |
| 斗争 | `Struggle modding`（2026-09，质量较好） | `common/struggle/struggles/`、`history/struggles/` | `[struggle]` |
| AI 权重 | `AI modding`、`Weight modifier` | `common/scripted_*`、`ai_*.info` | — |
| 变量 / 脚本值 | `Variables`、`Script values` | `.info` | — |
| 资源 / 成本档位 | `Resources modding`（**标题误导**：实为虔诚档位） | `common/script_values/00_basic_values.txt` | `[resources]` |
| modifier 键 | `Modifier list`（35 KB） | `modifiers.info` | — |
| 本地化 | `Localization`、`Customizable localization` | `localization/**/*.yml` | — |
| GUI | `Interface` | `gui/**/*.gui`、`interface.info` | — |
| 地图 / 地形 | `Map modding`、`Terrain modding` | `map_data/` | — |
| 控制台与调试 | `Mod troubleshooting`、`Console commands` | — | — |
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

Baseline at 2026-10-19: curse loc 122 / de-jure 36 (v2.2) / free 84 / auto 94, all 0 errors.
`auto`'s static validator now supports `--root`; `check` runs it against the release snapshot
and it passes. Passing `--root` is preferred over deploying a local copy.
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
| `ck3mod_vanilla` | search the installed 1.20 scripts / loc / `.info` docs for real triggers and effects | — |
| `ck3mod_workshop` | per-segment description bytes (≤ 8000), descriptor fields, empty `remote_file_id` | — |

Wiki 工具（同一会话里保留可见，只读）：

| Tool | 用来 |
|---|---|
| `ck3wiki_category` | 取清单：`Modding`（67 页）/ `1.20`（84 页） |
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
| `ck3-auto-spread` | hand-written script/loc | no generator (v2.0) | `工具-检查.mjs` (`--root` static validator + loc) | settings via global variables + game rules; 1.20 rite fields already used |

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

## 手动调试闭环（Wiki 教的最省时间的一段）

无头只验加载期；交互、UI、tooltip、条件链只能进游戏。先把闭环搭好，再谈测试：

1. **启动参数**：Steam → 属性 → 启动选项加 `-debug_mode -develop`（或在快捷方式末尾加）。
   `-develop` 让大部分脚本/本地化**改完即热载**，不必重启游戏。
2. **控制台**：debug_mode 下打开调试 UI；`event <namespace>.<id>` 触发事件，
   `effect add_gold = 100` / `trigger is_adult = yes` 直接试效果/触发器。
3. **生成文档**：控制台跑 `script_docs`（triggers/effects 等日志落到 `logs/`）与 `dump_data_types`。
   这是层 2 的**最新**来源，比 Wiki 抄录页和安装目录里的 `.info` 都新。
4. **错误计数**：`release_mode` 打开 Errorhoof 计数器；`log_viewer` 看游戏内日志。
5. **脚本埋点**：效果 `debug_log` / `error_log` 往日志打点，确认分支真的走到了。
6. **Explorer**：Ctrl+click 切角色、Alt+click 杀角色、Ctrl+Alt+click 在 Explorer 打开对象，
   可以直接在游戏里跑 effect/trigger。
7. **run 脚本（可重复测试）**：把搭条件的 effect 链写成
   `Documents\Paradox Interactive\Crusader Kings III\run\<name>.txt`（等价事件的 `immediate` 块），
   控制台 `run <name>.txt` 执行。**这是目前唯一被证实的「半自动」测试路径**。

## Hard rules

1. **Never edit the game install directory.** All work is in the mod repo, then deploy a copy.
2. **`dlc_load.json` belongs to the launcher.** Before any headless run: copy it, record SHA256,
   use only the test mod, then restore byte-for-byte and verify the hash.
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
9. **自动 `scripted_tests` 入口仍未证实**（2026-11-17 复核）：`-automated_test` headed/headless 都失败；
   `-run_console_action` 连 `version` 都退出 1。**可重复的路径只有「人工控制台 + run 脚本」**
   （见「手动调试闭环」第 7 条），它仍然是手动的。别给四个 mod 加 `tests/`，除非哪天真的证明了自动入口。
10. **Do not trust `dlc_load.json` alone for isolation.** The first spike still saw a Workshop
    mod's `on_auto_spread_ai` reference with only the test mod listed. Check `debug.log`
    `Mounted`/`Enabled` lines and the launcher playset.
11. **Wiki 不是语法真相**：抄录列表页会过期；键名/参数一律回层 2（`.info` / `script_docs`）。

## Verification layers

| Layer | Tool | What it catches |
|---|---|---|
| Loc structure | shared `loc` | BOM, header, `$...$`, `[...]`, `#tag`, cross-language `$` sets |
| Static rules | per-mod `工具-静态校验.mjs` | braces, descriptors, loc keys, Vanilla token existence, mod-specific invariants |
| Reverse | shared `reverse` + per-mod reverse | whether checks actually fire on deliberate defects |
| Headless | `ck3.exe -debug_mode -nographics -shutdown_after_history` | load-time errors only; not interactions/on_game_start |
| Console run-script（手动） | `run/` + 控制台 `run x.txt` | 条件搭建与效果链，可重复；仍需人开游戏 |
| In-game | manual test list | behavior, tooltips, UI, interaction clicks |
| Workshop | launcher upload + page check | packaging/size/ID, not logic |

Never claim a layer passed if it was skipped; say **SKIP** and why.

## References

- Wiki 索引（本次勘察生成）：`references/ck3-wiki-atlas.md`
- 实测要点（按域，带 `.info` 行号）：`references/verified-notes.md`
- 索引生成器：`scripts/wiki-atlas.mjs`（`--check` 验鲜，`--out` 改输出位置）
- Shared tools: `D:\DSH workspace\ck3-modding-tools\README.md`
- Survey / decisions: `D:\DSH workspace\ck3-modding-survey\README.md`, `06-落地候选.md`
- Tests/tooling details: `D:\DSH workspace\ck3-modding-survey\03-工具链与测试.md`
- Game file notes: `D:\DSH workspace\ck3-modding-survey\02-机制与脚本借鉴.md`
- De-jure reverse baseline: `D:\DSH workspace\ck3-de-jure-conquest\README.md` and `发布说明.md`
