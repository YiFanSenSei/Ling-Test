# 《匠作》非遗数字展馆 · 无障碍审计报告（WCAG 2.1 AA）

**审计对象**：C:\Users\你好\Documents\deepseek-harness\default-workspace\jiangzuo（含 `dist/index.html` 单文件构建产物，file:// 直接打开）  
**标准**：WCAG 2.1 Level AA（对 2.2 新增条款另有标注）  
**页面覆盖**：首页 / 名录（3614 条，筛选 + 分页）/ 项目档案 / 传承人名录（4032 人）/ 传承人档案 / 年龄结构 / 技艺体验（三个 Canvas 模拟器）/ 关于 / 404  
**审计方法**：逐行审阅源码标记（`src/**/*.js`）、逐条审阅样式（`src/styles/*.css`，含 `pages.css` 2781 行）、按 WCAG 2.1 相对亮度公式**实算全部文字/背景组合**（脚本 `_audit_contrast.py` 可复跑）、对白卡/卡片/页头的半透明底色做 alpha 合成后再算、对移动端媒体查询逐块比对命中顺序。

> **说明（诚实声明）**：本次为**静态代码级审计 + 对比度实算**，未在 NVDA / VoiceOver 上用真实浏览器走查（本会话沙箱内无法启动浏览器与屏幕阅读器）。因此下表中「焦点顺序」「实时区播报」等结论均为"由代码可确定的缺陷"；S8（200%/400% 缩放重排）等少数条目需在真机上实测复核，已在条目内注明。

---

## 一、总览

| 项目 | 结论 |
|---|---|
| 问题总数 | **34** 条（去重后） |
| 必须修（阻断/严重/重要） | **17** 条 |
| 建议优化 | **17** 条 |
| WCAG 合规状态 | **部分合规（Partial）** —— 结构语义做得相当好，但对比度、Canvas 可操作性与状态播报三处成体系地不达标 |
| 辅助技术兼容性 | **部分通过** —— 读屏能读到主要内容，但三个技艺模拟器对读屏用户完全不可用 |

### 做得好的地方（请务必保留）

- `:focus-visible` 全局焦点环已实现（`base.css:94-101`），2px 朱砂描边 + 3px offset，且 `:focus:not(:focus-visible)` 只在鼠标点击时去掉，方向正确。
- 跳转链接 `.skip-link`（`base.css:104-115` + `index.html:20`）存在且在聚焦时从屏外移入，目标 `<main id="main" tabindex="-1">`（`main.js:904`）可编程聚焦——这套是对的。
- `@media (prefers-reduced-motion: reduce)` 全局兜底（`base.css:13-20`）把 animation/transition 压到 0.01ms，覆盖面是完整的。
- 页签（`Simulator.js:39-56` + `412-420`）实现了完整的 ARIA tabs 模式：`role=tablist/tab`、`aria-selected`、`aria-controls`、roving tabindex、←→/Home/End。
- 分页省略号 `aria-hidden`、面包屑分隔符 `aria-hidden`、装饰 SVG 全部 `aria-hidden="true" focusable="false"`、`lang="zh-CN"`、每页 `document.title` 随路由更新——细节考究。
- 单页应用的路由监听器有显式清理（`main.js:895-929`），这在参赛作品里很少见。

---

## 二、对比度实测总表（先看这张）

相对亮度按 WCAG 2.1 定义计算：`L = 0.2126R + 0.7152G + 0.0722B`（R/G/B 先做 sRGB 反伽马）。正文需 **4.5:1**，≥18.66px 粗体 / ≥24px 常规文字与所有 UI 图形需 **3:1**。

### 2.1 色板两两组合（`tokens.css:16-123`）

| 背景 | 前景 | 对比度 | 判定 |
|---|---|---|---|
| 纸 `#F5F1E8` | 墨 `#1C1A17` | **15.40:1** | ✅ AAA |
| 纸 | 淡墨 `#4A453D` | **8.43:1** | ✅ AAA |
| 纸 | **灰墨 `#8A8279`** | **3.36:1** | ❌ 正文不合格（差 4.5） |
| 纸 | **极淡 `#C4BDB0`** | **1.66:1** | ❌❌ 任何字号都不合格 |
| 纸 | 朱砂 `#B23A2E` | **5.27:1** | ✅ AA |
| 纸 | 印深 `#8C2A20` | 7.55:1 | ✅ AAA |
| 纸 | **金 `#C9A961`** | **2.00:1** | ❌❌ 不可作文字 |
| 纸 | 石青 `#3A5A78` | 6.39:1 | ✅ AA |
| 纸 | 分割线 `#D9D2C4` | 1.33:1 | ❌ UI 边框不达 3:1 |
| 纸深 `#EBE5D8` | 灰墨 | **3.01:1** | ❌ |
| 纸深 | 极淡 | **1.49:1** | ❌❌ |
| 纸深 | 朱砂 | **4.73:1** | ✅ 勉强 AA |
| 纸浅 `#FBF9F3` | 灰墨 | **3.59:1** | ❌ |
| 纸浅 | 极淡 | **1.77:1** | ❌❌ |
| 墨（深色区） | 纸 | 15.40:1 | ✅ |
| 墨 | 灰墨 | 4.59:1 | ✅ 勉强 |
| 墨 | **朱砂** | **2.92:1** | ❌ 深色区禁用朱砂作文字/焦点环 |
| 墨 | 金 | 7.71:1 | ✅ AAA |
| 墨 | 石青 | 2.41:1 | ❌ 深色区禁用 |
| 朱砂底 | 纸浅（白字） | 5.64:1 | ✅ |

### 2.2 半透明合成后的真实值（页面实际取到的颜色）

