import { feet } from './map.js';

export const actorHeight = 32;
export const profiles = {
  player: { coat:'#778277', shade:'#505d55', collar:'#ddd1af', hair:'#302c2a', shine:'#5e5149', skin:'#dfc5a5', pants:'#4a4a45', style:'crop', build:.84, stature:1 },
  master: { coat:'#85815a', shade:'#5e6247', collar:'#d4c28e', hair:'#a8a397', shine:'#d7c9b5', skin:'#dbbe9b', pants:'#524d3e', style:'bun', build:.94, stature:.97 },
  apprentice: { coat:'#b27b76', shade:'#865651', collar:'#e8d8b8', hair:'#332b2b', shine:'#654b44', skin:'#ebc6a8', pants:'#51474a', style:'braid', build:.86, stature:.98 },
  shop: { coat:'#9d8796', shade:'#6d6070', collar:'#d8c4b6', hair:'#2c272b', shine:'#554550', skin:'#dfc2a4', pants:'#49434c', style:'bob', glasses:'round', build:.83, stature:1.02 },
  teaSeller: { coat:'#c5a56e', shade:'#947246', collar:'#f3d9a0', hair:'#684739', shine:'#a5846d', skin:'#e0b692', pants:'#6c5040', style:'waves', build:1.03, stature:.94 },
  visitor: { coat:'#688982', shade:'#446962', collar:'#e2d8b8', hair:'#302b28', shine:'#66544a', skin:'#ddba94', pants:'#4b524d', style:'tousle', build:.81, stature:1.02 },
  merchant: { coat:'#88594f', shade:'#63403d', collar:'#dfc8a7', hair:'#3b3030', shine:'#76665f', skin:'#deb897', pants:'#4b4140', style:'slick', build:1.01, stature:1.02 },
  scholar: { coat:'#647e81', shade:'#47626b', collar:'#d2aa65', sleeve:'#caa367', hair:'#584239', shine:'#8a6856', skin:'#e0bb9b', pants:'#4a5054', style:'pony', glasses:'square', build:.86, stature:1.01 },
};

const ink='#211f20';
function shape(c,d,color,width=.65) {
  const path=new Path2D(d);
  c.fillStyle=color; c.fill(path);
  if(width) { c.strokeStyle=ink; c.lineWidth=width; c.stroke(path); }
}
function line(c,d,color=ink,width=.5) {
  c.strokeStyle=color; c.lineWidth=width; c.stroke(new Path2D(d));
}
function ellipse(c,x,y,rx,ry,color,width=0) {
  c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=color; c.fill();
  if(width) { c.lineWidth=width; c.strokeStyle=ink; c.stroke(); }
}

