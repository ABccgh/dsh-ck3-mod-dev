# CK3 1.20.1.2 实测要点（按域）

> 这些是**我们自己在原版 `.info` 与 `common/` 上核过**的结论，不是 Wiki 摘抄；每条都带可指认的行号或实例。
> 游戏版本：**1.20.1.2 "Crozier"**；核对日期：2026-11-17。
> 用法：只在要动某个域时读对应一节（`[slug]`），不要整篇读。
> 维护：写进来的必须能指认（`.info` 行号 / vanilla 实例）；大版本更新后逐条复核，**失效的删掉**，不要留在里面。
> 收录：`[interaction]` `[cb]` `[government]` `[resources]` `[council]` `[story]` `[struggle]`

---

## [interaction] 角色互动（character interaction）

Wiki 那页只有 1 个示例，路由到 `_character_interactions.info`（840 行）之后不用再从零摸：

- **必填**：`category`（不写落 `uncategorized`）、`desc`、`icon`；`common_interaction = no` 才进「更多…」子菜单。
- **分类是代码枚举，不用自己定义**：loc 在 `localization/english/gui/characterinteractionwindow_l_english.yml`
  （`interaction_category_friendly` = "Personal"；`vassal` 另有 9 个语境变体）。
- **`flag = x` 产生的是「选区」不是条件**：勾选后 `scope:x` 被设为 yes，测试要写 `always = scope:x`
  （原版 250+ 处，多在 `if = { limit = { … } }`）。直接写 `scope:x = { … }` 会变成切换作用域，
  效果是「没勾也全加」。
- **检查顺序是硬的**（`.info` L746-780）：设齐目标 → 外交距离 → `special_interaction` 内置检查 →
  `is_shown` → 是否已在被考虑 → `is_valid_showing_failures_only` → `has_valid_target_showing_failures_only`
  → `can_send` → `is_valid` → `has_valid_target`。`can_be_picked` 只筛列表，**不在这条链里**。
- **`is_shown` 只放 actor / 全局可见条件**（`.info` L250-252 明说：挪到 `is_available` 里 AI 更快更好）；
  依赖 recipient 的判断放 `is_valid*`。
- **`cost` 收 script value**：`cost = { prestige = major_prestige_value }`（`00_accolade_interactions.txt:79`）；
  付不起直接禁用，付款在发送时扣。
- **`auto_accept = yes/no/trigger`**（`.info` L294-296）；要对方点头用 `no` + `ai_accept = mtth`（L598，root 是 recipient）。
- **`on_send` 发送即执行，`on_accept` 接受后执行**（L392-401）；效果块里没有 root 作用域，必须先落 `scope:actor` / `scope:recipient`。
- 最小可跑范例：`00_lover_interactions.txt` 的 `break_up_with_lover_interaction`
  （`is_valid_showing_failures_only = { }` 空块合法）。
- 文件名排序 = 加载顺序，同 ID 后加载覆盖前；我们新增对象，避免与别人的 ID 撞名。

## [cb] 宣战理由（casus belli）

Wiki 没有 CB 专页，只有玩家向的 `Casus belli`。规格在 `common/casus_belli_types/_casus_belli.info`（154 行）：

- **没有 `war_goal` 这个键**：1.20 用 `target_titles`（`none` / `neighbor_land` / `de_jure` / `claim` / `all`…）
  + `target_title_tier` + `use_de_jure_wargoal_only` + `attacker_wargoal_percentage` /
  `defender_wargoal_percentage`（`.info` L82-86、L11-12）定义战争目标。
- **四个 `on_*_desc` 缺一不可**（`.info` L56-59：缺了直接报错）：`on_victory_desc` / `on_defeat_desc` /
  `on_white_peace_desc` / `on_invalidated_desc`。
- **触发器作用域各不相同**（`.info` L65-79）：`allowed_for_character` root=attacker、
  `allowed_against_character` root=defender、`valid_to_start` root=attacker 且多一个 `scope:target`、
  `is_allowed_claim_title` root=title。`scope:defender` 可能不存在，要写兼容分支。
- **`group` 决定额外限制**（`_casus_belli_groups.info`）：`religious` / `de_jure` 两个组被代码引用、必须存在；
  `can_only_start_via_script = yes` 的组不进宣战界面，也不给 AI 用。
- **`cost` 用 script value**（`.info` L30），无条件时配一个 `CB_BASE_COST` 描述键；`ai = no` 让 AI 完全忽略；
  `interface_priority` 决定宣战列表顺序。
- 工作范例：`ck3-de-jure-conquest` 的 `zz_cn_dejure_conquest.txt`（512 行，v2.2 已发布）。

## [government] 政体（government）

Wiki 页停在 2021 年，**字段层级已经变了**。规格在 `common/governments/_governments.info`（827 行）：

- **`council` / `create_cadet_branches` / `rulers_should_have_dynasty` / `regiments_prestige_as_gold` 都在
  `government_rules = { }` 里**（`.info` L9 起）。Wiki 把它们写成政体顶层，1.20 里那样写不生效。
- **Wiki 的 `vassal_contract = { … }` 已不存在**：现在是 `vassal_contract_group = <组键>`（L532-540）。
- **必选元数据**：`mechanic_type`（L375）+ `is_mechanic_type_default`（L384，每个 mechanic_type 恰好一个默认）
  + `fallback`（L394，至少一个政体设 fallback，数字小优先）。
- **地产三件套**：`primary_holding`（L424）、`valid_holdings`（L431，主地产永远合法）、
  `required_county_holdings`（L438，县里先有这些才能再建）。
