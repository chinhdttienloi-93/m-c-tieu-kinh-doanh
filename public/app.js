/* =============================================================
   TL SALES PERFORMANCE — lõi ứng dụng (dữ liệu, bộ lọc, giao diện chung)
   ============================================================= */
const C = window.TL_CONFIG;
const TABLES = ['DM_NHOM', 'DM_NHANVIEN', 'DM_SKU', 'DM_KY', 'MUC_TIEU', 'KE_HOACH', 'THUC_HIEN', 'TON_KHO', 'YEU_CAU_HANG', 'VAN_DE'];
const S = { mode: 'demo', user: null, db: {}, mod: 1, tab: {}, F: {}, asOf: new Date(), acts: {}, rows: {}, seq: 0 };
const MODULES = []; // modules.js đăng ký vào đây

// ---------------- tiện ích ----------------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/,/g, '').replace('%', ''));
  return isNaN(n) ? 0 : n;
}
const fmt = (v, d = 0) => (v === null || v === undefined || isNaN(v)) ? '–' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (v, d = 1) => (v === null || v === undefined || !isFinite(v)) ? '–' : fmt(v * 100, d) + '%';
const sum = (arr, f) => arr.reduce((a, r) => a + (f ? num(f(r)) : num(r)), 0);
const uniq = (arr) => [...new Set(arr.filter(v => v !== null && v !== undefined && v !== ''))];
function toDate(v) { if (!v) return null; if (v instanceof Date) return v; const d = typeof v === 'number' ? new Date(v) : new Date(String(v).replace(/\//g, '-')); return isNaN(d) ? null : d; }
const ts = (v) => { const d = toDate(v); return d ? d.getTime() : 0; };
const dstr = (v) => { const d = toDate(v); return d ? d.toLocaleDateString('vi-VN') : ''; };
const iso = (v) => { const d = toDate(v); return d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) : ''; };
function groupSum(rows, keyFn, valFn) { const m = new Map(); rows.forEach(r => { const k = keyFn(r); m.set(k, (m.get(k) || 0) + num(valFn(r))); }); return m; }
const act = (fn) => { const id = 'a' + (++S.seq); S.acts[id] = fn; return id; };
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, err ? 6000 : 2800); }

// ---------------- tra cứu danh mục ----------------
const nvName = (code) => (S.db.DM_NHANVIEN.find(r => r['Mã NV'] === code) || {})['Họ tên'] || code || '';
const teamName = (code) => (S.db.DM_NHOM.find(r => r['Mã nhóm'] === code) || {})['Tên nhóm'] || code || '';
const isManager = () => ['Admin', 'Trưởng phòng'].includes(S.user.role);
const isLeader = () => S.user.role === 'Trưởng nhóm';
const canEdit = () => S.user.role !== 'Xem';

// ---------------- kỳ & tiến độ thời gian ----------------
function periodMonths(F = S.F) { if (F.thang) return [+F.thang]; if (F.quy) return [3 * F.quy - 2, 3 * F.quy - 1, 3 * F.quy]; return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; }
function periodLabel(F = S.F) { return F.thang ? `Tháng ${F.thang}/${F.nam}` : F.quy ? `Quý ${F.quy}/${F.nam}` : `Năm ${F.nam}`; }
function sellingDays(y, m, uptoDay) {
  const last = new Date(y, m, 0).getDate(); let n = 0;
  for (let d = 1; d <= Math.min(last, uptoDay ?? last); d++) if (!C.OFF_DAYS.includes(new Date(y, m - 1, d).getDay())) n++;
  return n;
}
/** Tỷ lệ thời gian đã trôi qua của kỳ (tính theo ngày bán hàng) */
function timeProgress(months, y = S.F.nam) {
  let tot = 0, el = 0; const a = S.asOf;
  months.forEach(m => {
    const t = sellingDays(y, m); tot += t;
    if (y < a.getFullYear() || (y === a.getFullYear() && m < a.getMonth() + 1)) el += t;
    else if (y === a.getFullYear() && m === a.getMonth() + 1) el += sellingDays(y, m, a.getDate());
  });
  return tot ? el / tot : 0;
}

