// Shared world coordinates for the drawn floor, doors and collision.
export const streetPath = [[28,100],[197,100],[197,116],[496,116],[496,244],[526,244],[526,300],
  [385,300],[385,316],[28,316],[28,250],[156,250],[156,177],[28,177]];

export const roomFloors = {
  studio: [[24,72],[318,72],[318,96],[516,96],[516,276],[439,276],[439,316],
    [306,316],[306,340],[238,340],[238,316],[54,316],[54,239],[24,239]],
  archive: [[30,73],[511,73],[511,310],[306,310],[306,340],[238,340],[238,310],[30,310]],
  shop: [[24,78],[520,78],[520,316],[306,316],[306,340],[238,340],[238,316],[24,316]],
  river: [[20,106],[442,106],[442,88],[519,88],[519,298],[460,298],[460,318],[306,318],
    [306,340],[238,340],[238,318],[20,318]],
};

export const streetDoors = {
  studio: { x:7, y:5.5, arrival:{ x:7,y:6.5 }, side:'down' },
  archive: { x:25, y:7, arrival:{ x:25,y:8 }, side:'down' },
  shop: { x:5, y:15, arrival:{ x:5,y:16 }, side:'down' },
  river: { x:30, y:17, arrival:{ x:30,y:16 }, side:'up' },
};

const table = (id,x,y,w,h,cloth,kind='table') => ({id,kind,x,y,w,h,cloth});
const plant = (id,x,y,w=13) => ({id,kind:'plant',x,y,w,h:9});
const tree = (id,x,y,w=15) => ({id,kind:'tree',x,y,w,h:10});

export const furniture = {
  lane: [
    table('bench',40,131,41,10,null,'bench'),
    table('tea-stall',220,124,60,13,'#c5a267','stall'),
    table('tea-seat',237,157,27,8,null,'bench'),
    table('crate',48,273,22,12,'#bba178','bench'),
    tree('court-tree',347,176), tree('quay-willow',451,252),
    plant('quay-plant',505,266), table('court-seat',287,237,39,10,null,'bench'),
    table('market-stall',354,260,59,14,'#ad7a77','stall'),
  ],
  studio: [
    table('side',39,143,67,16,'#84978b'),
    table('loom',163,139,164,27,'#dfcaa8'),
    table('loom-stool-left',187,184,15,9,null,'stool'),
    table('loom-stool-right',276,185,15,9,null,'stool'),
    table('thread-bench',399,119,90,18,'#9e837b','bench'),
    table('teaching-table',377,198,89,21,'#8fa796'),
    table('teaching-stool',417,235,18,10,null,'stool'),
    table('entry-bench',77,265,65,12,'#ab8c70','bench'),
    table('sample-cabinet',337,272,62,16,'#829385','bench'),
    plant('plant-left',35,210), plant('plant-right',492,195),
  ],
  archive: [
    table('return-box',44,102,64,15,'#9f8b82'),
    table('desk',205,137,129,24,'#c9b595'),
    table('reading-stool',259,184,18,9,null,'stool'),
    table('sorting',402,106,80,16,'#9aa7a0','bench'),
    table('reference-table',370,216,96,22,'#a7ac96'),
    table('reading-bench',76,233,63,12,null,'bench'),
    plant('plant-left',40,161), plant('plant-right',485,166),
  ],
  shop: [
    table('folds',42,111,83,17,'#ba8d72','bench'),
    table('counter',177,143,190,24,'#caab87'),
    table('stand',407,113,73,20,'#8fa498'),
    table('packing',409,218,70,20,'#c4ab86'),
    table('shop-seat',57,239,62,12,null,'bench'),
    plant('plant-left',34,188), plant('plant-right',490,177),
  ],
  river: [
    table('exhibit',223,145,98,21,'#a78991'),
    table('left-seating',45,205,51,12,null,'bench'),
    table('right-seating',441,213,55,12,null,'bench'),
    table('supplies',375,135,64,17,'#d9c398'),
    table('river-teaching',119,179,62,17,'#8fa99a','stall'),
    table('river-market',399,262,70,15,'#c39a7b','stall'),
    tree('river-tree-left',38,139), tree('river-tree-right',482,128),
    tree('river-tree-lower',62,273), tree('river-tree-corner',491,272),
    plant('river-planter',332,247),
  ],
};

export function footprint(piece) {
  return { x:piece.x+1, y:piece.y+4, w:piece.w-2, h:piece.h+2 };
}
