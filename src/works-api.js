export const online = () => ['http:', 'https:'].includes(location.protocol);
export async function worksRequest(path, options = {}) {
  const response = await fetch(path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) });
  let value;
  try { value = await response.json(); } catch { throw new Error('当前站点尚未开启作品服务，请使用在线展馆。'); }
  if (!response.ok) throw new Error(value.error || '作品服务暂时不可用');
  return value;
}
