# 开发环境备忘

> 本文件是团队内部的环境踩坑记录，**不随作品提交**（提交包只含 `dist/`、`README.md` 与源码）。
> 因此这里只记录相对路径与配置方式，不含任何个人目录信息。

## 📌 当前进度与后续任务（2026-10-16 更新）

> 这一节是**交接用**的：谁接手都能从这里知道做到哪了、下一步干什么、哪些坑已经踩过。
> 初赛截止 **2026-11-14 22:00**（剩 29 天）；报名通道 **2026-11-10** 关闭（剩 25 天，
> 要先完成报名，别只顾做作品）。

### 已完成

| 项 | 状态 |
|---|---|
| 名录数据 | 3,614 条记录、33 个省级区、10 个门类、5 个批次，全部来自官网公开接口 |
| **详情正文** | **3,614 / 3,614 = 100%**，合计 249 万字（均 689 字/条），抓取零失败 |
| **传承人档案** | **4,032 条记录（去重 3,985 人）**，覆盖 2,542 个项目；官方公布 3,998 位，数量级吻合 |
| 页面 | 首页 / 名录 / 传承人（名录＋档案）/ 项目档案 / 技艺体验 / 关于，共 9 条路由 |
| 三个模拟器 | 苏绣、宣纸、榫卯，纯手写 Canvas，无任何图形库 |
| 设计系统 | 「纸·墨·朱·金」全手写 CSS，无预设样式库 |
| 适配 | 5 规格 × 7 页面 = 35 组合零横向溢出；移动端 28 项真实触摸回归全过 |
| 构建 | 首屏 `dist/index.html` **1.66 MB** + 19 个详情分片，`file://` 双击即开 |
| 「看起来重复」的呈现 | 卡片改用市县、加「同项目 N 处申报」徽标、详情页说明共用简介来源（见下节） |
| 测试 | 6 个脚本全绿（27 + 28 + 泄漏 0 次/秒 + 35 + 检索 + 敏感信息扫描） |

### 详情页全量补录：已完成（100%）

2026-10-16 跑完 `fetch-all-details.mjs`：新增 3,414 条、**失败 0 条**、用时 20 分钟。

```
名录 3,614 条 / 有详情 3,614 条（100.0%）/ 有正文 3,614 条
正文合计 2,491,194 字（均 689 字，最短 153、最长 2,382）
传承人 4,032 条记录、去重 3,985 人、覆盖 2,542 个项目
```

早先的真相得到确认：**不是官网没内容，是早期脚本从没请求过那些页面**。
3,414 条零失败，说明名录里每一条在官网上都有正文。

> ✅ **那句错话已经改掉了。** `src/pages/Project.js` 原写着
> 「不是抓取遗漏，而是官方公开页面本身没有可转录的正文」——那是只抓了 151 个项目时
> 写下的，与事实相反。现在按 `detail.noDetail` 区分两种「没有正文」：
> 分片没加载出来（故障，提示刷新）vs 记录在但官网确实没正文（陈述覆盖率）。
> 数字全部从数据派生。
>
> ✅ **「传承人空缺不是抓取遗漏」这句也重新核实过**：逐页抓了批次 1 / 4 / 5 的原文对照，
> 官网表格里那些格子确实是空的（例如 `12211` 芮时龙有编号 `05-1992` 但出生日期栏空白），
> 不是解析漏了。但空缺**不止第五批**：第五批 259 位整体两栏全空，其余批次也有部分行留空
> （第四批 345 位全部缺出生日期）。About 页原来只说第五批，现已改为按批次现算。

```powershell
& $node scripts/fetch-all-details.mjs              # 全量补录（已完成，重跑只补缺的）
& $node scripts/fetch-all-details.mjs --refetch    # 忽略已有，全部重抓
& $node scripts/split-details.mjs                  # 切片（predev / prebuild 会自动跑）
& $node scripts/coverage-report.mjs                # 离线看覆盖率与体积（不联网）
```

### 体积：方案 B 已实施（详情分片按需加载）

早先的估计是「全内联约 13.3 MB」。实际全量后 `details.json` 是 **9.61 MB**
（3,614 条，单条均 2.72 KB）。已按 **方案 B** 落地：

