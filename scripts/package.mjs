/**
 * 提交打包脚本
 *
 * 比赛要求两个子压缩包：
 *   1. 完整版本（含个人信息）
 *   2. 匿名版本（不含任何个人信息，用于初赛评选）
 *
 * 本脚本除了打包，还会**逐文件扫描匿名版**，确认没有残留任何
 * 可识别个人 / 本机 / 队伍的信息。扫描不通过就整体失败退出，
 * 避免把带个人信息的包误投出去——这类错误一旦发生无法挽回。
 *
 * 运行：node scripts/package.mjs <队伍名> <队长姓名>
 *
 * ⚠️ 注意：扫描规则只针对「个人信息」，不针对作品标题。
 *    「匠作」是全站作品名，当然会出现在每个源文件里，不能当敏感词。
 */

import { mkdirSync, rmSync, cpSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { anonymizeReadme, requiredBuildFiles } from './lib/submission.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT_ROOT = join(ROOT, '_submit', `build-${Date.now()}`);

const teamName = process.argv[2];
const leader = process.argv[3];

if (!teamName || !leader) {
  console.error('用法: node scripts/package.mjs <队伍名> <队长姓名>');
  console.error('例如: node scripts/package.mjs 匠心小队 张三');
  process.exit(1);
}

if ([teamName, leader].some(v => /[<>:"/\\|?*]/.test(v) || v.includes('..'))) {
  throw new Error('队伍名与队长姓名不能包含路径或文件名保留字符');
}
const GROUP = '壹组';
const FULL_NAME = `2026-零杯${GROUP}-${teamName}-${leader}-完整版本`;
const ANON_NAME = `2026-零杯${GROUP}-${teamName}-${leader}-匿名版本`;

/** 需要打进包的文件 / 目录（相对 ROOT） */
/** 比赛提交包里只放这些：作品本体 + 源码 + 抓取脚本 + 说明 */
const INCLUDE = ['index.html', 'vite.config.js', 'package.json', 'pnpm-workspace.yaml',
                 'pnpm-lock.yaml', 'README.md', 'BACKEND_PLAN.md', 'server', '.env.example', 'public', 'src',
                 'scripts/split-details.mjs', 'scripts/fetch-data.mjs',
                 'scripts/fetch-details.mjs', 'scripts/fetch-all-details.mjs',
                 'scripts/coverage-report.mjs', 'scripts/lib/parse-detail.mjs',
                 'scripts/lib/birth-summary.mjs'];

/**
 * 不随作品提交的内部文件。
 *
 * 判据很简单：**凡是要跑在本机上的诊断脚本，都不进提交包**。
 * 其中 package.mjs 还把「本机路径特征」「投稿邮箱」作为检测字面量列着，
 * 放进匿名包等于把要藏的东西原样交出去。
 */
const ANON_EXCLUDE = [
  'NOTES.md',
  '.gitignore',
  'scripts/package.mjs',
  'scripts/audit.mjs',
  'scripts/interact-test.cjs',
  'scripts/adapt-test.cjs',
  'scripts/file-test.mjs',
  'scripts/file-full-test.mjs',
  'scripts/real-browser-test.mjs',
  'scripts/check-single-file.mjs',
  'scripts/check-vm.mjs',
  'scripts/_check-query.mjs',
  'scripts/_diag-gallery.cjs',
  'scripts/_diag-embroidery.cjs',
];

/**
 * 本机与个人的痕迹——这些才是真正不能出现在匿名版里的东西。
 *
 * 刻意把每个词写「碎」（如 '2' + '402065071'），
 * 这样本文件被整体上传到公开仓库时，不会把要隐藏的字符串
 * 原封不动地公开出来。
 */
const FORBIDDEN = [
  'C:\\Users', 'C:/Users', '\\Users\\', '/Users/', '/home/',
  'App' + 'Data',
  '2' + '402065071',
];

/** 只在特定文件里检查的「队伍 / 队长」字样（作品标题不是敏感词） */
const NAMES_OK_IN = new Set();


/**
 * 由 scripts/split-details.mjs 生成的构建中间产物。
 *
 * 它们的内容与 public/data/details.json 重复，且已经随成品放在包的 data/ 目录里，
 * 因此不再往源码的 public/ 里塞一份——否则同样的 10 MB 会在压缩包里出现三遍。
 * 需要它们时跑 pnpm dev / pnpm build 即可（predev / prebuild 会自动生成）。
 */
const GENERATED = /[\\/](detail-\d+\.js|detail-index\.json|featured\.json|inheritors\.js|inheritor-stats\.json)$/;


function walk(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '_shots' || name === 'dist') continue;
    if (statSync(p).isDirectory()) walk(p, base, acc);
    else acc.push(relative(base, p));
  }
  return acc;
}

function copyPayload(target) {
  mkdirSync(target, { recursive: true });
  for (const item of INCLUDE) {
    const src = join(ROOT, item);
    if (!existsSync(src)) throw new Error(`缺少提交源码：${item}`);
    mkdirSync(join(target, item, '..'), { recursive: true });
    cpSync(src, join(target, item), {
      recursive: true,
      filter: (s) => !/node_modules|_shots|[\\/]dist[\\/]?$/.test(s) && !GENERATED.test(s),
    });
  }

  /* 成品：dist/index.html + dist/data/（详情分片）。
   *
   * ⚠️ 从「单文件」改成「单文件 + 分片」之后，这里必须连 data 目录一起搬。
   *    只搬 index.html 的话，评委双击后首页一切正常，一点进项目就空白——
   *    而首页恰恰是最容易被顺手检查的一页，这个缺陷极难被发现。
   *
   * 布局：打开作品.html 放在包根目录，分片放在它旁边的 data/。
   *    运行时用的是相对路径 ./data/detail-N.js，两者必须保持相邻。
   *    不再另存一份 dist/index.html：那会让同样的数据在压缩包里出现两遍。
   */
  const distIndex = join(ROOT, 'dist', 'index.html');
  if (!existsSync(distIndex)) {
    throw new Error('dist/index.html 不存在——先跑 pnpm build');
  }
  cpSync(distIndex, join(target, '打开作品.html'));

  const distData = join(ROOT, 'dist', 'data');
  if (!existsSync(distData)) {
    throw new Error('dist/data 不存在——先跑 pnpm build');
  }
  // 显式逐项复制，避免部分 Windows 环境的目录快速复制返回 EIO。
  cpSync(distData, join(target, 'data'), { recursive: true, filter: () => true });
  cpSync(join(ROOT, 'dist', 'media'), join(target, 'media'), { recursive: true });
}

function zip(srcDir, zipPath) {
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  // Windows tar 在中文系统上可能用本地编码写文件名，解压后会乱码。
  // 显式指定 UTF-8；路径通过子进程环境传入，不拼入 PowerShell 代码。
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
    '[System.IO.Compression.ZipFile]::CreateFromDirectory($env:JZ_ZIP_SOURCE, $env:JZ_ZIP_TARGET, ' +
    '[System.IO.Compression.CompressionLevel]::Optimal, $false, [System.Text.Encoding]::UTF8)'],
    { stdio: 'inherit', windowsHide: true,
      env: { ...process.env, JZ_ZIP_SOURCE: srcDir, JZ_ZIP_TARGET: zipPath } });
}

