/* Biểu đồ SVG gọn nhẹ — không cần thư viện ngoài */
(function () {
  const PALETTE = ['#1f6feb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#0ea5e9', '#84cc16'];
  const fmt = (v, d = 0) => (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: d, minimumFractionDigits: d });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function niceMax(v) {
    if (!v || v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function legend(items) {
    return '<div class="legend">' + items.map(i => `<span><i style="background:${i.color};${i.line ? 'height:3px;vertical-align:3px' : ''}"></i>${esc(i.name)}</span>`).join('') + '</div>';
  }

  /** Cột + đường (trục phải %) */
  function combo(el, o) {
    const W = Math.max(320, (el.clientWidth || 640) - 2), H = o.height || 240, L = 46, R = o.lines && o.lines.some(l => l.pct) ? 40 : 12, T = 10, B = 26;
    const n = o.labels.length; const cw = (W - L - R) / Math.max(n, 1);
    const bars = o.bars || []; const lines = o.lines || [];
    const maxV = niceMax(Math.max(0, ...bars.flatMap(b => b.values.map(v => v || 0)), ...lines.filter(l => !l.pct).flatMap(l => l.values.map(v => v || 0))));
    const maxP = Math.max(1, ...lines.filter(l => l.pct).flatMap(l => l.values.map(v => v || 0)));
    const pMax = Math.ceil(maxP * 4) / 4;
    const y = v => T + (H - T - B) * (1 - (v || 0) / maxV);
    const yp = v => T + (H - T - B) * (1 - (v || 0) / pMax);
    let s = `<svg class="svgchart" viewBox="0 0 ${W} ${H}" style="height:${H}px">`;
    for (let i = 0; i <= 4; i++) {
      const v = maxV * i / 4, yy = y(v);
      s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="#e8edf4"/><text x="${L - 6}" y="${yy + 4}" font-size="10" text-anchor="end" fill="#7b8aa0">${fmt(v)}</text>`;
      if (R > 12) s += `<text x="${W - R + 6}" y="${yp(pMax * i / 4) + 4}" font-size="10" fill="#7b8aa0">${fmt(pMax * i / 4 * 100)}%</text>`;
    }
    const bw = Math.min(26, cw * 0.8 / Math.max(bars.length, 1));
    o.labels.forEach((lb, i) => {
      const cx = L + cw * i + cw / 2;
      bars.forEach((b, j) => {
        const v = b.values[i] || 0; const x = cx - bw * bars.length / 2 + j * bw;
        s += `<rect x="${x + 1}" y="${y(v)}" width="${bw - 2}" height="${Math.max(0, H - B - y(v))}" rx="3" fill="${b.color || PALETTE[j]}"><title>${esc(lb)} – ${esc(b.name)}: ${fmt(v)}</title></rect>`;
      });
      s += `<text x="${cx}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#5b6b82">${esc(lb)}</text>`;
    });
    lines.forEach((l, j) => {
      const f = l.pct ? yp : y;
      const pts = l.values.map((v, i) => v == null ? null : [L + cw * i + cw / 2, f(v)]).filter(Boolean);
      if (!pts.length) return;
      s += `<polyline fill="none" stroke="${l.color || '#ef4444'}" stroke-width="2" ${l.dash ? 'stroke-dasharray="5 4"' : ''} points="${pts.map(p => p.join(',')).join(' ')}"/>`;
      l.values.forEach((v, i) => { if (v != null) s += `<circle cx="${L + cw * i + cw / 2}" cy="${f(v)}" r="3" fill="${l.color || '#ef4444'}"><title>${esc(o.labels[i])} – ${esc(l.name)}: ${l.pct ? fmt(v * 100, 1) + '%' : fmt(v)}</title></circle>`; });
    });
    s += '</svg>';
    el.innerHTML = legend([...bars.map((b, j) => ({ name: b.name, color: b.color || PALETTE[j] })), ...lines.map(l => ({ name: l.name, color: l.color || '#ef4444', line: true }))]) + s;
  }

  /** Biểu đồ đường (nhiều chuỗi, cùng trục) */
  function line(el, o) { combo(el, { labels: o.labels, bars: [], lines: o.series, height: o.height }); }

  /** Biểu đồ tròn rỗng */
  function donut(el, o) {
    const items = o.items.filter(i => i.value > 0); const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const R = 70, r = 46, C = 90; let a0 = -Math.PI / 2; let s = `<svg viewBox="0 0 180 180" style="width:170px;height:170px;flex:none">`;
    items.forEach((it, i) => {
      const a1 = a0 + 2 * Math.PI * it.value / total; const big = a1 - a0 > Math.PI ? 1 : 0;
      const p = (ang, rad) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1 - 0.0001, R), [x2, y2] = p(a1 - 0.0001, r), [x3, y3] = p(a0, r);
      s += `<path d="M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${big} 0 ${x3},${y3} Z" fill="${it.color || PALETTE[i % 8]}"><title>${esc(it.label)}: ${fmt(it.value)} (${fmt(it.value / total * 100, 1)}%)</title></path>`;
      a0 = a1;
    });
    s += `<text x="90" y="88" text-anchor="middle" font-size="20" font-weight="800" fill="#0a1f44">${esc(o.center || '')}</text><text x="90" y="106" text-anchor="middle" font-size="11" fill="#6b7a90">${esc(o.sub || '')}</text></svg>`;
    const leg = '<div style="flex:1;min-width:0">' + items.map((it, i) => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:13px"><i style="width:10px;height:10px;border-radius:2px;background:${it.color || PALETTE[i % 8]}"></i><span style="flex:1">${esc(it.label)}</span><b>${fmt(it.value / total * 100, 0)}%</b></div>`).join('') + '</div>';
    el.innerHTML = `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">${s}${leg}</div>`;
  }

  window.Charts = { combo, line, donut, PALETTE };
})();
