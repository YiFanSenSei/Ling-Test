import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const base = pathToFileURL(join(root, 'dist/index.html')).href;
const browser = await openTestBrowser();
try {
  const { evaluate: run, wait, send, click } = browser;
  for (const id of ['13978', '14376', '14306']) {
    await browser.go(base + `#/project/${id}`, "document.querySelector('.craft-study')");
    assert.equal(await run("document.querySelectorAll('.craft-study-steps svg').length"), 3);
  }
  console.log('✓ 三篇专题包含九幅原理示意');
  await browser.go(base + '#/simulator?tool=embroidery', "document.getElementById('canvas-embroidery')");
  // 直达页签会在下一帧定位面板，待其完成后再读取指针坐标。
  await sleep(200);
  assert(await run("document.getElementById('craft-result-embroidery').hidden"));
  const grid = await run(`(() => {
    const c = document.getElementById('canvas-embroidery'); c.scrollIntoView({block:'center',behavior:'instant'});
    const r = c.getBoundingClientRect(); const pad = Math.max(26, Math.min(r.width,r.height)*.08);
    const size = Math.min((r.width-pad*2)/80,(r.height-pad*2)/60);
    return {left:r.left+(r.width-80*size)/2, top:r.top+(r.height-60*size)/2, size};
  })()`);
  // 逐行真实鼠标拖过图纸，验证完成状态，而不是直接改进度值。
  for (let pass = 0; pass < 2; pass++) {
   for (let row = 0; row < 60; row++) {
    const y = grid.top + (row + .5) * grid.size;
    const x = grid.left + grid.size * .5;
    const end = grid.left + grid.size * 79.5;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: end, y, buttons: 1 });
    await sleep(20); // 让浏览器派发移动事件，避免快于刷新率的采样被合并。
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end, y, button: 'left', buttons: 0, clickCount: 1 });
  }
  }
  assert.equal(await run("document.getElementById('emb-progress-bar').getAttribute('aria-valuenow')"), '100',
    await run("document.getElementById('emb-covered').textContent"));
  await wait("!document.getElementById('craft-result-embroidery').hidden");
  assert.equal(await run("document.getElementById('emb-progress-bar').getAttribute('aria-valuenow')"), '100');
  await click('#clear-embroidery');
  assert(await run("document.getElementById('craft-result-embroidery').hidden"));
  console.log('✓ 苏绣绣满后显示札记，清空后恢复操作提示');

  await click('#tab-paper');
  await sleep(150);
  assert.equal(await run("document.getElementById('grade-even').textContent"), '—');
  await sleep(500);
  assert.equal(await run("document.getElementById('grade-even').textContent"), '—');
  const paper = await run(`(() => {const c=document.getElementById('canvas-paper');c.scrollIntoView({block:'center',behavior:'instant'});const r=c.getBoundingClientRect();return {x:r.x+r.width*.35,y:r.y+r.height*.6,w:r.width,h:r.height};})()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x:paper.x, y:paper.y, button:'left',buttons:1,clickCount:1 });
  for (let i = 0; i < 24; i++) {
    await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:paper.x+Math.sin(i*.4)*paper.w*.15,y:paper.y,buttons:1}); await sleep(45);
  }
  await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:paper.x,y:paper.y-paper.h*.15,buttons:1});
  await sleep(1500);
  await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:paper.x,y:paper.y-paper.h*.15,button:'left',buttons:0,clickCount:1});
  await wait("!document.getElementById('craft-result-paper').hidden");
  assert((await run("document.querySelector('#craft-result-paper .craft-result-metrics').textContent")).includes('匀度'));
  await click('#reset-paper');
  assert(await run("document.getElementById('craft-result-paper').hidden"));
  console.log('✓ 宣纸闲置不产生作品，实际荡帘、提帘后显示练习评价');

  await click('#tab-mortise'); await click('#auto-mortise');
  await wait("!document.getElementById('craft-result-mortise').hidden");
  await run(`window.__exportClicks=0;document.getElementById('save-mortise').addEventListener('click',e=>{window.__exportClicks++;e.stopImmediatePropagation();},true)`);
  await click('[data-export-result="mortise"]');
  assert.equal(await run('window.__exportClicks'), 1);
  await click('#reset-mortise');
  assert(await run("document.getElementById('craft-result-mortise').hidden"));
  console.log('✓ 榫卯完成显示札记，结果卡复用导出，重置后隐藏');

  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await browser.go(base + '#/project/14376', "document.querySelector('.craft-study')");
  await run("document.querySelector('.craft-study').scrollIntoView({block:'start',behavior:'instant'})");
  assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  mkdirSync(join(root,'_shots'),{recursive:true});
  const shot = await send('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(root,'_shots/craft-study-mobile.png'),Buffer.from(shot.data,'base64'));
  assert.equal(browser.errors.length,0,browser.errors.join('\n'));
} finally { browser.close(); }
