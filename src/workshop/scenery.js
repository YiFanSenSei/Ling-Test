import { columns, rows, scale, tile } from './map.js';
import { furniture, roomFloors, streetPath } from './layout.js';
import { palette, swiftOutline, swiftParts, swiftSegments } from './swift.js';
import { exclusiveSample } from './economy.js';

const width=columns*tile, height=rows*tile;
const ink='#403b36', pale='#f1e4c8', wood='#b88e67', woodDark='#85644f';
const polygon=points=>'M'+points.map(point=>point.join(' ')).join('L')+'Z';

function brush(ctx) {
  return {
    ctx,
    box(x,y,w,h,color,edge=ink,line=.7) {
      ctx.fillStyle=color; ctx.fillRect(x,y,w,h);
      if(edge) { ctx.strokeStyle=edge; ctx.lineWidth=line; ctx.strokeRect(x,y,w,h); }
    },
    shape(d,color,edge=ink,line=.7) {
      const path=new Path2D(d);
      if(color) { ctx.fillStyle=color; ctx.fill(path); }
      if(edge) { ctx.strokeStyle=edge; ctx.lineWidth=line; ctx.stroke(path); }
    },
    line(d,color=ink,line=.5) {
      ctx.strokeStyle=color; ctx.lineWidth=line; ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.stroke(new Path2D(d));
    },
    oval(x,y,rx,ry,color,edge=ink,line=.6) {
      ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
      ctx.fillStyle=color; ctx.fill();
      if(edge) { ctx.strokeStyle=edge; ctx.lineWidth=line; ctx.stroke(); }
    },
    clip(d,paint) { ctx.save(); ctx.clip(new Path2D(d)); paint(); ctx.restore(); },
    text(text,x,y,size=4,color=ink) {
      ctx.fillStyle=color; ctx.font='600 '+size+'px "Microsoft YaHei",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(text,x,y);
    },
  };
}

function random(seed) {
  return ()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
}

function texture(p,x,y,w,h,seed,density=1) {
  const next=random(seed);
  for(let i=0;i<w*h*density*.18;i++) {
    const a=x+next()*w,b=y+next()*h;
    p.box(a,b,.15+next()*.5,.15+next()*.28,i%3?'#49392c16':'#fff3d938',null);
  }
}

function paper(p,x,y,w=10,h=7,slant=0) {
  p.ctx.save(); p.ctx.translate(x,y); p.ctx.rotate(slant);
  p.shape('M0 1L'+(w-1)+' 0l1 '+h+'L1 '+(h+1)+'Z','#ece3c9',ink,.45);
  for(let i=0;i<3;i++) p.line('M2 '+(2.5+i*1.35)+'h'+(w-4-(i===2?2:0)),'#8e8977',.35);
  p.ctx.restore();
}

function spool(p,x,y,color) {
  p.box(x-2,y,4,5,color,ink,.5);
  p.oval(x,y,2.3,.9,'#d0b994',ink,.45);
  p.oval(x,y+4.6,2.3,.8,'#c5a880',ink,.45);
  p.line('M'+(x-1.4)+' '+(y+1.5)+'h2.8m-2.8 1h2.8m-2.8 1h2.8','#eee0bb7a',.35);
}

function folds(p,x,y,w=13,color='#9cae97') {
  for(let i=0;i<3;i++) {
    p.shape('M'+(x+i*.4)+' '+(y-i*1.4)+'h'+w+'l1 3h-'+(w+1)+'Z',i===1?'#dbbf97':color,ink,.55);
    p.line('M'+(x+2+i*.4)+' '+(y+2-i*1.4)+'h'+(w-3),'#efe3c185',.35);
  }
}

function flower(p,x,y,color='#c27b6d') {
  p.line('M'+x+' '+y+'q-2-5 1-10','#576c4d',.6);
  p.shape('M'+x+' '+(y-3)+'q-5-1-5-4 4 0 5 4','#8f9e70',ink,.35);
  for(const [dx,dy] of [[-1,-11],[1,-11],[-2,-9],[2,-9],[0,-8]]) p.oval(x+dx,y+dy,1.4,1.3,color,ink,.3);
  p.oval(x,y-10,.8,.8,'#e2c179',ink,.3);
}

function plant(p,x,y,w=11) {
  p.oval(x+w/2,y+8,w*.55,2,'#433a3026',null);
  p.shape('M'+x+' '+(y-1)+'h'+w+'l-1.8 8h-'+(w-3.6)+'Z','#b98c73',ink,.8);
  p.oval(x+w/2,y-1,w/2,1.9,'#726651',ink,.6);
  const cx=x+w/2;
  for(const [dx,dy] of [[-5,-8],[1,-11],[6,-7],[-2,-5],[4,-4]]) {
    p.line('M'+cx+' '+y+'Q'+cx+' '+(y+dy*.6)+' '+(cx+dx)+' '+(y+dy),'#5b6d50',.7);
    p.shape('M'+cx+' '+(y-2)+'Q'+(cx+dx-2)+' '+(y+dy-4)+' '+(cx+dx)+' '+(y+dy)+'Q'+(cx+dx+4)+' '+(y+dy+3)+' '+cx+' '+(y-2)+'Z',
      dx<0?'#9cb482':'#7f9b70',ink,.45);
    p.line('M'+cx+' '+(y-2)+'L'+(cx+dx)+' '+(y+dy),'#52694d',.4);
  }
}

