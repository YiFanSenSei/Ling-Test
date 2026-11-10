import { hasSwift } from './swift.js';
import { chapterDecisionReason } from './chapter.js';

const n=(text,mood)=>({text,mood});
const p=text=>({speaker:'player',text});
const a=text=>({speaker:'stage',text});
const other=(speaker,text,mood)=>({speaker,text,mood});
const anytime=()=>true;
const sample=s=>hasSwift(s) || Boolean(s.fur.sample);
const atIncident=id=>s=>s.chapter.incidents[s.day]===id;

const events = [
  ['master','reviewWing','把样片拿到窗边',5,10,sample,[
    a('陆师傅把布绷斜靠在窗框上。'),
    n('你走的这组针到了翅根就换了个方向。拿远一点，你看出来了吗？','thoughtful'),
    p('这会儿那一小段亮得比旁边快。'),
    n('你想顺过去，还是留着这个转折？想清楚了再拆。'),
  ],[
    ['我想在边角布上试一组更顺的。',[n('行。先用一样的线色，只换方向。两块一起照光，看哪块像你心里的燕子。','proud')],{affinity:1}],
    ['我想保留转折，再绣一组把它接住。',[n('那就接得果断一点。绷子留在窗边，你回头拿近翅复绣一次。','thoughtful')],{affinity:1}],
  ]],
  ['master','seat','陆师傅留了个窗边的位子',11,14,s=>s.story.affinity.master>0 || s.recorded,[
    n('河集那边给我们送来两把椅子。你想坐哪把？','thoughtful'),
    p('最靠窗这把不是您常坐的吗？'),
    n('我今天想站一会儿，看看下一双手怎么教。你坐，或者让阿禾坐。'),
  ],[
    ['让阿禾讲她绣过的那一段。',[n('好。你在旁边帮她递绷子。等访客问她的时候，给她一点开口的时间。','proud')],{affinity:1}],
    ['我先给来的人示范起针。',[n('第一针做慢一点。等人家手里的针也落下去，再做第二针。','proud')],{affinity:1}],
  ]],
  ['apprentice','signed','看看阿禾绣在背面的字',8,14,anytime,[
    a('阿禾抱着一小块绣布跑进来，先把背面翻给你看。'),
    n('最后那个「禾」我拆了三次。以前我拿试布给师傅看，没想过背面也有个地方能写自己的名字。','warm'),
    p('河集上有人问的时候，你想自己答吗？'),
    n('想。我可能得先把第一句话练一遍。','shy'),
  ],[
    ['给你留一块单独的位置，你慢慢讲。',[n('那我就从纸上那两道翅线讲起。讲到我拆过的地方，你可别笑我。','warm')],{affinity:1}],
    ['我先当第一个访客。你讲给我听。',[n('好。您想看看我的燕子吗？它翅膀比别的短，是我自己画的。……这句行不行？','laugh')],{affinity:1}],
  ]],
  ['apprentice','fairPlan','和阿禾商量体验桌用哪块布',8,13,s=>!s.economy.consult&&(!s.chapter.contract||s.chapter.contract==='hand'&&!s.economy.legacyContract),[
    n('程渡说想看翅羽怎么转弯。我答应拿原样给他看。你这几天会把它交去柜台吗？','shy'),
    p('有这个可能。秦砚那边的货要贴清楚，体验桌也得有人顾。'),
    n('我能换一种针路教。下回签字前，你能先留一点时间给我吗？我想自己挑该怎么换。','warm'),
  ],[
    ['留一个小时，陪你选一段自己想教的针。',[n('先拿短针布吧。等我练熟了，你去做你的事，这张桌我自己带。','warm')],{decision:['consult','talk'],affinity:1}],
  ]],
  ['apprentice','bridge','陪阿禾走到桥对面',14,14,s=>s.story.reply==='together'||s.story.reply==='later',[
    a('摊子陆续收了，桥那边还有一盏灯。'),
    n('我今天一直没看你。我怕一看你，就忘了该跟客人说什么。','shy'),
    p('我听见你说，这只燕子是你自己画的。'),
    n('嗯。小票先帮我拿到桥对面吧。过了桥，我再接回来。','warm'),
  ]],
  ['shop','readBack','看看客人为什么翻帕子',4,8,anytime,[
    n('有位客人拿着帕子，先把背面翻过来。我在旁边等了好一阵。','serious'),
    p('她在找线头，还是在找名字？'),
    n('你自己问她，下回我就知道先给客人看什么。'),
  ],[
    ['我想知道她能不能找到署名。',[n('她说是给家里人的礼物，想在送的时候把名字也讲出来。那我把货签换个地方。','neutral')],{affinity:1}],
    ['问问她打算怎么用这件小东西。',[n('她要带上火车，怕折了。下回我拿小一点的样给你看。','amused')],{affinity:1}],
  ]],
  ['shop','priceTalk','和周岚在摊前讲这一件',11,14,s=>s.story.affinity.shop>0 || hasSwift(s),[
    n('刚才那位嫌手绣贵。我把两种摆开，他还是问，为什么看起来差不多。','serious'),
    p('把样片递给他吧。转一下，翅根那几针能看清。'),
    n('你愿意讲哪段最费手，还是让我照我自己的话讲？'),
  ],[
    ['我讲复绣时最难跟上的那几针。',[n('那我就给人把灯转过来。正好让后面等着的人也能看一眼。','amused')],{affinity:1}],
    ['你最清楚客人问的是什么，你来讲。',[n('好。先说手里拿的是哪一种，再让他决定是不是要买。','neutral')],{affinity:1}],
  ]],
  ['teaSeller','paper','看看春姨夹在茶账里的纸条',6,11,anytime,[
    n('这半个字我认得。那天下雨，两个绣工轮流坐到窗边借光。','thoughtful'),
    p('您记得是谁收了最后一针吗？'),
    n('我那会儿在烧水。谁最后坐过去，我怕自己记混了。'),
  ],[
    ['把您看见的和没看清的都记下来。',[n('好。你要是写了我没看清，就别替我把那半个字补上。','neutral')],{affinity:1}],
    ['我拿给陆师傅看看，再回来问您。',[n('拿去吧。纸条不急着上墙，我这边还留着原来的茶账。','neutral')],{affinity:1}],
  ]],
  ['teaSeller','chair','帮春姨找一把空椅子',12,14,anytime,[
    n('隔壁那位本来只来买茶。她看见有人绣猫毛，坐在石阶上看了半天。','neutral'),
    p('体验桌那边还有位子吗？'),
    n('没位子也行。你带我去看看阿禾的燕子，我陪她站一会儿。','laugh'),
  ],[
    ['我给她找一块边角布，先试一针。',[n('那我多倒一杯茶。等她自己绣完，再叫她来喝。','laugh')],{affinity:1}],
    ['今天先带她去看阿禾自己的作品。',[n('好。等她问是谁绣的，让阿禾自己说。','neutral')],{affinity:1}],
  ]],
  ['visitor','slowHand','让程渡把穿针的手画清楚',6,11,anytime,[
    n('我画了三遍穿线的手。每次画到这里，拇指就挡住针眼。','curious'),
    p('你坐过来一些，我做慢一点。'),
    a('程渡把速写本换到另一只手里，抬眼看着你捏短线头。'),
    n('原来那一小截留得这么短。明天我照着自己试。','joy'),
  ]],
  ['visitor','blankPage','给程渡的本子留一页',12,14,anytime,[
    n('速写本能放在展台上吗？我还留着一页，画什么都行。','curious'),
    p('你自己最想留下哪一刻？'),
    n('有人坐下来，第一次把线穿过去的那一刻。要不，你帮我想想？'),
  ],[
    ['画起针的手，旁边留个位置写是谁。',[n('好。写名字之前我先去问他愿不愿意。','joy')],{affinity:1}],
    ['留白给访客，看看他们会写什么。',[n('那我把笔夹在这里。散场我们再一起翻。','joy')],{affinity:1}],
  ]],
  ['merchant','arrive','看看秦砚带来的两只燕子',4,8,anytime,[
    a('秦砚把印出的燕子放到手绣布旁，退到门口。'),
    n('离半米看，谁知道哪只是绣的？我跑这么多摊，客人先问价，再问能不能装进行李。','skeptical'),
    other('shop','那你把两块都拿起来。客人手里能看出来的事，摊上也该看得见。','serious'),
    n('你们要卖，先告诉我这一只为什么值得单独标价。','neutral'),
  ],[
    ['先摸摸背面。我们可以谈用途、数量和货签。',[n('行。我先把客人最常问的尺寸记下来。过几天，你拿两块样给我对照。','impressed')],{affinity:1}],
    ['目前我想把样片留在工坊，等试好了再谈。',[n('那我不催你开价。第九天我还在店里，你想谈再来。','neutral')]],
  ]],
  ['merchant','sideBySide','把近翅复样拿给秦砚看',7,12,s=>s.chapter.replica.length>=2,[
    n('这两块是同一张图？把灯挪过去，那半截翅膀怎么先亮起来了？','impressed'),
    p('图是同一张。第二块有几针顺了羽势，也留了一点线色的变化。'),
    n('这样我知道了。做成一对时，得先告诉客人哪里相似、哪里是各自绣出来的。','neutral'),
  ]],
  ['merchant','terms','和秦砚定下合作方式',9,10,s=>!s.chapter.contract,[
    n('这一版做一批，标清按你的新样制作。货都在我柜台走，原样也要在那儿摆到散集。这样我出五十八。','neutral'),
    other('shop','小批手绣只做三十七，得另做近翅复样、留时间核签。原样可以带回体验桌。','serious'),
    n('都在第十一天交。你们也可以自己去河集试价。想清楚了，我们再签。','skeptical'),
  ],[
    ['接批量单 · 58 元，原样留在秦砚柜台。',[n('先付十二元。河集散场后你再来拿原样。谁做的、怎么做的，货签上分开写。','neutral')],{decision:['contract','hand'],affinity:1,detail:'今天收 12 元定金。第 11 天核签并完整交付后收 46 元尾款。'}],
    ['接小批手绣 · 37 元，原样留给工坊。',[n('八元定金。第十一天拿近翅复样来核签，原样由你们自己摆。','neutral')],{decision:['contract','split'],detail:'今天收 8 元定金。第 11 天带近翅复样，留 1 小时核签，完整交付后收 29 元尾款。'}],
    ['我把样片留给工坊自展。',[n('好。我还会去河集。兴许能赶在你们收摊前看一眼。','neutral')],{decision:['contract','self'],detail:'今天无定金。第 11–12 天可以找周岚商量自展。'}],
  ]],
  ['merchant','checkGoods','打开货袋，当面核对',11,11,s=>['hand','split'].includes(s.chapter.contract)&&!s.chapter.delivery,[
    a('秦砚把做好的货签压在样片旁，上头只印了「老街苏绣」几个字。'),
    n('再写清一点也来得及。今天要装袋了，你给我个准话。','skeptical'),
    p('先把货和样分开放。我要逐件看过再签。'),
  ],[
    ['把货签按样片与工艺分开，照约交付。',[n('好，这两张换掉。我让摊上看货的人也能看清楚。尾款现在给你。','impressed')],{decision:['delivery','full'],affinity:1}],
    ['把范围缩小，只交已经核对的一件。',[n('可以。我把余下的从货单上划掉，只签这一件。','neutral')],{decision:['delivery','small']}],
    ['今天先停下，退回定金，把样片带回去。',[n('知道了。我会把原来的标签收起来。下次有样了，再谈一次。','skeptical')],{decision:['delivery','paused']}],
  ]],
  ['merchant','buyer','听秦砚给河集客人解释',13,14,s=>['full','small'].includes(s.chapter.delivery),[
    n('这边是手绣，你拿起来看看背面。另一边是按新样印的，货签写着。','neutral'),
    p('你还真把两张签分开贴了。'),
    n('刚才有个人看了半天，最后各买了一件。他说给两个人，正好能讲两个故事。','impressed'),
  ]],
  ['merchant','tryTwo','给秦砚一块试针的布',13,14,s=>!['full','small'].includes(s.chapter.delivery),[
    n('我刚才在旁边看。绣到哪一步，人会舍不得拆？','neutral'),
    p('你坐下试两针。第一针落在布边，第二针再想往哪里走。'),
    n('我以为你会叫我照着线走。……那我先落一针，看看这布怎么拐弯。','impressed'),
  ]],
  ['scholar','recorder','问清录音笔什么时候开',5,9,s=>!s.chapter.archive,[
    n('我想记的是陆师傅怎么教人落第一针。哪些能录，录完给谁看，先听你们说。','neutral'),
    other('master','针可以讲。底稿只看局部，完整的先留在柜里。画图的人和动针的人未必是一个。','thoughtful'),
    p('如果拿去展览，那半个没看清的名字怎么写？'),
    n('先写待核。你希望展台摆哪一部分？','focused'),
  ],[
    ['只整理陆师傅准许公开的局部，出处写待核。',[n('好，局部和录音用途分开记。要是赶得上第六天，陆师傅和我在档案室等你一起来核。','warm')],{decision:['archive','excerpt'],affinity:1}],
    ['旧样先留着，展台用自己的练习布。',[n('那我记你怎么练、怎么教。第六天陆师傅会来档案室核旧样，查清楚的先留在工坊。','warm')],{decision:['archive','private'],affinity:1}],
  ]],
  ['scholar','verifySource','赴约核旧样，或先说明情况',6,6,s=>!s.economy.source,[
    n('陆师傅的车晚一点就走。要查这张样，我们得占下这个下午。','focused'),
    other('master','先把这块翻过来。写名字以前，得看看背面这两针是谁后来补的。','thoughtful'),
    p('周岚也是这时要人。她有一批货要过手，我本来指着这笔工钱交房租。'),
    n('今天确实只够做一边。你去小店的话，我先给你一份手上的资料，名字留待以后核。','warm'),
  ],[
    ['留下来核对旧样。',[n('翻过来看，这行是后来补的。能确认的我写清楚，陆师傅刚才说暂不公开的地方也记在副本里。','warm')],{decision:['source','verified'],affinity:1,detail:'用时 2 小时，与今天小店分拣是同一时段。'}],
    ['先说明情况，我得去小店接这班。',[n('行。拿这份回去，页脚我写了哪几句还没核过。第十天写展签，那里先留一行空白。','neutral')],{decision:['source','notified'],detail:'说明情况不耗时。之后可以去小店分拣，用时 2 小时，收入 8 元。'}],
  ]],
  ['scholar','readLabel','请人试读沈照宁的展签',8,12,anytime,[
    n('我写了满满一张。程渡读到第三行，就转头问为什么有两块颜色这么像的布。','focused'),
    p('那第一句话就请人拿起来看。想细读的人，再往后翻。'),
    n('对。档案给以后查，展签给今天刚走到桌边的人。','warm'),
  ]],
  ['scholar','copy','核对留在工坊的那份副本',12,14,anytime,[
    n('这是留在工坊的副本。写过的人先看看，漏了什么就补。','focused'),
    p('还有一条线索没核完，先给它留个空行。'),
    n('好。把原来怎么试绣的也放进去。以后有人接着查，至少知道你为什么落了那几针。','warm'),
  ]],
  ['teaSeller','keepTable','和春姨约下一张试针桌',14,14,s=>['free','delegated'].includes(s.economy.lesson)&&!s.economy.next,[
    n('昨天有人带着布回来了。她绣了两针，第三针还是想坐在桌边问人。','neutral'),
    p('这张桌要是每周有一天能摆出来，她就知道什么时候来。'),
  ],[
    ['给她们留一张桌，我去和阿禾商量轮班。',[n('行。茶水我管。谁来学、谁来教，那天再由你们自己说。','laugh')],{decision:['next','tea'],affinity:1}],
  ]],
  ['shop','keepShelf','和周岚商量留一格寄售柜',14,14,s=>['sales','apprentice'].includes(s.chapter.fair)&&!s.economy.next,[
    n('有客人问阿禾那只燕子散场以后去哪儿看。我能在柜台腾出一格。','serious'),
    p('可以。谁做的、谁定价，得让她自己写。'),
  ],[
    ['把柜台留给愿意署名寄售的人。',[n('好，寄售的账也分开写。下次她带新东西来，先请她自己开价。','amused')],{decision:['next','shop'],affinity:1}],
  ]],
  ['shop','selfDisplay','和周岚安排自展样片',11,12,s=>s.chapter.contract==='self'&&!s.chapter.delivery,[
    n('秦砚那单搁下了。你要是愿意，我在柜台边给自展的样留一小格。','neutral'),
    p('别把小票和成品分开。我想让人看到针脚是从哪里起的。'),
    n('好。那就两样一起摆。','amused'),
  ],[['把样片留给河集的自展桌。',[n('我给它包一层软布，开摊时来取。','neutral')],{decision:['delivery','self']}]]],
  ['master','chanceSpool','替陆师傅找找那卷旧线',4,13,atIncident('spool'),[
    n('那卷靛青我以为用完了，今天在布包里又找着一点。够绣一小片边。','thoughtful'),
    p('您想拿它接回原来的样，还是留给练习？'),
    n('放在桌上吧。你下回试光，把新线和它挨着绣，我也想看看两种丝光。','proud'),
  ]],
  ['visitor','chanceWind','帮程渡按住被风掀起来的展纸',4,13,atIncident('wind'),[
    a('河风把程渡画到一半的纸吹到了脚边。'),
    n('别先捡我那张，压在下面的试布更轻！','curious'),
    p('拿本子压住这一角。你看风把刚才那排线全吹向一边了。'),
    n('我回去再画一页，就画这一下。','joy'),
  ]],
  ['shop','chanceCustomer','听听熟客多问的那一句',4,13,atIncident('customer'),[
    n('那位熟客今天又来了。她说拿到帕子才发现，背面还有人的名字。','neutral'),
    p('下次可以直接把样和署名放在一起。'),
    n('我记下了。有人买回去想讲给别人听，名字还是放在拿起来就能找见的地方。','amused'),
  ]],
  ['apprentice','chanceWing','看阿禾随身带的半截翅膀',4,13,s=>atIncident('wing')(s) && s.chapter.seed%2===0,[
    n('我本来想等绣完才给你看。两色一接，转弯就有点僵。','shy'),
    p('拿灯照一下。要不先在边角布试几根细针？'),
    n('好，这块先留着，我想看看重做以后差在哪儿。','warm'),
  ]],
  ['apprentice','chanceWingTurn','看看阿禾还没收完的翼尖',4,13,s=>atIncident('wing')(s) && s.chapter.seed%2===1,[
    n('我把最后一针缩短了，反而像是停在了半空。你看这里。','shy'),
    p('先把布转一点。我想看看顺着羽缘接过去会怎样。'),
    n('原来是先转方向，再把针缩短。让我用同一色在边角试一次。','warm'),
  ]],
  ['teaSeller','chancePhoto','从春姨手里接过一张旧照片',4,13,atIncident('photo'),[
    n('我在账页后面找到这张。靠窗那张桌认得出来，人的手被窗框挡住了。','thoughtful'),
    p('至少知道地方了。把照片和您的回忆放在一起，等再问到别的人。'),
    n('好。你替我留一张副本，茶摊上有客人问，我也能给她看看。','neutral'),
  ]],
  ['visitor','chanceBoat','给等船的人留一组针',13,13,atIncident('boat'),[
    n('有个人说船靠岸就得走。我拿了块短针试布，他只想试一下。','curious'),
    p('那就让他自己挑起针点，第二步我们再指给他。'),
    n('我把这块布角留着。下回他来了，认得出自己是哪一针。','joy'),
  ]],
  ['teaSeller','chanceMeeting','听秦砚和沈照宁在茶摊聊货签',8,13,atIncident('encounter'),[
    n('两个人为了桌上那张小纸说了半天。给你也倒一杯？','laugh'),
    other('merchant','我在摊上只来得及说一句，买的人拿起来就走。','skeptical'),
    other('scholar','那一句先告诉他手里的是什么。想再问的人，我把整理稿放在旁边。','focused'),
    p('把两块样一起摆出来吧。有的事一翻面就能看见。'),
    n('说完记得喝茶。放在手边这三杯，都快凉了。','laugh'),
  ]],
];

export const chapterDialogue = {};
for(const [person,id,, , , ,beats,answers] of events) {
  const nodes=chapterDialogue[person] ??= {};
  nodes[id]={beats};
  if(answers) nodes[id].choices=answers.map(([label,response,effect],index)=>{
    const next=id+'-'+index;
    nodes[next]={beats:response};
    return {label,next,...effect};
  });
}

export function chapterTopics(s,person) {
  if(s.done) return [];
  return events.filter(([actor,, ,first,last,when])=>actor===person && s.day>=first && s.day<=last && when(s))
    .map(([,id,label])=>[id,label]);
}

export function chapterChoiceReason(s,choice) {
  const [group,value]=choice.decision || [];
  return chapterDecisionReason(s,group,value);
}
