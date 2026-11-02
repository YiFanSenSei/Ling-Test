import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { openTestBrowser } from './lib/browser-test.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const server = createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = resolve(dist, `.${name === '/' ? '/index.html' : name}`);
  if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(ready => server.listen(0, '127.0.0.1', ready));
let browser;
try {
  browser = await openTestBrowser();
  const { evaluate: run, wait, click, send } = browser;
  const base = `http://127.0.0.1:${server.address().port}/`;
  await browser.go(base, "document.querySelector('.hero-title')");
  let attempts = 0;
  await browser.intercept(async (request, command) => {
    if (request.request.url.includes('/detail-') && ++attempts === 1) {
      await command('Fetch.failRequest', { requestId: request.requestId, errorReason: 'Failed' });
    } else await command('Fetch.continueRequest', { requestId: request.requestId });
  });
  await run("location.hash = '#/project/13978'");
  await wait("document.getElementById('retry-route')");
  await click('#retry-route'); await wait("document.querySelector('.project-title')");
  assert.equal(attempts, 2);
  console.log('✓ 详情分片失败后，同页重试成功');

  let release;
  await browser.intercept(async (request, command) => {
    if (request.request.url.includes('/inheritors.js')) await new Promise(ready => { release = ready; });
    await command('Fetch.continueRequest', { requestId: request.requestId });
  });
  await run("location.hash = '#/inheritors'"); await wait("document.getElementById('route-status')");
  await run("location.hash = '#/about'"); await wait("document.getElementById('about-what')");
  release(); await sleep(600);
  assert(await run("Boolean(document.getElementById('about-what'))"));
  assert.equal(await run("document.querySelectorAll('#route-status').length"), 0);
  console.log('✓ 慢网有等待提示，旧请求不会覆盖新页面');

  const file = pathToFileURL(join(dist, 'index.html')).href;
  await browser.go(file + '#/simulator?tool=embroidery', "document.getElementById('canvas-embroidery')");
  await run("document.getElementById('canvas-embroidery').focus()"); await browser.space();
  const count = await run("document.getElementById('stitch-count').textContent"); assert(Number(count) > 0);
  await sleep(600); await send('Page.reload'); await sleep(300);
  await wait("document.getElementById('canvas-embroidery')");
  assert.equal(await run("document.getElementById('stitch-count').textContent"), count);
  await click('[data-template="lotus"]'); assert.equal(await run("document.getElementById('stitch-count').textContent"), '0');
  await click('[data-template="plum"]'); assert.equal(await run("document.getElementById('stitch-count').textContent"), count);
  await click('#clear-embroidery'); assert.equal(await run("document.getElementById('stitch-count').textContent"), '0');
  await click('#restore-cleared'); assert.equal(await run("document.getElementById('stitch-count').textContent"), count);
  await click('#undo-embroidery');
  const undone = await run("document.getElementById('stitch-count').textContent");
  assert(Number(undone) < Number(count));
  await sleep(600); await send('Page.reload'); await sleep(300);
  await wait("document.getElementById('canvas-embroidery')");
  assert.equal(await run("document.getElementById('stitch-count').textContent"), undone);
  console.log('✓ 离线草稿刷新恢复、图纸独立保存、撤销清空');

  await browser.go(file + '#/gallery?category=' + encodeURIComponent('传统美术') + '&page=2', "document.querySelector('.pcard')");
  const previous = await run(`(() => { const card = document.querySelectorAll('.pcard')[4]; card.scrollIntoView({behavior:'instant', block:'center'}); return {y:scrollY, href:card.getAttribute('href')}; })()`);
  await run("document.querySelectorAll('.pcard')[4].click()"); await wait("document.querySelector('.project-title')");
  await click('.breadcrumb a[href^="#/gallery"]'); await wait("document.querySelector('.pcard')"); await sleep(200);
  assert((await run('location.hash')).includes('page=2'));
  assert(Math.abs(await run('scrollY') - previous.y) < 5);
  assert.equal(await run("document.activeElement.getAttribute('href')"), previous.href);
  console.log('✓ 名录筛选、页码、滚动位置与焦点恢复');

  await browser.go(file + '#/ages', "document.querySelector('.birth-row')");
  assert.equal(await run("document.querySelectorAll('.birth-row').length"), 8);
  assert.equal(await run("document.querySelector('main').textContent.includes('118 岁')"), false);
  await browser.go(file + '#/', "document.querySelector('.pcard-question')");
  assert.equal(await run("document.querySelectorAll('.pcard-question').length"), 8);
  for (const id of ['13978', '14376', '14306', '13133', '12484', '13581', '13794', '15059']) {
    await browser.go(file + `#/project/${id}`, "document.querySelector('.curation-note')");
  }
  console.log('✓ 出生年代页面和八项精选的策展入口');
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
} finally {
  browser?.close(); await new Promise(ready => server.close(ready));
}
