import assert from 'node:assert/strict';
import { acceptChapterDecision, chapterDays, chapterEndings, chapterGroups, helpShop, schedule, saveReplica, takeChapterOption } from '../src/workshop/chapter.js';
import { advanceDialogue, chooseDialogue, currentDialogue, dialogueTopics, finishDialogue, startDialogue } from '../src/workshop/dialogue.js';
import { entryPoint, pathTo, scenePlaces, beside, walkable } from '../src/workshop/map.js';
import { applyAction, closeDay, freshWorkshop, loadWorkshop } from '../src/workshop/rules.js';
import { freshSwiftDraft, planSwiftStitch, swiftParts } from '../src/workshop/swift.js';
import { economyEnding, economyResult, exclusiveSample, pendingDeposits, rentOwed } from '../src/workshop/economy.js';

const draft=freshSwiftDraft();
for(const [part,{guide:[a,b]}] of swiftParts.entries()) {
  draft.part=part;
  for(const t of [.65,.9]) draft.marks.push(planSwiftStitch(draft,a,a.map((n,i)=>n+(b[i]-n)*t)).mark);
}

const stepTo=(s,day)=>{
  while(s.day<day) {
    const next=closeDay(s);
    assert.equal(next.day,s.day+1);
    assert.equal(next.hours,6);
    s=next;
  }
  return s;
};
const play=(s,person,id,index)=>{
  s=startDialogue(s,person,id);
  assert.ok(s,person+':'+id);
  while(currentDialogue(s).continuing) s=advanceDialogue(s);
  if(currentDialogue(s).choices.length) {
    s=chooseDialogue(s,index??0);
    assert.ok(s,person+':'+id+' response');
    assert.equal(currentDialogue(s).spoken.speaker,'player');
    const loaded=loadWorkshop(JSON.stringify(s));
    assert.deepEqual(currentDialogue(loaded),currentDialogue(s));
    assert.deepEqual(loaded.chapter,s.chapter);
    while(currentDialogue(s).continuing) s=advanceDialogue(s);
  }
  s=finishDialogue(s);
  assert.ok(s);
  assert.equal(startDialogue(s,person,id),null);
  return s;
};

