import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openTestBrowser } from './lib/browser-test.mjs';

const base = pathToFileURL(resolve('dist/index.html')).href;
const browser = await openTestBrowser();
const { evaluate: run, send, wait, click } = browser;
const shot = async (name, selector) => {
  await run('document.fonts.ready');
  const clip = selector && await run(`(() => {
    const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x:box.x + scrollX, y:box.y + scrollY, width:box.width, height:Math.min(box.height, 900), scale:1 };
  })()`);
  const pic = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!clip, ...(clip && { clip }) });
  mkdirSync('_shots', { recursive: true });
  writeFileSync(`_shots/${name}.png`, Buffer.from(pic.data, 'base64'));
};
const routes = [
  ['home', '#/'], ['gallery', '#/gallery'], ['inheritors', '#/inheritors'],
  ['simulator', '#/simulator?tool=embroidery'], ['works', '#/works'], ['about', '#/about'],
];
const readyPhoto = key => `document.querySelector('.exhibit-photo--${key} img')?.naturalWidth > 0`;

try {
  await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'no-preference' }] });
  await browser.go(base + '#/', `${readyPhoto('home')} && !document.getElementById('intro')`);
  await run("Promise.all(document.querySelector('.hero').getAnimations({subtree:true}).map(animation=>animation.finished))");
  await shot('exhibition-home-desktop');
  assert(await run("document.querySelector('.cat-card').classList.contains('reveal-pending')"));
  await click('.hero-scroll');
  await wait("!document.querySelector('.sim-promo-copy').classList.contains('reveal-pending')");
  assert.equal(await run('document.activeElement.id'), 'home-experiences');
  assert.equal(await run('location.hash'), '#/');
  await run("document.querySelector('.cat-card').scrollIntoView({behavior:'instant',block:'center'})");
  await wait("!document.querySelector('.cat-card').classList.contains('reveal-pending')");
  console.log('✓ 首屏展开、可操作的向下入口与首次进入视口时浮现');

  await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
  for (const width of [1920, 1440, 720, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:width<=720 });
    for (const [key, route] of routes) {
      await browser.go(base + route, readyPhoto(key));
      assert(await run('document.documentElement.scrollWidth <= innerWidth'), `${width}px ${route}`);
      assert(await run("document.querySelector('.exhibit-photo figcaption a').host === 'www.metmuseum.org'"));
      if (key === 'home') await wait("getComputedStyle(document.querySelector('.cat-card')).opacity === '1'");
      if (width === 1440 && key !== 'home') await shot('exhibition-' + key + '-desktop', '.page-head--exhibit');
      if (width === 390 && ['home','inheritors','gallery'].includes(key)) {
        await shot('exhibition-' + key + '-mobile', key === 'home' ? '.hero' : '.page-head--exhibit');
      }
    }
  }
  console.log('✓ 六张本地馆藏图在五种屏宽均可加载，来源可访问，减弱动态时内容直接显示');

  for (const id of ['eight-words','split-silk','double-sided','stitch-families']) {
    await browser.go(base + '#/simulator?tool=embroidery', "document.querySelector('.knowledge-link')");
    await click(`a[href="#/project/13978?term=${id}"]`);
    await wait(`document.activeElement.parentElement?.dataset.embroideryTerm === '${id}'`);
    assert(await run("document.activeElement.parentElement.open && document.activeElement.getBoundingClientRect().top >= document.querySelector('.project-reading-nav').getBoundingClientRect().bottom"));
  }
  await browser.go(base + '#/project/13978?term=split-silk', "document.activeElement.parentElement?.dataset.embroideryTerm === 'split-silk'");
  console.log('✓ 四个词条均可跳转与聚焦，直接访问也会展开正确内容');

  await browser.go(base + '#/inheritors', "document.querySelector('#inh-ethnicity')");
  await click('.inh-stat[href="#/inheritors/ethnicities"]');
  await wait("document.querySelector('.ethnicity-grid')");
  const directory = await run(`[...document.querySelectorAll('.ethnicity-grid a')].map(link => ({
    name:link.querySelector('strong').textContent, href:link.getAttribute('href')
  }))`);
  assert.equal(directory.length,53);
  const miao = directory.find(entry=>entry.name === '苗族');
  assert(miao);
  await click(`.ethnicity-grid a[href="${miao.href}"]`);
  await wait("document.querySelector('#inh-ethnicity')?.value === '苗族'");
  assert(await run("[...document.querySelectorAll('#inh-list .inh-card')].every(card=>card.querySelector('.inh-meta').textContent.includes('苗族') && !card.querySelector('.inh-code'))"));
  await click('#inh-category [data-category="民间文学"]');
  await wait("new URLSearchParams(location.hash.split('?')[1]).get('category') === '民间文学'");
  assert(await run("[...document.querySelectorAll('#inh-list .inh-card')].every(card => card.querySelector('.inh-cat').textContent === '民间文学' && card.querySelector('.inh-meta').textContent.includes('苗族'))"));
  await run("document.querySelector('#inh-ethnicity').value = '汉族'; document.querySelector('#inh-ethnicity').dispatchEvent(new Event('change',{bubbles:true}))");
  await wait("new URLSearchParams(location.hash.split('?')[1]).get('ethnicity') === '汉族'");
  await click('#inh-list .inh-card');
  await wait("document.querySelector('.archive-list')?.textContent.includes('官方编号')");
  await click('.breadcrumb a[href^="#/inheritors"]');
  await wait("document.querySelector('#inh-ethnicity')?.value === '汉族'");
  await click('#inh-reset');
  await wait("location.hash === '#/inheritors' && document.querySelector('#inh-ethnicity').value === ''");
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
  console.log('✓ 民族分布 53 类、民族与门类组合筛选、清除和详情返回均正常');
} finally {
  browser.close();
}
