# 真机验收（in-game acceptance）

> 无头只验**加载期**：互动能不能点、tooltip 长什么样、决策面板有没有生效，只有进游戏才知道。
> 这份 runbook 是「真机验收」这一步的唯一操作来源；`SKILL.md` 只留铁律与指针，实测事实在
> `verified-notes.md` 的 `[ingame]` 一节。
> 版本：CK3 **1.21.0 "Florin"** · 本机 `C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III`

---

## 0. 什么时候必须跑

| 改了什么 | 真机 | 理由 |
|---|:--:|---|
| `character_interactions/`、`casus_belli_types/`、`decisions/`、`gui/`、`game_rules/` | **必须** | 无头不执行、静态抓不到「点下去会怎样」 |
| 本地化 `.yml` | **必须** | 静态只卡闭合，卡不到 UI 里的换行/裁切/中英混排 |
| `on_action` / 事件链 / 脚本效果 | 建议 | 用控制台 `event` + `run` 脚本先跑一遍，再进游戏点 |
| 只改数据表/工具/文档 | 不必 | 静态 + 无头够 |

## 1. 三条铁律

1. **人点、机记。** agent 负责准备现场、读日志、出结论；**不代点验收项**（用户 2026-11-18 明确要求）。
   只有用户当次明确说「你来点」才谈 GUI 自动化，而且要先完成第 2 节；具体做法与限制见 **§9**。
2. **先快照，后开游戏。** 一次 GUI 会话会覆盖 `autosave*.ck3`、`last_save.ck3`、`continue_game.json`
   （2026-11-18 14:44 实测），CK3 没有独立用户目录。开游戏前必须跑 `工具-真机现场.mjs --begin`。
3. **杀进程收场，绝不走「退出游戏」。** 退出菜单会写 `autosave_exit.ck3` + `last_save.ck3`，
   把用户上一次的退出存档冲掉。用 `Stop-Process -Name ck3 -Force`，再 `--end`。

## 2. 准备（五步，全部在开游戏之前）

**0）先确认「本局能观测到本次改动」**（2026-11-18 de-jure v2.3 踩过）：把本次改动需要的政体 / 等级 / 阶段列出来，
再决定用哪份存档。例：v2.3 补的是「行政政体的 Influence」，而第一轮用户新开的是**部落**局——那一项整局不可见，
等于没测，只能补第二轮。不可观测的项当场标 SKIP，别等验收完才发现。
**数值型改动还要写清上限/分母的来源**：mastery 的成功率显示上限是「潜力」（同谋槽位 + 技能），
define 的 95 只是硬顶——判读时连「当时同谋填了几个」一起记，否则「没到 95%」会被误当成 mod 没生效。

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\ck3-modding-tools"
& $node .\cli.mjs check --all          # 1) 静态/loc 必须 5/5 PASS，红了别开游戏

# 2) 部署要验收的 mod（auto 自 v2.1 起也有 工具-部署.mjs；之前没有，只能手工拷贝）
cd "D:\DSH workspace\ck3-scheme-mastery";     & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-de-jure-conquest";   & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-de-jure-organizer";  & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-free-resources";     & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-auto-spread";        & $node .\工具-部署.mjs

# 3) 建现场（快照 + 改写播放集），--mods 只列本次要验的
cd "D:\DSH workspace\dsh-ck3-mod-dev"
& $node .\工具-真机现场.mjs --begin --mods cn_scheme_mastery,cn_dejure_conquest,cn_dejure_organizer,free_resources,auto_spread
```

4. **确认 `Documents\...\mod\*.mod` 都在**（`--begin` 会替 `--mods` 校验，缺了直接报错）。
5. **确认 `Documents\...\gfx\map\spline_network\spline_network.splnet` 不存在**。
   存在就先挪走：它会永久压过游戏自带路网（见 `verified-notes.md` 的 `[road]`），
   且游戏更新后依然生效。

## 3. 启动

**路线 A（首选，2026-11-18 实测参数可用）**：跳过主菜单直接进游戏。

```powershell
& "D:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\binaries\ck3.exe" `
  -debug_mode -suppress_error_log -skip -play=<title_key>
```