function tree(p,x,y,size=1,willow=false) {
  p.ctx.save(); p.ctx.translate(x,y); p.ctx.scale(size,size);
  p.oval(1,4,14,4,'#43534132',null);
  p.shape('M-2 6l1-17-5-8 3-1 4 7 3-9 2 1-3 13 1 14Z','#9e8766',ink,.9);
  p.line('M-.7 4l1-12M2-7l1-8','#685c47',.5);
  p.shape('M-14-14Q-19-17-14-21Q-15-26-9-26Q-10-32-4-31Q0-35 4-31Q10-33 12-27Q17-27 16-22Q22-18 16-14Q13-10 7-13Q3-8-2-12Q-7-9-10-13Z',
    willow?'#9eaf7a':'#91ac7c',ink,1);
  p.shape('M-13-22l4-2 3-5 6 1 5-3 5 4-2 2 4 3-2 2-5-1-3 2-4-3-4 2-4-1Z','#b4c58e',null);
  p.shape('M-11-15l5 1 4-3 4 2 4-2 5 1-2 3-6 2-3-2-5 2-4-3-5 2Z','#748f65',null);
  for(const [a,b] of [[-9,-22],[-3,-27],[4,-25],[10,-21],[-5,-17],[3,-18]]) {
    p.line('M'+a+' '+b+'l1.8-1 2 .4','#647959',.55);
    p.line('M'+(a+1)+' '+(b+1)+'l2 .6','#d4d6a2',.6);
  }
  if(willow) {
    for(let i=0;i<7;i++) {
      const a=-12+i*4;
      p.line('M'+a+' -17q-2 8 .2 '+(9+i%3*2),'#6b885a',.85);
      for(let j=0;j<3;j++) p.shape('M'+(a-.9)+' '+(-14+j*3)+'l-2 3 2-.8 1.4-2.5Z','#a1b67b',ink,.3);
    }
  }
  p.ctx.restore();
}

function windowAt(p,x,y,w=30,h=19) {
  p.box(x-1.7,y-1.6,w+3.4,h+3.4,'#9e8266',ink,.9);
  p.box(x,y,w,h,'#a4c4bf',ink,.75);
  p.shape('M'+x+' '+(y+h*.65)+'l'+w+' '+(-h*.35)+'v'+h*.7+'h-'+w+'Z','#7fa39b',null);
  for(let i=1;i<4;i++) {
    p.box(x+i*w/4-.55,y,1.1,h,'#b19a79',ink,.35);
  }
  p.box(x,y+h*.48,w,1,'#b49d7e',ink,.35);
  p.box(x-2.4,y+h+1,w+4.8,2,'#c9b18d',ink,.6);
  p.line('M'+(x+3)+' '+(y+3)+'l3-1m2 0 3-1','#eff3dba8',.6);
  if(w>=30) {
    p.line('M'+(x-4)+' '+(y-2.5)+'h'+(w+8),woodDark,1);
    for(const side of [0,1]) {
      const a=x+side*w, sign=side?-1:1;
      p.shape('M'+(a-sign*2)+' '+(y-2)+'h'+(sign*9)+'q'+(-sign*2)+' 7 '+(-sign*5)+' 11l'+(sign*3)+' '+(h-8)+'q'+(-sign*4)+' 2 '+(-sign*7)+' .1Z',
        '#e3cdb0',ink,.55);
      p.line('M'+(a+sign*1.5)+' '+y+'q'+(sign*2)+' 5 0 9m0 2v'+(h-11),'#ad977b',.4);
      p.line('M'+(a-sign*1)+' '+(y+9)+'l'+(sign*4)+' .5','#9c8266',.8);
    }
  }
}

function lantern(p,x,y) {
  p.line('M'+x+' '+(y-6)+'v4',ink,.75);
  p.shape('M'+(x-3)+' '+(y-2)+'q3-1 6 0l1 2-1 5q-3 1-6 0l-1-5Z','#c58b69',ink,.7);
  p.line('M'+(x-1)+' '+(y-1)+'q-1 2 0 5m2-5q1 2 0 5','#e4b58a',.7);
  p.line('M'+(x-2.5)+' '+(y+4.5)+'h5M'+x+' '+(y+5)+'v2.5',ink,.55);
}

