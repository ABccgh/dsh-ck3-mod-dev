# CK3 1.21.0 实测要点（按域）

> 这些是**我们自己在原版 `.info` 与 `common/` 上核过**的结论，不是 Wiki 摘抄；每条都带可指认的行号或实例。
> 游戏版本：**1.21.0 "Florin"**（2026-11-17 发布，本机 2026-11-18 更新）；核对日期：2026-11-18。
> 用法：只在要动某个域时读对应一节（`[slug]`），不要整篇读。
> 维护：写进来的必须能指认（`.info` 行号 / vanilla 实例）；大版本更新后逐条复核，**失效的删掉**，不要留在里面。
> 收录：`[interaction]` `[cb]` `[government]` `[resources]` `[council]` `[story]` `[struggle]` `[district]` `[trade]` `[road]` `[laws]` `[ingame]` `[automation]` `[release]`

---

## 1.21 改名与「patch note ≠ 实机名」

Patch 1.21 的 Modding 段很密，但**有几条与安装目录对不上**。写脚本前先扫这张表，名字一律以 `grep` 结果为准。

| 1.21 说法 | 实机结论 | 证据 |
|---|---|---|
| `development` 改名 `prosperity` | 真改了：county 属性现在叫 prosperity，修正 `prosperity_growth` / `*_prosperity_level`，档位 `terrible/bad/medium/good/great/max_prosperity_level` = 10/20/40/60/80/100 | `modifier_definition_formats/00_definitions.txt` L3082-3233；`script_values/00_basic_values.txt` L1543-1549；`defines/00_defines.txt` L1076-1080 |
| 省份 `monthly_income` 改名 `monthly_tax` | **`monthly_tax` 在安装目录 0 处**（无定义、无 loc、无使用）；能用的是 `total_monthly_tax_income`、`monthly_<税种>_tax` | `achievements/ep2_achievements.txt` L361；`buildings/alum_district_buildings.txt` L156 |
| `has_ongoing_construction` 拆分 | `has_ongoing_holding_construction`（常用）/ `has_ongoing_trade_post_construction` | `character_interactions/00_tribal_interactions.txt` L55；`trigger_localization/00_building_triggers.txt` L16 |
| `monthly_income_per_piety_level` 移除 | 改成 `generic_tax_per_piety_level` + 12 个分税种版本（agricultural/mining/religious/urban/artisan/maritime/tribal/civic/woodland/commerce…） | `00_definitions.txt` L3003-3063 |
| `scheme_discovery_chance_mult` 移除 | 定义**仍在** `00_definitions.txt` L2161（可能只为兼容保留）；新代码别再用 | 同上 |
| 驻军 MAA 维护 mult 移除 | `stationed_maa_*` 只剩 damage/toughness/pursuit 等战斗属性，维护费统一走 `men_at_arms_maintenance` | `00_unit_definitions.txt` L1080+；`00_definitions.txt` L1180 |
| `province_mapping` 移除、省份历史重构 | `history/provinces/` 现按王国分文件（`k_england.txt` …），不再有 `00_*.txt` 总表 | 目录实况 |
| `has_free_building_slot` 改 district scope | 在 district / building 上写；province 上写是 1.9 时代的老习惯 | `00_great_project_types.txt` L3502；见 `[district]` |
| patch 点名的这些「新增」名，vanilla **0 调用**：`add_regular_district`（effects loc 存在，L4223）、`set_road_tier`、`building_constructor`、`has_next_building_level`、`can_be_upgraded`、`district_has_building_with_flag`、`has_building_flag`、`add_trade_good_modifier`（**不存在**，真名 `add_trade_good_price_modifier`） | 代码可能提供但原版没用；本机未进游戏实测 → 用前先跑一次控制台验证，别凭 patch note 直接上线 | `localization/english/effects_l_english.yml` L4223 / L4025；`scripted_effects/trade_good_price_modifiers.txt` L1 |

---

## [interaction] 角色互动（character interaction）

Wiki 那页仍是 1 个示例，路由到 `common/character_interactions/_character_interactions.info`（1.21 共 875 行）之后不用再从零摸：

- **必填**：`category`（L16 注释 Required!）、`desc`（L204）、`icon`（L39）；不写分类落 `interaction_category_uncategorized`（loc L42）。
  分类本身是代码枚举，loc 在 `localization/english/gui/characterinteractionwindow_l_english.yml`（`friendly`="Personal" L13，`vassal` 另有 `_governor`/`_vassal`/`_client` 等变体 L18-21）。
- **`common_interaction = no`**（L14）才进「更多…」子菜单；分类不写只影响归类，不影响能否点。
- **`flag = x` 产生的是「选区」不是条件**（L363）：勾选后 `scope:x` 被设为 yes，测试要写 `always = scope:x`
  （1.21 原版 `common/` 里 **300 处**）。直接写 `scope:x = { … }` 会变成切换作用域，效果是「没勾也全加」。
