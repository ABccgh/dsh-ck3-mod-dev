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
   只有用户当次明确说「你来点」才谈 GUI 自动化，而且要先完成第 2 节。
2. **先快照，后开游戏。** 一次 GUI 会话会覆盖 `autosave*.ck3`、`last_save.ck3`、`continue_game.json`
   （2026-11-18 14:44 实测），CK3 没有独立用户目录。开游戏前必须跑 `工具-真机现场.mjs --begin`。
3. **杀进程收场，绝不走「退出游戏」。** 退出菜单会写 `autosave_exit.ck3` + `last_save.ck3`，
   把用户上一次的退出存档冲掉。用 `Stop-Process -Name ck3 -Force`，再 `--end`。

## 2. 准备（五步，全部在开游戏之前）

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\ck3-modding-tools"
& $node .\cli.mjs check --all          # 1) 静态/loc 必须 4/4 PASS，红了别开游戏

# 2) 部署要验收的 mod（auto 没有部署脚本，按它 README 手工拷贝 auto_spread/ + auto_spread.mod）
cd "D:\DSH workspace\ck3-curse";           & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-de-jure-conquest"; & $node .\工具-部署.mjs
cd "D:\DSH workspace\ck3-free-resources";   & $node .\工具-部署.mjs

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
| D3 胜 | 打赢一场 | 看结算 + 地图 | 整块法理区域伯爵领到手（含第三方持有）；出现**战后报告 widget**（攻守双方） | 战后报告截图 + 地图 |
| D4 白和 | 另打一场白和 | 看结算 | 不出现 widget；掉威望，不崩 | 截图 |
| D5 打输 | 再打输一场 | 看结算 | 不出现 widget；付赔款、掉威望，不崩 | 截图 |
| D6 日志 | 全程 | `error.log` | `cn_dejure_conquest` **0 条** | 日志命令 |

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

### 4.4 auto（自动传播）

| 项 | 入口 | 操作 | 期望 | 证据 |
|---|---|---|---|---|
| A1 规则 | 主菜单「游戏规则」→ 过滤器选 **AI** | 找规则 | 「自动传播：AI 是否启用」可见，取值 关闭/开启 可切；描述完整 | 规则面板截图 |
| A2 设置面板 | 决议 →「自动传播」 | 看面板 | 五个开关（信仰/教派/文化/控制力/人物）+「传播速度设置」+「AI 设置」 | 面板截图 |
| A3 跑时间 | 全开 + 标准档跑 1–2 年 | 看领地 | 出现转化（信仰/文化/控制力变化） | 地图/领地截图 |
| A4 极速档 | 切「极速」再跑 1 年 | 看领地 | 转化更快，不崩 | 截图 |
| A5 日志 | 全程 | `error.log` | `auto_spread` **0 条** | 日志命令 |

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
- 四个 mod 的已知旧结论：curse `测试清单.md` 的 `T-G16` 是 **1.20.0.3** 时期通过的，
  「入口在更多…」这条在 1.21 观察到相反；de-jure README 的「启动器显示 1.20 兼容」同理。
  **验收以本文件的矩阵为准**，旧记录只当历史。