function rug(p,x,y,w,h,tone='#9cae9d') {
  p.shape('M'+x+' '+y+'l'+(w-1)+' -.5 1 '+h+'-'+w+' .5Z',tone,ink,.65);
  p.box(x+2.5,y+2.5,w-5,h-5,'#ffffff00','#d9c9a6',.85);
  p.box(x+4.5,y+4.5,w-9,h-9,'#ffffff00','#5b756457',.45);
  for(let i=3;i<w-2;i+=2) p.line('M'+(x+i)+' '+(y+h)+'v1.8','#b4a787',.45);
  for(let j=10;j<h-5;j+=10) p.line('M'+(x+w/2-3)+' '+(y+j)+'l3-2 3 2-3 2Z','#ddd0af',.5);
  texture(p,x,y,w,h,32,.5);
}

function table(p,piece) {
  const {x,y,w,h,kind,cloth}=piece;
  const leg=kind==='stool'?4:kind==='bench'?5:8;
  p.oval(x+w/2,y+h+leg*.7,w*.54,3,'#493c3029',null);
  for(const a of [x+2,x+w-5]) {
    p.shape('M'+a+' '+(y+h-3)+'h3l-.4 '+leg+'h-2.3Z',woodDark,ink,.65);
    p.line('M'+(a+.9)+' '+(y+h)+'v'+(leg-4),'#b49571',.4);
  }
  p.shape('M'+x+' '+(y-.5)+'q'+w*.48+' -.7 '+w+' .1l-.4 '+h+'q-'+w*.5+' .8-'+(w-.8)+' 0Z',wood,ink,.95);
  p.box(x+.4,y+h-3,w-.8,3.5,'#997355',ink,.65);
  p.line('M'+(x+2)+' '+(y+.6)+'h'+(w-4),'#e5c29a',.6);
  for(let i=5;i<w-4;i+=13) p.line('M'+(x+i)+' '+(y+h*.5)+'q3-.8 8-.3','#8b694d',.4);
  if(cloth) {
    p.shape('M'+(x+5)+' '+(y+1.3)+'h'+(w-10)+'l.5 '+(h-1)+'-3-.8-3 .6-4-.5h-'+(w-20)+'Z',cloth,ink,.45);
    p.line('M'+(x+6.5)+' '+(y+3)+'h'+(w-13),'#eee0bfad',.6);
    p.line('M'+(x+7)+' '+(y+h-2)+'h'+(w-14),'#544b403f',.4);
  }
}

function hoop(p,x,y,rx=12,ry=7) {
  p.oval(x,y,rx,ry,'#b08b5d',ink,.6);
  p.oval(x,y,rx-1.2,ry-1.1,'#eee3c4','#8b7857',.5);
  p.shape('M'+(x-rx*.5)+' '+(y+1)+'l'+rx*.5+' -1-'+rx*.3+' -4 '+rx*.53+' 3 '+rx*.45+' -1.4 1.5 .8-2.8 1.4-'+rx*.42+' 3.2Z','#638479',null);
  p.line('M'+(x-rx*.4)+' '+(y+2)+'q5 1 9-2','#a6b193',.4);
  p.box(x-1.5,y-ry-1,3,1.4,'#bda77e',ink,.4);
}

