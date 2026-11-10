import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root=resolve(import.meta.dirname,'..'), base=pathToFileURL(join(root,'dist/index.html')).href;
const b=await openTestBrowser();
try {
  const {evaluate:run,wait,click,send}=b;
  const waitForSearch = keyword => wait(`document.querySelector('[data-remove-filter="q"] span')?.textContent === ${JSON.stringify(keyword)}
    && document.activeElement.id === 'f-q'`);
  await b.go(base+'#/gallery',"document.getElementById('f-q')");
  await run("document.getElementById('f-q').focus();window.scrollTo({top:200,behavior:'instant'})");
  await send('Input.insertText',{text:'苏绣'});
  await waitForSearch('苏绣');
  assert.equal(await run("document.getElementById('f-q').selectionStart"),2);
  assert(Math.abs(await run('scrollY')-200)<2);
  await send('Input.insertText',{text:'制作'});
  await waitForSearch('苏绣制作');
  assert.equal(await run('document.activeElement.id'),'f-q');
  await run("document.getElementById('f-q').setSelectionRange(0,2)");
  await send('Input.insertText',{text:'宣纸'});
  await waitForSearch('宣纸制作');
  assert.equal(await run("document.getElementById('f-q').selectionStart"),2);
  console.log('✓ 自动搜索保留焦点、选区与滚动，真实连续输入和中途改字可完成');

  await run("const input=document.getElementById('f-q');input.value='苏绣';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new CompositionEvent('compositionstart'))");
  await sleep(550);
  assert.equal(await run("new URLSearchParams(location.hash.split('?')[1]).get('q')"),'宣纸制作');
  await run("document.getElementById('f-q').dispatchEvent(new CompositionEvent('compositionend'))");
  await wait("new URLSearchParams(location.hash.split('?')[1]).get('q')==='苏绣'");
  await run("document.getElementById('f-q').value='宣纸';document.getElementById('f-q').dispatchEvent(new Event('input'));location.hash='#/about'");
  await wait("document.getElementById('about-what')"); await sleep(550);
  assert.equal(await run('location.hash'),'#/about');
  console.log('✓ 输入法组字不触发旧搜索，输入后立即切页不被旧计时器拉回');

  const query='?q='+encodeURIComponent('苏')+'&category='+encodeURIComponent('传统美术')+'&region='+encodeURIComponent('江苏省')+'&batch=1';
  await b.go(base+'#/gallery'+query,"document.querySelector('.selected-filter')");
  assert.equal(await run("document.querySelectorAll('.selected-filter').length"),4);
  assert.equal(await run("document.getElementById('region-more').getAttribute('aria-expanded')"),'true');
  assert.equal(await run("document.querySelector('.filter-more-label').textContent"),'收起');
  await click('#region-more');
  await run("document.getElementById('f-q').focus();document.getElementById('f-q').value='苏绣';document.getElementById('f-q').dispatchEvent(new Event('input'))");
  await wait("new URLSearchParams(location.hash.split('?')[1]).get('q')==='苏绣'");
  assert.equal(await run("document.getElementById('region-more').getAttribute('aria-expanded')"),'false');
  await click('.pcard');await wait("document.querySelector('.project')");
  await click('.breadcrumb a[href^="#/gallery"]');await wait("document.querySelector('.pcard')");
  await wait("document.getElementById('region-more').getAttribute('aria-expanded')==='false'");
  await click('[data-remove-filter="q"]');await wait("!document.querySelector('[data-remove-filter=q]')");
  assert.equal(await run("document.querySelectorAll('.selected-filter').length"),3);
  assert.equal(await run("new URLSearchParams(location.hash.split('?')[1]).get('region')"),'江苏省');
  await wait("document.activeElement.classList.contains('result-count')");
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await run('document.documentElement.scrollWidth<=innerWidth'));
  assert(await run("[...document.querySelectorAll('.selected-filter')].every(el=>el.getBoundingClientRect().height>=44)"));
  mkdirSync(join(root,'_shots'),{recursive:true});
  await run("document.querySelector('.selected-filters').scrollIntoView({block:'center',behavior:'instant'})");
  const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(root,'_shots/gallery-filters-mobile.png'),Buffer.from(shot.data,'base64'));
  await click('.selected-clear');await wait("!document.querySelector('.selected-filters')");
  assert.equal(await run('location.hash'),'#/gallery');
  console.log('✓ 已选标签逐项移除并保留其他条件，清空可恢复全部，手机触控尺寸达 44px');

  await b.go(base+'#/gallery?page=2.9&category=invalid&region=invalid&batch=0',"document.querySelector('.pcard')");
  assert.equal(await run('location.hash'),'#/gallery?page=2');
  assert.equal(await run("document.querySelector('.pagination .is-current').textContent.trim()"),'2');
  await b.go(base+'#/gallery?page=Infinity',"document.querySelector('.pcard')");
  assert.equal(await run('location.hash'),'#/gallery');
  await b.go(base+'#/gallery?page=99999',"document.querySelector('.pcard')");
  const pages=await run("document.querySelector('.result-page').textContent.match(/[0-9]+/g).map(Number)");
  assert.equal(pages[0],pages[1]);
  assert.equal(await run('location.hash'),'#/gallery?page='+pages[1]);
  console.log('✓ 小数、非有限页码、越界页码和无效筛选被规范化，页码链接与展示一致');

  await b.go(base+'#/project/13978',"document.querySelector('.project-reading-nav')");
  await click('[data-reading-target="project-variants"]');
  await wait("document.querySelector('[data-reading-target=project-variants]').getAttribute('aria-current')==='location'");
  assert(await run("(()=>{const bar=document.querySelector('.project-reading-nav'),button=bar.querySelector('[aria-current]'),r=bar.getBoundingClientRect(),b=button.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1})()"));
  assert.equal(b.errors.length,0,b.errors.join('\n'));
  console.log('✓ 手机阅读目录自动显露当前章节，不滚动整个页面，控制台无异常');
}finally{b.close()}
