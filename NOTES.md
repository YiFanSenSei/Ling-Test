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
| 页面 | 首页 / 名录 / 传承人（名录＋档案）/ 项目档案 / 技艺体验 / 关于，共 9 条路由 |
| 三个模拟器 | 苏绣、宣纸、榫卯，纯手写 Canvas，无任何图形库 |
| 设计系统 | 「纸·墨·朱·金」全手写 CSS，无预设样式库 |
| 适配 | 5 规格 × 7 页面 = 35 组合零横向溢出；移动端 28 项真实触摸回归全过 |
| 构建 | 单文件 `dist/index.html` 2.1 MB，`file://` 双击即开 |
| 测试 | 6 个脚本全绿（21 + 28 + 泄漏 0 次/秒 + 35 + 检索 + 敏感信息扫描） |

### 进行中：详情页全量补录（当前覆盖率 5.0%）

**问题**：名录 3,614 条里只有 150 条点进去有正文，其余点开只有一个档案卡。

**真相（已实测核实）**：**不是官网没内容，是脚本从没请求过那些页面。**
`fetch-details.mjs` 按 `CORE_PROJECTS` 关键词只抓了 151 个「策展级」项目，
另外 3,464 条记录从未发起过 HTTP 请求。抽样 30 条（每个门类首/中/末各一条）
**30/30 都有 400–1,200 字正文**；实际试跑另 30 条同样 30/30，零失败。

> ⚠️ **站上目前有一句错话，必须处理**：`src/pages/About.js` 写着
> 「不是抓取遗漏，而是官方公开页面本身没有可转录的正文」——**这句是错的**。
> 它只对传承人表格成立（68/379 无编号、121 无出生日期确属官网第五批表格缺失），
> 对正文完全不成立。补录完成后这句自然失效；**若补录未完成就提交，
> 必须先把这句改掉**，否则是在作品里写了一句与事实相反的话。

```powershell
& $node scripts/fetch-all-details.mjs              # 全量补录，约 19 分钟
& $node scripts/fetch-all-details.mjs --limit 50   # 试跑
& $node scripts/fetch-all-details.mjs --refetch    # 忽略已有，全部重抓
& $node scripts/coverage-report.mjs                # 离线看还差多少（不联网）
```

### ⚠️ 待决：体积（补录前必须先定）

实测单条约 2.99 KB，全量录入后：

```
3,614 条 × 2.99 KB ≈ 10.5 MB 数据
        + 1.4 MB 名录 + 1.3 MB 代码
        ≈ 13.3 MB 单文件 HTML      （现在是 2.1 MB）
```

| 方案 | 首屏 | 代价 |
|---|---|---|
| **A 全内联** | 13 MB 一起加载 | 仍是单文件、双击即开；解析慢、压缩包大 |
| **B 分片按需加载**（倾向） | 仍 2.1 MB | 详情拆成约 18 个 `detail-N.js`，点进项目时注入对应分片 |
| **C 正文截断 300 字** | ≈ 4 MB | 每条留开头，尾部标「查看官网全文 ↗」 |

选 B 的依据：`file://` 下 Chrome **允许**普通 `<script src>`（只有 `type="module"` 被禁），
所以外链分片能工作。「双击即开」保住了，只是不再「单文件」——
而作品本来就以压缩包交付，多一个数据目录不增加任何操作成本。

> 顺带确认：**详情页确实没有项目配图**（试跑抓到的图片数为 0），
> 所以关于页「本站不使用来源不明的网络图片」那段是准确的，**不要改**。

### 后续任务（按顺序）

1. **跑完全量补录** —— 约 19 分钟，一条命令
2. **定体积方案**（A / B / C）—— 需要拍板，见上
3. **改掉 `About.js` 那句错话** —— 若前两步完成，就改成陈述真实覆盖率
4. **同步 `README.md` 的覆盖数字** —— 第 15 行「150 个项目」、第 38 行「只有 150 条」、
   `public/data/` 目录树、以及统计表都要跟着更新
5. **重跑全部测试 + 截图核对** —— 6 个脚本；详情变多后重点看名录分页与项目页排版
6. **更新 `file-full-test.mjs` 断点** —— 有一条断言依赖「无正文项目页」的文案
7. **提交材料** —— README 分工表、总包 `零杯壹组-队伍名-队长姓名.zip`、
   按真实队名重跑 `scripts/package.mjs`
8. **答辩录屏** —— 3 分钟固定演示，不依赖在线服务

### 本次新增的脚本

| 脚本 | 作用 |
|---|---|
| `scripts/fetch-all-details.mjs` | 按 id 全量抓详情（断点续抓 / 并发 4 / 每 250 条落盘 / 紧凑 JSON） |
| `scripts/coverage-report.mjs` | **离线**覆盖率报告：还差多少条、分门类覆盖、体积推算 |
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
& $node scripts/coverage-report.mjs   # 离线核对覆盖率与体积，不联网

# 以下是「策展视角」的精选抓取，用于给指定项目补正文，不是主路径
& $node scripts/fetch-details.mjs --dry-run   # 先预演：打印关键词命中，不打官方站
& $node scripts/fetch-details.mjs             # 只抓 CORE_PROJECTS 里的 151 个关键词
```

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

> ⚠️ **不要把这一节写成「容器铺底色 + gap 1px 透出细线」那套。**
> 条目数是奇数时（很常见，比如 3 条）最后会空出一个格子，底色直接露出来变成一块色块。
> 现在改为每个 `.variant` 自己带右边框与下边框，容器只出左边框和上边框，
> 空格子没有边框也没有底色，任何条目数都不会露馅。

## 测试脚本

| 脚本 | 作用 |
|---|---|
| `scripts/file-full-test.mjs` | **最重要**。以 `file://` 走全部路由 + 真实鼠标拖拽（21 项断言） |
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
| `src/data.js` | 数据层，全部同步读已打包的 JSON。`esc()` 负责 HTML 转义。含同义词检索扩展与编号前缀归并 |
| `src/components/ui.js` | `categoryPattern()` 为十大门类各生成一套 SVG 几何纹样（零图片请求） |
| `src/pages/Inheritors.js` | 传承人名录页与档案页（379 位，可检索、可排序、可逐人翻阅） |
| `src/sim/*.js` | 三个 Canvas 模拟器，无任何图形库，全部手绘 |
| `scripts/lib/parse-detail.mjs` | 详情页解析器。由两个抓取脚本共用——**改这里的正则等于同时改两处产出，改完两边都要重跑验证** |

**设计原则：零外部请求**。底纹、噪点、纹样、木纹、丝线光泽全部程序化生成，
不引用任何图片或网络字体，确保离线可用（呼应经验文档「答辩不依赖在线服务」）。
