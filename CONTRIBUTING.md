# 协作开发说明

本仓库是 2026 武汉大学「零杯」网页设计大赛参赛作品《匠作》的协作仓库。

**仓库是公开的**，任何人都能看到代码和历史。因此有两条硬性纪律：
不要把个人信息提交进来，不要把带个人信息的提交包推上来。

---

## 一、第一次参与（克隆与安装）

```bash
git clone https://github.com/YiFanSenSei/Ling-Test.git
cd Ling-Test

# 安装依赖（本项目用 pnpm）
pnpm install
```

本机没有 pnpm 时，可先 `npm i -g pnpm`，或用项目提供的 node 直接调：

```bash
node node_modules/vite/bin/vite.js
```

### 需要自备的工具

- **Node.js**：本项目在 Node 24 上开发（`node -v` 应 ≥ 20）
- **Chrome**：参与「技术自测」时需要，脚本默认读 `C:\Program Files\Google\Chrome\Application\chrome.exe`，
  装在别处的话设环境变量 `CHROME_PATH` 指向你的 `chrome.exe`

---

## 二、日常开发流程

**核心规则：永远不在 main 上直接改，永远先 pull。**

```bash
# 1. 切回 main 并拉取最新
git switch main
git pull

# 2. 开一个自己的分支（用你的任务命名）
git switch -c feat/gallery-filter

# 3. 改代码……改完自测

# 4. 提交
git add -A
git commit -m "名录页：筛选条件同步到地址栏"

# 5. 推上去
git push -u origin feat/gallery-filter

# 6. 到 GitHub 网页开 Pull Request，等队长合并
```

分支命名建议：

| 前缀 | 用途 |
|---|---|
| `feat/` | 新功能 |
| `fix/` | 修 bug |
| `docs/` | 只改文档 |
| `style/` | 只改样式 / 视觉 |

---

## 三、提交前必须自测

这三条不能省。它们各自都拦住过会导致**零分**的问题：

```bash
# 1. 构建必须成功（构建会自动把 JS/CSS/数据内联成单文件）
node node_modules/vite/bin/vite.js build

# 2. 公开前隐私检查——必须全绿
node scripts/audit.mjs

# 3. 真实浏览器 file:// 下走一遍全部页面与交互
node scripts/file-full-test.mjs
```

第 3 条特别重要：**评委是双击 `index.html` 打开作品的**。
单文件产物在 `file://` 下能跑，是经过专门修复才做到的
（Chrome 禁止 `file://` 页面加载外部 JS 与 fetch 本地 JSON）。
改动构建配置或 `src/data.js` 后，务必重跑它。

> 跑第 3 条如果报 `DevTools 未就绪` 或 `spawn EPERM`，
> 通常是权限受限环境拦住了命名管道。在本机正常终端里跑即可。

---

## 四、绝对不要提交的东西

`.gitignore` 已经挡住了大部分，但请自己也留意：

| 不要提交 | 原因 |
|---|---|
| `dist/` | 构建产物，随时可重新生成 |
| `_shots/` | 本机测试截图，且体积很大 |
| `_submit/` | **提交压缩包，含个人信息** |
| `node_modules/` | 依赖 |
| 任何真实姓名 / 学号 / 手机号 / 邮箱 | 公开仓库，会永久留在历史里 |
| 任何本机绝对路径 | 换台电脑就跑不了，且暴露个人环境 |
| 赛事投稿邮箱 | 赛事内部信息 |

改了 `.gitignore` 或发现可能误提交时，先跑：

```bash
node scripts/audit.mjs      # 五类风险逐文件扫描
git status                  # 确认暂存区里没有上面的东西
```

### 已经不小心提交了怎么办

**还没 push**：直接改掉再 `git commit --amend`。
**已经 push 且仓库是公开的**：光删文件没用，历史里还在。告诉我，需要重写历史。

---

## 五、分支保护

`main` 已开启保护：**不能直接 push，必须走 Pull Request**。

这是为了防两件事：一是误操作推坏可运行的作品，二是多人同时改同一文件互相覆盖。

作为例外，队长（仓库所有者）保留了直接推送的权限，
用于处理 README 这类只有一个人会动的文件。

---

## 六、冲突怎么处理

冲突几乎只发生在**多人同时改同一个文件**。最典型的是 `README.md` 里那张成员分工表。

```bash
git switch main
git pull
git switch feat/your-branch
git merge main          # 或 git rebase main

# 打开冲突文件，找到 <<<<<<< ======= >>>>>>> 标记，手工改成想要的结果
git add <冲突文件>
git commit
```

减少冲突的办法：**一个分支只碰一类文件**。
改样式的别顺手改数据抓取脚本；改文档的别碰 `src/`。

---

## 七、联系方式

遇到问题先在群里问，不要自己硬试——尤其是涉及 `git push --force`
和「删除分支」这类不可逆操作。