/* ---------------- 主体 ---------------- */

console.log(`队伍：${teamName}   队长：${leader}   分组：${GROUP}\n`);

const anonymousReadme = anonymizeReadme(readFileSync(join(ROOT, 'README.md'), 'utf8'));
const detailIndex = JSON.parse(readFileSync(join(ROOT, 'public/data/detail-index.json'), 'utf8'));
for (const file of requiredBuildFiles(detailIndex)) {
  if (!existsSync(join(ROOT, 'dist', file))) throw new Error(`缺少构建产物 ${file}，请重新构建`);
}
mkdirSync(OUT_ROOT, { recursive: true });

// ── 完整版本
const fullDir = join(OUT_ROOT, FULL_NAME);
console.log('[1/3] 生成完整版本…');
copyPayload(fullDir);
const fullZip = join(OUT_ROOT, `${FULL_NAME}.zip`);
zip(fullDir, fullZip);
console.log(`      → ${fullZip}\n`);

// ── 匿名版本
const anonDir = join(OUT_ROOT, ANON_NAME);
console.log('[2/3] 生成匿名版本…');
copyPayload(anonDir);
for (const f of ANON_EXCLUDE) rmSync(join(anonDir, f), { force: true, recursive: true });

// 匿名版 README 去掉成员表里的真实信息，改为占位说明
const anonReadme = join(anonDir, 'README.md');
writeFileSync(anonReadme, anonymousReadme, 'utf8');

const anonZip = join(OUT_ROOT, `${ANON_NAME}.zip`);


// ── 匿名版扫描（关键步骤）
console.log('[3/3] 扫描匿名版本是否残留个人信息…');
const files = walk(anonDir);
let bad = 0;
for (const rel of files) {
  const ext = extname(rel).toLowerCase();
  if (!['.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.yaml', '.yml', '.txt'].includes(ext)) continue;
  const text = readFileSync(join(anonDir, rel), 'utf8');
  const normalized = rel.split('\\').join('/');

  for (const word of FORBIDDEN) {
    if (text.includes(word)) {
      console.log(`  ✗ ${normalized} 含本机/个人信息「${word}」`);
      bad++;
    }
  }
  // 队伍名与队长姓名只在不该出现它们的文件里检查
  if (!NAMES_OK_IN.has(normalized)) {
    for (const [label, word] of [['队伍名', teamName], ['队长姓名', leader]]) {
      if (word && text.includes(word)) {
        console.log(`  ✗ ${normalized} 含${label}「${word}」`);
        bad++;
      }
    }
  }
}

if (bad === 0) {
  console.log(`  ✓ 扫描 ${files.length} 个文件，未发现个人信息残留`);
} else {
  console.log(`\n匿名版本扫描未通过（${bad} 处），已中止提交打包。`);
  process.exit(2);
}

// 扫描通过才生成匿名包与外层总包，保留之前的打包结果。
zip(anonDir, anonZip);
const envelope = join(OUT_ROOT, 'envelope');
mkdirSync(envelope);
cpSync(fullZip, join(envelope, `${FULL_NAME}.zip`));
cpSync(anonZip, join(envelope, `${ANON_NAME}.zip`));
const bundle = join(OUT_ROOT, `零杯${GROUP}-${teamName}-${leader}.zip`);
zip(envelope, bundle);
console.log(`\n总包已生成：${bundle}`);
console.log('正式提交前请确认完整版 README 已填写真实成员与分工，并重新构建、打包。');
