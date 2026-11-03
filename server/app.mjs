import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';

const crafts = new Set(['embroidery', 'paper', 'mortise']);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
export function createApp({ dataDir, distDir, adminPassword, publicOrigin, secureCookie = false }) {
  if (typeof adminPassword !== 'string' || adminPassword.length < 12 || adminPassword.length > 256) throw new Error('请设置 12 至 256 位的 ADMIN_PASSWORD');
  if (publicOrigin && new URL(publicOrigin).origin !== publicOrigin) throw new Error('PUBLIC_ORIGIN 只填写源地址，不包含路径或末尾斜线');
  dataDir = resolve(dataDir); distDir = resolve(distDir);
  mkdirSync(join(dataDir, 'images'), { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'works.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
      craft TEXT NOT NULL, title TEXT NOT NULL, nickname TEXT NOT NULL, metrics TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL, reviewed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS review_events (id INTEGER PRIMARY KEY, work_id TEXT NOT NULL REFERENCES works(id), action TEXT NOT NULL, created_at TEXT NOT NULL);`);
  const salt = randomBytes(16), passwordHash = scryptSync(adminPassword, salt, 32);
  const sessions = new Map(), limits = new Map();
  const sessionKey = req => hash((req.headers.cookie || '').match(/(?:^|;\s*)jz_admin=([a-f0-9]{64})(?:;|$)/)?.[1] || '');
  const authenticated = req => {
    const key = sessionKey(req), expires = sessions.get(key);
    if (!expires || expires < Date.now()) { sessions.delete(key); return false; }
    return true;
  };
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const limited = (req, type, max) => {
    const now = Date.now();
    for (const [key, value] of limits) if (value.until < now) limits.delete(key);
    const key = `${type}:${req.socket.remoteAddress}`;
    const entry = limits.get(key) || { n: 0, until: now + 15 * 60_000 };
    if (++entry.n > max) fail(429, '操作较频繁，请稍后再试');
    limits.set(key, entry);
  };
  const body = async req => {
    if (String(req.headers['content-type']).split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, '请发送 JSON 内容');
    let bytes = 0; const chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 6 * 1024 * 1024) fail(413, '作品过大，请缩小图片'); chunks.push(chunk); }
    try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw 0; return value; }
    catch { fail(400, '提交内容格式不正确'); }
  };
  const text = (value, max, optional = false) => {
    if (optional && value === undefined) return '';
    if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) fail(400, '标题或昵称长度不符合要求');
    return value.trim();
  };
  const view = row => ({ id: row.id, craft: row.craft, title: row.title, nickname: row.nickname,
    metrics: row.metrics, status: row.status, createdAt: row.created_at, reviewedAt: row.reviewed_at,
    image: `/api/works/${row.id}/image` });
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    const json = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    try {
      const origin = publicOrigin || `http://${req.headers.host}`;
      const host = new URL(origin).hostname;
      if (!publicOrigin && !['127.0.0.1', 'localhost', '[::1]'].includes(host)) fail(400, '请配置 PUBLIC_ORIGIN');
      const url = new URL(req.url, origin), path = url.pathname;
      if (path === '/favicon.ico' && req.method === 'GET') { res.writeHead(204); return res.end(); }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) fail(403, '请从本站页面提交');
      if (path === '/api/health' && req.method === 'GET') return json(200, { online: true });
      if (path === '/api/admin/session' && req.method === 'POST') {
        limited(req, 'login', 10);
        const input = await body(req);
        if (typeof input.password !== 'string' || input.password.length > 256 || !timingSafeEqual(scryptSync(input.password, salt, 32), passwordHash)) fail(401, '登录信息不正确');
        for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
        sessions.delete(sessionKey(req));
        const token = randomBytes(32).toString('hex'); sessions.set(hash(token), Date.now() + 8 * 3600_000);
        res.setHeader('Set-Cookie', `jz_admin=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${secureCookie ? '; Secure' : ''}`);
        return json(200, { authenticated: true });
      }
      if (path === '/api/admin/session' && req.method === 'GET') return json(200, { authenticated: authenticated(req) });
      if (path.startsWith('/api/admin/')) {
        if (!authenticated(req)) fail(401, '请先登录管理后台');
        if (path === '/api/admin/session' && req.method === 'DELETE') {
          sessions.delete(sessionKey(req));
          res.setHeader('Set-Cookie', 'jz_admin=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');
          return json(200, { authenticated: false });
        }
        if (path === '/api/admin/session' && req.method === 'GET') return json(200, { authenticated: true });
        const match = path.match(/^\/api\/admin\/works\/([a-f0-9-]{36})$/);
        if (match && req.method === 'PATCH') {
          const { status, expectedStatus = 'pending' } = await body(req);
          const transitions = { pending: ['approved', 'rejected'], approved: ['rejected'], rejected: ['pending'] };
          if (typeof expectedStatus !== 'string' || typeof status !== 'string' || !Object.hasOwn(transitions, expectedStatus) || !transitions[expectedStatus].includes(status)) fail(400, '审核状态变更不正确');
          const date = new Date().toISOString();
          db.exec('BEGIN IMMEDIATE');
          try {
            const changed = db.prepare('UPDATE works SET status=?, reviewed_at=? WHERE id=? AND status=?').run(status, date, match[1], expectedStatus);
            if (!changed.changes) fail(409, '作品已处理或不存在，请刷新');
            db.prepare('INSERT INTO review_events(work_id,action,created_at) VALUES(?,?,?)').run(match[1], `${expectedStatus}->${status}`, date);
            db.exec('COMMIT');
          } catch (error) { db.exec('ROLLBACK'); throw error; }
          return json(200, { status });
        }
      }
      if (path === '/api/works' && req.method === 'POST') {
        const input = await body(req);
        if (!crafts.has(input.craft) || typeof input.requestId !== 'string' || !uuid.test(input.requestId)) fail(400, '作品类型或请求编号不正确');
        const title = text(input.title, 80), nickname = text(input.nickname, 32, true), metrics = text(input.metrics || '', 200, true);
        if (typeof input.image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.image)) fail(400, '请提交 PNG 图片');
        const image = Buffer.from(input.image.split(',')[1], 'base64');
        if (image.length < 45 || image.length > 4 * 1024 * 1024 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || image.toString('ascii', 12, 16) !== 'IHDR') fail(400, 'PNG 图片无效或过大');
        if (!image.readUInt32BE(16) || !image.readUInt32BE(20) || image.readUInt32BE(16) > 4096 || image.readUInt32BE(20) > 4096) fail(400, '图片尺寸超出范围');
        if (image.subarray(-12).toString('hex') !== '0000000049454e44ae426082') fail(400, '图片不完整');
        const payload = hash(JSON.stringify([input.craft, title, nickname, metrics, hash(image)]));
        const existing = db.prepare('SELECT id,payload_hash,status FROM works WHERE request_id=?').get(input.requestId);
        if (existing) {
          if (existing.payload_hash !== payload) fail(409, '请求编号已使用，请重新投稿');
          return json(200, { id: existing.id, status: existing.status });
        }
        limited(req, 'upload', 20);
        const id = randomUUID(), file = join(dataDir, 'images', `${id}.png`);
        writeFileSync(file, image, { flag: 'wx' });
        try {
          db.prepare('INSERT INTO works(id,request_id,payload_hash,craft,title,nickname,metrics,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id, input.requestId, payload, input.craft, title, nickname, metrics, new Date().toISOString());
        } catch (error) { unlinkSync(file); throw error; }
        return json(201, { id, status: 'pending' });
      }
      if ((path === '/api/works' || path === '/api/admin/works') && req.method === 'GET') {
        const admin = path.includes('/admin/');
        const status = admin ? (url.searchParams.get('status') || 'pending') : 'approved';
        if (!['pending', 'approved', 'rejected'].includes(status)) fail(400, '筛选状态不正确');
        const craft = url.searchParams.get('craft') || '';
        if (craft && !crafts.has(craft)) fail(400, '技艺筛选不正确');
        const requestedPage = Math.max(1, Math.min(100000, Number(url.searchParams.get('page')) || 1)) | 0;
        const where = 'status=?' + (craft ? ' AND craft=?' : ''), params = craft ? [status, craft] : [status];
        const total = db.prepare(`SELECT COUNT(*) n FROM works WHERE ${where}`).get(...params).n;
        const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / 12)));
        const items = db.prepare(`SELECT * FROM works WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 12 OFFSET ?`).all(...params, (page - 1) * 12).map(view);
        return json(200, { items, total, page, pages: Math.max(1, Math.ceil(total / 12)) });
      }
      const imageMatch = path.match(/^\/api\/works\/([a-f0-9-]{36})\/image$/);
      if (imageMatch && req.method === 'GET') {
        const row = db.prepare('SELECT status FROM works WHERE id=?').get(imageMatch[1]);
        if (!row || (row.status !== 'approved' && !authenticated(req))) fail(404, '作品尚未公开');
        let image;
        try { image = readFileSync(join(dataDir, 'images', `${imageMatch[1]}.png`)); }
        catch (error) { if (error.code === 'ENOENT') fail(404, '作品图片暂不可用'); throw error; }
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store' });
        return res.end(image);
      }
      if (path.startsWith('/api/')) fail(404, '接口不存在');
      if (!['GET', 'HEAD'].includes(req.method)) fail(405, '请求方法不支持');
      if (path === '/admin' || path === '/admin.js' || path === '/admin.css') {
        const file = path === '/admin' ? 'admin.html' : path.slice(1);
        res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'");
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
        return res.end(readFileSync(new URL(file, import.meta.url)));
      }
      let decoded;
      try { decoded = decodeURIComponent(path === '/' ? '/index.html' : path); } catch { fail(400, '文件地址格式不正确'); }
      const file = resolve(distDir, '.' + decoded);
      if (!file.startsWith(distDir + sep)) fail(404, '文件不存在');
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
      try { res.end(readFileSync(file)); } catch { fail(404, '文件不存在，请先构建'); }
    } catch (error) {
      if (!res.headersSent) json(error.status || 500, { error: error.status ? error.message : '服务暂时不可用，请稍后重试' });
      else res.end();
    }
  });
  server.requestTimeout = 20000;
  server.on('close', () => db.close());
  return server;
}