| 位置 | 合成结果 | 对比度 |
|---|---|---|
| `.tag` 筛选 chip 默认：`rgba(255,255,255,.5)` + `--ink-soft` | 底 `#FAF8F3` / 字 `#4A453D` | 8.95:1 ✅ |
| `.tag`/`.page-btn` 边框 `rgba(28,26,23,.14)` / `.12` 叠在纸上 | `#D7D3CB`、`#DBD7CF` | **1.32:1 / 1.27:1** ❌ |
| `.tag-gold` 文字 `#8a6d2f`（components.css:233） | `#8A6D2F` on `#F6F1E4` | **4.32:1** ❌（12px 正文） |
| 搜索框 placeholder `--ink-ghost` | `#FAF8F3` 上 `#C4BDB0` | **1.76:1** ❌❌ |
| 深色 chip 激活态 `.tool-opt.is-active .tool-opt-desc` `#f5f1e88c` | `#1C1A17` 上 `#93908A` | 5.45:1 ✅ |
| 深色 chip 副标题若用 `.55` 不透明度 | `#93908A` | 5.45:1 ✅（.45 则降到 4.12 ❌） |
| `section-num`「壹」：朱砂 + `opacity:.25` | `#E1C4BC` 近似 | **1.45:1** ❌ |
| `.pcard-sub` 灰墨 + 卡片 | `#8A8279` on `#FBF9F3` | 3.59:1 ❌ |
| `.sim-tab-desc` 极淡 + 卡片 | `#C4BDB0` on `#FBF9F3` | **1.77:1** ❌❌ |
| `.tool-opt-desc` 极淡 + 纸 | `#C4BDB0` on `#F5F1E8` | **1.66:1** ❌❌ |
| `.age-bar-pct` 极淡 + 纸 | 1.66:1 ❌ |
| `page-btn.is-disabled` `opacity:.32` | `#4A453D`→`#C3BFB8` | **1.74:1** ❌ |
| `pager-btn:disabled` `opacity:.35` | 1.84:1 ❌ |
| `.notfound h1` 灰墨（36px 常规，属"大字"3:1） | 3.36:1 | ✅ 大字勉强 |
| `.breadcrumb` 灰墨 12px | 3.36:1 | ❌ |

**结论一句话**：`--ink-faint(#8A8279)` 在纸色上只有 **3.36:1**，**任何小于 24px 的正文用它都是不合格的**；`--ink-ghost(#C4BDB0)` 只有 **1.66:1**，**任何文字都不该用它**。

---

## 三、【必须修】问题清单

### M1 · `--ink-ghost` 被大面积用作正文文字（12–14px）
- **WCAG**：1.4.3 对比度（最低）Level AA
- **严重程度**：**严重（Critical）** —— 低视力、老年、强光环境下用户读不到任何说明文字
- **位置**（均为源码行号）：
  - `src/styles/components.css:145` `.stat-note`（首页数据看板六格的「五批累计公布」等）→ 1.66:1
  - `src/styles/components.css:161` `.pcard-sep` 分隔点
  - `src/styles/pages.css:1189` `.sim-tab-desc`（「梅花 · 莲花」等页签副标）→ 1.77:1
  - `src/styles/pages.css:1199-1200` `.tool-opt-desc`（四个针法/榫卯类型的说明）→ 1.66:1
  - `src/styles/pages.css:1469-1474` `.tool-note`（10px！工具面板里全部操作说明）→ 1.66:1
  - `src/styles/pages.css:1525-1532` `.step`（宣纸「工序」四步的未完成态）→ 1.66:1
  - `src/styles/pages.css:6290 附近` `.age-bar-pct`（年龄结构每根柱的百分比）→ 1.66:1，且 720px 以下被 `display:none` 直接删掉
  - `src/styles/pages.css` `.hero-scroll`（首页「向下」提示）→ 1.66:1
  - `src/styles/pages.css` `.about-note` / `.about-disclaimer`（`!important`）→ 1.66:1
- **实测**：`#C4BDB0` on `#F5F1E8` = **1.66:1**（需 4.5:1，差 2.7 倍）；on `#FBF9F3` = **1.77:1**
- **修复**：把"极淡"降级为**纯装饰用途**（分隔线、卡片外框），所有承载信息的文字一律上移一档到 `--ink-faint`，并把 `--ink-faint` 本身加深（见 M2）。
  ```css
  /* tokens.css —— 语义分层，别让写页面的人"顺手选最淡的那个" */
  :root {
    --ink-faint: #6B655C;   /* 正文辅助色，纸上 5.0:1 —— 新基准 */
    --ink-ghost: #C4BDB0;   /* 装饰专用：禁止用于文字，名字改成 --ink-decor 更保险 */
  }
  .stat-note, .sim-tab-desc, .tool-opt-desc, .tool-note,
  .step, .about-note, .about-disclaimer, .hero-scroll { color: var(--ink-faint); }
  ```
- **验证**：用 DevTools 拾色器确认渲染后颜色为 `#6B655C` 系；axe「color-contrast」零告警。

### M2 · `--ink-faint(#8A8279)` 用于 12–14px 正文，3.36:1
- **WCAG**：1.4.3 对比度（最低）
- **严重程度**：**严重**
- **位置与实测**：
  | 位置 | 字号 | 对比度 |
  |---|---|---|
  | `.filter-label`「门类/批次/地区」`pages.css:1024` 附近 | 14px | **3.36:1** |
  | `.breadcrumb a` `pages.css:18199` 附近 | 12px | 3.36:1 |
  | `.inh-gender` / `.inh-birth` / `.inh-meta` / `.inh-code`（传承人卡片元信息） | 12px | 3.36:1 |
  | `.grade-line`（「覆盖/针法/品级」左侧标签）`pages.css:1571-1578` | 12px | 3.36:1 |
  | `.joint-state` / `.joint-tip`（榫卯状态提示）`pages.css:1602,1624` | 12–14px | 3.36:1 |
  | `.about-table thead th`（表头） | 12px | 3.36:1 |
  | `.about-facts dt`、`.pcard-sub`、`.cat-count`、`.age-figure-label` | 12px | 3.36:1 |
  | `.hero-title-sub`「一针一线，一刀一刻」`pages.css:86-91` | clamp(17.6–25.6px) 常规 | 3.36:1（需 4.5） |
  | `.notfound p`（404 正文） | 16px | 3.36:1 |
  | `.pcard-sub` + `opacity:.8` | — | **2.64:1** |
- **修复**：
  ```css
  :root { --ink-faint: #6B655C; }        /* 纸上 5.02:1 */
  .pcard-sub { color: var(--ink-faint); } /* 去掉卡内 opacity */
  .pcard-no { opacity: 1; }               /* 12px 上再叠 opacity 是常见自杀操作 */
  ```
  若设计上必须保留"淡"的观感，可只对 **≥24px 或 ≥18.66px 粗体**的大字保留 `#8A8279`（3.36 ≥ 3:1 合规）。