function furnish(p,piece) {
  const {x,y,w,h,kind,id,cloth}=piece;
  if(kind==='tree') { tree(p,x+w/2,y+3,1.12,id.startsWith('river') || id.endsWith('willow')); return; }
  if(kind==='plant') { plant(p,x,y,w); return; }
  table(p,piece);
  if(kind==='stall') {
    for(const a of [x+1,x+w-2]) p.box(a,y-26,1.7,31,'#a9845e',ink,.55);
    p.shape('M'+(x-3)+' '+(y-23)+'l7-8h'+(w-9)+'l9 8-1 6h-'+(w+5)+'Z',cloth,ink,.8);
    for(let a=x+3;a<x+w-5;a+=12) p.shape('M'+a+' '+(y-30)+'h5l2 12h-6Z','#e9d0a3',null);
    p.line('M'+(x-2)+' '+(y-17)+'h'+(w+4),ink,.6);
    paper(p,x+6,y+3,10,6,-.1);
    const title=id==='tea-stall'?'春 茶':id==='river-teaching'?'传 习':id==='river-market'?'河 集':'布 样';
    p.box(x+w/2-13,y-26,26,6.5,'#e8d5a9',ink,.5);
    p.text(title,x+w/2,y-22.7,3.65);
    for(let i=0;i<4;i++) {
      if(id==='tea-stall') p.oval(x+w-7-i*6,y+5+(i%2),2.25,1.65,'#ddd9bd',ink,.45);
      else spool(p,x+w-9-i*6,y+3,['#a77d72','#789183','#ae996d','#90949e'][i]);
    }
  }
  if(id==='loom') {
    hoop(p,x+w*.5,y+h*.47,19,8);
    paper(p,x+8,y+5,13,8,-.1);
    for(let i=0;i<4;i++) spool(p,x+w-26+i*5,y+5+(i%2)*2,['#ab6e68','#769786','#c3a26d','#8c8396'][i]);
    p.line('M'+(x+w*.65)+' '+(y+9)+'q7-5 9 2t9-2','#ab6e68',.5);
    p.line('M'+(x+27)+' '+(y+11)+'l7 3m-6-1 6-3','#464b48',.55);
    p.oval(x+27,y+11,1.4,1,'#ffffff00',ink,.5);
    p.oval(x+28,y+13,1.3,1,'#ffffff00',ink,.5);
    p.line('M'+(x+w-22)+' '+(y+16)+'q-6 3-10-.4t-8 .6','#ad736b',.45);
  } else if(id==='desk') {
    paper(p,x+9,y+4,16,11,.06);
    paper(p,x+34,y+5,20,12,-.05);
    p.box(x+w-16,y+5,6,5,'#6b6a5e',ink,.55);
    p.oval(x+w-13,y+7,1.5,1,'#383934',ink,.35);
    p.line('M'+(x+w-24)+' '+(y+15)+'l14-3',ink,.7);
    p.line('M'+(x+36)+' '+(y+5)+'v11','#ab9e7f',.5);
  } else if(id==='exhibit') {
    hoop(p,x+w*.53,y+8,9,5);
    p.box(x+5,y+1,14,9,'#b79f78',ink,.6);
    p.box(x+6,y+2,12,6,'#e8ddbc',ink,.35);
    p.line('M'+(x+8)+' '+(y+4)+'h8m-8 2h6','#867a61',.5);
    paper(p,x+w-18,y+6,12,8,.05);
  } else if(['counter','folds','stand','sample-cabinet'].includes(id)) {
    for(let i=0;i<Math.floor(w/20);i++) folds(p,x+7+i*20,y+5,12,['#a7b3a0','#bb8a7d','#a3a4b6','#c9b07e'][i%4]);
  } else if(['thread-bench','supplies'].includes(id)) {
    for(let i=0;i<Math.floor(w/7);i++) spool(p,x+5+i*6,y+3,['#a97870','#79937e','#c6a56b','#938095'][i%4]);
  } else if(['sorting','return-box','side','reference-table','packing','teaching-table'].includes(id)) {
    paper(p,x+6,y+3,13,7,.07);
    folds(p,x+w-16,y+4,10,'#a6b6a3');
  }
  if(['side','desk','stand','supplies'].includes(id)) {
    const a=x+w-7,b=y+h-5;
    p.oval(a,b+1,3,1.2,'#d9c9a9',ink,.4);
    p.shape('M'+(a-1.7)+' '+(b-3)+'h3.4v3q-1.7 1-3.4 0Z','#cad3bc',ink,.5);
    p.oval(a,b-3,1.7,.65,'#79785c',ink,.35);
    p.line('M'+(a+1.7)+' '+(b-2)+'q2.5-.8 2 1-1 1.4-2 .4',ink,.45);
  }
}

function floorboards(p,d,colors) {
  p.shape(d,colors[0],null);
  p.clip(d,()=>{
    const next=random(354);
    for(let y=0,row=0;y<height;y+=7,row++) {
      for(let x=-40+(row%3)*16;x<width;x+=47) {
        p.shape('M'+x+' '+y+'h47v7h-47Z',colors[(row+Math.floor(next()*4))%colors.length],'#665947',.45);
        p.line('M'+(x+1)+' '+(y+1)+'h45','#ead5ac9c',.4);
        for(let i=0;i<3;i++) {
          const a=x+3+next()*30,b=y+2+next()*3;
          p.line('M'+a+' '+b+'q4-.6 9 0','#78624a56',.32);
        }
        if(next()>.7) p.oval(x+30,y+4.3,2,.5,'#ad93714d','#78624a65',.28);
      }
    }
    texture(p,0,0,width,height,74,1.4);
  });
}

function stone(p,d) {
  p.shape(d,'#adaf9d',ink,.65);
  p.clip(d,()=>{
    const next=random(897);
    for(let y=0,row=0;y<height;y+=9,row++) {
      for(let x=-22+row%2*12;x<width;x+=24) {
        p.shape('M'+(x+1)+' '+(y+.8)+'l21-.2 .7 6.8-1.1 .7-20.8-.2Z',
          ['#cac5ae','#c4c2ad','#d2cbb4','#babda9'][Math.floor(next()*4)],'#767c69',.5);
        p.line('M'+(x+3)+' '+(y+2)+'h17','#f4e9cd94',.45);
        if(next()>.67) p.line('M'+(x+4)+' '+(y+7)+'l3-.8 2 .2','#8d9b77',.6);
      }
    }
    texture(p,0,0,width,height,657,1.7);
  });
}

