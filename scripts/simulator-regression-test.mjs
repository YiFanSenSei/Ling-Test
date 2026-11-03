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
  const count = () => run("Number(document.getElementById('stitch-count').textContent)");
  const key = async (name, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: { ArrowUp:38, ArrowDown:40, Enter:13 }[name] || 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code });
  };
  await browser.go(pathToFileURL(join(root, 'dist/index.html')).href + '#/simulator', "document.getElementById('canvas-embroidery')");
  await sleep(150);
  const recommended = await run("document.querySelector('[data-stitch].is-active').dataset.stitch");
  await click('#auto-stitch');
  await click(`[data-stitch="${recommended === 'satin' ? 'seed' : 'satin'}"]`);
  await run("document.getElementById('canvas-embroidery').focus()");
  await browser.space();
  assert((await count()) > 0);
  assert.equal(await run("document.getElementById('emb-stitchfit').textContent"), '0%');
  await click('#repair-embroidery');
  assert.equal(await count(), 0);
  await click('#undo-embroidery');
  assert((await count()) > 0, '拆除错针可撤销');
  await click('#repair-embroidery'); await click('#auto-stitch');
  await run("document.getElementById('canvas-embroidery').focus()"); await browser.space();
  assert.equal(await run("document.getElementById('emb-stitchfit').textContent"), '100%');
  console.log('✓ 苏绣手动错针真实扣分、拆除可撤销、跟随图纸后契合');

  await click('[data-template="free"]'); await click('[data-stitch="seed"]'); await click('[data-thread="red"]');
  const rect = await run(`(() => { const c=document.getElementById('canvas-embroidery');c.scrollIntoView({block:'center',behavior:'instant'}); const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; })()`);
  async function stroke(y) {
    await send('Input.dispatchMouseEvent', {type:'mousePressed',x:rect.x+rect.w*.2,y,button:'left',buttons:1,clickCount:1});
    for (let i=1;i<=12;i++) {
      await send('Input.dispatchMouseEvent', {type:'mouseMoved',x:rect.x+rect.w*(.2+i*.045),y,buttons:1});
      await sleep(20);
    }
    await send('Input.dispatchMouseEvent', {type:'mouseReleased',x:rect.x+rect.w*.74,y,button:'left',buttons:0,clickCount:1});
  }
  await stroke(rect.y+rect.h*.4); const first = await count();
  assert(first>0); await stroke(rect.y+rect.h*.6); assert((await count())>first);
  await click('#undo-embroidery'); assert.equal(await count(),first);
  console.log('✓ 自由绣按一次完整拖动撤销，不误删上一笔');
  const redCenter = () => run(`(() => {
    const c=document.getElementById('canvas-embroidery'), d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let x=0,y=0,n=0;
    for(let row=0;row<c.height;row++)for(let col=0;col<c.width;col++){
      const i=(row*c.width+col)*4;
      if(d[i]>d[i+1]*1.4 && d[i]>d[i+2]*1.4){x+=col/c.width;y+=row/c.height;n++;}
    }
    return {x:x/n,y:y/n,n};
  })()`);
  const beforeResize=await redCenter(); assert(beforeResize.n>0);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await sleep(200);
  const afterResize=await redCenter(); assert(afterResize.n>0);
  assert(Math.abs(beforeResize.x-afterResize.x)<.03 && Math.abs(beforeResize.y-afterResize.y)<.03,`自由绣缩放后位置保持 ${JSON.stringify({beforeResize,afterResize})}`);
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false}); await sleep(200);
  console.log('✓ 自由绣改变屏幕尺寸后针脚位置保持，不被裁出画布');

  await click('#tab-paper'); await sleep(150);
  const paper = await run(`(() => {const c=document.getElementById('canvas-paper');c.scrollIntoView({block:'center',behavior:'instant'});const r=c.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.6};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...paper,button:'left',buttons:1,clickCount:1});
  await sleep(600);
  assert.equal(await run("document.getElementById('paper-deposit').textContent"),'0%');
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:paper.x,y:paper.y-60,buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:paper.x,y:paper.y-60,button:'left',buttons:0,clickCount:1});
  await sleep(2600);
  assert(await run("document.getElementById('craft-result-paper').hidden"));
  assert(await run("document.getElementById('lift-paper').disabled"));
  console.log('✓ 宣纸静按不积浆、空帘上提不完成');
  for(let i=0;i<8;i++){ await click(i%2?'#swing-paper-left':'#swing-paper-right'); await sleep(180); }
  assert.equal(await run("document.getElementById('lift-paper').disabled"),false);
  assert(await run("document.getElementById('paper-bark').disabled"));
  await sleep(300); const paused = await run("document.getElementById('paper-deposit').textContent");
  await sleep(450); assert.equal(await run("document.getElementById('paper-deposit').textContent"),paused);
  await click('#lift-paper'); await wait("!document.getElementById('craft-result-paper').hidden");
  assert.equal(await run("document.getElementById('save-paper').disabled"),false);
  console.log('✓ 宣纸按钮可走完整工序、停手后不积浆、进行中锁定配方');

  await click('#tab-mortise'); await click('#auto-mortise'); await sleep(180); await click('#reset-mortise'); await sleep(1300);
  assert.equal(await run("document.getElementById('canvas-mortise').mortiseHandle().t"),0);
  await click('#auto-mortise'); await sleep(180); await click('[data-joint="mortise"]'); await sleep(1300);
  assert.equal(await run("document.getElementById('canvas-mortise').mortiseHandle().t"),0);
  for(let i=0;i<10;i++) await click('#advance-mortise');
  assert.equal(await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')"),'100');
  await click('#pull-mortise'); await sleep(400);
  assert((await run("document.getElementById('joint-tip').textContent")).includes('不防脱'));
  await sleep(600);
  await run("document.getElementById('canvas-mortise').focus()"); await key('ArrowDown','ArrowDown');
  assert.equal(await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')"),'90');
  await key('ArrowUp','ArrowUp');
  assert((await run("document.querySelector('#craft-result-mortise .craft-result-metrics').textContent")).includes('亲手拼合'));
  await click('[data-view="front"]'); assert.equal(await run("document.querySelector('[data-view=front]').getAttribute('aria-checked')"),'true');
  console.log('✓ 榫卯重置/换型取消演示、按钮和键盘可拼合、试提解释结构差异');

  mkdirSync(join(root,'_shots'),{recursive:true});
  for (const width of [1440,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    for(const tool of ['embroidery','paper','mortise']){
      await click(`#tab-${tool}`); await sleep(200);
      await run(`document.querySelector('#panel-${tool} .sim-stage').scrollIntoView({block:'start',behavior:'instant'})`);
      assert(await run('document.documentElement.scrollWidth<=innerWidth'),`${tool} ${width} 溢出`);
      const shot=await send('Page.captureScreenshot',{format:'png'});
      writeFileSync(join(root,`_shots/simulator-${tool}-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  }
  assert.equal(browser.errors.length,0,browser.errors.join('\n'));
  console.log('✓ 三个体验桌面/390px 无溢出，控制台无报错，截图已保存');
} finally { browser.close(); }
