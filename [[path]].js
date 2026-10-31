/**
 * TL SALES PERFORMANCE — Backend (Cloudflare Pages Functions)
 * --------------------------------------------------------------
 * File này chạy trên máy chủ Cloudflare, KHÔNG chạy trên trình duyệt.
 * Nhiệm vụ:
 *   1. Giữ bí mật App Secret của Lark (người dùng không bao giờ nhìn thấy).
 *   2. Đăng nhập bằng tài khoản Lark (OAuth) và phân quyền theo bảng DM_NHANVIEN.
 *   3. Đọc / ghi dữ liệu Lark Base thay cho giao diện.
 *
 * Biến môi trường cần khai báo trên Cloudflare (Settings → Variables and Secrets):
 *   LARK_APP_ID        : App ID của Custom App (cli_xxx)
 *   LARK_APP_SECRET    : App Secret (chọn loại "Secret")
 *   LARK_BASE_TOKEN    : mã Base, lấy trên đường link Base (đoạn sau /base/ và trước dấu ?)
 *   SESSION_SECRET     : chuỗi ngẫu nhiên tối thiểu 32 ký tự (chọn loại "Secret")
 *   LARK_DOMAIN        : (không bắt buộc) mặc định https://open.larksuite.com
 *   LARK_ACCOUNTS_DOMAIN: (không bắt buộc) mặc định https://accounts.larksuite.com
 *
 * Bạn KHÔNG cần sửa file này để triển khai. Muốn đổi tên bảng/cột, sửa phần CẤU HÌNH bên dưới.
 */

// ======================= CẤU HÌNH =======================
const REQUIRED_TABLES = [
  'DM_NHOM', 'DM_NHANVIEN', 'DM_SKU', 'DM_KY', 'MUC_TIEU',
  'KE_HOACH', 'THUC_HIEN', 'TON_KHO', 'YEU_CAU_HANG', 'VAN_DE',
];
// Bảng được phép ghi từ ứng dụng (các bảng khác chỉ đọc; danh mục sửa trực tiếp trên Lark Base)
const WRITABLE = ['MUC_TIEU', 'KE_HOACH', 'VAN_DE', 'YEU_CAU_HANG'];
// Cột xác định "dữ liệu của NVKD nào" trong từng bảng
const NV_COLUMN = {
  THUC_HIEN: ['Mã NV'], KE_HOACH: ['Mã NV'], YEU_CAU_HANG: ['Mã NV'],
  VAN_DE: ['Mã NV thực hiện', 'Mã NV kiểm tra'],
};
const ROLES_ALL = ['Admin', 'Trưởng phòng', 'Xem']; // xem toàn bộ dữ liệu
const ROLES_MANAGE = ['Admin', 'Trưởng phòng'];     // sửa toàn bộ
const SESSION_HOURS = 12;
const CACHE_MINUTES = 5;
// ========================================================

const mem = globalThis.__tl || (globalThis.__tl = { token: null, tokenExp: 0, tables: null, tablesExp: 0, fields: {}, pages: {} });

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const path = (params.path || []).join('/');
  try {
    switch (`${request.method} ${path}`) {
      case 'GET me': return await me(request, env);
      case 'GET health': return await health(env);
      case 'GET auth/login': return await login(request, env);
      case 'GET auth/callback': return await callback(request, env);
      case 'GET auth/logout': return await logout(request);
      case 'GET data': return await getData(request, env);
      case 'POST record': return await saveRecord(request, env, false);
      case 'PUT record': return await saveRecord(request, env, true);
      default: return json({ error: 'Không tìm thấy API: ' + path }, 404);
    }
  } catch (e) {
    return json({ error: e.message || String(e), hint: e.hint || '' }, e.status || 500);
  }
}

// ----------------------- tiện ích -----------------------
const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const fail = (msg, status = 400, hint = '') => { const e = new Error(msg); e.status = status; e.hint = hint; throw e; };
const configured = (env) => !!(env.LARK_APP_ID && env.LARK_APP_SECRET && env.LARK_BASE_TOKEN);
const larkDomain = (env) => (env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/$/, '');
const accountsDomain = (env) => (env.LARK_ACCOUNTS_DOMAIN || 'https://accounts.larksuite.com').replace(/\/$/, '');

