import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createApp } from '../server/app.mjs';
import { openTestBrowser } from './lib/browser-test.mjs';

const directory=mkdtempSync(join(tmpdir(),'jz-admin-test-'));
const password=randomBytes(24).toString('hex');
const server=createApp({dataDir:directory,distDir:resolve('dist'),adminPassword:password});
await new Promise(ready=>server.listen(0,'127.0.0.1',ready));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await openTestBrowser();
  const {evaluate:run,click,wait}=browser;
  await browser.go(base+'/admin',"document.getElementById('password')");
  const image=await run("(()=>{const c=document.createElement('canvas');c.width=100;c.height=100;const x=c.getContext('2d');x.fillStyle='#b23a2e';x.fillRect(0,0,100,100);return c.toDataURL()})()");
  for(let i=0;i<13;i++) {
    const response=await fetch(base+'/api/works',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID(),title:`测试作品 ${i}`,craft:'embroidery',image})});
    assert.equal(response.status,201);
  }
  await run(`document.getElementById('password').value=${JSON.stringify(password)}`);
  await click('#login button'); await wait("document.querySelectorAll('.work').length===12");
  await click('#next'); await wait("document.querySelectorAll('.work').length===1");
  await click('.work button'); await wait("document.getElementById('notice').textContent==='审核已保存。'");
  assert.equal(await run("document.getElementById('page').textContent"),'1 / 1');
  assert(await run("document.getElementById('prev').disabled"));
  console.log('✓ 末页审核后页数减少，回到真实页码且上一页正确禁用');
  const choose=async status=>run(`document.getElementById('status').value=${JSON.stringify(status)};document.getElementById('status').dispatchEvent(new Event('change'))`);
  await choose('approved'); await wait("document.querySelector('.work button')?.textContent==='下架作品'");
  const publicWork=(await (await fetch(base+'/api/works')).json()).items[0]; assert(publicWork);
  await click('.work button'); await wait("document.getElementById('notice').textContent==='审核已保存。'");
  assert.equal((await (await fetch(base+'/api/works')).json()).total,0);
  assert.equal((await fetch(base+publicWork.image)).status,404);
  await choose('rejected'); await wait("document.querySelector('.work button')?.textContent==='重新审核'");
  await click('.work button'); await wait("document.getElementById('notice').textContent==='审核已保存。'");
  await choose('pending'); await wait("document.getElementById('count').textContent==='共 13 件作品'");
  console.log('✓ 网页下架立即取消列表和图片公开，误驳回可重新进入待审核');

  await run(`const originalFetch=window.fetch;window.fetch=async function(url,options){
    if(window.__hold && url.startsWith('/api/admin/works?status=pending')){
      window.__hold=false;const response=await originalFetch.call(this,url,options);
      return new Promise((resolve,reject)=>{window.__release=()=>window.__reject?reject(new Error('旧请求失败')):resolve(response)})
    }return originalFetch.call(this,url,options)
  };window.__hold=true;window.__reject=true;`);
  await click('#refresh'); await wait('window.__release');
  await choose('approved'); await wait("document.getElementById('notice').textContent==='当前状态没有作品。'");
  await run('window.__release()'); await sleep(150);
  assert.equal(await run("document.getElementById('notice').textContent"),'当前状态没有作品。');
  console.log('✓ 过期请求失败不会覆盖最新筛选或登录状态');
  await run('window.__release=null;window.__hold=true;window.__reject=false');
  await choose('pending'); await wait('window.__release');
  await click('#logout'); await wait("document.getElementById('notice').textContent==='已退出。'");
  await run('window.__release()'); await sleep(150);
  assert(await run("document.getElementById('dashboard').hidden"));
  assert.equal(await run("document.querySelectorAll('.work').length"),0);
  assert.equal(browser.errors.length,0,browser.errors.join('\n'));
  console.log('✓ 退出时未完成的列表响应不会重新显示管理内容');
} finally {
  browser?.close(); await new Promise(ready=>server.close(ready));
  if(resolve(directory).startsWith(resolve(tmpdir())+sep))rmSync(directory,{recursive:true,force:true});
}
