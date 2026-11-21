# CK3 1.21.0.3 实测要点（按域）

> 这些是**我们自己在原版 `.info` 与 `common/` 上核过**的结论，不是 Wiki 摘抄；每条都带可指认的行号或实例。
> 游戏版本：**1.21.0.3 "Florin"**（1.21.0 于 2026-11-17 发布；本机 11-18 首次安装，11-19 收到两次热修：
> `1.21 hotfix` → buildid `26757580`、**`1.21.0.3` → buildid `26785313`**）；核对日期：2026-11-20。
> 用法：只在要动某个域时读对应一节（`[slug]`），不要整篇读。
> 维护：写进来的必须能指认（`.info` 行号 / vanilla 实例）；大版本更新后逐条复核，**失效的删掉**，不要留在里面。
> 收录：`[hotfix]` `[title]` `[interaction]` `[cb]` `[government]` `[resources]` `[council]` `[story]` `[struggle]` `[district]` `[trade]` `[road]` `[laws]` `[scheme]` `[ingame]` `[automation]` `[release]` `[verify]`
> 分工：本文件只放**实测事实**；怎么点、怎么跑在 `ingame-acceptance.md`；规则与红线在 `SKILL.md` 的 Hard rules。

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
| 1.21 hotfix + `1.21.0.3`（Wiki `Patch 1.21.X`） | 两节都在：`1.21 hotfix`（2026-11-18）+ **`1.21.0.3`（2026-11-19）**；版本串仍不变（exe 仍嵌 `1.21.0` / `Florin`） | `appmanifest_1158310.acf` buildid `26757580` → **`26785313`**、`LastUpdated` 2026-11-19 23:12（本地）；`binaries\ck3.exe` mtime 11-19 23:12 |

---

## [hotfix] 热修与版本口径（1.21 hotfix 2026-11-18 / 1.21.0.3 2026-11-19）

**R1 · 版本串不是热修信号。** 2026-11-19 13:28 本机被 Steam 静默替换 81 个文件，而三处「版本」全都没变：
`titus_branch.txt` 仍 `release/1.21.0`、`launcher-settings.json` 仍 `1.21.0 (Florin)`（mtime 停在 11-18 13:22，
它由启动器写、下次启动才回写）、`binaries\ck3.exe` 里也只有 `1.21.0`/`Florin` 两个串。真正的信号是
`steamapps\appmanifest_1158310.acf`：`buildid` `26622941 → 26757580`、`LastUpdated` = 2026-11-19 13:28:37，
配合 `binaries\ck3.exe` 的 mtime（13:28:30）。`ck3mod_status` 的「游戏构建」行现在直接打印
buildid + Steam 安装时间 + exe mtime，并在 launcher-settings 落后时提示「版本串可能滞后」。

**R1b · 当晚又更了一次：`1.21.0.3`。** 2026-11-19 23:12（本地）buildid `26757580 → 26785313`，
`LastUpdated` = `1795101145`、`binaries\ck3.exe` mtime 23:12——版本串**还是没动**。Wiki 的 `Patch 1.21.X` 页
2026-11-20 补了 `1.21.0.3` 节（revid 38988）：起始领地宽限恢复、村庄/城墙/庄园/军事区划主建筑补征召兵、
行政/天朝/贤能征召兵惩罚 50%→25%、**建衔与篡位金币成本下调**、修「不可见的 Guelphs & Ghibellines 开局暂停」、
修「领主无国库却靠剥夺共和国男爵领暴富」。**仍无 Modding 段**。热修后 `cli.mjs check --all` **5/5 PASS**
（dejure 28 / free 84 / auto 94 / mastery 34 / organizer 20）——这才是「与在营 5 个的脚本面不相交」的证据。

**R2 · 版本号以 Wiki 为准：`1.21.0.3` 有编号了。** 11-18 那版页面只写「1.21 hotfix」，所以当时记
「1.21 hotfix（2026-11-18）+ buildid」；11-20 页面补了 **`1.21.0.3`**（2026-11-19 发布），本机 buildid
`26785313` 对应的就是它。**别编 `1.21.1`**，也**别再说「页面没有版本号」**——编号有了，但版本串仍然不变：
判据永远是 buildid + mtime，不是 `titus_branch.txt` / exe / `supported_version`。

**R3 · 影响面按文件清单取证，不能只信「平衡补丁」四个字。** 第一次热修改动 81 个文件：
`game/common` 31（含 **2 个原版 CB 文件** `casus_belli_types/00_event_war.txt`、`01_fp1_wars.txt`，
以及 `governments/00_government_types.txt`、`on_action/game_start.txt`、`traditions/*`、`lifestyle_perks/*`、
`modifiers/*`、`scripted_effects/*`、`situation/*`、`trade/county_potential_trade_goods/*`）、`localization` 27、
`history` 11（`characters/*` 起始军队 + `provinces/k_huainan.txt` Yangzhou 改产丝绸）、`events` 3、`gui` 3。
**de-jure 依赖的 `scripted_effects/00_war_effects.txt` 没动**（mtime 仍 11-18），wrapper 契约不变。
无头冒烟本轮 **SKIP**：只更新知识层与工具层、没部署任何 mod，跑无头会改播放集与存档。