| 产物 | 体积 | 何时加载 |
|---|---|---|
| `dist/index.html` | **1.66 MB** | 首屏。内联 JS / CSS / 名录 / 统计口径 / 覆盖率索引 / 策展名单 / 共用简介与多申报对照表 |
| `dist/data/detail-0..18.js` | 9.62 MB（19 片 × 200 条） | 打开某个项目时**只注入它所在的那一片**（约 500 KB） |
| `dist/data/inheritors.js` | 1.57 MB | 只在传承人页加载 |

首屏因此**恒定 1.66 MB，与补录进度无关**——这是选 B 的核心理由，也是
`coverage-report.mjs` 现在把「首屏」与「分片」分开报的原因。

> ⚠️ **首屏体积必须「量」不要「估」。** `coverage-report.mjs` 早先写的是
> `projects.json + meta + 固定 1.3 MB`，那个常数按未压缩源码拍的；换压缩构建后
> 产物实际 1.66 MB，估算却仍报 **2.75 MB**，凭空多出一兆多。
> 现在 `dist/index.html` 存在就直读，没构建过才退回报「内联数据下界」。
> 报告里的数字一旦和产物对不上，就会变成没人敢信的装饰。

选 B 的依据（**不要改回去**）：`file://` 下 Chrome 禁止的是 `type="module"` 与 `fetch`，
**普通 `<script src>` 仍然可用**。所以分片写成「向 `window.__JZ_DETAILS__` 挂数据」的普通脚本，
「双击即开」保住了，代价只是不再「单文件」——而作品本来就以压缩包交付，
多一个数据目录不增加任何操作成本。

分片由 `scripts/split-details.mjs` 生成，`package.json` 的 `predev` / `prebuild` 会自动跑。

> ⚠️ **`vite.config.js` 的 build-single-file 插件里，不能再 `rmSync(dataDir, {recursive:true})`。**
> 早期只内联 180 条详情时删掉整个 data 目录无所谓；现在删了等于把全站详情一起删掉。
> 插件现在只删「被内联的那几个 json」，并新增一条自检：分片必须真的落在产物里。
> 漏了它的症状是**首页一切正常、点进项目才空白**——靠翻首页根本发现不了。

> ⚠️ **`scripts/package.mjs` 必须连 `dist/data/` 一起搬。** 同理：只搬 `index.html` 的话
> 评委双击后首页正常、点进项目空白。包的布局是 `打开作品.html` + 旁边的 `data/`（相对路径引用，
> 两者必须相邻）；不再另存一份 `dist/index.html`，否则同样的数据在压缩包里出现两遍。

> 顺带确认：**详情页确实没有项目配图**（全量抓完图片数仍是 0），
> 所以关于页「本站不使用来源不明的网络图片」那段是准确的，**不要改**。

### 「内容有很多重复的」——不是脏数据，是呈现没交代清楚（2026-10-16 二次）

**症状**：试用时发现「苗族古歌有三四个」。

**查明**：不是抓重了。`苗族古歌` 在名录里确实是 4 条，但它们同属一个项目
（编号 `Ⅰ-001`），只是申报地区不同——贵州省台江县、贵州省黄平县、湖南省花垣县、
贵州省贵阳市清镇市。**关键是 12177（黄平县）与 12178（台江县）的正文逐字相同**：
去掉首行「申报地区或单位：…」后都是 515 字、一字不差。官网为「苗族古歌」这一个项目
只写了一份简介，各申报地区的页面都挂同一份，只在开头改一行地区名。

全量核对（3,614 条，去掉首行并忽略空白后比对）：

```
正文完全相同      200 组 / 482 条（13.3%）
全部同项目号前缀  200 / 200 组（跨项目重复 0 组）
组内条数分布      2 条一组 151 组、3 条 27 组、4 条 13 组 …… 最多 8 条（花鼓戏）
```

成因单一，所以是**呈现问题**，不是数据问题。三个修正（用户选了「轻改」档）：

1. **名录卡片地区由省级 `region` 改为市县 `unit`。** 这个修正早先只做在详情页的
   「同一项目的其他申报地区」那一节，**卡片漏了**——`ProjectCard` 用的仍是 `p.region`，
   于是台江、黄平两条渲染成两张一模一样的卡片。这是「重复」观感的直接来源。
   长申报单位（「中国社会科学院《格萨（斯）尔》办公室」）用 CSS 省略号截断，
   完整值放 `title`，避免把栅格里的卡片撑成不同高度。
