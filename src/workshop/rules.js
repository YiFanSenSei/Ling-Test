import { loadStory } from './dialogue.js';
import { loadFur, validFur } from './fur.js';
import { hasSwift, legacyPattern, palette, readySwift, validSwift } from './swift.js';
import { chapterDays, loadChapter, rollIncident, settleChapterDay } from './chapter.js';
import { book, loadEconomy, settleOperatingDay } from './economy.js';

export const places = {
  master: { scene: 'studio', x: 5, y: 6.5, npc: true, name: '陆师傅', sign: '陆师傅' },
  apprentice: { scene: 'studio', x: 26.5, y: 10, npc: true, name: '学徒阿禾', sign: '阿禾' },
  loom: { scene: 'studio', x: 15.5, y: 8, object: 'loom', name: '刺绣工作台', sign: '试绣' },
  desk: { scene: 'archive', x: 16.5, y: 8, object: 'desk', name: '档案桌', sign: '档案桌' },
  shop: { scene: 'shop', x: 16.5, y: 6.5, npc: true, object: 'counter', name: '店主周岚', sign: '周岚' },
  exhibit: { scene: 'river', x: 16.5, y: 8.5, object: 'exhibit', name: '河畔展台', sign: '展台' },
  teaSeller: { scene: 'lane', x: 12.5, y: 8.5, npc: true, name: '茶摊春姨', sign: '春姨' },
  visitor: { scene: 'river', x: 25, y: 13, npc: true, name: '程渡', sign: '程渡' },
  merchant: { scene:'shop', x:25,y:10,npc:true,name:'商人秦砚',sign:'秦砚',first:4 },
  scholar: { scene:'archive', x:24,y:10,npc:true,name:'沈照宁',sign:'沈照宁',first:5 },
};

export function placeFor(id, day) {
  const place=places[id];
  if(day>=13 && id==='merchant') return {...place,scene:'river',x:25,y:14.5};
  if(day>=13 && id==='scholar') return {...place,scene:'river',x:6,y:9.5};
  return place;
}

export function freshWorkshop() {
  return { day: 1, hours: 6, cash: 36, stitches: [], swift: [], taught: false, recorded: false,
    order: '', sold: false, display: '', done: false, story: loadStory(), fur: loadFur(), chapter:loadChapter(), economy:loadEconomy(), log: ['开局 · 手头有 36 元和六小时。'] };
}

export function loadWorkshop(raw) {
  try {
    const s = JSON.parse(raw);
    const swift = validSwift(s?.swift) && readySwift(s.swift) ? s.swift : [];
    if (!s || !Number.isInteger(s.day) || s.day < 1 || s.day > chapterDays ||
        !Number.isInteger(s.hours) || s.hours < 0 || s.hours > 6 ||
        !Number.isInteger(s.cash) || !Array.isArray(s.stitches) ||
        ![0, legacyPattern.length].includes(s.stitches.length) ||
        !s.stitches.every(n => Number.isInteger(n) && n >= 0 && n < palette.length) ||
        !['', 'today', 'tomorrow', 'missed'].includes(s.order) ||
        !['', 'archive', 'open'].includes(s.display) ||
        (s.display && !s.stitches.length && !swift.length) ||
        !['taught', 'recorded', 'sold', 'done'].every(key => typeof s[key] === 'boolean') ||
        !Array.isArray(s.log) || !s.log.every(line => typeof line === 'string')) return null;
    const next = { ...s, swift, story: loadStory(s.story), fur: loadFur(s.fur), chapter:loadChapter(s.chapter) };
    next.economy = loadEconomy(s.economy, next);
    if (!s.chapter && s.day===3 && s.done) return rollIncident({...next,day:4,hours:6,done:false});
    return next;
  } catch { return null; }
}

