/** 页内阅读导航：保持 hash 路由，滚动后同步当前章节，离页释放监听。 */
export function initReadingNav(root) {
  if (!root) return () => {};
  const buttons = [...root.querySelectorAll('[data-reading-target], [data-toc]')];
  const entries = buttons.map(button => ({ button, target: root.querySelector(`#${button.dataset.readingTarget || button.dataset.toc}`) })).filter(entry => entry.target);
  if (!entries.length) return () => {};
  const header = document.getElementById('site-header');
  const bar = root.querySelector('.project-reading-nav');
  let frame = 0, jumpFrame = 0, barWidth = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    const offset = (header?.getBoundingClientRect().height || 72) + (bar?.getBoundingClientRect().height || 0) + 20;
    root.style.setProperty('--reading-offset', `${offset}px`);
    let current = entries[0];
    for (const entry of entries) if (entry.target.getBoundingClientRect().top <= offset + 8) current = entry;
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2 && entries.at(-1).target.getBoundingClientRect().top < innerHeight) current = entries.at(-1);
    const changed = current.button.getAttribute('aria-current') !== 'location';
    for (const entry of entries) {
      const active = entry === current;
      entry.button.classList.toggle('is-active', active);
      if (active) entry.button.setAttribute('aria-current', 'location'); else entry.button.removeAttribute('aria-current');
    }
    // 手机目录横向排列：章节切换后只滚动目录内部，让当前项始终可见。
    const resized = bar && bar.clientWidth !== barWidth;
    barWidth = bar?.clientWidth || 0;
    if ((changed || resized) && bar && bar.scrollWidth > bar.clientWidth) {
      const bounds = bar.getBoundingClientRect(), button = current.button.getBoundingClientRect();
      const left = button.left < bounds.left + 12 ? button.left - bounds.left - 12
        : button.right > bounds.right - 12 ? button.right - bounds.right + 12 : 0;
      if (left) bar.scrollBy({ left, behavior: 'instant' });
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const onClick = event => {
    const entry = entries.find(item => item.button.contains(event.target));
    if (!entry) return;
    update();
    entry.target.tabIndex = -1;
    entry.target.focus({ preventScroll: true });
    cancelAnimationFrame(jumpFrame);
    // 先让焦点与响应式布局落定，再计算最终位置，避免横竖屏切换时沿用旧坐标。
    jumpFrame = requestAnimationFrame(() => {
      jumpFrame = 0; update();
      const offset = parseFloat(root.style.getPropertyValue('--reading-offset'));
      window.scrollTo({ top: Math.max(0, scrollY + entry.target.getBoundingClientRect().top - offset),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  };
  root.addEventListener('click', onClick);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  if (bar) observer?.observe(bar);
  entries.forEach(({ target }) => target.classList.add('reading-section'));
  update();
  return () => {
    cancelAnimationFrame(frame); cancelAnimationFrame(jumpFrame); observer?.disconnect();
    root.removeEventListener('click', onClick);
    window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
  };
}
