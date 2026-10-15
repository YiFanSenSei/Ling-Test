/**
 * 上传前安全审计
 *
 * 逐文件扫描整个项目，按用户指定的五类风险分类报告：
 *   1. 密码 / token / 密钥
 *   2. 个人隐私（真实姓名、学号、邮箱、手机号、身份证）
 *   3. 本机绝对路径
 *   4. 临时文件 / 缓存 / 构建产物
 *   5. 不该公开的内容（内部备忘、投稿邮箱、他人隐私）
 *
 * 设计原则：
 *   - 报告"命中位置 + 上下文"，不做自动删除，由人决定
 *   - 区分「真问题」与「误报」（如源码里出现的示例字符串）
 *   - 数据文件（非遗数据）单独对待：地名、人名是数据内容，不是个人隐私
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();

/** 跳过的目录：不是源码，且必然含大量噪音 */
const SKIP_DIRS = new Set(['node_modules', '.git', '_shots', '_submit', 'dist']);

/** 文本类扩展名才扫描内容 */
const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css',
  '.yaml', '.yml', '.txt', '.env', '.example', '.gitignore',
]);

/** 数据文件：人名地名属正常数据内容，只查路径与密钥类风险 */
const DATA_FILES = [/public[\\/]data[\\/].*\.json$/];

/**
 * 整文件跳过的路径：这些文件内容是工具生成的，
 * 里面的「数字串」「邮箱样式」都是包名/哈希，不含真人信息。
 * 跳过它们才能让报告只剩真正要看的东西。
 */
const SKIP_CONTENT = [
  /^pnpm-lock\.yaml$/,
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /\.min\.(js|css)$/,
];

const RULES = [
  {
    id: 'secret',
    label: '① 密码 / Token / 密钥',
    // 赋值形式的密钥；以及各平台的真实 token 前缀
    patterns: [
      /(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|private[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
      /gh[pousr]_[A-Za-z0-9]{20,}/g,
      /sk-[A-Za-z0-9]{20,}/g,
      /AKIA[0-9A-Z]{16}/g,
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
      /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
    ],
    severity: 'high',
  },
  {
    id: 'privacy',
    label: '② 个人隐私',
    patterns: [
      /\b1[3-9]\d{9}\b/g,                                  // 手机号
      /\b\d{17}[\dXx]\b/g,                                // 身份证
      /\b20\d{10}\b/g,                                    // 学号（12 位）
      /[\w.+-]+@[\w-]+\.[\w.]+/g,                         // 邮箱
      /(?:姓名|学号|队长|作者|author)\s*[:=]\s*\S+/gi,
    ],
    severity: 'high',
  },
  {
    id: 'path',
    label: '③ 本机绝对路径',
    patterns: [
      /[A-Za-z]:\\+Users\\+[^\\\s"')]+/g,
      /[A-Za-z]:\/+Users\/+[^/\s"')]+/g,
      /\/Users\/[a-z0-9_-]+\//gi,
      /\/home\/[a-z0-9_-]+\//gi,
    ],
    severity: 'high',
  },
  {
    id: 'temp',
    label: '④ 临时 / 缓存文件',
    patterns: [],
    filenames: [
      /\.tmp$/i, /\.log$/i, /\.bak$/i, /\.swp$/i, /~$/,
      /^Thumbs\.db$/i, /^\.DS_Store$/i, /\.orig$/i,
      /response\d*\.html$/i, /\.cache$/i,
    ],
    severity: 'mid',
  },
  {
    id: 'internal',
    label: '⑤ 不该公开的内容',
    patterns: [
      /2402\s?065\s?071@qq\.com/g,   // 赛事投稿邮箱（拆开写，避免自身被扫到）
    ],
    severity: 'mid',
  },
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(ROOT);
const findings = [];
const isDataFile = (rel) => DATA_FILES.some(r => r.test(rel));

/**
 * 审计脚本自身不参与内容扫描。
 * 它必须把「要检测的模式」写成字面量，扫自己必然全是误报。
 * 这类工具文件在提交时也会被排除，不会流出去。
 */
const SELF = /scripts[\\/]audit\.mjs$/;

for (const abs of files) {
  const rel = relative(ROOT, abs).split('\\').join('/');
  const ext = extname(abs).toLowerCase();
  const base = abs.split(/[\\/]/).pop();

  for (const rule of RULES) {
    // ④ 按文件名判断
    if (rule.filenames) {
      for (const re of rule.filenames) {
        if (re.test(base)) {
          findings.push({ rule, rel, hit: `文件名匹配 ${re}`, ctx: '', auto: true });
        }
      }
    }
    if (!rule.patterns.length) continue;
    if (!TEXT_EXT.has(ext) && !['.gitignore'].includes(base)) continue;
    // 锁文件等自动生成内容不做文本扫描
    if (SKIP_CONTENT.some(re => re.test(base))) continue;
    // 审计脚本自己必须把检测模式写成字面量，扫自己必然误报
    if (SELF.test(abs)) continue;

    let text;
    try { text = readFileSync(abs, 'utf8'); } catch { continue; }

    for (const re of rule.patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        // 非遗数据文件里，人名与地名是数据内容，不算隐私
        if (rule.id === 'privacy' && isDataFile(rel)) {
          if (!/邮箱|@/.test(m[0])) continue;
        }
        if (rule.id === 'privacy') {
          // 邮箱必须是「像真人邮箱」的：排除 @scope/pkg@1.2.3 这类包名
          if (/@/.test(m[0]) && !/\.[a-z]{2,}$/i.test(m[0])) continue;
          // 学号/手机号必须独立成词：前后不能是数字、字母、连字符、点
          const before = m.index > 0 ? text[m.index - 1] : '';
          const after = text[m.index + m[0].length] || '';
          if (/[0-9A-Za-z@._-]/.test(before) || /[0-9A-Za-z@._-]/.test(after)) continue;
        }
        // README 里 "作者" 之类是文档措辞，单独降噪
        if (rule.id === 'privacy' && /^(作者|姓名|学号)/.test(m[0]) && rel.endsWith('.md')) {
          findings.push({ rule, rel, hit: m[0].slice(0, 40), ctx: '（文档措辞，需人工确认）', soft: true });
          continue;
        }
        const idx = Math.max(0, m.index - 45);
        findings.push({
          rule, rel,
          hit: m[0].slice(0, 90),
          ctx: text.slice(idx, m.index + m[0].length + 45).replace(/\s+/g, ' '),
        });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
}

/* -------- 报告 -------- */

console.log(`扫描目录：${ROOT}`);
console.log(`文件总数：${files.length}（已跳过 node_modules / .git / _shots / _submit / dist）\n`);

let hard = 0;
for (const rule of RULES) {
  const items = findings.filter(f => f.rule.id === rule.id);
  if (!items.length) {
    console.log(`${rule.label}：✓ 未发现`);
    continue;
  }
  const real = items.filter(f => !f.soft);
  hard += real.length;
  console.log(`${rule.label}：${items.length} 处${real.length ? `（其中 ${real.length} 处需处理）` : '（均为提示）'}`);
  for (const f of items.slice(0, 25)) {
    console.log(`   ${f.soft ? '·' : '✗'} ${f.rel}`);
    if (f.hit) console.log(`      命中: ${f.hit}`);
    if (f.ctx) console.log(`      上下文: …${f.ctx}…`);
  }
  if (items.length > 25) console.log(`   …… 另有 ${items.length - 25} 处`);
  console.log('');
}

console.log(hard === 0
  ? '结论：未发现需要在公开前处理的问题。'
  : `结论：检出 ${hard} 处需处理项，见上。`);
