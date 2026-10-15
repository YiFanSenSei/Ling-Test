# 开发环境备忘

> 本文件是团队内部的环境踩坑记录，**不随作品提交**（提交包只含 `dist/`、`README.md` 与源码）。
> 因此这里只记录相对路径与配置方式，不含任何个人目录信息。

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
& $node scripts/fetch-data.mjs      # 全量项目列表 → public/data/{projects,meta}.json
& $node scripts/fetch-details.mjs --dry-run   # 先预演：打印关键词命中，不打官方站
& $node scripts/fetch-details.mjs   # 150 个项目详情 + 379 位传承人 → public/data/details.json
```

抓取要点见 `scripts/fetch-data.mjs` 顶部注释（伪静态分页、tid 筛选无效、目录归属判定）。

`fetch-details.mjs` 的关键字数组 `CORE_PROJECTS` 用「项目名称关键词 + 优先地区」定位项目，
**扩充详情页只需编辑这个数组**，不需要新写工程。两点必须注意：

1. `--dry-run` 先跑。它会打印每个关键词命中了哪些候选、以及 `prefer` 是否落空。
2. `prefer` 是**三字段联合匹配**（`province` / `unit` / `name`）。早期只匹配前两者，
   而非遗项目名常把地区写进括号——「皮影戏（华县皮影戏）」的 province 是
   「陕西省渭南市华州区」，不含「华县」二字，于是 prefer 落空并静默退化成取第一个候选，
   抓到一个语义上错误的地区版本，且从输出里完全看不出来。现已加 `preferMissed` 告警，
   一旦出现必须修正关键词或 prefer，不要带着告警抓取。

## 测试脚本

| 脚本 | 作用 |
|---|---|
| `scripts/file-full-test.mjs` | **最重要**。以 `file://` 走全部路由 + 真实鼠标拖拽（16 项断言） |
| `scripts/leak-test.mjs` | 导航往返后统计残留 rAF 循环（应恒为 0 次/秒） |
| `scripts/adapt-test.cjs` | 5 规格 × 7 页面 = 35 组合的横向溢出检测 |
| `scripts/search-test.mjs` | 逐词核对检索命中数（防止同义词改坏精确词） |
| `scripts/audit.mjs` | 五类敏感信息扫描（公开仓库前必跑） |

`file-full-test.mjs` 与 `leak-test.mjs` 都需要 **Chrome CDP**，同样受沙箱命名管道限制。
`leak-test.mjs` 的存在理由：资源泄漏在单次访问里完全看不出来——页面正常、动画正常，
只有反复进出后才会累积。修 `dispose` 相关代码后**必须**跑它。

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
| `src/data.js` | 数据层，全部同步读已打包的 JSON。`esc()` 负责 HTML 转义。含同义词检索扩展 |
| `src/components/ui.js` | `categoryPattern()` 为十大门类各生成一套 SVG 几何纹样（零图片请求） |
| `src/pages/Inheritors.js` | 传承人名录页与档案页（379 位，可检索、可排序、可逐人翻阅） |
| `src/sim/*.js` | 三个 Canvas 模拟器，无任何图形库，全部手绘 |

**设计原则：零外部请求**。底纹、噪点、纹样、木纹、丝线光泽全部程序化生成，
不引用任何图片或网络字体，确保离线可用（呼应经验文档「答辩不依赖在线服务」）。
