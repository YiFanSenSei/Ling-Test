import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root=resolve(import.meta.dirname,'..');
const base=pathToFileURL(join(root,'dist/index.html')).href;
const b=await openTestBrowser();
try {
  const {evaluate:run,click,wait,send}=b;
  await b.go(base+'#/project/13978',"document.querySelector('.project-reading-nav')");
  assert.equal(await run("document.querySelectorAll('[data-reading-target]').length"),5);
  await click('[data-reading-target="project-inheritors"]');
  await wait("document.querySelector('[data-reading-target=project-inheritors]').getAttribute('aria-current')==='location'");
  assert.equal(await run('document.activeElement.id'),'project-inheritors');
  assert.equal(await run('location.hash'),'#/project/13978');
  assert(await run("document.getElementById('project-inheritors').getBoundingClientRect().top >= document.querySelector('.project-reading-nav').getBoundingClientRect().bottom"));
  assert((await run("document.querySelector('.inheritor-note').textContent")).includes('出生年份范围'));
  console.log('✓ 项目页内导航不破坏路由，定位不被固定导航遮挡，生年口径准确');

  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await sleep(150);
  await run('document.fonts.ready');
  await click('[data-reading-target="project-intro"]'); await sleep(150);
  assert(await run('document.documentElement.scrollWidth<=innerWidth'));
  assert(await run("document.getElementById('project-intro').getBoundingClientRect().top>=document.querySelector('.project-reading-nav').getBoundingClientRect().bottom-1"));
  mkdirSync(join(root,'_shots'),{recursive:true});
  const shot=await send('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(root,'_shots/project-reading-mobile.png'),Buffer.from(shot.data,'base64'));
  console.log('✓ 手机目录可操作且无溢出，项目正文定位完整');

  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const hash='#/inheritors?category='+encodeURIComponent('传统美术')+'&sort=name&page=2';
  await b.go(base+hash,"document.querySelectorAll('#inh-list .inh-card').length===24");
  assert.equal(await run("document.querySelector('#inh-sort [aria-pressed=true]').dataset.sort"),'name');
  assert((await run("document.getElementById('inh-page').textContent")).includes('第 2 /'));
  const saved=await run("(()=>{const a=document.querySelectorAll('#inh-list .inh-card')[5];a.scrollIntoView({block:'center',behavior:'instant'});return {y:scrollY,href:a.getAttribute('href'),hash:location.hash}})()");
  await run("document.querySelectorAll('#inh-list .inh-card')[5].click()"); await wait("document.querySelector('.inh-hero-name')");
  assert((await run("document.querySelector('.archive-list').textContent")).includes('所属项目公布批次'));
  assert.equal(await run("document.querySelector('.breadcrumb a[href^=\"#/inheritors\"]').getAttribute('href')"),saved.hash);
  await click('.breadcrumb a[href^="#/inheritors"]'); await wait("document.getElementById('inh-list')"); await sleep(150);
  assert.equal(await run('location.hash'),saved.hash);
  assert.equal(await run("document.activeElement.getAttribute('href')"),saved.href);
  assert(Math.abs((await run('scrollY'))-saved.y)<5);
  console.log('✓ 传承人筛选/排序/页码、返回位置与焦点恢复，档案批次含义明确');

  await run("document.getElementById('inh-q').value='姚';document.getElementById('inh-filters').dispatchEvent(new Event('submit',{cancelable:true}));location.hash='#/about'");
  await wait("document.getElementById('about-what')"); await sleep(150);
  assert.equal(await run('location.hash'),'#/about');
  await click('[data-toc="about-data"]'); await wait("document.querySelector('[data-toc=about-data]').getAttribute('aria-current')==='location'");
  assert.equal(await run('document.activeElement.id'),'about-data');
  assert((await run("document.getElementById('about-data').textContent")).includes('并非传承人的认定批次'));
  console.log('✓ 搜索后立刻切页不被旧结果改回列表；关于页目录定位和统计口径正确');

  await b.go(base+'#/inheritors?page=2.9&sort=invalid&category=invalid',"document.getElementById('inh-list')");
  assert.equal(await run('location.hash'),'#/inheritors?page=2');
  await b.go(base+'#/inheritors?page=Infinity',"document.getElementById('inh-list')");
  assert.equal(await run('location.hash'),'#/inheritors');
  await run("document.getElementById('inh-q').value='不存在的检索词';document.getElementById('inh-filters').dispatchEvent(new Event('submit',{cancelable:true}))");
  await wait("document.querySelector('#inh-list .empty-note')");
  await click('#inh-reset'); await wait("document.querySelectorAll('#inh-list .inh-card').length===24");
  assert.equal(await run('location.hash'),'#/inheritors');
  assert(await run("document.getElementById('inh-reset').hidden"));
  await run("document.getElementById('inh-q').value='姚';document.getElementById('inh-filters').dispatchEvent(new Event('submit',{cancelable:true}));location.hash='#/inheritors?sort=name'");
  await wait("document.querySelector('#inh-sort [aria-pressed=true]')?.dataset.sort==='name'");
  assert.equal(await run('location.hash'),'#/inheritors?sort=name');
  assert.equal(await run("document.getElementById('inh-q').value"),'');
  await b.go(base+'#/ages',"document.querySelector('.birth-row')");
  assert((await run("document.querySelector('caption').textContent")).includes('项目公布批次'));
  console.log('✓ 小数、无穷页码及无效筛选被规范化，年代统计明确按项目批次归集');

  await run("window.__frames=0;const original=requestAnimationFrame;window.requestAnimationFrame=callback=>original(t=>{window.__frames++;callback(t)})");
  for(const route of ['#/about','#/project/13978','#/about']) {
    await run(`location.hash=${JSON.stringify(route)}`); await sleep(100);
  }
  await run("location.hash='#/inheritors'"); await wait("document.getElementById('inh-list')"); await sleep(150);
  await run('window.__frames=0'); await run('window.scrollBy(0,200)'); await sleep(150);
  assert.equal(await run('window.__frames'),0,'阅读页离开后不残留滚动监听动画');
  assert.equal(b.errors.length,0,b.errors.join('\n'));
  console.log('✓ 阅读导航离页后释放滚动回调，控制台无报错');
}finally{b.close()}