- **检查顺序是硬的**（L782-795）：设齐目标 → 外交距离 → `special_interaction` 内置检查 →
  `is_shown` → 是否已在被考虑 → `is_valid_showing_failures_only` → `has_valid_target_showing_failures_only`
  → `can_send` → `is_valid` → `has_valid_target` → `special_interaction` 的 can_send 检查。
  `can_be_picked`（L281）只筛列表，**不在这条链里**（L800 / L809 原文）。
- **`is_shown` 只放 actor / 全局可见条件**（L252-255 原文：actor 或全局状态放 `is_available`，AI 更快更好；
  `is_available` 在 L613）。依赖 recipient 的判断放 `is_valid*`。
- **`cost` 收 script value**（L516）；付不起直接禁用，付款在发送时扣。`auto_accept = yes/no/trigger`（L308）；
  要对方点头用 `no` + `ai_accept = mtth`（L623，root 是 recipient）。
- **`on_send` 发送即执行，`on_accept` 接受后执行**（L405 / L409）；效果块里没有 root，必须先落 `scope:actor` / `scope:recipient`。
- **1.21 新增的目标类型**：`can_be_picked_trade_market`（L292）、`can_be_picked_trade_good_type`（L296）、
  `can_be_picked_trade_good_category_type`（L299）；`actor_maa` / `actor_title_maa` 等列表见 L739-744 —— 互动可以直接指向贸易市场与商品。
- 最小可跑范例：`00_lover_interactions.txt` 的 `break_up_with_lover_interaction`（L2；`is_valid_showing_failures_only = { }` 空块合法）。
- 文件名排序 = 加载顺序，同 ID 后加载覆盖前；我们新增对象，避免与别人的 ID 撞名。

## [cb] 宣战理由（casus belli）

Wiki 没有 CB 专页，只有玩家向的 `Casus belli`。规格在 `common/casus_belli_types/_casus_belli.info`（154 行）：

- **没有 `war_goal` 这个键**：用 `target_titles`（`none` / `neighbor_land` / `neighbor_land_or_water` / `de_jure` / `claim` /
  `independence_domain` / `all` / `all_landed`…，L82）+ `target_title_tier`（L83）+ `attacker_wargoal_percentage` /
  `defender_wargoal_percentage`（L11-12，默认 0.75 是 vanilla 常见值，未写时按 1）。
- **四个 `on_*_desc` 缺一不可**（L56-59：`on_victory_desc` / `on_defeat_desc` / `on_white_peace_desc` / `on_invalidated_desc`，
  缺了直接报错）。
- **触发器作用域各不相同**（L68-79）：`allowed_for_character` root=attacker、`allowed_against_character` root=defender、
  `valid_to_start` root=attacker 且多一个 `scope:target`、`is_allowed_claim_title` root=title。
  1.21 新增三个 `*_display_regardless`（L69 / L72 / L76）：失败只显示原因、不隐藏该 CB。
- **`cost` 用 script value**（L30），无条件时配一个 `CB_BASE_COST` 描述键；`ai = no`（L116）让 AI 完全忽略；
  `should_show_war_goal_subview`（L143）决定宣战窗是否显示战争目标子视图。
- **group 文件在 1.21 搬家了**：`common/casus_belli_groups/_casus_belli_groups.info`（81 行），不在 `casus_belli_types/` 下。
  `religious` / `de_jure` 两个组**被代码引用、必须存在**（L5-7）；`can_only_start_via_script = yes` 的组不进宣战界面、也不给 AI（L60-65）。
- group 侧还有 `should_invalidate`（L41-56，战争失效条件）、`allowed_for_character_display_regardless`（L26-39）、
  `should_check_for_interface_availability`（L67-72）、`debug`（L75-80）——1.20 的笔记里都没有。
- 工作范例：`ck3-de-jure-conquest` 的 `zz_cn_dejure_conquest.txt`（512 行，v2.2 已发布）。

## [government] 政体（government）

Wiki 页停在 2021 年，**字段层级还是错的**。规格在 `common/governments/_governments.info`（1.21 共 902 行）：

- **`council` / `create_cadet_branches` / `rulers_should_have_dynasty` / `regiments_prestige_as_gold` 都在
  `government_rules = { }` 里**（L9 起）。Wiki 把它们写成政体顶层，那样写不生效。
- **Wiki 的 `vassal_contract = { … }` 已不存在**：现在是 `vassal_contract_group = <组键>`（L598；全文 `vassal_contract =` 0 处）。
- **必选元数据**：`mechanic_type`（L420）+ `is_mechanic_type_default`（L429，每个 mechanic_type 恰好一个默认）
  + `fallback`（L439，至少一个政体设 fallback，数字小优先）。
- **地产三件套**：`primary_holding`（L469）、`valid_holdings`（L476，主地产永远合法）、
  `required_county_holdings`（L483，县里先有这些才能再建）。
- **1.21 新增两个键**：`title_maa_setup`（L587，开启「头衔常备军」）与 `trade_post = yes`（L321，商业共和国/贸易站；
  需政体与头衔类型**双边**支持，原版只有 `republic_government` 与 `title_type_merchant_family` 开）。
- **自定义 flag 用 `flags = { x }`**（L835），触发端 `government_has_flag = x`；`character_modifier` **只接受**
  通用修正与 schemes / holdings / lifestyles / regions 生成的修正（L851-863，原文明确排除其他政体、兵种、文化、地形生成的修正）。