const fringe={
  crop:'M-7.8-17.8C-10-20-10-24-7-26.5Q-4.5-29-1-28.6Q.5-30 2-28.7C7-29 9.6-25 9-21.5Q9.3-19 7.2-17.8L5.8-20Q5.6-21.5 5-23Q3-21.2 .1-21L1-23Q-2-20.5-4.6-20Q-4-21-4-22Q-6-20.5-6-18Q-6.2-16.9-7.8-17.8Z',
  bun:'M-7.5-16.5C-10-19-10-24-6.8-26.5C-3.5-29.7 2.8-29.7 6.5-26C9.3-23.3 9.7-19 7.2-16.3Q5.8-15.5 5.8-18.2L5.8-20Q2-21.4 0-24.7Q-2-21.7-5.8-20Q-5.1-17.4-6.4-16.1Q-7-15.4-7.5-16.5Z',
  braid:'M-7.8-15.9C-10.7-19-10-24.6-6.8-27C-3.8-29.5 2.1-29.8 6.1-27C9.5-24.7 10-21.3 8.6-18Q9.5-16 8-15.7Q6-16.8 6-20.5L3-23.8Q1-21-1.8-20L-.8-21.8Q-3.8-19-5.7-19Q-5-16.6-6-15.7Q-6.8-14.3-7.8-15.9Z',
  bob:'M-7.5-13.9C-9.5-15.8-10-22-7.6-25.6C-5.6-29 1-30.1 5.8-27.3C9.7-24.8 9.7-19.4 8.5-15Q7.8-12.9 5.5-13.6Q4.9-16.8 5-20L3-23.8Q.5-22.1-2-21L-1-22.7Q-3.6-20.4-5.8-20Q-5.6-16.5-5.3-14.2Q-6-13.1-7.5-13.9Z',
  waves:'M-8-14Q-11-15-9.5-19Q-11-22-7.8-24Q-8-28-4-28.4Q-2.8-30 .4-28.9Q3.5-30 5.4-27.8Q9.5-28 9-24.2Q11-22 9.3-18.8Q10.4-14.9 7.4-13.9Q5.5-13.4 5.8-16.6Q7.3-20.2 4.4-23.5Q3.3-25.3 1.6-25.5Q-.2-22.4-3.1-21.7Q-5.8-20.9-6.1-17.1Q-5.7-14.3-8-14Z',
  tousle:'M-8-17Q-10-18.8-8.4-20.6L-10.1-20.4Q-8.7-23-7.7-24L-9-24.8Q-6-28.3-2.8-27.6Q-1-29.4 1.6-29.2L1.2-27.9Q4.9-29.2 7.4-25.7L6.5-25.4Q9.7-24.1 9.3-20.7L7.2-21.7Q8.2-19.6 7.4-17.7L5.8-19Q6-21.2 4.4-23.7Q3.1-21.7 1.8-21.4L2.4-24.7Q-.6-21.9-3.6-20.3L-3-22Q-5.7-19.9-6.4-17.8Z',
  slick:'M-8-18.8Q-10-21.4-7.9-24.9Q-6.4-28.3-2-28.5Q.4-30.2 3-29.4Q8.6-29.5 9.2-25.4Q10.2-21.6 7.3-18.7L6-21.4Q6.7-23.2 5.7-25.5Q4-26 1-24.5Q-2.2-23-4.6-24Q-6.8-22-6-19.6Z',
  pony:'M-7.3-16.7Q-10-19.1-8.8-24.5Q-7.1-28.7-2.5-29Q2.7-30.3 6.4-27Q9.6-24.5 9.1-20.6Q9-17.6 7.1-16.7Q6.2-18.9 6-21.3Q4.2-22.8 1.2-25.6Q.1-23.5-3.5-21.3Q-6.3-19.2-5.8-16.8Z',
};

function hairAccessory(c,p,back=false,side=false) {
  if(p.style==='bun') {
    ellipse(c,-4,-28,3.2,2.45,p.hair,.7);
    line(c,'M-6-28q1-2 4-1',p.shine,.6);
    line(c,'M-8-29L-1-27','#57483e',.8);
  }
  if(p.style==='braid') {
    const bx=side?-5.5:back?-6.5:6.5;
    for(let i=0;i<5;i++) {
      const y=-21+i*1.9;
      shape(c,`M${bx} ${y}q-2.5 .8-1.5 2 1.4 1.5 2.8 .1 1.2-1.2-1.3-2.1Z`,p.hair,.5);
    }
    shape(c,`M${bx-1.5} -11l1.5 1 2-1 .5 2-2.5-.4-1.5 1Z`,'#9d6d65',.5);
  }
  if(p.style==='pony') {
    const x=back?0:-6.3;
    shape(c,`M${x-1.2} -21q5-1 4.1 4.2-.8 2.6-2.6 5.8-2.6-.7-3.4-3.3-.5-3.5 1.9-6.7Z`,p.hair,.7);
    line(c,`M${x-1.9} -16.8q1.8 1.2 3.5 0`,'#cdb68c',1.2);
  }
}

function hairMarks(c,p,side,back) {
  if(p.style==='waves') {
    line(c,'M-7-24q3.6-4.1 6.3-2.5M-7-23q2.2-2.3 4-2M4-26q3 .7 4.1 3','#c1ac94',.66);
    const x=side?-6.5:back?5.7:-6.3, y=-22.8;
    for(const [dx,dy] of [[0,-1.1],[1.1,-.25],[.7,.9],[-.7,.9],[-1.1,-.25]]) ellipse(c,x+dx,y+dy,.67,.72,'#ead09a',.25);
    ellipse(c,x,y,.45,.48,'#ab8956');
  } else if(p.style==='slick') {
    line(c,'M-7.1-23q1.8-3.8 6.9-4.6M-6.2-21.1l2-3.4M6.6-24.2l1.5 3','#c0aea1',.8);
  } else if(p.style==='crop' || p.style==='tousle') {
    line(c,p.style==='crop'?'M.6-28.4q2.6-2.1 4.5-.4':'M-6.7-25.1l3.4-1.3M2.6-27l3.2 1.5',p.shine,.68);
  }
}