- **验证**：逐条测 `.filter-label`、`.breadcrumb a`、`.grade-line` 的 `getComputedStyle` 颜色。

### M3 · 装饰性 opacity 把文字压到不可读（3 处）
- **WCAG**：1.4.3
- **严重程度**：重要（Serious）
- **位置与实测**：
  - `src/styles/layout.css:228-234` `.section-num`：`color:var(--cinnabar); opacity:0.25` → 合成 `#E2C5BB`，**1.45:1**。它虽是 `aria-hidden` 装饰，但视觉上是「壹/贰/叁/肆」章节编号，正常视力用户也在看它。
  - `src/styles/components.css:273` `.page-btn.is-disabled { opacity:0.32 }` → **1.74:1**
  - `src/styles/pages.css` `.pager-btn:disabled { opacity:.35 }` → **1.84:1**
  - `.breadcrumb span[aria-hidden]` `opacity:.45` → 1.62:1（斜杠分隔符，装饰，可不修）
- **修复**：禁用态不要用 opacity 表达，改用色值 + `aria-disabled`（见 M8）：
  ```css
  .section-num { color: var(--cinnabar); opacity: .55; }   /* 合成后 ~2.9:1，仍可辨"淡" */
  .page-btn.is-disabled, .pager-btn:disabled {
    opacity: 1; color: var(--ink-faint); background: var(--paper-deep);
    border-color: var(--ink-ghost);
  }
  ```
  注意：**禁用控件本身豁免 1.4.3**，但这里禁用态同时承担"上一页/下一页"的语义信息，且 `span.is-disabled` 根本不在可访问树里（M8），所以按可读信息处理。

### M4 · 12 项 UI 元素边界对比度 1.27–1.77:1，不达 3:1
- **WCAG**：1.4.11 非文本对比度 Level AA
- **严重程度**：重要（Serious）—— 低视力用户"看不出这里可以点"，看不清输入框边界
- **位置与实测**：
  | 元素 | 当前 | 实测 |
  |---|---|---|
  | `.tag` 筛选 chip 边框 `rgba(28,26,23,.14)` | `components.css:225` | **1.32:1** |
  | `.page-btn` 分页按钮边框 `.12` | `components.css:261` | **1.27:1** |
  | `.filter-search input` 边框 `--rule #D9D2C4` | `components.css:360` | **1.33:1** |
  | `.tool-opt` / `.thread` / `.tool-chip` 边框 `--rule` | `pages.css` | 1.33:1 |
  | `.btn-ghost` 描边 `rgba(28,26,23,.2)` | `components.css:43` 附近 | **1.51:1** |
  | `.inh-avatar` / `.inh-hero-avatar` 边框 `--rule` | — | 1.43:1 |
  | 搜索框 placeholder | 1.76:1 | ❌ |
- **修复**：
  ```css
  :root { --rule-strong: #8F8878; }        /* 纸上 3.1:1，专给"可交互元素边界" */
  .tag, .tag-btn, .page-btn, .tool-opt, .thread, .tool-chip,
  .filter-search input, .btn-ghost { border-color: var(--rule-strong); }
  .filter-search input::placeholder { color: var(--ink-faint); }  /* 从 1.76 → 5.0 */
  ```
  保留 `--rule #D9D2C4` 用于纯装饰分割线（分割线不受 1.4.11 约束）。

### M5 · 三个 Canvas 模拟器对键盘用户完全不可操作
- **WCAG**：**2.1.1 键盘 Level A**（阻断级）；另及 4.1.2 名称/角色/值
- **严重程度**：**严重（Critical）** —— 键盘/开关设备用户无法完成"技艺体验"这一核心功能
- **位置**：
  - `src/pages/Simulator.js:77-78` `<canvas id="canvas-embroidery" width="900" height="640" aria-label="苏绣刺绣画布，用鼠标拖动即可绣制"></canvas>`
  - `src/pages/Simulator.js:208-209` `<canvas id="canvas-paper" … aria-label="宣纸抄造画布，拖动纸帘捞取纸浆">`
  - `src/pages/Simulator.js:298-299` `<canvas id="canvas-mortise" … aria-label="榫卯拼合画布，拖动木件沿轴向推入卯眼，拖动空白处旋转视角">`
- **实测**：三个 canvas 均**无 `tabindex`、无 `role`、无键盘事件绑定**（`src/sim/embroidery.js`、`paper.js`、`mortise.js` 中只有 pointer/mouse/touch 监听）。纯键盘走查：Tab 键在画布上直接跳过，落针、荡帘、推进三项操作均**无法完成**。
- **修复**（推荐"键盘等价控件"，比给 canvas 加 `tabindex` 更可靠）：
  ```html
  <!-- 1) canvas 本身不进入 Tab 序，也不承担角色 -->
  <canvas id="canvas-embroidery" width="900" height="640"
          role="img" aria-label="苏绣刺绣画布"></canvas>

  <!-- 2) 画布下方放一个可聚焦的"操作代理"，用方向键落针 -->
  <div class="sim-kbd-ctrl" role="group" aria-describedby="emb-kbd-help">
    <p id="emb-kbd-help" class="tool-note">
      键盘操作：方向键移动落针位置，空格落针，退格撤销。
    </p>
    <button type="button" class="btn btn-ghost btn-sm" id="emb-stitch-btn">在当前格落一针</button>
    <output id="emb-cursor" aria-live="polite">当前格：第 1 行第 1 列</output>
  </div>
  ```
  JS 侧（`embroidery.js`）复用现成的落针函数，把"拖动"折算为"移动光标 + 落针"：
  ```js
  wrap.addEventListener('keydown', e => {
    const d = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] }[e.key];
    if (d) { e.preventDefault(); moveCursor(d[0], d[1]); }
    if (e.key === ' ') { e.preventDefault(); stitchAtCursor(); }
  });
  ```
  宣纸：「←/→ 荡帘，空格提帘」；榫卯：「↑/↓ 轴向推进退出，←/→ 旋转视角，Enter 咬合」。
- **验证**：拔掉鼠标，纯 Tab + 方向键 + 空格走完三个模拟器，均能产生作品并可「保存」。