- `currency_levels_cap`（L674-680）管 piety / prestige / influence / merit 的等级上限；上限数值在
  `defines/00_defines.txt` 的 `LEVELS_PIETY`（L154）、`LEVELS_PRESTIGE`（L155）、`DEFAULT_PIETY_LEVEL_CAP`（L160）。
- 政体定义分三个文件：`00_government_types.txt`、`01_japan_government_types.txt`、`02_theocratic_government_types.txt`。

## [resources] 资源 / 虔诚档位

Wiki 那页标题叫 `Resources modding`，**标题误导**：

- **1.21 仍然没有 `common/resources/` 这个数据库**：资源是硬编码的（gold / prestige / piety / renown /
  influence / treasury，游牧另有 provisions / herd，由政体的 `government_rules` 决定是否启用）。脚本侧
  只能花/给，**不能新增一种资源**。真要「新资源」，只能借上面之一，或自己做变量 + GUI。
- **虔诚档位改名了**（1.20 的 `LEVEL_piety_value` 在 1.21 **已不存在**）：
  `miniscule_piety_value` 25 / `minor` 50 / `medium` 100 / `major` 250 / `massive` 500 / `monumental` 1000
  （`common/script_values/00_basic_values.txt` L1181-1186，多了 monumental 一档）。
- 配套别名：`*_piety_loss`（L1189-1209，`subtract = …` 形式）与 `*_piety_gain`（L1214-1219）。
- **别套同一组数字**：prestige 档位是 35 / 75 / 150 / 350 / 750 / 1500（同文件 L1050-1055）。
  成本与效果一律写 script value 名，不要写裸数字。
- 等级上限不是这套数：等级表在 `defines/00_defines.txt`（`LEVELS_PIETY` L154、`LEVELS_PRESTIGE` L155），
  上限由 `DEFAULT_PIETY_LEVEL_CAP`（L160）与政体 `currency_levels_cap` 共同决定。

## [council] 议会（council）

`common/council_positions/_council_positions.info`（96 行）+ `common/council_tasks/_council_tasks.info`（87 行）：

- **布尔触发器的「空块默认值」不对称**：`auto_fill`（L8）/ `inherit`（L12）/ `can_change_once`（L15）空块 = **no**，
  `can_fire`（L13）/ `can_reassign`（L14）空块 = **yes**。写错就是「永远换不了人」或「永远能换」。
- **三组作用域别混**：`valid_position`（L37）的 SCOPE 是议会主人，`valid_character`（L43）是申请者；
  `on_get_position` / `on_lose_position` / `on_fired_from_position` 的 root 是当事人，另有
  `councillor_liege`、`new_councillor`、`swapped_position` 可用。
- **Wiki 有两个字段从 1.20 起就不可用**：`special_council_position`、`max_amount` 在 `.info` 里没有、vanilla 0 处使用；
  `use_for_scheme_power` 已改名 `use_for_scheme_phase_duration`（L76），另有 `use_for_scheme_resistance`（L77）。
- **task 决定职位能不能用**：`task_type` 三档（general / county / court，L4）、`task_progress` 三档（L10）；
  `monthly_on_action`（L46）比在 `on_monthly` 里 fire on_action 省；`clone = 别的 task`（L79-83）只能改 `position`。
- 每个职位至少配一个 task —— Wiki 说否则加载崩溃，`.info` 未写；保守照做。

## [story] 故事循环（story cycle）

`common/story_cycles/_story_cycles.info`（170 行）。Wiki 那页（3 KB）方向对，但漏了 UI 那一半：

- 创建/结束不在 `.info` 里：`create_story = <key>` 或块式 `create_story = { type = x save_scope_as = story }`；
  结束 `end_story = yes`（1.21 原版 `end_story` 154 处、`create_story` 57 处，均仍可用）。
- `on_setup`（L8）/ `on_end`（L13）/ `on_owner_death`（L18）的 root 是故事循环本身；
  要动主人得写 `story_owner = { … }`。
- **`visible = no` 是默认值**（L23）：不写 `visible`、`icon`（L28-43）、`background`（L44-57）玩家根本看不到。
- **`effect_group` 是心跳**（L119 起）：`days/weeks/months/years`（L122）或区间，`chance`（L127）不中会在下个 duration 再试；
  内部四选一：`triggered_effect`（全跑，L138）/ `random_valid`（L147）/ `first_valid`（L157）/ `fallback`（L166）。
- `visualization`（L60-116）的 `character` / `title` / `artifact` 列表与 `basic_counter` / `tug_of_war_counter`
  按变量名取值，**类型不符会报错且不显示**。

## [struggle] 斗争（struggle）

路径是 `common/struggle/struggles/`（**不是** `common/struggles/`），催化剂在 `common/struggle/catalysts/`。
定义规格见 `_struggles.info`（140 行），起停规格在 **`history/struggles/_struggles.info`**（另一份，30 行）：

- 运行时 API 仍在用：`start_struggle`（原版 2 处）、`end_struggle`（9 处）、`activate_struggle_catalyst`（280 处）。
  **对没开始的斗争 end 会报错**，要套存在性检查。