function grass(p,d,seed=99) {
  p.shape(d,'#b2c08e',ink,.7);
  p.clip(d,()=>{
    const next=random(seed);
    for(let i=0;i<700;i++) {
      const x=next()*width,y=next()*height;
      p.line('M'+x+' '+y+'l-.5-1.2m.6 1.2 .7-1.5',i%3?'#7f97636b':'#e3d7a6b0',.4);
    }
    texture(p,0,0,width,height,seed,1.1);
  });
}

function water(p,d) {
  p.shape(d,'#90bcb6',ink,.8);
  p.clip(d,()=>{
    const next=random(729);
    for(let i=0;i<260;i++) {
      const x=next()*width,y=next()*height,l=3+next()*16;
      p.line('M'+x+' '+y+'q'+l*.5+' -.65 '+l+' 0',i%3?'#d1e1cb7c':'#668f8b68',.45);
    }
    texture(p,0,0,width,height,88,.8);
  });
}

function shelf(p,x,y,w,kind='silk') {
  p.box(x,y,w,26,'#a58c6d',ink,.9);
  p.box(x+2,y+2,w-4,21,'#776a56',ink,.55);
  for(const yy of [y+11,y+23]) {
    p.box(x+.7,yy,w-1.4,2,'#b89e79',ink,.55);
    for(let i=0;i<Math.floor((w-5)/6);i++) {
      const a=x+4+i*6,b=yy-6+(i%3===0?.6:0);
      if(kind==='books') {
        p.box(a,b-1-i%2,3.5,7+i%2,['#a79d80','#a88b7b','#939f91'][i%3],ink,.45);
        p.line('M'+(a+.8)+' '+(b+1)+'h1.8m-1.8 3h1.8','#d8c7a4',.45);
      } else if(kind==='cloth') {
        if(i%2===0) folds(p,a-1,b+2,8,['#9ba992','#ad8980','#9997a5'][i%3]);
      } else if(i%5===3) {
        folds(p,a-.5,b+2,6,['#c6b48c','#a39b9d'][i%2]);
      } else spool(p,a+1,b,['#bc8a7c','#8b9d84','#c3ac72','#9396a2'][i%4]);
    }
  }
}

function wall(p,x,y,w,h=30) {
  p.box(x,y,w,h,'#e3d7b8',ink,.9);
  p.box(x+.5,y+h-7,w-1,7,'#c4b796',ink,.65);
  p.box(x-.6,y-2.3,w+1.2,3.5,'#f1e5c6',ink,.75);
  p.line('M'+(x+1)+' '+(y+h-1)+'h'+(w-2),ink,1.1);
  texture(p,x+1,y+2,w-2,h-4,338,.9);
  for(let a=x+11;a<x+w-8;a+=31) {
    p.line('M'+a+' '+(y+h-5)+'h4m9-1h3','#9c937955',.45);
  }
}

function hanging(p,x,y,w=12,h=18,color='#a4b4a1') {
  p.box(x,y,w,h,color,ink,.55);
  p.line('M'+(x-1)+' '+y+'h'+(w+2)+'M'+(x-.6)+' '+(y+h)+'h'+(w+1.2),woodDark,1.1);
  p.box(x+1.5,y+1.5,w-3,h-3,'#ffffff00','#e9dcc1',.5);
  p.line('M'+(x+3)+' '+(y+h-5)+'q5-3 5-8m-3 6-2-2m3 0 3-1','#6d8067',.65);
  for(const [dx,dy] of [[3,h-8],[7,h-12],[5,h-5]]) {
    p.shape('M'+(x+dx)+' '+(y+dy)+'q-3-3-3-1t3 1m0 0q3-3 3-1t-3 1','#b57d6d','#8f7562',.3);
  }
}

function wallNotes(p,x,y) {
  p.shape('M'+x+' '+y+'l17 .4-.2 14-17-.6Z','#ab8d6b',ink,.7);
  paper(p,x+2,y+2,6,8,-.08);
  paper(p,x+9,y+4,6,7,.13);
  p.oval(x+4,y+2.5,.5,.5,'#9d6659',ink,.25);
  p.oval(x+12,y+4.5,.5,.5,'#9d6659',ink,.25);
}

