/**
 * 单文件产物结构检查
 *
 * 构建后 dist/index.html 里所有 <script> 都被合并到 body 末尾。
 * 本脚本把每个脚本块单独取出，用 new Function() 试解析，
 * 定位到底哪一块、哪一行有语法错误——比在 1.7MB 单行文件里靠行号猜快得多。
 */

import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

console.log(`共 ${blocks.length} 个脚本块\n`);

blocks.forEach((b, i) => {
  const code = b[1];
  const startLine = html.slice(0, b.index).split('\n').length;
  console.log(`── 块 ${i + 1}：HTML 第 ${startLine} 行起，${code.length} 字符`);
  try {
    new Function(code);
    console.log('   语法 OK\n');
  } catch (e) {
    console.log(`   ✗ 语法错误：${e.message}`);
    const lines = code.split('\n');
    console.log(`   该块共 ${lines.length} 行`);
    // 二分查找：最小的、单独解析就报错的完整行前缀
    let lo = 1, hi = lines.length, firstBad = lines.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      let ok = true;
      try { new Function(lines.slice(0, mid).join('\n')); } catch { ok = false; }
      if (ok) lo = mid + 1; else { firstBad = mid; hi = mid - 1; }
    }
    console.log(`   二分定位：块内第 ${firstBad} 行起开始出现无法解析的结构`);
    for (let n = Math.max(1, firstBad - 2); n <= Math.min(lines.length, firstBad + 2); n++) {
      const t = lines[n - 1];
      console.log(`   [${n}]${n === firstBad ? ' ←' : '  '} ${t.slice(0, 220)}`);
    }
    console.log('');
  }
});

// 另外确认内联数据是否完整
const hasProjects = html.includes('window.__JZ_DATA__["projects"]');
const hasDetails = html.includes('window.__JZ_DATA__["details"]');
const hasMeta = html.includes('window.__JZ_DATA__["meta"]');
console.log(`内联数据：projects=${hasProjects} details=${hasDetails} meta=${hasMeta}`);
