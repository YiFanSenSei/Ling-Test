export const dailyCost = 3;
export const rentCost = 22;
export const lateFee = 3;
export const boothCost = 12;
export const replicaCost = 6;
export const lessonCost = 3;
export const lessonPrice = 12;
export const shiftDays = [4, 6, 10];
export const shiftPay = 8;

export function loadEconomy(raw, s) {
  if (!raw && s) {
    const logs = s.log;
    const oldIncome = { today: 64, tomorrow: 54 };
    const advance = chapterAdvance(s.chapter.contract);
    const delivery = s.chapter.delivery;
    return {
      revenue: (s.sold ? oldIncome[s.order] || 0 : 0) + (delivery === 'full' ? advance + (s.chapter.contract === 'hand' ? 46 : 29) + (logs.some(line => line.includes('尾款加付 6 元')) ? 6 : 0) : delivery === 'small' ? advance + 15 : 0),
      materials: (s.stitches.length || s.swift.length ? 12 : 0),
      overhead: logs.reduce((total, line) => total + Number(line.match(/支付工坊开支 (\d+) 元/)?.[1] || 0), s.display ? 8 : 0),
      wages: logs.filter(line => line.includes('帮周岚分拣丝线与样品')).length * 10,
      rent: s.day > 6 || s.done ? 'legacy' : '',
      legacyContract: ['hand', 'split'].includes(s.chapter.contract),
      source: '', consult: '', booth: '', lesson: s.chapter.fair === 'teach' ? 'free' : '', next: '',
    };
  }
  const money = key => Number.isSafeInteger(raw?.[key]) && raw[key] >= 0 ? raw[key] : 0;
  const choice = (key, values) => values.includes(raw?.[key]) ? raw[key] : '';
  return {
    revenue: money('revenue'), materials: money('materials'), overhead: money('overhead'), wages: money('wages'),
    rent: choice('rent', ['paid', 'deferred', 'overdue', 'legacy']),
    legacyContract: raw?.legacyContract === true,
    source: choice('source', ['verified', 'notified', 'missed']),
    consult: choice('consult', ['before', 'after']),
    booth: choice('booth', ['own', 'shared']),
    lesson: choice('lesson', ['paid', 'free', 'delegated']),
    next: choice('next', ['tea', 'shop']),
  };
}

export const chapterAdvance = contract => ({ hand: 12, split: 8 }[contract] || 0);
export const pendingDeposits = s => (s.order === 'tomorrow' && !s.sold ? 10 : 0) + (!s.chapter.delivery ? chapterAdvance(s.chapter.contract) : 0);
export const exclusiveSample = s => !s.economy.legacyContract && s.chapter.contract === 'hand' && s.chapter.delivery === 'full';
export const rentOwed = s => ['deferred', 'overdue'].includes(s.economy.rent) ? rentCost + lateFee : 0;

export function book(s, { revenue = 0, materials = 0, overhead = 0, wages = 0, cash = revenue + wages - materials - overhead }) {
  const e = s.economy;
  return { ...s, cash: s.cash + cash, economy: { ...e, revenue: e.revenue + revenue, materials: e.materials + materials, overhead: e.overhead + overhead, wages: e.wages + wages } };
}

export function changeAffinity(s, person, amount) {
  const before = s.story.affinity[person] || 0;
  const points = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, before + amount));
  if (points === before) return s;
  const affinity = { ...s.story.affinity };
  if (points) affinity[person] = points;
  else delete affinity[person];
  return { ...s, story: { ...s.story, affinity } };
}

export function settleOperatingDay(s) {
  let next = book(s, { overhead: dailyCost });
  next.log = [`第 ${s.day} 天 · 支付工坊开支 ${dailyCost} 元。`, ...s.log];
  function rent(status, text, overhead = 0, cash = -overhead) {
    next = book(next, { overhead, cash });
    next.economy.rent = status;
    next.log.unshift(text);
  }
  const available = next.cash - pendingDeposits(next);
  if (s.day === 6 && !s.economy.rent) {
    if (available >= rentCost) rent('paid', `交付本期房租 ${rentCost} 元。`, rentCost);
    else rent('deferred', `房租延期到第十一天，应付 ${rentCost + lateFee} 元（含 ${lateFee} 元延期费）。`, rentCost + lateFee, 0);
  } else if (s.day >= 11 && rentOwed(s)) {
    if (available >= rentOwed(s)) rent('paid', `补交房租和延期费，共 ${rentOwed(s)} 元。`, 0, -rentOwed(s));
    else if (s.economy.rent === 'deferred') rent('overdue', '房租仍有欠款。房东把欠条夹进账本，河集散场前还可以补交。');
  }
  return next;
}

export function economyResult(s) {
  const { economy: e, chapter: c } = s;
  const finished = id => s.story.completed.includes(id);
  const communityUse = ['sales', 'apprentice'].includes(c.fair) ? '街坊看到有署名的作品，有人问散场后还能去哪里看。'
    : e.lesson && (finished('teaSeller:chair') || e.next === 'tea') ? '茶摊的街坊把体验布带回家，回头又来问针路。' : '';
  const impact = [
    ['传习', [
      c.rehearsal && '阿禾完成排练，能独立示范一组针。',
      e.lesson && '河集访客跟着体验桌落了针，带走自己的练习布。',
    ].filter(Boolean)],
    ['留档', [
      (s.recorded || e.source === 'verified') && '陆师傅确认了能核实的出处和可使用的范围。',
      (c.archive || s.recorded) && finished('scholar:copy') && '沈照宁把可复用的记录副本交回工坊。',
    ].filter(Boolean)],
    ['社区使用', [
      communityUse,
      e.next === 'tea' ? '春姨约定每周留一张桌继续试针。' : e.next === 'shop' ? '周岚留出一格柜台，按作者署名继续寄售。' : '',
    ].filter(Boolean)],
  ];
  return { profit: e.revenue - e.materials - e.overhead, impact, reach: impact.reduce((total, [, outcomes]) => total + outcomes.length, 0) };
}

export function economyEnding(s) {
  const { profit, reach } = economyResult(s);
  const continuation = s.economy.next === 'tea' ? '春姨在茶账背面写好下次开桌的时间。'
    : s.economy.next === 'shop' ? '周岚把作者的名字贴在腾出来的那格柜台上。'
    : s.economy.lesson ? '有人卷好自己的练习布，问下次能从哪一针接着绣。'
    : '工坊把已经核实的那几页资料留下，等下次有人查用。';
  if (profit >= 10 && reach >= 4) return { title: '有钱备线，也有人回来', text: '新一批线的钱已经算出来。'+continuation };
  if (profit >= 10) return { title: '订单夹在账本里', text: '账上够做下一单。清点样片时，陆师傅指着几件只剩货签的作品，问你下次有没有时间把做法讲给坐在身边的人。' };
  if (reach >= 4) return { title: '还有人等下一次', text: continuation+'你回到窗边，又算了一遍下一批布和线要花的钱。' };
  return { title: '留一页给下次', text: '收完最后一只绷子，你把这次留下的样片和手记包起来。还剩十六天，你先在账本上写下明早要去找的人。' };
}
