/**
 * 极简 hash 路由器
 *
 * ⚠️ 为什么用 hash 而不是 History API：
 *    比赛要求提交静态压缩包，评委可能直接双击 index.html 打开
 *    （file:// 协议下 History API 的 pushState 会失效，
 *     刷新会 404）。hash 路由在 file:// 与任意静态托管下都可用，
 *    符合手册「答辩不依赖在线服务」的稳妥原则。
 *
 * 支持动态参数：/project/:id
 */

const routes = [];
let notFoundHandler = null;
let beforeEach = null;

/** 注册路由。pattern 形如 '/project/:id' */
export function route(pattern, handler) {
  const paramNames = [];
  const regexStr = pattern
    .replace(/\/:([A-Za-z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '/([^/]+)';
    })
    .replace(/\//g, '\\/');
  routes.push({
    pattern,
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
  });
}

export function setNotFound(handler) { notFoundHandler = handler; }
export function setBeforeEach(fn) { beforeEach = fn; }

/**
 * 当前路径（不含 # 与 query），如 '/project/13978'
 *
 * ⚠️ 必须剥掉 ?query，否则 '/gallery?category=传统美术' 匹配不上
 *    路由模式 '/gallery'，会直接掉进 404。页面自己用 currentQuery()
 *    读取筛选参数。
 */
export function currentPath() {
  const raw = window.location.hash.slice(1) || '/';
  const withoutQuery = raw.split('?')[0];
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

/** 当前 query 对象，如 { category: '传统美术', page: '2' } */
export function currentQuery() {
  const raw = window.location.hash.slice(1) || '';
  const qIndex = raw.indexOf('?');
  const params = {};
  if (qIndex === -1) return params;
  const search = raw.slice(qIndex + 1);
  for (const pair of search.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      params[key] = value;
    }
  }
  return params;
}

/** 解析当前路径，返回 { handler, params, path } */
function resolve(path) {
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params, path };
    }
  }
  return { handler: notFoundHandler, params: {}, path };
}

/** 跳转 */
export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  if (replace) {
    window.history.replaceState(null, '', target);
    handleRoute();
  } else {
    window.location.hash = path;
  }
}

/** 处理一次路由 */
async function handleRoute() {
  const path = currentPath();
  const { handler, params } = resolve(path);
  if (beforeEach) beforeEach(path);
  if (handler) {
    await handler({ params, path });
  } else if (notFoundHandler) {
    await notFoundHandler({ path });
  } else {
    renderNotFound(path);
  }
  // 路由切换后回到顶部（页面渲染函数自己也会滚，双重保险）
  window.scrollTo(0, 0);
}

/**
 * 兜底 404。正常情况下 main.js 会通过 setNotFound() 提供带完整
 * 页头页脚的版本，这里只是没注册时的保险。
 */
function renderNotFound(path) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <main id="main" class="notfound">
      <div class="notfound__seal" aria-hidden="true">空</div>
      <h1>此页已散佚</h1>
      <p>未找到路径 <code>${path}</code>。或许是路径有误，或许它本就不在这座展馆里。</p>
      <p class="notfound__actions"><a class="btn btn-primary" href="#/">回到展馆入口</a></p>
    </main>`;
}

/** 启动路由 */
export function startRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

/**
 * 生成链接。集中处理，便于将来切换路由方案。
 * @example link('/project/13978', '苏绣')
 */
export function link(path, text, className = '') {
  return `<a href="#${path}"${className ? ` class="${className}"` : ''}>${text}</a>`;
}
