import { esc } from '../data.js';
import { readLocal, writeLocal } from '../storage.js';
import { applyAction, closeDay, freshWorkshop, loadWorkshop, placeFor, places, unavailable, workshopActions } from '../workshop/rules.js';
import { beside, cameraAt, clickedPlace, directions, entryPoint, feet, gridPoint, pathTo, scale, scenePlaces, scenes, tile, viewHeight, viewWidth, walkable } from '../workshop/map.js';
import { actorHeight, drawActor, portrait, profiles } from '../workshop/characters.js';
import { advanceDialogue, chooseDialogue, currentDialogue, dialogueTopics, finishDialogue, startDialogue, storyEndings } from '../workshop/dialogue.js';
import { blankFur, compareFur, furDisplay, furLesson, furTeaching, furWorkbench } from '../workshop/fur.js';
import { freshSwiftDraft, hasSwift, swiftComparison, swiftParts, swiftPiece, swiftReview, swiftWorkbench } from '../workshop/swift.js';
import { bindSwiftInput } from '../workshop/swift-input.js';
import { drawExhibit, makeScenery } from '../workshop/scenery.js';
import { chapterDays, chapterEndings, chapterGroups, helpShop, incidentNames, rehearsalSteps, saveReplica, schedule, shopShift, shopShiftReason, takeChapterOption } from '../workshop/chapter.js';
import { dailyCost, economyEnding, economyResult, exclusiveSample, lateFee, pendingDeposits, rentCost, rentOwed, replicaCost, shiftPay } from '../workshop/economy.js';
import { archiveNotes } from '../workshop/archive-notes.js';
import { readWorkshopSlot, workshopSlots, writeWorkshopSlot } from '../workshop/saves.js';
import '../styles/workshop.css';

const saveKey = 'jz-workshop-v1';
const openingScene = 'studio';
const openingLength = 1250;
const saveTime = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });
const keys = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
export function WorkshopPage() {
  return `<section class="ws-page" aria-labelledby="ws-title">
    <header class="ws-top">
      <div class="ws-brand"><a href="#/" aria-label="返回匠作展馆">←</a><div><p class="ws-kicker" id="ws-today">燕子过河</p><h1 id="ws-title">工坊还有三十天</h1></div></div>
      <div class="ws-stats" id="ws-stats"></div>
    </header>
    <div class="ws-field">
      <div class="ws-map" style="--ws-map-ratio:${viewWidth / viewHeight}"><canvas id="ws-map" width="${viewWidth * scale}" height="${viewHeight * scale}" tabindex="0" aria-label="工坊地图。方向键或 WASD 移动，空格互动。也可点击人物或地点名称。"></canvas>
      <div class="ws-location" id="ws-location" aria-live="polite"></div><div id="ws-pins"></div>
      <button class="ws-proximity" id="ws-proximity" type="button" data-command="interact" aria-keyshortcuts="Space" hidden>
        <span class="ws-proximity-desktop">按 <kbd>空格键</kbd> 交互</span><span class="ws-proximity-touch">轻点互动</span><span class="ws-proximity-name"></span>
      </button></div>
    </div>
    <footer class="ws-controls">
      <div class="ws-hint"><span id="ws-near" role="status">点击地图或使用方向键移动。</span><span class="ws-keys"><kbd>WASD</kbd> 移动 · <kbd>空格</kbd> 互动</span></div>
      <div class="ws-pad" aria-label="移动控制">${[['left','←','向左'],['up','↑','向上'],['down','↓','向下'],['right','→','向右']].map(([dir, arrow, label]) => `<button type="button" data-move="${dir}" aria-label="${label}">${arrow}</button>`).join('')}</div>
      <div class="ws-toolbar"><button type="button" data-command="interact" id="ws-interact" aria-keyshortcuts="Space">互动 <kbd>空格</kbd></button><button type="button" data-command="calendar">日程</button><button type="button" data-command="log">账本</button><button type="button" data-command="saves">存档</button><button type="button" data-command="help" aria-label="玩法与素材来源">?</button><button type="button" data-command="close">收工</button><button type="button" class="ws-restart" data-command="restart" title="从第一天重新开始">重开本局</button></div>
    </footer>
    <dialog class="ws-panel" id="ws-panel" aria-label="工坊行动"></dialog>
    </section>`;
}