### M6 · 三个模拟器全站无 `aria-live`，操作结果不播报
- **WCAG**：**4.1.3 状态消息 Level AA**（另及 1.3.1）
- **严重程度**：**严重（Critical）** —— 读屏用户即使勉强操作，也听不到"绣了几针""插入多深""是否咬合"
- **位置**：
  - `src/pages/Simulator.js:166-168` `<p class="tool-stat">已绣 <strong id="stitch-count">0</strong> <span id="stitch-unit">格</span></p>`
  - `src/pages/Simulator.js:151-154` `#emb-progress-bar`（`role=progressbar`，`aria-valuenow` 由 `embroidery.js:634` 更新）
  - `src/pages/Simulator.js:352-355` `#joint-progress-bar`
  - `src/pages/Simulator.js:155-157` `#emb-covered` / `#emb-stitchfit` / `#emb-rank`
  - `src/pages/Simulator.js:253-258`（宣纸「匀度/厚度/品级」）、`345-348`（榫卯 `joint-state` / `joint-tip`）
- **实测**：`grep -c 'aria-live|role="alert"' src/**/*.js` → **0**。`progressbar` 的 `aria-valuenow` 变化**不会**被读屏自动播报（value 变更只在聚焦到该 element 时才可轮询），且这些 `div` 不可聚焦、不在 Tab 序里。
- **修复**：
  ```html
  <!-- 进度条补全名称，并把数值变成可播报的实时区 -->
  <div class="progress-bar" id="emb-progress-bar" role="progressbar"
       aria-label="苏绣覆盖进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
    <span id="emb-progress" style="width:0%"></span>
  </div>

  <!-- 独立的礼貌实时区，只在"阶段性变化"时写，避免每针都吵 -->
  <p class="sr-only" id="emb-live" aria-live="polite" aria-atomic="true"></p>
  ```
  ```js
  // embroidery.js —— 每 5 针 / 品级变化时播报，不要每针都 push
  let lastSpoken = { done: -1, rank: '' };
  function speak(force) {
    const done = filled.size;
    const rank = rankEl?.textContent || '';
    if (!force && done - lastSpoken.done < 5 && rank === lastSpoken.rank) return;
    lastSpoken = { done, rank };
    live.textContent = `已绣 ${done} / ${targetCount} 格，品级：${rank}。`;
  }
  ```
  榫卯同理：`joint-state` 改为 `<p class="joint-state" id="joint-state" role="status">`，「未插入/接近/已咬合」变化即播报；宣纸在「出水」阶段完成时播报一次工序结果。

### M7 · 名录筛选 chip 的选中态对读屏用户不可见
- **WCAG**：**1.3.1 信息与关系** + **4.1.2 名称/角色/值** Level A
- **严重程度**：重要（Serious）
- **位置**：`src/pages/Gallery.js:113-117`（门类）、`124-128`（批次）、`136-143`（地区）—— 全部是 `<a class="tag tag-btn is-active">…</a>`，选中态**只有 CSS 类 `is-active`**，无 `aria-current` / `aria-pressed`。
- **实测**：读屏只报"链接 传统技艺"，不报"已选中"。用户无法知道当前筛的是哪一类。
- **修复**（保持 `<a>` 语义最省事，筛选本质是"导航到某组结果"）：
  ```html
  <a class="tag tag-btn is-active" aria-current="true"
     href="#…">传统技艺</a>
  ```
  ```css
  .tag-btn[aria-current="true"] {
    background: var(--cinnabar); color: var(--paper-light);
    border-color: var(--cinnabar);
  }
  ```
  同时给三个 `.filter-chips` 分组补上可访问名称（现在三组 chip 读起来都是"全部/传统技艺/…"的平铺链接，缺少分组语境）：
  ```html
  <div class="filter-chips" role="group" aria-labelledby="flt-category">
  <span class="filter-label" id="flt-category">门类</span>
  ```

### M8 · 分页「上一页/下一页」在首末页变成不可聚焦的 `span`
- **WCAG**：**1.3.1** + **4.1.2**（角色丢失）；**3.3.2**（状态不明确）
- **严重程度**：重要（Serious）
- **位置**：`src/components/ui.js:148` 与 `:157`
  ```js
  ${page > 1 ? btn(page-1, '上一页', 'page-prev') : '<span class="page-btn is-disabled">上一页</span>'}
  ```
- **实测**：`span` 无 `role`、无 `aria-disabled`、不可聚焦、不进可访问树。读屏用户在最后一页 Tab 时，「下一页」**凭空消失**，无法得知"已经到头了"（对比：`.pager-btn:disabled` 在传承人名录里是真 `<button disabled>`，那处是对的）。
- **修复**：
  ```js
  const dis = (label) =>
    `<span class="page-btn is-disabled" role="link" aria-disabled="true">${label}</span>`;
  ```
  或更稳妥——始终渲染 `<a>`，用 `aria-disabled="true"` + 拦截 click：
  ```js
  `<a class="page-btn is-disabled" aria-disabled="true" tabindex="-1" href="${q(page)}">上一页</a>`
  ```
- **验证**：VoiceOver 在第 1 页应读出「上一页，变暗的链接」。

### M9 · 项目卡片 `aria-label` 覆盖全部卡内文本
- **WCAG**：**2.4.4 链接用途** + **1.3.1**
- **严重程度**：重要（Serious）
- **位置**：`src/components/ui.js:92`
  ```js
  <a class="pcard" href="#/project/${esc(p.id)}" aria-label="${esc(p.name)}">
  ```
- **实测**：`aria-label` 会**替换**元素内的可访问名，读屏对整张卡只念一个项目名。卡内 `<h3 class="pcard-name">`（:94）、门类、申报地区、批次、项目编号（:101-111）全部不可达；且同名项目（如「苗族古歌」两个申报地区）在读屏里**完全无法区分**。
- **修复**：删掉 `aria-label`，让可访问名由内容计算；额外信息用 `aria-describedby` 或 `.sr-only` 补充：
  ```js
  <a class="pcard" href="#/project/${esc(p.id)}">
    <div class="pcard-media" aria-hidden="true">…</div>
    <div class="pcard-body">
      <h3 class="pcard-name">${esc(p.name)}</h3>
      <p class="pcard-meta">…</p>
      <p class="pcard-sub">…</p>
    </div>
  </a>
  ```
  若担心念得太长，把 `<h3>` 换成普通 `<span class="pcard-name">`（列表里 h3 带来的"标题跳转"收益不大），读屏会一次读完"苗族古歌 民间文学 贵州省台江县 第一批 …"，这是**更有用**的行为。