// ---------------- mục tiêu & thực hiện ----------------
const effective = (r) => !r['Trạng thái'] || r['Trạng thái'] === 'Đã duyệt';
function filt(over = {}) {
  const F = S.F;
  return { nam: +F.nam, months: periodMonths(F), team: F.nhom || '', nv: F.nv || '', sp: F.sp || '', loai: F.loai || '', ...over };
}
/** Mục tiêu sản lượng (tấn) theo bộ lọc — tự chọn đúng cấp để không cộng trùng */
function target(f = filt()) {
  const level = f.nv ? 'NVKD' : (f.team || f.loai) ? 'Nhóm' : 'Phòng';
  let rows = S.db.MUC_TIEU.filter(r => num(r['Năm']) === f.nam && r['Cấp phân bổ'] === level && (r['KPI'] || 'Sản lượng') === 'Sản lượng' && effective(r));
  if (f.sp) rows = rows.filter(r => r['Sản phẩm'] === f.sp);
  if (level === 'NVKD') rows = rows.filter(r => r['Mã đối tượng'] === f.nv && (!f.loai || r['Loại hàng'] === f.loai));
  if (level === 'Nhóm') { if (f.team) rows = rows.filter(r => r['Mã nhóm'] === f.team); if (f.loai) rows = rows.filter(r => r['Loại hàng'] === f.loai); }
  const yr = rows.filter(r => r['Cấp kỳ'] === 'Năm');
  if (f.months.length === 12 && yr.length) return sum(yr, r => r['MT final']);
  return sum(rows.filter(r => r['Cấp kỳ'] === 'Tháng' && f.months.includes(num(r['Tháng']))), r => r['MT final']);
}
/** Mục tiêu doanh số (tỷ đồng): lấy mục tiêu năm, phân bổ theo tỷ trọng mục tiêu sản lượng */
function targetDS(f = filt()) {
  const y = S.db.MUC_TIEU.filter(r => num(r['Năm']) === f.nam && r['KPI'] === 'Doanh số' && r['Cấp phân bổ'] === 'Phòng' && effective(r));
  const ds = sum(y, r => r['MT final']); if (!ds) return 0;
  const all = target({ ...f, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], team: '', nv: '', sp: '', loai: '' });
  return all ? ds * target(f) / all : 0;
}
function actualRows(f = filt()) {
  return S.db.THUC_HIEN.filter(r => num(r['Năm']) === f.nam && f.months.includes(num(r['Tháng']))
    && (!f.team || r['Mã nhóm'] === f.team) && (!f.nv || r['Mã NV'] === f.nv) && (!f.sp || r['Sản phẩm'] === f.sp)
    && (!f.loai || r['Loại hàng'] === f.loai) && (!f.sku || r['Mã SKU'] === f.sku));
}
const SL = (r) => r['Sản lượng (tấn)'];
const actual = (f) => sum(actualRows(f), SL);
const actualDS = (f) => sum(actualRows(f), r => r['Doanh số']) / 1e9;
function forecast(f = filt()) { const a = actual(f); const tp = timeProgress(f.months, f.nam); return tp > 0 && tp < 1 ? a / tp : a; }

/** Màu trạng thái: so mức đạt với tiến độ thời gian */
function status(rate, tp = 1) {
  if (!isFinite(rate)) return { c: '', t: 'Chưa có MT' };
  const ratio = tp > 0 ? rate / tp : rate;
  if (ratio >= C.THRESHOLD_GREEN) return { c: 'g', t: 'Đạt' };
  if (ratio >= C.THRESHOLD_AMBER) return { c: 'a', t: 'Cảnh báo' };
  return { c: 'r', t: 'Rủi ro' };
}
const chip = (text, c = '') => `<span class="chip ${c}">${esc(text)}</span>`;
const statusChip = (rate, tp) => { const s = status(rate, tp); return chip(s.t, s.c); };
const STATUS_COLOR = { 'Đã duyệt': 'g', 'Chờ duyệt': 'a', 'Nháp': '', 'Từ chối': 'r', 'Đã xác nhận': 'g', 'Đang cập nhật': 'a', 'Rủi ro': 'r', 'Mới': 'b', 'Đang xử lý': 'a', 'Chờ kiểm tra': 'b', 'Đã đóng': 'g', 'Quá hạn': 'r', 'Đạt': 'g', 'Chưa đạt': 'r' };
const stChip = (s) => chip(s || '—', STATUS_COLOR[s] || '');

