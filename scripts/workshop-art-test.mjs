import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { build } from 'esbuild';
import { openTestBrowser } from './lib/browser-test.mjs';
import { swiftParts } from '../src/workshop/swift.js';
import { cameraAt, entryPoint, feet, scenePlaces, viewHeight, viewWidth } from '../src/workshop/map.js';

const shots=resolve(process.env.JZ_ART_QA || '_shots/workshop');
mkdirSync(shots,{recursive:true});
const probe=await build({
  stdin:{contents:`import {drawActor, portrait} from './src/workshop/characters.js'; Object.assign(window,{artDrawActor:drawActor,artPortrait:portrait});`,resolveDir:resolve('.')},
  bundle:true,write:false,format:'iife',define:{'import.meta.env.BASE_URL':'"./"'},
});
const browser=await openTestBrowser();
const url=pathToFileURL(resolve(process.env.JZ_ART_ENTRY || 'dist/index.html')).href+'#/workshop';
const capture=async name=>{
  const {data}=await browser.send('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(shots,name+'.png'),Buffer.from(data,'base64'));
};
const go=async id=>browser.evaluate(`(() => {
  const pin=document.querySelector('[data-walk="${id}"]');
  (pin.hidden ? document.querySelector('#ws-proximity') : pin).click();
})()`);
const travel=async(id,name)=>{
  await go(id);
  await browser.wait(`document.querySelector('#ws-location strong')?.textContent === ${JSON.stringify(name)}`);
};
const openTalk=async id=>{
  await go(id);
  await browser.wait(`document.querySelector('#ws-panel[open] .ws-portrait-${id} img')?.naturalWidth > 0`);
};
const topic=async (id,mood)=>{
  await browser.click(`[data-topic=${id}]`);
  if(mood) await browser.wait(`document.querySelector('#ws-panel[open] [data-mood="${mood}"] img')?.naturalWidth > 0`);
};
const nextLine=()=>browser.click('[data-command=continue-dialogue]');
const finishLines=async()=>{
  for(let i=0;i<20;i++) {
    if(!await browser.evaluate('document.querySelector("[data-command=continue-dialogue]") !== null')) return;
    await nextLine();
  }
  assert.fail('The conversation never reached a choice or an ending');
};
const finishConversation=async()=>{
  await finishLines();
  await browser.click('[data-command=finish-dialogue]');
};
const reload=async ready=>{
  await browser.evaluate('window.beforeWorkshopReload=true');
  await browser.send('Page.reload');
  await browser.wait('!window.beforeWorkshopReload && document.querySelector(".ws-title-screen")');
  await loadAutosave(ready);
};
const loadAutosave=async ready=>{
  await browser.click('[data-title-action="load"]');
  await browser.click('[data-title-save="auto"]');
  await browser.wait(ready);
};
const endDay=async()=>{
  const day=(await saved()).day;
  await browser.click('[data-command=close]');
  await browser.click('[data-command=confirm-close]');
  if(day<14) {
    await browser.wait(`document.querySelector(".ws-panel-day[open] h2")?.textContent === "第 ${day+1} 天"`);
    await browser.wait('!document.querySelector("#ws-panel[open]") && document.querySelector("#ws-location strong")?.textContent === "青梧绣坊"');
  }
};
const snapshot=async()=>JSON.parse(await browser.evaluate('localStorage.getItem("jz-workshop-v1")'));
const saved=async()=>{
  const current=await snapshot();
  if (!current) return current;
  const { resume, ...state } = current;
  return state;
};
const onCloth=async point=>browser.evaluate(`(() => {
  const svg = document.querySelector('[data-swift-board]');
  const p = new DOMPoint(...${JSON.stringify(point)}).matrixTransform(svg.getScreenCTM());
  return {x:p.x,y:p.y};
})()`);
const settled=()=>browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
const dragNeedle=async(from,to)=>{
  await settled();
  const [a,b]=await Promise.all([onCloth(from),onCloth(to)]);
  await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',...a,button:'none',buttons:0});
  await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',...a,button:'left',buttons:1,clickCount:1});
  await settled();
  await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',...b,button:'left',buttons:1});
  await settled();
  await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',...b,button:'left',buttons:0,clickCount:1});
  await settled();
};
const tapCloth=async point=>{
  await settled();
  const target=await onCloth(point);
  assert.ok(await browser.evaluate(`Boolean(document.elementFromPoint(${target.x},${target.y})?.closest('[data-swift-board]'))`),'The touch point must land on the visible embroidery surface');
  await browser.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[target]});
  await sleep(65);
  await browser.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await settled();
};

