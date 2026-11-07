export const online = () => ['http:', 'https:'].includes(location.protocol);
export async function worksRequest(path, options = {}) {
  let response;
  try { response = await fetch(path, { ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000) }); }
  catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw error;
    throw new Error('当前无法连接作品服务，请检查网络后重试。');
  }
  let value;
  try { value = await response.json(); } catch { throw new Error(response.ok ? '当前站点尚未开启作品服务，请使用在线展馆。' : '作品服务暂时不可用，请稍后重试。'); }
  if (!response.ok) throw new Error(typeof value?.error === 'string' ? value.error : '作品服务暂时不可用，请稍后重试。');
  return value;
}
