import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 构建配置
 *
 * ⚠️ 一个必须记住的坑（已实测，别改回去）：
 *    Chrome 从 2021 年起禁止 file:// 页面加载 <script type="module">，
 *    报错为「Access to script ... from origin 'null' has been blocked by CORS policy」。
 *    也就是说：只要产物是「index.html + 外链 assets/*.js」，评委双击 index.html
 *    就只会看到加载动画，永远进不去。
 *
 *    解决办法是 build-single-file 插件：构建结束后把 JS / CSS 全部内联进 HTML，
 *    并把名录、统计口径等**小**数据也内联为 JSON 脚本。
 *    没有跨源请求，双击必然可用，也方便直接邮件提交。
 *
 *    ⚠️ 详情数据（全量补录后约 10 MB）是个例外，它**不内联**，而是切成
 *    dist/data/detail-N.js 分片，由运行时按需注入。依据同样是上面这条限制的
 *    反面：file:// 禁止的是 type="module" 与 fetch，**普通 <script src> 仍然可用**。
 *    所以分片能工作，首屏也不必为 10 MB 买单。分片由 scripts/split-details.mjs 生成。
 *
 *    验证时必须用**不带 --allow-file-access-from-files** 的真实浏览器，
 *    否则这个参数会掩盖问题（我最初就是被它骗过一次）。
 *    分片路径同理：必须在真实 file:// 下验证，不能只看开发服务器。
 */
function buildSingleFile() {
  return {
    name: 'build-single-file',
    closeBundle() {
      const dist = join(import.meta.dirname, 'dist');
      const htmlPath = join(dist, 'index.html');
      if (!existsSync(htmlPath)) return;

      let html = readFileSync(htmlPath, 'utf8');

      // 1) 内联 CSS
      html = html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (m, p) => {
        const f = join(dist, p);
        if (!existsSync(f)) return m;
        const css = readFileSync(f, 'utf8');
        rmSync(f, { force: true });
        return `<style>\n${css}\n</style>`;
      });

      // 2) 只把 <script type="module" src=...> 标签【摘掉】，先不要就地内联。
      //    原因：内联后它变成一个普通 <script>，仍留在 <head> 里，
      //    既会被后面的正则误判，也会在 #app 出现之前执行而报
      //    TypeError: Cannot set properties of null (setting 'innerHTML')。
      //    正确的做法是统一在文件末尾（</body> 前）重新插入。
      let businessJS = '';
      html = html.replace(/<script\b[^>]*src="\.?\/?(assets\/[^"]+\.js)"[^>]*><\/script>/g, (m, p) => {
        const f = join(dist, p);
        if (!existsSync(f)) return m;
        businessJS = readFileSync(f, 'utf8').replace(/<\/script/gi, '<\\/script');
        rmSync(f, { force: true });
        return '';
      });

      // 3) 内联「小」数据文件。
      //    ⚠️ 必须在「搬运脚本」之前做完，且数据只用 JSON.stringify 写成
      //    单行字面量。否则 JSON 里的任意文本会被后续的 <script> 正则误匹配，
      //    把整个文档切碎（曾导致脚本块里混进 <html>，页面直接语法错误白屏）。
      //
      //    ⚠️ 详情分片（detail-N.js）与传承人索引（inheritors.js）**刻意不内联**：
      //    它们由运行时按需注入，必须留在 dist/data/ 里。
      //    所以这里不能像早期那样把整个 data 目录删掉——早期只内联 180 条详情时
      //    删掉无所谓，现在删了等于把全站详情一起删掉。
      const INLINE_DATA = ['projects', 'meta', 'detail-index', 'featured', 'inheritor-stats'];
      const dataDir = join(dist, 'data');
      const inlined = {};
      if (existsSync(dataDir)) {
        for (const name of INLINE_DATA) {
          const f = join(dataDir, `${name}.json`);
          if (!existsSync(f)) continue;
          // 重新序列化：确保单行、无 </script> 隐患、无换行被误判
          inlined[name] = JSON.stringify(JSON.parse(readFileSync(f, 'utf8')))
            .replace(/<\/script/gi, '<\\/script');
          rmSync(f, { force: true });
        }
        // 原始语料 details.json 不进产物：它的内容已经切成 data/detail-N.js
        rmSync(join(dataDir, 'details.json'), { force: true });
      }

      // 4) 组装：数据脚本在前、业务脚本在后，一起放在 </body> 之前。
      //    顺序不能反——业务脚本一解析就会调用 loadJSON 读 window.__JZ_DATA__。
      const dataScript = Object.keys(inlined).length
        ? `<script>window.__JZ_DATA__={};\n${Object.entries(inlined)
            .map(([k, v]) => `window.__JZ_DATA__[${JSON.stringify(k)}]=${v};`).join('\n')}\n</script>`
        : '';

      const bundle = [dataScript, `<script>\n${businessJS}\n</script>`].filter(Boolean).join('\n');

      // 用【替换回调】插入：替换值里有 1MB 级代码，若含 $& / $' 等序列，
      // 字符串替换会把它们当替换模式展开，静默破坏产物。
      html = html.replace('</body>', () => `${bundle}\n</body>`);

      writeFileSync(htmlPath, html, 'utf8');

      // 自检：脚本块必须能被解析，且不得混入 HTML
      const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
      const broken = blocks.filter(c => /<html|<body|<div id="app"/.test(c));
      if (broken.length) {
        throw new Error('单文件内联自检失败：脚本块中混入了 HTML，产物不可用');
      }

      // 自检：分片必须真的落在产物里。漏了它页面能打开、首页也正常，
      // 只有点进某个项目时才空白——这种缺陷靠肉眼翻首页是发现不了的。
      const shardFiles = existsSync(dataDir)
        ? readdirSync(dataDir).filter(f => /^detail-\d+\.js$/.test(f))
        : [];
      if (!shardFiles.length) {
        throw new Error('构建产物里没有详情分片（dist/data/detail-*.js）：'
          + '先跑 node scripts/split-details.mjs，否则项目详情页全部空白');
      }

      const size = (readFileSync(htmlPath).length / 1024 / 1024).toFixed(2);
      const shardBytes = shardFiles.reduce((s, f) => s + statSync(join(dataDir, f)).size, 0);
      console.log(`\n  ✓ 首屏单文件：dist/index.html（${size} MB，${blocks.length} 个脚本块）`);
      console.log(`  ✓ 详情分片：data/detail-*.js 共 ${shardFiles.length} 片，`
        + `合计 ${(shardBytes / 1048576).toFixed(2)} MB（打开项目时按需注入，不占首屏）`);
      if (existsSync(join(dataDir, 'inheritors.js'))) {
        const inhSize = (statSync(join(dataDir, 'inheritors.js')).size / 1024).toFixed(0);
        console.log(`  ✓ 传承人索引：data/inheritors.js（${inhSize} KB，传承人页按需注入）`);
      }
      console.log('  ✓ 双击 dist/index.html 即可离线浏览（file:// 下普通脚本可加载）');
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 数据文件体积较大（projects.json 约 1.5MB），放宽警告阈值
    chunkSizeWarningLimit: 4096,
    // 单文件内联依赖固定文件名，关闭哈希便于替换
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  publicDir: 'public',
  plugins: [buildSingleFile()],
});