const LARK_HINTS = {
  91402: 'Không tìm thấy Base. Kiểm tra lại LARK_BASE_TOKEN (Base phải nằm trong Drive/Cloud Docs, không nằm trong Wiki).',
  91403: 'App chưa có quyền với Base. Mở Base → "..." → Thêm ứng dụng tài liệu (Add document app) → chọn app → quyền "Có thể chỉnh sửa".',
  1254302: 'App chưa có quyền với Base. Mở Base → "..." → Thêm ứng dụng tài liệu → chọn app → quyền "Có thể chỉnh sửa".',
  99991663: 'Token không hợp lệ. Kiểm tra LARK_APP_ID / LARK_APP_SECRET.',
  10003: 'App ID hoặc App Secret sai.',
  99991672: 'App chưa được cấp quyền (scope). Vào Developer Console → Permissions & Scopes → thêm quyền bitable:app rồi phát hành phiên bản mới.',
  1254045: 'Tên cột không tồn tại trong bảng. Kiểm tra tên cột trên Lark Base có khớp với file mẫu không.',
};

async function lark(env, path, { method = 'GET', body, token } = {}) {
  const t = token || await tenantToken(env);
  const res = await fetch(larkDomain(env) + path, {
    method, headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json; charset=utf-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data; try { data = await res.json(); } catch { fail('Lark trả về dữ liệu không đọc được (HTTP ' + res.status + ')', 502); }
  if (data.code !== 0) fail(`Lark lỗi ${data.code}: ${data.msg}`, 502, LARK_HINTS[data.code] || '');
  return data.data || {};
}

async function tenantToken(env) {
  if (mem.token && Date.now() < mem.tokenExp) return mem.token;
  const res = await fetch(larkDomain(env) + '/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const d = await res.json();
  if (d.code !== 0) fail('Không lấy được tenant token: ' + d.msg, 502, LARK_HINTS[d.code] || 'Kiểm tra LARK_APP_ID / LARK_APP_SECRET.');
  mem.token = d.tenant_access_token; mem.tokenExp = Date.now() + (d.expire - 300) * 1000;
  return mem.token;
}

async function tableMap(env, force = false) {
  if (!force && mem.tables && Date.now() < mem.tablesExp) return mem.tables;
  const map = {}; let pt = '';
  do {
    const d = await lark(env, `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables?page_size=100${pt ? '&page_token=' + pt : ''}`);
    (d.items || []).forEach(t => { map[t.name.trim()] = t.table_id; });
    pt = d.has_more ? d.page_token : '';
  } while (pt);
  mem.tables = map; mem.tablesExp = Date.now() + 10 * 60 * 1000;
  return map;
}
async function tableId(env, name) {
  let m = await tableMap(env);
  if (!m[name]) m = await tableMap(env, true);
  if (!m[name]) fail(`Không tìm thấy bảng "${name}" trong Base`, 404, 'Tên bảng trên Lark Base phải đúng chính xác như file mẫu (VD: THUC_HIEN).');
  return m[name];
}
async function fieldsOf(env, name) {
  const c = mem.fields[name];
  if (c && Date.now() < c.exp) return c.list;
  const id = await tableId(env, name); const list = []; let pt = '';
  do {
    const d = await lark(env, `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${id}/fields?page_size=100${pt ? '&page_token=' + pt : ''}`);
    (d.items || []).forEach(f => list.push({ name: f.field_name, type: f.type }));
    pt = d.has_more ? d.page_token : '';
  } while (pt);
  mem.fields[name] = { list, exp: Date.now() + 10 * 60 * 1000 };
  return list;
}

// Chuyển giá trị ô Lark Base về dạng đơn giản (chữ / số)
function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    if (!v.length) return null;
    const parts = v.map(x => (x && typeof x === 'object') ? (x.text ?? x.name ?? x.en_name ?? x.email ?? x.link ?? JSON.stringify(x)) : x);
    return parts.every(p => typeof p === 'number') && parts.length === 1 ? parts[0] : parts.join(v[0] && v[0].text !== undefined ? '' : ', ');
  }
  if ('value' in v) return norm(v.value);
  if ('link_record_ids' in v) return (v.link_record_ids || []).join(', ');
  if ('text' in v) return v.text;
  if ('link' in v) return v.link;
  return JSON.stringify(v);
}

// ----------------------- phiên đăng nhập -----------------------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = (s) => b64u(new TextEncoder().encode(s));
const fromB64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
async function hmac(env, data) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) fail('Chưa khai báo SESSION_SECRET (tối thiểu 32 ký tự)', 500);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}
function cookie(req, name) {
  const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
async function session(req, env) {
  const c = cookie(req, 'tl_sess'); if (!c) return null;
  const [p, sig] = c.split('.'); if (!p || !sig) return null;
  if (await hmac(env, p) !== sig) return null;
  const s = JSON.parse(fromB64u(p));
  return s.exp > Date.now() ? s : null;
}
async function requireUser(req, env) {
  if (!configured(env)) fail('Ứng dụng chưa kết nối Lark (đang ở chế độ demo)', 400);
  const s = await session(req, env);
  if (!s) fail('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401);
  return s;
}

async function me(req, env) {
  if (!configured(env)) return json({ mode: 'demo' });
  const s = await session(req, env);
  if (!s) return json({ mode: 'login', loginUrl: '/api/auth/login' });
  return json({ mode: 'live', user: { name: s.n, email: s.e, maNV: s.id, role: s.r, team: s.t } });
}

async function login(req, env) {
  if (!configured(env)) fail('Chưa cấu hình LARK_APP_ID / LARK_APP_SECRET / LARK_BASE_TOKEN', 400);
  const url = new URL(req.url);
  const state = crypto.randomUUID();
  const redirect = url.origin + '/api/auth/callback';
  const auth = `${accountsDomain(env)}/open-apis/authen/v1/authorize?client_id=${encodeURIComponent(env.LARK_APP_ID)}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;
  return new Response(null, { status: 302, headers: { location: auth, 'set-cookie': `tl_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` } });
}

async function callback(req, env) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
  if (!code) return html('Đăng nhập bị hủy', 'Lark không trả về mã đăng nhập. Vui lòng thử lại.');
  if (!state || state !== cookie(req, 'tl_state')) return html('Phiên đăng nhập không hợp lệ', 'Vui lòng mở lại ứng dụng và đăng nhập lần nữa.');
  const redirect = url.origin + '/api/auth/callback';
  const tr = await fetch(larkDomain(env) + '/open-apis/authen/v2/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ grant_type: 'authorization_code', client_id: env.LARK_APP_ID, client_secret: env.LARK_APP_SECRET, code, redirect_uri: redirect }),
  });
  const tok = await tr.json();
  const uat = tok.access_token || (tok.data && tok.data.access_token);
  if (!uat) return html('Không đăng nhập được', `Lark báo: ${tok.error_description || tok.msg || JSON.stringify(tok)}.<br>Kiểm tra đã khai báo Redirect URL: <b>${redirect}</b> trong mục Security Settings của app.`);
  const info = await lark(env, '/open-apis/authen/v1/user_info', { token: uat });
  const emails = [info.email, info.enterprise_email].filter(Boolean).map(e => e.toLowerCase());
  const staff = await readAll(env, 'DM_NHANVIEN');
  const row = staff.rows.find(r => emails.includes(String(r['Email'] || '').trim().toLowerCase()));
  if (!row) return html('Bạn chưa được cấp quyền', `Tài khoản <b>${info.name || ''}</b> (${emails.join(', ') || 'không đọc được email'}) chưa có trong bảng <b>DM_NHANVIEN</b>.<br>Nhờ quản trị thêm email này vào cột Email và chọn Vai trò.${emails.length ? '' : '<br><br>Lưu ý cho quản trị: app cần quyền đọc email người dùng (contact:user.email:readonly).'}`);
  if (/nghỉ/i.test(row['Trạng thái'] || '')) return html('Tài khoản đã ngừng sử dụng', 'Vui lòng liên hệ quản trị.');
  const payload = b64uStr(JSON.stringify({ e: emails[0], n: row['Họ tên'] || info.name, id: row['Mã NV'] || '', r: row['Vai trò'] || 'NVKD', t: row['Mã nhóm'] || '', exp: Date.now() + SESSION_HOURS * 3600e3 }));
  const sig = await hmac(env, payload);
  const h = new Headers({ location: '/' });
  h.append('set-cookie', `tl_sess=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`);
  h.append('set-cookie', 'tl_state=; Path=/; Max-Age=0');
  return new Response(null, { status: 302, headers: h });
}
function logout() {
  return new Response(null, { status: 302, headers: { location: '/?loggedout=1', 'set-cookie': 'tl_sess=; Path=/; Max-Age=0' } });
}
function html(title, msg) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <body style="font-family:system-ui;background:#f3f6fb;display:grid;place-items:center;min-height:100vh;margin:0">
  <div style="background:#fff;padding:32px;border-radius:14px;max-width:520px;box-shadow:0 4px 24px #0b2a5b22">
  <h2 style="color:#0b2a5b;margin-top:0">${title}</h2><p style="line-height:1.6;color:#334">${msg}</p>
  <a href="/api/auth/login" style="display:inline-block;margin-top:12px;background:#1f6feb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Đăng nhập lại</a></div>`,
  { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

// ----------------------- phân quyền -----------------------
function canSee(user, table, row) {
  if (ROLES_ALL.includes(user.r)) return true;
  if (table.startsWith('DM_') || table === 'TON_KHO') return true;
  const team = row['Mã nhóm'] || '';
  if (table === 'MUC_TIEU') {
    const lvl = row['Cấp phân bổ'];
    if (lvl === 'Phòng' || lvl === 'SKU') return true;
    if (user.r === 'Trưởng nhóm') return team === user.t;
    if (lvl === 'Nhóm') return team === user.t;
    return lvl === 'NVKD' && row['Mã đối tượng'] === user.id;
  }
  if (user.r === 'Trưởng nhóm') return team === user.t;
  return (NV_COLUMN[table] || []).some(c => row[c] && row[c] === user.id);
}
function checkWrite(user, table, row, isNew) {
  if (!WRITABLE.includes(table)) fail(`Bảng ${table} chỉ đọc trên ứng dụng (sửa trực tiếp trên Lark Base)`, 403);
  if (ROLES_MANAGE.includes(user.r)) return;
  if (user.r === 'Xem') fail('Vai trò "Xem" không được chỉnh sửa', 403);
  const team = row['Mã nhóm'] || '';
  if (user.r === 'Trưởng nhóm') {
    if (team !== user.t) fail('Chỉ được sửa dữ liệu thuộc nhóm của bạn (' + user.t + ')', 403);
    if (table === 'MUC_TIEU' && row['Cấp phân bổ'] !== 'NVKD') fail('Trưởng nhóm chỉ phân bổ mục tiêu cấp NVKD', 403);
    if (table === 'MUC_TIEU' && row['Trạng thái'] === 'Đã duyệt') fail('Mục tiêu cần Trưởng phòng duyệt', 403);
    return;
  }
  // NVKD
  if (table === 'MUC_TIEU') fail('NVKD không được sửa mục tiêu', 403);
  if (table === 'KE_HOACH' && row['Mã NV'] !== user.id) fail('Chỉ được lập kế hoạch của chính bạn', 403);
  if (table === 'YEU_CAU_HANG') {
    if (row['Mã NV'] !== user.id) fail('Chỉ được tạo yêu cầu của chính bạn', 403);
    if (row['Phê duyệt'] && row['Phê duyệt'] !== 'Chờ duyệt') fail('NVKD không tự phê duyệt yêu cầu', 403);
  }
  if (table === 'VAN_DE') {
    const mine = row['Mã NV thực hiện'] === user.id, checker = row['Mã NV kiểm tra'] === user.id;
    if (!mine && !checker && !isNew) fail('Bạn không phụ trách vấn đề này', 403);
    if (row['Trạng thái'] === 'Đã đóng' && !checker) fail('Chỉ người kiểm tra mới được đóng vấn đề', 403);
  }
}

// ----------------------- đọc dữ liệu -----------------------
async function readPage(env, table, pageToken) {
  const id = await tableId(env, table);
  const d = await lark(env, `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${id}/records/search?page_size=500${pageToken ? '&page_token=' + encodeURIComponent(pageToken) : ''}`,
    { method: 'POST', body: { automatic_fields: false } });
  const rows = (d.items || []).map(it => { const o = { _id: it.record_id }; for (const k in it.fields) o[k] = norm(it.fields[k]); return o; });
  return { rows, next: d.has_more ? d.page_token : '', total: d.total };
}
async function readAll(env, table) {
  const all = []; let pt = '';
  do { const p = await readPage(env, table, pt); all.push(...p.rows); pt = p.next; } while (pt);
  return { rows: all };
}

async function getData(req, env) {
  const user = await requireUser(req, env);
  const url = new URL(req.url);
  const table = url.searchParams.get('table');
  if (!REQUIRED_TABLES.includes(table)) fail('Bảng không hợp lệ: ' + table);
  const pt = url.searchParams.get('page') || '';
  const fresh = url.searchParams.get('fresh') === '1';
  const key = table + '|' + pt;
  let page = mem.pages[key];
  if (fresh || !page || Date.now() > page.exp) {
    page = { ...(await readPage(env, table, pt)), exp: Date.now() + CACHE_MINUTES * 60e3 };
    mem.pages[key] = page;
  }
  const visible = page.rows.filter(r => canSee(user, table, r));
  // gửi dạng gọn: danh sách cột + mảng giá trị
  const cols = []; visible.forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
  return json({ table, cols, rows: visible.map(r => cols.map(c => r[c] ?? null)), next: page.next, total: page.total });
}

// ----------------------- ghi dữ liệu -----------------------
function coerce(fieldList, fields) {
  const out = {}; const skipped = [];
  for (const [k, v] of Object.entries(fields)) {
    const f = fieldList.find(x => x.name === k);
    if (!f) { skipped.push(k); continue; }
    if (v === null || v === undefined || v === '') { if (![19, 20, 1001, 1002, 1003, 1004, 1005].includes(f.type)) out[k] = null; continue; }
    switch (f.type) {
      case 2: { const n = Number(String(v).replace(/,/g, '')); if (!isNaN(n)) out[k] = n; break; }
      case 5: { const t = typeof v === 'number' ? v : Date.parse(v); if (!isNaN(t)) out[k] = t; break; }
      case 7: out[k] = v === true || v === 'true' || v === 'Có'; break;
      case 4: out[k] = Array.isArray(v) ? v.map(String) : String(v).split(',').map(s => s.trim()).filter(Boolean); break;
      case 1: case 3: case 13: case 15: out[k] = String(v); break;
      case 19: case 20: case 1001: case 1002: case 1003: case 1004: case 1005: skipped.push(k); break; // cột công thức / tự động
      default: out[k] = v;
    }
  }
  return { out, skipped };
}

async function saveRecord(req, env, isUpdate) {
  const user = await requireUser(req, env);
  const body = await req.json();
  const table = body.table; const fields = body.fields || {};
  if (!WRITABLE.includes(table)) fail('Bảng không cho phép ghi: ' + table, 403);
  const id = await tableId(env, table);
  let merged = { ...fields };
  if (isUpdate) {
    if (!body.id) fail('Thiếu mã bản ghi');
    const d = await lark(env, `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${id}/records/${body.id}`);
    const old = {}; const f = (d.record || {}).fields || {}; for (const k in f) old[k] = norm(f[k]);
    checkWrite(user, table, old, false);             // phải có quyền với bản ghi cũ
    merged = { ...old, ...fields };
  }
  checkWrite(user, table, merged, !isUpdate);        // và với nội dung mới
  const { out, skipped } = coerce(await fieldsOf(env, table), fields);
  const base = `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${id}/records`;
  const d = isUpdate ? await lark(env, `${base}/${body.id}`, { method: 'PUT', body: { fields: out } })
                     : await lark(env, base, { method: 'POST', body: { fields: out } });
  Object.keys(mem.pages).forEach(k => { if (k.startsWith(table + '|')) delete mem.pages[k]; }); // xóa cache
  return json({ ok: true, id: d.record && d.record.record_id, skipped });
}

// ----------------------- kiểm tra cấu hình -----------------------
async function health(env) {
  const r = { checks: [] };
  const add = (name, ok, detail = '') => r.checks.push({ name, ok, detail });
  add('LARK_APP_ID', !!env.LARK_APP_ID, env.LARK_APP_ID ? env.LARK_APP_ID.slice(0, 8) + '…' : 'chưa khai báo');
  add('LARK_APP_SECRET', !!env.LARK_APP_SECRET, env.LARK_APP_SECRET ? 'đã khai báo' : 'chưa khai báo');
  add('LARK_BASE_TOKEN', !!env.LARK_BASE_TOKEN, env.LARK_BASE_TOKEN ? env.LARK_BASE_TOKEN.slice(0, 6) + '…' : 'chưa khai báo');
  add('SESSION_SECRET', !!(env.SESSION_SECRET && env.SESSION_SECRET.length >= 32), env.SESSION_SECRET ? (env.SESSION_SECRET.length >= 32 ? 'đã khai báo' : 'quá ngắn (< 32 ký tự)') : 'chưa khai báo');
  if (configured(env)) {
    try { await tenantToken(env); add('Kết nối Lark (tenant token)', true, 'OK'); } catch (e) { add('Kết nối Lark (tenant token)', false, e.message + ' ' + (e.hint || '')); return json(r); }
    try {
      const m = await tableMap(env, true);
      for (const t of REQUIRED_TABLES) {
        if (!m[t]) { add('Bảng ' + t, false, 'không tìm thấy trong Base'); continue; }
        try {
          const d = await lark(env, `/open-apis/bitable/v1/apps/${env.LARK_BASE_TOKEN}/tables/${m[t]}/records/search?page_size=1`, { method: 'POST', body: {} });
          add('Bảng ' + t, true, (d.total ?? '?') + ' dòng');
        } catch (e) { add('Bảng ' + t, false, e.message + ' ' + (e.hint || '')); }
      }
    } catch (e) { add('Đọc Base', false, e.message + ' ' + (e.hint || '')); }
  }
  r.ok = r.checks.every(c => c.ok);
  return json(r);
}
