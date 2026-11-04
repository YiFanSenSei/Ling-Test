/**
 * 开场动效控制器
 *
 * 开场层本身（#intro）写在 index.html 里，样式也内联在 <head>，
 * 因为它必须「有 HTML 就有样式」——主样式表要等这个模块所在的
 * 业务脚本执行后才注入，赶不上第一帧。
 *
 * 这里只做三件事：
 *   1. 拦住开场期间对页面的操作（inert），不让 Tab 键摸到幕布后面；
 *   2. 首屏渲染完成后，按最短展示时长揭幕（动画本身由 CSS 负责）；
 *   3. 观众等不及就让他走：点、按 Esc/Enter、滚轮、触摸滑动，一律算「请进」。
 *
 * 关于节奏：动效约 1.7s 走完（化字—拉线—榫卯推入—朱线合缝—图版小注），
 * 其中小注 1660ms 才淡入落定。最短展示取 1780ms，让最后一批字停稳再揭幕；
 * 数据慢也不让人对着封面干等，上限 5s 之后强制揭幕——下面的内容
 * 自己有加载态与重试入口，不该被一张封面扣住。
 */

const MIN_SHOW = 1780;
const MAX_SHOW = 5000;
/** 揭幕动画（CSS 720ms）之外的兜底移除时间 */
const REMOVE_AFTER = 1400;

export function initIntro() {
  const el = document.getElementById('intro');
  const app = document.getElementById('app');
  if (!el) return { reveal() {}, skip() {} };

  /* 幕布后面这几块要临时退出交互与无障碍树 */
  const locked = [app, document.querySelector('.skip-link')].filter(Boolean);
  const unlock = () => { for (const node of locked) node.inert = false; };

  /* 减少了动态效果的用户：不演，直接进馆。CSS 里同样有 display:none，双保险 */
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.remove();
    unlock();
    return { reveal() {}, skip() {} };
  }

  const t0 = performance.now();
  let finished = false;
  let revealed = false;
  let watchdog = 0;
  let removeTimer = 0;

  function detach() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', skip);
    window.removeEventListener('touchmove', skip);
    el.removeEventListener('click', skip);
    window.clearTimeout(watchdog);
  }

  function remove() {
    // 动画可能被浏览器跳过（例如标签页在后台），所以 animationend 之外还要留一手
    window.clearTimeout(removeTimer);
    el.removeEventListener('animationend', onAnimationEnd);
    el.remove();
  }

  function onAnimationEnd(event) {
    // 子元素和伪元素的动画结束事件也会冒泡，不能据此提前撤掉整张纸。
    if (event.target === el && event.animationName === 'introLift') remove();
  }

  function skip() {
    if (finished) return;
    finished = true;
    detach();
    unlock();
    el.dataset.state = 'out';
    el.addEventListener('animationend', onAnimationEnd);
    removeTimer = setTimeout(remove, REMOVE_AFTER);
  }

  function onKey(event) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      skip();
    }
  }

  for (const node of locked) node.inert = true;
  el.addEventListener('click', skip);
  window.addEventListener('keydown', onKey, true);
  // passive：滚轮不该被拦。观众若在这一秒里滑了一下，就顺势把页面交给他。
  window.addEventListener('wheel', skip, { passive: true });
  window.addEventListener('touchmove', skip, { passive: true });
  watchdog = setTimeout(skip, MAX_SHOW);

  return {
    /** 首屏渲染完成后调用。重复调用无副作用。 */
    reveal() {
      if (revealed) return;
      revealed = true;
      const wait = Math.max(0, MIN_SHOW - (performance.now() - t0));
      setTimeout(skip, wait);
    },
    skip,
  };
}