assert.equal(schedule.length,chapterDays);
let s=freshWorkshop();
s.chapter.seed=143;
s=play(s,'master','crooked',0);
s=play(s,'teaSeller','kettle',0);
s=play(s,'apprentice','tea',0);
s=play(s,'visitor','notebook',0);
s=play(s,'shop','apron',1);
s=applyAction(s,'loom','stitch',draft.marks);
s=stepTo(s,2);
s=play(s,'apprentice','sketch',1);
s=stepTo(s,3);
s=takeChapterOption(s,'exhibit','trial','swift');
assert.ok(s && !s.done);
assert.equal(scenePlaces('shop',3).merchant,undefined);
s=stepTo(s,4);
assert.ok(scenePlaces('shop',4).merchant);
assert.equal(scenePlaces('archive',4).scholar,undefined);
s=play(s,'merchant','arrive');
s=play(s,'shop','readBack');
s=helpShop(s);
assert.equal(s.economy.wages,8);
assert.equal(s.economy.revenue,0);
assert.equal(helpShop(s),null);
s=stepTo(s,5);
assert.ok(scenePlaces('archive',5).scholar);
s=play(s,'scholar','recorder');
assert.equal(s.chapter.archive,'excerpt');
s=play(s,'master','reviewWing');
s=stepTo(s,6);
const beforeHearing=s;
s=play(s,'scholar','verifySource');
assert.equal(s.economy.source,'verified');
assert.equal(helpShop(s),null);
s=play(s,'teaSeller','paper');
s=play(s,'visitor','slowHand');
s=play(s,'shop','patternShelf');
s=stepTo(s,7);
assert.equal(rentOwed(s),25);
s=saveReplica(s,draft.marks.slice(0,2));
assert.equal(s.economy.materials,18);
s=play(s,'merchant','sideBySide');
s=stepTo(s,8);
s=play(s,'apprentice','signed');
s=play(s,'scholar','readLabel');
s=stepTo(s,9);
const beforeDeal=s;
s=play(s,'merchant','terms');
assert.equal(s.cash,beforeDeal.cash+12);
assert.equal(s.chapter.contract,'hand');
assert.equal(s.story.affinity.apprentice,beforeDeal.story.affinity.apprentice-1);
assert.equal(pendingDeposits(s),12);
assert.equal(s.economy.revenue,0);
s=stepTo(s,10);
s=play(s,'apprentice','fairPlan');
assert.equal(s.economy.consult,'after');
assert.equal(s.story.affinity.apprentice,beforeDeal.story.affinity.apprentice);
s=takeChapterOption(s,'desk','label','craft');
s=play(s,'apprentice','confess',0);
s=stepTo(s,11);
const beforeDelivery=s;
s=play(s,'merchant','checkGoods');
assert.equal(s.cash,beforeDelivery.cash+46);
assert.equal(s.economy.revenue,58);
assert.equal(pendingDeposits(s),0);
assert.equal(exclusiveSample(s),true);
s=play(s,'shop','priceTalk');
s=play(s,'master','seat');
s=stepTo(s,12);
assert.equal(rentOwed(s),0);
assert.ok(chapterGroups(s,'apprentice').find(g=>g.id==='rehearsal').choices.find(choice=>choice[0]==='swift')[4]);
s=takeChapterOption(s,'apprentice','rehearsal','short');
s=play(s,'teaSeller','chair');
s=play(s,'visitor','blankPage');
s=play(s,'scholar','copy');
s=stepTo(s,13);
s=takeChapterOption(s,'exhibit','fair','teach');
s=play(s,'merchant','buyer');
assert.ok(scenePlaces('river',13).merchant && scenePlaces('river',13).scholar);
for(const [scene,day] of [['shop',4],['archive',5],['river',13]]) {
  const start=entryPoint(scene), targets=scenePlaces(scene,day);
  for(const [id,place] of Object.entries(targets)) {
    assert.ok(beside(pathTo(start,p=>beside(p,place),(x,y)=>walkable(scene,x,y,targets)).at(-1)||start,place),scene+':'+id);
  }
}
s=stepTo(s,14);
s=play(s,'teaSeller','keepTable');
s=play(s,'apprentice','bridge');
s=takeChapterOption(s,'master','keepsake','cloth');
assert.equal(s.done,false);
s=closeDay(s);
assert.equal(s.done,true);
assert.equal(closeDay(s),s);
assert.equal(loadWorkshop(JSON.stringify(s)).day,14);
assert.ok(chapterEndings(s).length>=4);
assert.ok(Object.keys(s.chapter.incidents).length>=3 && Object.keys(s.chapter.incidents).length<=5);
assert.ok(Object.keys(s.story.affinity).length>=6);
assert.equal(economyResult(s).reach,6);
assert.equal(economyEnding(s).title,'还有人等下一次');
assert.equal(s.cash-pendingDeposits(s)-rentOwed(s),36+s.economy.wages+economyResult(s).profit);

const noReplica={...beforeDelivery,chapter:{...beforeDelivery.chapter,replica:[]}};
assert.equal(acceptChapterDecision(noReplica,'delivery','full').chapter.delivery,'full');
assert.equal(play(noReplica,'merchant','checkGoods',1).chapter.delivery,'small');
assert.equal(closeDay(noReplica).chapter.delivery,'paused');
assert.equal(closeDay(noReplica).economy.revenue,0);
const split=play(beforeDeal,'merchant','terms',1);
assert.equal(play(stepTo(split,11),'merchant','checkGoods',0).chapter.delivery,'full');
const splitWithoutReplica={...split,chapter:{...split.chapter,replica:[]}};
assert.equal(acceptChapterDecision(stepTo(splitWithoutReplica,11),'delivery','full'),null);
const self=play(beforeDeal,'merchant','terms',2);
assert.equal(play(stepTo(self,11),'shop','selfDisplay',0).chapter.delivery,'self');

