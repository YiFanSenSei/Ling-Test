import { resolve } from 'node:path';
import { createApp } from './app.mjs';
const root = resolve(import.meta.dirname, '..');
const server = createApp({ dataDir: process.env.DATA_DIR || resolve(root, 'server-data'),
  distDir: resolve(root, 'dist'), adminPassword: process.env.ADMIN_PASSWORD,
  publicOrigin: process.env.PUBLIC_ORIGIN, secureCookie: process.env.SECURE_COOKIE === '1' });
const port = Number(process.env.PORT || 8787);
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`匠作在线展馆已启动，端口 ${port}；管理入口 /admin`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