**用法**：以后每次「CK3 更新了」先看 buildid / mtime（`ck3mod_status`），再跑 `check --all`，最后才决定
要不要读 `Patch 1.x.X`；热修页没有 Modding 段时，不要为「兼容」改任何脚本。

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
- **战争结束块在 1.21 被抽成了 wrapper，抄 1.20 的 CB 正文会静默少结算**（Patch 1.21 §Modding 只说
  "Cleaned up casus belli … effects to make them easier to patch"，不说这是行为变化）。
  三个入口在 `common/scripted_effects/00_war_effects.txt`：
  `on_victory_aggressive_war_effect`(L3170) / `on_white_peace_effect`(L3178) / `on_defeat_aggressive_war_effect`(L3243)；
  底座是 `general_on_war_end_effect`(L3143，POW 消息 + EP3 佣兵结算)、`on_victory_effect`(L3150)、`on_defeat_effect`(L3222)。
  相对 1.20 内联版**多出来**的东西（决定性证据在 wrapper 的底座里）：
  - `add_influence_attacker_victory/defeat_effect`：`on_victory_effect`（L3150）的 **L3155** 就是
    `add_influence_attacker_victory_effect = yes`（L3154 是 `# Influence`）；defeat 侧在 `on_defeat_effect`（L3222）
    的 **L3228** 是 `add_influence_attacker_defeat_effect = yes`。这两个调用只对
    `government_has_flag = government_has_influence` 的行政政体生效（实现见 `07_dlc_ep3_scripted_effects.txt:4221-4237`）——
    1.20 的内联写法直接调叶子效果就绕过了它们，而日志与静态校验都不会报。
  - 防御方 `ep3_war_loss_adventurer_tt_effect`（同文件 L10746，自包含，只用 `target_titles` + `scope:war_loser`）。
  - 白和的双方压力结算。
  另有 `scope:special_truce` / `scope:no_penalty_for_defeat` 两个闸门
  （只由 religious_war / tributarize / ep3_wars / mpo_wars / tgp_china_wars 设置，普通 mod CB 恒放行）。
  → **用 wrapper 就必须删掉被它覆盖的内联调用**，否则 POW/停战/石碑/声望各来两遍（数值翻倍，真机上很隐蔽）。
- 原版 `individual_duchy_de_jure_cb`（`00_dejure_war.txt:546`）现在三个块各只有一行 wrapper
  （victory L668 / white peace L724 / defeat L774），是「1.21 正确形态」的参照物。
- **wrapper 化会让「按 `= yes` 抽取」的存在性校验悄悄退化**：de-jure 改用 wrapper 后，H 段覆盖的原版对象
  从 12 个掉到 5 个（其余调用躲进 wrapper，或写成 `scope:x = { … }` 单行）。补一份 **`DIRECT_CALLS`**
  按名直调清单（de-jure 是 7 项：`modify_all_participants_fame_values` /
  `modify_allies_of_participants_fame_values` / `pay_short_term_gold_reparations_effect` /
  `accolade_attacker|defender_war_end_glory_gain_med_effect` / `accolade_defender_war_end_glory_gain_low_effect` /
  `scale_10_war_defender_win`），逐条核 `^<name>\s*=` 存在，并把清单长度打进结论行——
  「校验器覆盖面变小」本身就是要修的 bug。
- 工作范例：`ck3-de-jure-conquest` 的 `zz_cn_dejure_conquest.txt`（v2.3 起按 wrapper 写法；
  `工具-静态校验.mjs` 的 L 段有「wrapper 在场 + 内联残留为零」断言，N 段有 v2.2↔v2.3 差异断言）。

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

## [title] 头衔 / 法理 / 封臣树（title & de jure）

2026-11-20 法理整顿（organizer v1.0）核过的域。**Wiki 只给语义与名字，语法一律回层 2**：

- **三层分工**：`Titles § De Jure` 给阈值语义（公国/王国要 >50% 法理县、帝国 >80%，且至少 2 个低一级或
  1 个同级头衔；法理漂移约 100 年 / 1200 点进度）；**可执行入口是 `every_alert_creatable_title`**
  （角色作用域，「遍历该角色可创建的头衔」，原版用法 `00_test_interactions.txt:781`、`01_suggestions.txt:806`）——
  阈值已经编在引擎里，**别自己重写 50%/80%**。
- **`title_capital_county` 是 landed title scope**（`Scopes list`），不是角色字段。「把某个头衔给它首都县的
  持有人」= `title_capital_county.holder`（原版 `00_grant_titles_interaction.txt:2016` 就是这个写法；
  `00_culture_interactions.txt:237`、`00_alliance.txt:1762` 同型）。**不是**「首府公国的持有人」。
- **批量易手的原版配方**（`Mod troubleshooting §9` 的 run 脚本范例）：`create_title_and_vassal_change =
  { type = conquest save_scope_as = change }` → `every_in_de_jure_hierarchy = { change_title_holder =
  { holder = root change = scope:change } }` → `resolve_title_and_vassal_change = scope:change`。
  成对数量、`type` 取值与 `$CHANGE$` 收口点是各 mod 自己的契约（organizer 的 H1/H2 断言 12 对）。
- **`is_de_jure_liege_or_above_target`**（`Triggers list`，title → title）判「法理上位」；organizer 的链条保护
  = `this = root.capital_county` OR 该触发（L1）。
