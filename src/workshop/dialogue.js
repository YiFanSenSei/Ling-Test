import { acceptChapterDecision } from './chapter.js';
import { chapterChoiceReason, chapterDialogue, chapterTopics } from './chapter-dialogue.js';

const replies = {
  together: {
    title: '并肩走一段',
    text: '收工后，阿禾在桥头等你。她把原本绕在指尖的红线收进兜里，伸手牵住你。你们约好周日去吃桥东的馄饨，也约好各自留一点时间做自己的新样。',
    line: '那从周日开始，好不好？桥东那家馄饨我一直想去。你到桥头等我，换我带路。',
    mood: 'warm',
  },
  friends: {
    title: '给彼此留个位子',
    text: '阿禾先一个人走了一段路。临分别时，她回头问，等自己画出新样，你还愿不愿意帮她看看。你们把下次见面的事认真约了下来。',
    line: '我有点难过，可能得缓一缓。等我画出自己的燕子，我还想拿给你看。',
    mood: 'hurt',
  },
  later: {
    title: '桥头的约定',
    text: '阿禾把周日的时间写在两张茶摊的纸签上。你们一人留了一张。到那时，工坊的账已经结了，你们可以坐下来把今天没说完的话慢慢说完。',
    line: '好。周日午后，桥头见。到时候我们谁都别赶时间，行吗？',
    mood: 'warm',
  },
};

const memories = ['firstTalk', 'ownDesign', 'invited'];
const npc = (text, mood) => ({ text, mood });
const you = (text, mood) => ({ speaker: 'player', text, mood });
const aside = (text, mood) => ({ speaker: 'stage', text, mood });

export function loadStory(saved) {
  const known = memories.filter(id => Array.isArray(saved?.memories) && saved.memories.includes(id));
  const reply = typeof saved?.reply === 'string' && Object.hasOwn(replies, saved.reply) ? saved.reply : '';
  // Older saves only recorded the milestones, so treat those conversations as already played.
  const legacy = [
    ...(known.includes('firstTalk') ? ['apprentice:tea'] : []),
    ...(known.includes('ownDesign') ? ['apprentice:sketch'] : []),
    ...(known.includes('invited') ? ['visitor:notebook'] : []),
    ...(reply ? ['apprentice:confess'] : []),
  ];
  const completed = Array.isArray(saved?.completed)
    ? [...new Set(saved.completed.filter(key => typeof key === 'string' && validTopicKey(key)))]
    : legacy;
  const affinity = {};
  for (const person of Object.keys(dialogue)) {
    const points = saved?.affinity?.[person];
    if (Number.isSafeInteger(points) && points > 0) affinity[person] = points;
  }
  if (!saved?.affinity && known.includes('firstTalk')) {
    affinity.apprentice = known.includes('ownDesign') ? 3 : 1;
  }
  if (!saved?.affinity && known.includes('invited')) affinity.visitor = 1;
  return {
    memories: known, reply, completed, affinity,
    encounter: loadEncounter(saved?.encounter, completed),
  };
}

