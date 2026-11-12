/* Mi Solar — gráficos en SVG, sin librerías. Con línea guía y globito al tocar. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const tip = () => document.getElementById('tooltip');

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  const fmt = (v, d = 1) => v.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });

  function showTip(x, y, title, rows) {
    const t = tip();
    t.innerHTML = `<div class="t">${title}</div>` + rows.map(r =>
      `<div class="r"><span style="display:inline-flex;align-items:center;gap:6px"><i class="swatch" style="background:${r.color}"></i>${r.name}</span><b>${r.value}</b></div>`).join('');
    t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x - w / 2;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    let top = y - h - 14;
    if (top < 8) top = y + 14;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  const hideTip = () => { tip().hidden = true; };

  function frame(container, height) {
    container.innerHTML = '';
    const W = Math.max(280, container.clientWidth || 320), H = height;
    const svg = el('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' }, container);
    return { svg, W, H, pad: { l: 40, r: 8, t: 24, b: 22 } };
  }

  function yAxis(svg, pad, W, H, max, unit) {
    const g = el('g', {}, svg);
    const m = max / Math.pow(10, Math.floor(Math.log10(max)));
    const N = (m === 2.5 || m === 5 || m === 10) ? 5 : 4;   // marcas con números redondos
    for (let i = 0; i <= N; i++) {
      const v = (max / N) * i;
      const y = H - pad.b - ((H - pad.t - pad.b) * i) / N;
      el('line', { class: 'gridline', x1: pad.l, x2: W - pad.r, y1: y, y2: y }, g);
      const t = el('text', { class: 'axis', x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, g);
      t.textContent = i === 0 ? '0' : fmt(v, v < 10 && v % 1 ? 1 : 0);
    }
    const u = el('text', { class: 'axis', x: 2, y: 11 }, g);
    u.textContent = unit;
  }

  /* Día: área de generación + línea de consumo (kW). */
  function dayChart(container, data, colors) {
    const { svg, W, H, pad } = frame(container, 210);
    const max = niceMax(Math.max(1, ...data.pv, ...data.load) * 1.08);
    yAxis(svg, pad, W, H, max, 'kW');
    const X = (h) => pad.l + ((W - pad.l - pad.r) * h) / 24;
    const Y = (v) => H - pad.b - ((H - pad.t - pad.b) * v) / max;

    for (const h of [0, 6, 12, 18, 24]) {
      const t = el('text', { class: 'axis', x: X(h), y: H - 4, 'text-anchor': h === 0 ? 'start' : h === 24 ? 'end' : 'middle' }, svg);
      t.textContent = String(h).padStart(2, '0') + ':00';
    }
    if (!data.t.length) return;
    const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(data.t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    const pvPath = line(data.pv);
    el('path', { d: `${pvPath}L${X(data.t[data.t.length - 1])},${Y(0)}L${X(0)},${Y(0)}Z`, fill: colors.solarSoft }, svg);
    el('path', { d: pvPath, fill: 'none', stroke: colors.solar, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    el('path', { d: line(data.load), fill: 'none', stroke: colors.home, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);

    // Capa táctil
    const cross = el('line', { class: 'cross', y1: pad.t, y2: H - pad.b, visibility: 'hidden' }, svg);
    const dotPv = el('circle', { r: 4.5, fill: colors.solar, stroke: colors.surface, 'stroke-width': 2, visibility: 'hidden' }, svg);
    const dotLd = el('circle', { r: 4.5, fill: colors.home, stroke: colors.surface, 'stroke-width': 2, visibility: 'hidden' }, svg);
    const hit = el('rect', { x: pad.l, y: 0, width: W - pad.l - pad.r, height: H, fill: 'transparent' }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const h = Math.max(0, Math.min(24, ((px - pad.l) / (W - pad.l - pad.r)) * 24));
      const i = Math.max(0, Math.min(data.t.length - 1, Math.round(h * 12)));
      const x = X(data.t[i]);
      for (const n of [cross, dotPv, dotLd]) n.setAttribute('visibility', 'visible');
      cross.setAttribute('x1', x); cross.setAttribute('x2', x);
      dotPv.setAttribute('cx', x); dotPv.setAttribute('cy', Y(data.pv[i]));
      dotLd.setAttribute('cx', x); dotLd.setAttribute('cy', Y(data.load[i]));
      const hh = Math.floor(data.t[i]), mm = Math.round((data.t[i] - hh) * 60);
      showTip(r.left + (x / W) * r.width, r.top + (Math.min(Y(data.pv[i]), Y(data.load[i])) / H) * r.height,
        `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        [{ name: 'Generación', color: colors.solar, value: fmt(data.pv[i], 2) + ' kW' },
         { name: 'Consumo', color: colors.home, value: fmt(data.load[i], 2) + ' kW' },
         { name: 'Batería', color: colors.batt, value: Math.round(data.soc[i]) + ' %' }]);
    };
    const leave = () => { for (const n of [cross, dotPv, dotLd]) n.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    hit.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(leave, 1600); });
  }

  /* Mes / año: barras agrupadas de generación y consumo (kWh). */
  function barChart(container, items, colors, opts = {}) {
    const { svg, W, H, pad } = frame(container, 210);
    const vals = items.filter(Boolean);
    const max = niceMax(Math.max(1, ...vals.map(v => Math.max(v.gen, v.load))) * 1.08);
    yAxis(svg, pad, W, H, max, 'kWh');
    const n = items.length;
    const slot = (W - pad.l - pad.r) / n;
    const gap = 2;
    const bw = Math.max(2, Math.min(14, (slot - gap * 3) / 2));
    const Y = (v) => H - pad.b - ((H - pad.t - pad.b) * v) / max;
    const base = Y(0);
    const bar = (x, v, color) => {
      const h = Math.max(0, base - Y(v));
      if (h < 0.5) return;
      const rr = Math.min(3, bw / 2, h);
      el('path', { d: `M${x},${base}V${base - h + rr}Q${x},${base - h} ${x + rr},${base - h}H${x + bw - rr}Q${x + bw},${base - h} ${x + bw},${base - h + rr}V${base}Z`, fill: color }, svg);
    };
    items.forEach((it, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const showLbl = n <= 12 || (i + 1) % 5 === 0 || i === 0;
      if (showLbl) {
        const t = el('text', { class: 'axis', x: cx, y: H - 4, 'text-anchor': 'middle' }, svg);
        t.textContent = opts.labels ? opts.labels[i] : (it ? it.label : String(i + 1));
      }
      if (!it) return;
      bar(cx - bw - gap / 2, it.gen, colors.solar);
      bar(cx + gap / 2, it.load, colors.home);
    });
    const sel = el('rect', { y: pad.t, height: H - pad.t - pad.b, width: slot, fill: colors.hover, rx: 6, visibility: 'hidden' }, svg);
    svg.insertBefore(sel, svg.children[1]);
    const hit = el('rect', { x: pad.l, y: 0, width: W - pad.l - pad.r, height: H, fill: 'transparent' }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - pad.l) / slot)));
      const it = items[i];
      if (!it) { sel.setAttribute('visibility', 'hidden'); hideTip(); return; }
      sel.setAttribute('x', pad.l + slot * i); sel.setAttribute('visibility', 'visible');
      showTip(r.left + ((pad.l + slot * i + slot / 2) / W) * r.width, r.top + (Y(Math.max(it.gen, it.load)) / H) * r.height,
        opts.title ? opts.title(it, i) : it.label,
        [{ name: 'Generación', color: colors.solar, value: fmt(it.gen) + ' kWh' },
         { name: 'Consumo', color: colors.home, value: fmt(it.load) + ' kWh' }]);
    };
    const leave = () => { sel.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    hit.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(leave, 1600); });
  }

  /* Curvas de cualquier dato a lo largo del día. series: [{ name, color, values }] */
  function seriesChart(container, t, series, colors, opts = {}) {
    const { svg, W, H, pad } = frame(container, 190);
    const all = series.flatMap(s => s.values).filter(v => isFinite(v));
    if (!t.length || !all.length) { container.innerHTML = '<div class="empty">Sin datos para este día.</div>'; return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    if (opts.zero !== false && lo >= 0 && lo < hi * 0.5) lo = 0;          // potencias: desde 0
    if (hi - lo < 1e-6) { hi += 1; lo = Math.max(0, lo - 1); }
    const span = niceMax((hi - lo) * 1.1);
    const step = span / 4;
    lo = Math.floor(lo / step) * step; hi = lo + span;
    if (hi < Math.max(...all)) hi += step;
    const X = (h) => pad.l + ((W - pad.l - pad.r) * h) / 24;
    const Y = (v) => H - pad.b - ((H - pad.t - pad.b) * (v - lo)) / (hi - lo);
    const N = Math.round((hi - lo) / step);
    for (let i = 0; i <= N; i++) {
      const v = lo + step * i, y = Y(v);
      el('line', { class: 'gridline', x1: pad.l, x2: W - pad.r, y1: y, y2: y }, svg);
      const tx = el('text', { class: 'axis', x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, svg);
      tx.textContent = fmt(v, step < 1 ? 1 : 0);
    }
    const u = el('text', { class: 'axis', x: 2, y: 11 }, svg); u.textContent = opts.unit || '';
    for (const h of [0, 6, 12, 18, 24]) {
      const tx = el('text', { class: 'axis', x: X(h), y: H - 4, 'text-anchor': h === 0 ? 'start' : h === 24 ? 'end' : 'middle' }, svg);
      tx.textContent = String(h).padStart(2, '0') + ':00';
    }
    for (const s of series) {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${X(t[i]).toFixed(1)},${Y(v).toFixed(1)}`).join('');
      el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    }
    const cross = el('line', { class: 'cross', y1: pad.t, y2: H - pad.b, visibility: 'hidden' }, svg);
    const dots = series.map(s => el('circle', { r: 4.5, fill: s.color, stroke: colors.surface, 'stroke-width': 2, visibility: 'hidden' }, svg));
    const hit = el('rect', { x: pad.l, y: 0, width: W - pad.l - pad.r, height: H, fill: 'transparent' }, svg);
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const h = Math.max(0, Math.min(24, ((((ev.clientX - r.left) / r.width) * W - pad.l) / (W - pad.l - pad.r)) * 24));
      let i = 0; for (let k = 0; k < t.length; k++) if (Math.abs(t[k] - h) < Math.abs(t[i] - h)) i = k;
      const x = X(t[i]);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dots.forEach((dt, k) => { dt.setAttribute('cx', x); dt.setAttribute('cy', Y(series[k].values[i])); dt.setAttribute('visibility', 'visible'); });
      const hh = Math.floor(t[i]), mm = Math.round((t[i] - hh) * 60) % 60;
      showTip(r.left + (x / W) * r.width, r.top + (Math.min(...series.map(s => Y(s.values[i]))) / H) * r.height,
        `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        series.map(s => ({ name: s.name, color: s.color, value: fmt(s.values[i], opts.dec != null ? opts.dec : 1) + ' ' + (opts.unit || '') })));
    };
    const leave = () => { cross.setAttribute('visibility', 'hidden'); dots.forEach(d => d.setAttribute('visibility', 'hidden')); hideTip(); };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
    hit.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(leave, 1600); });
  }

  window.Charts = { dayChart, barChart, seriesChart, fmt, hideTip };
})();
