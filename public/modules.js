/* =============================================================
   8 PHÂN HỆ CỦA TL SALES PERFORMANCE
   ============================================================= */
S.L = S.L || {}; S.q = S.q || {};
const PRODUCTS = () => C.PRODUCTS;
const monthSel = () => +S.F.thang || S.lastMonth;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const LOCAL_DEF = {};
function localSel(key, label, opts, def = '') {
  if (S.L[key] === undefined) S.L[key] = def;
  return `<label style="display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)">${label}<select data-l="${key}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(S.L[key]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`;
}
function searchBox(key, ph = 'Tìm…') { return `<input data-q="${key}" placeholder="${esc(ph)}" value="${esc(S.q[key] || '')}" style="min-width:220px">`; }
const match = (key, ...vals) => { const q = (S.q[key] || '').trim().toLowerCase(); return !q || vals.some(v => String(v ?? '').toLowerCase().includes(q)); };
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.l; if (k) { S.L[k] = e.target.value; render(); } });
let qTimer; document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.q; if (!k) return; S.q[k] = e.target.value; clearTimeout(qTimer);
  qTimer = setTimeout(() => { render(); const el = document.querySelector(`[data-q="${k}"]`); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 300);
});
const isFuture = (m, y = +S.F.nam) => y > S.asOf.getFullYear() || (y === S.asOf.getFullYear() && m > S.asOf.getMonth() + 1);
const isOverdue = (r) => r['Trạng thái'] !== 'Đã đóng' && toDate(r['Hạn hoàn thành']) && toDate(r['Hạn hoàn thành']) < new Date(new Date().toDateString());
const nvOptions = (team) => [['', '— Chọn —'], ...S.db.DM_NHANVIEN.filter(r => !team || r['Mã nhóm'] === team || ['Admin', 'Trưởng phòng'].includes(r['Vai trò'])).map(r => [r['Mã NV'], `${r['Họ tên']} (${r['Mã NV']})`])];
const teamOptions = () => [['', '— Chọn —'], ...S.db.DM_NHOM.map(r => [r['Mã nhóm'], r['Tên nhóm']])];
const skuList = () => S.db.DM_SKU.map(r => r['Mã SKU']);
const tonOf = (sku) => S.db.TON_KHO.find(r => r['Mã SKU'] === sku) || {};
function skuTargets(m, y = S.F.nam) {
  return S.db.MUC_TIEU.filter(r => r['Cấp phân bổ'] === 'SKU' && num(r['Năm']) === +y && num(r['Tháng']) === m && effective(r) && (!S.F.sp || r['Sản phẩm'] === S.F.sp));
}
function skuGapRows(m) {
  const act = groupSum(actualRows(filt({ months: [m], sku: '' })), r => r['Mã SKU'], SL);
  const tp = timeProgress([m]);
  return skuTargets(m).map(r => { const sku = r['Mã đối tượng']; const T = num(r['MT final']); const A = act.get(sku) || 0; const t = tonOf(sku);
    return { sku, sp: r['Sản phẩm'], T, A, rate: T ? A / T : null, gap: T - A, need: Math.max(0, T - A), ton: num(t['Tồn khả dụng (tấn)']), ve: num(t['Hàng đang về (tấn)']), old: num(t['Tồn >90 ngày (tấn)']), tp, focus: (S.db.DM_SKU.find(s => s['Mã SKU'] === sku) || {})['SKU trọng điểm'] }; })
    .sort((a, b) => b.gap - a.gap);
}

// ---------- tạo / sửa hồ sơ PDCA (dùng chung) ----------
const CAUSES = ['', 'Nhu cầu thị trường', 'Giá / cạnh tranh', 'Nguồn hàng', 'Khách hàng', 'Kế hoạch chưa khả thi', 'Năng lực bán', 'Khác'];
function issueForm(row = {}, prefill = {}) {
  const v = { 'Năm': S.F.nam, 'Tháng': monthSel(), 'Trạng thái': 'Mới', 'Mã nhóm': S.user.team || '', ...prefill, ...row };
  const isNew = !row._id;
  openForm({
    title: isNew ? 'Tạo hồ sơ xử lý thiếu hụt' : 'Hồ sơ ' + (row['Mã VĐ'] || ''), values: v,
    fields: [
      { k: 'Loại đối tượng', type: 'select', opts: ['SKU', 'NVKD', 'Nhóm', 'Khách hàng', 'Sản phẩm', 'Khu vực'], req: true },
      { k: 'Mã đối tượng', label: 'Đối tượng (mã SKU / NV / nhóm…)', req: true, list: skuList() },
      { k: 'Năm', type: 'number' }, { k: 'Tháng', type: 'number' },
      { k: 'Chỉ tiêu', type: 'number', label: 'Chỉ tiêu (tấn)' }, { k: 'Thực hiện', type: 'number', label: 'Thực hiện (tấn)' },
      { k: 'Nhóm nguyên nhân', type: 'select', opts: CAUSES }, { k: 'Mã nhóm', type: 'select', opts: teamOptions(), label: 'Nhóm KD' },
      { k: 'Nguyên nhân', type: 'textarea' }, { k: 'Hành động', type: 'textarea', label: 'Hành động khắc phục / phương án bù' },
      { k: 'Mã NV thực hiện', type: 'select', opts: nvOptions(), label: 'Người thực hiện' }, { k: 'Mã NV kiểm tra', type: 'select', opts: nvOptions(), label: 'Người kiểm tra' },
      { k: 'Hạn hoàn thành', type: 'date' }, { k: 'Trạng thái', type: 'select', opts: ['Mới', 'Đang xử lý', 'Chờ kiểm tra', 'Đã đóng'] },
      { k: 'Kết quả', type: 'textarea', label: 'Kết quả sau thực hiện' }, { k: 'Hiệu quả', type: 'select', opts: ['', 'Đạt', 'Chưa đạt'], label: 'Đánh giá hiệu quả' },
    ],
    onSave: async (f) => {
      if (f['Trạng thái'] === 'Đã đóng' && (!f['Kết quả'] || !f['Hiệu quả'])) throw new Error('Chỉ đóng hồ sơ khi đã có Kết quả và Đánh giá hiệu quả (không đóng chỉ vì đã gửi báo cáo).');
      f['Chênh lệch'] = (f['Thực hiện'] || 0) - (f['Chỉ tiêu'] || 0);
      if (isNew) { f['Mã VĐ'] = nextCode('VAN_DE', 'Mã VĐ', 'VD'); f['Ngày tạo'] = Date.now(); }
      await save('VAN_DE', f, row._id);
    },
  });
}

// =============================================================
// 01 — TỔNG QUAN ĐIỀU HÀNH
// =============================================================
MODULES.push({
  id: 1, title: 'Tổng quan điều hành', short: 'Tổng quan', sub: 'Dashboard toàn Phòng Kinh doanh',
  filters: ['nam', 'quy', 'thang', 'nhom', 'nv', 'sp', 'loai'],
  render(el) {
    const f = filt(); const tp = timeProgress(f.months);
    const T = target(f), A = actual(f), TD = targetDS(f), AD = actualDS(f), FC = forecast(f);
    const open = S.db.VAN_DE.filter(r => r['Trạng thái'] !== 'Đã đóng'); const od = open.filter(isOverdue);
    el.innerHTML = `
    <div class="grid g4">
      ${kpi('Sản lượng mục tiêu', fmt(T), 'tấn', periodLabel())}
      ${kpi('Sản lượng thực hiện', fmt(A), 'tấn', `${statusChip(A / T, tp)} <b>${pct(A / T)}</b> mục tiêu · dự báo ${fmt(FC)} tấn`)}
      ${kpi('Doanh số mục tiêu', fmt(TD, 0), 'tỷ', '<span class="msub">Phân bổ theo tỷ trọng mục tiêu sản lượng</span>')}
      ${kpi('Doanh số thực hiện', fmt(AD, 1), 'tỷ', `${statusChip(AD / TD, tp)} <b>${pct(AD / TD)}</b> mục tiêu`)}
    </div>
    <div class="grid g21" style="margin-top:14px">
      <div class="card"><h4>Tiến độ sản lượng theo tháng <small>(tấn)</small></h4><div id="c1"></div></div>
      <div class="card"><h4>Cơ cấu sản lượng theo nhóm sản phẩm</h4><div id="c2"></div></div>
    </div>
    <div class="grid g3" style="margin-top:14px">
      <div class="card"><h4>Mức đạt theo nhóm kinh doanh<span class="sp"></span><small>vạch đen = tiến độ thời gian</small></h4><div id="teams"></div></div>
      <div class="card"><h4>Hàng tồn / Hàng đặt</h4><div id="tonDat"></div></div>
      <div class="card"><h4>Vấn đề cần điều hành<span class="sp"></span>${chip(open.length + ' đang mở', 'b')} ${od.length ? chip(od.length + ' quá hạn', 'r') : ''}</h4><div id="alerts"></div></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h4>Top SKU không đạt mục tiêu <small>Tháng ${f.months.length === 1 ? f.months[0] : S.lastMonth}</small></h4><div id="topsku"></div></div>
      <div class="card"><h4>Kết quả theo NVKD <small>${periodLabel()}</small></h4><div id="nvk"></div></div>
    </div>`;
    // biểu đồ tháng
    const tg = MONTHS.map(m => target(filt({ months: [m] }))), ac = MONTHS.map(m => actual(filt({ months: [m] })));
    Charts.combo($('#c1'), { labels: MONTHS.map(m => 'T' + m), bars: [{ name: 'Mục tiêu', values: tg, color: '#a9c4f5' }, { name: 'Thực hiện', values: ac, color: '#1f6feb' }],
      lines: [{ name: 'Tỷ lệ đạt', values: MONTHS.map((m, i) => tg[i] && !isFuture(m) ? ac[i] / tg[i] : null), pct: true, color: '#ef4444' }] });
    const bySp = groupSum(actualRows(f), r => r['Sản phẩm'], SL);
    Charts.donut($('#c2'), { items: [...bySp].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k || '(khác)', value: v })), center: fmt(A), sub: 'tấn' });
    // nhóm
    const teams = S.user.role === 'NVKD' ? [] : S.db.DM_NHOM.map(t => { const ff = filt({ team: t['Mã nhóm'], nv: '' }); const Tt = target(ff), At = actual(ff); return { t, Tt, At }; }).filter(x => x.Tt || x.At);
    $('#teams').innerHTML = teams.length ? bars(teams.map(x => ({ label: x.t['Tên nhóm'], value: x.Tt ? x.At / x.Tt : 0, mark: tp, max: 1.2, text: x.Tt ? pct(x.At / x.Tt, 0) : '<span class="msub" style="font-weight:400">chưa MT</span>',
      color: colorFor(x.At / x.Tt, tp), title: `MT ${fmt(x.Tt)} – TH ${fmt(x.At)} tấn`, onClick: () => go(5, 'Theo NVKD', { nhom: x.t['Mã nhóm'] }) })), { max: 1.2 }) : '<div class="empty">Chưa có dữ liệu</div>';
    // tồn / đặt
    $('#tonDat').innerHTML = ['Hàng tồn', 'Hàng đặt'].map(l => { const ff = filt({ loai: l }); const Tl = target(ff), Al = actual(ff);
      return `<div style="margin:6px 0 14px"><div style="display:flex;justify-content:space-between"><b>${l}</b><span>${fmt(Al)} / ${Tl ? fmt(Tl) : '—'} tấn</span></div>${bars([{ label: '', value: Tl ? Al / Tl : 0, mark: tp, text: Tl ? pct(Al / Tl, 0) : '—', color: colorFor(Al / Tl, tp) }], { max: 1.2 })}</div>`; }).join('') +
      `<div class="msub" style="font-size:12px">Mục tiêu hàng tồn/đặt lấy từ mục tiêu cấp Nhóm (cột Loại hàng).</div>`;
    // cảnh báo
    $('#alerts').innerHTML = alertsHTML(f, T, A, tp, od);
    // top SKU
    const m = f.months.length === 1 ? f.months[0] : S.lastMonth;
    const sk = skuGapRows(m).filter(r => r.gap > 0).slice(0, 8);
    $('#topsku').innerHTML = table([{ k: 'sku', t: 'SKU', wrap: true }, { k: 'T', t: 'MT (tấn)', num: true }, { k: 'A', t: 'TH (tấn)', num: true }, { k: 'rate', t: '%', f: v => pct(v, 0) },
      { k: 'gap', t: 'Chênh lệch', num: true, cls: () => 'neg', f: v => fmt(-v) }, { k: 'x', t: '', f: (v, r) => `<button class="btn sm ghost" data-act="${act(() => issueForm({}, { 'Loại đối tượng': 'SKU', 'Mã đối tượng': r.sku, 'Tháng': m, 'Chỉ tiêu': r.T, 'Thực hiện': Math.round(r.A * 10) / 10 }))}">Xử lý</button>` }], sk, { maxH: 330 });
    // NVKD
    const nvs = S.db.DM_NHANVIEN.filter(n => n['Vai trò'] !== 'Admin').map(n => { const ff = filt({ nv: n['Mã NV'], team: '' }); return { n, Tn: target(ff), An: actual(ff) }; }).filter(x => x.Tn || x.An > 1).sort((a, b) => b.An - a.An);
    $('#nvk').innerHTML = table([{ k: r => r.n['Họ tên'], t: 'NVKD' }, { k: r => teamName(r.n['Mã nhóm']), t: 'Nhóm' }, { k: 'Tn', t: 'Mục tiêu', num: true }, { k: 'An', t: 'Thực hiện', num: true },
      { k: r => r.Tn ? r.An / r.Tn : null, t: '% đạt', f: v => pct(v, 0) }, { k: r => r.Tn ? r.An / r.Tn : NaN, t: 'Trạng thái', f: v => statusChip(v, tp) }], nvs,
      { maxH: 330, onRow: r => go(5, 'Chứng từ', { nv: r.n['Mã NV'] }) });
  },
});
function alertsHTML(f, T, A, tp, od) {
  const out = [];
  if (T && status(A / T, tp).c === 'r') out.push(['r', `Sản lượng ${periodLabel()} đạt ${pct(A / T, 0)}, thấp hơn tiến độ thời gian ${pct(tp, 0)}.`, () => go(5)]);
  const m = f.months.length === 1 ? f.months[0] : S.lastMonth;
  const pT = target(filt({ months: [m], team: '', nv: '', loai: '' }));
  const teamSum = sum(S.db.MUC_TIEU.filter(r => r['Cấp phân bổ'] === 'Nhóm' && num(r['Năm']) === f.nam && num(r['Tháng']) === m && effective(r)), r => r['MT final']);
  if (pT && !teamSum && isManager()) out.push(['a', `Tháng ${m} có mục tiêu Phòng ${fmt(pT)} tấn nhưng chưa phân bổ cho các nhóm KD.`, () => go(3, 'Kiểm tra phân bổ', { thang: m, quy: Math.ceil(m / 3) })]);
  const zero = skuGapRows(m).filter(r => r.T > 0 && r.A === 0);
  if (zero.length) out.push(['a', `${zero.length} SKU có mục tiêu tháng ${m} nhưng chưa phát sinh sản lượng.`, () => go(4, 'Theo SKU', { thang: m, quy: Math.ceil(m / 3) })]);
  if (S.user.role !== 'NVKD') S.db.DM_NHOM.forEach(t => { const ff = filt({ team: t['Mã nhóm'], nv: '' }); const Tt = target(ff), At = actual(ff); if (Tt && status(At / Tt, tp).c === 'r') out.push(['r', `${t['Tên nhóm']}: đạt ${pct(At / Tt, 0)} mục tiêu (${fmt(At)}/${fmt(Tt)} tấn).`, () => go(5, 'Theo NVKD', { nhom: t['Mã nhóm'] })]); });
  if (od.length) out.push(['r', `${od.length} hồ sơ PDCA quá hạn xử lý.`, () => go(7)]);
  const pend = S.db.MUC_TIEU.filter(r => r['Trạng thái'] === 'Chờ duyệt').length; if (pend) out.push(['b', `${pend} mục tiêu đang chờ duyệt.`, () => go(2, 'Danh sách & phê duyệt')]);
  const yc = S.db.YEU_CAU_HANG.filter(r => (r['Phê duyệt'] || 'Chờ duyệt') === 'Chờ duyệt' && ts(r['Hạn cần hàng']) >= S.asOf.getTime()).length; if (yc) out.push(['b', `${yc} yêu cầu nguồn hàng chờ phê duyệt.`, () => go(4, 'Yêu cầu nguồn hàng')]);
  if (!out.length) return '<div class="empty">Không có cảnh báo 👍</div>';
  return '<ul class="checks">' + out.slice(0, 7).map(([c, t, fn]) => `<li>${chip(c === 'r' ? 'Rủi ro' : c === 'a' ? 'Cảnh báo' : 'Việc cần làm', c)}<span style="flex:1">${esc(t)}</span><button class="btn sm ghost" data-act="${act(fn)}">Xem</button></li>`).join('') + '</ul>';
}