const dialogue = {
  master: {
    crooked: {
      mood: 'thoughtful',
      beats: [
        npc('你把窗推开一点。屋檐下这几天有两只燕子，傍晚就回来。'),
        you('您画底稿的时候，也是在这儿看的吗？'),
        npc('我十七岁第一次绣燕子，把它绣得像只落水麻雀。那时候谁叫我出去看，我都嫌耽误下针。'),
        you('后来您怎么画对的？', 'focused'),
        npc('我把绷子夹到铺子门口，在那儿蹲了一下午。看到第三回才发现，燕子转弯的时候，一边翅膀压得比另一边低。'),
      ],
      choices: [
        { label: '那只落水麻雀还在吗？我想看看。', next: 'kept', affinity: 1 },
        { label: '现在绣歪了，您还会拆吗？', next: 'unpick' },
      ],
    },
    kept: { mood: 'thoughtful', beats: [
      npc('在。压在针线盒最下面。哪天你觉得自己的手不行了，就去翻翻。'),
      you('那我今天能翻吗？'),
      npc('能。等等，盒盖下面那张纸别丢。是我那时记的，燕子回来六次，我只看清了一次。', 'proud'),
    ] },
    unpick: { mood: 'thoughtful', beats: [
      npc('看歪在哪里。歪的是翅膀，可以改成转弯。歪的是落针的力道，那就拆掉再来。'),
      you('拆到只剩一半，您不心疼？'),
      npc('心疼啊。我会先倒杯茶，等它凉一半再拆。手一急，容易连底布也挑破。'),
    ] },
    closing: { mood: 'thoughtful', beats: [
      aside('陆师傅擦了擦窗台，把一把铜钥匙放在日头底下。'),
      you('这把钥匙今天也要收走吗？'),
      npc('留这儿。以后哪天你有空，进来坐坐也好。'),
      you('什么都不带也能来？'),
      npc('你来的头一个月，我还奇怪你怎么总坐在离窗最远的地方。下回坐这边吧，下午能晒到后背。', 'proud'),
    ] },
  },
  shop: {
    apron: {
      mood: 'amused',
      beats: [
        npc('先别靠柜台，我刚熨完布。你看，我这只口袋差点又蹭上去了。'),
        you('你这条围裙的两个口袋怎么不一样深？'),
        npc('左边装零钱，右边能竖着塞个包子。当年拿卖不出去的布头缝的。第一次穿出去，整条街都以为我换了新衣服。'),
      ],
      choices: [
        { label: '那后来有人来买同款吗？', next: 'soldOut' },
        { label: '你是不是故意穿去打广告的？', next: 'advert', affinity: 1 },
      ],
    },
    soldOut: { mood: 'amused', beats: [
      npc('有啊，我只好把剩下那半条挂起来，标上「店主正在使用」。问的人比买布的还多。'),
      you('干脆卖围裙算了。', 'warm'),
      npc('试过。来订的第一位客人指定两边口袋一样深。我给她做了，她第二天就回来问能不能加深一边。'),
    ] },
    advert: { mood: 'amused', beats: [
      npc('冤枉。那天口袋里塞了两个热包子，我是怕油滴到新裤子上。'),
      you('你刚才说只能塞一个。'),
      npc('你连这个也记啊？一个竖着，一个拿在手里。春姨至今以为我那天带了个朋友。'),
    ] },
    name: { beats: [
      you('这条帕子翻过来还有字。是你们店的记号吗？'),
      npc('是绣它的人留下的名字。前几天有人问我，能不能把那几个字剪掉，只留店名。', 'serious'),
      you('你怎么回的？'),
      npc('价签你可以撕，名字得留下。她后来把帕子买走了。上周回来还问我，那几个字该怎么念。'),
      you('我以前买帕子也不太会翻到背面。'),
      npc('那今天记住一个。她姓袁，叫袁晓春。她落款的时候，最后一针总往左带一点。你摸摸。', 'neutral'),
    ] },
    patternShelf: { beats: [
      aside('周岚从柜子底下抽出一叠纸，最上面那张画着大小不一的口袋。'),
      npc('那天你问我是不是故意穿围裙出去，我回来把这叠纸翻出来了。原来我画过好几种，最后选了最省布的那个。'),
      you('这张最大的，你想往里装什么？'),
      npc('一本书。我以前看店总把书扣在膝盖上，有人一来，书就掉下去了。'),
      you('那今天试一试？我帮你按住这张。'),
      npc('行。你先从柜台下面挑一本，找你想带出门的尺寸。', 'amused'),
    ] },
  },
  apprentice: {
    tea: {
      mood: 'laugh',
      beats: [
        aside('阿禾把第二只杯子推过来，先替你掀开盖子看了一眼。'),
        you('怎么了，里面有线头？'),
        npc('我检查一下这回有没有水。你第一天来，师傅让我给你倒茶，我紧张得把空壶端过去了。'),
        you('我还当你急着回去绣那只燕子。'),
        npc('那只燕子我早绣完了。我站在门帘后头等你发现，结果你对着空杯吹了两口。你还记得吗？'),
      ],
      choices: [
        { label: '记得。我怕你难为情，还说水太烫。', next: 'tooHot', remember: 'firstTalk', affinity: 1 },
        { label: '我以为那是工坊的拜师规矩。', next: 'ritual', remember: 'firstTalk' },
      ],
    },
    tooHot: { mood: 'laugh', beats: [
      npc('我当时差点真去给你添凉水。师傅后来问我，怎么一壶茶端进端出三回，壶还越来越轻。'),
      you('那这杯我可要喝完。你放了什么？', 'warm'),
      npc('桂花。要放两撮，我数过了。你尝尝，明天再告诉我放多了没有。', 'warm'),
    ] },
    ritual: { mood: 'laugh', beats: [
      npc('原来我稀里糊涂就给你拜了个师。那我再收你一个空杯做束脩。'),
      you('给你空杯以前，我能先把这杯茶喝完吗？'),
      npc('行。喝慢点啊，我也想坐一会儿。那边两只线轴先让它们躺着吧。', 'warm'),
    ] },
    sketch: {
      mood: 'shy',
      beats: [
        npc('你喝茶的地方还在。杯盖底下有张纸，你拿的时候别翻过来。'),
        you('好。我先问一句，它能给我看吗？'),
        aside('阿禾把杯盖挪开，自己翻过那张皱巴巴的收银小票。背面有一只翅膀很短的燕子。'),
        npc('昨天下班等车，我在站牌底下画的。背面透过来一行「鸡蛋六枚」，我只好让翅膀绕过去。'),
        you('像是在桥底下打了个急弯。'),
        npc('真有点像。可师傅一眼就能看出这不是她教的。你说，我能不能就这么绣？'),
      ],
      choices: [
        { label: '照你自己的意思绣吧。我想看的是你画的燕子。', next: 'myBird', remember: 'ownDesign', affinity: 2 },
        { label: '先在布角试几针，看看它怎么飞。', next: 'tryBird', remember: 'ownDesign', affinity: 1 },
      ],
    },
    myBird: { mood: 'warm', beats: [
      npc('那我今晚下班就试。要是不好看，我也先把它绣完。第一只就该留给我自己。'),
      you('小票我给你夹起来？柜台有本旧账簿。'),
      npc('别夹。今晚等车，我还想给它画两条尾巴，看哪条顺眼。明天我再给你看。'),
    ] },
    tryBird: { mood: 'warm', beats: [
      npc('好。我留一块布角给它。原来只要几针，就能知道自己喜不喜欢。'),
      you('你想给它用哪卷线？'),
      npc('就那卷剩一点的朱红。要是尾巴绣到一半没线了，也让它先飞一晚上。'),
    ] },
    confess: {
      mood: 'shy',
      beats: [
        aside('窗子开了一条缝。阿禾用茶杯压住收银小票，从兜里摸出一角绣布。'),
        npc('看，它飞出来了。尾巴有点歪，我照着小票补完的。', 'warm'),
        you('给我看看背面？……你还把名字绣上去了。'),
        npc('嗯。昨天我站在这儿想了半天，觉得还是得自己把名字告诉它。'),
        aside('她收回绣布，把拇指绕进辫梢的红绳里。', 'shy'),
        npc('还有件事。这些天我有几回想叫住你，最后都问成了「线放哪儿」。'),
        you('线还在老地方。我在听。'),
        npc('我喜欢你。等工坊收工了，我也想和你见面。你怎么想？'),
      ],
      choices: [
        { label: '我也喜欢你。收工后一起走吧。', next: 'together', reply: 'together', playerMood:'warm' },
        { label: '我很珍惜你，想和你做朋友。', next: 'friends', reply: 'friends', playerMood:'focused' },
        { label: '我想认真想一想。周日我们再聊。', next: 'later', reply: 'later', playerMood:'focused' },
      ],
    },
    showBird: { mood: 'warm', beats: [
      aside('阿禾把收银小票和一角绣布并排摆在桌上。'),
      npc('我拿昨晚剩下的红线把尾巴绣完了。你看，翅膀短归短，倒也飞得起来。'),
      you('你还在背面绣了名字。'),
      npc('那一针我拆了三次。绣上以后我才敢拿给师傅看。她说像在桥底下躲雨，还叫我给它留块干布。'),
      you('下回你想绣什么？'),
      npc('等我看清楚再告诉你。说好了，下次我带图，你也带一张。'),
    ] },
    together: { mood: replies.together.mood, beats: [
      aside('阿禾张了张嘴，过了一会儿才笑出来。她终于松开了那截红绳。'),
      npc(replies.together.line),
      you('到时候带上你的燕子？我想再看看。'),
      npc('那你也带一样自己的东西。带什么都行，过了桥再给我看。'),
    ] },
    friends: { mood: replies.friends.mood, beats: [
      aside('阿禾把绣布折好，沿着原来的折痕按了两遍。'),
      npc('我听明白了。谢谢你直接告诉我。'),
      you('你要是想先一个人待一会儿，我就把窗子留着。'),
      npc(replies.friends.line),
    ] },
    later: { mood: replies.later.mood, beats: [
      npc(replies.later.line),
      you('好。那天慢慢说，没想好的也可以留到下次。'),
      aside('阿禾借来一支铅笔，在茶摊的两张纸签上写了同一个时间。'),
      npc('你拿这张。我留另一张，省得我一紧张，又问你线放哪儿。', 'laugh'),
    ] },
  },
  teaSeller: {
    kettle: {
      beats: [
        npc('坐里面那把。外面这把椅子右边少个钉子。你是陆师傅新带的那个吧？我叫许春，老街上都叫我春姨。'),
        you('她跟您提过我？'),
        npc('她只说近来茶叶下得快。我开摊把壶盖往桌上一搁，她隔半条街都能听见。她说，针一停，茶就该喝了。', 'laugh'),
        you('难怪她总知道水什么时候开。'),
        npc('她连我给谁泡的都能猜出来。你先闻闻这壶，猜猜今天我给谁留的。'),
      ],
      choices: [
        { label: '陆师傅以前也来这儿吗？', next: 'oldDays', affinity: 1 },
        { label: '阿禾喜欢喝什么？', next: 'osmanthus' },
      ],
    },
    oldDays: { beats: [
      npc('常来。她攒了一罐绣剩的线头，说哪天要绣一块东拼西凑的杯垫。我等了十年，先把杯子摔了三个。'),
      you('那罐线她还留着吗？'),
      npc('留着呢。去年她把线罐给了阿禾，说不要照着她的配色来。你看，压壶盖的那小块布就是阿禾绣的。', 'thoughtful'),
    ] },
    osmanthus: { beats: [
      npc('桂花茶。她每次说少放一点，我真少放，她又盯着我手里的罐子看。你给她泡的话，两撮正好。'),
      you('那我记住了。您有时候也给工坊留茶叶吗？'),
      npc('我送过她一小罐，她说放工坊就行。哪天你也渴了，记得去窗台底下找。'),
    ] },
    riverTea: { beats: [
      npc('我把河边的水壶烧上了。人要是多，你就来拿，不用问我。'),
      you('您也过去坐坐吧？'),
      npc('等小周来替我看一下摊。她小时候说想把这摊盘下来，因为想喝多少茶都行。', 'laugh'),
      you('现在呢？'),
      npc('现在她只肯接手一刻钟，说够泡一壶了。等她来了，我就带这壶去找你。'),
    ] },
  },
  visitor: {
    notebook: {
      beats: [
        aside('桥边的人按住一页被风翻起来的纸，铅笔从本子里滚了出来。'),
        you('给。刚才那页画的是桥墩吗？'),
        npc('是桥墩上站的那只白鹭。桥墩比较好画，它又不会跑。我叫程渡，住河对面。'),
        you('我在这边的绣坊。你常过桥？'),
        npc('最近常来。想看看你们怎么把鸟绣出来。可到了展场门口又有点不敢进，我连线都不会穿。', 'curious'),
      ],
      choices: [
        { label: '来看看展吧，我给你留个位置。', next: 'invited', remember: 'invited', affinity: 1 },
        { label: '你都画过些什么鸟？', next: 'birds' },
      ],
    },
    invited: { beats: [
      npc('那我把速写本带上。万一针穿不进去，我还能画画大家的手。'),
      you('你从桥下来就能看见桌子。找不到位子就问我。'),
      npc('好。我在本子上先留一页。这回不在桥上画了，过来挨着你们画。'),
    ] },
    birds: { beats: [
      npc('燕子、白鹭，还有一只谁也认不出来的。我画的是麻雀，春姨非说那是她家的鸡。'),
      you('我觉得是鸡。你画了四根脚趾，少说有两根用来刨地。'),
      npc('那是桥栏上的钉子！……算了，这页送给春姨。鸡那页我重新画。', 'joy'),
    ] },
    returned: { beats: [
      npc('我把速写本带来了，第一张画展台。你看，我在边上留了块空白。'),
      you('这里怎么画了个框？你还打算补什么？'),
      npc('想请你画一根你用惯的针。圆的、歪的都行，我想看看针在你手里是什么样。', 'curious'),
      aside('你接过铅笔，画了一根针，在顶端补上一个小小的孔。'),
      npc('我一直以为针眼跟米粒差不多。原来这么小啊。明天等光好的时候，我再试一次。', 'joy'),
    ] },
    furVisit: { beats: [
      npc('我本来想画一只猫。看了两块试布，倒想先画线是往哪边走的。'),
      you('你在画上分了两层？'),
      npc('嗯。先画底下的几道，再用短一点的线补边。你看，我特意给下面那层留了空。'),
    ] },
    emptyPage: { beats: [
      npc('展台那一页我先空着。你看后面这页，桥底下的燕子飞得低，我终于画对了一次。'),
      you('你把它转弯时那边翅膀也画下来了。'),
      npc('是啊。展台那页留到下回吧，真要画的时候，记得还来叫我。'),
    ] },
    hands: { beats: [
      aside('程渡把速写本递过来，手指压住卷起的页角。'),
      npc('你说会给我留个位置。我昨天回去就找了根针试了试，穿半天没穿进去。后来我画了我爸穿线的手。'),
      you('他怎么把线头捏得这么短？'),
      npc('他说这样线不容易晃。我画了三遍才看明白。你们常做的动作，我一眼就漏掉了好多。'),
      you('下次你画慢一点，我也做慢一点。'),
      npc('好。我从这页接着画。'),
    ] },
  },
};