`-play` 收头衔键（文档示例 `e_byzantium`；本机 1066 威尼斯 = `k_venice`，见 `[ingame]`）。
`-skip` / `-play=` / `-bookmark=` / `-loadsave=` 都来自 `game/_commandline_options.info` L9-22。
**`-skip` 直接落到新游戏选人界面**（不是主菜单）；「游戏规则」按钮就在该界面右下（2026-11-18 实测）。
实测：`-debug_mode -nographics -skip -play=k_venice -shutdown_after_history` **28.7 s 到 history 后自行退出（exit 0）**，
说明这套参数确实直接进了游戏；**日志里没有「玩家角色」行，`-play` 是否精确锁定该头衔未被直接证明**——
验收时以暂停菜单左上角的统治者名为准，不对就换回路线 B。

**路线 B（已验证，fallback）**：`ck3.exe -debug_mode -suppress_error_log` → 主菜单 → 新游戏 →
选 1066 剧本与统治者 → 开始（约 4 分钟，7 次点击）。

> **不存在 `-develop`**：`_commandline_options.info` 没有这一项，exe 里也搜不到。
> 热载正确做法：`-debug_mode` 下用控制台 `reload`（引擎里另有未文档化的 `-filewatcher`）。
> 五个 mod 现在都声明 `supported_version="1.21.*"`；启动器若仍提示「有此 mod 不兼容」，先查
> `Documents\...\mod\*.mod` 是不是 1.20 时代的老副本（重新部署即可）。

## 4. 五个 mod 的验收矩阵

每条只做一件事；**期望**写的是「该看到什么」，不是「应该没问题」。

### 4.1 mastery（谋略）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| G1 加载 | 启动器 Mods 页 → 进游戏 | 看卡片 + `logs\debug.log` | 版本 **1.0**、兼容 **1.21**；日志里有 `Enabled` + `Mounted Data` + `Loaded [1] events` | 卡片截图 + 日志 |
| G2 决议入口 | 右侧 HUD 图标列 → **F9 决议**（hover 读 tooltip）→ 滚到「决议（7）」组 | 点「豢养刺客」 | 确认卡（名称 / 暗红配图 / 正文 / 「让他们进来」）→ 点开面板 | 入口 + 确认卡 + 面板 3 张 |
| G3 面板 | 面板 | 数选项 | **5 个选项**：爪牙 / 毒药与匕首 / 一手遮天 / 收敛锋芒 / 先这样；正文说明五类计谋与 95% 上限 | 面板截图 |
| G4 换档与互斥 | 依次点三档 | 看角色窗口的修正列表 | 每次只留一档；tooltip 明写「你失去 X / 你获得 Y」；面板刷新后已选档消失 | 角色窗口 3 张 |
| G5 敌对成功率（必做） | 右键成年、非囚、非你父母子女的目标 → 谋杀 | 悬停成功率 | 明细里出现「一手遮天 +300.0%」；同谋 **0/5** 时最大约 **54%**、撤档回 **34%**（差 = 该档 `max_add` 20）；同谋 **4/5** 时到 **95%（最大 95%）** | tooltip 3 张 |
| G6 个人成功率（必做） | 右键 → 倾心 / 勾引 / 结交 | 悬停成功率 | 明细里同样出现本档加成（上限 95%）；注意「自然顶格 95%」看不出增量 | tooltip 截图 |
| G7 栏位 +1 | 顶档 + 谋**杀** + 绑**架**（**不同类型、同属 hostile**） | 看阴谋区卡片数 | 不挂档 **1 张** → 挂档 **2 张**（`SCHEMES_PER_TYPE=1` 挡住「同类型再开一个」） | 对照 2 张 |
| G8 撤档回落 | 「收敛锋芒」 | 看修正 + 再开计谋 | 三档修正全部消失；成功率回落到 34% 那一档 | 截图 + tooltip |
| G9 日志与收场 | 全程 | `error.log` | `cn_scheme_mastery` **0 条**，且无 `Script location` 指向本 mod；杀进程 + `--end` 还原 | 第 6 节日志命令 |

