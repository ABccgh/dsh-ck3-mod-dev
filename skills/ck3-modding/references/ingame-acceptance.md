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

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\ck3-modding-tools"
& $node .\cli.mjs check --all          # 1) 静态/loc 必须 4/4 PASS，红了别开游戏

# 2) 部署要验收的 mod（auto 自 v2.1 起也有 工具-部署.mjs；之前没有，只能手工拷贝）
cd "D:\DSH workspace\ck3-curse";           & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-de-jure-conquest"; & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-free-resources";   & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-auto-spread";      & $node .\工具-部署.mjs

# 3) 建现场（快照 + 改写播放集），--mods 只列本次要验的
cd "D:\DSH workspace\dsh-ck3-mod-dev"
& $node .\工具-真机现场.mjs --begin --mods cn_curse,cn_dejure_conquest,free_resources,auto_spread
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
> 启动器会显示「有此 mod 不兼容」的提示（四个 mod 仍声明 `supported_version="1.20.*"`），
> 忽略即可——加载期已验证干净。

## 4. 四个 mod 的验收矩阵

每条只做一件事；**期望**写的是「该看到什么」，不是「应该没问题」。

### 4.1 curse（降祸）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| C1 入口 | 右键任意角色 | 看互动菜单 | 「敌对」下出现 **降下疫病 / 夺其心智 / 毁其躯体 / 污其血脉**（1.20 记录是在「更多…」；1.21 实测直接展开，**以实测位置记录**） | 菜单截图 |
| C2 选项数 | 每项点开 | 数复选框 | 疫病 9 / 心智 4 / 躯体 9 / 血脉 2 | 四张选项窗截图 |
| C3 只勾一个 | 降下疫病 → 勾「患病」→ 确定 | 打开目标角色窗口 | 只多 `患病`（`ill`），没有别的 | 目标特质栏截图 |
| C4 不勾 | 重开选项窗 → 直接点确定 | 看是否可点/是否生效 | 按钮禁用或点了无效果；目标特质不变 | 截图 + 目标特质栏 |
| C5 多选 | 勾两个（如患病 + 肺炎）→ 确定 | 看目标 | 两个都在（叠加） | 目标特质栏 |
| C6 互斥 | 重复施同一项/互斥组合 | 看第二次 | 被挡或不再叠加 | 截图 |
| C7 副作用 | 全程 | `error.log` | `cn_curse` **0 条** | 第 6 节日志命令 |

> 施加后目标立刻生效（确定性，无随机）；「有时生效有时不生效」= bug。

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
| F1 决议入口 | 顶部王冠（决议） | 找「天降横财」 | 可见、可点 | 决议列表截图 |
| F2 主面板 | 点「天降横财」 | 看面板 | 四个入口：**一键全给… / 一键全扣… / 单项资源… / 特殊数值…** | 面板截图 |
| F3 加 | 一键全给 → 确认 | 看数值 | 九种货币/五项数值都**增加** | 面板 + 数值条 |
| F4 扣 | 一键全扣 → 确认 | 看数值 | 都**减少**（方向别反） | 面板 + 数值条 |
| F5 单项 | 单项资源 → 金币 | 连续点两次 | 每次即时生效（可连续点击） | 数值条 |
| F6 互动 | 右键角色 →「给予资源」 | 加/扣各一次 | 对方资源变化方向正确 | 角色面板截图 |
| F7 政体判定 | 换一个非游牧/非共和统治者看 | 面板 | 牧群/国库等不可用项按政体隐藏或禁用 | 截图 |
| F8 日志 | 全程 | `error.log` | `free_resources` **0 条** | 日志命令 |

> **2026-11-18 机器代点（v4.1 / 1.21.0）结果**：F2–F8 **通过**（截图在
> `ck3-free-resources\验证记录\10-游戏内验证-v4.1\`）；**F1 决议列表 SKIP** —— 决议按钮靠图标定位、
> 键盘注入又不通，只能人工确认；决议对象本身由静态校验兜住（`is_shown` + `effect → 0050`）。
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

## 5. 证据规范

- **截图**：命名 `<mod>-<项号>-<hhmm>.png`（例 `curse-C3-1452.png`），统一放
  `D:\DSH workspace\.admin\evidence-<YYYYMMDD>-<主题>\`。不要留在 `%TEMP%`（会被清）。
- **日志**（每条验收结束跑一次）：

```powershell
$u = "C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III"
foreach ($t in 'cn_curse','cn_dejure_conquest','free_resources','auto_spread') {
  "{0,-22} {1}" -f $t, (Select-String -Path "$u\logs\error.log" -Pattern $t -ErrorAction SilentlyContinue).Count
}
Select-String -Path "$u\logs\debug.log" -Pattern 'mod/(cn_curse|cn_dejure_conquest|free_resources|auto_spread)\.mod\|Enabled'
```

- **挂载确认**：暂停菜单左下角显示 `Florin（1.21.0），校验码: <hex>（有修改）`；校验码与无 mod 时不同
  即说明 mod 已被挂载（`-skip_checksum` 会跳过计算，别加）。
- **结论表**（写进 `.admin/update-record-*.md` 或 mod 的 `验证记录\`）：

```markdown
| 项 | 结果 | 证据 | 备注 |
|---|---|---|---|
| curse C1 | PASS | curse-C1-1452.png | 1.21 直接展开在「敌对」下 |
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
cd "D:\DSH workspace\ck3-curse";           & $node .\工具-部署.mjs --clean
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
- **热修不改版本串**：本机 2026-11-19 已吃 1.21 hotfix（buildid `26757580`），主菜单仍显示
  `Florin (1.21.0)`，只有校验码会变。开测前用 `ck3mod_status` 的「游戏构建」行确认，别拿启动器
  或主菜单的版本号判「有没有更新」；详见 `[hotfix]`。
