import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createApp } from './app.mjs';

test('投稿、权限、审核、重启持久化与重复请求', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'jz-server-test-'));
  const password = randomBytes(24).toString('hex');
  let server, origin;
  const start = async () => {
    server = createApp({ dataDir: directory, distDir: resolve('dist'), adminPassword: password });
    await new Promise(ready => server.listen(0, '127.0.0.1', ready));
    origin = `http://127.0.0.1:${server.address().port}`;
  };
  const request = (path, method = 'GET', data, cookie = '', extra = {}) => fetch(origin + path, {
    method, headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie, ...extra },
    body: data ? JSON.stringify(data) : undefined,
  });
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5l8AAAAASUVORK5CYII=';
  const work = { requestId: randomUUID(), title: '接口验证作品', nickname: '', craft: 'embroidery', metrics: '覆盖 100%', image };
  try {
    await start();
    assert.equal((await request('/api/admin/works')).status, 401);
    assert.equal((await request('/api/works', 'POST', work, '', { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request('/api/works', 'POST', { ...work, image: 'not-png' })).status, 400);
    const created = await request('/api/works', 'POST', work); assert.equal(created.status, 201);
    const { id } = await created.json();
    assert.equal((await (await request('/api/works')).json()).total, 0);
    assert.equal((await request(`/api/works/${id}/image`)).status, 404);
    const duplicate = await request('/api/works', 'POST', work); assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).id, id);
    assert.equal((await request('/api/works', 'POST', { ...work, title: '修改后的请求' })).status, 409);
    const login = await request('/api/admin/session', 'POST', { password }); assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const pending = await (await request('/api/admin/works', 'GET', null, cookie)).json(); assert.equal(pending.total, 1);
    assert.equal((await request(`/api/works/${id}/image`, 'GET', null, cookie)).status, 200);
    assert.equal((await request(`/api/admin/works/${id}`, 'PATCH', { status: 'approved' })).status, 401);
    assert.equal((await request(`/api/admin/works/${id}`, 'PATCH', { status: 'approved' }, cookie)).status, 200);
    assert.equal((await request(`/api/admin/works/${id}`, 'PATCH', { status: 'approved' }, cookie)).status, 409);
    assert.equal((await (await request('/api/works')).json()).total, 1);
    assert.equal((await request(`/api/works/${id}/image`)).status, 200);
    const other = await (await request('/api/works', 'POST', { ...work, requestId: randomUUID(), title: '待驳回作品' })).json();
    assert.equal((await request(`/api/admin/works/${other.id}`, 'PATCH', { status: 'rejected' }, cookie)).status, 200);
    assert.equal((await request(`/api/works/${other.id}/image`)).status, 404);
    assert.equal((await request('/api/admin/session', 'DELETE', null, cookie)).status, 200);
    assert.equal((await request('/api/admin/works', 'GET', null, cookie)).status, 401);
    await new Promise(ready => server.close(ready));
    await start();
    const restored = await (await request('/api/works')).json(); assert.equal(restored.total, 1); assert.equal(restored.items[0].id, id);
    assert.equal((await request(`/api/works/${id}/image`)).status, 200);
  } finally {
    if (server?.listening) await new Promise(ready => server.close(ready));
    if (resolve(directory).startsWith(resolve(tmpdir()) + sep)) rmSync(directory, { recursive: true, force: true });
  }
});