function conversation(s, place) {
  switch (place) {
    case 'master': return s.fur.studied ? '白猫练习的布我放在工作台了。燕子的完整底稿先留在工坊，要做新样可以自己画。' :
      '我把一张白猫绣片的展览资料放在绣案边。你有空就过来，看看人家怎么把一撮猫毛绣活的。';
    case 'apprentice': {
      if (exclusiveSample(s) && s.day>=11 && !s.economy.consult) return '原样已经留在秦砚那里了？程渡还在等我用它教。我想先把体验桌换成什么弄清楚。';
      if (s.economy.lesson==='delegated') return '程渡那一针是他自己选的落点。下回这张桌还给我带，好吗？';
      if (s.story.reply === 'together' || s.story.reply === 'later') return '周日见。我记得。';
      if (s.story.reply === 'friends') return '我想在这儿坐一会儿。等画好下一只燕子，我再拿给你看。';
      if (s.story.completed.includes('apprentice:showBird')) return '说好了，下次我们各带一张图。';
      if (s.fur.sample && !s.fur.shared) return '这两块试布的毛看着不一样。你能挑一处做给我看吗？';
      return s.taught ? '我已经能自己起针了。布展那天可以让我试着带一位访客。' :
      s.day === 1 ? '我今晚就要去上班。你今天要是得空，能带我从头练一遍吗？' :
      s.day === 2 ? '我把昨晚画的小东西带来了。你这会儿有空吗？' : '等会儿收工，你能陪我在这里坐一下吗？';
    }
    case 'teaSeller': return '茶刚泡好。要不要坐下来歇歇脚？';
    case 'merchant': return s.day>=13 ? '样片摆好了。有人肯停下来多看一眼，我也想听听他问什么。' :
      s.day===11 ? '今天核样。标签还没贴，你来一起看。' : '带来的两样东西我都放在柜台了。你有样片的话，也拿出来比一比。';
    case 'scholar': return s.day>6 && ['notified','missed'].includes(s.economy.source) ?
      '旧样有几处要等陆师傅亲自确认。先把确定的内容交给我，空行留着。' : s.day>=13 ? '工坊留存的副本就在我手上。你来看看，哪件事还值得再问一次。' :
      '录音笔先放在桌边。你想先看旧样，还是读我整理的那几行字？';
    case 'visitor': return s.story.memories.includes('invited')
      ? (s.display || s.fur.shown ? '你来了！我把展台画下来了。' : '我把给展台留的那页夹好了。')
      : '嗨。你也是从桥那边过来的吗？';
    case 'loom': return s.fur.studied && !s.fur.sample ? '师傅留了两块练习布。左边的针脚一样长，右边这块可以试试按毛势分层绣。' :
      hasSwift(s) ? '你的雨燕样片保留在这里。店主可以看样报价，展览也可以用这块样片。' : '换一块新布，在轮廓上试一只自己的雨燕。顺着翅羽的方向走针，燕子看起来才像在飞。';
    case 'desk': return s.recorded ? '展签已确认，陆师傅同意展出局部。抽屉里还有今早夹进来的散页。' : '桌上放着待整理的展签。旁边的册子每天收一张散页，有街坊交来的，也有从旧柜里翻出来的。';
    case 'shop': return s.sold ? '样片我看过了，订单已结清。展台上那块试样你留着。' :
      s.order === 'tomorrow' ? '我们约好第二天交货。带上新样，我就把尾款付清。' :
      s.order === 'missed' ? '这单的定金已经退回。下次有空再做新的合作。' :
      s.day === 1 ? '我需要一批新的雨燕纹样。今天能交付是急单价，也可以约到明天，先付定金。' : '这一轮的订单已关闭。我会去看你们的展览。';
    case 'exhibit': {
      if (s.day>=13) {
        const first={
          craft:(!exclusiveSample(s) && s.chapter.replica.length) || s.fur.sample ? '有个访客拿起两块试布，问为什么线在光下看着不一样。' : '有个访客停在练习布前，问怎么找到第一针的位置。',
          design:'一位客人沿着小票上的两道翅线比到成品，问阿禾能不能讲讲她改了哪几针。',
          origin:s.chapter.archive==='excerpt' && s.economy.source!=='verified' ? '有人停在「待核」那一行，问能不能看看获准展出的旧样局部。' : '有人问起旧样，沈照宁拿出可公开的针法记录和工坊的练习布。',
        }[s.chapter.label];
        return s.chapter.fair ? (first || {teach:'第一位客人已把练习布卷好，说明天还想来。',paid:'体验费记进了账本，客人带走了自己绣的布。',sales:'柜台的货签翻到了正面，客人看清名字才买下。',apprentice:'阿禾把署名翻给第一个问的人看，开始讲她那只燕子。'}[s.chapter.fair]) :
          (s.economy.booth==='own'?'独立摊位已经摆了两张桌。':'春姨的共用桌空出来了。')+' 河集最忙的时段快到了。';
      }
      return s.fur.shown ? '两块猫毛试布并排摆好了。展签上留着原作资料，可以对照着看。' :
      s.display === 'archive' ? '展台上的展签已经标清原作、样片和来源。' :
      s.display === 'open' ? (s.taught ? '阿禾在展台带访客体验，你的试绣是桌上的参照。' : '试绣样片已经摆好，今天你会在体验桌旁示范。') : '第三天在河畔办一次展。你可以把图样的来历讲清楚，也可以留一张桌子请访客亲手试针。';
    }
    default: return '';
  }
}

function ledgerRows(s) {
  const e=s.economy;
  const pending=pendingDeposits(s), owed=rentOwed(s);
  return `<dt>手头现金</dt><dd>${s.cash} 元</dd>
    <dt>非遗营业收入</dt><dd>${e.revenue} 元</dd>
    <dt>材料及包装</dt><dd>${e.materials} 元</dd>
    <dt>房租、摊位及日常开支</dt><dd>${e.overhead} 元</dd>
    <dt><strong>非遗净利润</strong></dt><dd><strong>${economyResult(s).profit} 元</strong></dd>
    <dt>开局资金及零工</dt><dd>36 元 + ${e.wages} 元</dd>
    ${pending?`<dt>待交付的定金</dt><dd>${pending} 元</dd>`:''}
    ${owed?`<dt>房租应付</dt><dd>${owed} 元${e.rent==='deferred'?' · 第 11 天补交':' · 逾期'}</dd>`:''}`;
}

function rentNotice(s) {
  if (s.done) return rentOwed(s)?`散集时仍有 ${rentOwed(s)} 元房租待付。`:'';
  if (s.day<6) return `第 6 天收工时要交 ${rentCost} 元房租。`;
  if (s.day===6 && !s.economy.rent) return s.cash-pendingDeposits(s)-dailyCost>=rentCost
    ? `今晚另付 ${rentCost} 元房租。`
    : `今晚的现金还不够交租。房租会延期到第 11 天，应付 ${rentCost+lateFee} 元。`;
  if (rentOwed(s) && s.day>=11) return `还欠 ${rentOwed(s)} 元房租，收工时会用可用现金补交。`;
  if (rentOwed(s)) return `第 11 天需补交 ${rentOwed(s)} 元房租。`;
  return '';
}

function activityReceipt(before, after) {
  if (before.day !== after.day || after.done) return '';
  const time = before.hours - after.hours;
  const expenses = after.economy.materials + after.economy.overhead - before.economy.materials - before.economy.overhead;
  const received = after.cash - before.cash + expenses;
  const moneyLabel = pendingDeposits(after) > pendingDeposits(before) ? '收到定金' : '收到报酬';
  const lines = [
    time > 0 && `过去了 ${time} 小时`,
    received > 0 && `${moneyLabel} ${received} 元`,
    received < 0 && `退回定金 ${-received} 元`,
    expenses > 0 && `支出 ${expenses} 元`,
  ].filter(Boolean);
  return lines.length ? `<div class="ws-receipt" role="status">${lines.map(line => `<span>${line}</span>`).join('')}</div>` : '';
}

