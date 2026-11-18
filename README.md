# dsh-ck3-mod-dev —— CK3 模组开发智能体 + 工具插件

> 一个 DSH profile bundle：一个可在会话里选择的智能体预设 **「CK3 模组开发」**（`preset-ck3mod`），
> 外加 8 个 `ck3mod_*` 工具。工具只做**调用与汇总**——校验规则仍然归四个 mod 自己的
> `工具-*.mjs` 与 `ck3-modding-tools/cli.mjs`，本插件一份都不复制。

- 包名：`@local/ck3moddev` · 版本 0.3.1 · MIT
- 作用域：Windows 本机、profile `desktop`、游戏 **CK3 1.21.0 "Florin"**
- 只做新增：不覆盖、不删除、不改动任何现有插件（`@local/ck3wiki`、`@local/steam`、`@local/prts` 等原样保留）
- 仓库：<https://github.com/ABccgh/dsh-ck3-mod-dev>（MIT）

---

## 1. 它解决什么

CK3 mod 的修改闭环是「改脚本/本地化 → 生成/规范化 → 校验 → 部署 → 无头冒烟 → 真机 → 工坊」。
以前每一步都要手写 pwsh：记住 node.exe 的绝对路径、记得备份 `dlc_load.json`、记得 BOM + LF。
这套工具把这些**易错且不可见**的步骤做成原语：

| 以前 | 现在 |
|---|---|
| 手拼 `& $node .\cli.mjs check --all` | `ck3mod_check`（结构化 PASS/FAIL + loc 计数） |
| 手动把发布快照复制到 `Documents\...\mod` | `ck3mod_deploy`（按 mod 自己的部署脚本，带能力探测） |
| 手改 `dlc_load.json`、跑 exe、再改回来 | `ck3mod_headless`（备份/还原/哈希核对/日志分诊，一条命令） |
| 改完忘跑规范化，BOM 缺失刷 `error.log` | `ck3mod_build`（生成 + 规范化，或 `--check` 只比对） |
| 查 trigger/effect 只能翻 Wiki | `ck3mod_vanilla`（在 1.21 安装目录里真实检索） |
| 工坊描述超 8000 字节，上传才发现 | `ck3mod_workshop`（按「段」预检，发布前拦下） |

---

## 2. 组成

```
dsh-ck3-mod-dev/
├── cordis.patch.yml     只插入一行 preset-ck3mod；工具插件挂在预设作用域内
├── lib/
│   ├── index.js         apply()：注册 8 工具 + 本作用域内屏蔽无关全局工具
│   ├── config.js        normalizeConfig（路径/开关/上限）
│   ├── tool-kit.js      本地 defineTool（零 @deepseek-ai 依赖）
│   ├── text.js          TEXT_OUTPUT / 夹紧 / 超长输出落盘
│   ├── exec.js          spawn + 超时 + abort + 进程树杀灭
│   ├── registry.js      mod 注册表（动态 import configs.mjs）+ 能力探测
│   ├── gamelog.js       日志解析纯函数
│   ├── headless.js      dlc_load 备份/还原/pending 自愈 + 日志分诊
│   └── tools/*.js       8 个工具
├── locale/{en,zh}.json  插件页显示元数据
├── icon.svg             原创图标（王冠 + 脚本基线）
└── test/                node --test
```

**智能体预设**（`preset-ck3mod`，显示名「CK3 模组开发」）自带：persona（硬规则 + 三层查证前置）、
文件/搜索/pwsh/jobs/skill/todo/ask/web/present/plan/compaction，外加本包的工具插件。
skill 提供器加载本机 `~\.agents\skills\ck3-modding`（源在本仓库 `skills/`，用 `工具-同步技能.mjs`
部署，见 §8）。**不挂** delegation / goal / schedule / plugin-manager（保持精简）。

---

## 3. 安装 / 更新 / 卸载

沿用本机其他 `@local/*` 插件的约定：仓库 → `dsh-bundles` 副本 → `plugin_manager`。

### 3.1 从 GitHub 安装（首次）

```powershell
git clone https://github.com/ABccgh/dsh-ck3-mod-dev.git `
  "$env:USERPROFILE\dsh-bundles\ck3moddev"