- 四个 mod 的已知旧结论：curse `测试清单.md` 的 `T-G16` 是 **1.20.0.3** 时期通过的，
  「入口在更多…」这条在 1.21 观察到相反；de-jure README 的「启动器显示 1.20 兼容」同理。
  **验收以本文件的矩阵为准**，旧记录只当历史。

## 9. 机器代点（仅在用户当次明确要求时）

> 2026-11-18 用户说「你替我进行测试」后，free v4.1 的 F2–F8 就是这样跑完的。
> 结论：**鼠标能打通，键盘不行**；纯图标定位的入口（如决议列表）仍建议留给人工。

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

- **绝对不要**写 `on_game_start = { effect = { … } }`：那是**整块覆盖**，原版开局设置全丢
  （实测：局势 intro 立刻变成 `ERROR:[ghibelline_leader…]` 占位）。
- 目标流程（需要 `scope:xxx_target`）：先 `every_courtier = { limit = { is_adult = yes } save_scope_as = xxx_target }`
  再 `trigger_event`，右侧头像与按对方判定的列表才正常。
- 探针测完就删（`zz_probe\` + `zz_probe.mod`），不要提交进仓库。

### 9.4 能自动 / 不能自动（free v4.1 实测）

| 能 | 不能 |
|---|---|
| 事件面板与四入口、一键全给/全扣、单项连点、特殊数值 | 决议列表这类靠图标定位的入口（本次 F1 SKIP） |
| 右键交互菜单里的条目（分类折叠也看得见） | 任何必须键盘的操作（`~` 控制台、ESC） |
| 目标流程面板（右侧对方头像） | tooltip 完整文案（只能看截图里可见的部分） |
| 政体门控后的列表内容、`error.log` 计数 | 数值断言的精确读数（`debug_log` 不解析数据函数，只能截图） |
| 面板 / 开关 / 规则可见性、右键菜单、选项窗 | 跨年连续运行（原版事件会**自动暂停**游戏；必须跑时间的项一开始就划给人） |

### 9.5 证据

- 截图命名 `<mod>-<项号>-<说明>.jpg`，放 `验证记录\N-游戏内验证-<版本>\`；README 里给「项号 → 结论 → 文件名」表。
- 1920×1080 PNG 每张 3–4 MB，**转 JPEG q82** 再入库（43.8 MB → 3.1 MB 实测）。
- 同一目录附当次 `error.log` / `debug.log`（本 mod 报错计数 + `Loaded [n] events`）。

### 9.6 点击纪律与人机分工（2026-11-18b 实测）

> 2026-11-18b 的 auto v2.1 代点（A1/A2）就是按这套跑通的；违反任何一条都会得到「点了但没生效」的假象。

- **坐标从全尺寸截图量**：`read_image` 的预览常被缩到 1708 宽（实际 1920，系数 **1.1241**）；
  按预览标尺直接点会偏——实测差 20 px 就落到相邻控件。
- **事件面板每行 client 高约 36 px**：点开关时偏一行就会把**上一个**开关关掉；每次点击后重截确认状态，不要连点。
- **两次点击间隔 ≥1.2–1.5 s**：选项点击会 `trigger_event` 回自身并重绘事件，间隔太短会丢点击。
- **选角色**：先 hover 出 tooltip 再单点；点海面 / 不可通行地形会**清空已选**角色；点男爵领会打开角色档案
  （不是头衔窗口）。
- **时间项归人**：原版事件会**自动暂停**游戏（本次是拜占庭国库），「跑一年」这类必须连续跑时间的项不可无人值守。
  分工前先问「这一项有没有必须连续跑时间的成分」，有就一开始划给人，不要试到一半再交回。