function face(c,p,side,back) {
  hairAccessory(c,p,back,side);
  if(back) {
    shape(c,'M-7.8-18C-11-22-8.9-27.5-4-28.3Q.2-30.6 4.2-28C9.8-26.2 10.5-20.5 7.2-16.8Q6-15.5 4.7-16.4Q3.8-14 1.6-15Q0-13.8-2-15.1Q-4.1-14.2-5.1-16Q-7.1-15.4-7.8-18Z',p.hair,.85);
    line(c,'M-6-25q2-2 4-2M-7-21q1 3 3 4M4-18q2-2 2-4',p.shine,.4);
    if(p.style==='bob' || p.style==='waves') shape(c,'M-8-22Q-9.7-16.5-6.8-13.5Q-5.5-12.6-3-14Q0-15.7 3.5-14Q6.2-12.4 7.3-14Q9.5-17.1 8-22L6-20Q0-18-6-20Z',p.hair,.65);
    hairMarks(c,p,false,true);
    return;
  }
  if(side) {
    // The authored profile faces screen-right. Only this drawing is mirrored for left.
    shape(c,'M-5-25Q1-28 5-24Q6-22 6-20Q7.8-18.8 6-18.1C6.1-15.9 4.8-14.1 1.3-14.2Q-3.2-14.3-5.7-18.5Z',p.skin,.75);
    shape(c,'M-7-16.5C-10-18.6-10.1-23.4-7.4-26.3Q-5-29 0-28.7C4.6-29 8.2-25.7 7.6-22Q6.5-21.5 5-22.7L3.9-21.1 2-22Q1.2-19.7-1-18Q-1.2-14.7-3.1-15.5Q-4.8-13.4-7-16.5Z',p.hair,.85);
    line(c,'M-6-25L-3-26 1-26',p.shine,.6);
    ellipse(c,-.6,-18.5,1.2,1.7,p.skin,.5);
    line(c,'M3.3-21.2l2 .2',ink,.65);
    shape(c,'M2.7-20.3q1.3-.35 3 .2-1 1.65-2.6 1Z','#e5ddc9',.35);
    line(c,'M4.4-20.1v.85',ink,.7);
    line(c,'M4.5-16.7h1.3','#725e57',.4);
    if(p.glasses) {
      line(c,'M2.9-20.5q3-1 3 1.2-.2 1.7-2.8.9Z','#b5a17d',.6);
      line(c,'M3-20.1l-2.9-.2','#9a896d',.55);
    }
    if(p.style==='bob' || p.style==='waves') {
      shape(c,'M-8-21Q-9-17-6.8-14.2Q-5-12.8-3.8-14.4Q-2-16.8-2-22Z',p.hair,.65);
    }
    hairMarks(c,p,true,false);
    return;
  }
  ellipse(c,-7.1,-19,1.2,1.6,p.skin,.4);
  ellipse(c,7.1,-19,1.2,1.6,p.skin,.4);
  shape(c,'M-7-24C-4-28 4-28 7-24Q8.3-20.1 6.4-17.8C4.8-13.3-3.9-12.8-6.4-17.4Q-8.3-20.1-7-24Z',p.skin,.7);
  shape(c,fringe[p.style],p.hair,.75);
  line(c,'M-5-25l3-1 2 .2M3-26l2 1',p.shine,.5);
  hairMarks(c,p,false,false);
  for(const sign of [-1,1]) {
    c.save(); c.scale(sign,1);
    line(c,'M1.65-21.8q1.5-.5 3-.15',p.style==='bun'?'#625c50':ink,.5);
    shape(c,'M1.45-20.35q1.8-.55 3.6.1-.9 1.95-3.05 1.1Z','#e7dfc7',.35);
    ellipse(c,3.25,-19.9,.57,.73,ink);
    line(c,'M1.5-20.4q1.8-.5 3.55.1',ink,.6);
    if(p.style==='bun') line(c,'M4.8-18.5l.8 .5M1.8-17.7l1 .1','#927e69',.4);
    if(p.glasses) {
      if(p.glasses==='square') line(c,'M.9-20.8h4.6l-.4 2.3H1.3Z',ink,.65);
      else ellipse(c,3.2,-19.7,2.3,1.65,'#ffffff00',.5);
      line(c,'M.8-19.7h.9','#bca788',.6);
    }
    c.restore();
  }
  line(c,'M-.2-18.6l-.3 .8h.6','#9a816e',.35);
  line(c,'M-1.2-16.6l1.2 .3 1.3-.2','#765d53',.4);
  if(p.style==='waves') {
    line(c,'M-5.7-18.2l1.1 .45M4.7-17.8l1-.55','#bd8268',.56);
  }
}