```

然后按 **§3.3** 把 `cordis.patch.yml` 里的本机路径改掉（作者机器用的是 `D:\DSH workspace`、
`C:\Users\11210\...`；`file:` URL 里的用户名与安装目录也必须改成自己的），再执行下面的
`install_bundle`。仓库里的默认值（`lib/config.js`）是机器中立的，只有 patch 需要按本机填。

### 3.2 本机安装 / 更新

```powershell
robocopy "D:\DSH workspace\dsh-ck3-mod-dev" "%USERPROFILE%\dsh-bundles\ck3moddev" `
  /MIR /XD .git test node_modules skills /XF 工具-同步技能.mjs 工具-真机现场.mjs
```

> `skills/` 与 `工具-同步技能.mjs` 不复制：知识层的源在仓库、部署副本在
> `%USERPROFILE%\.agents\skills\ck3-modding`（见 §8.3），安装目录里再放一份只会造成「改哪份」的混淆。

然后：

```
plugin_manager  action: install_bundle  target: %USERPROFILE%\dsh-bundles\ck3moddev
```

- 首次安装：返回 `application: applied` 即生效；`restart-required` 就重启 DSH。
- **改代码**：重新 robocopy → **重启 DSH**（Host 会缓存已加载的 ESM 模块，插件页关开不会重读代码）；
  不想重启时按 §3.3 把 `?v=` 加一再关开 bundle。
- **只改 `cordis.patch.yml` 的配置值**：把 bundle 关开一次即可（HMR 重组）。
- 卸载：`plugin_manager action: remove_bundle target: @local/ck3moddev`；
  本目录与 `dsh-bundles` 副本可留可删（删了要重装才能回来）。

安装后自查：

- `Config.listConfigs` 能看到 `include:preset-ck3mod`，状态 `schema`；
- 新建会话时预设列表里有「CK3 模组开发」；
- 该会话工具表含 8 个 `ck3mod_*` + `ck3wiki_*` + `steam_*`。

### 3.3 为什么预设子插件写成 `file:` URL

预设的 `plugins` 子行是由 **DSH 安装目录**解析的（Loader 的 baseUrl 在 `dsh/node_modules` 下），
不是 profile 的 `node_modules`。实测矩阵：

| 子行 `name` | 从 dsh base 解析 | 从 profile base 解析 |
|---|---|---|
| `@deepseek-ai/dsh-tool-fs` | ✅ | ❌ |
| `@local/ck3moddev` | ❌ `ERR_MODULE_NOT_FOUND` | ✅ |
| `file:///…/dsh-bundles/ck3moddev/lib/index.js` | ✅ | ✅ |

所以 `ck3mod-tools` 行必须用 `file:` URL（写成包名时预设卡片直接「加载失败」）。
由此带来的维护约束：

1. `dsh-bundles\ck3moddev` 不能随便挪；搬了要同步改 `cordis.patch.yml` 里那一行。
2. Node 按**完整 URL** 缓存 ESM 模块：改 `lib/` 后要重启 DSH；不想重启时把 `?v=` 加一，
   再把 bundle 关开一次，就能强制重新 import。
3. 每次激活都会写 `%TEMP%\ck3moddev-activation.json`（`ok` / `tools` / `maskedGlobals` / 错误栈）。
   预设「加载失败」时先看它——客户端卡片只显示一行错误摘要。
4. 绝对不要用 `ctx.setTimeout`：它属于 timer 服务，未在 `inject` 里声明会抛
   `cannot get property "timer" without inject`（实测踩过，导致整个预设加载失败）。
   需要延迟就用全局 `setTimeout` + `ctx.effect` 清理。

---

## 4. 配置

