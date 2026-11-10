import { hasSwift, validSwift } from './swift.js';
import { book, boothCost, changeAffinity, chapterAdvance, exclusiveSample, lessonCost, lessonPrice, replicaCost, shiftDays, shiftPay } from './economy.js';

export const chapterDays = 14;
export const schedule = [
  ['空茶杯','青梧绣坊','陆师傅把雨燕草图压在绷架下。阿禾在窗边留了两只茶杯。'],
  ['小票上的燕子','青梧绣坊 · 沿河小店','阿禾把一张小票夹在杯盖下。周岚也想看看你绣的样片。'],
  ['河边两张桌','河畔展场','今天试展。雨燕样片、猫毛试布或一小段练习都可以摆出来。'],
  ['秦砚来谈价','沿河小店','周岚请你到店里。外地商人秦砚带了一张印出来的燕子。'],
  ['沈照宁的录音笔','旧样档案室','沈照宁带来录音笔，想听陆师傅讲旧样。先问清哪些话可以录。'],
  ['春姨认出了那个姓','档案室 · 沿河小店','下午只有一个空档。陆师傅会到档案室核旧样，周岚也约你来分拣货样。今晚要交房租。'],
  ['同一只翅膀，绣两遍','青梧绣坊','在工作台复绣近翅。把两块试布放到同一盏灯下看。'],
  ['阿禾把名字翻给你看','青梧绣坊','阿禾完成了自己的样片，想亲自向来河集的人介绍。'],
  ['三种做法摆上柜台','沿河小店 · 青梧绣坊','秦砚今天正式开价。批量单价高，但原样会留在他柜台。阿禾还等着用它教针。'],
  ['一张展签写不下','旧样档案室','沈照宁带回了长稿。到档案桌选出观众第一眼要看的东西。'],
  ['交货前翻一面','沿河小店','到了交样的日子。和秦砚当面核对货签；自展也可以去找周岚商量摆法。'],
  ['把针递给别人','青梧绣坊 · 河畔展场','排练一组针。今天可以去展场订独立摊位，春姨也留了免费的共用桌。'],
  ['河集开摊','河畔展场','最热闹的时段只能亲自顾一边。可以卖货、办体验，或陪阿禾挂作品。'],
  ['桥这边的灯','青梧绣坊 · 河畔展场','为工坊留下一样东西。收工后可以看到这十四天的结果。'],
];

const options = {
  trial:['swift','fur','scrap'],
  archive:['excerpt','private'],
  contract:['hand','split','self'],
  delivery:['full','small','paused','self'],
  label:['craft','design','origin'],
  rehearsal:['swift','fur','short'],
  fair:['teach','paid','sales','apprentice'],
  keepsake:['label','cloth','order'],
};

export const incidentNames = {
  wind:'河边起风了，程渡在帮人按住纸。', customer:'周岚店里来了一位爱翻看背面的熟客。',
  wing:'阿禾今天随身带着没绣完的一角。', photo:'春姨从旧账里找出一张照片。',
  boat:'体验桌旁来了一位等船的人。', encounter:'春姨摊前有人在聊起绣样的标签。',
  spool:'陆师傅在绣案边找一卷旧线。',
};

export function loadChapter(raw) {
  const chapter = {
    seed:Number.isInteger(raw?.seed) ? raw.seed >>> 0 : Math.floor(Math.random()*2**32),
    helped:Number.isInteger(raw?.helped) ? Math.min(chapterDays,Math.max(0,raw.helped)) : 0,
    replica:validSwift(raw?.replica) && raw.replica.every(mark=>mark.part===0) ? raw.replica : [],
    incidents:{},
  };
  for (const [key,values] of Object.entries(options)) chapter[key] = values.includes(raw?.[key]) ? raw[key] : '';
  for (let day=4;day<=13;day++) {
    const id=raw?.incidents?.[day];
    if (typeof id==='string' && Object.hasOwn(incidentNames,id)) chapter.incidents[day]=id;
  }
  return chapter;
}