> 2026-11-19 机器代点结果：**G1–G6 / G8 / G9 与 G7 的敌对栏位全部通过**（证据在
> `ck3-scheme-mastery\验证记录\1-游戏内验证-v1.0\`）；**G7 的个人栏位**探针里 `sway` 没起来，交回用户手验，
> 同日口述「测试通过」——**口述证据强度低于截图**，复跑时优先补这一条。
> 政治 / 契约 / 贸易三类的实际成功率需要对应政体，本版不换局就记 **SKIP**（覆盖率已由静态 L0 机器证明）。

### 4.2 de-jure（法理征服）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| D1 CB 可见 | 对**公国**宣战 | 宣战界面 CB 列表 | 出现「法理征服[TITLE]（法理）」，**威望成本 100、虔诚 100（不是 0）** | 宣战窗截图 |
| D2 男爵领 | 对男爵领宣战 | 看 CB 列表 | **看不到**「法理征服」 | 截图 |
| D3 胜 | 打赢一场 | 看结算 + 地图 | 整块法理区域伯爵领到手（含第三方持有）；**POW 释放消息只出现一次**（翻倍即 wrapper 双调）；**不弹**战后报告（v2.3 已移除） | 结算截图 + 地图 |
| D3b Influence | 用**行政政体**（如拜占庭）打赢 | 看影响力数值 | 胜利结算时影响力**增加**（`add_influence_attacker_victory_effect`） | 结算前后数值 |
| D4 白和 | 另打一场白和 | 看结算 | 掉威望 + **压力结算提示**（1.21 原版行为）；不弹报告；不崩 | 截图 |
| D5 打输 | 再打输一场 | 看结算 | 付赔款 **10**、掉威望、内部不满；不弹报告；不崩 | 截图 |
| D6 决策 | 胜利后 365 天内 | 决策列表 | 「整合法理头衔」可点，一次创建多个头衔，扣 **150 威望**；用掉后消失 | 决策截图 |
| D7 日志 | 全程 | `error.log` | `cn_dejure_conquest` **0 条**，且无 `Script location` 指向本 mod | 日志命令 |

> 三种收场（胜 / 白和 / 败）各走一次是硬要求：三处各调一个不同的 war-end wrapper。
> D3b 只在行政政体局可测——准备阶段就要定好用哪份存档（见 §2 第 0 步）。

三种收场各走一次是它的验收要求（三处调用不同原版效果）。

### 4.3 free（天降横财）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| F1 决议入口 | 右侧 HUD 图标列 → **F9 决议** → 滚到「决议（N）」组 | 找「天降横财」 | 可见、可点 | 决议列表截图 |
| F2 主面板 | 点「天降横财」 | 看面板 | 四个入口：**一键全给… / 一键全扣… / 单项资源… / 特殊数值…** | 面板截图 |
| F3 加 | 一键全给 → 确认 | 看数值 | 九种货币/五项数值都**增加** | 面板 + 数值条 |
| F4 扣 | 一键全扣 → 确认 | 看数值 | 都**减少**（方向别反） | 面板 + 数值条 |
| F5 单项 | 单项资源 → 金币 | 连续点两次 | 每次即时生效（可连续点击） | 数值条 |
| F6 互动 | 右键角色 →「给予资源」 | 加/扣各一次 | 对方资源变化方向正确 | 角色面板截图 |
| F7 政体判定 | 换一个非游牧/非共和统治者看 | 面板 | 牧群/国库等不可用项按政体隐藏或禁用 | 截图 |
| F8 日志 | 全程 | `error.log` | `free_resources` **0 条** | 日志命令 |

> **2026-11-18 机器代点（v4.1 / 1.21.0）结果**：F2–F8 **通过**（截图在
> `ck3-free-resources\验证记录\10-游戏内验证-v4.1\`）；**F1 决议列表当时 SKIP** —— 旧记录写「顶部王冠」也不准，
> 2026-11-19 mastery 的 G2 已证明入口是右侧 HUD 的 **F9 决议**（hover 读 tooltip 即可定位），下次复跑可补 F1；
> 决议对象本身由静态校验兜住（`is_shown` + `effect → 0050`）。
> 数值实测：一键全给 +100（金币 99→199、威望 900→1000、虔诚 100→200、宗族威望 249→349），
> 一键全扣 −100 原路回到 99/900/100/249，单项资源连点两次 99→299。

### 4.4 auto（自动传播）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| A1 规则 | 主菜单「游戏规则」→ 过滤器选 **AI** | 找规则 | 「自动传播：AI 是否启用」可见，取值 关闭/开启 可切；描述完整 | 规则面板截图 |
| A2 设置面板 | 决议 →「自动传播」 | 看面板 | 五个开关（信仰/教派/文化/控制力/人物）+「传播速度设置」+「AI 设置」 | 面板截图 |
| A3 跑时间 | 全开 + 标准档跑 1–2 年 | 看领地 | 出现转化（信仰/文化/控制力变化） | 地图/领地截图 |
| A4 极速档 | 切「极速」再跑 1 年 | 看领地 | 转化更快，不崩 | 截图 |
| A5 日志 | 全程 | `error.log` | `auto_spread` **0 条**，且无任何 `Script location` 指向本 mod 文件（先按位置分组、扣掉原版噪声） | 日志命令 |

> **2026-11-18 机器代点（v2.1 / 1.21.0）结果**：A1/A2 **通过**（用户当次同意代点：规则在 AI 分类下可见可选；
> 面板五开关逐项点亮、速度切「极速 ✓」、两子页入口在列）；A3/A4 **用户自测通过**（18:37–20:16，约 1h40m，
> 报「没发现任何问题」）；A5 **机器复核通过**：`error.log` 里 `auto_spread` **0 条**、无 `Script location`
> 指向本 mod，同期 8,094 条 [E] 全为原版/DLC 噪声（基线见 `verified-notes.md [ingame]`）。

### 4.5 organizer（法理整顿）

**前置（缺一条就换局或 SKIP）**：**任意政体**（封建 / 氏族 / 部落 / 行政 / 游牧 / 共和 / 神权）、
**独立统治者或封臣统治者**、公爵级及以上、有首都伯爵领、和平期。矩阵与 mod 自己的
`测试清单.md` 一一对应（G1–G10），详细期望在那边，这里只留判读要点。

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| G1 只留首都链条 | 决议「一键法理整顿」 | 点一次 → 看头衔列表 | 名下只剩**首都伯爵领** + 首都链上**原本持有**的公国/王国/帝国/霸权；其余全没了（同级额外头衔例外） | 头衔列表截图 |
| G2 封臣瘦身 | 原来持 2+ 县的封臣 | 看他的头衔 | 只剩 1 个县（保留他自己的 `capital_county`），其余由新建伯爵接任 | 角色面板 |
| G3 高等头衔跟首都县 | 任一公国/王国/帝国 | 看持有人 | 持有人 == 它**首都伯爵领**的持有人（`title_capital_county.holder`），不是「首府公国」 | 头衔页 tooltip |
| G4 每级 ≤1 | 任一头衔封臣 | 数他的头衔 | 伯爵领 ≤1、公国 ≤1、王国 ≤1、帝国 ≤1（男爵领不在此列） | 角色面板 |
| G5 无同级/更高封臣 | 全领地 | 看最高 tier | 严格低于你（皇帝底下可有国王；国王底下不能有国王） | 领地树 |
| G6 新伯爵出现 | 被分封出去的县 | 看持有人 | 是**新建角色**（本地文化/信仰/仪式，`dynasty = generate`），不是原来的大地主 | 角色面板 |
| G7 成本 / 冷却 / 日志 | 决议 | 点前后看资源 + `error.log` | 扣 **300 金 + 300 威望**；**180 天**冷却；起于 `cn_dejure_organizer_*` 的报错 **0 条** | 资源条 + 决议页 + 日志命令 |
| G8 幂等 | 冷却结束后再点一次 | 看结果 | 头衔与封臣关系不再变化（第二趟没活可干） | 前后对照 |
| G9 封臣统治者 | 行政总督 / 国王手下的公爵 | 点决议 | 决议可见；只整理**自己的子领域**（不向上、不横向，不会把自己的头衔送给领主/兄弟） | 领地树前后 |
| G10 非封建政体 | 部落 / 游牧 / 行政 / 共和 / 神权各一次 | 点决议 | 三条规则同样成立；新伯爵政体**默认封建**（已知项）、任命制头衔例外见 README | 各局截图 |

> **判读口径**：① 同级/更高例外（国王的第二个王国、皇帝的第二帝国）会留在玩家名下——这是引擎限制，
> 不是 bug，工具提示与 README 已写明；② 商业共和国局会看到原版 `gdp_found_a_republic_effect` 建政链
> 与 `create_dynamic_title … house already has house title`，日本局会看到 `previous_holder` 报错——
> **按错误块的链首归因**（§5），只有起于 `cn_dejure_organizer_*` 的才算本 mod 失败；
> 商业共和国里 P5（转封）部分被原版以 `same or higher tier` 拒绝，属已知功能影响。
> ③ 2026-11-20 用户报告 G1–G10 通过（14:50，口述无逐项截图）；同会话 242 个错误块里 36 个末端指向本 mod、
> **0 个起于本 mod**。复跑时优先补「封臣统治者」与「商业共和国」两局的截图。

### 4.6 core（前置库）与三件套联测

**前置**：本机部署 core 1.0 + 消费者（dejure 2.4 / organizer 1.1）；启动器里三个都启用，
**core 放消费者上面**；禁用两个旧工坊订阅版（同名会重复定义）。core 单独启用**没有任何 UI**。

| 项 | 操作 | 期望 | 证据 |
|---|---|---|---|
| C1 三件套加载 | 启动到主菜单 / 载入存档 | 无缺依赖提示；`error.log` 无 `Unknown effect/trigger`、无 `cn_dejure_core` 起头的错误块 | 日志命令 |
| C2 dejure 战后整理 | 拿到 `cn_dejure_conquest_recent_victory`（赢一场法理 CB 或用控制台补 flag）→ 决议「整合法理头衔」→ 点 | 所有可创建头衔建出并归玩家；扣 150 威望；flag 消耗；与 v2.3 一致 | 决议页 + 头衔列表 + 日志 |
| C3 organizer 五阶段 | 决议「一键法理整顿」→ 点 | P1/P2 新伯爵、P3 补建、P4 首都县受让人、P5 转封各抽 1 项（见 §4.5 G1–G10）；行为与 v1.0 一致 | 头衔列表 + 角色面板 |
| C4 同局两个决议 | 先 C2 再 C3（或反过来） | 不重复扣费/不重复建衔；无报错 | 资源条 + 日志 |
| C5 只开 core | 只启用 core | 无决议/事件/按钮；`error.log` 无 `cn_dejure_core` 起头的错误块 | 日志 |

**收场**：杀 `ck3.exe` → `工具-真机现场.mjs --end` → `ck3mod_deploy core|dejure|organizer clean`。
日志归属按 §5：每个错误块的**链首**指向 `cn_dejure_core_*` / `cn_dejure_*` 才算本 mod 的错；
末端指向本 mod 的调用链是原版噪声。合并副本冒烟（见 `[dependency]`）只能证明加载期，不能替代这张表。

## 5. 证据规范

- **截图**：命名 `<mod>-<项号>-<hhmm>.png`（例 `mastery-G3-1452.png`），统一放
  `D:\DSH workspace\.admin\evidence-<YYYYMMDD>-<主题>\`。不要留在 `%TEMP%`（会被清）。
- **日志**（每条验收结束跑一次）：

```powershell
$u = "C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III"
foreach ($t in 'cn_scheme_mastery','cn_dejure_conquest','cn_dejure_organizer','free_resources','auto_spread') {
  "{0,-22} {1}" -f $t, (Select-String -Path "$u\logs\error.log" -Pattern $t -ErrorAction SilentlyContinue).Count
}
Select-String -Path "$u\logs\debug.log" -Pattern 'mod/(cn_scheme_mastery|cn_dejure_conquest|cn_dejure_organizer|free_resources|auto_spread)\.mod\|Enabled'
```

- **日志归属按「块首」判**：每个 `Script system error` 块取**第一个** `file:` / `Script location` 行，
  以本 mod 文件名开头才算我们的错；末端指向本 mod（调用链落在我们脚本上）**不算**。organizer 实测：
  用户会话 242 块 → 36 块末端含本 mod 决议 → **0 块起于本 mod**。

- **挂载确认**：暂停菜单左下角显示 `Florin（1.21.0），校验码: <hex>（有修改）`；校验码与无 mod 时不同
  即说明 mod 已被挂载（`-skip_checksum` 会跳过计算，别加）。UI 只读 exe 里的版本串——**吃了 `1.21.0.3`
  热修也照样显示 `1.21.0`**，别拿它判版本。
- **结论表**（写进 `.admin/update-record-*.md` 或 mod 的 `验证记录\`）：

```markdown
| 项 | 结果 | 证据 | 备注 |
|---|---|---|---|
| mastery G3 | PASS | mastery-G3-1452.png | 面板 5 选项、正文写明 95% 上限 |
| de-jure D3 | SKIP | — | 本局没打成胜仗 |
```

## 6. 收尾（六步，顺序不能换）

```powershell
# 1) 杀进程 —— 不要点游戏里的「退出游戏」
Stop-Process -Name ck3 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2) 还原现场（存档/设置/播放集按字节写回 + 隔离会话期新增存档）
cd "D:\DSH workspace\dsh-ck3-mod-dev"
& $node .\工具-真机现场.mjs --end