`cordis.patch.yml` 里 `ck3mod-tools` 行的 `config`，全部可省略（走默认值）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `workspaceRoot` | `D:\DSH workspace` | 工作区根 |
| `toolsDir` | `<workspaceRoot>\ck3-modding-tools` | **唯一 mod 注册表**（`configs.mjs`） |
| `gameRoot` | `D:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III` | 只读 |
| `userDir` | `C:\Users\11210\Documents\Paradox Interactive\Crusader Kings III` | `mod/`、`logs/`、`dlc_load.json` |
| `nodePath` | 空 = 自动探测 | 探测顺序：配置 → `$DSH_HOME/dsh-runtimes/<runtime>/dependencies/node/bin/node{,.exe}` → PATH |
| `allowGlobalToolPrefixes` | `['ck3wiki_', 'steam_']` | 全局工具白名单（其余在 CK3 会话里隐藏） |
| `enableGameLaunch` | `true` | false 时 `ck3mod_headless` 只解析日志、不启动游戏 |
| `headlessTimeoutSec` | `240` | 单次无头上限（30–900） |
| `maxOutputChars` | `12000` | 单工具展示上限；超出部分落 `%TEMP%\ck3mod\` |

派生路径：`modsDir=<userDir>\mod`、`logDir=<userDir>\logs`、`gameExe=<gameRoot>\binaries\ck3.exe`。

> **为什么不能直接用 `process.execPath`**：Host 跑在 Electron 主进程里，`process.execPath` 是
> `DeepSeek Harness.exe`，直接拿去跑 `.mjs` 会启动一个第二个 Harness。必须显式给 node 路径。

---

## 5. 工具清单

| 工具 | 写盘 | 启动游戏 | 说明 |
|---|---|---|---|
| `ck3mod_status` | — | — | 环境 + 四 mod 总览：快照/本机副本、能力、git、游戏版本、日志时间、播放集哈希 |
| `ck3mod_check` | — | — | `check` / `loc` / `reverse` / `selftest`，跑共享 CLI 的 `--json` 并渲染 |
| `ck3mod_build` | ✅ 发布快照 | — | `generate` / `normalize`（写）或 `*-check`（只比对）/ `pipeline` |
| `ck3mod_deploy` | ✅ `Documents\...\mod` | — | `deploy` / `check` / `clean`；按 mod 自己的部署脚本，能力探测决定 `--prune` 等 |
| `ck3mod_headless` | ✅ 临时改 `dlc_load.json` | ✅ | 无头冒烟；带备份/还原/哈希核对/pending 自愈/日志分诊 |
| `ck3mod_logs` | — | — | `error` / `debug` / `game`：`[E]` 行、`Enabled`/`Mounted` 隔离判断、按 mod 计数 |
| `ck3mod_vanilla` | — | — | 在游戏安装目录检索原版脚本/本地化/`.info` 文档 |
| `ck3mod_workshop` | — | — | 工坊描述**逐段** ≤8000 字节、descriptor 字段对照、缩略图、空 `remote_file_id` 警告 |

只读工具并发安全；`build` / `deploy` / `headless` 串行，且 headless 有进程内互斥。

### 5.1 能力探测（不硬编码）

四个 mod 的脚本并不统一：curse 的部署支持 `--check --clean --prune --allow-launcher-rewrite`，
dejure 少 `--prune`，free 只有 `--check`，auto-spread 根本没有部署脚本。
插件在运行时读脚本文本里出现过的 `'--xxx'` 字面量，据此决定允许哪些参数；
请求了不支持的开关会直接拒绝并列出该 mod 实际支持的项——**不会**把参数硬塞给脚本。

### 5.2 `ck3mod_vanilla` 的检索范围

| `scope` | 目录 | 体量（1.21.0 实测） |
|---|---|---|
| `common`（默认） | `game/common` | 3215 文件 / 77 MB |
| `events` | `game/events` | 611 文件 / 41 MB |
| `loc` | `localization/{english,simp_chinese}` | 1351 + 1350 文件 / 58 MB |
| `docs` | 全游戏 `*.info`（脚本 API 文档） | 214 文件 / 1.3 MB |
| `tests` | `game/tests` | 19 文件（1.21 新增脚本测试库） |
| `all` | common + events + tests + 全部 `.info`（**不含** localization） | ~119 MB |

预算：最多 20000 文件 / 120 MB / 8 秒；超预算会在结果里标「部分结果」。

### 5.3 `ck3mod_workshop` 的分段

Steam 的 8000 字节上限是**每个上传字段**的，所以 `工坊描述-BBCode.txt` 里常有两段
（描述 + 修补程序说明）。工具按文件自身的标记拆分，再逐段判：

| 文件里的写法 | 拆分方式 |
|---|---|
| `########## 第 N 段：… ##########` … `########## 第 N 段结束` | 提取成对标记之间的内容 |
| `==================== 第 2 段：… ====================` 分隔行 | 以该行为界左右各一段 |
| 没有任何标记 | 整个文件算一段 |