export function chapterGroups(s, place) {
  const {day,chapter:c,economy:e}=s;
  const groups=[];
  if (place==='exhibit' && day===3 && !c.trial) groups.push({
    id:'trial', title:'两张试展桌', text:'挑一件放在桌面正中。没绣完的练习布也可以给人看。', choices:[
      ['swift','摆出雨燕和草图','让人先看一只燕子是怎样绣出来的。',0,hasSwift(s)?'':'手边还没有雨燕样片。'],
      ['fur','摆出两块猫毛试布','把等长同向的对照布放在旁边。',0,s.fur.sample?'':'手边还没有猫毛试布。'],
      ['scrap','摆一块起针练习布','请观众看看同一块布怎样落下第一组针。',0],
    ],
  });
  if (place==='desk' && day>=10 && day<=13 && !c.label) groups.push({
    id:'label',title:'写一张短展签',text:'沈照宁把长稿留在桌边。想想观众走过来，第一眼会愿意看哪件东西。',choices:[
      ['craft','先让观众对照针脚','「把两块试布转到同一束光下，看看针路往哪里走。」',1],
      ['design','先让观众看草图与成品','「从纸上的两道线，到布面上能转弯的翅膀。」',1],
      ['origin','先说旧样从哪里来','「能确认的写清楚，没查实的先留空。」',1],
    ],
  });
  if (place==='apprentice' && day>=12 && day<=13 && !c.rehearsal) groups.push({
    id:'rehearsal',title:'让阿禾带一回起针',text:'阿禾把针递给来试坐的程渡。你可以挑一小段给她排练。',choices:[
      ['swift','拿雨燕示范接一组翅羽','先找翅根，再沿长向接上第二组。',1,exclusiveSample(s)?'原样留在秦砚柜台，可以换一段练习。':hasSwift(s)?'':'需要一块雨燕样片。'],
      ['fur','用猫毛两层试布示范','先让程渡说出两块布的区别，再做几针。',1,s.fur.sample?'':'需要一组猫毛对照试布。'],
      ['short','先教一段短针路','把起针点留给他自己选，完成一针就能带走练习。',1],
    ],
  });
  if (place==='exhibit' && day===12 && !e.booth) groups.push({
    id:'booth',title:'订河集的摊位',text:'独立摊位可以让阿禾在一边带人，你去顾另一边。春姨的共用桌免费，热闹的时段只摆得下一种活动。',choices:[
      ['own',`订独立摊位 · ${boothCost} 元`,'摊主把两张桌子挪到一起。',0,s.cash<boothCost?'摊位费还没凑够。':''],
      ['shared','去春姨的共用桌','春姨在茶摊旁留了一张桌。',0],
    ],
  });
  if (place==='exhibit' && day===13 && !c.fair) groups.push({
    id:'fair',title:'河集开摊',text:'体验桌有人等，柜台前也有人停下。最热闹的时段只有这一轮，你先走向哪一边？',choices:[
      ['teach',`带一场免费体验 · 耗材 ${lessonCost} 元`,'访客绣完，把那块布带回家。',2,s.cash<lessonCost?'要先凑齐练习布的钱。':''],
      ['paid',`开一场收费体验 · 收 ${lessonPrice} 元、耗材 ${lessonCost} 元`,'体验费收好后，再把针递给访客。',2,s.cash<lessonCost?'要先凑齐练习布的钱。':''],
      ['sales',exclusiveSample(s)?'去秦砚柜台讲样 · 收 22 元分成':'到柜台卖样片 · 收 26 元、包装 4 元',
        exclusiveSample(s)?'客人听完货签上的区别，买了几件新样。':'客人带走了署着作者名字的小件。',2,
        !hasSwift(s)?'柜台要有做完的雨燕样片。':!exclusiveSample(s)&&s.cash<4?'包装还缺 4 元。':''],
      ['apprentice','陪阿禾挂她的作品','阿禾给第一位访客讲了她自己画的翅膀。',2,s.story.completed.includes('apprentice:signed')?'':'先去看阿禾的署名，问问她想怎么展。'],
    ],
  });
  if (place==='exhibit' && day===13 && e.booth==='own' && ['sales','apprentice'].includes(c.fair) && !e.lesson) groups.push({
    id:'delegate',title:'把体验桌交给阿禾',text:'另一张桌还空着。阿禾自己定示范的针路，也用自己的名字招呼来的人。',choices:[
      ['delegate',`让阿禾独立带人 · 耗材 ${lessonCost} 元`,'阿禾自己带完一场，程渡拿着练习布来找你。',1,
        !c.rehearsal || !s.story.completed.includes('apprentice:signed')?'阿禾还需要完成排练，并准备好自己的署名。':
        exclusiveSample(s) && !e.consult?'先和阿禾商量，换一种能教的针路。':s.cash<lessonCost?'要先凑齐练习布的钱。':''],
    ],
  });
  if (place==='master' && day===14 && !c.keepsake) groups.push({
    id:'keepsake',title:'留在窗边的一样东西',text:'陆师傅问你，明天来开门的人，第一眼该在窗边看见什么。',choices:[
      ['label','留一张展签','提醒后来的人，这块布和谁有关。',0],
      ['cloth','留一块还没绣完的体验布','下一双手还可以接着落针。',0],
      ['order','留一张接下来要做的订单','把答应过的事记在显眼的地方。',0],
    ],
  });
  return groups;
}