- **硬约束**：`phase_list`（L34）至少一个、`start_phase`（L123-124）必填；且**至少一个相位要有 `ending_decisions`
  （L93），或本身是 ending phase**（L92-93 原文）。
- ending phase（L114-120）里**不要写** `ending_decisions` / 修正 / 下一相位——写了也会被忽略。
- 相位计时两种：`duration = { points = 10 }`（L102-104）或 `duration = { days/weeks/months/years = x }`（L109-111）；
  不写 `duration` 按点数相位算。`save_progress = yes`（L96）才在换相位时保留进度。
- `catalysts.txt` 只登记名字、内容留空；相位里 `catalysts = { 键 = 整数 }`（L43-45），root = struggle。
- `involvement_prerequisite_percentage` 默认 0.8（L27），**文化/信仰共用同一比例**，不能分开配。
- `on_start`（L117/L127）/ `on_end`（L130）/ `on_change_phase`（L133）/ `on_monthly`（L139）的 root 是 struggle；
  `on_join`（L136）的 root 是角色。

## [district] 地产 / 区划（district）

1.21 把区划提成独立数据库：`common/districts/_districts.info`（172 行），省份历史侧见 `history/_provinces.info`（110 行）。
这一域 Wiki **没有 modding 页**，只有玩家向的 `Districts`。

- **`district_type` 三要素**：`type` 取 regular / special / duchy_capital / holding / great_district / trade_post / entrepot
  （默认 regular，L27-31）；`primary_building` 建区划时自动落地（L42-）；`buildings` 只列可建首级、不含主建筑（L54-62）。
- **地产侧对称**：`_holdings.info` 的 `primary_district` + `districts`（L5-19），与 district 的 `primary_building` / `buildings` 一一对应。
- **表现层 root 是省份**：`triggered_name`（L3-8）与 `background`（L13-17）都在「区划所在地 province」求值；
  `background` 不写 trigger 即无条件命中，**书写顺序就是优先级**，vanilla 一律留一条无 trigger 的当 fallback。
- **建造门槛三条**：`is_enabled`（L134-141，root=province，另给 `scope:holder` / `scope:county`）、
  `can_construct_potential` / `can_construct_showing_failures_only` / `can_construct`（L156-171）全真才能进菜单并开工。
- **`can_be_replaced`**（L48-52）：可被同类型别的区划顶掉，照样付成本与时间并拆掉不兼容建筑；vanilla 在 regular / duchy_capital 显式 yes、
  trade_post / entrepot 显式 no。`can_rebuild` / `rebuild_cost` 只对 great district 有意义（L143-154）。
- **建筑侧只有 `district_level_requirement`**（`_buildings.info` L34-41，父区划等级门槛，root=province）；
  加建筑槽靠修正 `building_slots_for_host_district`（写在建筑的 `province_modifier` 里，vanilla 值 1/2/4/6，`.info` 未写）。
- **市场修正全挂建筑**：`market_modifier` 及 `market_culture/faith/terrain/size/dynasty/government/situation_modifier`
  （`_buildings.info` L370-435），district 定义里**没有** market 字段；`market_size_modifier` 用 `province_size` 精确等值（L408-413）。
- **槽位与作用域**：`has_free_district_slot` 在 **province**（`scope:province = { … }`，`hold_court_events_general.txt` L2056）；
  `has_free_building_slot` / `free_building_slots` 在 **district**（`00_great_project_types.txt` L3502/L3545）。
  运行时增删：`add_special_district` / `add_special_district_slot`（只开槽）/ `remove_district_type`（`00_building_effects.txt` L1353-1354）。
  `add_regular_district` 只有 effects loc（L4223），原版 0 调用 → 用前实测。
- **历史写法**（`history/_provinces.info`）：`province_size = N` 定起始区划槽、默认 1（L110）；
  `districts = { district = { type / level / buildings } }`（L49-88，实例 `history/provinces/k_england.txt` L15-42）；
  只开槽写 `special_district_slot = X`（L106）/ `entrepot_district_slot = X`（L108）；贸易站 `trade_post = { type / level / owner / buildings }`（L97-104）。
- **坑**：① `province_size` 漏写只有 1 个常规区划槽；② holding district 的 `type` 必须与省份 `holding` 匹配，不匹配整条被跳过并报错，
  且会清掉除主建筑外所有建筑、漏 `level` 会重置回 1；③ `free_building_slots` 的 scope 写反、或沿用不存在的 `can_be_upgraded` / `has_building_flag`
  （原版 0 命中；实际是 `can_building_be_upgraded`、`has_building_with_flag`、`building_type_has_flag`）都不会生效。

## [trade] 贸易 / 市场 / 商业共和国

`common/trade/**`、`common/trade_tasks/` 与政体 `trade_post` 规则都是 1.21 新增，Wiki **没有 modding 页**。
`.info` 本身至少 3 处与 vanilla 对不上，名称一律以现行脚本为准。