### M10 · 移动端抽屉导航没有焦点管理
- **WCAG**：**2.4.3 焦点顺序** + **2.1.2 无键盘陷阱**（反向：焦点逃逸）
- **严重程度**：重要（Serious）
- **位置**：`src/components/Header.js:42-45`（toggle）、`50-59`（`#site-nav-drawer`）、`95-127`（`initHeader` 的抽屉逻辑）
- **实测**：`onToggle` 只切 `aria-expanded` 与 `hidden`（:104-106），**不把焦点移入抽屉、不限制焦点、抽屉无 `role="dialog"`/`aria-modal`**。打开后按 Tab，焦点会跑到抽屉**后方**的主内容里去，而抽屉正覆盖在页面上（`body.nav-open`）。关闭后（:816-819）只在 Esc 时有 `toggle.focus()`；**点击链接后 `closeDrawer()` 不还焦点**，而路由重渲染（`main.js:902` `app.innerHTML = …`）会把焦点丢回 `<body>`。
- **修复**：
  ```js
  const FOCUSABLE = 'a[href], button:not([disabled])';
  const onToggle = () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    drawer.hidden = open;
    document.body.classList.toggle('nav-open', !open);
    if (!open) drawer.querySelector(FOCUSABLE)?.focus();   // 打开 → 焦点进抽屉
    else toggle.focus();                                    // 关闭 → 焦点回来
  };
  // 抽屉内 Tab 循环
  drawer.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...drawer.querySelectorAll(FOCUSABLE)];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  ```
  另：`main.js:902` 的 `render()` 在路由切换后应把焦点移到 `<main>`：
  ```js
  document.getElementById('main')?.focus({ preventScroll: true });
  ```
  —— 这样抽屉链接点击后、或分页/筛选导致重渲染后，读屏都能从"页面开头"重新开始，而不是回到 `<body>` 顶端乱序朗读。

### M11 · 路由切换后不播报，焦点丢失
- **WCAG**：**2.4.3 焦点顺序**（单页应用等效条款）；**4.1.3**（页面切换通知）
- **严重程度**：重要（Serious）
- **位置**：`src/main.js:895-929` `render()`
- **实测**：`render()` 更新 `document.title`（:925），但**不移动焦点、无实时区播报**。筛选 chip、分页、搜索防抖（`Gallery.js:258` `navigate(...)`）都走这条路径 → 读屏用户点一次筛选，页面内容变了，光标和虚拟光标都停在原处，**毫无反馈**。视障用户会以为"没点动"。
- **修复**：`render()` 末尾加一段：
  ```js
  const main = document.getElementById('main');
  main.tabIndex = -1;
  main.focus({ preventScroll: true });          // 焦点回主区
  // 或：顶部放一个 role="status" 的页面标题播报区
  ```
  若不想每次抢焦点（会影响鼠标用户体验），用 `aria-live` 播报新页面标题：
  ```html
  <p class="sr-only" role="status" id="route-status"></p>
  ```
  ```js
  document.getElementById('route-status').textContent = `${document.title}，已载入`;
  ```

### M12 · 名录结果条无实时区，筛选后"共 N 条结果"不播报
- **WCAG**：4.1.3 状态消息
- **严重程度**：中等→重要
- **位置**：`src/pages/Gallery.js:193-200` `<div class="result-bar"><p class="result-count">共 <strong>N</strong> 条结果…`
- **实测**：视觉上结果数一直在变，读屏静默。
- **修复**：
  ```html
  <div class="result-bar">
    <p class="result-count" role="status" aria-live="polite" aria-atomic="true">
      共 <strong>${num(result.total)}</strong> 条结果${hasFilter ? '（已筛选）' : ''}
    </p>
  ```
  注意：若同时实施 M11 的"焦点回主区"，两者不冲突，只会播报一次。

### M13 · tabpanel 未设 `tabindex="0"`，Tab 键会跳过面板内容
- **WCAG**：**2.1.1 键盘**（Tab 序中内容不可达）+ **1.3.1**；另对照 ARIA Authoring Practices 的 Tabs 模式
- **严重程度**：中等
- **位置**：`src/pages/Simulator.js:65`（`#panel-embroidery`）、`:196`（`#panel-paper`）、`:286`（`#panel-mortise`）——三个 `<div … role="tabpanel" aria-labelledby="…">` **均无 `tabindex`**；切换逻辑 `:400-404` 只控制 `hidden`。
- **实测**：页签只把 keydown 绑在 tab 元素上（`:412`），面板本身不可聚焦。当面板内的第一个可聚焦元素之前有大量非交互内容（`.sim-intro` 正文、`knowledge-item` 段落、`step-list`）时，键盘用户按 Tab 会**直接跳到面板里的第一个控件**（例如「图纸」组的第一个按钮），中间的说明文字完全无法通过键盘滚动/聚焦到达；VoiceOver 的 Safari 浏览模式下 `role=tabpanel` 也不产生可停靠区域。ARIA APG 明确要求：面板内容若含不可聚焦内容，面板必须 `tabindex="0"`。
- **次要观察**：首屏 `.sim-panel` 渲染时**未带 `hidden`**（`:65`），仅靠 `is-active` 类区分；`activate()`（`:400-404`）会在首次切页签时补上正确状态，因此这不是持续缺陷，但建议首屏就把另外两个 panel 标为 `hidden`，避免"JS 未跑时三个模拟器全部堆叠显示"的降级态。
- **修复**：
  ```html
  <div class="sim-panel is-active" id="panel-embroidery"
       role="tabpanel" aria-labelledby="tab-embroidery" tabindex="0">
  ```
  ```css
  .sim-panel[hidden] { display: none !important; }
  ```

