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
& $node scripts/fetch-details.mjs   # 16 个核心项目详情 → public/data/details.json
```

抓取要点见 `scripts/fetch-data.mjs` 顶部注释（伪静态分页、tid 筛选无效、目录归属判定）。

## 架构要点

| 文件 | 作用 |
|---|---|
| `src/router.js` | 极简 hash 路由。**不用 History API**——`file://` 下 pushState 会 404 |
| `src/data.js` | 数据层，全部同步读已打包的 JSON。`esc()` 负责 HTML 转义 |
| `src/components/ui.js` | `categoryPattern()` 为十大门类各生成一套 SVG 几何纹样（零图片请求） |
| `src/sim/*.js` | 三个 Canvas 模拟器，无任何图形库，全部手绘 |

**设计原则：零外部请求**。底纹、噪点、纹样、木纹、丝线光泽全部程序化生成，
不引用任何图片或网络字体，确保离线可用（呼应经验文档「答辩不依赖在线服务」）。
