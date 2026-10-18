/**
 * 匠作 · 应用入口
 *
 * 非物质文化遗产数字展馆与技艺互动体验
 * 2026 武汉大学「零杯」网页设计大赛参赛作品
 */

import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
// 大屏断点必须放在最后：它要覆盖前面各文件里定义的 --maxw 与栅格列数
import './styles/wide.css';

import { route, setNotFound, startRouter, navigate } from './router.js';
import { Header, initHeader } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { getMeta } from './data.js';
import { EmptyState } from './components/ui.js';

import { HomePage } from './pages/Home.js';
import { GalleryPage, initGallery } from './pages/Gallery.js';
import { ProjectPage } from './pages/Project.js';
import { InheritorsPage, initInheritors, InheritorPage } from './pages/Inheritors.js';
import { AgesPage } from './pages/Ages.js';
import { SimulatorPage, initSimulator } from './pages/Simulator.js';
import { AboutPage, initAbout } from './pages/About.js';

/* ---------------- 页面骨架 ---------------- */

let meta = {};

/**
 * 渲染页面骨架 + 内容。
 * 页头页脚常驻，只有 #view 区域随路由切换。
 *
 * 注意：每个路由的交互逻辑（筛选、页签、画布）必须在 innerHTML 写完之后
 * 才能绑定，因此由「页面初始化函数」在 render 之后显式调用。
 * 漏掉这一步的症状是「页面能看、但不能用」——静态截图完全正常。
 *
 * 关于 dispose：页面初始化函数可以返回一个清理函数。
 * 这里在替换 innerHTML **之前**调用上一个页面的清理函数。
 *
 * 为什么必须有这一步：`app.innerHTML = ...` 只会丢掉旧 DOM，
 * 而挂在 window / document 上的监听器与 requestAnimationFrame 循环
 * 并不属于 DOM，它们不会随 innerHTML 一起消失。实测宣纸模拟器每被
 * 访问一次就多留一个动画循环，离开页面后仍以约 200 次/秒持续运行。
 * 评委来回切页是很自然的操作，因此这属于必须处理的缺陷。
 */
let disposeCurrent = null;

async function render(html, { title, init } = {}) {
  if (typeof disposeCurrent === 'function') {
    try { disposeCurrent(); } catch (err) { console.error('页面清理失败', err); }
  }
  disposeCurrent = null;

  const app = document.getElementById('app');
  app.innerHTML = `
    ${Header()}
    <main id="main" tabindex="-1">${html}</main>
    ${Footer(meta)}`;

  // initHeader 每次渲染都会重建页头，并在 window / document 上挂
  // hashchange、keydown、scroll 三个监听器。它们不属于被 innerHTML
  // 替换掉的 DOM，因此必须显式摘除，否则每翻一页就多留一份。
  const disposeHeader = initHeader();

  const pageDisposers = [];
  if (typeof disposeHeader === 'function') pageDisposers.push(disposeHeader);
  if (init) {
    try {
      const maybeDispose = init();
      // 约定：页面初始化函数可以返回一个清理函数（不返回则无需清理）。
      if (typeof maybeDispose === 'function') pageDisposers.push(maybeDispose);
    } catch (err) { console.error('页面初始化失败', err); }
  }
  if (pageDisposers.length) {
    disposeCurrent = () => { for (const fn of pageDisposers) fn(); };
  }

  if (title) document.title = `${title} · 匠作`;
  else document.title = '匠作 · 非物质文化遗产数字展馆';
  // 路由切换后回到页首（hash 路由不会自动滚动）
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------- 路由表 ---------------- */

route('/', async () => {
  const html = await HomePage();
  await render(html);
});

route('/gallery', async () => {
  const html = await GalleryPage();
  await render(html, { title: '非遗名录', init: initGallery });
});

route('/project/:id', async ({ params }) => {
  const { html, title, notFound } = await ProjectPage(params.id);
  if (notFound) {
    await render(EmptyState('未收录此项目',
      '该项目暂未建立详情页。你可以返回名录浏览，或查阅中国非物质文化遗产网。',
      '<p style="margin-top:1.5rem"><a class="btn btn-primary" href="#/gallery">返回名录</a></p>'), { title: '未收录' });
    return;
  }
  await render(html, { title });
});

route('/simulator', async () => {
  const html = await SimulatorPage();
  await render(html, { title: '技艺体验', init: initSimulator });
});

route('/inheritors', async () => {
  const { html, init } = await InheritorsPage();
  await render(html, { title: '传承人', init });
});

route('/inheritor/:id', async ({ params }) => {
  const { html, title, notFound } = await InheritorPage(params.id);
  if (notFound) {
    await render(EmptyState('未收录此传承人',
      '这位传承人的档案暂未收录。你可以返回传承人名录浏览，或查阅中国非物质文化遗产网。',
      '<p style="margin-top:1.5rem"><a class="btn btn-primary" href="#/inheritors">返回传承人名录</a></p>'), { title: '未收录' });
    return;
  }
  await render(html, { title });
});

route('/about', async () => {
  const html = await AboutPage();
  await render(html, { title: '关于本站', init: initAbout });
});

route('/ages', async () => {
  const { html, title } = await AgesPage();
  await render(html, { title });
});

setNotFound(async () => {
  await render(EmptyState('此页已散佚',
    '你访问的页面不存在。或许是路径有误，或许它本就不在这座展馆里。',
    '<p style="margin-top:1.5rem"><a class="btn btn-primary" href="#/">回到展馆入口</a></p>'), { title: '页面不存在' });
});

/* ---------------- 启动 ---------------- */

(async function boot() {
  try {
    meta = await getMeta();
  } catch (err) {
    console.warn('元数据加载失败，页面将使用默认值', err);
  }
  startRouter();
})();