// =============================================================
// 02 — QUẢN TRỊ MỤC TIÊU
// =============================================================
function targetForm(row = {}) {
  const isNew = !row._id; const leader = isLeader();
  const v = { 'Năm': S.F.nam, 'Cấp kỳ': 'Tháng', 'Tháng': monthSel(), 'Cấp phân bổ': leader ? 'NVKD' : 'Phòng', 'Mã nhóm': leader ? S.user.team : '', 'Loại hàng': 'Tất cả', 'KPI': 'Sản lượng', 'ĐVT': 'Tấn', 'Điều chỉnh': 0, 'Trạng thái': isManager() ? 'Đã duyệt' : 'Chờ duyệt', ...row };
  const objList = [...S.db.DM_NHANVIEN.map(r => r['Mã NV']), ...S.db.DM_NHOM.map(r => r['Mã nhóm']), 'PKD', ...skuList()];
  openForm({
    title: isNew ? 'Tạo mục tiêu' : 'Sửa mục tiêu ' + (row['Mã MT'] || ''), values: v,
    fields: [
      { k: 'Năm', type: 'number', req: true }, { k: 'Cấp kỳ', type: 'select', opts: ['Tháng', 'Năm'] },
      { k: 'Tháng', type: 'number', help: 'Bỏ trống nếu Cấp kỳ = Năm' }, { k: 'Cấp phân bổ', type: 'select', opts: leader ? ['NVKD'] : ['Phòng', 'Nhóm', 'NVKD', 'SKU'] },
      { k: 'Mã đối tượng', req: true, list: objList, help: 'PKD / mã nhóm (KD1…) / mã NV / mã SKU' }, { k: 'Mã nhóm', type: 'select', opts: leader ? [[S.user.team, teamName(S.user.team)]] : teamOptions() },
      { k: 'Sản phẩm', type: 'select', opts: ['', 'TẤT CẢ', ...PRODUCTS()] }, { k: 'Dày/mỏng', type: 'select', opts: ['', 'Hàng dày', 'Hàng mỏng'] },
      { k: 'Loại hàng', type: 'select', opts: ['Tất cả', 'Hàng tồn', 'Hàng đặt'] }, { k: 'KPI', type: 'select', opts: ['Sản lượng', 'Doanh số'] },
      { k: 'MT ban đầu', type: 'number', req: true }, { k: 'Điều chỉnh', type: 'number' },
      { k: 'Trạng thái', type: 'select', opts: isManager() ? ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'] : ['Nháp', 'Chờ duyệt'] }, { k: 'ĐVT', type: 'select', opts: ['Tấn', 'Tỷ đồng'] },
      { k: 'Lý do điều chỉnh', type: 'textarea' }, { k: 'Ghi chú', type: 'textarea' },
    ],
    onSave: async (f) => {
      f['MT final'] = (f['MT ban đầu'] || 0) + (f['Điều chỉnh'] || 0);
      f['Quý'] = f['Tháng'] ? Math.ceil(f['Tháng'] / 3) : null;
      if (f['Cấp kỳ'] === 'Năm') f['Tháng'] = null;
      const lv = f['Cấp phân bổ'], code = f['Mã đối tượng'];
      f['Tên đối tượng'] = lv === 'NVKD' ? nvName(code) : lv === 'Nhóm' ? teamName(code) : lv === 'Phòng' ? 'Phòng Kinh doanh' : code;
      if (lv === 'Nhóm' && !f['Mã nhóm']) f['Mã nhóm'] = code;
      if (lv === 'NVKD' && !f['Mã nhóm']) f['Mã nhóm'] = (S.db.DM_NHANVIEN.find(r => r['Mã NV'] === code) || {})['Mã nhóm'] || '';
      if (isNew) { f['Mã MT'] = nextCode('MUC_TIEU', 'Mã MT', 'MT'); f['Người lập'] = S.user.name; }
      await save('MUC_TIEU', f, row._id);
    },
  });
}
const yearRows = () => S.db.MUC_TIEU.filter(r => num(r['Năm']) === +S.F.nam && r['Cấp phân bổ'] === 'Phòng' && r['Cấp kỳ'] === 'Năm' && (r['KPI'] || 'Sản lượng') === 'Sản lượng');
const phongMonth = (sp, m) => sum(S.db.MUC_TIEU.filter(r => num(r['Năm']) === +S.F.nam && r['Cấp phân bổ'] === 'Phòng' && r['Cấp kỳ'] === 'Tháng' && num(r['Tháng']) === m && r['Sản phẩm'] === sp && effective(r)), r => r['MT final']);
MODULES.push({
  id: 2, title: 'Quản trị mục tiêu', short: 'Mục tiêu', sub: 'Thiết lập mục tiêu năm, quý, tháng',
  tabs: ['Mục tiêu năm', 'Mục tiêu quý', 'Mục tiêu tháng', 'Điều chỉnh mục tiêu', 'Danh sách & phê duyệt'],
  filters: ['nam'],
  actions: () => canEdit() && (isManager() || isLeader()) ? [{ text: '+ Tạo mục tiêu', fn: () => targetForm() }] : [],
  render(el, tab) {
    const y = +S.F.nam; const ALL = MONTHS;
    if (tab === 'Mục tiêu năm') {
      const yr = yearRows(); const tot = sum(yr, r => r['MT final']);
      const ds = S.db.MUC_TIEU.find(r => num(r['Năm']) === y && r['KPI'] === 'Doanh số' && r['Cấp phân bổ'] === 'Phòng');
      const rows = yr.map(r => { const sp = r['Sản phẩm']; const q = [1, 2, 3, 4].map(k => sum([3 * k - 2, 3 * k - 1, 3 * k], m => phongMonth(sp, m)));
        const A = actual({ nam: y, months: ALL, team: '', nv: '', sp, loai: '' }); return { r, sp, q, sq: q[0] + q[1] + q[2] + q[3], A, w: tot ? num(r['MT final']) / tot : 0 }; });
      const total = { sp: 'TỔNG', r: { 'MT ban đầu': sum(yr, r => r['MT ban đầu']), 'Điều chỉnh': sum(yr, r => r['Điều chỉnh']), 'MT final': tot }, q: [0, 1, 2, 3].map(i => sum(rows, x => x.q[i])), sq: sum(rows, x => x.sq), A: sum(rows, x => x.A), w: 1 };
      el.innerHTML = `<div class="grid g4">${kpi('Mục tiêu sản lượng năm', fmt(tot), 'tấn', 'Tổng các nhóm sản phẩm (đã điều chỉnh)')}${kpi('Mục tiêu doanh số năm', ds ? fmt(num(ds['MT final'])) : '—', 'tỷ', ds ? stChip(ds['Trạng thái']) : 'Chưa khai báo')}
        ${kpi('Sản lượng lũy kế', fmt(total.A), 'tấn', pct(total.A / tot) + ' mục tiêu năm')}${kpi('Tổng mục tiêu các tháng', fmt(total.sq), 'tấn', Math.abs(total.sq - tot) > 1 ? `<span class="warn">Lệch ${fmt(total.sq - tot)} tấn so với mục tiêu năm</span>` : '<span class="up">Khớp mục tiêu năm</span>')}</div>
        <div class="card" style="margin-top:14px"><h4>Mục tiêu năm ${y} theo nhóm sản phẩm</h4>${table([
          { k: 'sp', t: 'Nhóm sản phẩm' }, { k: x => x.r['MT ban đầu'], t: 'MT ban đầu', num: true }, { k: x => x.r['Điều chỉnh'], t: 'Điều chỉnh', num: true, cls: v => num(v) < 0 ? 'neg' : num(v) > 0 ? 'pos' : '' },
          { k: x => x.r['MT final'], t: 'MT năm', num: true }, { k: 'w', t: 'Tỷ trọng', f: v => pct(v, 0) },
          { k: x => x.q[0], t: 'Q1', num: true }, { k: x => x.q[1], t: 'Q2', num: true }, { k: x => x.q[2], t: 'Q3', num: true }, { k: x => x.q[3], t: 'Q4', num: true },
          { k: x => x.sq - num(x.r['MT final']), t: 'Σ quý − MT năm', num: true, cls: v => Math.abs(v) > 1 ? 'neg' : '' },
          { k: 'A', t: 'Thực hiện', num: true }, { k: x => num(x.r['MT final']) ? x.A / num(x.r['MT final']) : null, t: '% đạt', f: v => pct(v, 0) },
          { k: x => x.r['Trạng thái'], t: 'Trạng thái', f: v => v ? stChip(v) : '' }], rows, { total, onRow: x => x.r._id && canEdit() && isManager() && targetForm(x.r) })}
          <p class="msub" style="font-size:12px">Ghi chú: “Σ quý − MT năm” khác 0 nghĩa là mục tiêu tháng chưa được phân rã khớp với mục tiêu năm – cần rà soát.</p></div>
        <div class="card" style="margin-top:14px"><h4>Mục tiêu và thực hiện theo nhóm sản phẩm</h4><div id="cy"></div></div>`;
      Charts.combo($('#cy'), { labels: rows.map(x => x.sp), bars: [{ name: 'MT năm', values: rows.map(x => num(x.r['MT final'])), color: '#a9c4f5' }, { name: 'Thực hiện', values: rows.map(x => x.A), color: '#1f6feb' }] });
    }
    if (tab === 'Mục tiêu quý') {
      const sps = PRODUCTS().filter(sp => MONTHS.some(m => phongMonth(sp, m)));
      const cell = (T, A, k) => `${fmt(A)} / ${fmt(T)} ${T ? statusChip(A / T, timeProgress([3 * k - 2, 3 * k - 1, 3 * k])) : ''}`;
      const rows = sps.map(sp => ({ sp, d: [1, 2, 3, 4].map(k => { const ms = [3 * k - 2, 3 * k - 1, 3 * k]; return { T: sum(ms, m => phongMonth(sp, m)), A: actual({ nam: y, months: ms, team: '', nv: '', sp, loai: '' }) }; }) }));
      const tot = { sp: 'TỔNG', d: [0, 1, 2, 3].map(i => ({ T: sum(rows, r => r.d[i].T), A: sum(rows, r => r.d[i].A) })) };
      el.innerHTML = `<div class="card"><h4>Mục tiêu quý (Thực hiện / Mục tiêu, tấn) — phân rã từ mục tiêu tháng cấp Phòng</h4>${table([{ k: 'sp', t: 'Nhóm sản phẩm' }, ...[1, 2, 3, 4].map(k => ({ k: r => r.d[k - 1], t: 'Quý ' + k, f: v => cell(v.T, v.A, k) }))], rows, { total: tot })}</div>
        <div class="card" style="margin-top:14px"><h4>So sánh theo quý</h4><div id="cq"></div></div>`;
      Charts.combo($('#cq'), { labels: ['Quý 1', 'Quý 2', 'Quý 3', 'Quý 4'], bars: [{ name: 'Mục tiêu', values: tot.d.map(x => x.T), color: '#a9c4f5' }, { name: 'Thực hiện', values: tot.d.map(x => x.A), color: '#1f6feb' }], lines: [{ name: '% đạt', values: tot.d.map(x => x.T ? x.A / x.T : null), pct: true }] });
    }
    if (tab === 'Mục tiêu tháng') {
      const sps = PRODUCTS().filter(sp => MONTHS.some(m => phongMonth(sp, m)));
      const rows = sps.map(sp => { const o = { sp }; MONTHS.forEach(m => o[m] = phongMonth(sp, m)); o.t = sum(MONTHS, m => o[m]); return o; });
      const tot = { sp: 'Tổng mục tiêu' }; MONTHS.forEach(m => tot[m] = sum(rows, r => r[m])); tot.t = sum(MONTHS, m => tot[m]);
      const ac = { sp: 'Thực hiện' }; MONTHS.forEach(m => ac[m] = actual({ nam: y, months: [m], team: '', nv: '', sp: '', loai: '' })); ac.t = sum(MONTHS, m => ac[m]);
      const pr = { sp: '% đạt' }; MONTHS.forEach(m => pr[m] = tot[m] && !isFuture(m) ? ac[m] / tot[m] : null); pr.t = tot.t ? ac.t / tot.t : null;
      const cols = [{ k: 'sp', t: 'Nhóm sản phẩm' }, ...MONTHS.map(m => ({ k: String(m), t: 'T' + m, f: (v, r) => r.sp === '% đạt' ? pct(v, 0) : fmt(v), num: true })), { k: 't', t: 'Cả năm', num: true, f: (v, r) => r.sp === '% đạt' ? pct(v, 0) : fmt(v) }];
      el.innerHTML = `<div class="card"><h4>Mục tiêu tháng cấp Phòng (MT final, tấn)</h4>${table(cols, [...rows, tot, ac, pr])}<p class="msub" style="font-size:12px">Muốn điều chỉnh mục tiêu tháng: vào tab “Danh sách & phê duyệt”, lọc Cấp phân bổ = Phòng, bấm vào dòng cần sửa.</p></div>
        <div class="card" style="margin-top:14px"><h4>Phân bổ mục tiêu theo mùa vụ</h4><div id="cm"></div></div>`;
      Charts.combo($('#cm'), { labels: MONTHS.map(m => 'T' + m), bars: sps.map((sp, i) => ({ name: sp, values: MONTHS.map(m => phongMonth(sp, m)), color: Charts.PALETTE[i] })) });
    }
    if (tab === 'Điều chỉnh mục tiêu') {
      const rows = S.db.MUC_TIEU.filter(r => num(r['Năm']) === y && num(r['Điều chỉnh']) !== 0).sort((a, b) => num(a['Tháng']) - num(b['Tháng']));
      el.innerHTML = `<div class="card"><h4>Các mục tiêu đã điều chỉnh (${rows.length}) <span class="sp"></span><small>Lịch sử chi tiết từng lần sửa: mở bản ghi trên Lark Base → “Lịch sử”</small></h4>${table([
        { k: r => r['Cấp kỳ'] === 'Năm' ? 'Năm' : 'T' + r['Tháng'], t: 'Kỳ' }, { k: 'Cấp phân bổ', t: 'Cấp' }, { k: 'Tên đối tượng', t: 'Đối tượng' }, { k: 'Sản phẩm', t: 'Sản phẩm' }, { k: 'Loại hàng', t: 'Loại hàng' },
        { k: 'MT ban đầu', t: 'Ban đầu', num: true }, { k: 'Điều chỉnh', t: 'Điều chỉnh', num: true, cls: v => num(v) < 0 ? 'neg' : 'pos' }, { k: 'MT final', t: 'Cuối cùng', num: true },
        { k: 'Lý do điều chỉnh', t: 'Lý do', wrap: true }, { k: 'Trạng thái', t: 'Trạng thái', f: stChip }], rows, { onRow: r => canEdit() && targetForm(r) })}</div>`;
    }
    if (tab === 'Danh sách & phê duyệt') {
      const lv = localSel('mtLv', 'Cấp phân bổ', [['', 'Tất cả'], 'Phòng', 'Nhóm', 'NVKD', 'SKU'], '');
      const st = localSel('mtSt', 'Trạng thái', [['', 'Tất cả'], 'Nháp', 'Chờ duyệt', 'Đã duyệt', 'Từ chối'], '');
      const mo = localSel('mtMo', 'Tháng', [['', 'Tất cả'], ...MONTHS.map(m => [m, 'T' + m])], '');
      const rows = S.db.MUC_TIEU.filter(r => num(r['Năm']) === y && (!S.L.mtLv || r['Cấp phân bổ'] === S.L.mtLv) && (!S.L.mtSt || (r['Trạng thái'] || '') === S.L.mtSt) && (!S.L.mtMo || num(r['Tháng']) === +S.L.mtMo) && match('mt', r['Tên đối tượng'], r['Mã đối tượng'], r['Mã MT']));
      const approve = (r, s) => act(async () => { try { await save('MUC_TIEU', { 'Trạng thái': s }, r._id); render(); } catch (e) { toast(e.message, true); } });
      el.innerHTML = `<div class="card"><h4>${lv} ${mo} ${st} <span class="sp"></span>${searchBox('mt', 'Tìm đối tượng / mã MT')}</h4>${table([
        { k: 'Mã MT', t: 'Mã MT' }, { k: r => r['Cấp kỳ'] === 'Năm' ? 'Năm' : 'T' + r['Tháng'], t: 'Kỳ' }, { k: 'Cấp phân bổ', t: 'Cấp' }, { k: 'Tên đối tượng', t: 'Đối tượng' }, { k: r => teamName(r['Mã nhóm']), t: 'Nhóm' },
        { k: 'Sản phẩm', t: 'SP' }, { k: 'Dày/mỏng', t: 'Dày/mỏng' }, { k: 'Loại hàng', t: 'Loại hàng' }, { k: 'KPI', t: 'KPI' }, { k: 'MT final', t: 'MT final', num: true }, { k: 'Trạng thái', t: 'Trạng thái', f: stChip },
        { k: 'x', t: 'Thao tác', f: (v, r) => isManager() && canEdit() && r['Trạng thái'] === 'Chờ duyệt' ? `<button class="btn sm green" data-act="${approve(r, 'Đã duyệt')}">Duyệt</button> <button class="btn sm red" data-act="${approve(r, 'Từ chối')}">Từ chối</button>` : (r['Trạng thái'] === 'Nháp' && canEdit() ? `<button class="btn sm ghost" data-act="${approve(r, 'Chờ duyệt')}">Gửi duyệt</button>` : '') }],
        rows, { onRow: r => canEdit() && targetForm(r) })}</div>`;
    }
  },
});

// =============================================================
// 03 — PHÂN BỔ CHỈ TIÊU
// =============================================================
function allocData(m) {
  const y = +S.F.nam; const sp = S.F.sp;
  const rows = (lv) => S.db.MUC_TIEU.filter(r => num(r['Năm']) === y && r['Cấp phân bổ'] === lv && r['Cấp kỳ'] === 'Tháng' && num(r['Tháng']) === m && (r['KPI'] || 'Sản lượng') === 'Sản lượng' && effective(r) && (!sp || r['Sản phẩm'] === sp));
  const P = rows('Phòng'), N = rows('Nhóm'), V = rows('NVKD');
  const act = actualRows({ nam: y, months: [m], team: '', nv: '', sp, loai: '' });
  const aTeam = groupSum(act, r => r['Mã nhóm'], SL), aNv = groupSum(act, r => r['Mã NV'], SL);
  const teams = uniq([...N.map(r => r['Mã nhóm']), ...V.map(r => r['Mã nhóm'])]).filter(t => !isLeader() && S.user.role !== 'NVKD' || t === S.user.team);
  return { P, N, V, act, aTeam, aNv, teams, Tp: sum(P, r => r['MT final']) };
}
function nvAvg3(code, m) { const ms = [m - 3, m - 2, m - 1].filter(x => x > 0); return ms.length ? actual({ nam: +S.F.nam, months: ms, team: '', nv: code, sp: S.F.sp, loai: '' }) / ms.length : 0; }
MODULES.push({
  id: 3, title: 'Phân bổ chỉ tiêu', short: 'Phân bổ', sub: 'Giao mục tiêu theo nhóm và NVKD',
  tabs: ['Cây phân rã mục tiêu', 'Phân bổ theo NVKD', 'Phân bổ theo sản phẩm', 'Kiểm tra phân bổ'],
  filters: ['nam', 'thang', 'sp'],
  actions: () => canEdit() && (isManager() || isLeader()) ? [{ text: '+ Giao mục tiêu NVKD', fn: () => targetForm({ 'Cấp phân bổ': 'NVKD', 'Mã nhóm': S.user.team || '' }) }] : [],
  render(el, tab) {
    const m = monthSel(); const d = allocData(m); const tp = timeProgress([m]);
    const head = `<div class="banner info">Kỳ phân bổ: <b>Tháng ${m}/${S.F.nam}</b>${S.F.thang ? '' : ' (tháng gần nhất có số liệu – chọn Tháng ở bộ lọc để đổi)'}${S.F.sp ? ' · Sản phẩm: ' + esc(S.F.sp) : ''}</div>`;
    if (tab === 'Cây phân rã mục tiêu') {
      const node = (cls, name, T, alloc, A, open) => `<div class="node ${cls}"><span>${open !== undefined ? '<span class="caret">▶</span>' : ''} ${name}</span><span class="num">${fmt(T)}</span><span class="num">${alloc == null ? '—' : fmt(alloc)}</span><span class="num ${alloc != null && T - alloc > 0.5 ? 'warn' : ''}">${alloc == null ? '—' : fmt(T - alloc)}</span><span class="num">${alloc == null || !T ? '—' : pct(alloc / T, 0)}</span><span class="num">${fmt(A)}</span><span>${T ? statusChip(A / T, tp) + ' ' + pct(A / T, 0) : '—'}</span></div>`;
      const sumTeams = sum(d.N, r => r['MT final']);
      let h = `<div class="tree card"><div class="node head"><span>Đối tượng</span><span class="num">Mục tiêu</span><span class="num">Đã phân bổ</span><span class="num">Còn lại</span><span class="num">% phân bổ</span><span class="num">Thực hiện</span><span>% đạt</span></div>`;
      h += `<details open><summary>${node('', '<b>PHÒNG KINH DOANH</b>', d.Tp, sumTeams, sum(d.act, SL), true)}</summary>`;
      d.teams.forEach(t => {
        const Tt = sum(d.N.filter(r => r['Mã nhóm'] === t), r => r['MT final']); const nvs = d.V.filter(r => r['Mã nhóm'] === t);
        const codes = uniq(nvs.map(r => r['Mã đối tượng'])); const sNv = sum(nvs, r => r['MT final']);
        h += `<details><summary>${node('lv1', '<b>' + esc(teamName(t)) + '</b>', Tt, sNv, d.aTeam.get(t) || 0, true)}</summary>`;
        codes.forEach(c => { const Tn = sum(nvs.filter(r => r['Mã đối tượng'] === c), r => r['MT final']); h += node('lv2', esc(nvName(c)), Tn, null, d.aNv.get(c) || 0); });
        if (!codes.length) h += `<div class="node lv2"><span class="msub">Chưa giao mục tiêu cho NVKD</span></div>`;
        h += '</details>';
      });
      h += '</details></div>';
      el.innerHTML = head + h + `<p class="msub" style="font-size:12px">Bấm vào từng dòng nhóm để xem NVKD. “Còn lại” > 0: mục tiêu chưa được giao hết xuống cấp dưới.</p>`;
    }
    if (tab === 'Phân bổ theo NVKD') {
      const sps = uniq(d.V.map(r => r['Sản phẩm']));
      const codes = uniq(d.V.map(r => r['Mã đối tượng']));
      const extra = uniq(d.act.map(r => r['Mã NV'])).filter(c => !codes.includes(c) && (d.aNv.get(c) || 0) > 5);
      const rows = [...codes, ...extra].map(c => { const o = { c, team: (S.db.DM_NHANVIEN.find(r => r['Mã NV'] === c) || {})['Mã nhóm'] }; sps.forEach(sp => o[sp] = sum(d.V.filter(r => r['Mã đối tượng'] === c && r['Sản phẩm'] === sp), r => r['MT final']));
        o.T = sum(sps, sp => o[sp]); o.A = d.aNv.get(c) || 0; o.avg = nvAvg3(c, m); o.cap = o.avg ? o.T / o.avg : null; return o; }).filter(o => !isLeader() || o.team === S.user.team).sort((a, b) => b.T - a.T);
      el.innerHTML = head + `<div class="card">${table([{ k: r => nvName(r.c), t: 'NVKD' }, { k: r => teamName(r.team), t: 'Nhóm' }, ...sps.map(sp => ({ k: sp, t: sp, num: true })), { k: 'T', t: 'Tổng MT', num: true },
        { k: 'A', t: 'Thực hiện', num: true }, { k: r => r.T ? r.A / r.T : null, t: '% đạt', f: v => pct(v, 0) }, { k: 'avg', t: 'BQ 3 tháng trước', num: true },
        { k: 'cap', t: 'MT / BQ', f: v => v == null ? '—' : pct(v, 0) }, { k: r => r, t: 'Đánh giá', f: (v, r) => !r.T ? chip('Có bán, chưa có MT', 'a') : r.cap > C.CAPACITY_WARN ? chip('MT cao hơn năng lực', 'a') : r.cap && r.cap < 0.6 ? chip('MT thấp', 'b') : chip('Phù hợp', 'g') }], rows, { onRow: r => go(5, 'Chứng từ', { nv: r.c, thang: m, quy: Math.ceil(m / 3) }) })}</div>`;
    }
    if (tab === 'Phân bổ theo sản phẩm') {
      const sps = uniq([...d.P, ...d.N, ...d.V].map(r => r['Sản phẩm']));
      const rows = sps.map(sp => ({ sp, P: sum(d.P.filter(r => r['Sản phẩm'] === sp), r => r['MT final']), Nt: sum(d.N.filter(r => r['Sản phẩm'] === sp && r['Loại hàng'] === 'Hàng tồn'), r => r['MT final']), Nd: sum(d.N.filter(r => r['Sản phẩm'] === sp && r['Loại hàng'] === 'Hàng đặt'), r => r['MT final']), N: sum(d.N.filter(r => r['Sản phẩm'] === sp), r => r['MT final']), V: sum(d.V.filter(r => r['Sản phẩm'] === sp), r => r['MT final']), A: sum(d.act.filter(r => r['Sản phẩm'] === sp), SL) }));
      el.innerHTML = head + `<div class="card">${table([{ k: 'sp', t: 'Sản phẩm' }, { k: 'P', t: 'MT Phòng', num: true }, { k: 'N', t: 'Σ MT Nhóm', num: true }, { k: 'Nt', t: '  – Hàng tồn', num: true }, { k: 'Nd', t: '  – Hàng đặt', num: true }, { k: 'V', t: 'Σ MT NVKD', num: true },
        { k: r => r.P - r.N, t: 'Phòng − Nhóm', num: true, cls: v => Math.abs(v) > 0.5 ? 'neg' : '' }, { k: 'A', t: 'Thực hiện', num: true }, { k: r => r.P ? r.A / r.P : null, t: '% đạt', f: v => pct(v, 0) }], rows)}</div>`;
    }
    if (tab === 'Kiểm tra phân bổ') {
      const checks = []; const ok = (b) => b ? chip('Đạt', 'g') : chip('Cần xử lý', 'a');
      const sN = sum(d.N, r => r['MT final']);
      checks.push([Math.abs(d.Tp - sN) < 1, `Mục tiêu Phòng (${fmt(d.Tp)} tấn) đã được giao hết cho các nhóm (${fmt(sN)} tấn)?`, d.Tp - sN ? `Chênh ${fmt(d.Tp - sN)} tấn.` : '']);
      d.teams.forEach(t => { const Tt = sum(d.N.filter(r => r['Mã nhóm'] === t), r => r['MT final']); const sV = sum(d.V.filter(r => r['Mã nhóm'] === t), r => r['MT final']);
        checks.push([Math.abs(Tt - sV) < 1, `${teamName(t)}: mục tiêu nhóm ${fmt(Tt)} tấn – đã giao NVKD ${fmt(sV)} tấn?`, Tt - sV ? `Chênh ${fmt(Tt - sV)} tấn.` : '']); });
      const tdSum = sum(d.N.filter(r => ['Hàng tồn', 'Hàng đặt'].includes(r['Loại hàng'])), r => r['MT final']);
      checks.push([Math.abs(tdSum - sN) < 1, `Mục tiêu hàng tồn + hàng đặt khớp tổng mục tiêu nhóm?`, `Tồn + đặt = ${fmt(tdSum)}; tổng = ${fmt(sN)}.`]);
      const codes = uniq(d.V.map(r => r['Mã đối tượng']));
      const over = codes.map(c => ({ c, T: sum(d.V.filter(r => r['Mã đối tượng'] === c), r => r['MT final']), avg: nvAvg3(c, m) })).filter(x => x.avg && x.T / x.avg > C.CAPACITY_WARN);
      checks.push([!over.length, `Mục tiêu NVKD phù hợp năng lực (không vượt ${pct(C.CAPACITY_WARN, 0)} sản lượng BQ 3 tháng trước)?`, over.map(x => `${nvName(x.c)}: MT ${fmt(x.T)} / BQ ${fmt(x.avg)}`).join('; ')]);
      const noT = uniq(d.act.map(r => r['Mã NV'])).filter(c => c && !codes.includes(c) && (d.aNv.get(c) || 0) > 20);
      checks.push([!noT.length, 'NVKD có phát sinh sản lượng đều đã được giao mục tiêu? (sau khi chuyển khách hàng/khu vực cần điều chỉnh)', noT.map(c => `${nvName(c)} (${fmt(d.aNv.get(c))} tấn)`).join('; ')]);
      el.innerHTML = head + `<div class="card"><h4>Kết quả kiểm tra phân bổ tháng ${m}</h4><ul class="checks">${checks.map(([b, t, det]) => `<li>${ok(b)}<span><b>${esc(t)}</b>${det ? `<br><span class="msub">${esc(det)}</span>` : ''}</span></li>`).join('')}</ul></div>`;
    }
  },
});

// =============================================================
// 04 — KẾ HOẠCH BÁN HÀNG
// =============================================================
function planForm(row = {}) {
  const isNew = !row._id; const nvRole = S.user.role === 'NVKD';
  const v = { 'Năm': S.F.nam, 'Tháng': monthSel(), 'Xác suất (%)': 80, 'Trạng thái': 'Đang cập nhật', 'Mã nhóm': S.user.team || '', 'Mã NV': nvRole ? S.user.maNV : '', ...row };
  openForm({ title: isNew ? 'Thêm kế hoạch bán hàng' : 'Sửa kế hoạch ' + (row['Mã KH'] || ''), values: v, fields: [
    { k: 'Năm', type: 'number', req: true }, { k: 'Tháng', type: 'number', req: true }, { k: 'Tuần', type: 'number', req: true, help: 'Số tuần trong năm (VD 44)' }, { k: 'Từ ngày', type: 'date' },
    { k: 'Mã nhóm', type: 'select', opts: nvRole || isLeader() ? [[S.user.team, teamName(S.user.team)]] : teamOptions(), label: 'Nhóm KD' }, { k: 'Mã NV', type: 'select', opts: nvRole ? [[S.user.maNV, S.user.name]] : nvOptions(S.user.team), label: 'NVKD' },
    { k: 'Mã SKU', req: true, list: skuList() }, { k: 'Khách hàng', list: uniq(S.db.THUC_HIEN.map(r => r['Tên khách hàng'])).slice(0, 500) },
    { k: 'Sản lượng KH (tấn)', type: 'number', req: true }, { k: 'Xác suất (%)', type: 'number' },
    { k: 'Trạng thái', type: 'select', opts: ['Đang cập nhật', 'Đã xác nhận', 'Rủi ro'] }, { k: 'Ghi chú', type: 'textarea' }],
    onSave: async f => { f['Tên NV'] = nvName(f['Mã NV']); if (isNew) f['Mã KH'] = nextCode('KE_HOACH', 'Mã KH', 'KH'); await save('KE_HOACH', f, row._id); } });
}
function supplyForm(row = {}) {
  const isNew = !row._id; const nvRole = S.user.role === 'NVKD';
  const v = { 'Ngày đề xuất': Date.now(), 'Phê duyệt': 'Chờ duyệt', 'Mã nhóm': S.user.team || '', 'Mã NV': nvRole ? S.user.maNV : '', 'Tháng dự kiến': 'Tháng ' + monthSel(), ...row };
  openForm({ title: isNew ? 'Yêu cầu bổ sung nguồn hàng' : 'Yêu cầu ' + (row['Mã YC'] || ''), values: v, fields: [
    { k: 'Mã SKU', req: true, list: skuList(), full: true }, { k: 'Số lượng (tấn)', type: 'number', req: true }, { k: 'Tháng dự kiến' },
    { k: 'Kho đề xuất', type: 'select', opts: ['Kho Miền Bắc', 'Kho Miền Nam', 'Khác'] }, { k: 'Hình thức bổ sung', type: 'select', opts: ['Mua tồn kho', 'Điều chuyển', 'Gia công', 'Khác'] },
    { k: 'Hạn cần hàng', type: 'date', req: true }, { k: 'Ngày đề xuất', type: 'date' },
    { k: 'Mã NV', type: 'select', opts: nvRole ? [[S.user.maNV, S.user.name]] : nvOptions(S.user.team), label: 'Người yêu cầu' }, { k: 'Mã nhóm', type: 'select', opts: teamOptions(), label: 'Nhóm KD' },
    { k: 'Phê duyệt', type: 'select', opts: nvRole ? ['Chờ duyệt'] : ['Chờ duyệt', 'Đã duyệt', 'Từ chối'] }, { k: 'Ghi chú', type: 'textarea' }],
    onSave: async f => { f['Người yêu cầu'] = nvName(f['Mã NV']); if (isNew) f['Mã YC'] = nextCode('YEU_CAU_HANG', 'Mã YC', 'YC'); await save('YEU_CAU_HANG', f, row._id); } });
}
function customerStats(m, f = filt()) {
  const y = +S.F.nam; const prev = [m - 3, m - 2, m - 1].filter(x => x > 0);
  const base = S.db.THUC_HIEN.filter(r => num(r['Năm']) === y && (!f.team || r['Mã nhóm'] === f.team) && (!f.nv || r['Mã NV'] === f.nv) && (!f.sp || r['Sản phẩm'] === f.sp));
  const map = new Map();
  base.forEach(r => { const k = r['Mã khách hàng']; let o = map.get(k); if (!o) { o = { k, name: r['Tên khách hàng'], tinh: r['Tỉnh'], nv: r['Mã NV'], cur: 0, prev: 0, before: 0 }; map.set(k, o); }
    const mm = num(r['Tháng']); if (mm === m) o.cur += num(SL(r)); else if (prev.includes(mm)) o.prev += num(SL(r)); else if (mm < m) o.before += num(SL(r)); });
  return [...map.values()].map(o => { o.avg = prev.length ? o.prev / prev.length : 0; o.delta = o.cur - o.avg;
    o.cls = o.cur > 0 && o.prev === 0 && o.before === 0 ? 'Mới' : o.cur === 0 && o.prev > 0 ? 'Ngừng mua' : o.cur === 0 ? '' : o.avg && o.cur >= o.avg * 1.2 ? 'Tăng mua' : o.avg && o.cur <= o.avg * 0.8 ? 'Giảm mua' : 'Ổn định'; return o; }).filter(o => o.cls);
}
const CLS_COLOR = { 'Mới': 'b', 'Tăng mua': 'g', 'Giảm mua': 'a', 'Ngừng mua': 'r', 'Ổn định': '' };
MODULES.push({
  id: 4, title: 'Kế hoạch bán hàng', short: 'Kế hoạch', sub: 'Lập kế hoạch theo sản phẩm, SKU, khách hàng, tuần',
  tabs: ['Theo sản phẩm', 'Theo SKU', 'Theo khách hàng', 'Kế hoạch tuần', 'Yêu cầu nguồn hàng'],
  filters: (tab) => tab === 'Theo SKU' ? ['nam', 'thang', 'sp'] : ['nam', 'thang', 'nhom', 'nv', 'sp'],
  actions: (tab) => !canEdit() ? [] : tab === 'Kế hoạch tuần' ? [{ text: '+ Thêm kế hoạch', fn: () => planForm() }] : tab === 'Yêu cầu nguồn hàng' ? [{ text: '+ Tạo yêu cầu', fn: () => supplyForm() }] : [],
  render(el, tab) {
    const m = monthSel(); const tp = timeProgress([m]); const y = +S.F.nam;
    const head = `<div class="banner info">Kỳ kế hoạch: <b>Tháng ${m}/${y}</b> · Tiến độ thời gian ${pct(tp, 0)}</div>`;
    if (tab === 'Theo sản phẩm') {
      const f = filt({ months: [m] });
      const sps = PRODUCTS().filter(sp => target({ ...f, sp }) || actual({ ...f, sp }));
      const rows = sps.map(sp => { const ff = { ...f, sp }; const ar = actualRows(ff); return { sp, T: target(ff), A: sum(ar, SL), day: sum(ar.filter(r => r['Dày/mỏng'] === 'Hàng dày'), SL), mong: sum(ar.filter(r => r['Dày/mỏng'] === 'Hàng mỏng'), SL), ton: sum(ar.filter(r => r['Loại hàng'] === 'Hàng tồn'), SL), dat: sum(ar.filter(r => r['Loại hàng'] === 'Hàng đặt'), SL), FC: forecast(ff) }; });
      const tot = { sp: 'TỔNG' }; ['T', 'A', 'day', 'mong', 'ton', 'dat', 'FC'].forEach(k => tot[k] = sum(rows, r => r[k]));
      el.innerHTML = head + `<div class="card">${table([{ k: 'sp', t: 'Sản phẩm' }, { k: 'T', t: 'Mục tiêu', num: true }, { k: 'A', t: 'Thực hiện', num: true }, { k: r => r.T ? r.A / r.T : NaN, t: '% đạt', f: v => isFinite(v) ? pct(v, 0) + ' ' + statusChip(v, tp) : '—' },
        { k: r => Math.max(0, r.T - r.A), t: 'Còn phải bán', num: true }, { k: 'FC', t: 'Dự báo cuối tháng', num: true }, { k: 'day', t: 'Hàng dày', num: true }, { k: 'mong', t: 'Hàng mỏng', num: true }, { k: 'ton', t: 'Hàng tồn', num: true }, { k: 'dat', t: 'Hàng đặt', num: true }], rows, { total: tot })}</div>
        <div class="card" style="margin-top:14px"><h4>Mục tiêu – thực hiện – dự báo theo sản phẩm</h4><div id="c4"></div></div>`;
      Charts.combo($('#c4'), { labels: rows.map(r => r.sp), bars: [{ name: 'Mục tiêu', values: rows.map(r => r.T), color: '#a9c4f5' }, { name: 'Thực hiện', values: rows.map(r => r.A), color: '#1f6feb' }, { name: 'Dự báo', values: rows.map(r => r.FC), color: '#14b8a6' }] });
    }
    if (tab === 'Theo SKU') {
      const rows = skuGapRows(m);
      const focusNoT = S.db.DM_SKU.filter(s => s['SKU trọng điểm'] === 'Có' && !rows.some(r => r.sku === s['Mã SKU']));
      el.innerHTML = head + `<div class="card"><h4>Kế hoạch theo SKU – tháng ${m} <span class="sp"></span><small>${rows.length} SKU có mục tiêu</small></h4>${table([
        { k: 'sku', t: 'SKU' }, { k: 'focus', t: 'Trọng điểm', f: v => v === 'Có' ? chip('★', 'b') : '' }, { k: 'T', t: 'MT', num: true }, { k: 'A', t: 'Đã bán', num: true, d: 1 },
        { k: 'rate', t: '% đạt', f: (v, r) => v == null ? '—' : pct(v, 0) + ' ' + statusChip(v, r.tp) }, { k: 'need', t: 'Còn phải bán', num: true }, { k: 'ton', t: 'Tồn khả dụng', num: true },
        { k: 've', t: 'Hàng đang về', num: true }, { k: 'old', t: 'Tồn >90 ngày', num: true }, { k: r => r, t: 'Nguồn hàng', f: (v, r) => r.need <= 0 ? chip('Đã đạt', 'g') : r.ton + r.ve >= r.need ? chip('Đủ hàng', 'g') : chip('Thiếu ' + fmt(r.need - r.ton - r.ve), 'r') },
        { k: 'x', t: '', f: (v, r) => r.need > 0 && canEdit() ? `<button class="btn sm ghost" data-act="${act(() => issueForm({}, { 'Loại đối tượng': 'SKU', 'Mã đối tượng': r.sku, 'Tháng': m, 'Chỉ tiêu': r.T, 'Thực hiện': Math.round(r.A * 10) / 10 }))}">Tạo hồ sơ</button>` : '' }], rows)}</div>
        ${focusNoT.length ? `<div class="card" style="margin-top:14px"><h4>SKU trọng điểm chưa có mục tiêu tháng ${m} (${focusNoT.length})</h4>${focusNoT.map(s => chip(s['Mã SKU'], 'a')).join(' ')}</div>` : ''}`;
    }
    if (tab === 'Theo khách hàng') {
      const cs = customerStats(m); const cat = localSel('kh', 'Phân loại', [['', 'Tất cả'], 'Tăng mua', 'Giảm mua', 'Ngừng mua', 'Mới', 'Ổn định'], '');
      const rows = cs.filter(o => (!S.L.kh || o.cls === S.L.kh) && match('kh', o.name, o.k, o.tinh)).sort((a, b) => b.cur - a.cur || b.avg - a.avg);
      const cnt = (c) => cs.filter(o => o.cls === c);
      el.innerHTML = head + `<div class="grid g4">${['Tăng mua', 'Giảm mua', 'Ngừng mua', 'Mới'].map(c => kpi(c, fmt(cnt(c).length), 'KH', `Chênh lệch ${fmt(sum(cnt(c), o => o.delta))} tấn so với BQ 3 tháng`, c === 'Ngừng mua' ? 'alert' : '')).join('')}</div>
        <div class="card" style="margin-top:14px"><h4>${cat}<span class="sp"></span>${searchBox('kh', 'Tìm khách hàng / tỉnh')}</h4>${table([{ k: 'name', t: 'Khách hàng', wrap: true }, { k: 'tinh', t: 'Tỉnh' }, { k: r => nvName(r.nv), t: 'NVKD' },
          { k: 'cur', t: 'Tháng ' + m, num: true, d: 1 }, { k: 'avg', t: 'BQ 3 tháng trước', num: true, d: 1 }, { k: 'delta', t: 'Chênh lệch', num: true, d: 1, cls: v => v < 0 ? 'neg' : 'pos' }, { k: 'cls', t: 'Phân loại', f: v => chip(v, CLS_COLOR[v]) }], rows)}
          <p class="msub" style="font-size:12px">Gợi ý: khách “Giảm mua / Ngừng mua” là nguồn bù thiếu ưu tiên. Phân loại: Tăng ≥ +20%, Giảm ≤ −20% so với BQ 3 tháng trước.</p></div>`;
    }
    if (tab === 'Kế hoạch tuần') {
      const f = filt();
      const rows = S.db.KE_HOACH.filter(r => num(r['Năm']) === y && (!S.F.thang || num(r['Tháng']) === +S.F.thang) && (!f.team || r['Mã nhóm'] === f.team) && (!f.nv || r['Mã NV'] === f.nv))
        .map(r => { const a = sum(S.db.THUC_HIEN.filter(t => num(t['Năm']) === y && num(t['Tuần']) === num(r['Tuần']) && t['Mã SKU'] === r['Mã SKU'] && (!r['Mã nhóm'] || t['Mã nhóm'] === r['Mã nhóm']) && (!r['Mã NV'] || t['Mã NV'] === r['Mã NV']) && (!r['Khách hàng'] || t['Tên khách hàng'] === r['Khách hàng'])), SL); return { ...r, _a: a }; })
        .sort((a, b) => num(b['Tuần']) - num(a['Tuần']));
      const weeks = uniq(rows.map(r => num(r['Tuần']))).sort((a, b) => a - b);
      el.innerHTML = `<div class="card"><h4>Kế hoạch tuần vs thực hiện</h4><div id="cw"></div></div><div class="card" style="margin-top:14px">${table([
        { k: 'Tuần', t: 'Tuần' }, { k: 'Từ ngày', t: 'Từ ngày', f: dstr }, { k: 'Mã SKU', t: 'SKU' }, { k: r => teamName(r['Mã nhóm']), t: 'Nhóm' }, { k: r => r['Tên NV'] || nvName(r['Mã NV']), t: 'NVKD' }, { k: 'Khách hàng', t: 'Khách hàng' },
        { k: 'Sản lượng KH (tấn)', t: 'Kế hoạch', num: true }, { k: '_a', t: 'Đã bán', num: true, d: 1 }, { k: r => num(r['Sản lượng KH (tấn)']) ? r._a / num(r['Sản lượng KH (tấn)']) : null, t: '% đạt', f: v => pct(v, 0) },
        { k: 'Xác suất (%)', t: 'Xác suất', f: v => v ? fmt(v) + '%' : '' }, { k: 'Trạng thái', t: 'Trạng thái', f: stChip }], rows, { onRow: r => canEdit() && planForm(S.db.KE_HOACH.find(x => x._id === r._id)), empty: 'Chưa có kế hoạch tuần – bấm “+ Thêm kế hoạch”' })}</div>`;
      Charts.combo($('#cw'), { labels: weeks.map(w => 'Tuần ' + w), bars: [{ name: 'Kế hoạch', values: weeks.map(w => sum(rows.filter(r => num(r['Tuần']) === w), r => r['Sản lượng KH (tấn)'])), color: '#a9c4f5' }, { name: 'Đã bán (SKU trong kế hoạch)', values: weeks.map(w => sum(rows.filter(r => num(r['Tuần']) === w), r => r._a)), color: '#1f6feb' }], height: 200 });
    }
    if (tab === 'Yêu cầu nguồn hàng') {
      const f = filt(); const st = localSel('yc', 'Phê duyệt', [['', 'Tất cả'], 'Chờ duyệt', 'Đã duyệt', 'Từ chối'], '');
      const rows = S.db.YEU_CAU_HANG.filter(r => (!f.team || r['Mã nhóm'] === f.team) && (!f.nv || r['Mã NV'] === f.nv) && (!S.L.yc || (r['Phê duyệt'] || 'Chờ duyệt') === S.L.yc) && match('yc', r['Mã SKU'], r['Người yêu cầu']))
        .sort((a, b) => ts(b['Ngày đề xuất']) - ts(a['Ngày đề xuất']));
      const appr = (r, s) => act(async () => { try { await save('YEU_CAU_HANG', { 'Phê duyệt': s }, r._id); render(); } catch (e) { toast(e.message, true); } });
      el.innerHTML = `<div class="card"><h4>${st}<span class="sp"></span>${searchBox('yc', 'Tìm SKU / người yêu cầu')}</h4>${table([
        { k: 'Ngày đề xuất', t: 'Ngày đề xuất', f: dstr }, { k: 'Mã SKU', t: 'SKU' }, { k: 'Số lượng (tấn)', t: 'Số lượng (tấn)', num: true }, { k: 'Kho đề xuất', t: 'Kho' }, { k: 'Hình thức bổ sung', t: 'Hình thức' },
        { k: 'Hạn cần hàng', t: 'Hạn cần', f: dstr }, { k: 'Người yêu cầu', t: 'Người yêu cầu' }, { k: r => teamName(r['Mã nhóm']), t: 'Nhóm' }, { k: r => tonOf(r['Mã SKU'])['Tồn khả dụng (tấn)'], t: 'Tồn khả dụng', num: true },
        { k: r => r['Phê duyệt'] || 'Chờ duyệt', t: 'Phê duyệt', f: stChip }, { k: 'x', t: '', f: (v, r) => (isManager() || isLeader()) && canEdit() && (r['Phê duyệt'] || 'Chờ duyệt') === 'Chờ duyệt' ? `<button class="btn sm green" data-act="${appr(r, 'Đã duyệt')}">Duyệt</button> <button class="btn sm red" data-act="${appr(r, 'Từ chối')}">Từ chối</button>` : '' }],
        rows, { onRow: r => canEdit() && supplyForm(r) })}</div>`;
    }
  },
});

// =============================================================
// 05 — THEO DÕI THỰC HIỆN
// =============================================================
MODULES.push({
  id: 5, title: 'Theo dõi thực hiện', short: 'Thực hiện', sub: 'Kết quả, tiến độ và dự báo (Target – Actual – Forecast – Gap)',
  tabs: ['Theo thời gian', 'Theo NVKD', 'Theo nhóm', 'Theo SKU', 'Chứng từ'],
  filters: ['nam', 'quy', 'thang', 'nhom', 'nv', 'sp', 'loai'],
  render(el, tab) {
    const f = filt(); const tp = timeProgress(f.months);
    const T = target(f), A = actual(f), FC = forecast(f), G = T - FC;
    let h = `<div class="grid g4">${kpi('Target – Mục tiêu', fmt(T), 'tấn', periodLabel())}${kpi('Actual – Thực hiện', fmt(A), 'tấn', `${statusChip(A / T, tp)} ${pct(A / T)} · tiến độ thời gian ${pct(tp, 0)}`)}
      ${kpi('Forecast – Dự báo cuối kỳ', fmt(FC), 'tấn', `${pct(FC / T)} mục tiêu · theo tốc độ bán hiện tại`)}${kpi(G > 0 ? 'Gap – Còn thiếu dự kiến' : 'Gap – Vượt dự kiến', fmt(Math.abs(G)), 'tấn', G > 0 ? `Cần thêm ~${fmt(G / Math.max(1, sellLeft(f)), 1)} tấn/ngày bán còn lại` : 'Dự kiến vượt mục tiêu', G > 0 ? 'alert' : '')}</div><div style="margin-top:14px" id="m5"></div>`;
    el.innerHTML = h; const box = $('#m5');
    if (tab === 'Theo thời gian') {
      if (f.months.length === 1) {
        const m = f.months[0]; const last = new Date(f.nam, m, 0).getDate(); const days = [...Array(last)].map((_, i) => i + 1);
        const daily = groupSum(actualRows(f), r => toDate(r['Ngày']).getDate(), SL); let c = 0; const tot = sellingDays(f.nam, m);
        const cum = days.map(d => { c += daily.get(d) || 0; const dt = new Date(f.nam, m - 1, d); return dt <= S.asOf ? c : null; });
        const tline = days.map(d => T * sellingDays(f.nam, m, d) / tot); const rate = (FC - A) / Math.max(1, tot - sellingDays(f.nam, m, S.asOf.getMonth() + 1 === m ? S.asOf.getDate() : last));
        let fc = A; const fline = days.map(d => { const dt = new Date(f.nam, m - 1, d); if (dt < S.asOf) return null; if (!C.OFF_DAYS.includes(dt.getDay()) && dt > S.asOf) fc += rate; return fc; });
        box.innerHTML = `<div class="card"><h4>Lũy kế sản lượng trong tháng ${m} so với đường mục tiêu</h4><div id="ct"></div></div>`;
        Charts.combo($('#ct'), { labels: days.map(String), bars: [{ name: 'Sản lượng ngày', values: days.map(d => daily.get(d) || 0), color: '#cfe0fb' }], lines: [{ name: 'Lũy kế thực hiện', values: cum, color: '#1f6feb' }, { name: 'Đường mục tiêu', values: tline, color: '#64748b', dash: true }, { name: 'Dự báo', values: fline, color: '#14b8a6', dash: true }], height: 280 });
      } else {
        const ms = f.months; const tg = ms.map(m => target({ ...f, months: [m] })), ac = ms.map(m => actual({ ...f, months: [m] }));
        box.innerHTML = `<div class="card"><h4>Tiến độ theo tháng</h4><div id="ct"></div></div><div class="card" style="margin-top:14px">${table([{ k: 'm', t: 'Tháng', f: v => 'Tháng ' + v }, { k: 't', t: 'Mục tiêu', num: true }, { k: 'a', t: 'Thực hiện', num: true }, { k: r => r.t ? r.a / r.t : NaN, t: '% đạt', f: (v, r) => isFinite(v) ? pct(v, 0) + ' ' + statusChip(v, timeProgress([r.m])) : '—' }, { k: r => r.t - r.a, t: 'Chênh lệch', num: true, cls: v => v > 0 ? 'neg' : 'pos', f: v => fmt(-v) }], ms.map((m, i) => ({ m, t: tg[i], a: ac[i] })))}</div>`;
        Charts.combo($('#ct'), { labels: ms.map(m => 'T' + m), bars: [{ name: 'Mục tiêu', values: tg, color: '#a9c4f5' }, { name: 'Thực hiện', values: ac, color: '#1f6feb' }], lines: [{ name: '% đạt', values: ms.map((m, i) => tg[i] && !isFuture(m) ? ac[i] / tg[i] : null), pct: true }] });
      }
    }
    if (tab === 'Theo NVKD' || tab === 'Theo nhóm') {
      const byNv = tab === 'Theo NVKD';
      const list = byNv ? S.db.DM_NHANVIEN.filter(n => n['Vai trò'] !== 'Admin' && (!f.team || n['Mã nhóm'] === f.team) && (!f.nv || n['Mã NV'] === f.nv)).map(n => ({ code: n['Mã NV'], name: n['Họ tên'], team: n['Mã nhóm'], ff: { ...f, nv: n['Mã NV'], team: '' } }))
        : S.db.DM_NHOM.filter(t => !f.team || t['Mã nhóm'] === f.team).map(t => ({ code: t['Mã nhóm'], name: t['Tên nhóm'], team: t['Mã nhóm'], ff: { ...f, team: t['Mã nhóm'], nv: '' } }));
      const rows = list.map(x => ({ ...x, T: target(x.ff), A: actual(x.ff), FC: forecast(x.ff) })).filter(x => x.T || x.A > 0.5).sort((a, b) => (b.T ? b.A / b.T : -1) - (a.T ? a.A / a.T : -1));
      const tot = { name: 'TỔNG', T: sum(rows, r => r.T), A: sum(rows, r => r.A), FC: sum(rows, r => r.FC) };
      box.innerHTML = `<div class="card">${table([{ k: 'name', t: byNv ? 'NVKD' : 'Nhóm' }, ...(byNv ? [{ k: r => teamName(r.team), t: 'Nhóm' }] : []), { k: 'T', t: 'Mục tiêu', num: true }, { k: 'A', t: 'Thực hiện', num: true }, { k: 'FC', t: 'Dự báo', num: true },
        { k: r => r.T ? r.A / r.T : null, t: '% đạt', f: v => pct(v, 0) }, { k: r => r.T ? r.FC / r.T : null, t: '% dự báo', f: v => pct(v, 0) }, { k: r => r.T ? r.T - r.FC : null, t: 'Còn thiếu (dự báo)', num: true, cls: v => v > 0 ? 'neg' : 'pos' },
        { k: r => r.T ? r.A / r.T : NaN, t: 'Trạng thái', f: (v, r) => r.T ? statusChip(v, tp) : chip('Chưa có MT') }], rows, { total: tot, onRow: r => go(5, 'Chứng từ', byNv ? { nv: r.code } : { nhom: r.code, nv: '' }) })}
        <p class="msub" style="font-size:12px">Bấm vào một dòng để xem chứng từ bán hàng chi tiết (truy vết về Bravo).</p></div>`;
    }
    if (tab === 'Theo SKU') {
      const ar = actualRows(f); const g = groupSum(ar, r => r['Mã SKU'] || '(không SKU)', SL);
      const st = f.months.length === 1 ? new Map(skuTargets(f.months[0]).map(r => [r['Mã đối tượng'], num(r['MT final'])])) : new Map();
      const rows = [...g].map(([sku, a]) => ({ sku, a, t: st.get(sku) || null, ton: num(tonOf(sku)['Tồn khả dụng (tấn)']) })).sort((x, y) => y.a - x.a);
      box.innerHTML = `<div class="card"><h4>Sản lượng theo SKU – ${periodLabel()}<span class="sp"></span>${searchBox('sku5', 'Tìm SKU')}</h4>${table([{ k: 'sku', t: 'SKU' }, { k: 'a', t: 'Thực hiện', num: true, d: 1 }, { k: 't', t: 'Mục tiêu SKU', num: true }, { k: r => r.t ? r.a / r.t : null, t: '% đạt', f: v => pct(v, 0) }, { k: r => r.a / (A || 1), t: 'Tỷ trọng', f: v => pct(v, 1) }, { k: 'ton', t: 'Tồn khả dụng', num: true }],
        rows.filter(r => match('sku5', r.sku)), { onRow: r => { S.q.ct = r.sku; go(5, 'Chứng từ'); } })}</div>`;
    }
    if (tab === 'Chứng từ') {
      const rows = actualRows(f).filter(r => match('ct', r['Số CT'], r['Tên khách hàng'], r['Mã SKU'], r['Tên NV'], r['Tỉnh'])).sort((a, b) => ts(b['Ngày']) - ts(a['Ngày']));
      box.innerHTML = `<div class="card"><h4>Chứng từ bán hàng (${fmt(rows.length)} dòng · ${fmt(sum(rows, SL), 1)} tấn · ${fmt(sum(rows, r => r['Doanh số']) / 1e9, 2)} tỷ)<span class="sp"></span>${searchBox('ct', 'Tìm số CT / khách hàng / SKU / NVKD')}</h4>${table([
        { k: 'Ngày', t: 'Ngày', f: dstr }, { k: 'Số CT', t: 'Số CT (Bravo)' }, { k: 'Tên khách hàng', t: 'Khách hàng', wrap: true }, { k: 'Tỉnh', t: 'Tỉnh' }, { k: r => r['Tên NV'] || nvName(r['Mã NV']), t: 'NVKD' }, { k: r => teamName(r['Mã nhóm']), t: 'Nhóm' },
        { k: 'Sản phẩm', t: 'SP' }, { k: 'Mã SKU', t: 'SKU' }, { k: 'Loại hàng', t: 'Loại hàng' }, { k: 'Sản lượng (tấn)', t: 'Tấn', num: true, d: 2 }, { k: 'Doanh số', t: 'Doanh số (đ)', num: true }], rows)}</div>`;
    }
  },
});
function sellLeft(f) { let n = 0; f.months.forEach(m => { const tot = sellingDays(f.nam, m); const a = S.asOf; if (f.nam > a.getFullYear() || (f.nam === a.getFullYear() && m > a.getMonth() + 1)) n += tot; else if (f.nam === a.getFullYear() && m === a.getMonth() + 1) n += tot - sellingDays(f.nam, m, a.getDate()); }); return n; }

// =============================================================
// 06 — PHÂN TÍCH KINH DOANH
// =============================================================
MODULES.push({
  id: 6, title: 'Phân tích kinh doanh', short: 'Phân tích', sub: 'Phân tích nguyên nhân và cơ hội',
  tabs: ['Hiệu quả NVKD', 'Hiệu quả khách hàng', 'Hiệu quả SKU', 'Hiệu quả khu vực', 'Khả năng đáp ứng'],
  filters: (tab) => tab === 'Khả năng đáp ứng' || tab === 'Hiệu quả SKU' ? ['nam', 'thang', 'sp'] : ['nam', 'quy', 'thang', 'nhom', 'nv', 'sp'],
  render(el, tab) {
    const f = filt(); const tp = timeProgress(f.months); const m = monthSel();
    if (tab === 'Hiệu quả NVKD') {
      const nvs = S.db.DM_NHANVIEN.filter(n => n['Vai trò'] !== 'Admin' && (!f.team || n['Mã nhóm'] === f.team) && (!f.nv || n['Mã NV'] === f.nv));
      const cs = customerStats(f.months.length === 1 ? f.months[0] : m, { ...f, nv: '' });
      const rows = nvs.map(n => { const ff = { ...f, nv: n['Mã NV'], team: '' }; const T = target(ff), A = actual(ff);
        const gaps = PRODUCTS().map(sp => ({ sp, g: target({ ...ff, sp }) - actual({ ...ff, sp }) })).sort((a, b) => b.g - a.g);
        const down = cs.filter(o => o.nv === n['Mã NV'] && ['Giảm mua', 'Ngừng mua'].includes(o.cls));
        return { n, T, A, gap: gaps[0], down: down.length, lost: sum(down, o => -o.delta) }; }).filter(r => r.T || r.A > 1).sort((a, b) => (a.T ? a.A / a.T : 9) - (b.T ? b.A / b.T : 9));
      el.innerHTML = `<div class="card"><h4>Ai đạt, ai thiếu – thiếu do nhóm hàng/khách hàng nào? <small>${periodLabel()}</small></h4>${table([{ k: r => r.n['Họ tên'], t: 'NVKD' }, { k: r => teamName(r.n['Mã nhóm']), t: 'Nhóm' }, { k: 'T', t: 'Mục tiêu', num: true }, { k: 'A', t: 'Thực hiện', num: true },
        { k: r => r.T ? r.A / r.T : NaN, t: '% đạt', f: (v, r) => r.T ? pct(v, 0) + ' ' + statusChip(v, tp) : chip('Chưa MT') }, { k: r => r.gap && r.gap.g > 0.5 ? `${r.gap.sp}: thiếu ${fmt(r.gap.g)} t` : '—', t: 'Thiếu nhiều nhất ở' },
        { k: 'down', t: 'KH giảm/ngừng mua', num: true }, { k: 'lost', t: 'Sản lượng hụt từ KH (t)', num: true, d: 1 }], rows, { onRow: r => go(5, 'Chứng từ', { nv: r.n['Mã NV'] }) })}</div><div class="card" style="margin-top:14px"><h4>Mục tiêu và thực hiện theo NVKD</h4><div id="c6"></div></div>`;
      const top = rows.filter(r => r.T).slice(0, 14);
      Charts.combo($('#c6'), { labels: top.map(r => r.n['Họ tên'].split(' ').slice(-2).join(' ')), bars: [{ name: 'Mục tiêu', values: top.map(r => r.T), color: '#a9c4f5' }, { name: 'Thực hiện', values: top.map(r => r.A), color: '#1f6feb' }], lines: [{ name: '% đạt', values: top.map(r => r.A / r.T), pct: true }] });
    }
    if (tab === 'Hiệu quả khách hàng') { MODULES.find(x => x.id === 4).render(el, 'Theo khách hàng'); return; }
    if (tab === 'Hiệu quả SKU') {
      const y = +S.F.nam; const ytdMonths = MONTHS.filter(x => x <= S.lastMonth);
      const ar = S.db.THUC_HIEN.filter(r => num(r['Năm']) === y && (!f.sp || r['Sản phẩm'] === f.sp));
      const ytd = groupSum(ar, r => r['Mã SKU'], SL), cur = groupSum(ar.filter(r => num(r['Tháng']) === m), r => r['Mã SKU'], SL);
      const skus = uniq([...ytd.keys(), ...S.db.TON_KHO.filter(t => num(t['Tồn khả dụng (tấn)']) > 20 && (!f.sp || t['Sản phẩm'] === f.sp)).map(t => t['Mã SKU'])]);
      const rows = skus.map(sku => { const t = tonOf(sku); const avg = (ytd.get(sku) || 0) / ytdMonths.length; const ton = num(t['Tồn khả dụng (tấn)']); const cover = avg ? ton / avg : (ton ? 99 : 0);
        const note = ton > 50 && cover > 3 ? ['Tồn cao – cần đẩy bán', 'r'] : avg > 20 && cover < 0.5 ? ['Bán tốt – nguy cơ thiếu hàng', 'a'] : avg > 20 ? ['Bán tốt', 'g'] : ton > 20 && (cur.get(sku) || 0) < 1 ? ['Có tồn chưa khai thác', 'a'] : ['', ''];
        return { sku, ytd: ytd.get(sku) || 0, avg, cur: cur.get(sku) || 0, ton, old: num(t['Tồn >90 ngày (tấn)']), cover, note }; })
        .filter(r => (!S.L.skn || r.note[0] === S.L.skn) && match('sk6', r.sku)).sort((a, b) => b.ytd - a.ytd);
      el.innerHTML = `<div class="card"><h4>${localSel('skn', 'Nhận định', [['', 'Tất cả'], 'Tồn cao – cần đẩy bán', 'Bán tốt – nguy cơ thiếu hàng', 'Có tồn chưa khai thác', 'Bán tốt'], '')}<span class="sp"></span>${searchBox('sk6', 'Tìm SKU')}</h4>${table([{ k: 'sku', t: 'SKU' }, { k: 'ytd', t: 'Lũy kế năm', num: true }, { k: 'avg', t: 'BQ/tháng', num: true, d: 1 }, { k: 'cur', t: 'Tháng ' + m, num: true, d: 1 },
        { k: 'ton', t: 'Tồn khả dụng', num: true }, { k: 'old', t: 'Tồn >90 ngày', num: true }, { k: 'cover', t: 'Số tháng tồn', f: v => v >= 99 ? '∞' : fmt(v, 1) }, { k: 'note', t: 'Nhận định', f: v => v[0] ? chip(v[0], v[1]) : '' }], rows)}
        <p class="msub" style="font-size:12px">Số tháng tồn = Tồn khả dụng ÷ sản lượng bình quân tháng. Tồn kho lấy theo ngày chốt mới nhất trong bảng TON_KHO.</p></div>`;
    }
    if (tab === 'Hiệu quả khu vực') {
      const prevF = f.months.length === 1 ? { ...f, months: [f.months[0] - 1].filter(x => x > 0) } : f.months.length === 3 ? { ...f, months: f.months.map(x => x - 3).filter(x => x > 0) } : { ...f, nam: f.nam - 1 };
      const cur = actualRows(f), prev = actualRows(prevF);
      const g = groupSum(cur, r => r['Tỉnh'], SL), gp = groupSum(prev, r => r['Tỉnh'], SL);
      const rows = uniq([...g.keys(), ...gp.keys()]).map(p => { const rr = cur.filter(r => r['Tỉnh'] === p); return { p, mien: (rr[0] || prev.find(r => r['Tỉnh'] === p) || {})['Miền'], a: g.get(p) || 0, b: gp.get(p) || 0, kh: uniq(rr.map(r => r['Mã khách hàng'])).length, nv: uniq(rr.map(r => r['Mã NV'])).length }; }).sort((x, y) => y.a - x.a);
      const byM = groupSum(cur, r => r['Miền'] || '(khác)', SL);
      el.innerHTML = `<div class="grid g12"><div class="card"><h4>Cơ cấu theo miền</h4><div id="cmien"></div></div><div class="card"><h4>Khu vực còn dư địa / nguy cơ mất sản lượng <small>so với kỳ trước</small></h4>${table([{ k: 'p', t: 'Tỉnh' }, { k: 'mien', t: 'Miền' }, { k: 'a', t: 'Kỳ này', num: true }, { k: 'b', t: 'Kỳ trước', num: true },
        { k: r => r.b ? (r.a - r.b) / r.b : null, t: '+/-', f: v => v == null ? chip('Mới', 'b') : `<span class="${v < 0 ? 'down' : 'up'}">${pct(v, 0)}</span>` }, { k: 'kh', t: 'Số KH mua', num: true }, { k: 'nv', t: 'Số NVKD', num: true },
        { k: r => r, t: 'Đánh giá', f: (v, r) => r.b && r.a < r.b * 0.7 ? chip('Nguy cơ mất SL', 'r') : r.b && r.a > r.b * 1.2 ? chip('Tăng trưởng', 'g') : '' }], rows, { maxH: 460 })}</div></div>`;
      Charts.donut($('#cmien'), { items: [...byM].map(([k, v]) => ({ label: k, value: v })), center: fmt(sum(cur, SL)), sub: 'tấn' });
    }
    if (tab === 'Khả năng đáp ứng') {
      const rows = skuGapRows(m).map(r => { const pend = sum(S.db.YEU_CAU_HANG.filter(y => y['Mã SKU'] === r.sku && (y['Phê duyệt'] || 'Chờ duyệt') !== 'Từ chối' && ts(y['Hạn cần hàng']) >= S.asOf.getTime()), y => y['Số lượng (tấn)']); return { ...r, src: r.ton + r.ve, pend, bal: r.ton + r.ve - r.need }; });
      const short = rows.filter(r => r.bal < 0);
      el.innerHTML = `<div class="grid g3">${kpi('SKU có mục tiêu', rows.length, '', 'Tháng ' + m)}${kpi('SKU thiếu nguồn hàng', short.length, '', `Thiếu tổng ${fmt(-sum(short, r => r.bal))} tấn`, short.length ? 'alert' : '')}${kpi('Yêu cầu bổ sung đang mở', fmt(sum(rows, r => r.pend)), 'tấn', 'cho các SKU có mục tiêu')}</div>
        <div class="card" style="margin-top:14px"><h4>Tồn kho và hàng đang về có hỗ trợ kế hoạch bán không?</h4>${table([{ k: 'sku', t: 'SKU' }, { k: 'need', t: 'Còn phải bán', num: true }, { k: 'ton', t: 'Tồn khả dụng', num: true }, { k: 've', t: 'Hàng đang về', num: true },
          { k: 'bal', t: 'Cân đối', num: true, cls: v => v < 0 ? 'neg' : 'pos' }, { k: 'pend', t: 'Đã yêu cầu bổ sung', num: true }, { k: r => r, t: 'Đánh giá', f: (v, r) => r.need <= 0 ? chip('Đã đạt MT', 'g') : r.bal >= 0 ? chip('Đáp ứng', 'g') : r.bal + r.pend >= 0 ? chip('Đã có yêu cầu bổ sung', 'b') : chip('Cần bổ sung hàng', 'r') },
          { k: 'x', t: '', f: (v, r) => r.bal + r.pend < 0 && canEdit() ? `<button class="btn sm ghost" data-act="${act(() => supplyForm({ 'Mã SKU': r.sku, 'Số lượng (tấn)': Math.ceil(-(r.bal + r.pend)) }))}">Yêu cầu hàng</button>` : '' }], rows)}</div>`;
    }
  },
});

// =============================================================
// 07 — PDCA & ĐIỀU HÀNH
// =============================================================
MODULES.push({
  id: 7, title: 'PDCA & Điều hành', short: 'PDCA & Điều hành', sub: 'Hành động, đánh giá và quyết định',
  tabs: ['Danh sách vấn đề', 'Bảng hành động', 'Đánh giá hiệu quả'],
  filters: ['nam', 'thang', 'nhom', 'nv'],
  actions: () => canEdit() ? [{ text: '+ Tạo vấn đề', fn: () => issueForm() }] : [],
  render(el, tab) {
    const f = filt();
    const all = S.db.VAN_DE.filter(r => num(r['Năm']) === f.nam && (!S.F.thang || num(r['Tháng']) === +S.F.thang) && (!f.team || r['Mã nhóm'] === f.team) && (!f.nv || r['Mã NV thực hiện'] === f.nv || r['Mã NV kiểm tra'] === f.nv));
    const st = (r) => isOverdue(r) ? 'Quá hạn' : r['Trạng thái'] || 'Mới';
    if (tab === 'Danh sách vấn đề') {
      const sel = localSel('vd', 'Trạng thái', [['', 'Tất cả'], 'Mới', 'Đang xử lý', 'Chờ kiểm tra', 'Quá hạn', 'Đã đóng'], '');
      const rows = all.filter(r => (!S.L.vd || st(r) === S.L.vd) && match('vd', r['Mã đối tượng'], r['Nguyên nhân'], r['Hành động'])).sort((a, b) => ts(b['Ngày tạo']) - ts(a['Ngày tạo']));
      el.innerHTML = `<div class="grid g4">${kpi('Đang mở', all.filter(r => r['Trạng thái'] !== 'Đã đóng').length, 'hồ sơ')}${kpi('Quá hạn', all.filter(isOverdue).length, 'hồ sơ', '', all.some(isOverdue) ? 'alert' : '')}${kpi('Chờ kiểm tra', all.filter(r => r['Trạng thái'] === 'Chờ kiểm tra').length, 'hồ sơ')}${kpi('Đã đóng', all.filter(r => r['Trạng thái'] === 'Đã đóng').length, 'hồ sơ')}</div>
        <div class="card" style="margin-top:14px"><h4>${sel}<span class="sp"></span>${searchBox('vd', 'Tìm đối tượng / nguyên nhân')}</h4>${table([{ k: 'Mã VĐ', t: 'ID' }, { k: 'Mã đối tượng', t: 'Vấn đề / đối tượng' }, { k: 'Loại đối tượng', t: 'Loại' }, { k: 'Chênh lệch', t: 'Chênh lệch', num: true, cls: v => num(v) < 0 ? 'neg' : '' },
          { k: 'Nhóm nguyên nhân', t: 'Nhóm nguyên nhân' }, { k: 'Nguyên nhân', t: 'Nguyên nhân', wrap: true }, { k: r => nvName(r['Mã NV thực hiện']), t: 'Người thực hiện' }, { k: 'Hạn hoàn thành', t: 'Hạn', f: dstr }, { k: r => st(r), t: 'Trạng thái', f: stChip }],
          rows, { onRow: r => issueForm(r), empty: 'Chưa có hồ sơ – tạo từ nút “Xử lý” ở Tổng quan hoặc “Tạo hồ sơ” ở Kế hoạch theo SKU' })}</div>`;
    }
    if (tab === 'Bảng hành động') {
      const cols = ['Mới', 'Đang xử lý', 'Chờ kiểm tra', 'Đã đóng'];
      el.innerHTML = `<div class="kanban">${cols.map(c => { const items = all.filter(r => (r['Trạng thái'] || 'Mới') === c);
        return `<div class="kcol"><h5>${stChip(c)} <span class="msub">${items.length}</span></h5>${items.map(r => `<div class="kcard" data-act="${act(() => issueForm(r))}"><b>${esc(r['Mã đối tượng'])}</b>${esc(r['Hành động'] || r['Nguyên nhân'] || '')}<div style="margin-top:6px;display:flex;justify-content:space-between"><span class="msub">${esc(nvName(r['Mã NV thực hiện']) || 'Chưa giao')}</span>${isOverdue(r) ? chip('Quá hạn', 'r') : `<span class="msub">${dstr(r['Hạn hoàn thành'])}</span>`}</div></div>`).join('')}</div>`; }).join('')}</div>
        <p class="msub" style="font-size:12px">Quy trình: Mới → Đang xử lý (NVKD phân tích nguyên nhân, lập hành động) → Chờ kiểm tra (đã thực hiện, chờ người kiểm tra xác nhận) → Đã đóng (chỉ khi có kết quả và đánh giá hiệu quả).</p>`;
    }
    if (tab === 'Đánh giá hiệu quả') {
      const closed = all.filter(r => r['Trạng thái'] === 'Đã đóng'); const okN = closed.filter(r => r['Hiệu quả'] === 'Đạt').length;
      const byCause = groupSum(all, r => r['Nhóm nguyên nhân'] || '(chưa phân loại)', () => 1);
      const byOwner = uniq(all.map(r => r['Mã NV thực hiện'])).map(c => { const rr = all.filter(r => r['Mã NV thực hiện'] === c); return { c, n: rr.length, open: rr.filter(r => r['Trạng thái'] !== 'Đã đóng').length, od: rr.filter(isOverdue).length, ok: rr.filter(r => r['Hiệu quả'] === 'Đạt').length }; });
      el.innerHTML = `<div class="grid g3">${kpi('Tỷ lệ xử lý hiệu quả', closed.length ? pct(okN / closed.length, 0) : '—', '', `${okN}/${closed.length} hồ sơ đã đóng đạt hiệu quả`)}${kpi('Tổng chênh lệch đang xử lý', fmt(-sum(all.filter(r => r['Trạng thái'] !== 'Đã đóng'), r => r['Chênh lệch'])), 'tấn')}${kpi('Tổng hồ sơ', all.length, '', periodLabel())}</div>
        <div class="grid g2" style="margin-top:14px"><div class="card"><h4>Nguyên nhân thường gặp</h4><div id="ccause"></div></div><div class="card"><h4>Theo người thực hiện</h4>${table([{ k: r => nvName(r.c) || '(chưa giao)', t: 'Người thực hiện' }, { k: 'n', t: 'Tổng', num: true }, { k: 'open', t: 'Đang mở', num: true }, { k: 'od', t: 'Quá hạn', num: true, cls: v => v ? 'neg' : '' }, { k: 'ok', t: 'Đạt hiệu quả', num: true }], byOwner)}</div></div>`;
      Charts.donut($('#ccause'), { items: [...byCause].map(([k, v]) => ({ label: k, value: v })), center: String(all.length), sub: 'hồ sơ' });
    }
  },
});

// =============================================================
// 08 — DANH MỤC & CẤU HÌNH
// =============================================================
MODULES.push({
  id: 8, title: 'Danh mục & Cấu hình', short: 'Danh mục & Cấu hình', sub: 'Danh mục, kỳ kế hoạch, KPI và phân quyền',
  tabs: ['Danh mục SKU', 'Nhân sự & phân quyền', 'Nhóm kinh doanh', 'Kỳ kế hoạch', 'Tồn kho', 'Cấu hình & kết nối'],
  actions: () => C.BASE_URL ? [{ text: 'Mở Lark Base ↗', cls: 'ghost', fn: () => window.open(C.BASE_URL, '_blank') }] : [],
  render(el, tab) {
    const note = `<p class="msub" style="font-size:12px">Danh mục được sửa trực tiếp trên Lark Base (bảng ${tab === 'Danh mục SKU' ? 'DM_SKU' : tab === 'Nhân sự & phân quyền' ? 'DM_NHANVIEN' : tab === 'Nhóm kinh doanh' ? 'DM_NHOM' : tab === 'Kỳ kế hoạch' ? 'DM_KY' : 'TON_KHO'}). Sau khi sửa, bấm “⟳ Làm mới dữ liệu”.</p>`;
    if (tab === 'Danh mục SKU') {
      const rows = S.db.DM_SKU.filter(r => match('dsku', r['Mã SKU'], r['Màu'], r['Sản phẩm']));
      el.innerHTML = `<div class="card"><h4>${fmt(rows.length)} SKU<span class="sp"></span>${searchBox('dsku', 'Tìm SKU / màu')}</h4>${table(['Mã SKU', 'Size', 'Độ dày', 'Khổ rộng', 'Màu', 'Sản phẩm', 'Dày/mỏng', 'Phân loại lớp phủ', 'SKU trọng điểm', 'Trạng thái'].map(k => ({ k, t: k })), rows)}${note}</div>`;
    }
    if (tab === 'Nhân sự & phân quyền') {
      el.innerHTML = `<div class="card">${table([{ k: 'Mã NV', t: 'Mã NV' }, { k: 'Họ tên', t: 'Họ tên' }, { k: 'Email', t: 'Email (đăng nhập Lark)', f: v => v ? esc(v) : chip('Chưa có email', 'a') }, { k: r => teamName(r['Mã nhóm']), t: 'Nhóm' }, { k: 'Vai trò', t: 'Vai trò', f: v => chip(v, 'b') }, { k: 'Trạng thái', t: 'Trạng thái' }], S.db.DM_NHANVIEN)}
        <h4 style="margin-top:16px">Quy tắc phân quyền</h4>${table([{ k: 0, t: 'Vai trò' }, { k: 1, t: 'Xem dữ liệu' }, { k: 2, t: 'Được sửa', wrap: true }], [
          ['Admin / Trưởng phòng', 'Toàn bộ', 'Tất cả mục tiêu, kế hoạch, yêu cầu hàng, hồ sơ PDCA; duyệt mục tiêu'],
          ['Trưởng nhóm', 'Dữ liệu nhóm mình + mục tiêu Phòng/SKU', 'Giao mục tiêu NVKD trong nhóm (chờ duyệt), kế hoạch, yêu cầu hàng, PDCA của nhóm'],
          ['NVKD', 'Dữ liệu của chính mình + mục tiêu Phòng/SKU', 'Kế hoạch tuần, yêu cầu hàng (chờ duyệt), cập nhật hồ sơ PDCA được giao'],
          ['Xem', 'Toàn bộ', 'Không sửa (dành cho BLĐ, kiểm soát)']])}${note}</div>`;
    }
    if (tab === 'Nhóm kinh doanh') el.innerHTML = `<div class="card">${table([{ k: 'Mã nhóm', t: 'Mã nhóm' }, { k: 'Tên nhóm', t: 'Tên nhóm' }, { k: 'Tên gọi khác', t: 'Tên gọi khác (để đối chiếu dữ liệu cũ)', wrap: true }, { k: r => nvName(r['Mã NV trưởng nhóm']), t: 'Trưởng nhóm' }, { k: r => S.db.DM_NHANVIEN.filter(n => n['Mã nhóm'] === r['Mã nhóm']).length, t: 'Số nhân sự', num: true }, { k: 'Trạng thái', t: 'Trạng thái' }], S.db.DM_NHOM)}${note}</div>`;
    if (tab === 'Kỳ kế hoạch') el.innerHTML = `<div class="card">${table([{ k: 'Mã kỳ', t: 'Mã kỳ' }, { k: 'Quý', t: 'Quý' }, { k: 'Tháng', t: 'Tháng' }, { k: 'Từ ngày', t: 'Từ ngày', f: dstr }, { k: 'Đến ngày', t: 'Đến ngày', f: dstr }, { k: 'Số ngày bán', t: 'Số ngày bán', num: true }, { k: 'Trạng thái', t: 'Trạng thái', f: v => chip(v, v === 'Đang mở' ? 'g' : '') }], S.db.DM_KY)}${note}</div>`;
    if (tab === 'Tồn kho') {
      const rows = S.db.TON_KHO.filter(r => match('tk', r['Mã SKU'], r['Sản phẩm'])).sort((a, b) => num(b['Tồn khả dụng (tấn)']) - num(a['Tồn khả dụng (tấn)']));
      el.innerHTML = `<div class="card"><h4>Tồn kho theo SKU (ngày chốt ${dstr((S.db.TON_KHO[0] || {})['Ngày chốt'])})<span class="sp"></span>${searchBox('tk', 'Tìm SKU')}</h4>${table([{ k: 'Mã SKU', t: 'SKU' }, { k: 'Sản phẩm', t: 'SP' }, { k: 'Dày/mỏng', t: 'Dày/mỏng' }, ...['Tồn trong kho (tấn)', 'Hàng chưa nhập kho (tấn)', 'Hàng đặt chưa giao (tấn)', 'Hàng đang về (tấn)', 'Tồn khả dụng (tấn)', 'Tồn >90 ngày (tấn)', 'Bán BQ/tháng (tấn)'].map(k => ({ k, t: k.replace(' (tấn)', ''), num: true, d: 1 }))], rows)}${note}</div>`;
    }
    if (tab === 'Cấu hình & kết nối') {
      el.innerHTML = `<div class="grid g2"><div class="card"><h4>Thông tin phiên làm việc</h4>${table([{ k: 0, t: 'Mục' }, { k: 1, t: 'Giá trị', wrap: true, f: v => v }], [
        ['Chế độ', S.mode === 'live' ? chip('Đã kết nối Lark Base', 'g') : chip('DEMO', 'a')], ['Người dùng', esc(S.user.name) + (S.user.email ? ' · ' + esc(S.user.email) : '')], ['Vai trò', esc(S.user.role)],
        ['Số liệu đến ngày', dstr(S.asOf)], ...TABLES.map(t => ['Bảng ' + t, fmt(S.db[t].length) + ' dòng'])].map(r => r.map(String)), {})}</div>
        <div class="card"><h4>Ngưỡng KPI <small>(sửa trong file config.js trên GitHub)</small></h4>${table([{ k: 0, t: 'Tham số' }, { k: 1, t: 'Giá trị' }], [['Đạt (xanh) khi % đạt / tiến độ thời gian ≥', pct(C.THRESHOLD_GREEN, 0)], ['Cảnh báo (vàng) khi ≥', pct(C.THRESHOLD_AMBER, 0)], ['Cảnh báo năng lực NVKD khi MT / BQ 3 tháng >', pct(C.CAPACITY_WARN, 0)], ['Ngày nghỉ trong tuần', C.OFF_DAYS.map(d => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ')]])}
        <h4 style="margin-top:16px">Kiểm tra kết nối Lark</h4><button class="btn" data-act="${act(checkHealth)}">Chạy kiểm tra</button><div id="health" style="margin-top:10px"></div></div></div>`;
    }
  },
});
async function checkHealth() {
  const box = $('#health'); box.innerHTML = '<div class="msub">Đang kiểm tra…</div>';
  try { const d = await fetch('/api/health').then(r => r.json());
    box.innerHTML = table([{ k: 'name', t: 'Hạng mục' }, { k: 'ok', t: 'Kết quả', f: v => v ? chip('OK', 'g') : chip('Lỗi', 'r') }, { k: 'detail', t: 'Chi tiết', wrap: true }], d.checks || []);
  } catch (e) { box.innerHTML = `<div class="msub">Không gọi được /api/health (${esc(e.message)}). Nếu đang mở file trực tiếp trên máy, đây là bình thường.</div>`; }
}