# 3) 确认没有现场（应打印「没有活动的现场」）
& $node .\工具-真机现场.mjs --check

# 4) 清掉本地 mod 副本（free 的部署脚本没有 --clean，手工删）
#    删之前先把上传后的 descriptor 字节数 / 末字节 / SHA256 记进验证记录 —— 三信号证据就在这两个文件里，
#    文件一删证据就没了（de-jure v2.3 收尾做法）。
cd "D:\DSH workspace\ck3-scheme-mastery";   & $node .\工具-部署.mjs --clean
cd "D:\DSH workspace\ck3-de-jure-conquest"; & $node .\工具-部署.mjs --clean
Remove-Item "C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III\mod\free_resources*" -Recurse -Force

# 5) 复核 mod 目录为空、播放集哈希一致（--end 已经核对，这里只做最后一眼）
Get-ChildItem "C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III\mod" -Force
```

6. 把截图与结论表落盘；**快照目录默认保留**（`%TEMP%\ck3-ingame\<stamp>\`）供审计，
   确认无问题后 `工具-真机现场.mjs --clean`。

> 如果 `--end` 报「游戏/启动器还在跑」：先 `Stop-Process -Name ck3 -Force`（或关掉启动器）再重试。
> 如果 `--end` 报哈希不符：**不要**手改快照目录，先把报错原文留下来，再查是哪一步动过文件。

## 7. 判定边界

- 真机能证明：**看得到、点得动、生效了、没有报错**。
- 真机不能证明：数值平衡、长期运行（10 年+）、AI 行为、多人兼容、性能。
- 「静态 + 无头 + 真机」都绿 ≠ 以后不会坏；改一处就按第 0 节重跑对应层。
- 跳过的项写 **SKIP + 原因**，不许写成 PASS。

## 8. 1.21 已知事实（先看再验）

- 版本与校验码位置、右键菜单结构、选项窗 tooltip 格式、游戏规则过滤器位置、`-develop` 不存在、
  存档会被覆盖的清单 → 全部在 `references/verified-notes.md` 的 `[ingame]`。
- 1.21 与 1.20 的差异（`development→prosperity`、区划/贸易/道路新库、法律可作 scope 等）→
  `SKILL.md` 的「1.21 变化」。
- **热修不改版本串**：本机 2026-11-19 已吃两次热修——`1.21 hotfix`（buildid `26757580`）与
  **`1.21.0.3`**（buildid `26785313`），主菜单仍显示 `Florin (1.21.0)`，只有校验码会变。开测前用
  `ck3mod_status` 的「游戏构建」行确认，别拿启动器或主菜单的版本号判「有没有更新」；详见 `[hotfix]`。
- **首传后的 descriptor 形状**：两份各 **+28 B**（`remote_file_id` 行），末字节仍是 `"`；
  **`supported_version` 可能仍是 `1.21.*`**（organizer 实测），别因为「没回写版本」判上传失败。