for (const [person,nodes] of Object.entries(chapterDialogue)) {
  dialogue[person] = {...dialogue[person],...nodes};
}

function availableTopics(s, person) {
  switch (person) {
    case 'master': return [
      ['crooked', '问问师傅第一次绣的燕子'],
      ...(s.day >= 14 && (s.story.affinity.master || s.recorded) ? [['closing', '问问收工以后的事']] : []),
    ];
    case 'shop': return [
      ['apron', '看看周岚的围裙'],
      ['name', '翻过柜台上的帕子'],
      ...(s.day >= 6 && s.story.affinity.shop ? [['patternShelf', '看看周岚从柜子底下翻出的纸样']] : []),
    ];
    case 'apprentice': {
      if (s.story.reply) return [];
      const topics = [['tea', '在阿禾旁边坐下']];
      if (s.day >= 2 && s.story.memories.includes('firstTalk')) topics.push(['sketch', '问阿禾昨晚画了什么']);
      if (s.story.memories.includes('ownDesign') && !s.done) {
        if (s.day >= 10 && s.story.affinity.apprentice >= 2) topics.push(['confess', '留下来陪阿禾坐一会儿']);
      }
      return topics;
    }
    case 'teaSeller': return [
      ['kettle', '在茶摊坐一会儿'],
      ...(s.day >= 3 && s.story.affinity.teaSeller ? [['riverTea', '陪春姨等水烧开']] : []),
    ];
    case 'visitor': {
      if (s.story.memories.includes('invited')) {
        const topics = [];
        if (s.day >= 2 && s.story.affinity.visitor) topics.push(['hands', '看看程渡新画的手']);
        if (s.display) topics.push(['returned', '看看程渡画的展场']);
        else if (s.fur?.shown) topics.push(['furVisit', '看看程渡怎么画猫毛']);
        else if (s.done) topics.push(['emptyPage', '看看程渡今天画的燕子']);
        return topics;
      }
      if (s.story.completed.includes('visitor:notebook')) return [];
      return s.done || s.display || s.fur?.shown ? [['birds', '看看程渡的速写本']] : [['notebook', '聊聊程渡的速写本']];
    }
    default: return [];
  }
}