### M14 · 模拟器页无 h1，且工具组与知识区标题同级
- **WCAG**：**1.3.1 信息与关系**（标题结构）；2.4.6 标题和标签（Level AA）
- **严重程度**：中等
- **位置**：`src/pages/Simulator.js:27`（SectionTitle「技艺体验」→ h2）、`:67`（`<h2>苏绣 · 按图落针</h2>`）、`:87`/`:99`/`:122`（`.tool-title` h3）、`:173`（`<h3>关于苏绣</h3>`）、`:176`/`:180`/`:184`/`:188`（`.knowledge-item` h4）；宣纸 `:198`/`:266`、榫卯 `:288`/`:364` 同理。
- **实测**：模拟器页的标题序列（按源码实际出现顺序）是：

  ```
  h2  技艺体验            Simulator.js:27  (SectionTitle, 页面唯一标题)
  h2  苏绣 · 按图落针      Simulator.js:67
  h3  图纸 / 针法 / 配色   Simulator.js:87 / :99 / :122 …
  h3  关于苏绣            Simulator.js:173
  h4  八字诀 / 劈丝 / 盘金面绣 / 针法体系   Simulator.js:176 / :180 / :184 / :188
  ```

  两处问题：① **页面没有 h1**（首页 `.hero-title` 是唯一 h1），读屏的"按标题导航"列表里第一个就是 h2，无法定位页面主题；② 「苏绣 · 按图落针」（模拟器标题）与「技艺体验」（页面标题）**同为 h2**，而工具组与知识区又**同为 h3**，层级无法表达"模拟器 > 工具组 / 知识区"的从属关系，读屏用户用标题快跳时会在两个并行的 h3 组之间来回困惑。宣纸（`:198`/`:266`）、榫卯（`:288`/`:364`）同理。
- **修复**：把 `SectionTitle` 在**所有非首页页面**升为 h1（`SectionTitle` 已支持 `level` 参数，见 `ui.js:128`），工具组与知识区同为 h3 则是**正确的**（它们确实同属模拟器 h2 之下），只要模拟器标题降为 h2、页面标题升为 h1，层级即自洽：
  ```js
  // 所有页面（Home 除外）
  SectionTitle({ num: '肆', title: '技艺体验', level: 1 })
  // Simulator.js:67 保持不变（h2），:87/:99/:122 工具组与 :173 知识区同为 h3
  ```
  ⚠️ 注意 `pages.css` 里 `.section-title h2`、`h1.section-title` 之类的选择器需同步补上 `h1` 分支，或用 `.section-title > :first-child` 这类与标签名无关的写法，避免升标签后样式丢失。

### M15 · 全站正文链接仅靠颜色区分（无下划线）
- **WCAG**：**1.4.1 使用颜色** Level A
- **严重程度**：中等
- **位置**：`src/styles/base.css:74-80`
  ```css
  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--cinnabar); }
  ```
- **实测**：在正文段落里，链接与周围文字**同色**（都是 `--ink`/`--ink-soft`），只在 hover 时变朱砂。脱色（灰度打印）后完全无法区分。以下位置是正文内联链接：
  - `src/pages/About.js:96`「中国非物质文化遗产网 · 中国非物质文化遗产数字博物馆 ↗」
  - `src/pages/Project.js:174-175`「中国非物质文化遗产网原文 ↗」
  - `src/pages/About.js:87`「苏绣的针法」
- **修复**：给正文链接加"非颜色的第二线索"：
  ```css
  .about-block p a, .project-text a, .intro-shared a {
    color: var(--azurite);
    text-decoration: underline;
    text-underline-offset: .22em;
    text-decoration-color: var(--azurite-soft);
  }
  .about-block p a:hover { text-decoration-color: currentColor; }
  ```
  （区块内链接 `About.js:87` 若已是 `.about-block a`，上面规则即可覆盖。）

### M16 · 触屏目标小于 44×44（部分低于 24×24）
- **WCAG**：**2.5.5 目标尺寸（增强）AAA**；WCAG 2.2 **2.5.8 目标尺寸（最低）AA**（24×24）
- **严重程度**：中等（按 2.1 标准属 AAA，但移动端可用性影响真实）
- **位置与实测**（`src/styles/components.css` / `pages.css`）：
  | 元素 | 尺寸 | 结论 |
  |---|---|---|
  | `.tag-btn` 筛选 chip | `padding .25em .7em` + 12px 字 → 约 **26×24px** | 低于 44，勉强过 24 |
  | `.page-btn` 分页 | **36×36** | 低于 44 |
  | `.pager-btn` 传承人分页 | 40×38（`pages.css`） | 低于 44 |
  | `.thread` 丝线按钮 | 6px 8px 内边距 + 10px 字 → 约 **30×24** | 低于 44 |
  | `.tool-chip` 图纸/视角 | 6px 14px → 约 **32×26** | 低于 44 |
  | `.nav-toggle` 汉堡按钮 | **40×40** | 低于 44 |
  | `.toc-link` 关于页目录 | `padding:5px 0` → 高 ~28 | 低于 44 |
  | `.filter-more` 展开全部 | 未设最小高度 | 需实测 |
- **已做对的地方**：`@media (pointer:coarse)` 已把 `.nav-toggle`→44×44、`.tool-opt`→44、`.sim-tab`→56、`.tag-btn`→40、`.pager-btn`→44、`.thread`→44、`.tool-chip`→44、`.toc-link`→44。**但 `.tag-btn` 只做到 40，`.page-btn` 根本没在此块里**，且 `pointer:coarse` 对"触摸屏笔记本"不生效。
- **修复**：
  ```css
  @media (pointer: coarse), (any-pointer: coarse) {
    .tag-btn { min-height: 44px; padding-block: 10px; }
    .page-btn { min-width: 44px; min-height: 44px; }
    .nav-toggle { width: 44px; height: 44px; }
    .thread { min-height: 44px; }
    .tool-chip { min-height: 44px; }
  }
  ```
  并建议把 `min-height:44px` 直接写进基样式（桌面端大目标同样更好用）。