- 五个 mod 的已知旧结论：降祸 mod（已删除）的 `测试清单.md` 里 `T-G16` 是 **1.20.0.3** 时期通过的，
  「入口在更多…」这条在 1.21 观察到相反；de-jure README 的「启动器显示 1.20 兼容」同理。
  mastery 的 G7 个人栏位是**用户口述确认**（无截图），证据强度低于截图，复跑时优先补；
  organizer 的 G1–G10 同样是用户口述通过（2026-11-20 14:50），复跑时优先补「封臣统治者」与「商业共和国」两局。
  **验收以本文件的矩阵为准**，旧记录只当历史。

## 9. 机器代点（仅在用户当次明确要求时）

> 2026-11-18 用户说「你替我进行测试」后，free v4.1 的 F2–F8 就是这样跑完的；2026-11-19 mastery v1.0 的
> G1–G6/G8/G9 与 G7 敌对栏位也用同一套跑通（五轮新开 1066 拜占庭局）。
> 结论：**鼠标能打通，键盘不行**；纯图标入口要先 hover 读 tooltip 定位（决议是 **F9**，见 §9.6）。

### 9.1 前提（三步，缺一不可）

1. **现场**：先 `工具-真机现场.mjs --begin --mods <本 mod>[,<探针 mod>]`（`dlc_load.json` 只经工具改）。
2. **窗口模式**：把 `pdx_settings.txt` 的 `Graphics.display_mode` 改成 `windowed`（`--end` 会按字节还原）。
   全屏 + Raw Input 会把 `SendInput` / `mouse_event` 全部吞掉（实测：悬浮无 tooltip、空格不暂停）。