- **自定义 flag 用 `flags = { x }`**，触发端 `government_has_flag = x`（L770）；`character_modifier` **只接受**
  通用修正与 schemes / holdings / lifestyles / regions 生成的修正（`.info` 末尾），别处生成的会失效。
- `currency_levels_cap`（L622）管 piety / prestige / influence / merit 的等级上限，超过默认值要配
  `character_max_*_level_add`。
- 政体定义分三个文件：`00_government_types.txt`、`01_japan_government_types.txt`、`02_theocratic_government_types.txt`。

## [resources] 资源 / 虔诚档位

Wiki 那页标题叫 `Resources modding`，**标题误导**：

- **1.20.1.2 没有 `common/resources/` 这个数据库**：资源是硬编码的（gold / prestige / piety / renown /
  influence / treasury，游牧另有 provisions / herd，由政体的 `government_rules` 决定是否启用）。脚本侧
  只能花/给，**不能新增一种资源**。真要"新资源"，只能借上面之一，或自己做变量 + GUI。
- 那页 690 B 的实际内容是**虔诚档位**：`LEVEL_piety_value` = miniscule 25 / minor 50 / medium 100 /
  major 250 / massive 500（`common/script_values/00_basic_values.txt` L1131-1135），
  另有 `_piety_gain`（L1164-1168）与 `_piety_loss`（L1139+）两组别名。
- **别套同一组数字**：prestige 档位是 35 / 75 / 150 / 350 / 750（同文件 L1000-1004）。成本与效果一律写
  script value 名，不要写裸数字。

## [council] 议会（council）

`common/council_positions/_council_positions.info`（96 行）+ `common/council_tasks/_council_tasks.info`（87 行）：

- **布尔触发器的「空块默认值」不对称**：`auto_fill` / `inherit` / `can_change_once` 空块 = **no**，
  `can_fire` / `can_reassign` 空块 = **yes**（`.info` L8-15）。写错就是「永远换不了人」或「永远能换」。
- **三组作用域别混**：`valid_position` 的 SCOPE 是议会主人，`valid_character` 是申请者（L37-44）；
  `on_get_position` / `on_lose_position` / `on_fired_from_position` 的 root 是当事人，另有
  `councillor_liege`、`new_councillor`、`swapped_position` 可用（L46-74）。
- **Wiki 有两个字段 1.20 已不可用**：`special_council_position`、`max_amount` 在 `.info` 里没有、vanilla 0 处使用；
  `use_for_scheme_power` 已改名 `use_for_scheme_phase_duration`（L76-77）。照 Wiki 抄会得到不生效的字段。
- **task 决定职位能不能用**：`task_type` 三档（general / county / court）、`task_progress` 三档；
  `monthly_on_action` 比在 `on_monthly` 里 fire on_action 省（L46）；`clone = 别的 task` 只能改 `position`（L79-83）。
- 每个职位至少配一个 task —— Wiki 说否则加载崩溃，`.info` 未写；保守照做。

## [story] 故事循环（story cycle）

`common/story_cycles/_story_cycles.info`（170 行）。Wiki 那页（3 KB）方向对，但漏了 UI 那一半：

- 创建/结束不在 `.info` 里：`create_story = <key>` 或块式 `create_story = { type = x save_scope_as = story }`；
  结束 `end_story = yes`（也常见 `scope:story = { end_story = yes }`）。
- `on_setup` / `on_end` / `on_owner_death` 的 root 是故事循环本身（`scope:story` 同义）；
  要动主人得写 `story_owner = { … }`（L8-18）。
- **`visible = no` 是默认值**（L23）：不写 `visible`、`icon`、`background` 玩家根本看不到；
  图标缺省会去 `gfx/interface/icons/story_cycles/<key>.dds` 找（L28-39）。
- **`effect_group` 是心跳**：`days/weeks/months/years = x`（或区间），`chance` 不中会在下个 duration 再试；
  内部四选一：`triggered_effect`（全跑）/ `random_valid` / `first_valid` / `fallback`（L118-167）。
- `visualization` 的 `character` / `title` / `artifact` 列表与 `basic_counter` / `tug_of_war_counter`
  按变量名取值，**类型不符会报错且不显示**（L60-116）。

## [struggle] 斗争（struggle）

路径是 `common/struggle/struggles/`（**不是** `common/struggles/`），催化剂在 `common/struggle/catalysts/`。
定义规格见 `_struggles.info`（140 行），起停规格在 **`history/struggles/_struggles.info`**（另一份）：

- 运行时 API：`start_struggle = { struggle_type = x start_phase = y }`、`end_struggle = <决策键>`、
  `activate_struggle_catalyst`。**对没开始的斗争 end 会报错**，要套存在性检查。
- **硬约束**：`phase_list` 至少一个、`start_phase` 必填；且**至少一个相位要有 `ending_decisions`，
  或本身是 ending phase**（L92-93、L114-115），否则永远结束不了。
- 相位计时两种：`duration = { points = 10 }` 或 `duration = { years = x }`；不写 `duration` 按点数相位算（L99-112）。
  `save_progress = yes` 才在换相位时保留进度（L95-96）。
- `catalysts.txt` 只登记名字、内容留空（`_catalysts.info` 原话「Nothing here, we only need the name」）；
  相位里 `catalysts = { 键 = 整数 }`，root = struggle（L42-46）。
- `involvement_prerequisite_percentage` 默认 0.8，**文化/信仰共用同一比例**，不能分开配（L25-27）。
- `on_start` / `on_end` / `on_change_phase` / `on_monthly` 的 root 是 struggle；`on_join` 的 root 是角色（L126-139）。