function record(s, patch, text, hours=0, cash=0) {
  return {...s,hours:s.hours-hours,cash:s.cash+cash,chapter:{...s.chapter,...patch},
    log:[`第 ${s.day} 天 · ${text}`,...s.log]};
}

function noteEconomy(s, patch, text, hours=0) {
  return { ...record(s,{},text,hours), economy:{...s.economy,...patch} };
}

function missSource(s) {
  return changeAffinity(noteEconomy(s,{source:'missed'},'核旧样的时段已经过了。沈照宁把未确认的地方留空。'),'scholar',-1);
}

export function takeChapterOption(s,place,group,value) {
  if(s.done || s.story.encounter) return null;
  const action=chapterGroups(s,place).find(item=>item.id===group)?.choices.find(([id])=>id===value);
  if(!action || action[4] || s.hours<action[3]) return null;
  const stored = group==='booth' || group==='delegate' ? {} : {[group]:value};
  let next = record(s,stored,action[2],action[3]);
  if (group==='booth') {
    next=book(next,{overhead:value==='own'?boothCost:0});
    next.economy.booth=value;
  }
  if (group==='fair' && value==='sales') {
    const exclusive=exclusiveSample(s);
    next=book(next,{revenue:exclusive?22:26,materials:exclusive?0:4});
    next=changeAffinity(next,exclusive?'merchant':'shop',1);
    if (s.story.completed.includes('apprentice:signed') && !s.chapter.rehearsal && !s.economy.consult) next=changeAffinity(next,'apprentice',-1);
  }
  if ((group==='fair' && ['teach','paid'].includes(value)) || group==='delegate') {
    next=book(next,{revenue:value==='paid'?lessonPrice:0,materials:lessonCost});
    next.economy.lesson={teach:'free',paid:'paid',delegate:'delegated'}[value];
    next=changeAffinity(next,'apprentice',1);
  }
  if (group==='fair' && value==='apprentice') next=changeAffinity(next,'apprentice',1);
  return next;
}

export function chapterDecisionReason(s,group,value) {
  if (group==='source' && value==='verified') {
    if (s.chapter.helped===6) return '这个时段已经答应了周岚。';
    if (s.hours<2) return '核旧样需要留两个小时。';
  }
  if (group==='consult' && s.hours<1) return '要留一个小时和阿禾把方案讲清。';
  if (group==='delivery' && ['full','small'].includes(value)) {
    if (!hasSwift(s)) return '手边还没有雨燕样片。';
    const needsReplica=s.economy.legacyContract ? s.chapter.contract==='hand' : s.chapter.contract==='split';
    if (value==='full' && needsReplica && s.chapter.replica.length<2) return '这份约定需要一件近翅复样。';
    if (value==='full' && !s.economy.legacyContract && s.chapter.contract==='split' && s.hours<1) return '还要留一个小时核签。';
  }
  return '';
}

