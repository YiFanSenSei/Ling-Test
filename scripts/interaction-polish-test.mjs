import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openTestBrowser } from './lib/browser-test.mjs';
import { currentQuery } from '../src/router.js';

globalThis.window = { location: { hash: '#/gallery?q=苏绣+技艺&literal=%2B&question=谁?什么&bad=%E0%A4%A&__proto__=safe' } };
const query = currentQuery();
assert.equal(query.q, '苏绣 技艺'); assert.equal(query.literal, '+'); assert.equal(query.question, '谁?什么');
assert.equal(query.__proto__, 'safe'); assert.equal(Object.getPrototypeOf(query), Object.prototype);
assert.equal(typeof query.bad, 'string'); delete globalThis.window;
console.log('✓ 查询参数统一处理空格、加号、问号与损坏转义');

const base = pathToFileURL(join(resolve(import.meta.dirname, '..'), 'dist/index.html')).href;
const browser = await openTestBrowser();
try {
  const { evaluate: run, wait, click, send } = browser;
  const key = async (name, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
  };
  await browser.go(base + '#/simulator', "document.getElementById('canvas-embroidery')");
  await run("document.querySelector('[data-template=plum]').focus()");
  await key('ArrowRight', 39);
  assert.equal(await run('document.activeElement.dataset.template'), 'lotus');
  assert.equal(await run("document.querySelector('[data-template=lotus]').getAttribute('aria-checked')"), 'true');
  await key('End', 35);
  assert.equal(await run('document.activeElement.dataset.template'), 'free');
  await wait("document.querySelector('[data-thread=red]').tabIndex===0");
  await run("document.querySelector('[data-thread=red]').focus()"); await key('ArrowLeft', 37);
  assert.equal(await run('document.activeElement.dataset.thread'), 'ink');
  await key('Tab', 9);
  assert.equal(await run('document.activeElement.id'), 'stitch-density');
  await run("document.querySelector('[data-stitch=satin]').focus()"); await key('ArrowDown', 40);
  assert.equal(await run('document.activeElement.dataset.stitch'), 'flat');
  assert.equal(await run("document.getElementById('auto-stitch').checked"), false);
  await click('[data-template=plum]');
  await wait("[...document.querySelectorAll('[data-thread]')].every(button=>button.disabled && button.tabIndex===-1)");
  console.log('✓ 方向键/Home/End 可选择图纸、针法和丝线，Tab 跳出单选组，锁定选项不占焦点');

  await click('[data-sim=mortise]');
  await run("document.querySelector('[data-joint=dovetail]').focus()"); await key('ArrowDown', 40);
  assert.equal(await run('document.activeElement.dataset.joint'), 'mortise');
  assert.equal(await run("document.querySelector('[data-joint=mortise]').getAttribute('aria-checked')"), 'true');
  await key('Home', 36);
  await click('#advance-mortise'); await click('#advance-mortise');
  const depth = await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')");
  await run("document.querySelector('[data-joint=dovetail]').focus()"); await key('Home', 36);
  assert.equal(await run("document.getElementById('joint-progress-bar').getAttribute('aria-valuenow')"), depth,
    '首尾键停留在已选构件时不应重置拼合进度');
  await run("document.querySelector('[data-view=iso]').focus()"); await key('End', 35);
  assert.equal(await run('document.activeElement.dataset.view'), 'high');
  // 自由旋转取消预设选中后，视角组仍须有可到达的 Tab 入口。
  await run("document.getElementById('canvas-mortise').focus()"); await key('ArrowLeft', 37);
  await wait("document.querySelectorAll('[data-view][tabindex=\"0\"]').length===1");
  console.log('✓ 榫卯构件和视角支持键盘选择，自由旋转后仍可返回预设视角');

  await browser.go(base + '#/inheritors?q=谁?什么+测试', "document.getElementById('inh-q')");
  assert.equal(await run("document.getElementById('inh-q').value"), '谁?什么 测试');
  assert.equal(browser.errors.length, 0, browser.errors.join('\n'));
  console.log('✓ 传承人分享链接中的问号不会截断关键词，全程无脚本异常');
} finally { browser.close(); }