function validTopicKey(key) {
  const [person, topic, extra] = key.split(':');
  return extra === undefined && Object.hasOwn(dialogue, person) && Object.hasOwn(dialogue[person], topic);
}

function loadEncounter(saved, completed) {
  if (!saved) return null;
  const { person, topic, node, beat, response } = saved;
  if (![person, topic, node].every(id => typeof id === 'string')) return null;
  const key = `${person}:${topic}`;
  if (!validTopicKey(key) || completed.includes(key) || !Object.hasOwn(dialogue[person], node)) return null;
  const line = dialogue[person][node];
  if (!Number.isInteger(beat) || beat < -1 || beat >= line.beats.length) return null;
  if (node === topic && beat >= 0) return { person, topic, node, beat };
  const from = response?.from;
  if (typeof from !== 'string' || !Object.hasOwn(dialogue[person], from) || !Number.isInteger(response.index)) return null;
  const choice = dialogue[person][from].choices?.[response.index];
  if (choice?.next !== node) return null;
  const gain = Number.isInteger(response.gain) && response.gain > 0 ? Math.min(response.gain, choice.affinity || 0) : 0;
  return { person, topic, node, beat, response: { from, index: response.index, gain } };
}

export function dialogueTopics(s, person) {
  if (s.story.encounter) return [];
  return [...chapterTopics(s,person),...availableTopics(s,person)].filter(([topic]) => !s.story.completed.includes(`${person}:${topic}`));
}