export function acceptChapterDecision(s,group,value) {
  if(s.done || chapterDecisionReason(s,group,value)) return null;
  const {chapter:c,economy:e}=s;
  if(group==='source' && s.day===6 && !e.source && ['verified','notified'].includes(value)) {
    const verified=value==='verified';
    const next=noteEconomy(s,{source:value},verified?'赴约核对旧样，查清可使用的范围。':'提前告诉沈照宁会缺席，拿到一份现有资料。',verified?2:0);
    return verified?changeAffinity(next,'master',1):next;
  }
  if(group==='consult' && value==='talk' && s.day>=8 && s.day<=13 && !e.consult && (!c.contract || c.contract==='hand'&&!e.legacyContract)) {
    return noteEconomy(s,{consult:c.contract?'after':'before'},'和阿禾一起改体验安排，留出她自己带人的位置。',1);
  }
  if(group==='next' && s.day===14 && !e.next && (value==='tea' && ['free','delegated'].includes(e.lesson) || value==='shop' && ['sales','apprentice'].includes(c.fair))) {
    return noteEconomy(s,{next:value},value==='tea'?'春姨答应每周留一张试针桌。':'周岚同意按作者署名留下寄售位置。');
  }
  if(!options[group]?.includes(value) || c[group]) return null;
  if(group==='archive' && s.day>=5 && s.day<=9) return record(s,{archive:value},value==='excerpt'?'旧样只公开获准的局部，署名待核。':'旧样留在工坊，展览使用练习布。');
  if(group==='contract') {
    if(s.day<9 || s.day>10) return null;
    const advance=chapterAdvance(value);
    const next=record(s,{contract:value},advance?`与秦砚约定第十一天核样，收定金 ${advance} 元。`:'这次把样片留给工坊自展。',0,advance);
    return value==='hand'&&!e.consult?changeAffinity(next,'apprentice',-1):next;
  }
  if(group==='delivery') {
    if(value==='self' ? c.contract!=='self' || s.day<11 || s.day>12 : !['hand','split'].includes(c.contract) || s.day!==11) return null;
    const advance=chapterAdvance(c.contract);
    const premium=value==='full' && e.legacyContract && c.contract==='hand' && s.story.completed.includes('merchant:sideBySide') ? 6 : 0;
    const cash=value==='paused'?-advance:value==='full'?(c.contract==='hand'?46:29)+premium:value==='small'?15:0;
    const text={full:premium?'货签核对完成。秦砚认可两块对照样，尾款加付 6 元。':'货签核对完成，秦砚照约付清尾款。',small:'双方缩小了交付范围，先交一件确认过的样。',paused:'暂停交付，退回定金。',self:'周岚帮工坊给自展的样片留出位置。'};
    const hours=value==='full' && c.contract==='split' && !e.legacyContract ? 1 : 0;
    const next=book(record(s,{delivery:value},text[value],hours),{cash,revenue:['full','small'].includes(value)?cash+advance:0});
    return value==='paused'?changeAffinity(next,'merchant',-1):next;
  }
  return null;
}

export const rehearsalSteps = {
  swift:[
    ['先找翅羽的走向','阿禾顺着羽缘比了一下，找到了翅根。'],
    ['在翅根选起针点','程渡捏住线头，在布角落下第一针。'],
    ['请他续一组短针','阿禾把手收回来。程渡沿着第一组针接了两针。'],
  ],
  fur:[
    ['请他看两块试布','程渡认出了同向对照布和分层的猫毛。'],
    ['先示范一组底针','阿禾沿毛势落针，请他看清这一层的方向。'],
    ['请他在上层留出空隙','程渡落了几根稀一点的短针，底下的丝线还看得见。'],
  ],
  short:[
    ['让他自己选一个起针点','程渡指了指离布边还有一点距离的地方。'],
    ['把两点之间的针脚做一遍','阿禾做得很慢，他看清了针是怎样穿回布面的。'],
    ['把针递给他','程渡沿着刚才那针走了一小段，抬起头说，他也会了。'],
  ],
};

export function saveReplica(s, marks) {
  if(s.done || s.story.encounter || s.day<7 || s.hours<1 || s.cash<replicaCost || (exclusiveSample(s) && s.day<=13) || !hasSwift(s) || s.chapter.replica.length ||
    !validSwift(marks) || marks.length<2 || marks.some(mark=>mark.part!==0)) return null;
  return book(record(s,{replica:marks},`用 ${replicaCost} 元丝线复绣近翅，可以和原样并排照光。`,1),{materials:replicaCost});
}

export const shopShift = s => !s.done && shiftDays.includes(s.day) && s.chapter.helped!==s.day;
export const shopShiftReason = s => s.day===6 && s.economy.source==='verified' ? '这个时段已经用来核对旧样。' : s.hours<2 ? '今天来不及了。' : '';