function room(p,scene) {
  p.box(0,0,width,height,'#768476',null);
  texture(p,0,0,width,height,171,.42);
  const points=roomFloors[scene], d=polygon(points);
  const studio=scene==='studio', archive=scene==='archive';
  const back=studio?72:archive?73:78, left=points[0][0], right=points[1][0];
  floorboards(p,d,archive?['#c5b69a','#cebea1','#c1b297','#d4c4a6']:
    ['#d4bd96','#dcc7a2','#d0b791','#ddcba8']);
  const edges=points.map((point,i)=>[point,points[(i+1)%points.length]]);
  for(const [[x,y],[a,b]] of edges) {
    if(y===340 && b===340) continue;
    p.line('M'+x+' '+y+'L'+a+' '+b,'#534d3e',4.5);
    p.line('M'+x+' '+y+'L'+a+' '+b,'#e3d4b0',2.4);
  }
  wall(p,left,back-41,right-left,41);
  p.box(240,334,64,4,'#b6a385',ink,.65);
  p.line('M242 331h60M242 336h60','#ecdbb7',.65);
  rug(p,246,268,51,65,archive?'#aba58e':'#9bad99');
  if(studio) {
    wall(p,318,56,198,40);
    windowAt(p,46,42,47,21); windowAt(p,244,42,45,21); windowAt(p,454,65,42,22);
    shelf(p,115,41,92); shelf(p,337,65,88);
    hanging(p,216,42,15,22,'#91ab98'); hanging(p,435,65,10,23,'#bf998c');
    wallNotes(p,68,93); wallNotes(p,213,91);
    rug(p,150,131,190,82,'#b5a287'); rug(p,357,183,133,78,'#97af9c');
    rug(p,61,253,99,41,'#baa98f');
    p.text('传 习 间',417,106,6,'#6b755c');
  } else if(archive) {
    windowAt(p,230,42,75,21);
    shelf(p,43,43,78,'books'); shelf(p,133,43,77,'books');
    shelf(p,326,43,74,'books'); shelf(p,414,43,82,'books');
    hanging(p,310,44,11,19,'#c4a18a');
    rug(p,185,126,173,86,'#a0b3a8'); rug(p,350,202,132,65,'#a9b09d');
    rug(p,56,211,111,67,'#baa48c');
    p.oval(267,35,5.8,5.8,'#f0e5c8','#6b5f49',.8);
    p.line('M267 31v4l2.5 1',ink,.65);
    p.text('旧 样 阅 览',418,199,6,'#746a56');
  } else {
    windowAt(p,42,44,52,24); windowAt(p,437,44,53,24);
    shelf(p,120,48,81,'cloth'); shelf(p,343,48,72,'cloth');
    p.box(228,50,87,14,'#c99e83',ink,.7);
    p.box(231,52,81,10,'#edd3a8',ink,.45);
    p.text('沿 河 绸 样',271,57,6.2,'#634c41');
    hanging(p,103,47,10,22,'#b98e86'); hanging(p,421,47,10,22,'#91a59d');
    rug(p,154,171,235,61,'#bd9e92'); rug(p,391,206,104,64,'#a9ae93');
    rug(p,44,222,104,54,'#afae99');
  }
  for(const x of [left+9,right-10]) lantern(p,x,back-18);
  p.clip(d,()=>{
    for(const [x,y,w] of studio?[[46,72,47],[454,96,42]]:archive?[[230,73,75]]:[[42,78,52],[437,78,53]]) {
      p.shape('M'+x+' '+y+'h'+w+'l34 80h-'+(w+19)+'Z','#fff2b84a',null);
      for(let i=1;i<4;i++) p.line('M'+(x+i*w/4)+' '+y+'l25 80','#8f83671e',.75);
    }
  });
}

function cottage(p,x,y,w,h,color='#8b9c92',shop=false) {
  p.box(x+2,y+h,w-4,3,'#4d493b30',null);
  p.box(x+3,y+18,w-6,h-18,'#e4d5b6',ink,1);
  p.box(x+3,y+h-5,w-6,5,'#b9b39c',ink,.6);
  p.shape('M'+(x-2)+' '+(y+19)+'l8-18h'+(w-12)+'l8 18-1 3h-'+(w+2)+'Z',color,ink,1);
  for(let row=0;row<4;row++) {
    const yy=y+3+row*4;
    p.line('M'+(x+5-row*1.6)+' '+yy+'h'+(w-10+row*3.2),'#435951',.6);
    for(let a=x+8+row%2*3;a<x+w-5;a+=6) p.line('M'+a+' '+yy+'l-.7 3.3','#d8d7b65c',.45);
  }
  p.line('M'+(x-1)+' '+(y+20)+'h'+(w+2),'#c7c6a1',.6);
  p.box(x+w/2-8,y+h-22,16,21,'#617f74',ink,.85);
  p.box(x+w/2-6.5,y+h-20,13,8,'#b7c4ac',ink,.5);
  p.line('M'+(x+w/2)+' '+(y+h-21)+'v20M'+(x+w/2-7)+' '+(y+h-11)+'h14',ink,.6);
  if(w>=65) {
    for(const a of [x+8,x+w-24]) windowAt(p,a,y+h-22,16,12);
  } else {
    p.line('M'+(x+6)+' '+(y+h-11)+'v8m'+(w-12)+'-8v8','#9e8b6f',.8);
  }
  p.oval(x+w/2+3,y+h-8,.6,.7,'#d6bc7c',ink,.35);
  p.box(x+w/2-11,y+h,22,2.3,'#bdb797',ink,.55);
  p.box(x+w/2-13,y+h+2.3,26,2.2,'#d4c8a7',ink,.55);
  texture(p,x+4,y+21,w-8,h-23,211,.9);
  if(shop) {
    p.shape('M'+(x+3)+' '+(y+h-25)+'h'+(w-6)+'l3 8h-'+w+'Z','#c39380',ink,.65);
    for(let a=x+6;a<x+w-3;a+=10) p.shape('M'+a+' '+(y+h-25)+'h5l1.3 8h-6.5Z','#e1c29f',null);
    p.line('M'+(x+3)+' '+(y+h-17)+'h'+(w-6),ink,.7);
  } else lantern(p,x+w/2+12,y+h-19);
}