2. **卡片加「同项目 N 处申报」徽标。** 计数来自构建期索引 `prefixCount`
   （只存 >1 的前缀，512 个），压在卡片图区右上角，不挤占文字行。
3. **详情页正文前加一句来源说明**（`.intro-shared`）：这份介绍是官网为项目 `Ⅰ-001`
   「苗族古歌」统一撰写的，同项目另有 N 处沿用同一份文字，本页是其中哪一处的记录。

**实现要点**：两份对照表都在 `scripts/split-details.mjs` 里算好，写进会被内联的
`detail-index.json`（`introShared` / `prefixCount`，合计约 +20 KB，索引从 29 KB 到 49 KB）。
运行时不再遍历全量数据。指纹用「去掉首行申报地区 + 去掉全部空白」——
加空白归一化后比初算多了 2 组，因为「仅空白不同」在读者眼里同样是重复。

> ⚠️ **回归脚本对第 3 点做了正反两条断言**：`#/project/12178`（台江县，与黄平县同文）
> 必须出现说明；`#/project/12179`（花垣县，官网单独撰写）必须**不出现**。
> 少了反向那条，「说明」有可能被无差别贴到所有页面上而测试照过。

> ⚠️ **`file-full-test.mjs` 的「分片按需加载」断言必须排在所有项目页之前。**
> 早期它挂在路由列表末尾，前面几次项目页访问已经注入了好几片，报出的累计值
> （414 条）分不清「本次注入一片」与「一路攒下来」——结论虽仍成立，数字却随
> 测试顺序漂移。现改为「先取基线（0 条）→ 再打开最后一条项目 → 报本次增量」，
> 稳定输出「本次注入 14 条（一片上限 200）| 累计 14/3614」。

### 首页「精选馆藏」改成显式点名

补录前 `getFeatured()` 是「有详情的项目里按插入顺序取前八」，实际取到的是
**苏绣 ×4 + 苗族古歌 ×2**——四个苏绣变体占掉一半版面，另两条还是同一项目的不同申报地区。
补录后全部记录都有详情，这个取法只会更糟。

现在名单在 `scripts/split-details.mjs` 的 `FEATURED` 里显式列出（苏绣、宣纸、香山帮、
昆曲、古琴艺术、苏州评弹、杨氏太极拳、农历二十四节气），并**按项目名与门类做校验**：
名字对不上直接报错退出，避免数据更新后 id 漂移却静默换成了别的项目。

### 后续任务（按顺序）

1. ~~跑完全量补录~~ ✅ 3,614 / 3,614，零失败
2. ~~定体积方案并实施~~ ✅ 方案 B，首屏 1.64 MB
3. ~~改掉「与事实相反」的那句~~ ✅ 在 `src/pages/Project.js`（**不在 About.js，原文记错了**），
   并把 About 页的传承人空缺说法改为按批次现算
4. ~~同步 `README.md` 的覆盖数字~~ ✅ 另含目录树、分发形态、数据加载、构建说明
5. ~~重跑全部测试 + 截图核对~~ ✅ 6 个脚本全绿，`_shots/project/` 已重拍
6. ~~更新 `file-full-test.mjs` 断点~~ ✅ 覆盖率断言改读内联索引；「分片按需加载」改为
   先取基线再测增量（22 → 27 项）；新增卡片地区、同项目徽标、共用简介说明（正反两条）
7. **提交材料** —— README 分工表还是 3 行「待填」、总包
   `零杯壹组-队伍名-队长姓名.zip`、按真实队名重跑 `scripts/package.mjs`
8. **答辩录屏** —— 3 分钟固定演示，不依赖在线服务
9. **报名** —— ⚠️ 通道 **2026-11-10** 关闭，比作品截止（11-14 22:00）早 4 天，别拖到最后

### 本次新增 / 改动的脚本