export function workshopActions(s, place) {
  if (s.done) return [];
  switch (place) {
    case 'master': return s.fur.studied ? [] : [{ key: 'fur-study', label: '跟陆师傅看白猫绣片', hours: 0 }];
    case 'apprentice': return [
      ...(!s.taught && s.day<=2 ? [{ key: 'teach', label: '带阿禾从起针练起', hours: 3 }] : []),
      ...(s.fur.sample && !s.fur.shared ? [{ key: 'fur-share', label: '和阿禾对照猫毛试布', hours: 1 }] : []),
    ];
    case 'loom': return [
      ...(!hasSwift(s) ? [{ key: 'stitch', label: '绣一只雨燕 · 12 元', hours: 3, cost: 12 }] : []),
      ...(s.fur.studied && !s.fur.sample ? [{ key: 'fur-sew', label: '试绣一撮白猫毛', hours: 1 }] : []),
    ];
    case 'desk': return s.recorded ? [] : [
      { key: 'record', label: '整理口述与展签', hours: 2 },
    ];
    case 'shop': {
      if (s.sold || s.order === 'missed') return [];
      if (s.order === 'tomorrow') return [
        { key: 'deliver', label: '交付预约订单 · 收 44 元', hours: 2,
          reason: s.day !== 2 ? '预约交货时间是第二天。' : !hasSwift(s) ? '需要先完成新图样。' : '' },
      ];
      if (s.day !== 1) return [];
      return [
        { key: 'express', label: '完成当天急单 · 收 64 元', hours: 2,
          reason: hasSwift(s) ? '' : '先到工作台完成新图样，旧底稿只供展览。' },
        { key: 'reserve', label: '商定明天交货 · 收 10 元定金', hours: 0 },
      ];
    }
    case 'exhibit': {
      const reason = s.day !== 3 ? '第三天布展。' : !hasSwift(s) ? '先做一块试绣样片。' : '';
      return [
        ...(!s.display ? [{ key: 'archive', label: '做一场图样档案展 · 8 元', hours: 2, cost: 8,
          reason: reason || (!s.recorded ? '档案桌有待确认的出处和公开范围。' : '') },
        { key: 'open', label: '开放体验桌 · 8 元', hours: 2, cost: 8, reason }] : []),
        ...(s.fur.sample && !s.fur.shown ? [{ key: 'fur-exhibit', label: '摆出猫毛试布和作品资料', hours: 1,
          reason: s.day !== 3 ? '第三天布展。' : '' }] : []),
      ];
    }
    default: return [];
  }
}

export function unavailable(s, action) {
  return action.reason || (s.hours < action.hours ? '今天来不及了。' : '') ||
    (action.cost && s.cash < action.cost ? '材料预算不足。' : '');
}

export function applyAction(s, place, key, payload = []) {
  if (s.story.encounter) return null;
  const action = workshopActions(s, place).find(item => item.key === key);
  if (!action || unavailable(s, action)) return null;
  if (key === 'stitch' && (!validSwift(payload) || !readySwift(payload))) return null;
  if (key === 'fur-sew' && !validFur(payload)) return null;
  if (key === 'fur-share' && !['flow', 'layer'].includes(payload)) return null;
  let next = { ...s, hours: s.hours - action.hours, log: [...s.log] };
  if (action.cost) next = book(next, key === 'stitch' ? { materials: action.cost } : { overhead: action.cost });
  let entry;
  switch (key) {
    case 'teach': next.taught = true; entry = '阿禾完成了一次跟练，展览时可以独立示范起针。'; break;
    case 'stitch': next.swift = payload.map(({part,method,color,weight,a,b}) => ({ part,method,color,weight,a:[...a],b:[...b] })); entry = '你绣完了雨燕，针迹留在样片上，可以给周岚看，也可以带去展台。'; break;
    case 'record': next.recorded = true; entry = '陆师傅确认了展签和局部展示，完整旧图样留在工坊。'; break;
    case 'reserve': next.order = 'tomorrow'; next.cash += 10; entry = '周岚付了 10 元定金，约定第二天交货。'; break;
    case 'express': next.order = 'today'; next.sold = true; next = book(next, { revenue: 64 }); entry = '今天交出新样订单，到账 64 元。'; break;
    case 'deliver': next.sold = true; next = book(next, { revenue: 54, cash: 44 }); entry = '预约订单交付，收到 44 元尾款。'; break;
    case 'archive': next.display = 'archive'; entry = '你把确认过的出处与作者写上展签，试绣样片也上了展台。'; break;
    case 'open': next.display = 'open'; entry = next.taught ? '阿禾在院子教第一位访客起针。' : '你亲自在院子带访客试绣。'; break;
    case 'fur-study': next.fur = { ...s.fur, studied: true }; entry = '陆师傅用《白猫戏螳螂》的展览资料讲了猫毛的层次。'; break;
    case 'fur-sew': next.fur = { ...s.fur, sample: payload.map(group => [...group]) }; entry = '完成了一组猫毛对照试布。'; break;
    case 'fur-share': next.fur = { ...s.fur, shared: payload }; entry = '阿禾照着你的试布，练习了' + (payload === 'flow' ? '顺毛势落针。' : '在上层留出空隙。'); break;
    case 'fur-exhibit': next.fur = { ...s.fur, shown: true }; entry = '把猫毛对照试布和《白猫戏螳螂》的资料摆上了河畔展台。'; break;
  }
  next.log.unshift(`第 ${s.day} 天 · ${entry}`);
  return next;
}

export function closeDay(s) {
  if (s.done || s.story.encounter) return s;
  const next = settleOperatingDay(settleChapterDay(s));
  if (s.day === 2 && s.order === 'tomorrow' && !s.sold) {
    next.order = 'missed';
    next.cash -= 10;
    next.log.unshift('预约未能交付，退回 10 元定金。');
  }
  if (s.day === chapterDays) next.done = true;
  else { next.day += 1; next.hours = 6; }
  return rollIncident(next);
}