- **领域判定**：`is_vassal_or_below_of`（`Triggers list`「vassal or below」；Patch 1.3 起不把非统治者算封臣；
  原版 `00_civil_war.txt:1009/1234`、`00_claim.txt:251/285`、`00_event_templates.txt:307`）——任意深度封臣树，
  独立统治者与**封臣统治者**都能用。`is_vassal_of` 只判直属；`top_liege = root` **只对独立统治者成立**。
- **`create_character` 的性别**：模板可能不带（`_scripted_character_templates.info:47-53` 原文
  「no gender data … create_character logs an error」）；`gender` / `opposite_gender` /
  `gender_female_chance = 50` 三选一，否则 `PostValidate … returned false`。新伯爵九项结构见 organizer H8。
- **任命制头衔**（中国/日本 `appointment_with_level_requirement`）：受让人必须过
  `has_appointment_level_for_title`（角色 → 头衔），并在头衔/领域两侧查
  `has_title_law_flag = appointment_with_level_requirement` / `has_realm_law_flag`
  （`title_on_actions.txt:2486/2491/2493/2514`、`06_ep3_interactions.txt:176/885/1861/3634`）。
  **Wiki 对该触发器 0 命中 → 只能层 2**。不满足就把头衔留在原持有人手里，别硬塞。
- **`change_government` 只吃字面 key**（安装目录 0 处 scope 用法：`00_religious_war.txt:2698/2798/2856/3006`）。
  想「让新持有人沿用旧政体」只能枚举字面量，`change_government = scope:x` 不生效。
- **触发器有作用域类型**：`is_mercenary_company` / `is_holy_order` 是 **landed title** 触发器，写在角色作用域
  会报 `Inconsistent trigger scopes (character vs. landed_title)` → 放进 `primary_title = { }`。
- **同级/更高头衔分不出去**：`resolve_title_and_vassal_change` 对「同级或更高」直接拒绝（`same or higher tier`）
  ——国王的第二个王国、皇帝的第二帝国只能留在玩家名下。**这类引擎不变量必须写进 UI 与文档**，否则被当 bug。
- **「只留首都伯爵领」的字面口径**：只留 `root.capital_county` 一个县，**不是**「首都公国里的所有县」；
  两种解释差很多，需求要先钉死（organizer 取前者）。
- **建衔成本随补丁变**：`1.21.0.3`（2026-11-19）下调了「创建/篡位头衔」金币成本——定价/平衡时先看
  `Patch 1.21.X`，别抄 1.21.0 的旧数。
- **本域会触发的原版噪声**（不指向本 mod 脚本）：商业共和国建政链、商人家族头衔、日本 `previous_holder`——
  判读方法见 `[ingame]`。

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

## [scheme] 计谋（scheme）

规格在 `common/schemes/scheme_types/_schemes.info`（211 行）；Wiki 只有玩家向的 `Schemes`，**没有 modding 页**。
成功率/成长这族修正键**不在 `.info` 里**，在 `modifier_definition_formats/00_definitions.txt`。

- **类别是枚举，没有「全部计谋」键**：`category` = `personal` / `contract` / `hostile` / `political` / `trade`，
  **不写默认 `personal`**（`_schemes.info:15-17`）。注意 L17 的枚举只列了前四个、**漏了 `trade`**——
  实测 `gdp_trade_schemes.txt` 有三个 `category = trade`。→ 类别集合一律从 `scheme_types/*.txt` 扫，
  别照 `.info` 抄。
- **五类各一套键**（`00_definitions.txt`）：`owned_<cat>_scheme_success_chance_add` L2189/2195/2201/2207/2213、
  `owned_<cat>_scheme_success_chance_growth_add` L2256/2263/2270/2277/2283、
  `owned_<cat>_scheme_success_chance_max_add` L2329/2335/2341/2347/2353、
  `<cat>_scheme_phase_duration_add` L1971/1998/2007/2016/2025、`max_<cat>_schemes_add` L2168/2172/2176/2180/2184；
  跨类别的只有 `owned_scheme_secrecy_add`（L2396）。→ 要「支持所有计谋」就按类别写满 + 反查断言（硬规则 32）。
- **安装目录实况**（1.21.0 + 2026-11-19 hotfix，扫 65 个 `scheme_types/*.txt`）：**136 个类型 / 5 类** ——
  contract 53 · hostile 18 · personal 34（**其中 8 个省略 `category`**，按默认归 personal）· political 28 · trade 3。
- **显示的成功率上限是「潜力」，不是 define 的 95**：`_schemes.info:69` 是
  `base_maximum_success = 100 # Default 100`，实际的「最大 X%」由同谋槽位/技能决定；define 只是绝对硬顶：
  `00_defines.txt:767-771` 的 `HOSTILE/PERSONAL/POLITICAL/TRADE_SCHEME_MAX_SUCCESS_CHANCE = 95`、
  **`CONTRACT = 100`**。实测同一场谋杀（mastery v1.0）：同谋 0/5 挂「一手遮天」（起步 +300%）→
  **54.0%（最大 54%）**；点「收敛锋芒」撤档 → **34.0%（最大 34%）**（差 20 = 该档 `max_add`）；
  同谋 4/5 挂档 → **95.0%（最大 95%）**；同谋 4/5 不挂档 → 77%。
  → 判读必须带「当时同谋填了几个」，否则「没到 95」会被误当成 mod 没生效。