- **商品定义**：`trade_good_<x> = { base_price / origin / category / is_basic }`（`_trade_good_type.info` L14-51）。
  只有 `base_price` 没标 Optional；`.info` 写「integer (not script value)」，**但 vanilla 44 个商品全用小数**（0.023–0.16，
  `basic_trade_goods.txt` L5、L10）→ 照 .info 写整数会得到完全不同的价位。
- **`category` 在 vanilla 里 0 个商品写**（`.info` 却留着这个字段 L39-45）：归属实际由分类文件决定。
- **`origin = { x y }`** 是地图像素坐标，只决定 entrepôt 链的**供货方向**（`skip_internal_fulfillment` 的需求只能由「不比它更远」的同向 entrepôt 供）；
  普通需求与非 entrepôt 市场不受影响，不写则任意方向可转手（L24-37）。
- **`is_basic`** 只作用于 distribution route（自动携带线路上所有 basic 商品、不能带别的）；profit route 完全无视它（L47-51）。
- **分类成员键名是 `trade_goods = { … }`**（`01_need_type_trade_good_categories.txt` L12-15），而 `.info` L36-46 那段连键名都没写、
  示例还是裸 key 列表 → 照抄必失败。need 类一个商品只能进一个，非 need 类可进多个（L14-17）；类文件必须按依赖顺序排（`01_…` L1）。
- **need 类会自动生成修正键** `trade_category_<key>_sell_price_mult` / `_buy_price_mult` / `_xp_gain_mult`，并有 `per_level_interval` /
  `milestone_interval`（含 `every_level`）两层加成（`_trade_good_categories.info` L48-76）。
- **`county_potential_trade_goods`** 顶层是 `trade_good_<x>`、内层 `counties = { c_… }`——填的是 **county 头衔**，没有 province/barony 粒度；
  44 个商品只有 35 个填了（`county_potential_trade_goods.info` L10-22）。
- **关税档位**：`toll_level` 只有 `route_owner_toll_rate` / `market_owner_toll_rate` 两个比例（`_toll_levels.info` L16-26），
  vanilla 六档 0→0.05（`00_toll_levels.txt` L1-47）；`on_exception_ended` 的**真名是 `on_toll_exception_ended`**
  （`on_action/trade_on_actions.txt` L544-548，root=受影响市场，带 `new_toll_level` / `old_toll_level` / `character`），
  同族还有 `on_market_changed_toll_level`（L488-492）、`on_toll_exception_changed`（L518-522）。
- **Trader 任务库 `trade_tasks`**：`aptitude` + `aptitude_level_breakpoints` + `icon` + `animation` + 五档 `scaling_modifiers`
  （terrible/poor/average/good/excellent）+ `default = yes`（`00_trade_tasks.txt` L5-58）；**没有** `position` / `task_type` / `task_progress`，
  与 council task 不是一套。vanilla 仅 3 个。
- **政体与 script link**：`trade_post = yes` 需政体与头衔类型双边支持（`_governments.info` L314-321）；
  角色侧 `can_have_trade_posts`（root=角色）；`trade_post_count` < `trade_post_limit` 由 scripted rule 管（`scripted_rules/00_rules.txt` L1648/L1658）。
  barony → `trade_market`；province → `trade_post_district` + `trade_post_owner`；character → `any_held_trade_market` / `every_trade_route`。
- **最常用的接口**：`add_trade_good_price_modifier`（改买卖价，`scripted_effects/trade_good_price_modifiers.txt` L1）、
  `monthly_income_from_trade_mult`（`00_definitions.txt` L566）、`is_trade_monopoly_for_trade_good_category`（`ep5_achievements.txt` L293）、
  `any_held_trade_market`（`gdp_merchant_triggers.txt` L701）、`on_trade_route_created`（`trade_on_actions.txt` L4-11）、
  `on_trade_monopoly_invalidated`（`dlc/gdp/monopoly_on_actions.txt` L4）。
- **坑**：① `add_trade_good_modifier` 不存在（见上面「改名与落差」）；② `base_price` 的「integer」不能信；③ `toll_tier` 未文档化，
  只在 script value 里当对象字段读（`script_values/gdp_toll_values.txt` L297）。

## [road] 道路（road）

1.21 把道路拆成三层：`common/roads` 定义 + `spline_network` 地图样条 + 按 tier 施加修正。脚本侧接口很少，Wiki 没有对应页。

- **`road_type` 只有三个字段**：文件里直接写 `<道路键> = { }`，没有外层包装；字段是 `tier`、`spline_asset_id`、`provinces`
  （`_road_types.info` L14-37）。
- **`tier` 取 0–5，0 = 未建成**：上限由 `defines` 的 `MAX_ROAD_TIER = 5` 控制，只有 > 0 的路才在开局绘制；
  tier 0 的路仍然存在、只是隐藏（`_road_types.info` L15-19；`00_defines.txt` L2064-2066）。
- **升级很慢**：1→2 级 60 月、2→3 240、3→4 480、4→5 720；48 个月没有贸易路线就掉一级；
  某 tier 的活跃贸易路线数跨过阈值可跳过常规施工时间（`00_defines.txt` L2067-2076）。