// ---------------- bảng HTML ----------------
/** cols: [{k, t, num, d, f:(v,row)=>html, cls:(v,row)=>class}] */
function table(cols, rows, o = {}) {
  const limit = o.limit || 300; const id = 't' + (++S.seq);
  if (o.onRow) S.rows[id] = { rows, fn: o.onRow };
  const cell = (c, r) => {
    const v = typeof c.k === 'function' ? c.k(r) : r[c.k];
    const html = c.f ? c.f(v, r) : c.num ? fmt(v, c.d ?? 0) : esc(v);
    const cls = [c.num ? 'num' : '', c.wrap ? 'wrap' : '', c.cls ? c.cls(v, r) : ''].join(' ');
    return `<td class="${cls}">${html}</td>`;
  };
  let h = `<div class="tbl-wrap" style="${o.maxH ? 'max-height:' + o.maxH + 'px' : ''}"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${esc(c.t)}</th>`).join('')}</tr></thead><tbody>`;
  if (!rows.length) h += `<tr><td colspan="${cols.length}" class="empty">${o.empty || 'Không có dữ liệu cho bộ lọc này'}</td></tr>`;
  rows.slice(0, limit).forEach((r, i) => { h += `<tr ${o.onRow ? `class="click" data-t="${id}" data-i="${i}"` : ''}>${cols.map(c => cell(c, r)).join('')}</tr>`; });
  if (o.total) h += `<tr class="total">${cols.map(c => cell(c, o.total)).join('')}</tr>`;
  h += '</tbody></table></div>';
  if (rows.length > limit) h += `<div class="more">Hiển thị ${limit}/${fmt(rows.length)} dòng – dùng bộ lọc để thu hẹp</div>`;
  return h;
}
function bars(items, o = {}) { // items: [{label, value(0..), mark, color, onClick}]
  const max = o.max || Math.max(1, ...items.map(i => i.value || 0), ...items.map(i => i.mark || 0));
  return items.map(i => `<div class="bar-row ${i.onClick ? 'click' : ''}" ${i.onClick ? `data-act="${act(i.onClick)}"` : ''} title="${esc(i.title || '')}">
    <span>${esc(i.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, (i.value || 0) / max * 100)}%;background:${i.color || 'var(--blue)'}"></div>${i.mark ? `<div class="bar-mark" style="left:${Math.min(100, i.mark / max * 100)}%"></div>` : ''}</div><b style="text-align:right">${i.text ?? pct(i.value, 0)}</b></div>`).join('');
}
const colorFor = (rate, tp) => ({ g: 'var(--green)', a: 'var(--amber)', r: 'var(--red)', '': 'var(--blue)' }[status(rate, tp).c]);
const kpi = (lbl, val, unit, foot = '', cls = '') => `<div class="card kpi ${cls}"><div class="lbl">${lbl}</div><div class="val">${val}<small>${unit || ''}</small></div><div class="foot">${foot}</div></div>`;

