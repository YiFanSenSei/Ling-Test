/** 有限等待，失败后可重新发起请求。普通脚本兼容 file://。 */
export async function fetchJSON(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('内容暂时无法读取');
    return await response.json();
  } finally { clearTimeout(timer); }
}

export function loadDataScript(url, ready, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timer;
    const finish = error => {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      script.remove();
      if (error) reject(error); else resolve();
    };
    script.src = url;
    script.onload = () => finish(ready() ? null : new Error('内容未完整加载'));
    script.onerror = () => finish(new Error('内容加载失败，请重试'));
    timer = setTimeout(() => finish(new Error('等待时间较长，请检查连接后重试')), timeout);
    document.head.appendChild(script);
  });
}