- **`spline_asset_id` 只认 0/1**：0 = dirtroad、1 = naval route（海路，同时标记 sea road，完全不吃 road modifiers）；
  与 `spline_types` 的 `id` 对齐（`_road_types.info` L21-27；`spline_types/00_default.txt` L1-17）。
- **`provinces` 顺序即绘制顺序**：首项起点、末项终点，相邻两项之间都必须有一条 spline，缺一段就不画并在 error.log 报
  `Could not find spline network strip`；两端还得落在市场首府上，改 `market_capital` 要连坐改路（`_road_types.info` L2-4、L29-37）。
- **热载与 spline 生成**：游戏运行中改 `common/roads` 会重载道路、自动补齐缺失 spline，并把整张网络写到
  `Documents\…\gfx\map\spline_network\spline_network.splnet`；控制台 `SplineNetwork.AppendAssets` 等价（`_road_types.info` L6-8）。
- **Documents 那份副本是坑**：一旦生成就一直压过游戏自带 splnet（游戏更新后仍在），启动时 error.log 会点名它；
  要随 mod 发布就把调好的文件放进 mod 的 `gfx/map/spline_network/spline_network.splnet` 并删掉 Documents 副本（L9-12）。
- **road_modifiers 按 tier 施加**：`road_modifiers_default` 是代码必需项、不能删；`tier_0`..`tier_5` 可乱序可跳号，
  没写的 tier 什么都不给，而 `tier_0` 的修正从开局起对每条路都生效。`.info` 说「最多四个块」却列了五个
  （`modifier` / `province_modifier` / `trade_route_modifier` / `travel_modifier` / `character_modifier`，`_road_modifiers.info` L4-31）。