只要**每段** ≤ 8000 字节就 PASS；整个文件超过 8000 不算错（free/auto 就是这种形状：
文件 8458/8360 字节，但两段分别只有 6552+1105 / 6692+890）。

---

## 6. 无头冒烟的安全设计

这是唯一会改游戏状态的工具，流程刻意做重：

1. **崩溃自愈先行**：`%TEMP%\ck3mod-headless\pending.json` 存在时，先把上次的原始
   `dlc_load.json` 按字节写回、核对 SHA256、删标记，然后才开始本次。
2. **前置拒绝**（任一命中都不写一个字节）：
   `enableGameLaunch=false` · `ck3.exe` 在跑 · `dowser.exe`（启动器）在跑 ·
   本机 mod 副本不存在 · 游戏 exe 缺失 · `dlc_load.json` 不可读或不是合法 JSON。
3. **先立字据**：写 `pending.json`（原始字节的 base64 + SHA256 + 备份路径），
   再把播放集改成只启用本 mod。
4. **启动**：`ck3.exe -debug_mode -nographics -shutdown_after_history -suppress_error_log -gdpr-compliant`。
   `-suppress_error_log` 只关「自动打开错误日志窗口」，不会少写日志（见 `game/_commandline_options.info`）。
   进程用 `stdio: 'ignore'` 启动——崩溃处理进程可能继承管道句柄，让 Node 永远等不到退出
   （实测：游戏 9 秒就崩了，用管道时 180 秒后还显示「运行中」）。
   **看门狗**：轮询 `debug.log`，一旦出现 `Start running through history.`，再给 20 秒宽限；
   还不退出就杀进程树，判定改用日志证据，而不是干等 `timeoutSec`。
5. **还原**：`finally` 里按字节写回 → 核对哈希 → 删标记；失败时保留备份与标记并抛错，附两个绝对路径。
6. **分诊**：`error.log` 的 `[E]` 行按 mod 文件夹名计数；`debug.log` 的
   `Enabled` 清单判定隔离（出现别的 mod → `ISOLATION WARNING` 而不是 PASS），
   `Mounted Data` 确认数据目录真的挂上，崩溃标记（`Instance has not been created!` 等）单独列出。
7. **基线**（`baseline: true`）：再跑一轮空播放集，去时间戳排序后做差集 —— 对应 runbook 的「基线对照」。

结论三档：

- `PASS`：加载期干净 + 进程正常退出（退出码 0、无崩溃标记、隔离干净）。
- `WARN`：加载期干净，但退出异常（本机常态：无头每次到 history 起点就崩，见下）、
  有非本 mod 报错、隔离不干净或日志没更新。
- `FAIL`：本 mod 有报错、没走到 history、超时/中断、或 `dlc_load.json` 还原失败。