3. **DPI-aware**：注入脚本启动时先 `SetProcessDPIAware()`。否则 125% 缩放下截图是 1536×864、
   鼠标坐标被 OS 再缩放一次，点哪都不对；声明后 1920×1080 与物理像素 1:1。

### 9.2 五个动作（PowerShell，user32）

| 动作 | 实现 | 用途 |
|---|---|---|
| `shot` | `Graphics.CopyFromScreen` 存 PNG | 每一步的证据；读完再决定下一下点哪 |
| `click` / `rclick` | `SetCursorPos` + `mouse_event(DOWN/UP)` | 选项、按钮、右键交互菜单 |
| `hover` | 只移动并等 0.9 s | 验证「光标真的在 UI 上」（会出 tooltip） |
| `focus` | `ShowWindow(SW_RESTORE)` + `SetForegroundWindow` | 每次注入前都要做（见 9.3 的坑） |
| `type` | `SendInput` + `KEYEVENTF_UNICODE` | 备用；键盘目前打不通，不要依赖 |

**坐标换算**：`read_image` 的预览常被缩放到 1708 宽（1920/1708 ≈ **1.1241**）；从预览量到的坐标要乘回去再点。
每次点击后重新截图确认，不要连续盲点。**完整点击纪律见 §9.6**（行高、间隔、选角色）。