- **`SCHEMES_PER_TYPE = 1`**（`00_defines.txt:760`）：同一种计谋同时只能有一个 → 验「并发栏位 +1」必须用
  **不同类型**的样本（谋杀 + 绑架，同属 hostile）：不挂档 1 张卡、挂档 2 张卡（mastery G7）。
- 其余可用字段（同一份 `.info`）：`target_type`（character/title/culture/faith/nothing，**必填**，L19）、
  `illustration`（必填，L23）、`base_success_chance` L67、`minimum_success` L70、`maximum_secrecy` L71、
  `success_chance_growth_per_skill_point` L134、`is_basic` L37；脚本里读成功率/保密用 `scheme_success_chance` /
  `scheme_secrecy`（L9）。
- 工作范例：`ck3-scheme-mastery`（3 档角色修正 × 5 类 × 4 键 + 保密 + 顶档栏位；静态校验 **L0** 就是类别覆盖率
  反查，`--root` 可验任意目录；反向 13 例）。

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
  **UI 只读 exe 里的串**，吃了 `1.21.0.3` 热修也照样显示 `1.21.0`——别拿它判版本。装载 mod 后校验码变化，
  可用来确认挂载（`-skip_checksum` 会跳过计算，验收别加）。
- **右键互动菜单（1.21 实测，证据来自已下架的降祸 mod）**：右键角色 → 分类菜单（外交 / 私人 / 敌对 / …）；
  `common_interaction = no` 的互动**直接展开在「敌对」下**（1.20 记录是收进「更多…」），同分类另有
  「其他 N 项……」折叠 → 入口判定按实际位置记录，不按旧文档。该 mod 已于 2026-11-19 删除，这条只当
  1.21 菜单结构的历史证据；在营 5 个里没有「敌对」分类互动，判入口时按当次菜单实测。
- **互动选项窗**：勾选式复选框 + 底部确认；单项悬停给效果 tooltip（实测：肺炎 = 健康 −1、生育 −20%、恐惧 −10）。
- **游戏规则面板**：主菜单右下「游戏规则」→ 右侧「游戏规则过滤器」；mod 规则按 `categories` 归类
  （auto 的 `ai` → 过滤器选 AI 就能翻到），规则名/描述/取值全部走 loc。
- **debug_mode 地图 hover**：左上显示 `ID / 名称 / 最低人口 / X,Y`（实测 `ID: 12763 sea_indian_ocean`），
  报 bug 时用它定位省份。
- **`-skip` 直接落到新游戏选人界面**（不是主菜单）：A1 的「游戏规则」按钮就在选人界面右下（2026-11-18 实测）。
- **1.21 原版报错噪声基线**（判 A5 / 加载基线时先扣掉）：一次 1h40m、只启用本 mod 的会话，
  `error.log` **8,094 条 [E]**，本 mod **0 条**、**没有任何 `Script location` 指向本 mod**。前几名全是原版/DLC：
  `common/important_actions/00_realm_actions.txt:1227` **3,528**（`Failed to fetch variable for 'amount_owed'`，
  `action_demand_repayment`）、`common/scripted_triggers/00_crime_triggers.txt` **1,032**（同类脚本取值问题）、
  科举活动（`az_examination_events` / `imperial_examination_actions`）**298 + 186 + 109**、
  `00_laamp_triggers.txt` **184**、原版 story cycle 的 `cannot change faith` **3**、
  原版 DLC 的 `Wrong scope for effect` **6**。
  → **看到 8k 条 [E] 不等于 mod 坏了**：先按 `Script location` 分组，再看有没有指向自己的文件。
- **日志归属看「块的链首」**（2026-11-20 organizer 实测）：每个 `Script system error` 块里有若干
  `Script location` 行，**第一行才是归属**——以本 mod 文件名开头才算我们的错；末端指向本 mod 决议
  （调用链落在我们的 effect 上）**不等于**本 mod 报错。用户会话实测：242 个块 → 36 个末端含
  `cn_dejure_organizer` 决议 → **0 个起于本 mod 脚本**。
- **本域会触发的原版噪声三清单**（判 A5 时当「已知原版侧」扣掉，但 README/工坊文案要如实写明）：
  ① **商业共和国建政链**：`on_vassal_change → gdp_found_a_republic_effect` /
  `gdp_merchant_becomes_patrician_effect` 对「无首都的家族头衔持有人」建政，并拒绝「同级或更高」的转封
  （`same or higher tier`）——**功能影响**：商业共和国里 P5（转封）部分被原版拒绝，P1–P4 照常（23 条）；
  ② `create_dynamic_title … house already has house title`（商人家族头衔重复建，7 条）；
  ③ 日本 `on_title_gain` 读新建头衔的 `scope:previous_holder`（没加 `?=`）报 `Failed context switch`
  （原版自身创建头衔同样触发，6 条）。
- **验收场景要先能观测到改动（de-jure v2.3 实测）**：v2.3 的头号改动是行政政体胜利结算 Influence，
  而第一轮用户新开的是**流求部落局**（公国级、部落政体）——那一项在整局里根本不会出现，等于没测；
  第二轮改拜占庭行政政体才闭合。准备阶段先写清「本次改动需要什么政体/等级/阶段才可见」，不满足就换局。
- **取证有边界，别把「间接证据」写成「机器证明」**：存档能证明「这个 CB 被用过」（`war_name` 缓存）
  与「有过 365 天胜利 flag」，但**证不了**「本次胜利的那一刻影响力涨了」——flag 有寿命（第二局存档到 1184 年，
  早已过期），而影响力是连续数值、可变因素太多。这类只能记「用户实机确认」，机器侧只兜「0 报错 + 无残留」。