export function helpShop(s) {
  if(!shopShift(s) || s.story.encounter || shopShiftReason(s)) return null;
  const next=changeAffinity(book(record(s,{helped:s.day},`帮周岚分拣丝线与样品，收 ${shiftPay} 元工钱。`,2),{wages:shiftPay}),'shop',1);
  return s.day===6 && !s.economy.source && s.chapter.archive ? missSource(next) : next;
}

function draw(seed,day,salt) {
  let n=(seed^Math.imul(day+salt,0x9e3779b1))>>>0;
  n=Math.imul(n^(n>>>16),0x21f0aaad)>>>0;
  return ((n^(n>>>15))>>>0)/2**32;
}

export function rollIncident(s) {
  const {day,chapter:c}=s, seen=Object.values(c.incidents);
  if(day<4 || day>13 || c.incidents[day] || seen.length>=5) return s;
  if(seen.length>=Math.floor((day-2)/2) || draw(c.seed,day,1)>.76 && day<10) return s;
  const pool=['spool'];
  if(day>=5) pool.push('wind');
  if(hasSwift(s)) pool.push('customer');
  if(s.story.memories.includes('ownDesign')) pool.push('wing');
  if(day>=6 && s.story.completed.includes('teaSeller:paper')) pool.push('photo');
  if(day>=8) pool.push('encounter');
  if(day===13) pool.push('boat');
  const candidates=pool.filter(id=>!seen.includes(id));
  if(!candidates.length) return s;
  const id=candidates[Math.floor(draw(c.seed,day,2)*candidates.length)];
  return {...s,chapter:{...c,incidents:{...c.incidents,[day]:id}}};
}

export function settleChapterDay(s) {
  let next=s;
  const c=s.chapter;
  if(s.day===6 && !s.economy.source && c.archive) next=missSource(next);
  if(s.day===10 && !c.contract) next=record(next,{contract:'self'},'秦砚的询价期到了，样片留作自展。');
  if(s.day===11 && !c.delivery && c.contract && c.contract!=='self') next=acceptChapterDecision(next,'delivery','paused');
  if(s.day===12 && !s.economy.booth) next=noteEconomy(next,{booth:'shared'},'春姨为工坊留了免费的共用桌。');
  return next;
}

export function chapterEndings(s) {
  const c=s.chapter, results=[];
  if(c.delivery==='full' || c.delivery==='small') results.push({title:'把货签翻过来',text:'周岚把余款和货签夹到账本里。秦砚把确认过的标签留下一张，说下次开价，就拿这张作准。'});
  if(s.economy.lesson) results.push({title:'有人接过了针',text:'体验布上留下几组新针迹。阿禾让你先别拆，等那位访客下次过来，再从这里接上。'});
  else if(c.rehearsal) results.push({title:'收回绷架的一小段',text:'阿禾把排练时绣的一段针留在绷架上，问下次还能不能用这一段来教。'});
  if(exclusiveSample(s) && !s.economy.consult) results.push({title:'阿禾收好了自己的燕子',text:'秦砚带走这次合作的样。阿禾把自己的图收回布包，说下次想自己选在哪里展，也想先把这事跟你说清楚。'});
  if((c.archive || s.recorded) && s.story.completed.includes('scholar:copy')) results.push({title:'把副本留在工坊',text:'沈照宁送回整理稿。已经核实的写了下来，没查实的名字仍留着空白。'});
  else if(c.label || c.archive) results.push({title:'待补的那几行',text:'陆师傅把手头的线索夹在草稿背后，等下次核完再补。'});
  if(c.fair==='apprentice') results.push({title:'这只燕子有名字',text:'阿禾把自己的燕子从摊上取下来，又把署名朝外翻了一次。她说下回还想带新的来。'});
  if(c.keepsake) results.push({title:'窗边留了条缝',text:{label:'你把展签放在窗边。陆师傅把写不下的那行折到背面，留给后来的人。',cloth:'你把还没绣完的布放在窗边。明天谁先来，就从最后一个针眼接下去。',order:'你把约好的事放在窗边，旁边留了一支铅笔，方便明天来的人继续记。'}[c.keepsake]});
  if(!results.length) results.push({title:'还有十六天',text:'散集后，陆师傅把空绷子搬回窗边。她问你，明天想先把哪件事接着做。'});
  return results;
}