### 9.3 探针 mod 模板（不点菜单就能截到面板）

```
zz_probe/descriptor.mod                     # version/supported_version/picture，无 BOM
zz_probe/common/on_action/zz_probe.txt      # 见下
zz_probe.mod                                # 外层，path 指向 Documents\...\mod\zz_probe
```

```
# 两个开局钩子都要挂：单人新开局常走 on_game_start_after_lobby（game_start.txt:2806），
# 只挂 on_game_start 时面板可能不出现（日志却无报错）。只写 on_actions 列表，不要写 effect！
on_game_start = {
	on_actions = {
		zz_probe_game_start
	}
}

on_game_start_after_lobby = {
	on_actions = {
		zz_probe_game_start
	}
}

zz_probe_game_start = {
	effect = {
		if = {
			limit = { NOT = { has_global_variable = zz_probe_done } }
			every_player = {
				limit = { is_ai = no }
				set_global_variable = { name = zz_probe_done value = yes }
				# 目标流程才需要：先给事件里用到的 scope 存一个对象，例如
				# every_courtier = { limit = { is_adult = yes } save_scope_as = xxx_target }
				trigger_event = <mod>.<入口事件>
			}
		}
	}
}
```

- **两个钩子缺一不可**：2026-11-18 实测，只挂 `on_game_start` 时面板不出现、日志无报错；补挂
  `on_game_start_after_lobby` 后立刻出现（同版本、同一套选人流程，唯一变量就是钩子）。两个钩子都**只能写
  `on_actions` 列表**，靠全局变量 `zz_probe_done` 去重，避免重复触发。

- **root 是 `none`，探针要先「落到角色」**：`on_game_start` 的 root 不是任何角色，直接在 root 上判
  `is_independent_ruler` / `exists = capital_county` 会报 `Wrong scope for trigger: none`。
  需要「任意政体 / 封臣统治者」时改用随机选人 + 隐藏事件（organizer 的政体覆盖 8/8 就是这么跑的）：

```
# 每个政体各抽 1 个独立统治者；封臣统治者改用 random_ruler + limit = { is_independent_ruler = no }
random_independent_ruler = {
	limit = { government_has_flag = <该政体的 flag> }
	save_scope_as = zz_probe_actor
}
scope:zz_probe_actor = { trigger_event = zz_probe.0001 }   # 隐藏事件里 root = 该角色
```

  `every_ruler` + 全局变量去重**不生效**（实测在整张地图跑成百上千次、debug.log 成对刷屏）；
  `random_independent_ruler` 的原版用法见 `00_debug_interactions.txt:1180`。
- **绝对不要**写 `on_game_start = { effect = { … } }`：那是**整块覆盖**，原版开局设置全丢
  （实测：局势 intro 立刻变成 `ERROR:[ghibelline_leader…]` 占位）。
- 目标流程（需要 `scope:xxx_target`）：先 `every_courtier = { limit = { is_adult = yes } save_scope_as = xxx_target }`
  再 `trigger_event`，右侧头像与按对方判定的列表才正常。
