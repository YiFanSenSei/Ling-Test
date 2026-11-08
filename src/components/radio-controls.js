/** 自绘单选按钮：每组一个 Tab 停靠点，方向键沿用既有点击逻辑。 */
export function initRadioControls(root) {
  const groups = [...root.querySelectorAll('[role="radiogroup"]')];
  const radios = group => [...group.querySelectorAll('[role="radio"]')];
  const available = button => !button.disabled && !button.hidden && button.getAttribute('aria-disabled') !== 'true';
  const sync = group => {
    const buttons = radios(group), enabled = buttons.filter(available);
    const selected = enabled.find(button => button.getAttribute('aria-checked') === 'true') ||
      enabled.find(button => button.tabIndex === 0) || enabled[0];
    buttons.forEach(button => { button.tabIndex = button === selected ? 0 : -1; });
  };
  const onKey = event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const group = event.target.closest('[role="radiogroup"]');
    if (!groups.includes(group) || !event.target.matches('[role="radio"]')) return;
    const buttons = radios(group).filter(available), index = buttons.indexOf(event.target);
    if (index < 0) return;
    let next;
    if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = buttons[(index + 1) % buttons.length];
    if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = buttons[(index - 1 + buttons.length) % buttons.length];
    if (event.key === 'Home') next = buttons[0];
    if (event.key === 'End') next = buttons.at(-1);
    if (!next) return;
    event.preventDefault(); next.focus();
    if (next.getAttribute('aria-checked') !== 'true') next.click();
    sync(group);
  };
  // 恢复草稿、自动换针或切换模式也可能改变选中项与禁用状态。
  const observer = new MutationObserver(records => {
    const changed = new Set(records.filter(record => record.oldValue !== record.target.getAttribute(record.attributeName))
      .map(record => record.target.closest('[role="radiogroup"]')));
    changed.forEach(group => { if (groups.includes(group)) sync(group); });
  });
  groups.forEach(group => {
    sync(group);
    observer.observe(group, { subtree: true, attributes: true, attributeOldValue: true,
      attributeFilter: ['aria-checked', 'disabled', 'aria-disabled', 'hidden'] });
  });
  root.addEventListener('keydown', onKey);
  return () => { observer.disconnect(); root.removeEventListener('keydown', onKey); };
}