function clothes(c,id,p,side,back) {
  if(id==='player') {
    line(c,back?'M-2.6-15L2.9-7.6':'M3.2-15L-3.9-7.1','#ab795e',1.2);
    if(!back) {
      line(c,'M2.6-13.7l.85 .4m-.6-.8-.15 1.5','#c77c6c',.62);
      shape(c,side?'M1-10q3.9-.3 4 1v3.1h-4Z':'M-4.7-10q3-.4 3.3 1.1v2.7q-.5 1-3.3.8Z','#a37b58',.52);
    }
  } else if(id==='master') {
    if(!back) {
      line(c,'M-2.8-14.4l-.3 7.4M-2.9-12.6h3.8m-3.8 2.2h3.8','#dac392',.75);
      ellipse(c,side?1:0,-8.5,2.7,2.1,'#a58155',.48);
      ellipse(c,side?1:0,-8.5,2.1,1.5,'#e2d5af');
      line(c,'M-1.4-8.2q1.3-1.8 2.7-.9','#77958f',.45);
    }
  } else if(id==='apprentice') {
    if(!back) {
      shape(c,'M-1.6-14.6L1.5-14.7 1.2-7.1-1.4-7Z','#e5d6b7',.37);
      line(c,'M-2.8-13.5l.4 6.4M2.8-12.5l-.3 5.4','#d6a18f',.65);
    }
    line(c,'M-3.6-7.1q3 .55 6.9 .1','#cb9984',.55);
  } else if(id==='shop'||id==='teaSeller') {
    const apron=id==='shop'?'#49454a':'#956d49';
    shape(c,back?'M-3.5-10.2h7l.5 3.9h-8Z':'M-2.2-12.5h4.4l1.2 5.8q-3.3 .9-6.6 0Z',apron,.6);
    line(c,back?'M-3.6-10.3h7.2m-3.8 0-1 2m1-2 1 2':'M-2-12.4l-.6-2M2-12.4l.6-2M-2.8-8.2h5.6','#c6a984',.5);
    if(!back && id==='shop') shape(c,'M1.5-9q2.4-.8 4.1 .2l-.7 3.1-3.4-.7Z','#c7b8ca',.45);
    if(!back && id==='teaSeller') {
      shape(c,'M-1.9-10.1h3.9l-.65 2.1h-2.5Z','#ece1c6',.45);
      ellipse(c,0,-10.15,2.05,.55,'#ecdbc0',.38);
      line(c,'M-.55-10.8h1.1M-.9-8.85l1.65 .1','#8ba4a0',.43);
    }
  } else {
    const book=id==='visitor'?'#c6a276':id==='merchant'?'#5b483d':'#9c6457';
    if(!back) {
      line(c,'M-3.6-14.7l2.7 1.5 1-1.3 2.7-.5m-4 2.2.5 5.5','#cfb58d',.55);
      shape(c,'M-4.7-10.9l3.4-.65.9 5.1-3.7.6Z',book,.55);
      line(c,'M-4-10.5l2.1-.4m-1.9 1.5 1.2-.3','#eee0ba',.46);
    } else if(id==='scholar') line(c,'M-2.7-15l4.9 8.3','#a77c58',.92);
    if(id==='merchant') line(c,'M-3.8-6.6h7.5','#bc9465',.58);
  }
}