- **能用的接口**：`add_road_modifier` / `remove_road_modifier`（有 tooltip 键，`effects_l_english.yml` L3237-3245）、
  `road_construction_speed`（percent 修正，`00_trade_definitions.txt` L55-58）、`trade_route_length_add/mult`（`route_length` 只是 concept 别名）。
  `set_road_tier` / `has_road_modifier` / `remove_all_road_modifier_instances` 在 `game\` 下 **0 处引用**，签名无法从安装目录核实 → 用前实测。

## [laws] 法律（law）

结构仍是「law group 归组 + law 对象挂一串 trigger」，`.info`（`common/laws/_laws.info`，454 行）逐字段写了「Root scope = …」。

- **两层结构**：law 用必填 `law_group_type` 挂到 `common/law_groups`（`_law_groups.info` 58 行）；组侧 `default`（新统治者用哪条）、
  `cumulative`（后一级是否继承前一级全部效果）、`flag = realm_law`（是否进 My Realm 窗口，L3-19）。
- **`index` 是组内显示顺序**（L8-12）：全组唯一、默认 0、可为负；重复时「定义在前的赢」。
- **Root = ruler**：`can_keep` / `can_have` / `can_pass` / `potential`（只藏 UI、不挡 NPC）/ `requires_approve` /
  `should_start_with` / `pass_cost` / `revoke_cost` / `on_pass` / `on_after_pass` / `on_revoke` / `ai_will_do`
  （L15-62、L96-106、L171-197、L345-351）。
- **Root = title**：`can_title_have` / `should_show_for_title` / `can_remove_from_title`（L64-69、L84-94），
  `term_length`（原文 root = considered for succession，L382-388）。
- **Root = character**：`can_realm_have`（L71-82，**默认 false**）、`ai_approval`（强势封臣 scope）、`voting_session`（root = realm ruler，L390-399）。
- **默认值不对称是头号坑**：`can_title_have` 与 `can_realm_have` 不写就是 **false**，其余 trigger 不写是 true →
  title law 必须显式写 `can_title_have`，要禁 realm 级就写 `can_realm_have = { always = no }`。
- **`succession` 决定 Realm / Title 适用范围**（L199-220、L418-434）：title only = `player_heir` / `noble_family` / `generate_from_template`；
  realm only = `inheritance (partition)` / `theocratic` / `company` / `generate`；**Realm & Title = `inheritance (single_heir)` / `appointment` / `election`**
  ——这就是 1.21「elections 双侧都有效」的落点（vanilla realm 侧 `republican_elective`、title 侧 `feudal_elective`）。
- **1.21 变更的边界**：`take_realm_capital` 只有一句（default no、原版 0 用例，且缩进错挂在 `manual_law_change` 下，L373-380）；
  「law 可作 scope 用于 flavorization」`.info` **未写**——flavorization 只认 `realm_laws` / `title_laws` 数组，
  `.info` 给的唯一 law 数据函数是 `CHARACTER.GetActiveLawInGroupWithFlag`（`_flavourization.info` L377-393）。
- **坑**：① 默认法初始化时 `can_pass` 被完全忽略、`on_pass` 不执行 → 靠 `on_pass` 清 modifier 的写法开局不会跑；
  ② 继承来的 law 完全不校验条件；③ `.info` 把 `allow_same_successor` 缩进到 `ai_approval` 下（实际在 `succession` 块里），
  `manual_law_change` / `voting_session` 标 bool 却写成 `{ … }` —— 以 vanilla 实例为准（L359-380、L407-416）。

## [ingame] 真机验收（启动参数 / 存档 / 1.21 UI）

`game/_commandline_options.info`（170 行）是启动参数的唯一文档；UI 事实来自 2026-11-18 的 1.21 实机观察。

- **`-develop` 不存在**：`_commandline_options.info` 全文无此项，`ck3.exe` 字节扫描里 `-develop` 0 命中。
  热载只有两条路：`-debug_mode` 下控制台 `reload`（loc `core_l_english.yml:39`），或引擎串里提到的
  `-filewatcher`（未文档化、未实测）。
- **文档化的开局参数**（L9-22）：`-skip` 跳过启动画面、`-play=<title_key>` 指定统治者、`-bookmark=<bm>`、
  `-loadsave=<name>`、`-continuelastsave`；配 `-debug_mode`（L47）+ `-suppress_error_log`（L59）就是验收启动线。
  本机示例：1066 威尼斯 `Internal Key: k_venice`（debug.log 实证）。
- **会写用户数据的会话**：`pdx_settings.txt` 里 `autosave="YEARLY"`（L16-19）、`debug_saves=3`（L20-23）、
  `save_on_exit enabled=yes`（L64-67）、`cloud_save enabled=no`（L72-75）。一次 GUI 会话实测改了
  `autosave*.ck3`、`last_save.ck3`、`continue_game.json`（14:44:12 三者同秒）——必须先快照。
- **退出菜单是陷阱**：游戏内「退出游戏」会写 `autosave_exit.ck3`（`00_defines.txt:1448` 的 `EXIT_SAVE_NAME`）
  与 `last_save.ck3`；收场必须杀进程。
- **版本/校验码在 UI 里**：主菜单右下与暂停菜单左下显示 `Florin（1.21.0），校验码: <hex>（有修改）`；
  装载 mod 后校验码变化，可用来确认挂载（`-skip_checksum` 会跳过计算，验收别加）。
- **右键互动菜单（1.21 实测）**：右键角色 → 分类菜单（外交 / 私人 / 敌对 / …）；`common_interaction = no` 的
  curse 四项**直接展开在「敌对」下**（1.20 记录是收进「更多…」），同分类另有「其他 N 项……」折叠 →
  入口判定按实际位置记录，不按旧文档。
- **互动选项窗**：勾选式复选框 + 底部确认；单项悬停给效果 tooltip（实测：肺炎 = 健康 −1、生育 −20%、恐惧 −10）。
- **游戏规则面板**：主菜单右下「游戏规则」→ 右侧「游戏规则过滤器」；mod 规则按 `categories` 归类
  （auto 的 `ai` → 过滤器选 AI 就能翻到），规则名/描述/取值全部走 loc。
- **debug_mode 地图 hover**：左上显示 `ID / 名称 / 最低人口 / X,Y`（实测 `ID: 12763 sea_indian_ocean`），
  报 bug 时用它定位省份。

## [automation] 真机自动化（agent 代点，2026-11-18 实跑 free v4.1）

用户**当次明确要求**才做（预设里 `input_*` 被屏蔽，只能用 pwsh 注入）。结论先给：**鼠标能打通，键盘不行**。

- **全屏 + Raw Input 会吞掉注入输入**：`SendInput` / `mouse_event` 在 CK3 全屏下完全不生效
  （实测：悬浮金币图标无 tooltip、空格不暂停、点「前进!」无效）。
  把 `pdx_settings.txt` 的 `Graphics.display_mode` 改成 `windowed` 后，**鼠标点击立刻可用**（同一份脚本、同一段坐标）。
- **键盘打不通**：每次 `pwsh -File xxx.ps1` 都会把本机控制台窗口带到前台，按键进了控制台；
  即使同一进程内先 `SetForegroundWindow(ck3)`，`~`（控制台）与 ESC 仍无反应。→ 别把验收项设计成「只能靠键盘」。
- **DPI 必须先声明**：未 `SetProcessDPIAware()` 时，125% 缩放下 `Screen.Bounds` 报 1536×864（物理是 1920×1080），
  截图与 `SetCursorPos` 都被打折，坐标全错位。声明后截图 1920×1080、坐标 1:1。
- **坐标换算**：`read_image` 预览往往被缩放到 1708 宽（factor 1920/1708≈1.124）；从预览量到的坐标要乘回去再点。
- **hover 是最便宜的校验**：Paradox 的按钮/资源图标悬停会出 tooltip，用它确认「光标真的落在 UI 上」。
- **面板从哪来**：写一个**临时探针 mod**（`Documents\...\mod\zz_xxx`，测完删）在 `on_game_start` 里
  `trigger_event = <mod 的入口事件>`，就能不点菜单直接截图到面板；要目标流程就先
  `every_courtier = { limit = { is_adult = yes } save_scope_as = <target_scope> }` 再触发。
- **追加 on_action 只能写列表**（这是本次踩的实坑）：`on_game_start = { effect = { … } }` 会**整块覆盖**原版，
  实测开局局势 intro 直接变成 `ERROR:[ghibelline_leader…]` 占位；正确写法
  `on_game_start = { on_actions = { zz_my_action } }` + `zz_my_action = { effect = { … } }`。
  想确认没覆盖：`has_global_variable = is_game_start_date`（原版 `game_start.txt:13` 会设）。
- **`debug_log` 不解析数据函数**：`debug_log = "gold=[gold|0]"` 会打印成
  `TOOLTIP:GAME_CONCEPT,gold 金钱!`；`[This.GetName]` 还会报 `pdx_data_localize.cpp` 的 data error。
  要数值证据只能**截图**（顶部资源条）或**事件 desc**（loc 里数据函数正常）。
- **`-play=<title>` 不保证锁定该头衔**：同参数两次启动，统治者与初始数值都不同（实测 k_france）。
  验收以画面实际统治者为基线，别拿上一次的数字当对照。
- **加第二个 mod 要重建现场**：`工具-真机现场.mjs --begin --mods free_resources,zz_probe`
  （`dlc_load.json` 只经工具改）；`ck3mod_headless` 则要求本机副本存在 —— 清场后先 `ck3mod_deploy`。
- **能自动 / 不能自动**（free 实测）：可 —— 事件面板四入口、一键全给/全扣、单项连点、右键菜单项、
  目标流程面板、政体门控列表、`error.log` 计数；不可 —— 决议列表这类「要靠图标定位」的入口（本次 F1 SKIP）、
  任何需要键盘的操作、tooltip 的完整文案（只能看截图里的可见部分）。
- **证据入库**：1920×1080 PNG 每张 3–4 MB，统一转 JPEG q82（43.8 MB → 3.1 MB）再进 `验证记录\`，
  每张在 README 里对应「项号 + 结论」。

## [release] 发布与工坊核对（2026-11-18 free v4.0 → v4.1）

- **版本真源只能有一处**：free 的两个 descriptor 现在由 `数据-资源表.mjs` 的 `genInnerDescriptor()` /
  `genOuterMod()` 生成（内层无 `path`、外层带 `path`），`工具-生成.mjs --check` 把两个都纳入 golden check。
  快照目录名也从表里导出（`buildDir` / `buildInnerDir` / `buildOuterMod`）——之前硬编码在
  生成器 / 部署 / 静态校验 / `ck3-modding-tools/configs.mjs` 四处，搬版本必漏。
- **校验器自己也会过期**：断言别写死版本（`supported_version="1.20.*"`、`version="4.0"`），一律从
  `数据-资源表.mjs` 的 `META` 取；部署副本的容差也由 `META.supportedVersion` 推（`1.21.*` → 允许
  `1.21.*` / `1.21.x`）。free v4.1 之前这两处写死旧值，改完版本后是**校验器**先报红。
- **"要不要全面更新"的机器判据**：静态校验 H 段（引擎 token 对照 `common/`+`events/`）+
  H2 段（解析 `common/governments/_governments.info` 的 `build_queue_reserve_categories`，
  与 `CURRENCIES` 一一比对）。1.21 实测：原版 9 种角色货币（gold/prestige/piety/renown/influence/
  herd/treasury/merit/barter_goods）与 free 表内九种**完全对应** → 只需兼容发布。
- **启动器会回写两个 descriptor**：点上传时把 `supported_version` 从 `1.21.*` 写成实测的 `1.21.0`，
  并**吃掉行尾 1 字节** → 工坊 `file_size` 96,075 → **96,074**（free v4.1 实测）。
  因此静态校验对这两个文件按字段比（允许 `1.21.*` / `1.21.x`），其余文件严格逐字节。
  **别在校验器里留一遍"全部文件逐字节"的循环**——v4.0 时本机副本被删所以从未触发，上传后立刻误报。
- **上传前先 deploy**：启动器「Mod 库」只认 `Documents\...\mod\*.mod`；清场（删本机副本）后它会显示
  「尚未安装任何 Mod」，没有可上传物。deploy → 刷新/重开启动器 → 上传。
- **工坊条目详情只能走 POST API**：`ISteamRemoteStorage/GetPublishedFileDetails` 用 GET 返回 **405**；
  `web_fetch` 打不开 steamcommunity。PowerShell：
  `Invoke-RestMethod -Method Post -Uri https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/ -Body @{itemcount=1;'publishedfileids[0]'='<id>'}`
  → `file_size` / `time_created` / `time_updated` / `description` / `tags`。
  `steam_workshop_search` 也能拿到「订阅 / 更新日期 / MiB」但精度只到 0.1 MiB。
- **自己上传的条目不会出现在** `steamapps/workshop/content/1158310/<id>`（Steam 不下载自己的作品）→
  核对只信 API，别去工坊副本目录找文件比哈希。
- **核对四件套**（free v4.1 全过）：`time_created` 未变（没新建条目）· `file_size` 等于本地内层 −1 字节 ·
  `time_updated` 是刚上传的时间 · `description` 含新版本号与新游戏版本（旧版本号只应留在 changelog 历史行里）。
  本次结果：条目 3775021095、`time_created` 2026-08-01、`file_size` 96,074、`time_updated` 2026-11-18 16:23:27、
  描述 4459 字符、订阅 119 → 169。