| 脚本 | 作用 |
|---|---|
| `scripts/split-details.mjs` | **新增**。详情切片：生成 `detail-N.js`、`inheritors.js`、`inheritor-stats.json`、`featured.json`、`detail-index.json`（后者另带 `introShared` 共用简介分组与 `prefixCount` 多申报计数）；`predev` / `prebuild` 自动跑 |
| `scripts/fetch-all-details.mjs` | 按 id 全量抓详情（断点续抓 / 并发 4 / 每 250 条落盘 / 紧凑 JSON） |
| `scripts/coverage-report.mjs` | **离线**覆盖率报告：覆盖率、分门类，以及**首屏 / 分片分开报**的体积 |
| `scripts/lib/parse-detail.mjs` | 详情页解析器，由 `fetch-details.mjs` 抽出，两个抓取脚本共用 |

## 运行时版本要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node | ≥ 20（实测 v24.x） | 用于构建与脚本 |
| pnpm | 11.x | 调用方式 `<node> <pnpm.mjs 所在路径> <args>` |
| Python | 3.x | 仅数据抓取脚本备用 |

各运行时按本机实际安装位置调用即可，不写死绝对路径。

控制台中文显示为 GBK 乱码，但数据本身正确（勿被乱码误导）。

## ⚠️ 沙箱限制：构建必须在放宽权限下运行

`vite build` 会通过 esbuild 以**管道 stdio** 启动子进程，而受限沙箱禁止命名管道，
稳定报 `Error: spawn EPERM`。**这不是配置错误**，不要反复重装依赖去"修"它。

解决：构建/开发命令以 `sandbox_permissions: danger-full-access` 运行一次即可。

### 另一个坑：esbuild 0.21.3 的二进制在部分环境下起不来（2026-10-16 新增）

现象是 `vite build` 报 `X [ERROR] Cannot read file "package.json": winapi error #5`，
或者直接 `fatal error: winmm.dll not found` + `runtime: panic before malloc heap initialized`。

两条原因要一起处理：

1. **vite 5 依赖的是 esbuild 0.21.3**，而这个二进制在本机（用户名含中文）起不来；
   0.25.12 与 0.28.2 都正常。注意 `node_modules/esbuild` 顶层虽然是 0.25.12，
   但 vite 是从自己的虚拟 store 里解析到 0.21.3 的，改顶层版本没用。
2. 本机沙箱会拒绝**位于工作区内**的原生二进制读取文件。实测：把同一个
   `esbuild.exe` 复制到工作区外再跑就正常，原地跑就 access denied。

处理：

- 第 1 步：把 `node_modules/.pnpm/vite@5.4.11/node_modules/esbuild` 指向
  `node_modules/.pnpm/esbuild@0.25.12/node_modules/esbuild`（目录联接 / symlink 都行）。
- 第 2 步：构建时把二进制指到工作区外的副本：
  `ESBUILD_BINARY_PATH=<工作区外的 esbuild.exe> node node_modules/vite/bin/vite.js build`

> 依赖装好后这两步都是一次性的；**换机器重装依赖后第 1 步要重做**。

## pnpm 安装踩坑记录（重要，重装时按此配置）

pnpm 11 的 hoisted 模式**不提升传递依赖**，因此必须把 Vite 整条依赖链都显式写进
`package.json`。最终可用配置：

```yaml
# pnpm-workspace.yaml
onlyBuiltDependencies:
  - esbuild

node-linker: hoisted

allowBuilds:
  esbuild: true      # 必须显式 true，不能留 pnpm 的占位字符串
```

```json
"devDependencies": {
  "vite": "^5.4.11",
  "esbuild": "0.25.12",
  "@esbuild/win32-x64": "0.25.12",
  "rollup": "^4.20.0",
  "@rollup/rollup-win32-x64-msvc": "^4.20.0",
  "postcss": "^8.4.43",
  "picocolors": "^1.1.1",
  "nanoid": "^5.0.0",
  "source-map-js": "^1.2.1"
}
```

**踩坑全记录**（避免重走，全部已实际遇到并解决）：