const missed=helpShop(beforeHearing);
assert.equal(missed.economy.source,'missed');
assert.equal(missed.story.affinity.scholar||0,beforeHearing.story.affinity.scholar-1);
assert.equal(acceptChapterDecision(missed,'source','verified'),null);
const notified=helpShop(play(beforeHearing,'scholar','verifySource',1));
assert.equal(notified.economy.source,'notified');
assert.equal(notified.story.affinity.scholar,beforeHearing.story.affinity.scholar);
assert.equal(closeDay(notified).economy.rent,'paid');
assert.equal(helpShop(stepTo(freshWorkshop(),5)),null);

const originalSale=applyAction(applyAction(freshWorkshop(),'loom','stitch',draft.marks),'shop','express');
let growth=play(stepTo(originalSale,5),'scholar','recorder');
growth=stepTo(growth,6);
growth=play(growth,'scholar','verifySource');
growth=saveReplica(stepTo(growth,7),draft.marks.slice(0,2));
growth=play(stepTo(growth,9),'merchant','terms',1);
growth=play(stepTo(growth,11),'merchant','checkGoods');
growth=takeChapterOption(stepTo(growth,12),'apprentice','rehearsal','short');
growth=play(growth,'scholar','copy');
growth=takeChapterOption(stepTo(growth,13),'exhibit','fair','paid');
growth=closeDay(stepTo(growth,14));
assert.equal(growth.economy.revenue,113);
assert.equal(economyResult(growth).profit,28);
assert.equal(economyResult(growth).reach,4);
assert.equal(economyEnding(growth).title,'有钱备线，也有人回来');
assert.equal(growth.cash,64);

let commercial=play(stepTo(originalSale,9),'merchant','terms');
commercial=play(stepTo(commercial,11),'merchant','checkGoods');
const own=takeChapterOption(stepTo(commercial,12),'exhibit','booth','own');
commercial=takeChapterOption(stepTo(commercial,13),'exhibit','fair','sales');
assert.equal(takeChapterOption(commercial,'exhibit','fair','teach'),null);
assert.equal(takeChapterOption(commercial,'exhibit','delegate','delegate'),null);
commercial=closeDay(stepTo(commercial,14));
assert.equal(economyEnding(commercial).title,'订单夹在账本里');
let staffed=play(own,'apprentice','signed');
staffed=play(staffed,'apprentice','fairPlan');
staffed=takeChapterOption(staffed,'apprentice','rehearsal','short');
staffed=takeChapterOption(stepTo(staffed,13),'exhibit','fair','sales');
staffed=takeChapterOption(staffed,'exhibit','delegate','delegate');
assert.equal(staffed.economy.lesson,'delegated');
assert.equal(staffed.economy.booth,'own');

const idle=stepTo(freshWorkshop(),14);
assert.equal(closeDay(idle).done,true);
assert.equal(rentOwed(closeDay(idle)),25);
assert.equal(economyEnding(closeDay(idle)).title,'留一页给下次');
assert.ok(chapterGroups(stepTo(freshWorkshop(),13),'exhibit').some(group=>group.id==='fair'));
assert.deepEqual(stepTo({...beforeDeal},14).chapter.incidents,stepTo(loadWorkshop(JSON.stringify(beforeDeal)),14).chapter.incidents);
const rolls=new Set();
for(let seed=0;seed<8;seed++) {
  const start=freshWorkshop();
  start.chapter.seed=seed;
  rolls.add(JSON.stringify(stepTo(start,14).chapter.incidents));
}
assert.ok(rolls.size>2);
const {chapter,economy,...legacy}=freshWorkshop();
const upgraded=loadWorkshop(JSON.stringify({...legacy,day:3,done:true}));
assert.equal(upgraded.day,4);
assert.equal(upgraded.done,false);
assert.equal(dialogueTopics(upgraded,'merchant')[0][0],'arrive');
const oldDeal=loadWorkshop(JSON.stringify({...noReplica,economy:undefined}));
assert.equal(oldDeal.cash,noReplica.cash);
assert.equal(oldDeal.economy.rent,'legacy');
assert.equal(oldDeal.economy.legacyContract,true);
assert.equal(acceptChapterDecision(oldDeal,'delivery','full'),null);
console.log('PASS fourteen days, seven character routes, economy and rent, conflicting promises, four endings, saved dialogue, seeded incidents, reachability and old saves');
