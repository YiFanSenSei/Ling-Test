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
  ['simulator', '#/simulator'], ['works', '#/works'], ['about', '#/about'],
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
  await wait("document.querySelectorAll('.cat-card.reveal-shown').length >= 3");
  const starts = await run(`[...document.querySelectorAll('.cat-card')].slice(0, 3).map(card =>
    card.getAnimations().find(animation => animation.animationName === 'home-enter')
      ?.effect.getKeyframes()[0].translate.split(' ').map(parseFloat))`);
  assert(starts[0]?.[0] < 0 && starts[1]?.[1] > 0 && starts[2]?.[0] > 0);
  assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  await run(`window.firstEntrance = document.querySelector('.cat-card').getAnimations()
    .find(animation => animation.animationName === 'home-enter');
    scrollTo({top:0, behavior:'instant'})`);
  await wait("document.querySelector('.cat-card').classList.contains('reveal-pending')");
  await run("document.querySelector('.cat-card').scrollIntoView({behavior:'instant',block:'center'})");
  await wait(`document.querySelector('.cat-card').getAnimations().some(animation =>
    animation.animationName === 'home-enter' && animation !== window.firstEntrance)`);
  await run("Promise.all(document.querySelector('.cat-card').getAnimations().map(animation=>animation.finished))");
  const point = await run(`(() => {
    const card = document.querySelector('.cat-card').getBoundingClientRect();
    return { x:card.left + card.width / 2, y:card.top + card.height / 2 };
  })()`);
  await send('Input.dispatchMouseEvent', { type:'mouseMoved', ...point });
  await wait("parseFloat(getComputedStyle(document.querySelector('.cat-card')).scale) > 1.01");
  console.log('✓ 卡片多方向入场，离开后重新滚入会回放，鼠标悬停有放大反馈');

  await send('Emulation.setEmulatedMedia', { features: [{ name:'prefers-reduced-motion', value:'reduce' }] });
  await wait("getComputedStyle(document.querySelector('.cat-card')).scale === 'none'");
  for (const width of [1920, 1440, 720, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:width<=720 });
    for (const [key, route] of routes) {
      await browser.go(base + route, readyPhoto(key));
      assert(await run('document.documentElement.scrollWidth <= innerWidth'), `${width}px ${route}`);
      assert(await run("document.querySelector('.exhibit-photo figcaption a').host === 'www.metmuseum.org'"));
      if (key === 'home') await wait("getComputedStyle(document.querySelector('.cat-card')).opacity === '1'");
      else {
        const layout = await run(`(() => {
          const copy = document.querySelector('.exhibit-copy').getBoundingClientRect();
          const photo = document.querySelector('.page-head--exhibit .exhibit-photo');
          const figure = photo.getBoundingClientRect();
          return { full:Math.abs(figure.width - document.documentElement.clientWidth) < 1,
            half:Math.abs(figure.height - innerHeight / 2) < 2, stacked:copy.top >= figure.bottom,
            fit:getComputedStyle(photo.querySelector('img')).objectFit };
        })()`);
        assert(layout.full && layout.half && layout.stacked && layout.fit === 'cover', `${width}px ${key} 通栏布局`);
      }
      if (width === 1440 && key !== 'home') await shot('exhibition-' + key + '-desktop');
      if (width === 390 && ['home','inheritors','gallery'].includes(key)) {
        await shot('exhibition-' + key + '-mobile', key === 'home' ? '.hero' : '.page-head--exhibit');
      }
    }
  }
  console.log('✓ 五个栏目在五种屏宽下均为上方半屏通栏图、下方正文，减弱动态时内容直接呈现');

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