export function initWorkshop() {
  const root = document.querySelector('.ws-page');
  const canvas = root.querySelector('#ws-map');
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const panel = root.querySelector('#ws-panel');
  const cue = root.querySelector('#ws-proximity');
  const cueName = cue.querySelector('.ws-proximity-name');
  const status = root.querySelector('#ws-near');
  const interactButton = root.querySelector('#ws-interact');
  const pins = root.querySelector('#ws-pins');
  const location = root.querySelector('#ws-location');
  const rawSave=readLocal(saveKey);
  const restored=loadWorkshop(rawSave);
  let state = restored || freshWorkshop();
  const normalized=JSON.stringify(state);
  if(normalized!==rawSave) writeLocal(saveKey,normalized);
  let active = state.story.encounter?.person || '';
  let scene = active ? placeFor(active,state.day).scene : openingScene, targets = scenePlaces(scene,state.day);
  const sceneries = new Map();
  let position = entryPoint(scene), facing = 'up', frame = 0;
  let camera = cameraAt(position), scenePins = [];
  let moving = false, queue = [], destination = '', view = active ? 'place' : state.done ? 'summary' : restored ? 'intro' : 'day-start';
  let swiftDraft, swiftMode='main', comparisonLight=1, chapterGroup='', rehearsal, cuedPin;
  let furDraft, furFocus = '', showingShared = false;
  let pendingSlot, saveNotice = '';
  let openingTimer = 0, receipt = '', archiveDay = state.day;
  const held = new Set();
  let lastFrame = 0, gait = 0;
  const canWalk = (x, y) => walkable(scene, x, y, targets);
  if (active) position = pathTo(position, point => beside(point, targets[active]), canWalk).at(-1) || position;
  const swiftInput = bindSwiftInput(root, () => view === 'stitch' ? swiftDraft : null, () => renderPanel('[data-swift-board]'));

  function renderScene() {
    location.innerHTML = `<strong>${scenes[scene].name}</strong><span>${scenes[scene].caption}</span>`;
    pins.innerHTML = Object.entries(targets).map(([id, p]) =>
      `<button type="button" class="ws-pin${p.to ? ' ws-gate' : ''}" data-walk="${id}" aria-label="${p.to ? p.name : `走到${p.name}`}">${p.sign}<span aria-hidden="true"></span></button>`).join('');
    scenePins = [...pins.children].map(button => {
      const p = targets[button.dataset.walk], at = feet(p);
      return { button, indicator:button.querySelector('span'), door:p.to, x:at.x, y:at.y-(profiles[button.dataset.walk] ? actorHeight+3 : 13) };
    });
    if (!sceneries.has(scene)) sceneries.set(scene, makeScenery(scene));
    paint(); hint();
  }

  function enterScene(next) {
    position = entryPoint(next, scene);
    scene = next; targets = scenePlaces(scene,state.day);
    facing = next === 'lane' ? 'down' : 'up';
    renderScene();
    canvas.focus({ preventScroll: true });
  }

  function paint(x = position.x, y = position.y, step = -1) {
    const { image, props } = sceneries.get(scene);
    camera = cameraAt({x,y});
    ctx.save(); ctx.translate(-camera.x,-camera.y);
    ctx.drawImage(image,camera.x*scale,camera.y*scale,viewWidth*scale,viewHeight*scale,camera.x,camera.y,viewWidth,viewHeight);
    const actors = Object.entries(targets).filter(([id]) => profiles[id]).map(([id, p]) => ({ id, x: p.x, y: p.y, facing: 'down', step: -1 }));
    actors.push({ id: 'player', x, y, facing, step });
    const layers = [...props, ...actors.map(actor => ({ ...actor, depth: feet(actor).y }))];
    layers.sort((a, b) => a.depth - b.depth).forEach(layer => {
      if (!layer.image) { drawActor(ctx, layer.id, layer.x, layer.y, layer.facing, layer.step); return; }
      ctx.drawImage(layer.image, layer.x, layer.y, layer.w, layer.h);
      if (layer.id === 'exhibit' && (state.display || state.fur.shown)) {
        drawExhibit(ctx, layer.piece, state);
      }
    });
    ctx.restore();
    const screenWidth = canvas.clientWidth;
    const bannerRight = location.offsetLeft+location.offsetWidth+6;
    const bannerBottom = location.offsetTop+location.offsetHeight+4;
    const sizes = scenePins.map(({button}) => ({half:button.offsetWidth/2,height:button.offsetHeight}));
    for (const [i,pin] of scenePins.entries()) {
      const x = pin.x-camera.x, y = pin.y-camera.y;
      const arrow = x < 20 ? '←' : x > viewWidth-20 ? '→' : y < 15 ? '↑' : y > viewHeight-10 ? '↓' : '';
      const screenX = Math.max(41,Math.min(screenWidth-41,x/viewWidth*screenWidth));
      const minY = screenX-sizes[i].half < bannerRight ? bannerBottom+sizes[i].height : 24;
      pin.button.style.setProperty('--px', `${x / viewWidth * 100}%`);
      pin.button.style.setProperty('--py', `${y / viewHeight * 100}%`);
      pin.button.style.setProperty('--pin-min-y', `${minY}px`);
      pin.button.classList.toggle('ws-pin-distant', Boolean(arrow));
      const label = arrow ? ' '+arrow : pin.door ? ' ↗' : '';
      if (pin.indicator.textContent !== label) pin.indicator.textContent = label;
    }
    hint({ x, y });
  }

  function nearest(point = position) {
    const at = feet(point);
    let closest = '', distance = Infinity;
    for (const [id, target] of Object.entries(targets)) {
      if (!beside(point, target)) continue;
      const anchor = feet(target), gap = Math.hypot(at.x - anchor.x, at.y - anchor.y);
      if (gap < distance) { distance = gap; closest = id; }
    }
    return closest;
  }

  function hint(point = position) {
    const id = nearest(point), visible = Boolean(id && !panel.open);
    const name = id ? targets[id].name : '';
    const message = id ? `身边 · ${name}` : '点地面走动，点名字前往。';
    if (status.textContent !== message) status.textContent = message;
    interactButton.disabled = !visible;
    cue.hidden = !visible;
    const currentPin = visible ? pins.querySelector(`[data-walk="${id}"]`) : null;
    if (cuedPin !== currentPin) {
      if (cuedPin) cuedPin.hidden = false;
      if (currentPin) currentPin.hidden = true;
      cuedPin = currentPin;
    }
    if (visible) {
      const at = feet(point);
      cue.style.setProperty('--cue-x', `${(at.x-camera.x) / viewWidth * 100}%`);
      cue.style.setProperty('--cue-y', `${Math.max(21, at.y-camera.y-actorHeight-4) / viewHeight * 100}%`);
      if (cueName.textContent !== name) cueName.textContent = name;
    }
  }

  function stats() {
    root.querySelector('#ws-today').textContent=`燕子过河 · ${schedule[state.day-1][0]}`;
    root.querySelector('#ws-stats').innerHTML = `<span>日程 <strong>第 ${state.day} / ${chapterDays} 天</strong></span><span>今日剩余 <strong>${state.hours} 小时</strong></span><span>工坊余额 <strong>${state.cash} 元</strong></span><span>传习 <strong>${state.taught || state.chapter.rehearsal ? '已跟练' : '待安排'}</strong></span>`;
    root.querySelector('[data-command="close"]').textContent = state.done ? '结算' : '收工';
  }

  function renderPanel(focus = '') {
    panel.classList.toggle('ws-panel-day', view === 'day-start');
    if (view === 'day-start') {
      panel.innerHTML = `<h2 tabindex="-1">第 ${state.day} 天</h2><p>青梧绣坊</p>`;
      if (!panel.open) panel.showModal();
      panel.querySelector('h2').focus({ preventScroll: true });
      if (!openingTimer) openingTimer = window.setTimeout(() => {
        openingTimer = 0;
        closePanel();
      }, openingLength);
      hint();
      return;
    }
    if (view === 'intro') {
      if (panel.open) panel.close();
      hint();
      return;
    }
    const line = view === 'place' ? currentDialogue(state) : null;
    const { spoken, mood, continuing } = line || {};
    const artId = spoken?.speaker && spoken.speaker!=='stage' ? spoken.speaker : active;
    const art = view === 'place' ? portrait(artId, artId === active ? mood : spoken?.mood) : null;
    panel.classList.toggle('ws-panel-portrait', Boolean(art));
    panel.classList.toggle('ws-panel-fur', view.startsWith('fur-') || view==='rehearsal' || view==='comparison');
    panel.classList.toggle('ws-panel-swift', view === 'stitch');
    if (view === 'calendar') {
      const [title,where,notice]=schedule[state.day-1];
      const chance=incidentNames[state.chapter.incidents[state.day]];
      panel.innerHTML=`<p class="ws-kicker">燕子过河 · 第 ${state.day} 天</p><h2>${title}</h2>
        <p class="ws-kicker">${where}</p><p>${notice}</p>${chance?`<p class="ws-calendar-chance">${chance}</p>`:''}
        <p>${rentNotice(state)} 租约还剩 ${state.done?16:31-state.day} 天。${state.day<13?'河集在第十三天开摊。':'工坊会在第十四天收工时结算。'}</p>
        <button type="button" data-command="back">回到工坊</button>`;
    } else if (view === 'saves') {
      panel.innerHTML = savesPanel();
    } else if (view === 'archive-notes') {
      const [title, source, ...paragraphs] = archiveNotes[archiveDay-1];
      panel.innerHTML = `<p class="ws-kicker">旧样档案室 · 第 ${archiveDay} 天收录</p><h2 tabindex="-1">${title}</h2>
        <article class="ws-archive-slip" aria-label="散页正文"><p class="ws-archive-source">${source}</p>${paragraphs.map(text => `<p>${text}</p>`).join('')}</article>
        <div class="ws-archive-nav"><button type="button" data-command="archive-prev" ${archiveDay===1?'disabled':''}>前一页</button>
        <span>第 ${archiveDay} / ${state.day} 页</span><button type="button" data-command="archive-next" ${archiveDay===state.day?'disabled':''}>后一页</button>
        <button type="button" data-command="chapter-back">合上册子</button></div>`;
    } else if (view === 'log') {
      panel.innerHTML = `<p class="ws-kicker">经营记录</p><h2>工坊账本</h2><dl class="ws-results">${ledgerRows(state)}</dl>
        <p>${rentNotice(state)} 订单定金在交付时计入收入。</p><ol class="ws-log">${state.log.map(line => `<li>${esc(line)}</li>`).join('')}</ol>
        <div class="ws-actions"><button type="button" data-command="back">合上账本</button><button type="button" data-command="reset">重新开局</button></div>`;
    } else if (view === 'help') {
      panel.innerHTML = `<p class="ws-kicker">春汛老街</p><h2>工坊手记</h2><p>这十四天，绣坊要准备河集。点「日程」可以看今天有人在哪儿等你。</p>
        <p>每天回来找熟悉的人说说话，有些话题会接着上次聊下去。聊过的话题不会重来，离开页面后再进来，可以接着刚才那句。</p>
        <p>方向键或 WASD 移动。头顶出现提示时按空格互动。对话中用 W/S 或 ↑↓ 选择，空格确认，Esc 返回。</p>
        <p>人物和经营情境为虚构。<a href="#/project/13978">查看苏绣档案 ↗</a></p>
        <p class="ws-credits">场景与行走角色为工坊原创二维绘制，对话立绘由 AI 辅助生成。</p>
        <button type="button" data-command="back">回到工坊</button>`;
    } else if (view === 'stitch') {
      panel.innerHTML = swiftWorkbench(swiftDraft,swiftMode,state);
    } else if (view === 'comparison') {
      panel.innerHTML = swiftComparison(state,comparisonLight);
    } else if (view === 'chapter') {
      const group=chapterGroups(state,active).find(item=>item.id===chapterGroup);
      panel.innerHTML = `<p class="ws-kicker">第 ${state.day} 天 · ${places[active].name}</p><h2>${group.title}</h2><p>${group.text}</p>
        <div class="ws-actions">${group.choices.map(([value,label,,hours,reason])=>`<div><button type="button" data-chapter-choice="${value}" ${reason || state.hours<hours?'disabled':''}>${label}</button>${reason?`<small>${reason}</small>`:state.hours<hours?'<small>今天来不及了。</small>':''}</div>`).join('')}
        <button type="button" data-command="chapter-back">回到原处</button></div>`;
    } else if (view==='rehearsal') {
      const steps=rehearsalSteps[rehearsal.kind];
      const live=rehearsal.group==='fair';
      panel.innerHTML=`<p class="ws-kicker">${live?'河集 · 体验桌':'阿禾 · 传习排练'}</p><h2>把针递给下一双手</h2>
        ${rehearsal.kind==='fur'?compareFur(state.fur.sample):rehearsal.kind==='swift'?swiftPiece(state):''}
        <p>${live?'程渡终于坐到了体验桌旁。等他自己接上一针，他就能带这块布回家。':'阿禾坐在程渡旁边。你选一个先做的动作，她就照着带他往下走。'}</p>
        <p class="ws-calendar-chance" role="status">${rehearsal.note || '程渡把针拿反了，等着你们先示范。'}</p>
        <div class="ws-actions">${[2,0,1].map(index=>`<button type="button" data-rehearsal-step="${index}" ${index<rehearsal.step?'disabled':''}>${steps[index][0]}</button>`).join('')}
        <button type="button" data-command="finish-rehearsal" ${rehearsal.step<3?'disabled':''}>${live?'把这块练习布交给程渡':'让阿禾照这段在河集讲'}</button>
        <button type="button" data-command="chapter-back">回到原处</button></div>`;
    } else if (view === 'fur-lesson') {
      panel.innerHTML = furLesson(state.fur.studied);
    } else if (view === 'fur-sew') {
      panel.innerHTML = furWorkbench(furDraft);
    } else if (view === 'fur-share') {
      panel.innerHTML = furTeaching(state.fur.sample, furFocus);
    } else if (view === 'fur-exhibit') {
      panel.innerHTML = furDisplay(state.fur, showingShared);
    } else if (view === 'summary') {
      const result=economyResult(state);
      panel.innerHTML = `<p class="ws-kicker">第十四天 · 收工</p><h2 class="ws-summary-title" tabindex="-1">桥这边的灯</h2>${hasSwift(state) ? swiftPiece(state) : ''}
        <dl class="ws-results">${ledgerRows(state)}<dt>小店早期订单</dt><dd>${state.sold ? '已交付' : state.order === 'missed' ? '已退定金' : '未接单'}</dd>
        <dt>河集合作</dt><dd>${{full:'已核签交货',small:'缩小范围后交货',paused:'已退定金',self:'工坊自展'}[state.chapter.delivery] || '工坊自展'}</dd>
        <dt>河集安排</dt><dd>${{teach:'免费体验桌',paid:'收费体验桌',sales:'柜台卖货',apprentice:'阿禾署名展位'}[state.chapter.fair] || '未安排主展位'}${state.economy.lesson==='delegated'?' · 阿禾另带一场体验':''}</dd>
        ${state.fur.studied ? `<dt>猫毛试绣</dt><dd>${state.fur.shown ? '已展出对照试布' : state.fur.sample ? '已完成两块试布' : '看过作品资料'}${state.fur.shared ? ' · 阿禾完成跟练' : ''}</dd>` : ''}</dl>
        <section class="ws-epilogue"><h3>社会影响 · ${result.reach} / 6</h3>
          <dl class="ws-results">${result.impact.map(([label, outcomes])=>`<dt>${label} · ${outcomes.length} / 2</dt><dd>${outcomes.join('') || '这次还没留下成果。'}</dd>`).join('')}</dl></section>
        <section class="ws-epilogue" aria-label="这十四天之后"><p class="ws-kicker">这十四天之后 · 租约还剩十六天</p>${[economyEnding(state),...chapterEndings(state),...storyEndings(state)].map(ending => `<h3>${ending.title}</h3><p>${ending.text}</p>`).join('')}</section>
        <div class="ws-actions"><button type="button" data-command="reset">再经营一局</button><button type="button" data-command="back">回到工坊</button></div>`;
    } else if (view === 'close' || view === 'reset') {
      const reset = view === 'reset';
      panel.innerHTML = `<p class="ws-kicker">${reset ? '新一轮' : '工坊账本'}</p><h2>${reset ? '从第一天重新开始？' : '今天收工？'}</h2>
        <p>${reset ? '会从第一天开始新的一局。手动存档仍可在「存档」中读取。' : `还剩 ${state.hours} 小时。收工结算 ${dailyCost} 元开支${state.day<chapterDays?'，明天再开门':'，然后看看这十四天留下了什么'}。${state.day>=6?rentNotice(state):''}`}</p>
        <div class="ws-actions"><button type="button" data-command="${reset ? 'confirm-reset' : 'confirm-close'}">${reset ? '重新开局' : '结算今天'}</button><button type="button" data-command="back">返回工坊</button></div>`;
    } else if (view === 'place' && active) {
      const artwork = art ? `<div class="ws-portrait ws-portrait-${artId}" data-mood="${art.mood}" style="--portrait-width:${art.width}%;--portrait-center:${art.center}%;--portrait-offset:${art.offset}%;--portrait-ratio:${art.ratio}"><img src="${art.src}" alt="${artId === 'player' ? '主角' : places[artId].name}的立绘" draggable="false"></div>` : '';
      const topics = line ? [] : dialogueTopics(state, active);
      const actions = line ? [] : workshopActions(state, active);
      const speaker = artId === 'player' ? '你' : places[artId].name;
      const narration = spoken?.speaker === 'stage';
      const shiftNote = shopShiftReason(state);
      const sampleAtCounter = exclusiveSample(state) && state.day<=13;
      panel.innerHTML = `<div class="ws-dialogue">${artwork}<div class="ws-dialogue-copy"><p class="ws-kicker">${scenes[scene].name}</p><h2>${speaker}</h2>
        ${spoken ? `<p tabindex="-1" class="ws-spoken${narration ? ' ws-aside' : ''}">${esc(spoken.text)}</p>` : `<p>${conversation(state, active)}</p>`}
        ${line?.gain ? `<div class="ws-affinity" role="status">${places[active].sign} · 好感 +${line.gain}</div>` : ''}
        ${receipt}
        ${!line && hasSwift(state) && ['loom','shop','exhibit'].includes(active) && !(sampleAtCounter&&active!=='shop') ? swiftPiece(state) : ''}
        ${!line && active === 'shop' && state.swift.length ? `<p>${swiftReview(state.swift)}</p>` : ''}
        <div class="ws-actions">
          ${continuing ? '<button type="button" data-command="continue-dialogue">继续 <span aria-hidden="true">›</span></button>' : ''}
          ${topics.map(([id, label]) => `<button type="button" data-topic="${id}">${label}</button>`).join('')}
          ${!line && active==='desk' ? '<button type="button" data-command="archive-notes">翻阅今日收录的散页</button>' : ''}
          ${line?.choices.map(({label,reason}, index) => `<div><button type="button" data-reply="${index}" ${reason?'disabled':''}>${label}</button>${reason?`<small>${reason}</small>`:''}</div>`).join('') || ''}
          ${!line ? chapterGroups(state,active).filter(()=>!state.done).map(group=>`<button type="button" data-chapter-open="${group.id}">${group.title}</button>`).join('') : ''}
          ${actions.map(action => {
            const reason = unavailable(state, action);
            return `<div><button type="button" data-action="${action.key}" ${reason ? 'disabled' : ''}>${action.label}</button>${reason ? `<small>${reason}</small>` : ''}</div>`;
          }).join('')}
          ${!line && active === 'master' && state.fur.studied ? '<button type="button" data-command="fur-reference">再看白猫绣片资料</button>' : ''}
          ${!line && active === 'loom' && hasSwift(state) ? '<button type="button" data-command="swift-practice">拿边角布练走针</button>' : ''}
          ${!line && active==='loom' && state.day>=7 && !state.done && hasSwift(state) && !state.chapter.replica.length ? `<button type="button" data-command="swift-replica" ${state.hours<1 || state.cash<replicaCost || sampleAtCounter?'disabled':''}>照着原样复绣近翅 · ${replicaCost} 元</button>` : ''}
          ${!line && (sampleAtCounter?active==='merchant':['loom','merchant','exhibit'].includes(active)) && state.chapter.replica.length ? '<button type="button" data-command="swift-compare">把原样和复样放到灯下</button>' : ''}
          ${!line && active==='shop' && shopShift(state) ? `<div><button type="button" data-command="chapter-help-shop" ${shiftNote?'disabled':''}>帮周岚分拣货样 · 收 ${shiftPay} 元</button>${shiftNote?`<small>${shiftNote}</small>`:''}</div>` : ''}
          ${!line && active === 'exhibit' && state.fur.shown ? '<button type="button" data-command="fur-placard">看看猫毛试布展签</button>' : ''}
          ${line && !continuing && !line.choices.length ? '<button type="button" data-command="finish-dialogue">结束对话</button>' : ''}
          ${line ? '' : '<button type="button" data-command="back">继续走动</button>'}
        </div></div></div>`;
    }
    if (view !== 'place' && receipt) panel.insertAdjacentHTML('beforeend', receipt);
    panel.insertAdjacentHTML('beforeend', `<div class="ws-dialogue-keys"><kbd>W</kbd> <kbd>S</kbd> 或 <kbd>↑↓</kbd> 选择 <kbd>空格</kbd> 确认${line ? '' : ' <kbd>Esc</kbd> 返回'}</div>`);
    if (!panel.open) panel.showModal();
    hint();
    if (view === 'summary') panel.scrollTop = 0;
    const preferred = panel.querySelector(view === 'summary' ? '.ws-summary-title' : focus || 'button:not([disabled])');
    (preferred && !preferred.disabled ? preferred : dialogOptions()[0])?.focus({ preventScroll: true });
    if (view === 'stitch') swiftInput.update();
  }

  function dialogOptions() {
    return [...panel.querySelectorAll('button:not([disabled]), a[href], [data-swift-board]')];
  }

  function savesPanel() {
    if (pendingSlot) {
      const { number, operation } = pendingSlot;
      const loading = operation === 'load-slot';
      return `<p class="ws-kicker">本地存档</p><h2>${loading ? '读取' : '覆盖'}存档 ${number}？</h2>
        <p>${loading ? '当前进度会切换到这个档位。需要保留当前进度的话，请先另存。' : '这个档位里的旧进度会被当前进度替换。'}</p>
        <div class="ws-actions"><button type="button" data-command="cancel-slot">取消</button><button type="button" data-command="confirm-slot">${loading ? '读取存档' : '覆盖存档'}</button></div>`;
    }

    const slots = workshopSlots.map(number => ({ number, ...readWorkshopSlot(number) }));
    return `<p class="ws-kicker">本地存档</p><h2>工坊存档</h2>
      <p>保存已完成的行动、作品和对话选择。档位保存在当前浏览器。</p>
      <ul class="ws-save-slots">${slots.map(({ number, kind, game, savedAt }) => `<li>
        <div><strong>存档 ${number}</strong>
        <span>${game ? `第 ${game.day} 天 · ${game.done ? '已结算' : `剩余 ${game.hours} 小时`}` : { empty: '空档位', damaged: '存档损坏', unavailable: '本地存储不可用' }[kind]}</span>
        ${game ? `<time datetime="${esc(savedAt)}">${saveTime.format(new Date(savedAt))}</time>` : ''}</div>
        <button type="button" data-slot="${number}" data-command="save-slot" aria-label="${kind === 'empty' ? '保存到' : '覆盖'}存档 ${number}" ${kind === 'unavailable' ? 'disabled' : ''}>${kind === 'empty' ? '保存' : '覆盖'}</button>
        <button type="button" data-slot="${number}" data-command="load-slot" aria-label="读取存档 ${number}" ${game ? '' : 'disabled'}>读取</button>
      </li>`).join('')}</ul>
      <p class="ws-save-notice" role="status">${saveNotice}</p><button type="button" data-command="back">返回工坊</button>`;
  }

  function useSlot(number, operation, confirmed) {
    const slot = readWorkshopSlot(number);
    const loading = operation === 'load-slot';
    const button = `[data-command="${operation}"][data-slot="${number}"]`;
    if (slot.kind === 'unavailable') saveNotice = '浏览器当前无法访问本地存储。';
    else if (confirmed && slot.raw !== confirmed.raw) saveNotice = '这个档位已经变化，请重新选择。';
    else if (loading && slot.kind !== 'saved') saveNotice = '这个档位没有可读取的进度。';
    else if (!confirmed && (loading || slot.kind !== 'empty')) {
      pendingSlot = { number, operation, raw: slot.raw };
      renderPanel('[data-command="cancel-slot"]');
      return;
    } else if (loading) {
      replaceWorkshop(slot.game, slot.spot);
      return;
    } else {
      const saved = writeWorkshopSlot(number, state, { scene, facing, ...position });
      saveNotice = saved ? `已保存到存档 ${number}。` : '保存失败。请检查浏览器是否允许本地存储，或存储空间是否已满。';
    }
    renderPanel(button);
  }

  function cancelSlot() {
    const { number, operation } = pendingSlot;
    pendingSlot = undefined;
    renderPanel(`[data-command="${operation}"][data-slot="${number}"]`);
  }

  function replaceWorkshop(next, spot, openDay = false) {
    held.clear(); queue = []; destination = '';
    cancelAnimationFrame(frame);
    frame = lastFrame = gait = 0; moving = false;
    swiftDraft = furDraft = rehearsal = undefined;
    state = next;
    active = state.story.encounter?.person || '';
    scene = active ? placeFor(active, state.day).scene : openingScene;
    if (!active && typeof spot?.scene === 'string' && Object.hasOwn(scenes, spot.scene)) scene = spot.scene;
    targets = scenePlaces(scene, state.day);
    position = entryPoint(scene);
    if (spot?.scene === scene && Number.isFinite(spot.x) && Number.isFinite(spot.y) && canWalk(spot.x, spot.y)) {
      position = { x: spot.x, y: spot.y };
    }
    if (active && targets[active]) position = pathTo(position, point => beside(point, targets[active]), canWalk).at(-1) || position;
    facing = typeof spot?.facing === 'string' && Object.hasOwn(directions, spot.facing) ? spot.facing : 'up';
    view = openDay ? 'day-start' : active ? 'place' : state.done ? 'summary' : 'intro';
    writeLocal(saveKey, JSON.stringify(state));
    renderScene(); stats(); renderPanel();
    if (!panel.open) canvas.focus({ preventScroll: true });
  }

  function commit(next, focus) {
    const newDay=state.day!==next.day;
    receipt = activityReceipt(state, next);
    state = next;
    writeLocal(saveKey, JSON.stringify(state));
    stats();
    if(newDay) {
      active = '';
      gait = 0;
      view = 'day-start';
      enterScene(openingScene);
    } else if (!moving) paint();
    renderPanel(focus);
  }

  function openPlace(id) {
    const place = targets[id];
    if (!place) return;
    receipt = '';
    held.clear();
    if (place.to) { enterScene(place.to); return; }
    const dx = place.x - position.x, dy = place.y - position.y;
    facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    paint();
    view = 'place'; active = id;
    renderPanel('button:not([disabled])');
  }

  function interact() {
    const target = nearest();
    if (!target || panel.open) return;
    held.clear(); queue = []; destination = '';
    stopMotion(); openPlace(target);
  }

  function stopMotion() {
    cancelAnimationFrame(frame); frame = 0; lastFrame = 0; moving = false;
    paint(); hint();
  }

  function tick(now) {
    frame = 0;
    const distance = Math.min(lastFrame ? (now - lastFrame) / 1000 : 1/60, .035) * 83 / tile;
    lastFrame = now;
    let walked = 0;
    if (queue.length) {
      const next = queue[0];
      const dx = next.x - position.x, dy = next.y - position.y;
      const gap = Math.abs(dx) + Math.abs(dy);
      if (gap <= distance) {
        position = next; queue.shift(); walked = gap;
      } else {
        position = { x: position.x + dx / gap * distance, y: position.y + dy / gap * distance };
        walked = distance;
      }
      if (gap > .0001) facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    } else if (!destination && view === 'intro') {
      // Hold to move continuously; at a corner a second held direction can follow the wall.
      const heldDirections = [...new Set([...held].reverse().map(key => keys[key]))];
      for (const direction of heldDirections) {
        const [dx, dy] = directions[direction];
        const x = position.x + dx * distance * 2, y = position.y + dy * distance * 2;
        facing = direction;
        if (!canWalk(x, y)) continue;
        position = { x, y }; walked = distance;
        break;
      }
    }
    if (walked > 0) {
      gait = (gait + walked * tile / 22) % 1;
      paint(position.x, position.y, gait);
    }
    if (queue.length || (!destination && held.size && walked > 0)) {
      frame = requestAnimationFrame(tick);
      return;
    }
    const arrived = destination;
    destination = '';
    stopMotion();
    if (arrived && beside(position, targets[arrived])) openPlace(arrived);
  }

  function travel() {
    if (frame) return;
    moving = true; hint();
    frame = requestAnimationFrame(tick);
  }

  function move(steps, target = '') {
    if (panel.open) return;
    if (view !== 'intro') { view = 'intro'; renderPanel(); }
    queue = steps; destination = target;
    if (!moving) travel();
  }

  function nudge(direction) {
    if (moving && !destination) return;
    const [dx, dy] = directions[direction];
    const x = position.x + dx, y = position.y + dy;
    if (canWalk(x, y) && canWalk(position.x + dx / 2, position.y + dy / 2)) move([{ x, y }]);
  }

  function closePanel() {
    if (state.story.encounter || openingTimer) return;
    if (view === 'saves' && pendingSlot) { cancelSlot(); return; }
    if (view === 'stitch') swiftDraft.start = null;
    receipt = '';
    view = 'intro'; renderPanel(); canvas.focus({ preventScroll: true });
  }

  function onCancel(event) {
    event.preventDefault(); closePanel();
  }

  function onKey(event) {
    if (view === 'day-start') return;
    const key = event.key.toLowerCase();
    const space = event.code === 'Space' || key === ' ';
    if (panel.open) {
      if (swiftInput.onKey(event)) return;
      if (event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const options = dialogOptions();
      const current = options.indexOf(document.activeElement);
      if (space || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) options[Math.max(0, current)]?.click();
      } else if (['w','s','arrowdown','arrowright','arrowup','arrowleft','home','end'].includes(key) && options.length) {
        event.preventDefault();
        const forward = key === 's' || key === 'arrowdown' || key === 'arrowright';
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 :
          current < 0 ? (forward ? 0 : options.length - 1) : (current + (forward ? 1 : -1) + options.length) % options.length;
        options[index].focus();
      }
      return;
    }
    if (event.target !== canvas || event.altKey || event.ctrlKey || event.metaKey) return;
    if (keys[key]) {
      event.preventDefault();
      held.add(key);
      queue = []; destination = '';
      if (!moving) travel();
    }
    else if (space || key === 'e') { event.preventDefault(); if (!event.repeat) interact(); }
  }

  function onKeyUp(event) { held.delete(event.key.toLowerCase()); }
  function clearKeys() { held.clear(); }

  function goToPlace(id) {
    held.clear(); canvas.focus({ preventScroll: true });
    move(pathTo(position, point => beside(point, targets[id]), canWalk), id);
  }

  function pickSwiftSetting(button) {
    const { swiftGuide } = button.dataset;
    if (swiftGuide !== undefined) {
      swiftDraft.guide = !swiftDraft.guide;
      renderPanel('[data-swift-guide]');
      return;
    }
    for (const key of ['part','method','color','weight','zoom','light']) {
      const value = button.getAttribute(`data-swift-${key}`);
      if (value === null) continue;
      swiftDraft[key] = Number(value);
      swiftDraft.note = '';
      if (key === 'part') {
        swiftDraft.cursor = [...swiftParts[swiftDraft.part].center];
        swiftDraft.start = null;
      }
      renderPanel(`[data-swift-${key}="${value}"]`);
      return;
    }
  }

  function openSwift(mode) {
    if(!swiftDraft || swiftMode!==mode) swiftDraft=freshSwiftDraft();
    swiftMode=mode;
    if(mode==='replica') swiftDraft.zoom=2;
    view='stitch';
    renderPanel('[data-swift-board]');
  }

  function pickFurSetting(button) {
    const { furLayer, furZone, furSetting, furValue, furGuide } = button.dataset;
    if (furSetting !== undefined) {
      furDraft.values[Number(furSetting)] = Number(furValue);
      renderPanel(`[data-fur-setting="${furSetting}"][data-fur-value="${furValue}"]`);
    } else if (furGuide !== undefined) {
      furDraft.guide = !furDraft.guide;
      renderPanel('[data-fur-guide]');
    } else if (furLayer !== undefined || furZone !== undefined) {
      if (furLayer !== undefined) furDraft.layer = Number(furLayer);
      if (furZone !== undefined) furDraft.zone = Number(furZone);
      const saved = furDraft.sample[furDraft.layer * 3 + furDraft.zone];
      furDraft.values = saved ? [...saved] : [1, 1, furDraft.layer ? 0 : 1];
      renderPanel(furLayer !== undefined ? `[data-fur-layer="${furLayer}"]` : `[data-fur-zone="${furZone}"]`);
    }
  }

  function onClick(event) {
    if (view === 'day-start') return;
    const button = event.target.closest('button');
    if (event.target === canvas) {
      held.clear();
      canvas.focus({ preventScroll: true });
      const rect = canvas.getBoundingClientRect();
      const localX = camera.x+(event.clientX-rect.left)/rect.width*viewWidth;
      const localY = camera.y+(event.clientY-rect.top)/rect.height*viewHeight;
      const target = clickedPlace(localX, localY, targets);
      if (target) goToPlace(target);
      else {
        const { x, y } = gridPoint(localX, localY, position);
        if (canWalk(x, y)) move(pathTo(position, point => Math.abs(point.x-x) < .0001 && Math.abs(point.y-y) < .0001, canWalk));
      }
    }
    if (!button || button.disabled) return;
    receipt = '';
    const { walk, move: dir, action, command, topic, reply } = button.dataset;
    if (state.story.encounter) {
      let next;
      if (reply !== undefined) next = chooseDialogue(state, Number(reply));
      else if (command === 'continue-dialogue') next = advanceDialogue(state);
      else if (command === 'finish-dialogue') next = finishDialogue(state);
      if (next) commit(next, next.story.encounter ? '.ws-spoken' : '');
      return;
    }
    if (view === 'fur-sew') pickFurSetting(button);
    if (view === 'stitch') pickSwiftSetting(button);
    if (view==='comparison' && button.dataset.swiftLight!==undefined) {
      comparisonLight=Number(button.dataset.swiftLight);
      renderPanel(`[data-swift-light="${comparisonLight}"]`);
    }
    if(view==='place' && button.dataset.chapterOpen) {
      chapterGroup=button.dataset.chapterOpen;
      if(chapterGroups(state,active).some(group=>group.id===chapterGroup)) {view='chapter';renderPanel();}
    }
    if(view==='chapter' && button.dataset.chapterChoice) {
      const value=button.dataset.chapterChoice;
      const next=takeChapterOption(state,active,chapterGroup,value);
      const live=chapterGroup==='fair' && ['teach','paid'].includes(value);
      if(next && (chapterGroup==='rehearsal' || live)) {
        rehearsal={kind:live ? state.chapter.rehearsal || 'short' : value, group:chapterGroup, value, step:0, note:''};
        view='rehearsal'; renderPanel('[data-rehearsal-step="0"]');
      } else if(next) {view='place';commit(next,'[data-command="back"]');}
    }
    if(view==='rehearsal' && button.dataset.rehearsalStep!==undefined) {
      const index=Number(button.dataset.rehearsalStep);
      if(index===rehearsal.step) {
        rehearsal.note=rehearsalSteps[rehearsal.kind][index][1];
        rehearsal.step++;
      } else rehearsal.note='程渡还不知道从哪一步接。先做前面的一步，再让他跟上。';
      renderPanel(rehearsal.step===3?'[data-command="finish-rehearsal"]':`[data-rehearsal-step="${rehearsal.step}"]`);
    }
    if (view === 'fur-share' && button.dataset.furTeach) {
      furFocus = button.dataset.furTeach;
      renderPanel(`[data-fur-teach="${furFocus}"]`);
    }
    if (walk && targets[walk]) goToPlace(walk);
    if (dir) nudge(dir);
    if (topic && view === 'place') {
      const next = startDialogue(state, active, topic);
      if (next) commit(next, '.ws-spoken');
    }
    if (action && view === 'place') {
      if (action === 'stitch') openSwift('main');
      else if (action === 'fur-study') { view = 'fur-lesson'; renderPanel('[data-command="fur-study"]'); }
      else if (action === 'fur-sew') {
        furDraft ??= { sample: blankFur(), zone: 0, layer: 0, values: [1, 1, 1], guide: true };
        view = 'fur-sew'; renderPanel('[data-fur-zone="0"]');
      } else if (action === 'fur-share') { furFocus = ''; view = 'fur-share'; renderPanel('[data-fur-teach]'); }
      else {
        const next = applyAction(state, active, action);
        if (next) {
          if (action === 'fur-exhibit') { showingShared = false; view = 'fur-exhibit'; }
          commit(next);
        }
      }
    }
    switch (command) {
      case 'interact': interact(); break;
      case 'back': closePanel(); break;
      case 'archive-notes':
        if (view === 'place' && active === 'desk') {
          archiveDay = state.day;
          view = 'archive-notes';
          renderPanel('h2');
        }
        break;
      case 'archive-prev': case 'archive-next':
        if (view === 'archive-notes') {
          archiveDay = Math.min(state.day, Math.max(1, archiveDay + (command === 'archive-prev' ? -1 : 1)));
          renderPanel('h2');
        }
        break;
      case 'fur-back': view = 'place'; renderPanel(); break;
      case 'fur-reference': view = 'fur-lesson'; renderPanel(); break;
      case 'fur-placard': showingShared = false; view = 'fur-exhibit'; renderPanel(); break;
      case 'fur-toggle-display': showingShared = !showingShared; renderPanel('[data-command="fur-toggle-display"]'); break;
      case 'fur-place':
        furDraft.sample[furDraft.layer * 3 + furDraft.zone] = [...furDraft.values];
        renderPanel('[data-command="fur-place"]'); break;
      case 'fur-study': case 'fur-finish': case 'fur-save-teach': {
        const action = command === 'fur-finish' ? 'fur-sew' : command === 'fur-save-teach' ? 'fur-share' : 'fur-study';
        const next = applyAction(state, active, action, action === 'fur-sew' ? furDraft.sample : furFocus);
        if (next) {
          if (action === 'fur-sew') furDraft = undefined;
          view = 'place'; commit(next, '[data-command="back"]');
        }
        break;
      }
      case 'chapter-back': view='place'; renderPanel(); break;
      case 'finish-rehearsal': {
        if(view!=='rehearsal' || rehearsal.step<3) break;
        const next=takeChapterOption(state,active,rehearsal.group,rehearsal.value);
        if(next) {rehearsal=undefined;view='place';commit(next,'[data-command="back"]');}
        break;
      }
      case 'chapter-help-shop': { const next=helpShop(state); if(next) commit(next); break; }
      case 'swift-practice': openSwift('practice'); break;
      case 'swift-replica': openSwift('replica'); break;
      case 'swift-compare': comparisonLight=1; view='comparison'; renderPanel('[data-swift-light="1"]'); break;
      case 'swift-back': swiftDraft.start = null; view = 'place'; renderPanel(); break;
      case 'swift-undo':
        if (swiftDraft.start) swiftDraft.start = null;
        else swiftDraft.marks.pop();
        swiftDraft.note = '';
        renderPanel('[data-swift-board]'); break;
      case 'finish-stitch': {
        const next = applyAction(state, 'loom', 'stitch', swiftDraft.marks);
        if (next) { swiftDraft = undefined; view = 'place'; commit(next, '[data-command="back"]'); }
        break;
      }
      case 'finish-replica': {
        const next=saveReplica(state,swiftDraft.marks);
        if(next) {swiftDraft=undefined; comparisonLight=1; view='comparison';commit(next,'[data-swift-light="1"]');}
        break;
      }
      case 'log': case 'calendar': case 'saves': case 'help': case 'close':
        held.clear(); queue = []; destination = '';
        stopMotion();
        if (command === 'saves') { pendingSlot = undefined; saveNotice = ''; }
        view = command === 'close' && state.done ? 'summary' : command;
        renderPanel('button'); break;
      case 'save-slot': case 'load-slot': {
        const number = Number(button.dataset.slot);
        if (view === 'saves' && !pendingSlot && workshopSlots.includes(number)) useSlot(number, command);
        break;
      }
      case 'cancel-slot':
        if (pendingSlot) cancelSlot();
        break;
      case 'confirm-slot':
        if (pendingSlot) {
          const request = pendingSlot;
          pendingSlot = undefined;
          useSlot(request.number, request.operation, request);
        }
        break;
      case 'reset': view = 'reset'; renderPanel('[data-command="confirm-reset"]'); break;
      case 'confirm-close': {
        const next = closeDay(state);
        view = next.done ? 'summary' : 'intro'; commit(next);
        break;
      }
      case 'restart': case 'confirm-reset':
        replaceWorkshop(freshWorkshop(), null, true); break;
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);
  panel.addEventListener('cancel', onCancel);
  renderScene(); stats(); renderPanel();
  if (!panel.open) canvas.focus({ preventScroll: true });
  return () => {
    window.clearTimeout(openingTimer);
    swiftInput.dispose();
    cancelAnimationFrame(frame);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clearKeys);
    panel.removeEventListener('cancel', onCancel);
  };
}