| # | 报错 | 原因 | 解法 |
|---|---|---|---|
| 1 | `ERR_PNPM_IGNORED_BUILDS: esbuild` | 默认不允许依赖跑构建脚本 | `onlyBuiltDependencies: [esbuild]` |
| 2 | `ERR_MODULE_NOT_FOUND: esbuild` | hoisted 模式不提升传递依赖 | `node-linker: hoisted` + 显式声明 |
| 3 | `ERR_MODULE_NOT_FOUND: rollup` | 同上 | 显式声明 `rollup` |
| 4 | `MODULE_NOT_FOUND: @rollup/rollup-win32-x64-msvc` | rollup 的原生二进制 | 显式 `pnpm add -D` |
| 5 | `The package "@esbuild/win32-x64" could not be found` | esbuild 的原生二进制也没提升 | 显式装 `@esbuild/win32-x64`，**版本必须与 esbuild 完全一致**（曾误装 0.28.2 配 0.21.3 而失败） |
| 6 | `[postcss] Cannot find module 'picocolors'` | postcss 的传递依赖 | 显式装 `picocolors` |
| 7 | `[postcss] Cannot find module 'nanoid/non-secure'` | 同上 | 显式装 `nanoid`、`source-map-js` |
| 8 | `allowBuilds: esbuild: set this to true or false` | `pnpm approve-builds` 写入的占位串，**且 pnpm 会自动重写回文件** | 手写 `allowBuilds: { esbuild: true }`；**永远不要用 `approve-builds`** |

> 教训：这个环境下遇到「找不到模块」不要怀疑代码，先看是不是 hoisted 没提升。
> pnpm 11 + hoisted + Vite 5 的组合基本要求把依赖树摊平写全。

验证：`& $node node_modules/vite/bin/vite.js --version` → `vite/5.4.11 win32-x64 node-v24.21.0`

## 构建与运行

```powershell
cd jiangzuo
& $node node_modules/vite/bin/vite.js build     # → dist/（需 danger-full-access）
& $node node_modules/vite/bin/vite.js preview   # 本地预览
```

`vite.config.js` 设 `base: './'`，因此 `dist/index.html` **可以直接双击用浏览器打开**
（`file://` 协议），便于评委离线查看——这也是路由选用 hash 模式的原因。

## 数据管道

```powershell
& $node scripts/fetch-data.mjs        # 全量项目列表 → public/data/{projects,meta}.json
& $node scripts/fetch-all-details.mjs # 【主】按 id 抓全部 3,614 条详情 → details.json
& $node scripts/split-details.mjs     # 【主】切片：detail-N.js / inheritors.js / 小索引
& $node scripts/coverage-report.mjs   # 离线核对覆盖率与体积，不联网

# 以下是「策展视角」的精选抓取，用于给指定项目补正文，不是主路径
& $node scripts/fetch-details.mjs --dry-run   # 先预演：打印关键词命中，不打官方站
& $node scripts/fetch-details.mjs             # 只抓 CORE_PROJECTS 里的关键词
```

**抓取与切片是两件事，别混**：`details.json` 是**语料**（一个 9.6 MB 的大文件），
`detail-N.js` 是**产物**（切片，给运行时用）。前者入库、后者不入库（见 `.gitignore`），
每次 `pnpm dev` / `pnpm build` 前由 `predev` / `prebuild` 从前者重新生成。
**只改语料不跑切片，页面上看不到任何变化**——这是最容易白忙一场的地方。

抓取要点见 `scripts/fetch-data.mjs` 顶部注释（伪静态分页、tid 筛选无效、目录归属判定）。

**两个抓取脚本的分工**（别再用错）：

| 脚本 | 选项目的方式 | 用途 |
|---|---|---|
| `fetch-all-details.mjs` | 按 **id** 遍历名录全部记录 | **主路径**。名录里每一条都要有正文 |
| `fetch-details.mjs` | 按 **关键词** 从 `CORE_PROJECTS` 里挑 | 精选/补抓。想给某几个项目补正文时用它 |

历史教训：`fetch-details.mjs` 是早期唯一的抓取入口，于是它那 151 个关键词
就成了全站的覆盖上限——3,464 条记录从来没被请求过，而页面上的表现
（点进去只有档案卡）看起来像「官网没有内容」，实际是抓取范围问题。
**判断覆盖率一律看 `coverage-report.mjs`，不要凭感觉。**

`fetch-details.mjs` 的关键字数组 `CORE_PROJECTS` 用「项目名称关键词 + 优先地区」定位项目，
**扩充详情页只需编辑这个数组**，不需要新写工程。两点必须注意：