> **本机现实（1.21.0 复测，2026-11-18）**：空播放集的无头基线 **26.5 s 到
> `Start running through history.` 后自行退出、exit 0**，1.20 那个「到 history 必崩
> （`Instance has not been created!`，`crashes\` 下生成目录）」的现象**没有复现**。
> 装 mod 后是否仍干净，以当次报告为准；结论三档里的 WARN 仍保留给「加载期干净但退出异常」的情况。
>
> 另有一个**固定噪声**：`Documents\...\player\game_rules\presets.txt` 里残留的旧 mod game rule
> 引用（例如 `on_auto_spread_ai`）会让每次启动都报一行
> `Failed to read key reference: on_auto_spread_ai`。它**不是加载错误**，用 `baseline: true`
> 做基线对照时会被差集扣掉；不做基线时记得手动忽略这一行。

> 无头只验**加载期**：验不了互动点击、UI、tooltip。静态 + 无头全绿 ≠ 功能正确。

---

## 7. 全局工具屏蔽

预设是「专门给 CK3 用的」，所以 `lib/index.js` 在预设作用域内调用 `ctx.tools.restrict`，
只保留 `allowGlobalToolPrefixes` 命中的全局工具（默认 `ck3wiki_` + `steam_`），
把 `prts_*`、github MCP、agent-team、terminal、worktree 等与 mod 开发无关的工具隐藏掉。

- 只是**这个会话的视角**：插件本身照常运行，其他会话一切照旧；
- 只 deny 确实存在的名字（`restrict` 遇到未知名字会抛），整段 try/catch；
- 预设急切激活，2 秒后再补一次（restrictions 取交集，重复无害）；
- 屏蔽失败不影响任何工具，只是工具表更大。

---

## 8. 知识层：Wiki 索引与三层查证

0.2.0 起，「怎么查资料」是这个预设的一等公民。知识层的**源在主仓库**，部署副本在
`%USERPROFILE%\.agents\skills\ck3-modding`（DSH 实际加载的位置），用 `工具-同步技能.mjs` 单向同步：

| 文件 | 作用 |
|---|---|
| `skills/ck3-modding/SKILL.md` | 流水线、硬规则、Wiki 路由表（「要点」列指向实测小节）、1.21 变化、覆盖与兼容、真机验收铁律 |
| `skills/ck3-modding/references/verified-notes.md` | 12 组实测要点：interaction / CB / 政体 / Resources / 议会 / 故事循环 / 斗争 / district / trade / road / laws / ingame，每条带 **1.21.0** 的 `.info` 行号，按需只读一节；顶部另有「1.21 改名与 patch note 落差」表 |
| `skills/ck3-modding/references/ck3-wiki-atlas.md` | 生成物：Category:Modding 全 67 页 + **1.21 新内容 11 页 + 机制语义 25 页** + Category:1.21 校验集 + 补丁链，带最后编辑与 `{{version}}` |
| `skills/ck3-modding/scripts/wiki-atlas.mjs` | 索引生成器；`--check` 验鲜，漂移退出码 1 |
| `skills/ck3-modding/references/ingame-acceptance.md` | 真机验收 runbook：准备 / 启动（`-skip -play=`）/ 四 mod 矩阵 / 证据规范 / 收尾 |
| `工具-同步技能.mjs` | 仓库 `skills/` → 用户 skill 目录；`--check` 只比对，`--dest` 改目标 |
| `工具-真机现场.mjs` | 真机验收现场保护：`--begin` 快照存档/设置/播放集，`--end` 按字节还原并核对 SHA256 |

### 8.1 三层真相

| 层 | 来源 | 回答什么 |
|---|---|---|
| 1 Wiki | `ck3wiki_*`（预设里保留可见） | 语义、示例、工作流、补丁说明 |
| 2 本机原版 1.21.0 | `.info` / `common`（`ck3mod_vanilla`），或控制台 `script_docs` | 键名、参数、现在还存不存在 |
| 3 本仓契约 | `数据-*.mjs` + `工具-静态校验.mjs` + loc 检查 | 我们自己的不变量 |

一句话：**Wiki 用来理解，原版用来确认，静态校验用来兜底**。`Effects list` / `Triggers list`
是抄录版、页面自己都写着 outdated，只能用来找名字。

**1.21 的特殊纪律**：Wiki 的 modding 层整体没跟上——`Category:1.21`（75 页）里只有
`Console commands` 一个 Modding 页。所以 1.21 的结论默认先回层 2，Wiki 只取语义；
连 patch note 的名字都可能对不上（`monthly_tax`、`add_regular_district` 等，详见
`verified-notes.md` 顶部表），一律以 `grep` 实机结果为准。

### 8.2 刷新索引

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "$env:USERPROFILE\.agents\skills\ck3-modding"
& $node .\scripts\wiki-atlas.mjs            # 重写 references\ck3-wiki-atlas.md（本机实测约 6 秒；站点一次吐 ~1.2 MB）
& $node .\scripts\wiki-atlas.mjs --check    # 只比对，不写文件；漂移退出码 1
```

