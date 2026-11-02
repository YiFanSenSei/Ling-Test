import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const base = pathToFileURL(join(root, 'dist/index.html')).href;
const counts = JSON.parse(readFileSync(join(root, 'public/data/meta.json'), 'utf8')).byCategory;
const browser = await openTestBrowser();
try {
  const { evaluate: run, wait, send } = browser;
  const choose = async (category, touch = false) => {
    const point = await run(`(() => {
      const link = [...document.querySelectorAll('[data-gallery-category]')].find(a => a.dataset.galleryCategory === ${JSON.stringify(category)});
      link.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = link.getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2};
    })()`);
    if (touch) {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    }
    await wait(`document.querySelector('.result-category')?.textContent === ${JSON.stringify(category)}`);
    await sleep(80);
  };
  await browser.go(base + '#/gallery', "document.querySelector('[data-gallery-category]')");
  assert.equal(await run("document.querySelectorAll('[data-gallery-category]').length"), 11);
  assert.equal(await run("document.querySelectorAll('[class*=shelf]').length"), 0);
  for (const category of Object.keys(counts)) {
    await choose(category);
    assert.equal(await run("document.querySelectorAll('[data-gallery-category][aria-current=true]').length"), 1);
    assert.equal(await run("Number(document.querySelector('.result-count strong').textContent.replaceAll(',', ''))"), counts[category]);
    await wait("document.activeElement.classList.contains('result-count')");
  }
  console.log('✓ 鼠标可选择全部十个门类，数量、选中状态与结果焦点正确');

  await browser.go(base + '#/gallery?q=' + encodeURIComponent('苏') + '&region=' + encodeURIComponent('江苏省') + '&batch=1&page=2', "document.querySelector('[data-gallery-category]')");
  await choose('传统美术');
  const params = new URLSearchParams((await run('location.hash')).split('?')[1]);
  assert.equal(params.get('q'), '苏'); assert.equal(params.get('region'), '江苏省'); assert.equal(params.get('batch'), '1');
  assert.equal(params.get('page'), null);
  await send('Page.reload'); await sleep(200);
  await wait("document.querySelector('[data-gallery-category=传统美术][aria-current=true]')");
  console.log('✓ 切换门类保留其他筛选、重置页码，刷新保留门类');

  await run("document.querySelector('[data-gallery-category=民俗]').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait("document.querySelector('.result-category')?.textContent === '民俗'");
  console.log('✓ 键盘可选择门类');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await browser.go(base + '#/gallery', "document.querySelector('[data-gallery-category]')");
  await choose('传统体育、游艺与杂技', true);
  assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  assert(await run("[...document.querySelectorAll('[data-gallery-category]')].every(a => a.getBoundingClientRect().height >= 44)"));
  console.log('✓ 手机触摸可选择长名称门类，无横向溢出，触摸高度达到 44px');
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
} finally { browser.close(); }