try {
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.actorFrames=[];
    window.workshopConsoleErrors=[];
    const report=console.error;
    console.error=(...args)=>{
      workshopConsoleErrors.push(args.map(value=>value?.stack || String(value)).join(' '));
      report(...args);
    };
    const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args) {
      if(image instanceof HTMLCanvasElement && image.width===72 && image.height===102) {
        const frame={sprite:image.toDataURL(),x:args[0],y:args[1]};
        if(this.canvas.id==='ws-map') {
          const facing=window.expectedPoses?.find(p=>p.sprite===frame.sprite)?.facing;
          if(facing) { window.lastPlayerFrame={...frame,facing}; window.actorFrames.push(window.lastPlayerFrame); }
        } else if(window.captureFacing) window.expectedPoses.push({...frame,facing:window.captureFacing});
      }
      return draw.call(this,image,...args);
    };
  `});
  await browser.go(url,'document.querySelector(".ws-title-picture canvas") || window.workshopConsoleErrors?.length');
  assert.deepEqual(await browser.evaluate('window.workshopConsoleErrors'),[]);
  assert.ok(await browser.evaluate('document.querySelector(\'[data-title-action="load"]\').disabled'));
  assert.equal(await saved(),null);
  await capture('游戏标题');
  await browser.click('[data-title-action="new"]');
  await browser.wait('document.querySelector(".ws-panel-day[open] h2")?.textContent === "第 1 天"');
  await capture('第一天-开场');
  await browser.wait('!document.querySelector("#ws-panel[open]") && document.querySelector("#ws-location strong")?.textContent === "青梧绣坊"');
  assert.ok(await browser.evaluate('document.querySelector("[data-walk=loom]").hasAttribute("data-first-stitch")'));
  await browser.evaluate(probe.outputFiles[0].text);
  const sheet=await browser.evaluate(`(() => {
    window.expectedPoses=[];
    const scratch=document.createElement('canvas'); scratch.width=100; scratch.height=100;
    for(const facing of ['up','down','left','right']) {
      window.captureFacing=facing;
      for(const phase of [-1,0,.25,.5,.75]) artDrawActor(scratch.getContext('2d'),'player',1,1,facing,phase);
    }
    window.captureFacing=null;
    const sheet=document.createElement('canvas'); sheet.width=800; sheet.height=1300;
    const c=sheet.getContext('2d'); c.fillStyle='#e6dfc9';c.fillRect(0,0,sheet.width,sheet.height);
    c.font='16px sans-serif';c.textAlign='center';c.fillStyle='#35332c';
    ['up','down','left','right'].forEach((d,i)=>c.fillText(d,i*200+100,22));
    ['player','master','apprentice','shop','teaSeller','visitor','merchant','scholar'].forEach((id,row)=>{
      ['up','down','left','right'].forEach((dir,col)=>{
        c.save();c.translate(col*200+65,row*158+34);c.scale(4,4);
        artDrawActor(c,id,0,1,dir,-1); c.restore();
      });
    });
    return sheet.toDataURL().split(',')[1];
  })()`);
  writeFileSync(join(shots,'新版-四方向角色.png'),Buffer.from(sheet,'base64'));
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1248,height:1050,deviceScaleFactor:1,mobile:false});
  await browser.evaluate(`(async () => {
    const rows = [
      ['player','主角',['neutral','focused','warm']], ['master','陆师傅',['neutral','thoughtful','proud']],
      ['apprentice','阿禾',['laugh','shy','warm','hurt']], ['shop','周岚',['neutral','amused','serious']],
      ['teaSeller','春姨',['neutral','laugh','thoughtful']], ['visitor','程渡',['neutral','curious','joy']],
      ['merchant','秦砚',['neutral','skeptical','impressed']], ['scholar','沈照宁',['neutral','focused','warm']],
    ];
    const sheet=document.createElement('div');
    sheet.id='workshop-portrait-sheet';
    sheet.style.cssText='position:fixed;inset:0;z-index:9999;background:#ded7bf;color:#3b4f43;padding:16px 18px;font:16px system-ui';
    sheet.innerHTML='<h1 style="margin:0 0 12px;font-size:22px">青梧绣坊 · 角色表情</h1>';
    const grid=document.createElement('div');
    grid.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:12px 16px';
    sheet.append(grid);
    document.body.append(sheet);
    for (const [id,label,moods] of rows) {
      const group=document.createElement('section');
      group.style.cssText='height:234px;display:grid;grid-template-rows:26px 1fr;background:#bdc4ac;padding:5px 11px 0';
      group.innerHTML='<strong>'+label+'</strong>';
      const frames=document.createElement('div');
      frames.style.cssText='display:flex;align-items:end;gap:16px';
      group.append(frames);
      grid.append(group);
      for (const mood of moods) {
        const frame=artPortrait(id,mood);
        const crop=document.createElement('div'), image=new Image();
        crop.style.cssText='position:relative;overflow:hidden;height:196px;width:'+196*frame.ratio+'px';
        image.style.cssText='position:absolute;max-width:none;left:50%;top:-'+frame.offset+'%;width:'+frame.width+'%;transform:translateX(-'+frame.center+'%)';
        image.src=frame.src;
        crop.append(image); frames.append(crop);
        await image.decode();
      }
    }
  })()`);
  await capture('工坊-八人立绘');
  await browser.evaluate('document.querySelector("#workshop-portrait-sheet").remove()');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await travel('to-lane','春汛老街');
  await capture('新版-老街');
  const startCamera=cameraAt(entryPoint('lane','studio')), seller=feet(scenePlaces('lane').teaSeller);
  const clickPoint=await browser.evaluate(`(() => {
    const {left,top,width,height}=document.querySelector('#ws-map').getBoundingClientRect();
    return {x:left+width*${(seller.x-startCamera.x)/viewWidth},y:top+height*${(seller.y-startCamera.y-12)/viewHeight}};
  })()`);
  await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',...clickPoint,button:'left',buttons:1,clickCount:1});
  await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',...clickPoint,button:'left',buttons:0,clickCount:1});
  await browser.wait('document.querySelector("#ws-panel[open] .ws-portrait-teaSeller img")?.naturalWidth > 0');
  await topic('kettle');
  await finishLines();
  await browser.click('[data-reply="0"]');
  await nextLine();
  await browser.wait('document.querySelector(".ws-spoken")?.textContent.includes("杯子摔了三个")');
  assert.equal((await saved()).story.affinity.teaSeller,1);
  await capture('春姨-茶摊闲聊');
  await finishConversation();
  assert.equal(await browser.evaluate('Boolean(document.querySelector("[data-topic=kettle]"))'),false);
  await browser.click('[data-command=back]');
  await travel('to-studio','青梧绣坊');
  await capture('新版-绣坊');

  // Compare the actual images sent to the game canvas with the direction requested by each real key.
  for(const [key,code,direction,axis,sign] of [
    ['a','KeyA','left','x',-1],['d','KeyD','right','x',1],['w','KeyW','up','y',-1],['s','KeyS','down','y',1],
  ]) {
    const before=await browser.evaluate('window.lastPlayerFrame');
    await browser.evaluate('window.actorFrames=[];document.querySelector("#ws-map").focus()');
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key,code});
    await sleep(150);
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key,code});
    await sleep(60);
    const result=await browser.evaluate('({last:window.lastPlayerFrame,frames:window.actorFrames})');
    assert.ok(result.frames.length>1,direction+' must animate');
    assert.equal(result.last.facing,direction,direction+' must face its movement');
    assert.ok((result.last[axis]-before[axis])*sign>2,direction+' must move along the requested axis');
    assert.ok(result.frames.every(f=>f.facing===direction),direction+' must keep its facing throughout the step');
  }
  console.log('PASS keyboard direction, displacement, walking frames and idle facing');

  await openTalk('master');
  await capture('新版-立绘-master');
  await topic('crooked','thoughtful');
  await finishLines();
  await browser.click('[data-reply="0"]');
  await nextLine();
  await browser.wait('document.querySelector(".ws-spoken")?.textContent.includes("针线盒")');
  await finishConversation();
  await browser.click('[data-command=back]');
  await openTalk('apprentice');
  await capture('新版-立绘-apprentice');
  assert.equal(await browser.evaluate('document.querySelector("[data-topic=confess]") !== null'),false);
  assert.equal(await browser.evaluate('(/聊天 ·|工坊事务|工时|小时/).test(document.querySelector("#ws-panel").textContent)'),false);
  await topic('tea','laugh');
  assert.equal(await browser.evaluate('document.querySelector("[data-reply]") !== null'),false);
  const pausedLine = await browser.evaluate('document.querySelector(".ws-spoken").textContent');
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await browser.wait('document.querySelector(".ws-title-screen")');
  await loadAutosave('document.querySelector("#ws-panel[open] .ws-spoken")');
  assert.equal(await browser.evaluate('document.querySelector(".ws-spoken").textContent'), pausedLine);
  await browser.space();
  assert.equal(await browser.evaluate('document.querySelector("#ws-panel h2").textContent'),'你');
  await browser.wait('document.querySelector(".ws-portrait-player img")?.naturalWidth > 0');
  await finishLines();
  await capture('阿禾-笑');
  await browser.space();
  assert.ok((await saved()).story.memories.includes('firstTalk'));
  assert.equal((await saved()).hours,6);
  const selected = await browser.evaluate('document.querySelector(".ws-spoken").textContent');
  await reload('document.querySelector("#ws-panel[open] .ws-spoken")');
  assert.equal(await browser.evaluate('document.querySelector(".ws-spoken").textContent'),selected);
  assert.equal(await browser.evaluate('document.querySelector("#ws-location strong").textContent'),'青梧绣坊');
  assert.equal((await saved()).story.affinity.apprentice,1);
  await nextLine();
  await browser.wait('document.querySelector(".ws-affinity")?.textContent.includes("好感 +1")');
  await capture('阿禾-好感变化');
  await finishConversation();
  assert.equal(await browser.evaluate('Boolean(document.querySelector("[data-topic=tea]"))'),false);
  await browser.click('[data-command=back]');
  await go('loom');
  await browser.wait('document.querySelector("#ws-panel[open] [data-action=stitch]")');
  await browser.click('[data-action=stitch]');
  await browser.space();
  for(const key of ['ArrowRight','ArrowDown','ArrowRight','ArrowDown']) {
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key});
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key});
  }
  await browser.space();
  const nearWingCount = `document.querySelector('[data-swift-part="0"] small')?.textContent`;
  await browser.wait(`${nearWingCount} === "1/2"`);
  assert.ok(await browser.evaluate('document.querySelector(".ws-swift-note").textContent.includes("第一组针绣好了")'));
  assert.equal((await snapshot()).resume.drafts.swift.main.length,1);
  await reload('document.querySelector("#ws-map") && !document.querySelector("#ws-panel[open]")');
  await go('loom');
  await browser.wait('document.querySelector("#ws-panel[open] [data-action=stitch]")');
  await browser.click('[data-action=stitch]');
  await browser.wait(`${nearWingCount} === "1/2"`);
  await browser.click('[data-command=swift-undo]');
  assert.equal(await browser.evaluate(nearWingCount),'0/2');
  assert.equal(await browser.evaluate('document.querySelector("[data-command=finish-stitch]").disabled'),true);

  for(const [i,{guide:[a,b]}] of swiftParts.entries()) {
    await browser.click(`[data-swift-part="${i}"]`);
    await browser.click(`[data-swift-method="${i<2 ? 1 : i===2 ? 0 : 2}"]`);
    for(const [attempt,span] of (i===0 ? [.64] : [.56,.91]).entries()) {
      await browser.click(`[data-swift-color="${span>.6 ? 4 : 0}"]`);
      await dragNeedle(a,a.map((n,j)=>n+(b[j]-n)*span));
      const expected=attempt===1 ? '✓' : '1/2';
      await browser.wait(`document.querySelector('[data-swift-part="${i}"] small')?.textContent === ${JSON.stringify(expected)}`);
    }
  }
  await browser.click('[data-swift-part="0"]');
  await browser.click('[data-swift-method="1"]');
  await browser.click('[data-swift-color="0"]');
  await browser.click('[data-swift-zoom="2"]');
  await browser.wait('document.querySelector("[data-swift-board]").viewBox.baseVal.width < 150');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await browser.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await browser.evaluate('document.querySelector("[data-swift-board]").scrollIntoView({block:"center"})');
  const [touchStart,touchEnd]=swiftParts[0].guide;
  await tapCloth(touchStart);
  await browser.wait('document.querySelector(".ws-swift-note")?.textContent.includes("已起针")');
  await tapCloth(touchEnd);
  await browser.wait(`${nearWingCount} === "✓"`);
  await capture('雨燕-手机放大');
  await browser.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await browser.evaluate('document.querySelector("#ws-panel").scrollTop=0');
  await browser.click('[data-swift-zoom="0"]');
  await capture('雨燕-自由走针');
  await browser.click('[data-command=finish-stitch]');
  await browser.wait('document.querySelector(".ws-receipt")?.textContent.includes("过去了 3 小时") && document.querySelector(".ws-receipt")?.textContent.includes("支出 12 元")');
  assert.equal((await saved()).swift.length,8);
  assert.deepEqual([...new Set((await saved()).swift.map(mark=>mark.method))],[1,0,2]);
  await browser.wait('document.querySelector("#ws-panel[open] .ws-swift-piece")');
  await browser.click('[data-command=back]');
  await travel('to-lane','春汛老街');
  assert.equal((await snapshot()).resume.spot.scene, 'lane');
  await travel('to-archive','旧样档案室'); await capture('新版-档案室');
  await go('desk');
  await browser.wait('document.querySelector("#ws-panel[open] h2")?.textContent==="档案桌"');
  await browser.click('[data-command=archive-notes]');
  await browser.wait('document.querySelector(".ws-archive-slip")?.textContent.includes("教针，线自带")');
  assert.equal(await browser.evaluate('document.querySelector("[data-command=archive-next]").disabled'),true);
  await browser.click('[data-command=chapter-back]');
  await browser.click('[data-command=back]');
  await travel('to-lane','春汛老街');
  await travel('to-shop','沿河小店'); await capture('新版-小店');
  await openTalk('shop');
  await capture('新版-立绘-shop');
  await topic('apron','amused');
  await finishLines();
  await browser.click('[data-reply="1"]');
  await nextLine();
  await browser.wait('document.querySelector(".ws-spoken")?.textContent.includes("两个热包子")');
  await finishConversation();
  await topic('name');
  await finishLines();
  assert.equal(await browser.evaluate('document.querySelector("[data-reply]") !== null'),false);
  await browser.wait('document.querySelector(".ws-spoken")?.textContent.includes("袁晓春")');
  await finishConversation();
  await browser.click('[data-command=back]');
  await travel('to-lane','春汛老街');
  await travel('to-river','河畔展场'); await capture('新版-河畔');
  await openTalk('visitor');
  await topic('notebook');
  await finishLines();
  await browser.click('[data-reply="0"]');
  await nextLine();
  assert.ok((await saved()).story.memories.includes('invited'));
  await capture('程渡-看展约定');
  await finishConversation();
  await browser.click('[data-command=back]');
  await endDay();
  await openTalk('apprentice');
  await topic('sketch','shy');
  await finishLines();
  await browser.click('[data-reply="1"]');
  await nextLine();
  await browser.wait('document.querySelector("[data-mood=warm] img")?.naturalWidth > 0');
  assert.ok((await saved()).story.memories.includes('ownDesign'));
  assert.equal((await saved()).story.affinity.apprentice,2);
  await finishConversation();
  await browser.click('[data-command=back]');
  await endDay();
  await travel('to-lane','春汛老街'); await travel('to-river','河畔展场');
  await go('exhibit');
  await browser.wait('document.querySelector("#ws-panel[open] [data-action=open]:enabled")');
  await browser.click('[data-action=open]');
  await browser.wait('JSON.parse(localStorage.getItem("jz-workshop-v1"))?.display==="open"');
  await browser.click('[data-command=back]');
  await capture('新版-布展');
  await openTalk('visitor');
  await topic('hands');
  await finishConversation();
  await topic('returned');
  await browser.wait('document.querySelector(".ws-spoken")?.textContent.includes("第一张画展台")');
  await finishConversation();
  await browser.click('[data-command=back]');
  console.log('PASS five scenes, five characters, first two days of dialogue, embroidery and invitation payoff');

  for(let day=3;day<10;day++) await endDay();
  await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await browser.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await capture('新版-手机');
  await go('apprentice');
  await browser.wait('document.querySelector("#ws-panel[open] .ws-portrait img")?.complete');
  const fits=await browser.evaluate(`(() => {
    const panel=document.querySelector('#ws-panel').getBoundingClientRect();
    const image=document.querySelector('.ws-portrait').getBoundingClientRect();
    return panel.left>=0 && panel.right<=innerWidth && image.top>=0;
  })()`);
  assert.ok(fits,'Mobile portrait and dialogue must fit the viewport');
  await capture('新版-手机对话');
  const checkpoint = await saved();
  await topic('confess','shy');
  await finishLines();
  await capture('阿禾-桥头心事');
  assert.equal((await saved()).story.reply,'');
  await browser.evaluate('location.hash="#/"');
  await browser.wait('!document.querySelector("#ws-map")');
  await browser.evaluate('location.hash="#/workshop"');
  await browser.wait('document.querySelector(".ws-title-screen")');
  await loadAutosave('document.querySelector("#ws-panel[open] [data-reply]")');
  assert.equal((await saved()).display,'open');
  for(const [index, reply, mood, title] of [
    [0,'together','warm','并肩走一段'], [1,'friends','hurt','给彼此留个位子'], [2,'later','warm','桥头的约定'],
  ]) {
    if(index > 0) {
      await browser.evaluate(`localStorage.setItem("jz-workshop-v1",${JSON.stringify(JSON.stringify(checkpoint))})`);
      await reload('document.querySelector("#ws-map") && !document.querySelector("#ws-panel[open]")');
      await openTalk('apprentice');
      await topic('confess','shy');
      await finishLines();
    }
    await browser.click(`[data-reply="${index}"]`);
    assert.equal(await browser.evaluate('document.querySelector("#ws-panel h2").textContent'),'你');
    await nextLine();
    await browser.wait(`document.querySelector("[data-mood=${mood}] img")?.naturalWidth > 0`);
    assert.equal((await saved()).story.reply,reply);
    if(index === 0) await capture('阿禾-并肩走一段');
    await finishConversation();
    assert.equal(await browser.evaluate('document.querySelector("[data-topic=confess]") !== null'),false);
    await browser.click('[data-command=back]');
    for(let day=10;day<=14;day++) await endDay();
    const endings=await browser.evaluate('Array.from(document.querySelectorAll(".ws-epilogue h3"),el=>el.textContent)');
    assert.ok(endings.includes(title) && endings.includes('速写本上的展场'));
  }
  await browser.click('[data-command=reset]');
  await browser.click('[data-command=confirm-reset]');
  assert.deepEqual((await saved()).story,{memories:[],reply:'',completed:[],affinity:{},encounter:null});
  await browser.wait('!document.querySelector("#ws-panel[open]")');
  await browser.click('[data-command="saves"]');
  await browser.click('[data-command="save-slot"][data-slot="3"]');
  const manual = await browser.evaluate('localStorage.getItem("jz-workshop-slot-v1-3")');
  assert.ok(manual);
  await browser.click('[data-command="back"]');
  await endDay();
  await browser.click('[data-command="restart"]');
  assert.equal((await saved()).day,2);
  assert.ok(await browser.evaluate('document.activeElement?.matches(\'#ws-panel [data-command="back"]\')'));
  await browser.click('#ws-panel [data-command="back"]');
  await browser.click('[data-command="title"]');
  await browser.click('[data-title-action="new"]');
  await browser.click('.ws-title-confirm [data-title-action="cancel"]');
  assert.equal((await saved()).day,2);
  await browser.click('[data-title-action="new"]');
  await browser.click('[data-title-action="confirm-new"]');
  await browser.wait('document.querySelector(".ws-panel-day[open] h2")?.textContent === "第 1 天"');
  assert.equal(await browser.evaluate('localStorage.getItem("jz-workshop-slot-v1-3")'),manual);
  await browser.wait('!document.querySelector("#ws-panel[open]")');
  await browser.evaluate('localStorage.setItem("jz-workshop-v1", "damaged")');
  await browser.click('[data-command="title"]');
  await browser.click('[data-title-action="load"]');
  assert.ok(await browser.evaluate('document.querySelector(\'[data-title-save="auto"]\').disabled'));
  await browser.click('[data-title-save="3"]');
  await browser.wait('document.querySelector("#ws-map") && !document.querySelector("#ws-panel[open]")');
  assert.deepEqual(await saved(),JSON.parse(manual).state);
  assert.deepEqual(browser.errors,[]);
  assert.deepEqual(await browser.evaluate('window.workshopConsoleErrors'),[]);
  console.log('PASS dialogue pause and resume, stitch drafts, safe restart, refresh, affinity, mobile and three epilogues');
} catch(error) {
  console.error(error.message);
  console.error(browser.errors);
  await capture('新版-失败现场');
  process.exitCode=1;
} finally { browser.close(); }