// ---------------- modal form ----------------
function openForm({ title, fields, values = {}, saveText = 'Lưu', onSave, extraButtons = [] }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = '<div class="form">' + fields.map(f => {
    const v = values[f.k] ?? f.def ?? '';
    const req = f.req ? ' <span class="req">*</span>' : '';
    let input;
    if (f.type === 'select') input = `<select name="${esc(f.k)}" ${f.ro ? 'disabled' : ''}>${(f.opts || []).map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea name="${esc(f.k)}" ${f.ro ? 'readonly' : ''}>${esc(v)}</textarea>`;
    else input = `<input name="${esc(f.k)}" type="${f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}" step="any" value="${esc(f.type === 'date' ? iso(v) : v)}" ${f.ro ? 'readonly' : ''} ${f.list ? `list="dl-${esc(f.k)}"` : ''}>${f.list ? `<datalist id="dl-${esc(f.k)}">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}`;
    return `<label class="${f.full || f.type === 'textarea' ? 'full' : ''}"><span>${esc(f.label || f.k)}${req}</span>${input}${f.help ? `<small>${esc(f.help)}</small>` : ''}</label>`;
  }).join('') + '</div>';
  const foot = $('#modalFoot'); foot.innerHTML = '';
  extraButtons.forEach(b => { const e = document.createElement('button'); e.className = 'btn ' + (b.cls || 'ghost'); e.textContent = b.text; e.onclick = () => b.fn(collect()); foot.appendChild(e); });
  const cancel = document.createElement('button'); cancel.className = 'btn ghost'; cancel.textContent = 'Hủy'; cancel.onclick = closeModal; foot.appendChild(cancel);
  if (onSave) { const ok = document.createElement('button'); ok.className = 'btn'; ok.textContent = saveText; ok.onclick = async () => {
    const vals = collect(); const miss = fields.filter(f => f.req && (vals[f.k] === '' || vals[f.k] === null)).map(f => f.label || f.k);
    if (miss.length) return toast('Vui lòng nhập: ' + miss.join(', '), true);
    ok.disabled = true; ok.textContent = 'Đang lưu…';
    try { await onSave(vals); closeModal(); render(); } catch (e) { toast(e.message, true); } finally { ok.disabled = false; ok.textContent = saveText; }
  }; foot.appendChild(ok); }
  function collect() {
    const o = {}; fields.forEach(f => { if (f.ro && !f.keep) return; const el = $(`[name="${CSS.escape(f.k)}"]`, $('#modalBody')); let v = el.value;
      if (f.type === 'number') v = v === '' ? null : Number(v); if (f.type === 'date') v = v ? new Date(v + 'T00:00:00').getTime() : null; o[f.k] = v; });
    return o;
  }
  $('#modalBack').hidden = false;
}
function closeModal() { $('#modalBack').hidden = true; }
$('#modalClose').onclick = closeModal;
$('#modalBack').addEventListener('click', e => { if (e.target.id === 'modalBack') closeModal(); });

// ---------------- lưu dữ liệu ----------------
async function save(table, fields, id) {
  if (S.mode === 'live') {
    const res = await fetch('/api/record', { method: id ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ table, id, fields }) });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401) { showLogin(); throw new Error('Phiên đăng nhập hết hạn'); }
    if (!res.ok) throw new Error((d.error || 'Lỗi lưu dữ liệu') + (d.hint ? ' — ' + d.hint : ''));
    if (d.skipped && d.skipped.length) toast('Đã lưu. Bỏ qua cột không có trên Base: ' + d.skipped.join(', '));
    else toast('Đã lưu vào Lark Base');
    if (!id) id = d.id;
  } else toast('Chế độ demo: thay đổi chỉ lưu tạm trên trình duyệt');
  const rows = S.db[table]; const row = rows.find(r => r._id === id);
  if (row) Object.assign(row, fields); else rows.push({ _id: id || ('demo' + Date.now()), ...fields });
}
const nextCode = (table, col, prefix) => { const n = Math.max(0, ...S.db[table].map(r => parseInt(String(r[col] || '').replace(/\D/g, '')) || 0)) + 1; return prefix + String(n).padStart(5, '0'); };

// ---------------- tải dữ liệu ----------------
function unpack(p) { return p.rows.map((arr, i) => { const o = {}; p.cols.forEach((c, j) => o[c] = arr[j]); if (!o._id) o._id = 'r' + i; return o; }); }
function setLoading(text, frac) { const t = $('#loadingText'); if (t) t.textContent = text; const b = $('#loadingBar'); if (b && frac != null) b.style.width = Math.round(frac * 100) + '%'; }
async function loadDemo() {
  setLoading('Đang tải dữ liệu demo…', 0.3);
  const d = await fetch('demo-data.json').then(r => r.json());
  TABLES.forEach(t => S.db[t] = d.tables[t] ? unpack(d.tables[t]) : []);
}
async function loadLive(fresh) {
  let i = 0;
  for (const t of TABLES) {
    S.db[t] = []; let page = ''; let n = 0;
    do {
      setLoading(`Đang tải ${t}… ${n ? fmt(n) + ' dòng' : ''}`, (i + 0.5) / TABLES.length);
      const res = await fetch(`/api/data?table=${t}${page ? '&page=' + encodeURIComponent(page) : ''}${fresh ? '&fresh=1' : ''}`);
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) { showLogin(); throw new Error('login'); }
      if (!res.ok) throw new Error(`Không tải được bảng ${t}: ${d.error || res.status}${d.hint ? ' — ' + d.hint : ''}`);
      const rows = unpack(d); S.db[t].push(...rows); n += rows.length; page = d.next;
    } while (page);
    i++;
  }
}
function computeAsOf() {
  const ds = S.db.THUC_HIEN.map(r => toDate(r['Ngày'])).filter(Boolean);
  const max = ds.length ? new Date(Math.max(...ds)) : new Date();
  const today = new Date(); S.asOf = max < today ? max : today;
}

// ---------------- khung giao diện ----------------
const JOURNEY = [['☑', 'Mục tiêu', 'Xác định cần đạt gì', 2], ['⚖', 'Phân bổ', 'Ai chịu trách nhiệm', 3], ['☰', 'Kế hoạch', 'Đạt bằng cách nào', 4], ['✓', 'Thực hiện', 'Kết quả đến đâu', 5], ['▥', 'Phân tích', 'Vì sao đạt / không đạt', 6], ['⚑', 'Điều hành', 'Cần quyết định gì', 7]];
function renderShell() {
  $('#appName').textContent = C.APP_NAME; $('#appSub').textContent = C.APP_SUBTITLE; document.title = C.APP_NAME;
  $('#journey').innerHTML = JOURNEY.map(j => `<button class="jstep ${S.mod === j[3] ? 'on' : ''}" data-act="${act(() => go(j[3]))}"><span class="ji">${j[0]}</span><span><b>${j[1]}</b><small>${j[2]}</small></span></button>`).join('');
  const u = S.user; const ini = (u.name || '?').trim().split(/\s+/).pop()[0];
  $('#userbox').innerHTML = `<div style="text-align:right"><div class="uname">${esc(u.name)}</div><div class="urole">${esc(u.role)}${u.team ? ' · ' + esc(teamName(u.team)) : ''}${S.mode === 'demo' ? ' · DEMO' : ''}</div></div><div class="avatar">${esc(ini)}</div>${S.mode === 'live' ? '<a href="/api/auth/logout">Thoát</a>' : ''}`;
  $('#sidebar').innerHTML = `<div class="side-title">▦ TL Sales</div>` + MODULES.map(m => `<button class="side-item ${S.mod === m.id ? 'on' : ''}" data-act="${act(() => go(m.id))}"><span class="num">${String(m.id).padStart(2, '0')}</span>${esc(m.short || m.title)}</button>`).join('') +
    `<div class="side-sep"></div><button class="side-item" data-act="${act(() => reload())}">⟳ Làm mới dữ liệu</button>`;
}
function go(mod, tab, filterPatch) { S.mod = mod; if (tab) S.tab[mod] = tab; if (filterPatch) Object.assign(S.F, filterPatch); render(); window.scrollTo(0, 0); }

const FILTER_DEF = {
  nam: { label: 'Năm', opts: () => uniq(S.db.THUC_HIEN.map(r => num(r['Năm'])).concat(S.db.MUC_TIEU.map(r => num(r['Năm'])))).filter(Boolean).sort().map(v => [v, v]) },
  quy: { label: 'Quý', opts: () => [['', 'Tất cả'], [1, 'Quý 1'], [2, 'Quý 2'], [3, 'Quý 3'], [4, 'Quý 4']] },
  thang: { label: 'Tháng', opts: () => [['', 'Tất cả'], ...[...Array(12)].map((_, i) => [i + 1, 'Tháng ' + (i + 1)])] },
  nhom: { label: 'Nhóm KD', opts: () => [['', 'Tất cả'], ...S.db.DM_NHOM.map(r => [r['Mã nhóm'], r['Tên nhóm']])], lock: () => isLeader() || S.user.role === 'NVKD' },
  nv: { label: 'NVKD', opts: () => [['', 'Tất cả'], ...S.db.DM_NHANVIEN.filter(r => r['Vai trò'] !== 'Admin' && (!S.F.nhom || r['Mã nhóm'] === S.F.nhom)).map(r => [r['Mã NV'], r['Họ tên']])], lock: () => S.user.role === 'NVKD' },
  sp: { label: 'Sản phẩm', opts: () => [['', 'Tất cả'], ...C.PRODUCTS.filter(p => S.db.THUC_HIEN.some(r => r['Sản phẩm'] === p) || S.db.MUC_TIEU.some(r => r['Sản phẩm'] === p)).map(p => [p, p])] },
  loai: { label: 'Loại hàng', opts: () => [['', 'Tất cả'], ['Hàng tồn', 'Hàng tồn'], ['Hàng đặt', 'Hàng đặt']] },
};
function filtersHTML(keys) {
  return `<div class="filters">${keys.map(k => { const d = FILTER_DEF[k]; const locked = d.lock && d.lock();
    return `<label>${d.label}<select data-f="${k}" ${locked ? 'disabled' : ''}>${d.opts().map(([v, l]) => `<option value="${esc(v)}" ${String(S.F[k] ?? '') === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`; }).join('')}
    <span style="flex:1"></span><small style="color:var(--muted)">Số liệu đến ${dstr(S.asOf)} · Tiến độ thời gian ${periodLabel()}: <b>${pct(timeProgress(periodMonths()), 0)}</b></small></div>`;
}

function render() {
  S.acts = {}; S.rows = {}; S.seq = 0;
  renderShell();
  const m = MODULES.find(x => x.id === S.mod) || MODULES[0];
  const tab = S.tab[m.id] || (m.tabs ? m.tabs[0] : '');
  const main = $('#main');
  main.innerHTML = `${S.mode === 'demo' ? `<div class="banner">Đang xem <b>dữ liệu DEMO</b> (tên khách hàng/nhân viên đã ẩn danh). Sau khi kết nối Lark Base, ứng dụng sẽ dùng dữ liệu thật và yêu cầu đăng nhập Lark.</div>` : ''}
    <div class="mhead"><span class="mbadge">${String(m.id).padStart(2, '0')}</span><span class="mtitle">${esc(m.title)}</span><span class="msub">${esc(m.sub || '')}</span><span class="grow"></span>${(m.actions ? m.actions(tab) : []).map(a => `<button class="btn ${a.cls || ''}" data-act="${act(a.fn)}">${esc(a.text)}</button>`).join(' ')}</div>
    ${m.tabs ? `<div class="tabs">${m.tabs.map(t => `<button class="tab ${t === tab ? 'on' : ''}" data-act="${act(() => go(m.id, t))}">${esc(t)}</button>`).join('')}</div>` : ''}
    ${m.filters ? filtersHTML(typeof m.filters === 'function' ? m.filters(tab) : m.filters) : ''}
    <div id="mbody"></div>`;
  try { m.render($('#mbody'), tab); } catch (e) { console.error(e); $('#mbody').innerHTML = `<div class="card empty">Lỗi hiển thị: ${esc(e.message)}</div>`; }
}

// sự kiện chung (bấm nút, chọn dòng, đổi bộ lọc)
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (a && S.acts[a.dataset.act]) { e.preventDefault(); S.acts[a.dataset.act](e); return; }
  const tr = e.target.closest('tr[data-t]'); if (tr && S.rows[tr.dataset.t]) { const h = S.rows[tr.dataset.t]; h.fn(h.rows[+tr.dataset.i]); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.f; if (!k) return;
  S.F[k] = e.target.value === '' ? '' : (['nam', 'quy', 'thang'].includes(k) ? +e.target.value : e.target.value);
  if (k === 'thang' && S.F.thang) S.F.quy = Math.ceil(S.F.thang / 3);
  if (k === 'quy' && S.F.thang && Math.ceil(S.F.thang / 3) !== S.F.quy) S.F.thang = '';
  if (k === 'nhom') S.F.nv = S.user.role === 'NVKD' ? S.F.nv : '';
  render();
});

function showLogin(url = '/api/auth/login') {
  $('#sidebar').innerHTML = ''; $('#journey').innerHTML = ''; $('#userbox').innerHTML = '';
  const out = new URLSearchParams(location.search).get('loggedout');
  $('#main').innerHTML = `<div class="login-card"><div class="logo" style="margin:0 auto 14px;background:var(--blue-soft)"><svg viewBox="0 0 32 32"><path d="M5 22l7-9 6 6 9-12" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round"/></svg></div>
    <h2>${esc(C.APP_NAME)}</h2><p style="color:var(--muted)">${out ? 'Bạn đã đăng xuất.' : 'Vui lòng đăng nhập bằng tài khoản Lark của công ty.'}</p>
    <a class="btn" style="display:inline-block;text-decoration:none;margin-top:8px" href="${esc(url)}">Đăng nhập với Lark</a></div>`;
  if (!out && /Lark|Feishu/i.test(navigator.userAgent)) location.href = url; // mở trong Lark → tự đăng nhập
}

async function reload() {
  if (S.mode !== 'live') return toast('Chế độ demo: dữ liệu cố định');
  $('#main').innerHTML = `<div class="loading"><div class="spinner"></div><div id="loadingText">Đang làm mới…</div><div class="progress"><span id="loadingBar"></span></div></div>`;
  try { await loadLive(true); computeAsOf(); render(); toast('Đã cập nhật dữ liệu mới nhất'); } catch (e) { if (e.message !== 'login') toast(e.message, true); }
}

async function boot() {
  let me = { mode: 'demo' };
  try { const r = await fetch('/api/me'); if (r.ok) me = await r.json(); } catch { /* mở file trực tiếp → demo */ }
  try {
    if (me.mode === 'login') return showLogin(me.loginUrl);
    if (me.mode === 'live') { S.mode = 'live'; S.user = me.user; await loadLive(); }
    else {
      if (!C.ALLOW_DEMO) { $('#main').innerHTML = '<div class="login-card"><h2>Chưa kết nối Lark</h2><p>Quản trị cần khai báo biến môi trường trên Cloudflare.</p></div>'; return; }
      S.mode = 'demo'; S.user = { name: 'Người dùng demo', role: 'Admin', maNV: '', team: '' }; await loadDemo();
    }
  } catch (e) {
    if (e.message === 'login') return;
    $('#main').innerHTML = `<div class="login-card" style="max-width:640px;text-align:left"><h2>Không tải được dữ liệu</h2><p>${esc(e.message)}</p><p>Mở <a href="/api/health" target="_blank">/api/health</a> để xem chi tiết lỗi cấu hình.</p></div>`; return;
  }
  computeAsOf();
  const months = uniq(S.db.THUC_HIEN.filter(r => num(r['Năm']) === S.asOf.getFullYear()).map(r => num(r['Tháng'])));
  S.F = { nam: S.asOf.getFullYear(), quy: '', thang: '', nhom: '', nv: '', sp: '', loai: '' };
  S.lastMonth = months.length ? Math.max(...months) : S.asOf.getMonth() + 1;
  if (S.user.role === 'Trưởng nhóm') S.F.nhom = S.user.team;
  if (S.user.role === 'NVKD') { S.F.nhom = S.user.team; S.F.nv = S.user.maNV; }
  const h = location.hash.match(/^#m(\d)/); if (h) S.mod = +h[1];
  render();
}
let rzT; let lastW = window.innerWidth; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (Math.abs(window.innerWidth - lastW) > 40 && S.F.nam && $('#modalBack').hidden) { lastW = window.innerWidth; render(); } }, 400); });
window.addEventListener('DOMContentLoaded', () => setTimeout(boot, 0));