- **上传动作会改播放集**：de-jure v2.3 上传后 `dlc_load.json` 从 1 项（`mod/auto_spread.mod`，
  SHA256 `DEDF70…`）变成 **0 项**（`A9E53E…`）。这是启动器在上传/编辑播放集时的正常行为，
  不是 mod 或测试造成的；收尾只记录 SHA 变化与原因，不擅自还原（播放集归启动器/用户）。
- **`--end` 还原的是字节，不是 mtime**：真机现场收尾核对用 SHA256（工具已内置），
  用户目录里 `autosave_exit.ck3` 的修改时间会变成收尾那一刻，别拿 mtime 判「存档被改了」。

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
- **点击纪律（决定代点成败）**：坐标从**全尺寸截图**量（预览常被缩到 1708 宽，系数 1.1241）；事件面板每行
  client 高约 36 px，估偏 20 px 就会落到相邻行、**把刚开的开关又关掉**；选项点击会 `trigger_event` 回自身
  并重绘事件，两次点击间隔 **≥1.2–1.5 s**，否则丢点击。每次点击后重截确认，不连点。
- **选角色**：先 hover 出 tooltip 再单点；点海面 / 不可通行地形会**清空**已选角色；点男爵领会打开
  角色档案而不是头衔窗口。
- **原版事件会自动暂停游戏**（本次是拜占庭国库）→「跑一年」这类必须连续跑时间的项**不可无人值守**，
  一开始就划给人；先问「这一项有没有必须连续跑时间的成分」再做分工。
- **面板从哪来**：写一个**临时探针 mod**（`Documents\...\mod\zz_xxx`，测完删），**两个开局钩子都挂**
  （`on_game_start` + `on_game_start_after_lobby` → 同一个 `zz_probe_game_start`，用全局变量去重），再
  `trigger_event = <mod 的入口事件>`，就能不点菜单直接截图到面板。**只挂 `on_game_start` 会不出现**：
  单人新开局很可能走 `on_game_start_after_lobby`（`game_start.txt:2806`），日志却无报错
  （2026-11-18 实测：同版本、同一套选人流程，唯一变量就是钩子）。要目标流程就先
  `every_courtier = { limit = { is_adult = yes } save_scope_as = <target_scope> }` 再触发。
- **探针要先「落到角色」**：`on_game_start` 的 root 是 `none`，在 root 上判角色条件会报
  `Wrong scope for trigger: none`。正确做法：用 **`random_independent_ruler`**（可按政体加 limit，每类抽 1 个）
  或 **`random_ruler`**（抽封臣）选人 → `trigger_event = zz_probe.0001`（隐藏事件，root = 该角色）→ 事件里调效果。
  `every_ruler` + 全局变量去重**不生效**：实测在整张地图跑了成百上千次（debug.log 成对刷屏）。
  `random_independent_ruler` 的原版用法见 `00_debug_interactions.txt:1180`；organizer 用这套跑了
  **7 类政体 + 1 个封臣统治者 = 8/8**。
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
  目标流程面板、政体门控列表、`error.log` 计数；不可 —— 任何需要键盘的操作、tooltip 的完整文案
  （只能看截图里的可见部分）。**决议列表能自动了（2026-11-19 更正）**：右侧 HUD 图标列逐个 hover 读 tooltip
  可定位「**F9 决议**」，再滚到「决议（N）」组（mastery G2 实测）；同列还有 F4 内阁 / F5 贸易 / F6 廷臣 / F7 谋略。
- **探针一次只回答一个问题**：mastery G7 个人侧把 `sway` + `befriend` 两次 `start_scheme` 塞进同一条 on_action，
  两次都只有 1 张卡（`sway` 没起来），既证不了基线也证不了 +1 —— 多步实验拆成多次启动，或让每一步都有
  独立可观测的产物。一条 effect 链里连着两次 `start_scheme` 时，**第一个失败会被第二个掩盖**。
- **事件面板行位会漂 / debug 顶栏有雷**：选项数变化、tooltip 出现都会整体重排，2026-11-19 实测因此把
  「收敛锋芒」当「先这样」点到、把刚生效的档位撤了；每次点击前重新 hover 读 tooltip 核对**选项名**，
  点击后截图核对状态。debug 面板顶栏的「切换数据系统」「事件 scope 查看器」会把文案变成
  `[success_chance|E]` 这类原始串——取证前先确认文案正常，别把调试态当成品证据。细则见 runbook §9.6。
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
- **启动器会回写两个 descriptor**：点上传时把 `supported_version` 从 `1.21.*` 写成实测的 `1.21.0`；
  快照**带行尾换行**时还会吃掉行尾 1 字节 → 工坊 `file_size` 96,075 → **96,074**（free v4.1 实测）。
  **形状对了就不再 −1**（见本节末），别把「少 1 字节」当固定行为。
  因此静态校验对这两个文件按字段比（允许 `1.21.*` / `1.21.x`），其余文件严格逐字节。
  **别在校验器里留一遍"全部文件逐字节"的循环**——v4.0 时本机副本被删所以从未触发，上传后立刻误报。
