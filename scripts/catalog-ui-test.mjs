import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const base = pathToFileURL(join(root, 'dist/index.html')).href;
const browser = await openTestBrowser();
try {
  const { evaluate: run, send, wait, click } = browser;
  const screenshot = async (name, selector, limit = 1400) => {
    await run('document.fonts.ready');
    const rect = await run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:Math.min(r.height,${limit}),scale:1}})()`);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: rect });
    mkdirSync(join(root, '_shots'), { recursive: true });
    writeFileSync(join(root, '_shots', name), Buffer.from(shot.data, 'base64'));
  };
  await browser.go(base + '#/', "document.querySelectorAll('.pcard').length===8");
  assert.equal(await run("document.querySelectorAll('.pcard-glyph').length"), 0);
  assert.equal(await run("document.querySelectorAll('.pcard-curation').length"), 8);
  const art = await run("[...document.querySelectorAll('.pcard svg')].map(svg=>svg.dataset.cover)");
  assert.equal(new Set(art).size, 8, '八项精选分别使用对应工艺封面');
  await screenshot('catalog-home-desktop.png', '.card-grid');
  await click('.pcard[href="#/project/13978"]'); await wait("document.querySelector('.curation-note')");
  assert(await run("document.querySelector('.curation-note').textContent.includes('怎样由针脚组织出来')"));
  assert(await run("document.querySelector('.project-no').textContent.length>0"));
  console.log('✓ 精选封面各自可辨识，点击进入项目详情，完整编号和策展问题仍可阅读');

  const categories = ['民间文学','传统音乐','传统舞蹈','传统戏剧','曲艺','传统体育、游艺与杂技','传统美术','传统技艺','传统医药','民俗'];
  for (const category of categories) {
    await browser.go(base + '#/gallery?category=' + encodeURIComponent(category), "document.querySelector('.pcard')");
    assert(await run("[...document.querySelectorAll('.pcard-media svg')].every(svg=>svg.querySelector('path') && svg.getAttribute('aria-hidden')==='true' && getComputedStyle(svg).opacity==='1')"), category);
    assert(await run("(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return new Set(ids).size===ids.length})()"), '重复图案不产生重复 SVG id');
  }
  await browser.go(base+'#/gallery?q='+encodeURIComponent('梁祝传说'), "document.querySelector('.pcard')");
  assert(await run("[...document.querySelectorAll('.pcard svg')].every(svg=>svg.dataset.cover==='butterfly')"));
  assert(await run("[...document.querySelectorAll('.pcard')].every(card=>card.getAttribute('aria-label').includes(card.querySelector('.pcard-region').textContent))"));
  await screenshot('catalog-literature-desktop.png', '.card-grid', 900);
  console.log('✓ 十类名录封面正常；同源项目跨地区封面一致，链接名称包含申报单位');

  for (const width of [1920, 1440, 834, 720, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 });
    for (const hash of ['#/', '#/gallery?category='+encodeURIComponent('传统技艺')]) {
      await browser.go(base+hash, "document.querySelector('.pcard')");
      await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert(await run('document.documentElement.scrollWidth<=innerWidth'), `${width}px 页面溢出`);
      assert(await run("[...document.querySelectorAll('.pcard')].every(card=>card.scrollWidth<=card.clientWidth+1 && card.querySelector('.pcard-name').scrollHeight<=card.querySelector('.pcard-name').clientHeight+1)"), `${width}px 卡片内容被裁切`);
      const columns = await run("getComputedStyle(document.querySelector('.card-grid')).gridTemplateColumns.split(' ').length");
      if (width >= 1440) assert.equal(columns, 4);
      if (width <= 390) assert.equal(columns, 1);
      if (width === 390 && hash === '#/') await screenshot('catalog-home-mobile.png', '.card-grid', 930);
    }
  }
  await run("document.querySelector('.pcard').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait("document.querySelector('.project')");
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
  console.log('✓ 1920/1440/834/720/390/320px 首页与名录无溢出、无标题截断，原生 Enter 可进入详情，离线无异常');
} finally { browser.close(); }