CK3 每次大版本更新后跑一次；`--check` 适合放在发版前。脚本**必须带描述性 UA**——默认 Node
UA 会被站点 WAF 回 HTML（实测 `Unexpected token '<'`），脚本里已写死一个只读 UA。

### 8.3 为什么源在仓库、部署在用户目录

DSH 只从 skill 根目录（`~/.agents/skills` 等）发现 skill，而 GitHub 只认仓库内容——两边都得有。
折中办法是**仓库存源、用户目录存部署副本**，`工具-同步技能.mjs` 单向覆盖、`--check` 比哈希防漂移。

没选「让预设直接读包内 `skills/` + 删掉用户副本」：那要改 `skill-filesystem` 配置并重载，
配置一旦写错就一个 skill 都加载不到；同步脚本出错只是副本过期，`--check` 立刻能发现。

### 8.4 同步知识层

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\dsh-ck3-mod-dev"
& $node .\工具-同步技能.mjs            # 部署（4 文件 / 约 64 KB）
& $node .\工具-同步技能.mjs --check    # 只比对；漂移退出码 1
```

改了 `skills/` 下任何文件都要跑一次同步，否则会话里加载的还是旧副本。

## 9. 测试

```powershell
$node = "C:\Users\11210\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
cd "D:\DSH workspace\dsh-ck3-mod-dev"
& $node --test "test/*.test.js"
```

- `tool-kit.test.js`：简写 spec → JSON Schema、参数归一、必填校验。
- `headless.test.js`：临时目录 + fake run，覆盖 PASS/FAIL/超时/启动器占用/副本缺失/基线/自愈。
- `plugin.test.js`：mock ctx，断言 8 个工具注册、`restrict` 的 deny 列表、apply 不返回值。
- `tools-a.test.js` / `tools-b.test.js`：各工具的参数拼装与渲染边界。

测试**不启动真实游戏**、不写真实播放集。

---

## 10. 已知限制

- **无法验证 UI 渲染**：插件页标题/图标、预设选择器里的显示，需要人眼确认。
- **无头 ≠ 真机**：互动、UI、tooltip、本地化显示仍然只能进游戏点。
- **全局屏蔽是 best-effort**：Host 插件晚于 2 秒注册的工具不会被隐藏；`restrict` 语义变化时静默降级。
- **不自动上传工坊**：只做发布前检查；上传仍由启动器手动完成。
- **不生成缩略图**：`工具-缩略图.py` 仍需手工跑（仅 curse 有）。
- **强杀 DSH 的极端情况**：`pending.json` 会在下次调用时自愈，但那次 `dlc_load.json` 可能短暂处于测试状态。
- **`cordis.patch.yml` 含本机绝对路径**：`file:` URL 是预设子插件的唯一稳定引用方式（见 §3.3），
  所以部署 patch 天然是「本机配置」，换机或换目录要照 §3.1 改；`lib/config.js` 的默认值则是机器中立的。
- **Wiki 索引是快照，不是真相**：`--check` 只说明「表体与线上一致」，不保证页面内容正确；
  页面本身也会过期（`Effects list` / `Triggers list` 是抄录版），结论仍要回 `.info` 复核。
- **skill 是两处副本**：仓库 `skills/` 是源，`~\.agents\skills\ck3-modding` 是部署副本；改完必须跑
  `工具-同步技能.mjs`，否则会话里加载的是旧副本。`--check` 可随时验漂移。
- **没有无人值守的脚本测试入口（1.21 复测）**：`tests/_tests.info` 只给了游戏内控制台命令
  `scripted_tests [pattern]`；`-automated_test` 会起一局全自动 AI 对局且不自行退出，
  `-run_console_action=scripted_tests` 10 s 退出 0 但不产生任何测试输出。可重复路径仍需人工开游戏。
- **真机验收默认人点**：这个预设里 `input_*`（键鼠注入）被全局屏蔽，agent 不能代点；验收由人操作、
  agent 负责现场（`工具-真机现场.mjs`）、日志与结论。只有用户当次明确同意才谈 GUI 自动化，且要先建现场。
- **真机会写用户存档**：CK3 没有独立用户目录，`autosave*.ck3` / `last_save.ck3` / `continue_game.json`
  都会被覆盖（2026-11-18 实测）。没有 `--begin` 的现场就不许开游戏——这是硬规则，不是建议。

## 11. 怎么改 / 下次 CK3 更新时

- 加/删工具：改 `lib/tools/*.js` 并在 `lib/index.js` 的 `createTools` 里登记；同步 `test/plugin.test.js` 的名字列表。
- 换默认路径：改 `cordis.patch.yml` 的 `ck3mod-tools.config`（重载即可，不必重启）。
- CK3 更新后：先 `ck3mod_status` 看游戏版本，再 `ck3mod_check mod=all` 跑基线；
  无头命令若因引擎参数变化失败，改 `lib/headless.js` 的 `GAME_ARGS`（唯一一处）。
- **CK3 大版本更新后**按这个顺序刷新知识层：
  1. 改 `scripts/wiki-atlas.mjs` 的 `GAME_VERSION` 与 `VALIDITY_CATEGORY`（如 `'1.21'` → `'1.22'`），
     补 `PATCHES` 里的新补丁页；跑一次生成，`assertCoverage` 会指出 Wiki 新增的 modding 页。
  2. 复核 `references/verified-notes.md`：逐条回新版本 `.info`，**失效的删掉**，行号全部更新；
     新机制页（如 1.21 的 trade / districts / roads）按同一格式加节。
  3. 复核 `references/ingame-acceptance.md`：启动参数表（`_commandline_options.info`）、四 mod 矩阵的
     入口与期望、证据命令；`[ingame]` 一节同步更新。
  4. 改 `SKILL.md` 的 Environment 与「1.2x 变化」段；`metadata.version` 加一。
  5. 重跑 `cli.mjs check --all`（四个 mod 的 vanilla token 是否还在）；必要时跑无头冒烟与真机验收。
  6. `工具-同步技能.mjs` 同步 + `--check`；robocopy + 关开 bundle；更新 README 版本与 §13。
- 新增 mod：在 `ck3-modding-tools/configs.mjs` 加一项即可，**不要**在插件里另建列表。

## 12. 注意事项

1. 本目录是**活体安装目标**（见 `DO-NOT-DELETE.txt`）：删除或移动它会让预设与 8 个工具一起消失。
2. 改代码必须重启 DSH；只改配置值重载一次即可。
3. `dlc_load.json` 归启动器所有：不要手写，用 `ck3mod_headless`（无头）或 `工具-真机现场.mjs --begin`（真机）。
4. 本机副本与工坊订阅版不要同时启用（会重复定义）；测完 `ck3mod_deploy action=clean` 清场。
5. **开游戏前先 `--begin`，收场用杀进程 + `--end`**；游戏内「退出游戏」会覆盖 `autosave_exit` / `last_save`。

## 13. 更新记录

### 0.3.1（2026-11-18）— 真机验收步骤重写 + 现场保护

- **触发**：1.21 真机尝试暴露六个缺口——`-develop` 根本不存在、GUI 会话覆盖了用户 `autosave*.ck3` /
  `last_save.ck3` / `continue_game.json`、验收项散在四个 mod 仓库且停在 1.20、没有证据规范、没有说明谁点。
- **新增 `工具-真机现场.mjs`**：`--begin` 快照（播放集/设置/规则预设/`last_save`/`continue_game`/全部存档）
  并可改写播放集；`--end` 按字节还原 + 隔离会话期新存档 + 核对 SHA256；`--check` 中途体检；`--clean` 清场。
  8 个单测（临时目录，不碰真实用户目录）。
- **新增 `references/ingame-acceptance.md`**：准备五步 / 两条启动路线 / 四 mod 验收矩阵（curse 7 项、
  de-jure 6 项、free 8 项、auto 5 项）/ 证据规范 / 收尾六步 / 判定边界。
- **SKILL.md 0.4.0**：把「手动调试闭环」重写为「真机验收」；路由表加一行、验证层改写 In-game 行；
  硬规则 2 改写（播放集与存档都归用户）、新增 13（杀进程 + `-develop` 不存在）与 14（默认不代点）。
- **verified-notes 新增 `[ingame]`**（12 节）：`-develop` 不存在、热载真路径、文档化开局参数、
  存档会被覆盖的清单与 `pdx_settings` 实际值、右键菜单 1.21 观察、规则面板过滤器、校验码用途。
- **未改 `lib/`**，关开 bundle 即可；四个 mod 仓库本轮不动。

### 0.3.0（2026-11-18）— 迁移到 CK3 1.21.0 "Florin"

- **触发**：游戏 2026-11-18 升到 **1.21.0 "Florin"**（2026-11-17 与 Silk & Silver 同日发布），
  整个知识层与 persona 还停在 1.20.1.2。
- **勘察**：Wiki 8306 页 / 494 条目；Category:Modding 67 页、Category:1.21 75 页（其中只有
  `Console commands` 一个 Modding 页）、新增 Patch 1.21；1.21 新机制页 11 个（Market / Districts / Merchant…）。
- **atlas 生成器**：`GAME_VERSION` → 1.21.0、新增 `VALIDITY_CATEGORY`、新增 `new121`（11 页）与
  `mech`（25 页）两桶、补丁链加 Patch 1.21、缺失页面跳过并告警；`--check` 契约不变。
- **verified-notes**：7 节按 1.21 逐条复核并更新行号，新增 `[district]` `[trade]` `[road]` `[laws]`
  四节（共 11 节），顶部加「1.21 改名与 patch note 落差」表（`monthly_tax` 0 处、`add_regular_district`
  0 调用、`scheme_discovery_chance_mult` 仍在等）。
- **SKILL.md 0.3.0**：新增「1.21 变化（大版本迁移必读）」；路由表加 district / trade / road / laws 四行；
  硬规则 9 改写（`scripted_tests` 仍无无人值守入口，附 1.21 复测证据）、新增 12（spline 副本坑）。
- **persona**：版本、四个 mod 的 `supported_version` 事实、1.21 六条要命改动、层 2 优先纪律。
- **实测**：`check --all` 4/4 PASS（loc 94/122/84/36）；空播放集无头 26.5 s 到 history 后自行退出、
  1.20 的「到 history 必崩」未复现；`-automated_test` / `-run_console_action` 复测结论见 §10。
- **未改 `lib/`**，不需要重启 DSH；只改了值 + 知识层，关开 bundle 即可生效。

### 仓库整理（2026-11-17）— 知识层入库

- `skills/ck3-modding/` 入库：SKILL.md + `references/verified-notes.md` + `references/ck3-wiki-atlas.md`
  + `scripts/wiki-atlas.mjs`（skill 0.2.4，与本地部署副本逐文件哈希一致）。
- 新增 `工具-同步技能.mjs`：仓库 → `~\.agents\skills` 单向同步，`--check` 比哈希报漂移。
- README §8 改写（源/部署两层）、已知限制与 `package.json` 的 `files` 同步；插件运行时未变，版本仍 0.2.0。

### 0.2.0（2026-11-17）— Wiki 知识层

- 全站勘察 CK3 Wiki（7964 页 / 491 条目）：Category:Modding 67 页、Category:1.20 84 页、
  1.19/1.20 补丁链；生成本地索引 `ck3-wiki-atlas.md` 与生成器 `wiki-atlas.mjs`（带 `--check`）。
- persona 重写：版本更正为 **1.20.1.2 "Crozier"**、四个 mod 版本、三层查证纪律、手动调试闭环；
  验证层从六层扩到七层（新增「控制台 run 脚本」）。
- 预设 `description` / locale / `package.json` meta 同步；**未改 `lib/`，不需要重启 DSH**。
- skill 同步升到 0.2.0：新增「Wiki 路由表」「覆盖与兼容」「手动调试闭环」；硬规则 9 改成
  「自动入口仍未证实，但控制台 run 脚本是可重复的手动路径」。

### 0.1.0（2026-10-26）— 首个版本

- 预设 + 8 个 `ck3mod_*` 工具（校验/生成/部署/无头冒烟/日志/原版检索/工坊预检），70 个单测全绿。