- **上传前先 deploy**：启动器「Mod 库」只认 `Documents\...\mod\*.mod`；清场（删本机副本）后它会显示
  「尚未安装任何 Mod」，没有可上传物。deploy → 刷新/重开启动器 → 上传。
- **工坊条目详情只能走 POST API**：`ISteamRemoteStorage/GetPublishedFileDetails` 用 GET 返回 **405**；
  `web_fetch` 打不开 steamcommunity。PowerShell：
  `Invoke-RestMethod -Method Post -Uri https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/ -Body @{itemcount=1;'publishedfileids[0]'='<id>'}`
  → `file_size` / `time_created` / `time_updated` / `description` / `tags`。
  `steam_workshop_search` 也能拿到「订阅 / 更新日期 / MiB」但精度只到 0.1 MiB。
  **断网时两个域名会一起失败**（de-jure v2.3 收尾实测：`api.steampowered.com` 10 s 超时、
  `steamcommunity.com` fetch failed）→ 三信号降级为「descriptor 回写」1 个，页面体积/日期与条目 ID 复核
  必须记 **SKIP + 原因**，不许写成「已核对」。
- **自己上传的条目不会出现在** `steamapps/workshop/content/1158310/<id>`（Steam 不下载自己的作品）→
  核对只信 API，别去工坊副本目录找文件比哈希。
- **核对四件套**（free v4.1 全过）：`time_created` 未变（没新建条目）· `file_size` 等于本地内层 −1 字节 ·
  `time_updated` 是刚上传的时间 · `description` 含新版本号与新游戏版本（旧版本号只应留在 changelog 历史行里）。
  本次结果：条目 3775021095、`time_created` 2026-08-01、`file_size` 96,074、`time_updated` 2026-11-18 16:23:27、
  描述 4459 字符、订阅 119 → 169。
- **快照是发布物：字节形状要跟启动器一致**。点上传后两份 descriptor 的末字节是 `"`（0x22）、**没有行尾换行**
  ——那是启动器「回写 `supported_version` + 吃掉行尾 1 字节」之后的形状。生成器若按常规模板带 `\n` 就会多 1 字节
  （auto v2.1 首版生成出 156 / 243 B，L 段立刻报红）。正确做法：生成器不留行尾换行，快照做到「与上一版
  逐字节只差 version / supported_version 两处值」，并用静态校验 **L 段**（`v_prev` ↔ `v_new` 差异断言）守住。
- **形状对了就不再 −1**：de-jure v2.3 按上一条生成（外层 257 / 内层 163 B、末字节 `"`），上传后长度**完全不变**，
  只有 `supported_version` 从 `1.21.*` 被写成 `1.21.0`。所以「−1 字节」只发生在**快照带行尾换行**时；
  把 −1 当常态，会把正常情况误判成异常（本轮实测 SHA256：外层 `A2DDBFAF…83761B`、内层 `5E5D7362…7DBCC6`）。
- **部署脚本对外层 `.mod` 有「语义等价就跳过写盘」的兜底**：生成器改了字节形状后，`工具-部署.mjs` 认为字段相同
  就不重写旧文件（输出「写入 1 / 已是最新 8」），本机副本仍留着旧字节。要逐字节一致：先 `--clean` 再 deploy
  （或删掉目标文件再部署）。这条与上一条配合——形状改了就必须重建本机副本，否则 `--check` 会报不一致。
- **手写 mod 只有 descriptor 会漂**：`version` / `supported_version` 在内外两份各写一遍。给没有内容生成器的 mod
  补一个只生成 descriptor 的 `工具-生成.mjs` + `数据-元数据.mjs`（约 60 行；auto v2.1 即此型），
  内容文件仍手写；改版本只改 `META` 一处。
- **内层 descriptor 也会被一起回写**：启动器读的是 `Documents\...\mod\<mod>.mod`，但会顺手重写内层
  `descriptor.mod`。所以部署脚本与校验器的「按字段比」必须同时覆盖内外两份，容差 `1.21.*` / `1.21.x`。
- **上传确认只认三个机器信号**：`$env:STEAM_API_KEY` 在本机 pwsh 里**是空的**（key 在插件配置里），
  `steam_workshop_search` 精度只到 0.1 MiB。确认上传用：① 本机两份 descriptor 的 `supported_version`
  被回写成 `1.21.0`（mtime 变了）；② `steam_workshop_search` 显示「更新于 <日期> / 0.1 MiB / 订阅数」；
  ③ 条目 ID 未变。**精确 `file_size` 拿不到就记 SKIP 并写原因**，别猜。
  auto v2.1 实测：条目 3779621287、0.1 MiB、订阅 1770、内层 75,393 B（精确值 SKIP）。
- **首传与更新的信号不同（2026-11-20 organizer 实测）**：organizer 首次上传后两份 descriptor 各 **+28 B**
  （233→261 / 138→166 B，末字节仍 `0x22`、SHA256 `4F0AE29B…` / `3068C8CF…`），新增
  `remote_file_id="3842795131"`，但 **`supported_version` 仍是 `1.21.*`**——没有回写。
  → 「更新」看 `supported_version` 是否被写成实测版本，「首传」只看 `remote_file_id` 是否出现且与条目 ID 一致；
  两者都伴随「+28 B」这条字节特征。
- **上传后必须回填 META 再重生成**：organizer 未回填时 `工具-部署.mjs --check` = **6/8**（两份 descriptor 的
  `remote_file_id` 不一致），回填 `数据-元数据.mjs` 的 `remoteFileId` + `工具-生成.mjs` 后 = **8/8**。