1. `--dry-run` 先跑。它会打印每个关键词命中了哪些候选、以及 `prefer` 是否落空。
2. `prefer` 是**三字段联合匹配**（`province` / `unit` / `name`）。早期只匹配前两者，
   而非遗项目名常把地区写进括号——「皮影戏（华县皮影戏）」的 province 是
   「陕西省渭南市华州区」，不含「华县」二字，于是 prefer 落空并静默退化成取第一个候选，
   抓到一个语义上错误的地区版本，且从输出里完全看不出来。现已加 `preferMissed` 告警，
   一旦出现必须修正关键词或 prefer，不要带着告警抓取。

## 项目编号前缀：全站最重要的一条关联线索

官方编号形如 `Ⅶ-018_01_320500`：`Ⅶ-018` 是**项目本身**的编号（门类罗马数字 + 序号），
后面两段才是批次与地区。因此**前缀相同的记录 = 同一个项目在不同地区的申报版本**。

```js
// src/data.js
export const projectCodePrefix = no => (String(no || '').match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+-\d+)/) || [])[1] || '';
export const projectBaseName = name => String(name || '').replace(/[（(].*?[)）]\s*$/, '').trim();
```

两个用途：

1. **项目页「同一项目的其他申报地区」**（`getProjectVariants()`）。3614 条记录里
   有 2569 条与他人共享编号，分布在 512 个项目；剪纸一组最多，56 个申报地区。
   这一节是**大量无正文项目页唯一的实质内容**，不要删。
2. **关于页「为什么会有两个不同的数字」的论证**。按前缀归并 3614 条恰好得到
   **1557** 个编号，与官方公布的 1557 项完全吻合——两个数字是同一份名录的两种粒度，
   不是两套数据源。这个数字在 `About.js` 里现算，不写死。

> ⚠️ **列表里要显示 `unit`（申报地区或单位），不要显示 `region`（省级）。**
> 起因：剪纸一组的截图里出现三行一模一样的「剪纸（广东剪纸）· 广东省」，
> 看起来像复制粘贴的脏数据。一查并非重复——广东剪纸确实由佛山市、汕头市、潮州市
> 分别申报，是 `region` 只到省级把三者抹平了。`unit` 的填充率是 3614/3614。
> 实测改用 `unit` 后，全站「看起来重复」的行从 **257 行降到 1 行**；
> 剩下那一行是 Ⅸ-003 的「中药炮制技艺（人参炮制技艺）」，两条记录只差编号末尾字母
> （…220500a / …220500b），由 `Project.js` 里的 `collide` 判断补出编号来区分。
>
> ⚠️ **2026-10-16 补记：这条修正当初只做到了详情页的「其他申报地区」那一节，
> 名录卡片漏了。** `ProjectCard()` 用的仍是 `p.region`，于是「苗族古歌」台江、黄平
> 两条在列表里是两张一模一样的卡片。现已改。**凡是展示申报地区的地方，都要用 `unit`。**

> ⚠️ **不要把这一节写成「容器铺底色 + gap 1px 透出细线」那套。**
> 条目数是奇数时（很常见，比如 3 条）最后会空出一个格子，底色直接露出来变成一块色块。
> 现在改为每个 `.variant` 自己带右边框与下边框，容器只出左边框和上边框，
> 空格子没有边框也没有底色，任何条目数都不会露馅。

## 测试脚本

| 脚本 | 作用 |
|---|---|
| `scripts/file-full-test.mjs` | **最重要**。以 `file://` 走全部路由 + 真实鼠标拖拽（27 项断言）。其中「分片按需加载」先取基线再测增量，同时验证 file:// 下普通 `<script src>` 能注入、正文确实渲染、且没有把全量详情一起拉进来；「卡片地区-市县」「同项目徽标」「共用简介说明 / 独有正文无说明」四条第 2026-10-16 新增，盯住「同名记录看起来重复」这一类呈现问题 |
| `scripts/mobile-test.mjs` | 真实触摸事件回归（28 项）：三个模拟器用手指能不能做完、画布是否劫持滚动、汉堡菜单 |
| `scripts/leak-test.mjs` | 导航往返后统计残留 rAF 循环（应恒为 0 次/秒） |
| `scripts/adapt-test.cjs` | 5 规格 × 7 页面 = 35 组合的横向溢出检测 |
| `scripts/search-test.mjs` | 逐词核对检索命中数（防止同义词改坏精确词） |
| `scripts/project-shot.mjs` | 项目页截图（含「同一项目的其他申报地区」的三种形态） |
| `scripts/audit.mjs` | 五类敏感信息扫描（公开仓库前必跑） |
| `scripts/coverage-report.mjs` | 离线详情覆盖率报告（不联网、不依赖 Chrome） |