- 探针测完就删（`zz_probe\` + `zz_probe.mod`），不要提交进仓库。

### 9.4 能自动 / 不能自动（free v4.1 + mastery v1.0 实测）

| 能 | 不能 |
|---|---|
| 事件面板与四入口、一键全给/全扣、单项连点、特殊数值 | 任何必须键盘的操作（`~` 控制台、ESC） |
| 右键交互菜单里的条目（分类折叠也看得见） | tooltip 完整文案（只能看截图里可见的部分） |
| 目标流程面板（右侧对方头像） | 数值断言的精确读数（`debug_log` 不解析数据函数，只能截图） |
| 政体门控后的列表内容、`error.log` 计数 | 跨年连续运行（原版事件会**自动暂停**游戏；必须跑时间的项一开始就划给人） |
| **HUD 入口（hover 读 tooltip 定位）**：F9 决议已实测（mastery G2）；事件面板换档 / 互斥 / 撤档 | 需要「同谋填满」这类**多因子自然条件**的读数（只能换局或明确 SKIP） |
| **政体覆盖**：随机选人探针（`random_independent_ruler` / `random_ruler`）→ 隐藏事件，7 政体 + 1 封臣统治者 **8/8** 跑到最后一行 | 探针只能证「效果整段能跑完」，不证 UI 与数值 |

> 2026-11-19 更正：**决议列表能自动**——右侧 HUD 图标列逐个 hover 读 tooltip 可定位「决议 F9」，
> 再滚到「决议（N）」组；free 的 F1 下次可补测。

### 9.5 证据

- 截图命名 `<mod>-<项号>-<说明>.jpg`，放 `验证记录\N-游戏内验证-<版本>\`；README 里给「项号 → 结论 → 文件名」表。
- 1920×1080 PNG 每张 3–4 MB，**转 JPEG q82** 再入库（43.8 MB → 3.1 MB 实测）。
- 同一目录附当次 `error.log` / `debug.log`（本 mod 报错计数 + `Loaded [n] events`）。

### 9.6 点击纪律与人机分工（2026-11-18b / 2026-11-19 实测）

> 2026-11-18b 的 auto v2.1 代点（A1/A2）与 2026-11-19 mastery v1.0（G1–G9）都是按这套跑通的；
> 违反任何一条都会得到「点了但没生效」的假象。

- **坐标从全尺寸截图量**：`read_image` 的预览常被缩到 1708 宽（实际 1920，系数 **1.1241**）；
  按预览标尺直接点会偏——实测差 20 px 就落到相邻控件。
- **事件面板每行 client 高约 36 px**：点开关时偏一行就会把**上一个**开关关掉；每次点击后重截确认状态，不要连点。
- **两次点击间隔 ≥1.2–1.5 s**：选项点击会 `trigger_event` 回自身并重绘事件，间隔太短会丢点击。
- **选项的行位会漂，别盲点**：选项数变化、tooltip 出现都会让面板整体重排。2026-11-19 实测因此把
  「收敛锋芒」当成「先这样」点到，把刚生效的档位撤掉了。正确姿势：**每次点击前重新 hover → 截图核对
  tooltip 里的选项名 → 同一坐标 click → 截图核对状态**，四步之间 1.2–1.5 s。
- **debug 顶栏有雷**：面板顶部的图标行里有「切换数据系统」「事件 scope 查看器」，误点会把所有文案变成
  `[success_chance|E]`、`[Scheme.GetSuccessChance|V/1]` 这类原始 loc 串——截图看起来像「loc 全崩」。
  取证前先截一张确认文案正常；看到原始串就再点一次同位置切回，**别把调试态截图当成品证据**。
- **找 HUD 入口靠 hover 读快捷键**（比翻 GUI 文件快）：**F4 内阁 · F5 贸易 · F6 廷臣 · F7 谋略 · F9 决议**；
  入口在**右侧竖排 HUD 图标列**，垂直居中偏上开始、间距约 33–37 px。决议列表按「罗马决议 / 重要决议 /
  领地决议 / 行政决议 / 宗教决议 / 决议 / 廷臣决议」分组，mod 决议默认落在「**决议（7）**」组，**要滚动**才看得到。
- **选角色**：先 hover 出 tooltip 再单点；点海面 / 不可通行地形会**清空已选**角色；点男爵领会打开角色档案
  （不是头衔窗口）。
- **时间项归人**：原版事件会**自动暂停**游戏（本次是拜占庭国库），「跑一年」这类必须连续跑时间的项不可无人值守。
  分工前先问「这一项有没有必须连续跑时间的成分」，有就一开始划给人，不要试到一半再交回。
