import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openTestBrowser } from './lib/browser-test.mjs';

const browser = await openTestBrowser();
try {
  const { send, evaluate: run, go, wait } = browser;
  const base = pathToFileURL(resolve(import.meta.dirname, '../dist/index.html')).href;
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__introEvents=[];
    document.addEventListener('animationend',e=>{
      if(e.target.closest?.('#intro')) window.__introEvents.push({name:e.animationName,own:e.target.id==='intro',t:performance.now()});
    },true);
    new MutationObserver(records=>{for(const r of records){
      if(r.type==='attributes' && r.target.id==='intro')window.__introEvents.push({name:'out',t:performance.now()});
      for(const n of r.removedNodes||[])if(n.id==='intro')window.__introEvents.push({name:'removed',t:performance.now()});
    }}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['data-state']});
  ` });
  await go(base + '?case=normal', "document.querySelector('.hero')");
  await wait("!document.getElementById('intro')");
  const events = await run('window.__introEvents');
  const out = events.find(e => e.name === 'out');
  const lift = events.find(e => e.name === 'introLift' && e.own);
  const removed = events.find(e => e.name === 'removed');
  assert(out && lift && removed, JSON.stringify(events));
  assert(events.some(e => e.name === 'ijSlide' && e.t < out.t), '榫条须在揭幕前推入到位');
  assert(removed.t >= lift.t && removed.t - out.t >= 650, JSON.stringify(events));
  assert(events.some(e => !e.own && e.name !== 'removed' && e.t > out.t && e.t < lift.t), '子动画结束后仍等待整张纸揭起');
  assert.equal(await run("document.getElementById('app').inert"), false);
  assert.equal(await run("getComputedStyle(document.querySelector('.intro-edge')).display"), 'none');
  console.log(`✓ 正常揭幕完整播放，${Math.round(removed.t-out.t)}ms 后移除，子动画不会截断`);

  await go(base + '?case=escape', "document.getElementById('intro') && document.querySelector('.hero')");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  assert.equal(await run("document.getElementById('app').inert"), false);
  await wait("!document.getElementById('intro')");
  console.log('✓ Escape 跳过立即释放页面交互，随后移除遮罩');

  await go(base + '?case=fallback', "document.getElementById('intro') && document.querySelector('.hero')");
  await run(`const style=document.createElement('style');style.textContent='#intro,#intro *{animation:none!important}';document.head.append(style);document.querySelector('.intro-skip').click();
    document.querySelector('.intro-stage').dispatchEvent(new AnimationEvent('animationend',{animationName:'introLift',bubbles:true}));
    document.getElementById('intro').dispatchEvent(new AnimationEvent('animationend',{animationName:'introUp',bubbles:true}));`);
  assert(await run("Boolean(document.getElementById('intro'))"));
  await wait("!document.getElementById('intro')");
  assert.equal(await run("document.getElementById('app').inert"), false);
  console.log('✓ 无关动画事件被忽略，CSS 动画停用时超时兜底仍有效');

  for (const [width, height] of [[844,390], [720,400], [320,480], [320,360]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await go(base + '?case=short-' + width + '-' + height, "document.querySelector('.intro-joint-cap')");
    const layout = await run(`(() => {
      const intro = document.getElementById('intro');
      for (const child of intro.children) {
        for (const animation of child.getAnimations({subtree:true})) {
          if (animation.effect.getTiming().iterations !== Infinity) animation.finish();
        }
      }
      const stage = intro.querySelector('.intro-stage').getBoundingClientRect();
      const skip = intro.querySelector('.intro-skip').getBoundingClientRect();
      return stage.top >= 0 && stage.bottom <= skip.top && skip.bottom <= innerHeight && skip.height >= 44;
    })()`);
    assert(layout, `${width}×${height} 开屏内容与跳过按钮须完整显示`);
  }
  console.log('✓ 横屏和矮窗口的榫卯图版、提示与跳过入口无裁切或重叠');

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await go(base + '?case=reduced#/simulator?tool=paper', "document.getElementById('canvas-paper')");
  assert.equal(await run("Boolean(document.getElementById('intro'))"), false);
  assert.equal(await run("document.getElementById('app').inert"), false);
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
  console.log('✓ 减少动态效果模式直接进入体验页，控制台无错误');
} finally { browser.close(); }