### M17 · 深色区里的朱砂/石青文字对比度不足
- **WCAG**：1.4.3 / 1.4.11
- **严重程度**：中等
- **位置**：`src/pages/Home.js:213` `.section-dark`（技艺体验推广区）、`:268` `.closing`
- **实测**：`--cinnabar #B23A2E` on `--ink #1C1A17` = **2.92:1**；`--azurite` on ink = 2.41:1。深色区里 `.sim-promo-eyebrow`、`.sim-promo-tag` 等若用朱砂/石青则不合格。**同时**：全局 `:focus-visible { outline: 2px solid var(--cinnabar) }` 在深色区上的焦点环只有 **2.92:1**，低于 1.4.11 要求的 3:1——深色区的「开始体验」「走进名录」按钮键盘聚焦时焦点环几乎看不见。
- **修复**：
  ```css
  .section-dark, .closing {
    --cinnabar: #D9695C;   /* 深底上的朱砂，对比 4.6:1 */
    --azurite: #9DB8CF;
  }
  .section-dark :focus-visible, .closing :focus-visible {
    outline-color: var(--paper);   /* 或 --gold #C9A961，7.71:1 */
  }
  ```

---

## 四、【建议优化】问题清单

| # | 条款 | 位置 | 实测/现象 | 建议 |
|---|---|---|---|---|
| S1 | 1.4.3 | `components.css:233` `.tag-gold { color:#8a6d2f }` | **4.32:1**（12px），差一点 | 改 `#7A5E26`（≈5.2:1） |
| S2 | 1.3.1 | `components.css:349-351` `.stat-link a:hover .stat-note{color:var(--cinnabar)}` | 朱砂 on 朱砂wash = **4.20:1** | hover 态改 `--cinnabar-deep`（6.03:1） |
| S3 | 4.1.2 | `src/components/Footer.js:58-65` | `<span class="dot">·</span>`×3 无 `aria-hidden`，读屏念"间隔号" | 给 3 个 dot 加 `aria-hidden="true"` |
| S4 | 2.4.6 | `src/components/Footer.js:25,36,44` | `<h3>` 跳过层级（footer 内无 h2 父级） | 改为 `<p class="footer-col-title">` 或 `<h2>`；页脚标题层级不参与大纲更干净 |
| S5 | 1.3.1 | `src/pages/About.js:301-313` `.toc-link` | 目录按钮点击后 `target.focus()`（做得对），但 `.is-active` 高亮**只靠颜色/字重**，不进入可访问树 | 保留焦点转移，给当前项加 `aria-current="location"` |
| S6 | 3.2.2 | `src/pages/Gallery.js:145-149` `.filter-more` | 展开/收起时 `aria-expanded` 正确，但可见文案「全部门类 ▾」不随状态变化，与 `aria-expanded` 双重表达 | 视觉箭头用 `aria-hidden` + CSS `transform: rotate()` 随 `aria-expanded` 翻转；或保留文案变化但**不要**同时改 `aria-label` |
| S7 | 1.4.4 | `tokens.css` 字号 | 字号体系多数用 `--fs-*` 变量（好），但 `pages.css` 有 `font-size:10px` 硬编码（`.tool-note`、`.sim-tab-idx`、`.tool-opt-desc`、`.thread`、`.age-bar-label@720`）；且 `base.css` 在 `html` 上写死 `font-size:16px` 而非 `100%` | 10px 全部改 `0.6875rem`；`html { font-size: 100% }` 让浏览器"仅文字放大"生效 |
| S8 | 1.4.10 | 200%/400% 缩放 | `body { background-attachment: fixed }`（`base.css:22-42`）在放大后可能造成重绘卡顿；`.about-table { min-width:520px }` 放在 `overflow-x:auto` 容器内（**合规**，单元素允许横向滚动） | 仅性能建议：fixed 背景改 `scroll`、降低噪点层开销。**需实测** |
| S9 | 2.2.2 暂停/停止/隐藏 | `pages.css:1276-1280` `.sim-hint-icon { animation: pulse 2s infinite }` | 无限循环动画，但 `prefers-reduced-motion` 已兜底（`base.css:13` + `pages.css:2579`），**AA 合规** | 无需修。它只承载装饰性提示动效，不搬运信息 |
| S10 | 2.3.1 | 全站 | 无 >3 次/秒闪烁；`navIn`/`drawerIn` 为一次性入场 | 无需修 |
| S11 | 2.4.7 | `base.css:94-101` | 全局焦点环只在 `:focus-visible`（**正确做法**）；`.filter-search input:focus`（`components.css:362`）用 `outline:none` + box-shadow 覆盖，视觉上仍有朱砂 wash 光晕，**可见** | Windows 高对比度模式下作者 box-shadow 会被抹掉 → 建议保留一层 `outline: 2px solid transparent` 兜底 |
| S12 | 1.4.12 | `pages.css` 字距 | 多处 `letter-spacing: .24em/.3em`（`.tool-title`、`.hero-scroll`）。中文长词距在调大行高时不受影响；若用户开"仅文字放大"会挤压 | 为中文大段文字避免 >.2em 字距 |
| S13 | 4.1.2 | `src/pages/Simulator.js:129-131` `.thread` | `role="radio"` 的 `<button>` 同时有 `title="大红"` 和可见文字 `.thread-name` 大红 → 可访问名可能重复念"大红 大红" | 删掉 `title`（`title` 本就不是可靠的命名来源） |
| S14 | 4.1.2 | `src/pages/Simulator.js:88-93` 等 `role="radiogroup"` | 用 `role=radio` 的 `<button>` 未实现方向键组内移动（原生 radio 自带） | 给每组补 ←→/↑↓ 循环切换（可照抄已实现的 tabs 键盘逻辑 `:412-420`） |
| S15 | 1.3.1 | `src/pages/Ages.js` 年龄图表 | 柱状图为 `div` + 内联 style 宽度，无 `role="img"`。若同页有等价 `.age-table` 则合规 | 保持"图表 + 数据表"并存，并给图表容器加 `aria-hidden="true"`，让读屏只读表格，避免重复 |
| S16 | 1.3.1 / 维护性 | `src/pages/Inheritors.js` vs `src/components/ui.js:133-158` | 两套分页实现：传承人名录用 `.pager-btn` 真 `<button disabled>`（**正确**），名录页用 `span.is-disabled`（见 M8） | 抽成一个 `Pager()` 组件，两页共用，消除这类"同一交互两种实现"的分歧 |
| S17 | 1.4.11 | `base.css:132-139` 滚动条 `thumb: --ink-ghost on --paper-deep` | 1.49:1，滚动条几乎看不见 | 改 `#A79F8F`（≈2.2:1）；滚动条不受 1.4.11 约束，属可用性优化 |