- **首次上传的 descriptor 变化是「回写版本 + 新增一行 `remote_file_id`」**：mastery v1.0 首次上传后两份本机
  descriptor 从 207 / 114 B 变成 **235 / 142 B**（+28 B），`supported_version` 被写成 `1.21.0`，并新增
  `remote_file_id="3842327113"`；**末字节仍是 `"`、无行尾换行**。所以删本机副本前先记**字节数 / 末字节 / SHA256**
  （本轮 `513BE13D…0C4B4` / `3C0DA9C8…269A6`）并回填编号；三信号第 3 条对**首次**上传是
  「拿到的新编号与 descriptor 一致」，不是「ID 未变」。
- **退役 mod 的判据依赖某个已失效的外部标识（死 ID / 旧路径）时，保留原值 + 注释，别顺手置空**：
  降祸 mod 下架后把 `remoteFileId` 置空 → 它的反向验证从 32/32 掉到 31/32（K1 样本靠「改本机副本的
  `remote_file_id`」构造，表里为空就构造不出样本）。删一个判据依赖的输入 = 让一条判据永久失效；
  置空只在「重发前」那一刻做。
- **工坊预检的「三份 descriptor 字段一致」在本机副本还在时会有意报不一致**：mastery 回填后快照是 `1.21.*`、
  本机副本被启动器回写成 `1.21.0` → 预检报 1 项不一致；删掉本机副本、只剩快照两份（都是 `1.21.*`）→ PASS。
  这是**预期差异**、不是故障；`工具-部署.mjs --check` 对 `1.21.x` 本就按字段容忍。
- **描述结构是用户偏好，不是模板**：「第 1 段：模组介绍 / 第 2 段：适用范围」这种拆法是自作主张——
  organizer 明确要求「不要分开」，改成**整篇一段**（无标记），静态校验 J 段口径也改为「无标记时整篇算一段」
  （`splitSegments` 本来就有整篇回退）。整篇 **5367 B** ≤ 8000。
- **改动说明两种形态**：描述末尾加 `[h2]改动说明[/h2]` 节；另给独立 `工坊改动说明.txt`（**846 B**）供启动器
  「修补程序说明」字段。两者都 UTF-8 + LF + 无 BOM，BBCode 只用 `[h1][h2][b][list][*]`。

## [verify] 验证判据（无头 / A5 / 反向显示）

> 结论层最容易被「看起来通过」骗。这里三条都是 2026-11-18b 实测后固化的判据。

- **无头判据固定三件套**：到 `Start running through history.` + 本 mod 报错 **0** + 播放集
  `dlc_load.json` **SHA256 还原**。「没自退」**不单独当加载失败**：auto v2.1 同一份部署第 1 轮 33.1 s
  到 history 却没自退（判 WARN），30 秒后复跑 25.9 s、exit 0、PASS —— 进程自退是概率性的，**先复跑一次再下结论**。
- **A5 / 日志判据两条**：① 本 mod token（`auto_spread` / 中文名）**0 条**；② **没有任何 `Script location`
  指向本 mod 的文件**。只数 token 会漏掉「引擎报错但不带脚本对象名」的情况；反过来原版噪声会淹没日志
  （1.21 基线 8,094 条 [E]，见 `[ingame]`），所以先按 `Script location` 分组。
- **反向验证的结论行不许硬编码样本数**：各 mod 样本数不同（历史：curse 32；现在 mastery 13、auto 7），共享 `lib/reverse.mjs`
  曾把结论写死成 `32/32`，auto 只有 7 条也显示 `32/32`（2026-11-18 修复）。显示必须从脚本输出解析
  （`反向验证：N / N 项如期报错`）；`configs.mjs` 的 `expect` 按 mod 写期望值——断言的是「显示等于实际」，
  不是断言常量。
- **结构性判据先剥注释（`stripComments`）再匹配**：mastery 的 L5 检查决策里的 `is_shown = { is_ai = no }`，
  而决策文件注释里正写着这句示例 → 「删掉闸门」的坏样本照样 PASS（本轮唯一的真 bug）。
  所有结构性判据一律先剥注释（括号配平还要 `stripStrings`）再跑；注释里的示例片段不算数。
- **反向样本必须断言「确实改到了目标」**：样本改完与原文相等就直接抛错（`if (next === src) throw`），
  否则「样本没生效」会被读成「判据没开火」，白跑一轮。
- **反向样本也可能只改到注释**：organizer 的「范围判定退回 `top_liege`」样本用
  `replace('is_vassal_or_below_of = root', 'top_liege = root')`，只替换到**文件头注释里的示例**，代码没动、
  校验器照样 PASS。→ 用 **`replaceAll`**，或先剥注释再匹配，并保留 `next !== src` 断言。
- **探针跑完要证明「回到已验证状态」**：删掉探针两个文件 → `--clean` 重部署 → 与已验证干净态比
  **8 个文件 SHA256 全同**（organizer 实测），干净态的无头结论才继续有效；探针文件不许随发布物留下。
- **`--root` 模式跳过部署比对**：拿 v1.0 反例跑 `--root` 时，K 段原本会去比「当前本机副本」——
  部署的是新版，反例就凭空多出 3 条「不一致」（de-jure 实测 20 → 23）。判据必须与部署状态解耦：
  在 `--root` 模式下 K 段只提示跳过。同理，任何「拿样本比当前环境」的检查都要先问「这个环境变量该不该参与」。
