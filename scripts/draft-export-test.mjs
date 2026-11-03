import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const browser = await openTestBrowser();
try {
  const { evaluate: run, send, click, wait } = browser;
  const base = pathToFileURL(join(root,'dist/index.html')).href;
  const reload = async () => { await send('Page.reload'); await sleep(150); await wait("document.getElementById('canvas-paper')"); };
  const progress = () => run("document.getElementById('paper-deposit').textContent");
  await browser.go(base+'#/simulator?tool=paper', "document.getElementById('canvas-paper')");
  await run("document.getElementById('paper-bark').value=75;document.getElementById('paper-bark').dispatchEvent(new Event('input'));document.getElementById('paper-lines').value=32;document.getElementById('paper-lines').dispatchEvent(new Event('input'))");
  for(let i=0;i<5;i++){ await click(i%2?'#swing-paper-left':'#swing-paper-right'); await sleep(180); }
  await sleep(250); const before=await progress(); assert(parseInt(before)>25);
  await run("location.hash='#/about'"); await wait("document.getElementById('about-what')");
  await run("location.hash='#/simulator?tool=paper'"); await wait("document.getElementById('paper-deposit')");
  assert.equal(await progress(),before);
  assert.equal(await run("document.getElementById('paper-bark').value"),'75');
  assert.equal(await run("document.getElementById('paper-lines').value"),'32');
  await reload(); assert.equal(await progress(),before);
  await click('#lift-paper'); await sleep(200); await reload();
  await wait("!document.getElementById('craft-result-paper').hidden");
  const grade = await run("document.getElementById('grade-rank').textContent");
  await reload(); assert.equal(await run("document.getElementById('grade-rank').textContent"),grade);
  assert.equal(await run("document.getElementById('craft-result-paper').hidden"),false);
  await click('#reset-paper'); await reload(); assert.equal(await progress(),'0%');
  assert.equal(await run("document.getElementById('paper-bark').disabled"),false);
  console.log('✓ 宣纸跨页/刷新恢复配方与积浆，沥水可继续，成品及重置状态持久保存');

  await click('#tab-mortise'); await click('[data-joint="miter"]');
  for(let i=0;i<4;i++) await click('#advance-mortise');
  await click('[data-view="front"]'); await sleep(400); await reload();
  assert.equal(await run("document.querySelector('[data-joint].is-active').dataset.joint"),'miter');
  assert.equal(await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')"),'40');
  assert.equal(await run("document.querySelector('[data-view].is-active').dataset.view"),'front');
  await click('#reset-mortise'); await reload();
  assert.equal(await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')"),'0');
  console.log('✓ 榫卯刷新恢复构件类型、视角与拼合深度，归位后不会恢复旧进度');

  await run("location.hash='#/about'"); await wait("document.getElementById('about-what')");
  await run("localStorage.setItem('jz-paper-v1','{broken');localStorage.setItem('jz-mortise-v1',JSON.stringify({version:1,joint:'miter',t:'bad'}))");
  await send('Page.reload'); await sleep(150); await wait("document.getElementById('about-what')");
  await run("location.hash='#/simulator?tool=paper'"); await wait("document.getElementById('canvas-paper')");
  assert.equal(await progress(),'0%');
  assert.equal(await run("document.querySelector('[data-joint].is-active').dataset.joint"),'dovetail');
  await run("Storage.prototype.setItem=function(){throw new DOMException('blocked','QuotaExceededError')}");
  await click('#tab-paper'); await click('#swing-paper-left'); await sleep(850);
  await wait("document.getElementById('paper-draft-status').textContent.includes('暂存')");
  const temporary=await progress();
  await run("location.hash='#/about'"); await wait("document.getElementById('about-what')");
  await run("location.hash='#/simulator?tool=paper'"); await wait("document.getElementById('paper-deposit')");
  assert.equal(await progress(),temporary);
  console.log('✓ 损坏草稿不阻塞页面，存储拒绝时明确提示并在本次浏览中恢复');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('#tab-mortise'); await click('#auto-mortise'); await wait("!document.getElementById('craft-result-mortise').hidden");
  await click('[data-submit-work="mortise"]');
  assert.equal(await run("document.getElementById('work-title').value"),'榫卯 · 燕尾榫');
  const initialImage=await run("document.getElementById('work-preview').src");
  await run(`window.__text=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(!this.canvas.isConnected)window.__text.push({text,x,y,align:this.textAlign,width:this.measureText(text).width,canvasWidth:this.canvas.width,canvasHeight:this.canvas.height});return original.call(this,text,x,y,...rest)};
    const title=document.getElementById('work-title');title.value='一份很长的中文作品标题，用来验证手机导出时能够自动换行，完整呈现作品名称与本次练习记录'.repeat(2).slice(0,80);title.dispatchEvent(new Event('input'));`);
  const editedImage=await run("document.getElementById('work-preview').src"); assert.notEqual(editedImage,initialImage);
  const texts=await run('window.__text');
  assert(texts.length>5);
  const previewTitle=await run("document.getElementById('work-title').value");
  assert.equal(texts.filter(t=>t.y<texts.find(n=>n.text.includes('匠作')).y && t.text!=='匠').map(t=>t.text).join(''),previewTitle);
  for(const item of texts.filter(t=>t.text!=='匠')) {
    const left=item.align==='right'?item.x-item.width:item.x;
    assert(left>=0 && left+item.width<=item.canvasWidth+1,`导出文字越界 ${item.text}`);
  }
  const date=texts.find(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.text));
  assert(date && texts.filter(t=>t!==date && t.text!=='匠').every(t=>t.y<date.y));
  assert(texts.some(t=>t.text.includes('自动演示')));
  mkdirSync(join(root,'_shots'),{recursive:true});
  writeFileSync(join(root,'_shots/export-mobile-long-title.png'),Buffer.from(editedImage.split(',')[1],'base64'));
  console.log('✓ 手机投稿预览采用真实作品名，编辑标题更新 PNG，长标题/说明换行且日期单独成行');
  await click('#work-dialog-close');
  await run("window.__frames=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=callback=>raf(time=>{window.__frames++;callback(time)})");
  for(const tool of ['paper','embroidery','mortise']) {
    await run("location.hash='#/about'"); await wait("document.getElementById('about-what')");
    await run(`location.hash='#/simulator?tool=${tool}'`); await wait("document.getElementById('canvas-paper')");
  }
  await run("location.hash='#/about'"); await wait("document.getElementById('about-what')"); await sleep(100);
  await run('window.__frames=0'); await sleep(400); assert.equal(await run('window.__frames'),0);
  console.log('✓ 连续进出体验页后无残留动画帧');
  assert.equal(browser.errors.length,0,browser.errors.join('\n'));
} finally { browser.close(); }