export function startDialogue(s, person, topic) {
  if (s.story.encounter || !dialogueTopics(s, person).some(([id]) => id === topic)) return null;
  return { ...s, story: { ...s.story, encounter: { person, topic, node: topic, beat: 0 } } };
}

function moodAt(line, beat) {
  return line.beats.slice(0, beat + 1).findLast(item => (!item.speaker || item.speaker==='stage') && item.mood)?.mood || line.mood;
}

export function currentDialogue(s) {
  const encounter = s.story.encounter;
  if (!encounter) return null;
  const { person, node, beat, response } = encounter;
  const source = response && dialogue[person][response.from], line = dialogue[person][node];
  const continuing = beat + 1 < line.beats.length;
  return {
    spoken: beat < 0 ? you(source.choices[response.index].label, source.choices[response.index].playerMood) : line.beats[beat],
    mood: beat < 0 ? moodAt(source, source.beats.length - 1) : moodAt(line, beat),
    choices: continuing ? [] : (line.choices || []).map(choice=>({...choice, reason:chapterChoiceReason(s,choice)})),
    continuing,
    gain: beat === 0 ? response?.gain || 0 : 0,
  };
}

export function advanceDialogue(s) {
  if (!currentDialogue(s)?.continuing) return null;
  const encounter = { ...s.story.encounter, beat: s.story.encounter.beat + 1 };
  return { ...s, story: { ...s.story, encounter } };
}