- **换了判据，反例期望值必须重导，并证明差值来源**：de-jure 的 L 段从「必须有 `add_truce_*`」改成
  「必须有 wrapper + 内联零残留」后，v1.0 反例从 16 变成 20。直接改数字等于自证；正确做法是用
  `git show HEAD:工具-静态校验.mjs` 把**旧版校验器**跑在同一样本上（旧版仍是 16），
  再逐条对出新增的 4 条（缺 3 个 wrapper + 6 处内联残留合成 1 条）——差值来自断言集合变化，不是判据失灵。

---

## [dependency] 共用脚本库（前置 mod，2026-11-21 core 实测）

- **`.mod` 支持 `dependencies={ "显示名" }`**：值必须与库 descriptor 的 `name` 逐字一致（不是文件夹名）。
  本机已订阅的工坊 mod 里有现成例子（如 `ugc_2730101159.mod` 同时依赖三个库）；内外两份 descriptor 都写。
- **缺库的报错形态**：消费者脚本调用不存在的 `cn_dejure_core_*` 时，游戏会报 `Unknown trigger/effect`
  （`pdx_persistent_reader.cpp:216` 这一类；2026-11-21 的 error.log 里其他 mod 的 `Unknown trigger: is_dwarf`
  就是同型）。所以消费者不能「先单独发」——**上传顺序 = 库先、消费者后**，工坊描述写清「需要前置库」。
- **脚本对象是全局的**：所有启用 mod 的 `common/scripted_effects|triggers` 合进同一库，消费者按名字调用；
  加载顺序把库放上面（启动器 `dependencies` 会排序，手动播放集兜底）。
- **无头测不了「库 + 消费者」**：`ck3mod_headless` 把 `dlc_load.json` 写成 `[mod.enabledEntry]`（单条）。
  替代：**合并副本冒烟**——`ck3mod_deploy <consumer>` → 把库的 `common/scripted_effects|triggers/*.txt`
  复制进本机副本同路径 → `ck3mod_headless <consumer>` → 手工 grep 本轮 `error.log` 的库 token
  （工具的 `modErrorLines` 只按消费者的 folder 过滤，会漏库的报错）→ `ck3mod_deploy --clean`。
  真正的双/三 mod 依赖仍要真机联测。
- **接口纪律**：库的 `数据-接口.mjs` 是唯一事实来源；库校验器断言快照导出集合**完全相等**（多/少都红）；
  消费者校验器从接口表取名字并核对调用参数（`TIER` / `CHANGE`）、0 处内联回流。
- **迁移等价/覆盖**：v1.0→v1.1 用 `工具-迁移比对.mjs`（16/16 块逐行一致）+ `工具-迁移覆盖.mjs`
  （旧 29 条反向样本 29/29 有落点：organizer 40 / core 27）证明「只搬家、不改行为、不删检查」。
- **共享状态联动（2026-11-21 core 1.2）**：dejure 胜利 → core 的 `mark_recent_conquest`（flag
  `cn_dejure_core_recent_conquest` 365 天）；organizer 的 `cost` 用 **script_values** 读 core 的
  `recent_conquest_trigger`，窗口内 0/0；点击后总效果末尾 `clear`（一次胜利一次）；dejure 的战后建衔也读同一
  window。**软联动**：dejure 不在 → trigger 恒 false，organizer 永远 300/300；organizer 不在 → dejure 窗口照常。
  两者仍只硬依赖 core。成本脚本值的 scope 是 root 角色；已在 organizer 的 H6 钉 values 逻辑。
- **软合并标记（2026-11-21 core 1.2）**：`SUITE_MARKER = cn_dejure_suite_organizer`。organizer 的
  `on_game_start` / `on_game_start_after_lobby` **只追加** `on_actions = { marker }`（直接写 `effect` 会覆盖原版），
  marker 设 save 级全局变量；dejure 的战后决议在「标记 + 公爵级 + 有首都」时隐藏，伯爵级/单独装保留。
  标记是 save 级：旧存档可能没有、禁用 organizer 后可能残留；控制台 `set_global_variable` /
  `remove_global_variable` 处理。**organizer 单独装必须用一次该变量**（例如决议里的 `custom_tooltip`），
  否则引擎刷 2 条 `Variable 'cn_dejure_suite_organizer' is set but is never used`（实测：加使用点后消失）。
  载入旧存档时钩子是否触发未机器证明；用户 M5 验证。
- **本轮实测**：core 1.2 静态 A–M PASS、反向 27/27；dejure 2.6 静态 A–O PASS、反向 6/6（v1.0 反例 20/20）；
  organizer 1.3 静态 A–P + H10 PASS、反向 40/40；合并副本无头：core WARN（到 history、0 报错、隔离干净，
  本次未自退）、dejure PASS 27.3 s、organizer PASS 25.4 s；`check --all` 6/6、`reverse --all` 6/6。
  联动版真机 L1–L4 用户 2026-11-21 报 PASS；合并版 **M1–M3 + M4（只开 core+dejure）用户 PASS**；
  M4b 伯爵级 / M5 旧存档 / M6 真实胜利 **SKIP（未测）**；现场已 `--end`/`--clean`，三件套 `clean`。