/**
 * 触觉反馈。
 *
 * 只给「落针、咬合、提帘」这类有完成感的动作一记短振，不跟着每帧走——
 * 拖动时格子一格接一格，连续触发会糊成一片嗡嗡声。
 * 两次之间留最小间隔，桌面浏览器通常没有 navigator.vibrate，静默跳过即可。
 */
let lastTick = 0;

/**
 * 只在触屏设备上振。
 *
 * 桌面 Chrome 虽然也暴露 navigator.vibrate，但没有触觉硬件，
 * 强行调用会在控制台留下「user hasn't tapped」的干预日志——
 * 自动化测试会把它当成控制台错误。触屏设备才需要这一下。
 */
function coarsePointer() {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

export function haptic(ms = 6, gap = 55) {
  if (!coarsePointer()) return;
  const now = performance.now();
  if (now - lastTick < gap) return;
  lastTick = now;
  try { navigator.vibrate?.(ms); } catch { /* 权限或策略拒绝时静默 */ }
}
