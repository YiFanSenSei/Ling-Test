import { placeFor, places } from './rules.js';
import { furniture, footprint, roomFloors, streetDoors, streetPath } from './layout.js';

export const columns = 34;
export const rows = 22;
export const tile = 16;
export const scale = 3;
export const viewWidth = 416;
export const viewHeight = 264;

export const scenes = {
  lane: { name:'春汛老街', caption:'茶摊 · 石巷 · 河埠', start:{ x:16.5,y:12 }, polygon:streetPath },
  studio: { name:'青梧绣坊', caption:'绣案 · 丝线架 · 传习间', polygon:roomFloors.studio },
  archive: { name:'旧样档案室', caption:'旧样柜 · 口述桌 · 阅览角', polygon:roomFloors.archive },
  shop: { name:'沿河小店', caption:'样品 · 柜台 · 包装桌', polygon:roomFloors.shop },
  river: { name:'河畔展场', caption:'观展台 · 体验区 · 河集空地', polygon:roomFloors.river },
};

const entrances = Object.entries(streetDoors).map(([id, door]) => [
  `to-${id}`, { ...door, name: scenes[id].name, sign: scenes[id].name, to: id },
]);

export function scenePlaces(scene, day = 1) {
  const local = Object.fromEntries(Object.keys(places).map(id=>[id,placeFor(id,day)])
    .filter(([,p])=>p.scene===scene && (p.first||1)<=day));
  if (scene === 'lane') return { ...Object.fromEntries(entrances), ...local };
  return {
    ...local,
    'to-lane': { x:16.5,y:20, side:'up', name:'返回老街', sign:'返回老街', to:'lane' },
  };
}

export function entryPoint(scene, from) {
  if (scene !== 'lane') return { x:16.5,y:18.5 };
  const entrance = entrances.find(([, place]) => place.to === from)?.[1];
  return entrance ? { ...entrance.arrival } : { ...scenes.lane.start };
}

export const feet = ({ x, y }) => ({ x: x * tile + 8, y: y * tile + 13 });
export function cameraAt(point) {
  const {x,y} = feet(point);
  return {
    x:Math.round(Math.min(columns*tile-viewWidth,Math.max(0,x-viewWidth/2))),
    y:Math.round(Math.min(rows*tile-viewHeight,Math.max(0,y-viewHeight/2))),
  };
}
const findPiece = place => place.object && furniture[place.scene].find(piece => piece.id === place.object);

function body(place) {
  const point = feet(place);
  return { x: point.x - 6, y: point.y - 5, w: 12, h: 7 };
}

function inside(x, y, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) result = !result;
  }
  return result;
}

export function walkable(scene, x, y, targets) {
  const p = feet({ x, y });
  if (![-4,4].every(dx => [-3,3].every(dy => inside(p.x+dx,p.y+dy,scenes[scene].polygon)))) return false;
  const hits = rect => p.x + 4 > rect.x && p.x - 4 < rect.x + rect.w && p.y + 3 > rect.y && p.y - 3 < rect.y + rect.h;
  return !furniture[scene].some(piece => hits(footprint(piece))) &&
    !Object.values(targets).some(place => place.npc && hits(body(place)));
}

export function beside(point, place) {
  const p = feet(point), anchor = feet(place);
  if (place.to) {
    const gap = (p.y - anchor.y) * (place.side === 'down' ? 1 : -1);
    return Math.abs(p.x - anchor.x) <= 12 && gap >= 0 && gap <= 20;
  }
  const piece = findPiece(place), rect = piece ? footprint(piece) : body(place);
  if (place.object === 'counter' && p.y < rect.y + rect.h) return false;
  const dx = Math.max(rect.x - p.x, p.x - rect.x - rect.w, 0);
  const dy = Math.max(rect.y - p.y, p.y - rect.y - rect.h, 0);
  return Math.hypot(dx, dy) <= 13;
}

export function clickedPlace(x, y, targets) {
  return Object.entries(targets).find(([, place]) => {
    const p = feet(place), piece = findPiece(place);
    if (piece && x >= piece.x - 2 && x <= piece.x + piece.w + 2 && y >= piece.y - 7 && y <= piece.y + piece.h + 5) return true;
    return (place.npc || place.to) && Math.abs(x - p.x) <= (place.to ? 15 : 12) && y >= p.y - (place.to ? 27 : 43) && y <= p.y + 4;
  })?.[0];
}

export function gridPoint(x, y, origin = { x: 0, y: 0 }) {
  return { x: origin.x + Math.round(((x - 8) / tile - origin.x) * 2) / 2,
    y: origin.y + Math.round(((y - 13) / tile - origin.y) * 2) / 2 };
}

export const directions = { up: [0, -.5], down: [0, .5], left: [-.5, 0], right: [.5, 0] };

export function pathTo(start, reached, canWalk) {
  const queue = [{ ...start, steps: [] }];
  const id = (x, y) => `${Math.round((x-start.x)*2)},${Math.round((y-start.y)*2)}`;
  const seen = new Set([id(start.x,start.y)]);
  for (const point of queue) {
    if (reached(point)) return point.steps;
    for (const [dx, dy] of Object.values(directions)) {
      const x = point.x + dx, y = point.y + dy, key = id(x,y);
      if (seen.has(key) || !canWalk(x, y) || !canWalk(point.x + dx/2, point.y + dy/2)) continue;
      seen.add(key);
      queue.push({ x, y, steps: [...point.steps, { x, y }] });
    }
  }
  return [];
}