function boat(p,x,y) {
  p.shape('M'+x+' '+y+'q18 6 35 0l-4 6q-15 5-28-1Z','#a98b65',ink,.8);
  p.shape('M'+(x+3)+' '+(y+1)+'q14 3 28 0l-3 3q-13 2-22-.7Z','#6f6d54',ink,.55);
  p.shape('M'+(x+9)+' '+(y+2)+'q-1-13 8-13t9 13Z','#d0b28b',ink,.65);
  for(let i=0;i<3;i++) p.line('M'+(x+12+i*4)+' '+(y+1)+'q-2-8 2-11','#89795b',.45);
  p.line('M'+(x+27)+' '+(y+2)+'l12 5',woodDark,.9);
}

function street(p) {
  water(p,'M0 0H544V352H0Z');
  const bank='M0 0H533V129Q521 167 525 221L539 262V311Q510 332 453 327L404 324Q326 349 237 336H29L0 310Z';
  grass(p,bank);
  p.line('M0 310L29 336H237Q326 349 404 324L453 327Q510 332 539 311','#58715c',3.4);
  p.line('M2 309L29 333H237Q326 346 404 321L453 324Q510 329 536 310','#eee0b7',1.4);
  stone(p,polygon(streetPath));
  p.shape('M315 167Q356 145 394 172L390 204Q354 222 312 201Z','#aac391','#7f9772',.85);
  p.shape('M317 173Q351 156 386 174L384 200Q354 212 319 198Z','#bed0a0',null);
  for(const [x,y,s] of [[23,94,1.14],[198,87,1.2],[316,78,1.14],[478,92,1.2],[507,208,1.15],[18,230,1.05],[146,224,.85],[205,326,1.05],[319,318,.86]]) tree(p,x,y,s,x>465);
  cottage(p,54,34,132,61,'#78978e');
  cottage(p,211,51,78,51,'#99a68d');
  cottage(p,351,55,114,59,'#809a96');
  cottage(p,31,185,114,58,'#8f959d',true);
  p.box(98,58,43,9,'#dcc394',ink,.65); p.text('青梧绣坊',120,62.5,4.7);
  p.box(388,77,40,8,'#ddc09a',ink,.6); p.text('旧样档案',408,81,4.4);
  p.box(72,203,32,7,'#ead1a7',ink,.6); p.text('沿河小店',88,206.5,3.8);
  for(const [x,y] of [[44,98],[182,96],[204,110],[345,116],[468,116],[20,249],[145,249]]) plant(p,x,y,10);
  p.box(457,278,67,22,'#b09a76',ink,1.1);
  for(let y=280;y<300;y+=3) p.line('M459 '+y+'h63','#786c51',.55);
  for(const x of [460,520]) {
    p.box(x,271,2.1,23,'#a88b67',ink,.65);
    p.oval(x+1,271,1.9,1,'#d4bb8c',ink,.45);
  }
  p.line('M462 276Q492 282 521 276','#e1d3a4',1.2);
  boat(p,471,333); boat(p,495,155);
  for(const [x,y] of [[203,109],[298,112],[314,200],[377,206],[476,238],[184,313],[340,323],[432,317]]) {
    for(let i=0;i<4;i++) flower(p,x+i*3.5,y+(i%2)*3,i%2?'#dbaf73':'#bd8580');
  }
  p.line('M194 71Q262 78 334 70','#6c694f',.8);
  for(let i=0;i<5;i++) {
    const x=202+i*24,y=73+(i===2?2:0);
    p.shape('M'+x+' '+y+'l13 .6-.6 16-4 .5-3-.6-5 .3Z',['#d3b696','#a6bea6','#e2cb9d','#c5a4a5','#d5c3a4'][i],ink,.5);
    p.line('M'+(x+2)+' '+(y-1)+'v3m7-2v2','#726445',.65);
  }
}