function figure(c,id,direction,step) {
  const p=profiles[id], side=direction==='left'||direction==='right', back=direction==='up';
  const stride=step<0?0:[0,1,0,-1][step];
  c.save();
  if(direction==='left') c.scale(-1,1);
  c.scale(1,p.stature);
  c.save(); c.scale(p.build,1);
  // Legs use the same gait in every view. Screen direction never comes from a camera rotation.
  for(const sign of [-1,1]) {
    const dx=side?sign*stride*1.75:sign*2;
    const lift=Math.max(0,sign*stride);
    shape(c,`M${sign*1.4-1.4} -9L${dx-1.4} ${-2-lift}L${dx+1.25} ${-2-lift}L${sign*1.4+1.5} -9Z`,p.pants,.7);
    shape(c,`M${dx-1.25} ${-2.5-lift}q1.4-.4 2.5 .1l${side?1.3:.4} 1.25q-1.2 .7-${side?3.8:3} .25Z`,'#302c2b',.55);
    line(c,`M${dx-1} ${-.65-lift}h2.1`,'#7f7565',.4);
  }
  c.translate(0,stride?-.55:0);
  const body=side?'M-3-15.5C-1.4-17 1.4-16.8 2.5-14.9Q3.4-12.7 3-10.6Q2.7-8.8 3.2-7.1Q3.5-5.7-.1-5.8Q-3.8-5.6-3.7-7.3Q-3.1-10-3.7-12.1Q-4-14.1-3-15.5Z':
    'M-3.6-15.1C-2-17 2.3-17 3.8-15Q5-13 4.3-10.7Q3.9-9 4.6-7.5Q5.3-5.6 1.8-5.8Q.1-6.1-1.7-5.8Q-5-5.5-4.7-7.5Q-3.9-10-4.5-12.1Q-4.9-14-3.6-15.1Z';
  shape(c,body,p.coat,.85);
  shape(c,side?'M-3-14.5Q-1.8-14-2-12Q-2.7-9-1.8-6.5Q-4-6-3.4-8.8Z':'M-3.5-14.6Q-2.2-14-2.5-11Q-3-8-2-6.4Q-4.8-6.1-4-8.1Z',p.shade,0);
  if(back) {
    line(c,'M-2-10l4 .2',p.shade,.5);
  } else {
    shape(c,'M-2.5-15.6L0-13l2.3-2.6-1.1 3.5H-.5Z',p.collar,.35);
    line(c,'M.3-11.8L.8-7.6',p.shade,.6);
  }
  for(const sign of side?[1]:[-1,1]) {
    const swing=stride*sign, x=sign*(side?2:4.15), hx=x+(side?-swing*2:sign*.25), hy=-8+swing;
    line(c,`M${x} -14Q${x+sign*.8} -11 ${hx} ${hy}`,ink,2.8);
    line(c,`M${x} -14Q${x+sign*.8} -11 ${hx} ${hy}`,p.sleeve||p.coat,1.65);
    line(c,`M${hx-.85} ${hy-.4}h1.7`,p.collar,.63);
    ellipse(c,hx,hy+.7,.9,1.15,p.skin,.45);
  }
  clothes(c,id,p,side,back);
  c.restore();
  c.save();
  c.translate(0,stride?-.55:0);
  c.translate(0,-22); c.scale(1.04,1); c.translate(0,22);
  face(c,p,side,back);
  c.restore();
  c.restore();
}

const sprites=new Map();
export function drawActor(ctx,id,x,y,direction,phase) {
  const step=phase<0?-1:Math.floor(phase*4)%4;
  const key=[id,direction,step].join('/');
  if(!sprites.has(key)) {
    const image=document.createElement('canvas');
    image.width=72; image.height=102;
    const c=image.getContext('2d');
    c.scale(3,3); c.translate(12,32);
    c.lineCap='round'; c.lineJoin='round';
    figure(c,id,direction,step); sprites.set(key,image);
  }
  const at=feet({x,y});
  ellipse(ctx,Math.round(at.x),Math.round(at.y)+.4,5.4,1.55,'#14131362');
  ctx.drawImage(sprites.get(key),Math.round(at.x)-12,Math.round(at.y)-32,24,34);
}

const portraitAtlases = {
  player: { moods:['neutral','focused','warm'], top:0, height:1024 },
  master: { moods:['neutral','thoughtful','proud'], top:0, height:1024 },
  apprentice: { moods:['laugh','shy','warm','hurt'], defaultFrame:2, height:639,
    sheetWidth:1230, cellWidth:417, centers:[335,920,340,925], tops:[0,0,639,639] },
  shop: { moods:['neutral','amused','serious'], top:0, height:1024 },
  teaSeller: { moods:['neutral','laugh','thoughtful'], top:128, height:820 },
  visitor: { moods:['neutral','curious','joy'], top:120, height:876 },
  merchant: { moods:['neutral','skeptical','impressed'], top:24, height:1000 },
  scholar: { moods:['neutral','focused','warm'], top:76, height:928 },
};

export function portrait(id, mood) {
  const atlas = portraitAtlases[id];
  if (!atlas) return null;
  const found = atlas.moods.indexOf(mood);
  const frame = found < 0 ? atlas.defaultFrame ?? 0 : found;
  const { sheetWidth=1536, cellWidth=512, height } = atlas;
  const center = atlas.centers?.[frame] ?? (frame+.5)*cellWidth;
  const top = atlas.tops?.[frame] ?? atlas.top;
  return {
    src:`${import.meta.env.BASE_URL}workshop/portrait-${id}-v2.png`,
    width:100*sheetWidth/cellWidth, center:100*center/sheetWidth,
    offset:100*top/height, ratio:cellWidth/height, mood:atlas.moods[frame],
  };
}