export function chooseDialogue(s, index) {
  const choice = currentDialogue(s)?.choices[index];
  if (!choice || choice.reason || (choice.reply && (s.done || s.story.reply))) return null;
  const next = choice.decision ? acceptChapterDecision(s,...choice.decision) : s;
  if (!next) return null;
  const encounter = s.story.encounter;
  const { person } = encounter;
  const before = next.story.affinity[person] || 0;
  const gain = s.done ? 0 : Math.min(choice.affinity || 0, Number.MAX_SAFE_INTEGER - before);
  const story = {
    ...next.story,
    encounter: { ...encounter, node: choice.next, beat: -1, response: { from: encounter.node, index, gain } },
  };
  if (gain) story.affinity = { ...story.affinity, [person]: before + gain };
  if (choice.remember && !s.done && !story.memories.includes(choice.remember)) {
    story.memories = [...story.memories, choice.remember];
  }
  if (choice.reply) story.reply = choice.reply;
  return { ...next, story };
}

export function finishDialogue(s) {
  const line = currentDialogue(s);
  if (!line || line.continuing || line.choices.length) return null;
  const { person, topic } = s.story.encounter;
  return { ...s, story: { ...s.story, encounter: null, completed: [...s.story.completed, `${person}:${topic}`] } };
}

export function storyEndings(s) {
  const parting = s.story.completed.includes('apprentice:showBird') ? {
    title: '各自的燕子',
    text: '阿禾把自己的燕子夹进账簿，夹在你替她留的空页。走到桥头时她回头喊你，下次见面，两个人都要带一张新画的图。',
  } : {
    title: '窗边的空杯',
    text: '阿禾把两只空茶杯放回窗台。她临走时说，等下一次轮休，她想来绣一只自己画的燕子。',
  };
  const endings = [replies[s.story.reply] || parting];
  if (s.story.memories.includes('invited')) {
    endings.push(s.display ? {
      title: '速写本上的展场',
      text: s.display === 'open'
        ? `程渡带着速写本来赴约。画完展台，他也在${s.taught ? '阿禾' : '你'}身边坐下，绣下了自己的第一针。`
        : '程渡带着速写本来赴约。他把燕子的出处抄在画旁边，又给展签画了一张小小的插图。',
    } : s.fur?.shown ? {
      title: '速写本上的两块试布',
      text: '程渡赴约来到展台。他把两块布画在同一页，还在上层针脚旁留了几道空隙。合上本子前，他请你看这撮猫毛的方向画对了没有。',
    } : s.chapter?.trial || s.chapter?.fair ? {
      title:'程渡留在展台上的纸',
      text:'程渡把你摆出来的练习布画在本子上。边上留了一小截空白，说等下一回再把你们接下来的针补进去。',
    } : {
      title: '带回去的空页',
      text: '程渡带着速写本来了。展台没有摆起来，他就在河边画了几只燕子，把本来留给展台的那一页空着。',
    });
  }
  return endings;
}