function riverside(p) {
  water(p,'M0 0H544V352H0Z');
  const bank='M0 91Q106 80 214 91T436 89Q481 68 544 74V352H0Z';
  grass(p,bank,832);
  p.line('M0 91Q106 80 214 91T436 89Q481 68 544 74','#59755f',3.4);
  p.line('M0 89Q106 78 214 89T436 87Q481 66 544 72','#e9dbb0',1.2);
  stone(p,'M21 108H439L442 90H517V295H460V318H306V340H238V318H21Z');
  p.shape('M99 170h103v63H99Z','#b7c8a4','#78927b',.8);
  p.shape('M353 242h135v51H353Z','#c8b693','#a69375',.8);
  rug(p,208,175,131,49,'#a4bba6'); rug(p,243,285,57,50,'#bda789');
  for(let x=14;x<528;x+=17) {
    const y=x>442?82:93;
    p.box(x,y,1.7,12,'#ac9270',ink,.5);
    p.box(x-.5,y-1,2.7,2,'#cfb694',ink,.4);
    if(x<422 || x>451) p.box(x,y+4,17,1.9,'#bea27b',ink,.45);
  }
  p.box(188,109,3,34,'#ab8a63',ink,.7); p.box(354,109,3,34,'#ab8a63',ink,.7);
  p.shape('M176 108L192 94H351L368 108V117H176Z','#b98375',ink,1);
  for(let x=185;x<363;x+=15) p.shape('M'+x+' 99h7l5 18h-9Z','#ead0a1',null);
  p.line('M177 117h190',ink,.7);
  lantern(p,200,125); lantern(p,344,125);
  p.box(244,104,55,9,'#eddbac',ink,.6); p.text('河 畔 展 台',271,108.5,5.1);
  boat(p,367,45); boat(p,69,40); boat(p,476,34);
  for(const [x,y] of [[95,115],[526,107],[15,300],[515,297],[175,324],[369,313]]) {
    tree(p,x,y,.88,true);
    for(let i=0;i<4;i++) flower(p,x-9+i*4,y+8+(i%2)*3,i%2?'#d9b47d':'#c68f8d');
  }
  for(const x of [80,463]) {
    p.box(x,157,2.1,27,'#a48763',ink,.6);
    p.line('M'+x+' 158h10',ink,.95); lantern(p,x+9,166);
  }
}

function propLayer(piece) {
  const left=piece.x-20, top=piece.y-38,w=piece.w+40,h=piece.h+54;
  const canvas=document.createElement('canvas');
  canvas.width=w*scale; canvas.height=h*scale;
  const ctx=canvas.getContext('2d'); ctx.scale(scale,scale); ctx.translate(-left,-top);
  furnish(brush(ctx),piece);
  return {image:canvas,x:left,y:top,w,h,depth:piece.y+piece.h+4,id:piece.id,piece};
}

export function makeScenery(scene) {
  const image=document.createElement('canvas');
  image.width=width*scale; image.height=height*scale;
  const ctx=image.getContext('2d'); ctx.scale(scale,scale);
  const p=brush(ctx);
  if(scene==='lane') street(p);
  else if(scene==='river') riverside(p);
  else room(p,scene);
  return {image,props:furniture[scene].map(propLayer)};
}

const swiftExhibits = new WeakMap();
function swiftExhibit(marks) {
  if (swiftExhibits.has(marks)) return swiftExhibits.get(marks);
  const image=document.createElement('canvas');
  image.width=320; image.height=240;
  const p=brush(image.getContext('2d'));
  for (const [i,part] of swiftParts.entries()) {
    const outline=swiftOutline(part);
    p.shape(outline,part.tint,null);
    p.clip(outline,() => {
      for (const mark of marks) {
        if (mark.part !== i) continue;
        const path=swiftSegments(mark).map(([a,b]) => `M${a.join(' ')}L${b.join(' ')}`).join('');
        p.line(path,palette[mark.color][1],mark.weight ? 4 : 2.6);
      }
    });
  }
  swiftExhibits.set(marks,image);
  return image;
}

export function drawExhibit(ctx,piece,state) {
  const p=brush(ctx),x=piece.x+piece.w*.53,y=piece.y+8;
  const original = state.display && !(exclusiveSample(state) && state.day<=13);
  if (original) {
    const color=palette[state.swift[0]?.color ?? state.stitches[0]][1];
    hoop(p,x,y,9,5);
    if (state.swift.length) ctx.drawImage(swiftExhibit(state.swift),x-7,y-3.5,14,8.4);
    else p.line('M'+(x-4)+' '+(y+1)+'l6-3 2 1-4 3Z',color,.8);
    if(state.display==='archive') paper(p,piece.x+4,piece.y+2,14,10);
    else spool(p,piece.x+piece.w-8,piece.y+4,color);
  }
  if (state.fur.shown) {
    const left=original ? piece.x+48 : piece.x+25;
    for (const offset of [0,10]) {
      const cx=left+offset;
      hoop(p,cx,y+2,4.3,3.4);
      p.line(`M${cx-2.4} ${y+2}l3 -1m-2 2l3 -1`,'#f8ecd3',.7);
    }
    if (!original) paper(p,piece.x+6,piece.y+3,12,8);
  }
}