`file-full-test.mjs`、`mobile-test.mjs`、`leak-test.mjs` 都需要 **Chrome CDP**，同样受沙箱命名管道限制。
`leak-test.mjs` 的存在理由：资源泄漏在单次访问里完全看不出来——页面正常、动画正常，
只有反复进出后才会累积。修 `dispose` 相关代码后**必须**跑它。

### `mobile-test.mjs` 的三个易踩点

1. **必须用 `Input.dispatchTouchEvent`，不能用鼠标事件**。本站模拟器监听 pointer 事件，
   鼠标事件也会被 Chrome 转成 pointer，看起来「也能跑」——但那样测的是鼠标，
   不是手指。触摸路径上 `touch-action: none`、双指、click 合成规则都不一样。
2. **点按不能用拖拽函数代劳**。`click` 只在 touchStart 与 touchEnd 之间**没有移动**时
   才合成；用 `touchDrag(from, from)` 点按钮，touchMove 会把 click 吃掉，按钮看起来点不动。
   所以点按要用独立的 `tapAt()`（start → 停 60ms → end）。
3. **量 rect 之前必须先滚进视口**，且用 `elementFromPoint` 确认落点真的在目标上。
   早期版本先量 rect 再 `scrollTo(0,0)`，坐标全部错位，派发出去的触摸落在空气上，
   表现为「程序坏了」——实际是测试脚本自己在点空处。

## 页面清理契约（dispose）

`main.js` 的 `render()` 会在渲染新页面前调用上一页的清理函数。约定：

- `initHeader()` 返回清理函数（它往 window/document 上挂了 hashchange/keydown/scroll）
- 页面 `init()` 可返回清理函数，也可以什么都不返回
- 模拟器 `init*()` 返回 `{ redraw, dispose }` **对象**，由 `Simulator.js` 的 `initOne`
  适配成函数再交给 `main.js`

> ⚠️ 这个二层契约很容易被改错：如果把模拟器的返回值直接从 `initSimulator` 返回出去，
> `main.js` 拿到的是 object 而非 function，`typeof` 判断为 false，**清理会静默失效**，
> 而页面看上去一切正常。改这里之后务必跑 `leak-test.mjs`。
>
> 另：`app.innerHTML` 只替换 DOM。挂在 `window`/`document` 上的监听器与
> `requestAnimationFrame` 循环**不属于 DOM**，不会随之消失，必须显式摘除。

## 架构要点

| 文件 | 作用 |
|---|---|
| `src/router.js` | 极简 hash 路由。**不用 History API**——`file://` 下 pushState 会 404 |
| `src/data.js` | 数据层。小数据（名录、统计、覆盖率索引、策展名单）构建时内联、同步直读；项目详情与传承人索引体积大，改成**按需注入的普通脚本分片**。`esc()` 负责 HTML 转义。含同义词检索扩展与编号前缀归并 |
| `src/components/ui.js` | `categoryPattern()` 为十大门类各生成一套 SVG 几何纹样（零图片请求）。`ProjectCard()` **地区必须用 `unit` 而非 `region`**，并在 `variantCount > 1` 时压「同项目 N 处申报」徽标 |
| `src/pages/Inheritors.js` | 传承人名录页与档案页（4,032 位，可检索、可排序、可逐人翻阅） |
| `src/sim/*.js` | 三个 Canvas 模拟器，无任何图形库，全部手绘 |
| `scripts/lib/parse-detail.mjs` | 详情页解析器。由两个抓取脚本共用——**改这里的正则等于同时改两处产出，改完两边都要重跑验证** |
| `scripts/split-details.mjs` | 详情切片器。首页策展名单 `FEATURED` 也在这里，**带项目名与门类校验**（名字对不上直接报错退出） |

**设计原则：零外部请求**。底纹、噪点、纹样、木纹、丝线光泽全部程序化生成，
不引用任何图片或网络字体，确保离线可用（呼应经验文档「答辩不依赖在线服务」）。
