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

const ROOT = join(import.meta.dirname, '..');
const OUT_ROOT = join(ROOT, '..', '_submit');

const teamName = process.argv[2];
const leader = process.argv[3];

if (!teamName || !leader) {
  console.error('用法: node scripts/package.mjs <队伍名> <队长姓名>');
  console.error('例如: node scripts/package.mjs 匠心小队 张三');
  process.exit(1);
}

const GROUP = '壹组';
const FULL_NAME = `2026-零杯${GROUP}-${teamName}-${leader}-完整版本`;
const ANON_NAME = `2026-零杯${GROUP}-${teamName}-${leader}-匿名版本`;

/** 需要打进包的文件 / 目录（相对 ROOT） */
/** 比赛提交包里只放这些：作品本体 + 源码 + 抓取脚本 + 说明 */
const INCLUDE = ['index.html', 'vite.config.js', 'package.json', 'pnpm-workspace.yaml',
                 'pnpm-lock.yaml', 'README.md', 'public', 'src'];

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
    if (!existsSync(src)) { console.warn(`  ! 跳过不存在的条目: ${item}`); continue; }
    cpSync(src, join(target, item), {
      recursive: true,
      filter: (s) => !/node_modules|_shots|[\\/]dist[\\/]?$/.test(s),
    });
  }
  // 成品是构建好的**单文件** index.html（JS / CSS / 数据全部内联），
  // 放在包的根目录，评委解压后双击即可，无需服务器、无需联网。
  // 同时保留一份 dist/ 以满足「包含完整项目」的提交习惯。
  const distIndex = join(ROOT, 'dist', 'index.html');
  if (existsSync(distIndex)) {
    mkdirSync(join(target, 'dist'), { recursive: true });
    cpSync(distIndex, join(target, 'dist', 'index.html'));
    cpSync(distIndex, join(target, '打开作品.html'));
  }
}

function zip(srcDir, zipPath) {
  if (existsSync(zipPath)) rmSync(zipPath, { force: true });
  // Windows 10+ 自带 tar，可直接产出 zip
  execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', srcDir, '.'], { stdio: 'inherit' });
}

/* ---------------- 主体 ---------------- */

console.log(`队伍：${teamName}   队长：${leader}   分组：${GROUP}\n`);

rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

// ── 完整版本
const fullDir = join(OUT_ROOT, FULL_NAME);
console.log('[1/3] 生成完整版本…');
copyPayload(fullDir);
cpSync(join(ROOT, 'NOTES.md'), join(fullDir, 'NOTES.md'));
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
if (existsSync(anonReadme)) {
  let txt = readFileSync(anonReadme, 'utf8');
  txt = txt.replace(
    /## 二、组内成员与分工[\s\S]*?(?=\n---\n)/,
    `## 二、组内成员与分工\n\n> 本版本为初赛评选用**匿名版本**，按比赛要求不包含任何个人信息。\n> 队员名单与分工见「完整版本」中的同一章节。\n\n`
  );
  writeFileSync(anonReadme, txt, 'utf8');
}

const anonZip = join(OUT_ROOT, `${ANON_NAME}.zip`);
zip(anonDir, anonZip);
console.log(`      → ${anonZip}\n`);

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

// ── 外层总包提示
console.log(`\n完成。请在上级目录手动组装总包：`);
console.log(`  ${OUT_ROOT}\\零杯${GROUP}-${teamName}-${leader}.zip`);
console.log(`     ├─ ${FULL_NAME}.zip`);
console.log(`     └─ ${ANON_NAME}.zip`);
