import { onSwiftPart, planSwiftStitch, swiftLimit, swiftParts, swiftPreview } from './swift.js';

const arrows = { ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };

export function bindSwiftInput(root, getDraft, refresh) {
  let gesture = null;
  const board = () => root.querySelector('[data-swift-board]');

  function paintPreview(end, showCursor = false) {
    const draft = getDraft();
    const layer = board()?.querySelector('[data-swift-preview]');
    if (draft && layer) layer.innerHTML = swiftPreview(draft,end,showCursor);
  }

  function update() {
    const draft = getDraft();
    if (draft) paintPreview(draft.cursor,document.activeElement === board());
  }

  function place(draft, end) {
    let placed = false;
    if (draft.marks.length >= swiftLimit) {
      draft.note = '绣布上已经有很多针脚。可以拆掉上一组再试。';
    } else if (!draft.start) {
      if (onSwiftPart(end,draft.part)) {
        draft.start = end;
        draft.note = '';
      } else {
        draft.note = '起针要落在选中的部位里。可以用部位按钮切换。';
      }
    } else {
      const { mark, note } = planSwiftStitch(draft,draft.start,end);
      draft.note = note;
      if (mark) {
        draft.marks.push(mark);
        draft.start = null;
        placed = true;
      }
    }
    refresh(placed);
  }

  function clothPoint(event, svg) {
    const {x,y} = new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [x,y];
  }

  function onDown(event) {
    const svg = event.target.closest('[data-swift-board]');
    const draft = getDraft();
    if (gesture && !gesture.svg.isConnected) gesture = null;
    if (!draft || !svg || gesture || event.button !== 0) return;
    event.preventDefault();
    svg.focus({preventScroll:true});
    const point = clothPoint(event,svg);
    gesture = { id:event.pointerId, svg, point, start:draft.start };
    if (!draft.start && draft.marks.length < swiftLimit && onSwiftPart(point,draft.part)) draft.start = point;
    svg.setPointerCapture(event.pointerId);
    paintPreview(point);
  }

  function onMove(event) {
    if (gesture?.id !== event.pointerId || !gesture.svg.isConnected) return;
    paintPreview(clothPoint(event,gesture.svg));
  }

  function onUp(event) {
    if (gesture?.id !== event.pointerId) return;
    const draft = getDraft();
    const { svg, point, start } = gesture;
    gesture = null;
    if (!draft || !svg.isConnected) return;
    const end = clothPoint(event,svg);
    draft.cursor = onSwiftPart(end,draft.part) ? end : [...swiftParts[draft.part].center];
    const dragged = Math.hypot(end[0]-point[0],end[1]-point[1]) > 3.2;
    if (start || (dragged && draft.start)) place(draft,end);
    else if (!draft.start) place(draft,point);
    else { draft.note = ''; refresh(); }
  }

  function onCancel(event) {
    if (gesture?.id !== event.pointerId) return;
    if (event.type==='lostpointercapture' && event.target!==gesture.svg) return;
    const draft = getDraft();
    if (draft) draft.start = gesture.start;
    gesture = null;
    update();
  }

  function onKey(event) {
    const draft = getDraft();
    if (!draft || event.target !== board() || event.altKey || event.ctrlKey || event.metaKey) return false;
    const direction = arrows[event.key];
    if (direction) {
      const step = event.shiftKey ? 8 : 3;
      draft.cursor = draft.cursor.map((n,i) => Math.max(8,Math.min(i ? 232 : 312,n+step*direction[i])));
      update();
    } else if (event.key === ' ' || event.key === 'Enter') {
      if (!event.repeat) place(draft,draft.cursor);
    } else return false;
    event.preventDefault();
    return true;
  }

  root.addEventListener('pointerdown',onDown);
  root.addEventListener('pointermove',onMove);
  root.addEventListener('pointerup',onUp);
  root.addEventListener('pointercancel',onCancel);
  root.addEventListener('lostpointercapture',onCancel);
  return {
    onKey,
    update,
    dispose() {
      root.removeEventListener('pointerdown',onDown);
      root.removeEventListener('pointermove',onMove);
      root.removeEventListener('pointerup',onUp);
      root.removeEventListener('pointercancel',onCancel);
      root.removeEventListener('lostpointercapture',onCancel);
    },
  };
}
