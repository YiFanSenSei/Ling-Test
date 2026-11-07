import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, renameSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { createApp } from '../server/app.mjs';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const directory = mkdtempSync(join(tmpdir(), 'jz-visitor-'));
const password = randomBytes(24).toString('hex');
const server = createApp({ dataDir: directory, distDir: join(root, 'dist'), adminPassword: password });
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await openTestBrowser();
  const { evaluate: run, send, click, wait } = browser;
  const request = (path, method = 'GET', data, cookie = '') => fetch(base + path, {
    method, headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie }, body: data ? JSON.stringify(data) : undefined,
  });
  await browser.go(base + '/#/about', "document.getElementById('about-what')");
  const png = await run(`(() => {
    const c=document.createElement('canvas');c.width=1000;c.height=720;const x=c.getContext('2d');
    x.fillStyle='#F5F1E8';x.fillRect(0,0,1000,720);x.strokeStyle='#b23a2e';x.lineWidth=4;
    for(let i=0;i<50;i++){x.beginPath();x.moveTo(80+i*12,140);x.lineTo(300+i*12,510);x.stroke()}
    x.fillStyle='#3A342C';x.font='32px serif';x.fillText('手上留痕 · 访客练习',80,640);return c.toDataURL();
  })()`);
  const title = '<img src=x onerror=alert(1)> 一针一线的练习';
  const created = await request('/api/works', 'POST', { requestId: randomUUID(), title, craft: 'embroidery', metrics: '自由创作 · 60 针', image: png });
  assert.equal(created.status, 201); const { id } = await created.json();
  const login = await request('/api/admin/session', 'POST', { password });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(`/api/admin/works/${id}`, 'PATCH', { status: 'approved' }, cookie)).status, 200);
  await browser.go(base + '/#/works?craft=invalid&page=-5', "document.querySelector('[data-view-work]')");
  assert.equal(await run('location.hash'), '#/works');
  assert.equal(await run("document.querySelector('.visitor-work h2').textContent"), title);
  assert.equal(await run("document.querySelectorAll('.visitor-work h2 img').length"), 0);
  await run("document.querySelector('[data-view-work]').focus()");
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await wait("document.getElementById('work-viewer').open && !document.getElementById('zoom-work-viewer').disabled");
  assert.equal(await run("document.getElementById('work-viewer-title').textContent"), title);
  assert.equal(await run("new URL(document.getElementById('download-viewer-work').href).pathname"), `/api/works/${id}/image`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait("!document.getElementById('work-viewer').open");
  assert(await run("document.activeElement.matches('[data-view-work]')"));
  console.log('✓ 无效筛选和页码被整理，标题安全显示，键盘可打开原图并恢复焦点');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('[data-view-work]'); await wait("!document.getElementById('zoom-work-viewer').disabled");
  assert(await run("document.getElementById('work-viewer').getBoundingClientRect().width <= innerWidth"));
  await click('#zoom-work-viewer');
  assert(await run("document.querySelector('.work-viewer-media').scrollWidth > document.querySelector('.work-viewer-media').clientWidth"));
  assert(await run('document.documentElement.scrollWidth <= innerWidth'));
  mkdirSync(join(root, '_shots'), { recursive: true });
  await click('#zoom-work-viewer');
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(root, '_shots/work-viewer-mobile.png'), Buffer.from(shot.data, 'base64'));
  await click('#close-work-viewer');
  console.log('✓ 手机原图弹窗不溢出，实际尺寸可滚动查看，下载指向原始 PNG');

  const key = async (name, shift = false) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: name === 'Tab' ? 9 : 27, modifiers: shift ? 8 : 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name });
  };
  await click('#nav-toggle');
  assert(await run("document.getElementById('main').inert && document.querySelector('.site-footer').inert"));
  assert(await run("document.activeElement===document.querySelector('#site-nav-drawer a')"));
  await run("document.querySelector('#site-nav-drawer li:last-child a').focus()"); await key('Tab');
  assert.equal(await run('document.activeElement.id'), 'nav-toggle');
  await key('Tab', true);
  assert(await run("document.activeElement===document.querySelector('#site-nav-drawer li:last-child a')"));
  await key('Escape');
  assert.equal(await run('document.activeElement.id'), 'nav-toggle');
  assert.equal(await run("document.getElementById('main').inert"), false);
  await click('#nav-toggle');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await wait("document.getElementById('site-nav-drawer').hidden");
  assert.equal(await run("document.body.classList.contains('nav-open') || document.getElementById('main').inert"), false);
  console.log('✓ 菜单焦点正反循环，Escape 恢复按钮，切回桌面解除滚动和背景锁定');

  await run(`location.hash='#/works?page=999'`); await wait("document.querySelector('[data-view-work]') && location.hash==='#/works'");
  const file = join(directory, 'images', `${id}.png`); renameSync(file, file + '.unavailable');
  await click('[data-view-work]');
  await wait("document.getElementById('work-viewer-status').textContent.includes('无法读取')");
  assert(await run("document.getElementById('download-viewer-work').hidden"));
  await click('#close-work-viewer');
  await run(`location.hash='#/works?craft=embroidery'`);
  await wait("document.querySelector('[data-work-thumbnail]')");
  await run("document.querySelector('[data-work-thumbnail]').src+='?missing='+Date.now()");
  await wait("document.querySelector('.work-image-error') && !document.querySelector('.work-image-error').hidden");
  renameSync(file + '.unavailable', file);
  await click('[data-retry-work-image]');
  await wait("!document.querySelector('[data-work-thumbnail]').hidden && document.querySelector('[data-work-thumbnail]').naturalWidth>0");
  console.log('✓ 图片文件缺失有明确提示，恢复文件后可重试，不提供失效下载');

  await run(`const fetchOriginal=window.fetch;window.fetch=async (url,opts)=>url.startsWith('/api/works?')?new Response(JSON.stringify({items:null}),{headers:{'Content-Type':'application/json'}}):fetchOriginal(url,opts);location.hash='#/works?craft=paper'`);
  await wait("document.getElementById('retry-works')");
  assert((await run("document.querySelector('.works-message').textContent")).includes('重新加载'));
  await run('window.fetch=fetchOriginal'); await click('#retry-works');
  await wait("document.querySelector('.works-message') && !document.getElementById('retry-works')");
  assert.equal(await run("document.querySelector('.section-more a').getAttribute('href')"), '#/simulator?tool=paper');
  assert.equal(await run("document.querySelector('.works-filters [aria-current]').textContent"), '宣纸');
  await run("location.hash='#/works?craft=embroidery'"); await wait("document.querySelector('[data-view-work]')");
  await click('[data-view-work]'); await wait("document.getElementById('work-viewer').open");
  await run("location.hash='#/about'"); await wait("document.getElementById('about-what')");
  assert.equal(await run("document.body.classList.contains('work-viewer-open') || document.getElementById('main').inert"), false);
  assert.equal(browser.errors.filter(message => !(message.includes('Failed to load resource') && message.includes('404'))).length, 0, browser.errors.join('\n'));
  console.log('✓ 异常接口数据可重试恢复，空分类直接引导至对应技艺，除预期图片 404 外无报错');
  console.log('✓ 原图弹窗打开时切页不会残留滚动锁或不可操作的背景');
} finally {
  browser?.close(); await new Promise(ready => server.close(ready));
  if (resolve(directory).startsWith(resolve(tmpdir()) + sep)) rmSync(directory, { recursive: true, force: true });
}