---

## 五、按条款复核清单（WCAG 2.1 AA 逐条）

| 条款 | 名称 | 结论 |
|---|---|---|
| 1.1.1 | 非文本内容 | ✅ SVG 全 `aria-hidden`，无内容图片；canvas 有 `aria-label` 但见 M5 |
| 1.2.x | 时基媒体 | ✅ 无音视频 |
| 1.3.1 | 信息与关系 | ⚠️ M7 M9 M14，另：面包屑、表格 `<caption>` + `scope` 均正确 |
| 1.3.2 | 有意义的顺序 | ✅ DOM 顺序即视觉顺序 |
| 1.4.1 | 使用颜色 | ❌ M15、M7（选中态仅颜色） |
| 1.4.3 | 对比度（最低） | ❌ M1 M2 M3 M17 — **本次最大问题域** |
| 1.4.4 | 调整文本 | ⚠️ S7（10px 硬编码） |
| 1.4.5 | 图像中的文本 | ✅ 无 |
| 1.4.10 | 重排 | ⚠️ S8 需实测 |
| 1.4.11 | 非文本对比度 | ❌ M4 |
| 1.4.12 | 文本间距 | ✅ |
| 1.4.13 | 内容悬停 | ✅ `title` 仅作补充，无 hover-only 关键信息 |
| 2.1.1 | 键盘 | ❌ **M5（阻断级）**、M13 |
| 2.1.2 | 无键盘陷阱 | ⚠️ M10（反向问题：焦点逃逸） |
| 2.1.4 | 字符键快捷键 | ✅ 无单字符快捷键 |
| 2.2.1 / 2.2.2 | 时限/暂停 | ✅ |
| 2.3.1 | 三次闪烁 | ✅（S10） |
| 2.4.1 | 跳过区块 | ✅ `.skip-link` 已实现且目标可聚焦 |
| 2.4.2 | 页面标题 | ✅ 随路由更新（`main.js:925`） |
| 2.4.3 | 焦点顺序 | ❌ M10 M11 |
| 2.4.4 | 链接用途 | ⚠️ M9；另 `aria-label="匠作 · 返回首页"` 正确 |
| 2.4.6 | 标题和标签 | ⚠️ M14、S4 |
| 2.4.7 | 焦点可见 | ✅ 全局有（深色区 M17） |
| 2.5.5 | 目标尺寸（AAA，供参考） | ⚠️ M16 |
| 3.1.1 | 页面语言 | ✅ `lang="zh-CN"` |
| 3.2.3 / 3.2.4 | 一致导航/识别 | ✅ |
| 3.3.1 / 3.3.2 | 错误识别/标签 | ✅ 搜索框有 `sr-only` label；无表单校验场景 |
| 4.1.2 | 名称、角色、值 | ⚠️ M7 M8 M9，S13 S14 |
| 4.1.3 | 状态消息 | ❌ **M6（阻断级）**、M12 |

**WCAG 2.2 额外关注**（若参赛要求跟进 2.2）：2.5.8 目标尺寸（最低 24×24）—— 现状**基本满足**，仅 `.page-btn` 36×36 在桌面可接受、`.filter-more` 需实测；2.4.11 焦点不被遮挡 —— `html { scroll-padding-top: 88px }`（`base.css:9`）已处理 sticky 页头遮挡，**做得好**。

---

## 六、修复优先级（可直接排期）

### 第一优先（上线前必须修，约 2–3 人日）
1. **M5** 三个模拟器键盘等价操作（影响"技艺体验"整页可用性，受众最广的可访问性缺口）
2. **M6** 模拟器状态播报（`aria-live` 实时区 + `progressbar` 补 `aria-label`）
3. **M1 + M2** 色板语义重排：`--ink-faint → #6B655C`，所有"极淡正文"上移一档（**一次性改 token + 10 处选择器，收益最大**）
4. **M7 + M8** 筛选 chip `aria-current`、分页禁用态 `aria-disabled`
5. **M11 + M12** 路由切换通知 + 结果条 `role="status"`

### 第二优先（下个迭代，约 1 人日）
6. **M4** UI 边框对比度（新增 `--rule-strong` 并替换 8 处）
7. **M9** 项目卡片去掉 `aria-label`
8. **M10** 抽屉焦点管理 + `render()` 焦点回主区
9. **M17** 深色区朱砂/焦点环色值
10. **M3** 去 opacity 化禁用态与章节序号

### 持续改进
11. **M16** 触屏目标尺寸统一 ≥44
12. **M13 M14 M15** panel 可聚焦、标题层级、正文链接下划线
13. S1–S17 逐条处理

---

## 七、流程建议（防止复发）

1. **把对比度写进 CI**。当前缺陷 70% 集中在"色板太淡"，靠人工评审会一直漏。建议在构建脚本里加一步：解析 `tokens.css` 的色值组合，低于阈值的组合直接让构建失败。
2. **建立 `--ink-*` 的语义契约**，并在 `tokens.css` 注释里写明"用途 + 最小对比度"：
   ```css
   /* 文字层级：只能在纸上使用；--ink-ghost 禁止用于文字 */
   --ink-faint: #6B655C;  /* 辅助正文 12px+，纸 5.02:1 */
   --ink-ghost: #C4BDB0;  /* 仅装饰：分隔线/卡片描边。1.66:1，禁止承载信息 */
   ```
3. **给每个交互组件写"无障碍验收标准"**（如"页签必须支持 ←→/Home/End；筛选组必须有 `aria-current`；Canvas 必须有键盘等价操作"），并入 issue 模板。
4. **凡涉及 canvas / 拖拽，立项时就决定键盘方案**。拖拽交互的键盘等价物不是"事后补"，是交互设计的一部分。
5. **复审节奏**：第一优先修完后做一轮屏幕阅读器实测（NVDA + Chrome 至少覆盖：名录筛选→详情→返回、传承人分页、三个模拟器各完整走一遍），再用 axe-core 全页扫一遍做回归。

---

[^1]: 依据 WAI-ARIA Authoring Practices 中 Tabs 模式：若 tabpanel 内含不可聚焦内容，面板需设 `tabindex="0"` 以便键盘用户能进入并浏览内容。VoiceOver/Safari 环境下尤其明显。
