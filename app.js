/* Mi Solar — pantallas */
(function () {
  const Demo = window.SolarData, Cloud = window.SolarCloud, C = window.Charts;
  const $ = (s, r = document) => r.querySelector(s);

  // Fuente de datos: la nube si hay cuenta conectada; si no, la demostración
  const DemoAsync = {
    live: async () => Demo.live(), day: async (d, h) => Demo.day(d, h),
    month: async (y, m, u) => Demo.month(y, m, u), year: async (y, u) => Demo.year(y, u),
  };
  const isCloud = () => Cloud.connected();
  const SRC = () => (isCloud() ? Cloud : DemoAsync);
  const MESES = Demo.MESES;

  // ---------- Ajustes (guardados en el celular) ----------
  const DEFAULTS = { tarifa: 210, inyeccion: 110, co2: 0.3, battLow: 25, aBattLow: true, aOffline: true, aLowProd: true, aFull: false, p1: null, p2: null, wp: null, battKwh: null };
  let S = { ...DEFAULTS };
  try { Object.assign(S, JSON.parse(localStorage.getItem('miSolar.ajustes') || '{}')); } catch (e) { /* sin almacenamiento */ }
  const save = () => { try { localStorage.setItem('miSolar.ajustes', JSON.stringify(S)); } catch (e) { /* nada */ } };

  // ---------- Formato ----------
  const kwh = (v, d = 1) => C.fmt(v, d);
  const kw = (v) => (Math.abs(v) < 1 ? C.fmt(Math.abs(v) * 1000, 0) + ' W' : C.fmt(Math.abs(v), 2) + ' kW');
  const clp = (v) => '$' + Math.round(v).toLocaleString('es-CL');
  const hhmm = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const savingOf = (t) => t.self * S.tarifa + t.exp * S.inyeccion;
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const colors = () => ({ solar: cssVar('--solar'), home: cssVar('--home'), batt: cssVar('--batt'), solarSoft: cssVar('--solar-soft'), surface: cssVar('--card'), hover: cssVar('--card-2') });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function ago(d) {
    const m = Math.round((Date.now() - d) / 60000);
    if (m < 1) return 'recién';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const dd = Math.round(h / 24);
    return dd === 1 ? 'ayer' : `hace ${dd} días`;
  }

  // ---------- Íconos ----------
  const ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    home: '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
    batt: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M7 10.5v3M10.5 10.5v3"/>',
    grid: '<path d="M8 21 12 3l4 18M9.5 14h5M10.5 9h3M5 6h14"/>',
    inv: '<rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M9 10.5 11 8.5l2 4 2-2M9 16h6"/>',
    warn: '<path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.3"/>',
    off: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19v.2M3 3l18 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.2"/>',
    down: '<path d="M4 7l6 6 4-4 6 6M20 10v5h-5"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chat: '<path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17.5h-1A1.5 1.5 0 0 1 3 16V7a1.5 1.5 0 0 1 1.5-1.5zM8 10.5h8M8 13.5h5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  };
  const svgIcon = (name) => `<svg viewBox="0 0 24 24">${ICON[name]}</svg>`;

  // ---------- Pestañas ----------
  let tab = 'ahora';
  let renderId = 0;
  function go(t) {
    tab = t;
    document.querySelectorAll('.tab').forEach(b => {
      if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + t; });
    C.hideTip();
    render();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));

  const titleOf = (t) => ({ ahora: 'Mi Solar', historial: 'Historial', ahorro: 'Ahorro', equipo: 'Equipo', avisos: 'Avisos' }[t]);
  async function render() {
    const id = ++renderId;
    const fn = { ahora: renderAhora, historial: renderHistorial, ahorro: renderAhorro, equipo: renderEquipo, avisos: renderAvisos }[tab];
    try { await fn(() => id === renderId); }
    catch (e) {
      if (id !== renderId) return;
      $('#screen-' + tab).innerHTML = `${head(titleOf(tab))}<div class="card empty">No pude leer los datos.<br><small>${esc(e.message || e)}</small><br><br><button class="btn" id="retry">Reintentar</button></div>`;
      $('#retry').addEventListener('click', render);
    }
  }
  const modePill = (online = true) => !isCloud()
    ? '<span class="pill"><i class="dot demo"></i>Demostración</span>'
    : online ? '<span class="pill"><i class="dot"></i>En línea</span>' : '<span class="pill"><i class="dot off"></i>Sin señal</span>';
  const head = (title, sub = '', online) => `<header class="head"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${modePill(online)}</header>`;
  const loading = (t) => { const el = $('#screen-' + t); if (!el.innerHTML.trim()) el.innerHTML = `${head(titleOf(t))}<div class="card empty">Cargando…</div>`; };

  // ---------- AHORA ----------
  function flowSvg(L) {
    const col = colors();
    const nodes = {
      sol:  { x: 62,  y: 52,  c: col.solar, icon: 'sun',  lbl: 'Paneles', val: kw(L.pv) },
      red:  { x: 278, y: 52,  c: cssVar('--grid'), icon: 'grid', lbl: L.grid > 0.02 ? 'Usando la red' : L.grid < -0.02 ? 'Vendiendo a la red' : 'Red', val: kw(L.grid) },
      bat:  { x: 62,  y: 196, c: col.batt,  icon: 'batt', lbl: `Batería ${Math.round(L.soc)} %`, val: (L.batt > 0.02 ? '+' : L.batt < -0.02 ? '−' : '') + kw(L.batt) },
      casa: { x: 278, y: 196, c: col.home,  icon: 'home', lbl: 'Casa', val: kw(L.load) },
    };
    const hub = { x: 170, y: 124 };
    const wires = [  // [nodo, hay flujo, hacia el inversor, potencia]
      ['sol', L.pv > 0.02, true, L.pv],
      ['red', Math.abs(L.grid) > 0.02, L.grid > 0, L.grid],
      ['bat', Math.abs(L.batt) > 0.02, L.batt < 0, L.batt],
      ['casa', L.load > 0.02, false, L.load],
    ];
    let s = `<svg viewBox="0 0 340 290" role="img" aria-label="Flujo de energía en este momento">`;
    for (const [k, on, toHub, p] of wires) {
      const n = nodes[k];
      const d = `M${n.x},${n.y}L${hub.x},${hub.y}`;
      s += `<path class="wire" d="${d}"/>`;
      if (on && L.online !== false) s += `<path class="wire-on${toHub ? '' : ' rev'}" d="${d}" stroke="${n.c}" style="animation-duration:${(1.6 / (0.4 + Math.abs(p))).toFixed(2)}s"/>`;
    }
    s += `<circle class="hub" cx="${hub.x}" cy="${hub.y}" r="22"/><g transform="translate(${hub.x - 12},${hub.y - 12})" fill="none" stroke="${cssVar('--text-2')}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON.inv}</g>`;
    for (const k in nodes) {
      const n = nodes[k];
      s += `<circle class="node-bg" cx="${n.x}" cy="${n.y}" r="30" stroke="${n.c}" stroke-width="2.5"/>`;
      s += `<g transform="translate(${n.x - 14.4},${n.y - 14.4}) scale(1.2)" fill="none" stroke="${n.c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[n.icon]}</g>`;
      s += `<text class="node-val" x="${n.x}" y="${n.y + 52}">${n.val}</text><text class="node-lbl" x="${n.x}" y="${n.y + 68}">${n.lbl}</text>`;
    }
    return s + '</svg>';
  }

  function inverterRows(raw) {
    if (!raw) return '';
    const v = (k) => (raw[k] && raw[k].value !== null && raw[k].value !== undefined ? raw[k] : null);
    const rows = [
      ['Temperatura del inversor', v('inverterTemperature'), (x) => C.fmt(+x.value, 0) + ' °C'],
      ['Voltaje de la batería', v('batteryVoltage'), (x) => C.fmt(+x.value, 1) + ' V'],
      ['Voltaje de la red', v('acInputVoltage'), (x) => C.fmt(+x.value, 0) + ' V'],
      ['Voltaje de los paneles', v('pvVoltage'), (x) => C.fmt(+x.value, 0) + ' V'],
      ['Carga del inversor', v('outputLoadPercent'), (x) => C.fmt(+x.value, 0) + ' %'],
      ['Generado en total', v('pvGeneratedEnergyOfTotal'), (x) => C.fmt(+x.value, 1) + ' kWh'],
    ].filter(r => r[1]);
    if (!rows.length) return '';
    return `<div class="section-title">Inversor</div><div class="list">${rows.map(([t, x, f]) => `<div class="row plain"><div class="main"><div class="title">${t}</div></div><div class="right">${f(x)}</div></div>`).join('')}</div>`;
  }

  async function renderAhora(alive) {
    loading('ahora');
    const src = SRC();
    const [L, today] = await Promise.all([src.live(), src.day(new Date())]);
    if (!alive()) return;
    const T = L.today;
    const auto = T.load > 0 ? Math.round((T.self / T.load) * 100) : 0;
    const col = colors();
    const acc = isCloud() ? Cloud.account() : null;
    const sub = L.online === false ? `Último dato ${ago(L.at)}` : `Actualizado a las ${hhmm(L.at)}`;
    $('#screen-ahora').innerHTML = `
      ${head(acc ? esc(cap(acc.device.name || 'Mi Solar')) : 'Mi Solar', sub, L.online !== false)}
      ${L.online === false ? `<div class="banner bad">${svgIcon('off')}<span>El inversor no manda datos desde las ${hhmm(L.at)}. Revisa el WiFi del equipo.</span></div>` : ''}
      <div class="card flow">${flowSvg(L)}</div>
      <div class="tiles">
        <div class="tile"><div class="lbl"><i class="swatch" style="background:${col.solar}"></i>Generado hoy</div>
          <div class="val">${kwh(T.gen, T.gen < 10 ? 2 : 1)}<small>kWh</small></div><div class="foot">Ahorro hoy ${clp(savingOf(T))}</div></div>
        <div class="tile"><div class="lbl"><i class="swatch" style="background:${col.home}"></i>Consumo hoy</div>
          <div class="val">${kwh(T.load, T.load < 10 ? 2 : 1)}<small>kWh</small></div><div class="foot">De la red ${kwh(T.imp)} kWh</div></div>
        <div class="tile"><div class="lbl"><i class="swatch" style="background:${col.batt}"></i>Batería</div>
          <div class="val">${Math.round(L.soc)}<small>%</small></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, Math.round(L.soc)))}%"></div></div></div>
        <div class="tile"><div class="lbl">Del sol</div>
          <div class="val">${auto}<small>%</small></div><div class="foot">de lo que usaste hoy</div></div>
      </div>
      <div id="goals"></div>
      <div class="section-title">Hoy</div>
      <div class="card"><div id="chart-hoy"></div>
        <div class="legend"><span><i class="swatch" style="background:${col.solar}"></i>Generación</span><span><i class="swatch" style="background:${col.home}"></i>Consumo</span></div>
      </div>
      <div class="card ask">
        <div class="ask-head"><div class="ask-ico">${svgIcon('chat')}</div><div><div class="title">¿Dudas sobre tus paneles?</div><div class="desc">Pregúntale a Claude con tus datos de hoy.</div></div></div>
        <button class="btn wide" id="ask-claude">Preguntarle a Claude</button>
        <button class="btn-link" id="ask-share">Compartir resumen…</button>
      </div>
      ${inverterRows(L.raw)}
      ${!isCloud() ? '<p class="note">Estos son datos de ejemplo. Conecta tu cuenta de Solar of Things en la pestaña Avisos.</p>' : ''}`;
    C.dayChart($('#chart-hoy'), today, col);
    renderGoals(alive, L, today).catch(e => { const g = $('#goals'); if (g) g.innerHTML = `<div class="card empty">No pude calcular las metas: ${esc(e.message || e)}</div>`; });
    $('#ask-claude').addEventListener('click', () => askClaude(false));
    $('#ask-share').addEventListener('click', () => askClaude(true));
  }

  // ---------- METAS, BATERÍA Y BALANCE (pantalla Ahora) ----------
  // Sol promedio en Santiago (kWh/m² al día, por mes) × rendimiento real de un sistema (0,78) = kWh por kWp esperados
  const SOL_SANTIAGO = [8.2, 7.3, 6.0, 4.3, 3.0, 2.4, 2.7, 3.6, 4.9, 6.3, 7.4, 8.0];
  const dailyGoalPerKwp = (d) => SOL_SANTIAGO[d.getMonth()] * 0.78;
  // Fracción del sol del día que ya pasó a cierta hora (curva del sol en Santiago)
  function solarFraction(d, hour) {
    const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    const season = Math.cos((2 * Math.PI * (doy - 5)) / 365);
    const len = 12 + 2.3 * season, noon = 13.2 + 0.45 * season, rise = noon - len / 2;
    let done = 0, all = 0;
    for (let h = 0; h < 24; h += 0.05) {
      const x = (h - rise) / len, v = x > 0 && x < 1 ? Math.pow(Math.sin(Math.PI * x), 1.25) : 0;
      all += v; if (h <= hour) done += v;
    }
    return all ? done / all : 0;
  }
  const getKwp = () => (!isCloud() ? Demo.SYS.pvPeak : S.wp && (S.p1 || S.p2) ? ((S.p1 || 0) + (S.p2 || 0)) * S.wp / 1000 : null);
  const getBattKwh = () => (!isCloud() ? Demo.SYS.battKwh : S.battKwh || null);

  function ring(pct, color, label, sub) {
    const r = 46, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return `<svg viewBox="0 0 120 120" class="ring" role="img" aria-label="${Math.round(pct * 100)} %">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--card-2)" stroke-width="12"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="58" text-anchor="middle" class="ring-big">${label}</text>
      <text x="60" y="78" text-anchor="middle" class="ring-sub">${sub}</text></svg>`;
  }
  // Barra de progreso con marca opcional (ej.: "esperado a esta hora")
  function meter(label, valueText, pct, color, opts = {}) {
    const w = Math.max(0, Math.min(100, pct * 100));
    const mk = opts.mark != null ? `<i class="mark" style="left:${Math.max(0, Math.min(100, opts.mark * 100))}%" title="${opts.markLabel || ''}"></i>` : '';
    return `<div class="meter"><div class="meter-top"><span>${label}</span><b>${valueText}</b></div>
      <div class="meter-track">${w > 0 ? `<div class="meter-fill" style="width:${Math.max(w, 1.5)}%;background:${color}"></div>` : ''}${mk}</div>
      ${opts.foot ? `<div class="meter-foot">${opts.foot}</div>` : ''}</div>`;
  }
  // Barra apilada en porcentajes
  function stack(parts) {
    const total = parts.reduce((a, p) => a + Math.max(0, p.v), 0);
    if (total <= 0) return '<div class="empty" style="padding:8px">Sin datos todavía.</div>';
    const segs = parts.filter(p => p.v > 0).map(p => `<div class="seg-fill ${p.cls || ''}" style="flex:${p.v};background:${p.color}" title="${p.name}"></div>`).join('');
    const leg = parts.map(p => `<div class="stack-leg"><i class="swatch ${p.cls || ''}" style="background:${p.color}"></i><span>${p.name}</span><b>${Math.round(Math.max(0, p.v) / total * 100)} %</b><small>${C.fmt(Math.max(0, p.v), 2)} kWh</small></div>`).join('');
    return `<div class="stack-bar">${segs}</div><div class="stack-legs">${leg}</div>`;
  }

  async function renderGoals(alive, L, today) {
    const box = $('#goals'); if (!box) return;
    const now = new Date(), hour = now.getHours() + now.getMinutes() / 60;
    const col = colors(), good = cssVar('--good'), warn = cssVar('--warn'), bad = cssVar('--bad');
    const T = L.today;
    const kwp = getKwp(), battKwh = getBattKwh();
    const src = SRC();
    const m = await src.month(now.getFullYear(), now.getMonth());
    if (!alive() || !$('#goals')) return;
    let html = '';

    // 1) Meta de generación
    if (kwp) {
      const goal = kwp * dailyGoalPerKwp(now);
      const frac = solarFraction(now, hour);
      const expNow = goal * frac;
      const pct = goal ? T.gen / goal : 0;
      const pace = expNow > 0.05 ? T.gen / expNow : 1;
      const st = frac >= 0.999 ? (pct >= 0.9 ? ['Meta cumplida', good] : pct >= 0.6 ? ['Día flojo', warn] : ['Muy por debajo', bad])
        : (pace >= 0.9 ? ['Vas bien', good] : pace >= 0.6 ? ['Un poco atrasado', warn] : ['Muy atrasado', bad]);
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const firstDay = Math.max(0, m.items.findIndex(it => it && it.gen > 0));   // si se instaló este mes, contar desde ese día
      const mGoal = goal * (days - firstDay);
      const mExpected = goal * (now.getDate() - 1 - firstDay + frac);
      html += `<div class="section-title">Metas de hoy</div>
      <div class="card goal-card">
        <div class="goal-top">
          ${ring(pct, st[1], `${Math.round(pct * 100)} %`, 'de la meta')}
          <div class="goal-info">
            <span class="chip" style="background:${st[1]}">${st[0]}</span>
            <div class="goal-big">${C.fmt(T.gen, T.gen < 10 ? 2 : 1)} <small>de ${C.fmt(goal, goal < 10 ? 1 : 0)} kWh</small></div>
            <div class="goal-sub">A esta hora deberías llevar <b>${C.fmt(expNow, expNow < 10 ? 2 : 1)} kWh</b> (${Math.round(frac * 100)} % del sol del día ya pasó).</div>
          </div>
        </div>
        ${meter('Generación de hoy', `${C.fmt(T.gen, 2)} / ${C.fmt(goal, 1)} kWh`, pct, col.solar, { mark: frac, markLabel: 'Esperado a esta hora', foot: `La rayita marca lo esperado a esta hora · meta con ${C.fmt(kwp, 2)} kWp y el sol de ${MESES[now.getMonth()]} en Santiago` })}
        ${meter(`Mes de ${MESES[now.getMonth()]}`, `${C.fmt(m.totals.gen, 1)} / ${C.fmt(mGoal, 0)} kWh`, mGoal ? m.totals.gen / mGoal : 0, col.solar, { mark: mGoal ? mExpected / mGoal : null, foot: `A hoy deberías llevar ${C.fmt(Math.max(0, mExpected), 0)} kWh${firstDay > 0 ? ` (desde el ${firstDay + 1}, cuando se instaló)` : ''}` })}
        ${meter('Lo que usaste salió del sol', `${T.load > 0 ? Math.round(T.self / T.load * 100) : 0} % · meta 70 %`, T.load > 0 ? T.self / T.load : 0, (T.load > 0 && T.self / T.load >= 0.7) ? good : warn, { mark: 0.7 })}
        ${meter('Uso de la red', `${C.fmt(T.imp, 2)} kWh · ${T.load > 0 ? Math.round(T.imp / T.load * 100) : 0} % del consumo`, T.load > 0 ? T.imp / T.load : 0, (T.load > 0 && T.imp / T.load <= 0.3) ? good : bad, { mark: 0.3, foot: 'Meta: menos del 30 % (la rayita)' })}
        ${frac < 0.999 ? `<div class="goal-proj">Si sigue así, terminarías el día con <b>${C.fmt(frac > 0.05 ? T.gen / frac : T.gen, 1)} kWh</b>.</div>` : ''}
      </div>`;
    } else {
      html += `<div class="section-title">Metas de hoy</div><div class="card cta"><div><b>Activa tus metas diarias</b><div class="desc">Dime cuántos paneles tienes y de cuántos watts. Con eso calculo cuánto deberías generar cada día.</div></div><button class="btn" id="go-equipo">Configurar</button></div>`;
    }

    // 2) Batería
    const raw = L.raw || {};
    const rv = (k) => (raw[k] && raw[k].value != null ? +raw[k].value : null);
    const V = rv('batteryVoltage') || 48;
    const maxChg = (rv('maximumTotalChargingCurrent') || 60) * V / 1000;
    const maxDis = (isCloud() && Cloud.account().device.ratedKw) || Demo.SYS.battMaxKw;
    const soc = Math.round(L.soc);
    const socColor = soc < 25 ? bad : soc < 50 ? warn : good;
    const charging = L.batt > 0.02, discharging = L.batt < -0.02;
    let eta = '';
    if (battKwh) {
      if (charging && soc < 99) eta = `Se llena en ~${fmtH(((100 - soc) / 100) * battKwh / L.batt)}`;
      else if (discharging) eta = `Dura ~${fmtH(((soc - 20) / 100) * battKwh / -L.batt)} a este ritmo`;
      else eta = `Guarda ~${C.fmt(soc / 100 * battKwh, 1)} kWh`;
    }
    const capRef = battKwh || Math.max(T.chg || 0, T.dis || 0, 0.1);
    html += `<div class="section-title">Batería</div>
      <div class="card batt-card">
        <div class="batt-top">
          <div class="batt-icon"><div class="batt-body"><div class="batt-level" style="height:${Math.max(3, soc)}%;background:${socColor}"></div></div><div class="batt-cap"></div></div>
          <div class="batt-info"><div class="goal-big">${soc} <small>%</small></div>
            <div class="goal-sub">${charging ? `Cargando a ${kw(L.batt)}` : discharging ? `Descargando a ${kw(L.batt)}` : 'En reposo'}${eta ? ' · ' + eta : ''}</div>
            ${battKwh ? `<div class="goal-sub">${C.fmt(soc / 100 * battKwh, 1)} de ${C.fmt(battKwh, 1)} kWh guardados</div>` : ''}</div>
        </div>
        ${meter('Carga ahora', charging ? `${kw(L.batt)} · ${Math.round(L.batt / maxChg * 100)} % del máximo` : '0 W', charging ? L.batt / maxChg : 0, col.batt, { foot: `Máximo del inversor: ${C.fmt(maxChg, 1)} kW` })}
        ${meter('Descarga ahora', discharging ? `${kw(L.batt)} · ${Math.round(-L.batt / maxDis * 100)} % del máximo` : '0 W', discharging ? -L.batt / maxDis : 0, warn, { foot: `Máximo del inversor: ${C.fmt(maxDis, 1)} kW` })}
        ${meter('Cargado hoy', `${C.fmt(T.chg || 0, 2)} kWh${battKwh ? ` · ${Math.round((T.chg || 0) / battKwh * 100)} % de la batería` : ''}`, (T.chg || 0) / capRef, col.batt)}
        ${meter('Descargado hoy', `${C.fmt(T.dis || 0, 2)} kWh${battKwh ? ` · ${Math.round((T.dis || 0) / battKwh * 100)} % de la batería` : ''}`, (T.dis || 0) / capRef, warn)}
        <div id="chart-soc" style="margin-top:8px"></div>
        <label class="pv-row">Capacidad de la batería (kWh) <input type="number" inputmode="decimal" min="0.5" max="200" step="0.1" id="in-batt" value="${S.battKwh || ''}" placeholder="${battKwh ? C.fmt(battKwh, 1) : 'ej. 5,1'}"></label>
        <div class="pv-hint">Si sabes los Ah: ${C.fmt(V > 40 ? 48 : 24, 0)} V × Ah ÷ 1000. Ej.: 48 V × 100 Ah = 4,8 kWh.</div>
      </div>`;

    // 3) Balance de energía de hoy
    const fromSun = Math.max(0, T.load - T.imp - (T.dis || 0));
    const sunToHouse = fromSun, sunToBatt = T.chg || 0, sunToGrid = T.exp || 0;
    const parts = [{ name: 'Casa', v: sunToHouse, color: col.home }, { name: 'Batería', v: sunToBatt, color: col.batt }, { name: 'Vendido a la red', v: sunToGrid, color: cssVar('--grid') }];
    let lost = 0;
    if (kwp) {
      const expNow = kwp * dailyGoalPerKwp(now) * solarFraction(now, hour);
      if (L.soc >= 95 && expNow > T.gen * 1.5) lost = expNow - T.gen;
      if (lost > 0) parts.push({ name: 'Sol sin aprovechar (aprox.)', v: lost, color: cssVar('--text-3'), cls: 'hatch' });
    }
    html += `<div class="section-title">Tu energía hoy</div>
      <div class="card">
        <div class="stack-title">¿De dónde vino lo que usó la casa?</div>
        ${stack([{ name: 'Sol directo', v: fromSun, color: col.solar }, { name: 'Batería', v: T.dis || 0, color: col.batt }, { name: 'Red eléctrica', v: T.imp, color: cssVar('--grid') }])}
        <div class="stack-title" style="margin-top:16px">¿A dónde fue la energía del sol?</div>
        ${stack(parts)}
        ${lost > 0 ? `<p class="note" style="margin:8px 0 0">Con la batería llena, el sol que la casa no usa se pierde (no se vende a la red). Revisa la pestaña <b>Equipo → Mis paneles</b>.</p>` : ''}
      </div>`;

    box.innerHTML = html;
    if ($('#go-equipo')) $('#go-equipo').addEventListener('click', () => go('equipo'));
    $('#in-batt').addEventListener('change', (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); S.battKwh = v > 0 ? v : null; save(); render(); });
    if (today && today.t.length) C.seriesChart($('#chart-soc'), today.t, [{ name: 'Batería', color: col.batt, values: today.soc }], col, { unit: '%', dec: 0, min: 0, max: 100 });
  }
  function fmtH(h) {
    if (!isFinite(h) || h <= 0) return '–';
    if (h < 1) return Math.round(h * 60) + ' min';
    if (h < 48) return C.fmt(h, h < 10 ? 1 : 0) + ' h';
    return Math.round(h / 24) + ' días';
  }

  // ---------- PREGUNTARLE A CLAUDE ----------
  // Arma un resumen en texto con los datos y lo abre en Claude (usa el plan Pro, sin costo extra)
  async function buildSummary() {
    const src = SRC(), now = new Date();
    const L = await src.live();
    const m = await src.month(now.getFullYear(), now.getMonth());
    const acc = isCloud() ? Cloud.account() : null;
    const f1 = (v) => C.fmt(v, 2);
    const lines = [];
    lines.push('Hola Claude. Te paso los datos de mis paneles solares (los saco de mi app Mi Solar, conectada a Solar of Things).');
    if (!isCloud()) lines.push('OJO: son datos de EJEMPLO, todavía no conecto mi cuenta.');
    if (acc) lines.push(`Equipo: inversor ${acc.device.model || ''} de ${acc.device.ratedKw || '?'} kW, instalado el ${new Date(acc.device.installedAt).toLocaleDateString('es-CL')}. Vivo en Chile (Santiago).`);
    const fh = (d) => `${d.toLocaleDateString('es-CL')} a las ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    lines.push(`Fecha y hora: ${fh(now)}. Último dato del inversor: ${fh(L.at)}${L.online === false ? ' (¡está SIN SEÑAL!)' : ''}.`);
    lines.push('', 'AHORA:');
    lines.push(`- Paneles: ${kw(L.pv)} · Casa: ${kw(L.load)} · Red: ${kw(L.grid)}${L.grid > 0.02 ? ' (usando la red)' : L.grid < -0.02 ? ' (vendiendo)' : ''}`);
    lines.push(`- Batería: ${Math.round(L.soc)} %${L.batt > 0.02 ? `, cargando ${kw(L.batt)}` : L.batt < -0.02 ? `, descargando ${kw(L.batt)}` : ''}`);
    const T = L.today;
    lines.push('', 'HOY:', `- Generado ${f1(T.gen)} kWh · Consumo ${f1(T.load)} kWh · Sacado de la red ${f1(T.imp)} kWh · ${T.load > 0 ? Math.round(T.self / T.load * 100) : 0} % salió del sol`);
    const kwpS = getKwp();
    if (kwpS) {
      const g = kwpS * dailyGoalPerKwp(now), fr = solarFraction(now, now.getHours() + now.getMinutes() / 60);
      lines.push(`- Meta de hoy: ${f1(g)} kWh (${C.fmt(kwpS, 2)} kWp${isCloud() ? `: ${(S.p1 || 0) + (S.p2 || 0)} paneles de ${S.wp} W` : ''}); a esta hora debería llevar ${f1(g * fr)} kWh.`);
    }
    lines.push(`- Batería: cargó ${f1(T.chg || 0)} kWh y descargó ${f1(T.dis || 0)} kWh hoy${getBattKwh() ? ` (capacidad ${C.fmt(getBattKwh(), 1)} kWh)` : ''}.`);
    const days = m.items.filter(it => it && it.date.toDateString() !== now.toDateString() && (it.gen > 0 || it.load > 0)).slice(-7);
    if (days.length) {
      lines.push('', 'DÍAS ANTERIORES (generado / consumo / de la red, en kWh):');
      days.forEach(it => lines.push(`- ${it.date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}: ${f1(it.gen)} / ${f1(it.load)} / ${f1(it.imp)}`));
    }
    lines.push('', `ESTE MES: generado ${f1(m.totals.gen)} kWh, consumo ${f1(m.totals.load)} kWh, de la red ${f1(m.totals.imp)} kWh, ahorro aprox. ${clp(savingOf(m.totals))} (precio kWh $${S.tarifa}).`);
    const raw = L.raw || {};
    const rv = (k, u) => (raw[k] && raw[k].value != null ? `${raw[k].value} ${u}` : null);
    const inv = [['Temp. inversor', rv('inverterTemperature', '°C')], ['Voltaje batería', rv('batteryVoltage', 'V')], ['Voltaje red', rv('acInputVoltage', 'V')],
      ['Entrada de paneles 1', raw.pvPower ? `${kw(+raw.pvPower.value)}, ${raw.pvVoltage && raw.pvVoltage.value} V, ${raw.pvCurrent && raw.pvCurrent.value} A` : null], ['Entrada de paneles 2', raw.pv2Power ? `${kw(+raw.pv2Power.value)}, ${raw.pv2Voltage && raw.pv2Voltage.value} V, ${raw.pv2Current && raw.pv2Current.value} A` : null], ['Temp. transformador', rv('transformerTemperature', '°C')], ['Voltaje flotación batería', rv('floatChargingVoltage', 'V')], ['Carga inversor', rv('outputLoadPercent', '%')], ['Modo', raw.mode ? raw.mode.value : null]].filter(x => x[1]);
    if (inv.length) lines.push('', 'INVERSOR: ' + inv.map(([a, b]) => `${a} ${b}`).join(' · '));
    const al = await buildAlerts();
    if (al.length) lines.push('', 'AVISOS: ' + al.map(a => `${a.title} (${a.desc})`).join(' | '));
    lines.push('', 'Explícame simple, no soy técnico. Mi pregunta es: ');
    return lines.join('\n');
  }

  async function askClaude(share) {
    const btn = $(share ? '#ask-share' : '#ask-claude');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparando…';
    try {
      const text = await buildSummary();
      try { await navigator.clipboard.writeText(text); } catch (e) { /* sin permiso de portapapeles */ }
      if (share && navigator.share) {
        await navigator.share({ text }).catch(() => {});
      } else {
        // Abre Claude con el resumen ya escrito; también queda copiado por si hay que pegarlo
        window.open('https://claude.ai/new?q=' + encodeURIComponent(text), '_blank');
        toast('Resumen copiado. Si no aparece escrito en Claude, pégalo.');
      }
    } catch (e) {
      toast('No pude armar el resumen: ' + (e.message || e));
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  window.MiSolar = { buildSummary };

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // ---------- HISTORIAL ----------
  const qs = new URLSearchParams(location.search);
  const H = { range: ['dia', 'mes', 'anio'].includes(qs.get('r')) ? qs.get('r') : 'dia', ref: new Date() };
  function stepRef(ref, range, dir) {
    const r = new Date(ref);
    if (range === 'dia') r.setDate(r.getDate() + dir);
    else if (range === 'mes') { r.setDate(1); r.setMonth(r.getMonth() + dir); }
    else { r.setDate(1); r.setFullYear(r.getFullYear() + dir); }
    return r;
  }
  function shift(dir) {
    const r = stepRef(H.ref, H.range, dir);
    if (r > new Date()) return;
    H.ref = r;
    render();
  }
  async function periodData(range, ref, upTo) {
    const src = SRC();
    if (range === 'dia') return { name: ref.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }), totals: (await src.day(ref, upTo ? upTo.hour : null)).totals };
    if (range === 'mes') { const m = await src.month(ref.getFullYear(), ref.getMonth(), upTo); return { name: `${MESES[ref.getMonth()]} ${ref.getFullYear()}`, totals: m.totals, items: m.items }; }
    const y = await src.year(ref.getFullYear(), upTo); return { name: String(ref.getFullYear()), totals: y.totals, items: y.items };
  }
  async function renderHistorial(alive) {
    loading('historial');
    const col = colors();
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    // Si el periodo actual va a la mitad, comparo con el anterior hasta el mismo punto
    const isCurrent = H.range === 'dia' ? H.ref.toDateString() === now.toDateString()
      : H.range === 'mes' ? H.ref.getFullYear() === now.getFullYear() && H.ref.getMonth() === now.getMonth()
      : H.ref.getFullYear() === now.getFullYear();
    const upTo = isCurrent ? { month: now.getMonth(), day: now.getDate(), hour } : null;
    const cur = await periodData(H.range, H.ref);
    const prev = await periodData(H.range, stepRef(H.ref, H.range, -1), upTo);
    const dayData = H.range === 'dia' ? await SRC().day(H.ref) : null;
    if (!alive()) return;
    const hasPrev = prev.totals.gen > 0.05;
    const dPct = hasPrev ? Math.round(((cur.totals.gen - prev.totals.gen) / prev.totals.gen) * 100) : 0;
    const prevName = { dia: 'el día anterior', mes: 'el mes anterior', anio: 'el año anterior' }[H.range];
    const next = stepRef(H.ref, H.range, 1);
    const dec = cur.totals.gen < 10 ? 2 : 1;

    $('#screen-historial').innerHTML = `
      ${head('Historial')}
      <div class="seg" role="group" aria-label="Periodo">
        <button data-r="dia" aria-pressed="${H.range === 'dia'}">Día</button>
        <button data-r="mes" aria-pressed="${H.range === 'mes'}">Mes</button>
        <button data-r="anio" aria-pressed="${H.range === 'anio'}">Año</button>
      </div>
      <div class="card">
        <div class="period">
          <button id="prev" aria-label="Anterior">‹</button>
          <div class="name">${cap(cur.name)}</div>
          <button id="next" aria-label="Siguiente" ${next > now ? 'disabled' : ''}>›</button>
        </div>
        <div class="summary">
          <div><div class="k">Generado</div><div class="v">${kwh(cur.totals.gen, dec)} kWh</div>
            ${hasPrev ? `<div class="delta ${dPct >= 0 ? 'up' : 'down'}">${dPct >= 0 ? '▲' : '▼'} ${Math.abs(dPct)} % vs ${prevName}</div>` : ''}</div>
          <div><div class="k">Consumido</div><div class="v">${kwh(cur.totals.load, cur.totals.load < 10 ? 2 : 1)} kWh</div></div>
          <div><div class="k">Ahorro</div><div class="v">${clp(savingOf(cur.totals))}</div></div>
        </div>
        <div id="chart-hist"></div>
        <div class="legend"><span><i class="swatch" style="background:${col.solar}"></i>Generación</span><span><i class="swatch" style="background:${col.home}"></i>Consumo</span></div>
      </div>
      <div class="section-title">Detalle</div>
      <div class="list">
        <div class="row plain"><div class="main"><div class="title">Usado del sol y la batería</div></div><div class="right">${kwh(cur.totals.self, 2)} kWh</div></div>
        <div class="row plain"><div class="main"><div class="title">Sacado de la red</div></div><div class="right">${kwh(cur.totals.imp, 2)} kWh</div></div>
        <div class="row plain"><div class="main"><div class="title">Vendido a la red</div></div><div class="right">${kwh(cur.totals.exp, 2)} kWh</div></div>
      </div>`;
    document.querySelectorAll('#screen-historial .seg button').forEach(b => b.addEventListener('click', () => { H.range = b.dataset.r; H.ref = new Date(); $('#screen-historial').innerHTML = ''; render(); }));
    $('#prev').addEventListener('click', () => shift(-1));
    $('#next').addEventListener('click', () => shift(1));

    if (H.range === 'dia') C.dayChart($('#chart-hist'), dayData, col);
    else if (H.range === 'mes') C.barChart($('#chart-hist'), cur.items, col, { title: (it) => it.date.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }) });
    else C.barChart($('#chart-hist'), cur.items, col, { labels: ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], title: (it) => cap(MESES[it.month]) });
  }

  // ---------- AHORRO ----------
  async function renderAhorro(alive) {
    loading('ahorro');
    const now = new Date();
    const src = SRC();
    const tDay = (await src.day(now)).totals;
    const tMonth = (await src.month(now.getFullYear(), now.getMonth())).totals;
    const tYear = (await src.year(now.getFullYear())).totals;
    if (!alive()) return;
    const kgCO2 = tYear.gen * S.co2;
    $('#screen-ahorro').innerHTML = `
      ${head('Ahorro')}
      <div class="card hero">
        <div class="k">Te ahorraste este mes</div>
        <div class="big">${clp(savingOf(tMonth))}</div>
        <div class="foot">${MESES[now.getMonth()]} · ${kwh(tMonth.gen, tMonth.gen < 10 ? 2 : 0)} kWh generados</div>
      </div>
      <div class="section-title">Resumen</div>
      <div class="list">
        <div class="row plain"><div class="main"><div class="title">Hoy</div></div><div class="right">${clp(savingOf(tDay))}</div></div>
        <div class="row plain"><div class="main"><div class="title">Este mes</div></div><div class="right">${clp(savingOf(tMonth))}</div></div>
        <div class="row plain"><div class="main"><div class="title">En ${now.getFullYear()}</div></div><div class="right">${clp(savingOf(tYear))}</div></div>
        <div class="row plain"><div class="main"><div class="title">Pagado por vender a la red</div><div class="desc">Incluido arriba, este año</div></div><div class="right">${clp(tYear.exp * S.inyeccion)}</div></div>
        <div class="row plain"><div class="main"><div class="title">CO₂ evitado este año</div><div class="desc">Aproximado</div></div><div class="right">${C.fmt(kgCO2, kgCO2 < 10 ? 1 : 0)} kg</div></div>
      </div>
      <div class="section-title">Precios de tu boleta</div>
      <div class="list">
        <label class="row plain"><div class="main"><div class="title">Precio del kWh</div><div class="desc">Lo que pagas por cada kWh</div></div>$<input type="number" inputmode="decimal" min="0" id="in-tarifa" value="${S.tarifa}"></label>
        <label class="row plain"><div class="main"><div class="title">Pago por inyección</div><div class="desc">Lo que te pagan por kWh vendido</div></div>$<input type="number" inputmode="decimal" min="0" id="in-iny" value="${S.inyeccion}"></label>
      </div>
      <p class="note">Ahorro = energía que no sacaste de la red × precio del kWh, más lo que vendiste × pago por inyección. Revisa los dos precios en tu boleta de luz.</p>`;
    const bind = (id, key) => $(id).addEventListener('change', (e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) { S[key] = v; save(); render(); } });
    bind('#in-tarifa', 'tarifa');
    bind('#in-iny', 'inyeccion');
  }

  // ---------- EQUIPO (todos los datos del inversor) ----------
  const ES = {  // traducciones de las opciones que manda el inversor
    'Battery Mode': 'Usando la batería', 'Shutdown Mode': 'Apagado', 'Failure Mode': 'En falla', 'Mains Mode': 'Usando la red',
    'Initial Power On Mode': 'Encendiendo', 'Standby Mode': 'En espera', 'Test Mode': 'Prueba', Static: 'En reposo', Discharge: 'Descargando',
    Charge: 'Cargando', Close: 'Apagado', Open: 'Encendido', Off: 'Apagado', On: 'Encendido', Light: 'Encendida', Flicker: 'Parpadeando',
    'Off Grid': 'Sin inyectar a la red', 'Waiting For Grid Connection': 'Esperando para inyectar', 'Connecting To The Grid': 'Inyectando a la red',
    CSO: 'Solar primero (CSO)', SNU: 'Solar y red (SNU)', OSO: 'Solo solar (OSO)', SUB: 'Solar → red → batería (SUB)', SBU: 'Solar → batería → red (SBU)',
    BLU: 'Batería → casa → red (BLU)', LBU: 'Casa → batería → red (LBU)', AGM: 'Plomo AGM', FLD: 'Plomo inundada', USE: 'Personalizada (USE)',
    LIA: 'Litio (LIA)', LIB: 'Litio (LIB)', LIC: 'Litio (LIC)', PYL: 'Litio Pylontech', TQF: 'Litio TQF', GRO: 'Litio Growatt', SIG: 'Una fase',
  };
  const FLAGS = [  // [dato, qué revisa, valor que indica problema]
    ['batteryNotConnected', 'Batería conectada', '1'], ['lowBatteryAlarm', 'Batería no está baja', '1'], ['batteryVoltageHigher', 'Voltaje de batería normal', '1'],
    ['inputVoltageTooHigh', 'Voltaje de entrada normal', '1'], ['abnormalLowPVPower', 'Potencia de paneles normal', '1'], ['overLoaderd', 'Sin sobrecarga', '1'],
    ['machineOverTemperature', 'Sin sobrecalentamiento', '1'], ['abnormalFanSpeed', 'Ventiladores funcionando', '1'], ['abnormalTemperatureSensor', 'Sensores de temperatura', '1'],
    ['eepromDataAbnormality', 'Memoria interna', '1'], ['eepromReadWriteException', 'Lectura de memoria', '1'],
  ];
  const METRICS = {
    paneles: { name: 'Paneles', unit: 'kW', dec: 2, keys: [['pvPower', 'Entrada 1'], ['pv2Power', 'Entrada 2']] },
    vpaneles: { name: 'Voltaje paneles', unit: 'V', dec: 0, keys: [['pvVoltage', 'Entrada 1'], ['pv2Voltage', 'Entrada 2']] },
    bateria: { name: 'Batería', unit: 'V', dec: 1, keys: [['batteryVoltage', 'Voltaje']] },
    temp: { name: 'Temperaturas', unit: '°C', dec: 0, keys: [['inverterTemperature', 'Inversor'], ['transformerTemperature', 'Transformador'], ['pvTemperature', 'Paneles (MPPT)']] },
    red: { name: 'Red y casa', unit: 'V', dec: 0, keys: [['acInputVoltage', 'Red'], ['outputVoltage', 'Casa']] },
  };
  const EQ = { metric: 'paneles', ref: new Date() };

  async function renderEquipo(alive) {
    loading('equipo');
    if (!isCloud()) {
      $('#screen-equipo').innerHTML = `${head('Equipo')}<div class="card empty">Aquí verás todos los datos de tu inversor: cada panel, la batería, temperaturas, ventiladores, configuración y fallas.<br><br>Conecta tu cuenta en la pestaña <b>Avisos</b>.</div>`;
      return;
    }
    const [s, groups, alarmList] = await Promise.all([Cloud.latest(), Cloud.attributeGroups().catch(() => []), Cloud.alarms().catch(() => [])]);
    if (!alive()) return;
    const f = (s && s.fields) || {};
    const meta = {}; groups.forEach(g => g.attrs.forEach(a => { meta[a.key] = a; }));
    const raw = (k) => (f[k] && f[k].value !== null && f[k].value !== undefined && f[k].value !== '' ? f[k].value : null);
    const show = (k, dec) => {
      const v = raw(k); if (v === null) return null;
      const m = meta[k] || {}; const opt = m.options && m.options[String(v)];
      if (opt) return ES[opt] || opt;
      const u = (f[k] && f[k].unit) || m.unit || '';
      return (isNaN(+v) ? v : C.fmt(+v, dec != null ? dec : (Math.abs(+v) < 10 && +v % 1 ? 1 : 0))) + (u ? ' ' + u : '');
    };
    const section = (title, rows) => {
      const r = rows.map(([label, k, dec]) => [label, typeof k === 'function' ? k() : show(k, dec)]).filter(x => x[1] !== null && x[1] !== undefined);
      return r.length ? `<div class="section-title">${title}</div><div class="list">${r.map(([l, v]) => `<div class="row plain"><div class="main"><div class="title">${l}</div></div><div class="right">${esc(v)}</div></div>`).join('')}</div>` : '';
    };
    const kwW = (k) => () => (raw(k) === null ? null : kw(+raw(k)));
    const battA = () => { const c = +(raw('batteryChargingCurrent') || 0), d = +(raw('batteryDischargeCurrent') || 0); return c > 0 ? `Cargando ${C.fmt(c, 1)} A` : d > 0 ? `Descargando ${C.fmt(d, 1)} A` : '0 A'; };
    const cells = raw('batteryNumberInSeries');
    const bad = FLAGS.filter(([k, , b]) => raw(k) !== null && String(raw(k)) === b);
    const checked = FLAGS.filter(([k]) => raw(k) !== null);
    const at = s && s.time ? new Date(s.time) : null;

    // Todos los datos, por grupo (nombres originales en inglés)
    const allGroups = groups.map(g => {
      const rows = g.attrs.filter(a => a.read && !a.event && raw(a.key) !== null).map(a => [a.name, show(a.key)]);
      return rows.length ? `<details class="list det"><summary class="row plain"><div class="main"><div class="title">${esc(g.key === 'battery_status' ? 'Batería' : g.key === 'bms_status' ? 'BMS (sistema de la batería)' : g.key === 'grid_status' ? 'Red' : g.key === 'load_status' ? 'Salida a la casa' : g.key === 'pv_panel_status' ? 'Paneles' : 'Otros datos')}</div></div><div class="right">${rows.length}</div></summary>${rows.map(([l, v]) => `<div class="row plain"><div class="main"><div class="title small">${esc(l)}</div></div><div class="right">${esc(v)}</div></div>`).join('')}</details>` : '';
    }).join('');

    const M = METRICS[EQ.metric];
    $('#screen-equipo').innerHTML = `
      ${head('Equipo', at ? `Datos de las ${hhmm(at)}` : '')}
      <div class="card status-card">
        <div class="ask-head"><div class="ask-ico" style="background:${bad.length ? cssVar('--bad') : cssVar('--good')}">${svgIcon(bad.length ? 'warn' : 'ok')}</div>
        <div><div class="title">${bad.length ? `${bad.length} problema${bad.length > 1 ? 's' : ''} detectado${bad.length > 1 ? 's' : ''}` : 'El inversor está funcionando bien'}</div>
        <div class="desc">${show('mode') || ''}${raw('statusCode') !== null ? ` · código ${esc(raw('statusCode'))}` : ''} · ${checked.length} chequeos</div></div></div>
        ${bad.length ? `<div class="flags">${bad.map(([, l]) => `<div class="flag bad">✕ ${l.replace('normal', 'ANORMAL')}</div>`).join('')}</div>` : ''}
      </div>
      <div id="panel-check"><div class="section-title">Mis paneles</div><div class="card empty">Calculando…</div></div>
      ${alarmList.length ? `<div class="section-title">Alarmas registradas</div><div class="list">${alarmList.slice(0, 10).map(a => {
        const t = a.eventAttributeNameDisplay || a.alarmName || a.eventName || a.name || a.attributeName || 'Alarma';
        const d = a.createdAt || a.alarmAt || a.time || a.occurredAt;
        return `<div class="row"><div class="ico" style="background:${cssVar('--bad')}">${svgIcon('warn')}</div><div class="main"><div class="title">${esc(t)}</div><div class="desc">${d ? esc(new Date(d).toLocaleString('es-CL')) : ''}</div></div></div>`;
      }).join('')}</div>` : ''}

      <div class="section-title">Gráficos del día</div>
      <div class="card">
        <div class="chips">${Object.entries(METRICS).map(([k, m]) => `<button data-m="${k}" aria-pressed="${k === EQ.metric}">${m.name}</button>`).join('')}</div>
        <div class="period"><button id="eq-prev" aria-label="Día anterior">‹</button><div class="name">${cap(EQ.ref.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }))}</div><button id="eq-next" aria-label="Día siguiente" ${stepRef(EQ.ref, 'dia', 1) > new Date() ? 'disabled' : ''}>›</button></div>
        <div id="chart-eq"><div class="empty">Cargando…</div></div>
        <div class="legend">${M.keys.map(([, n], i) => `<span><i class="swatch" style="background:${seriesColor(i)}"></i>${n}</span>`).join('')}</div>
      </div>

      ${section('Paneles solares', [['Producción total ahora', kwW('generationPower')], ['Entrada 1 · potencia', kwW('pvPower')], ['Entrada 1 · voltaje', 'pvVoltage', 0], ['Entrada 1 · corriente', 'pvCurrent', 1],
        ['Entrada 2 · potencia', kwW('pv2Power')], ['Entrada 2 · voltaje', 'pv2Voltage', 0], ['Entrada 2 · corriente', 'pv2Current', 1], ['Carga desde los paneles', 'pvChargingMark'],
        ['Generado hoy', 'tqfDailyElectricityGeneration', 2], ['Generado este mes', 'tqfMonthlyElectricityGeneration', 1], ['Generado este año', 'tqfYearlyElectricityGeneration', 1], ['Generado en total', 'tqfTotalElectricityGeneration', 1]])}
      ${section('Batería', [['Carga', 'batteryCapacity', 0], ['Estado', 'batteryStatus'], ['Corriente', battA], ['Voltaje', 'batteryVoltage', 1],
        ['Tipo de batería', 'batteryType'], ['Batería de', () => (cells ? `${cells * 12} V (${cells} en serie)` : null)], ['Voltaje de carga (absorción)', 'strongChargingVoltage', 1], ['Voltaje de flotación', 'floatChargingVoltage', 1],
        ['Corta por batería baja a', 'lowElectricLockVoltage', 1], ['Vuelve a la batería sobre', 'returnToBatteryModeVoltage', 1], ['Pasa a la red bajo', 'returnToMainsModeVoltage', 1],
        ['Corriente máx. de carga', 'maximumTotalChargingCurrent', 0], ['Corriente máx. de carga desde la red', 'maxUtilityChargeCurrent', 0], ['Comunicación con BMS', () => (raw('bmsCommunicationNormal') === null ? null : +raw('bmsCommunicationStatus') || +raw('bmsCommunicationNormal') ? 'Conectado' : 'Sin BMS')]])}
      ${section('Red eléctrica', [['Potencia', kwW('mainsPower')], ['Voltaje', 'acInputVoltage', 0], ['Frecuencia', 'mainsFrequency', 1], ['Inyección a la red', 'gridConnectionSign']])}
      ${section('Salida a la casa', [['Potencia', kwW('outputActivePower')], ['Potencia aparente', 'outputApparentPower', 0], ['Voltaje', 'outputVoltage', 0], ['Frecuencia', 'outputFrequency', 1], ['Uso del inversor', 'outputLoadPercent', 0]])}
      ${section('Inversor', [['Modo de trabajo', 'mode'], ['Prioridad de carga', 'chargingPriorityOrder'], ['Prioridad de los paneles', 'pvEnergyFeedingPriority'], ['Modo ECO', 'eco'],
        ['Temp. inversor', 'inverterTemperature', 0], ['Temp. transformador', 'transformerTemperature', 0], ['Temp. rectificador', 'dcRectificationTemperature', 0], ['Temp. elevador (boost)', 'boostTemperature', 0],
        ['Temp. entradas 1 / 2 (MPPT)', () => (raw('pvTemperature') === null ? null : `${raw('pvTemperature')} / ${raw('pv2Temperature') ?? '–'} °C`)], ['Ventiladores', () => (raw('fan1Speed') === null ? null : `${raw('fan1Speed')} % / ${raw('fan2Speed') ?? '–'} %`)],
        ['Voltaje interno (bus)', 'busVoltage', 0], ['Modelo', 'deviceType'], ['Versión de software', 'softwareVersion']])}
      ${checked.length ? `<div class="section-title">Chequeos</div><div class="list">${checked.map(([k, l, b]) => { const ok = String(raw(k)) !== b; return `<div class="row plain"><div class="main"><div class="title">${l}</div></div><div class="right" style="color:${ok ? cssVar('--good') : cssVar('--bad')}">${ok ? '✓ Bien' : '✕ Revisar'}</div></div>`; }).join('')}</div>` : ''}
      ${allGroups ? `<div class="section-title">Todos los datos (${Object.keys(f).length})</div>${allGroups}` : ''}
      <p class="note">Los nombres de «Todos los datos» vienen en inglés desde el inversor.</p>`;

    document.querySelectorAll('#screen-equipo .chips button').forEach(b => b.addEventListener('click', () => { EQ.metric = b.dataset.m; render(); }));
    $('#eq-prev').addEventListener('click', () => { EQ.ref = stepRef(EQ.ref, 'dia', -1); render(); });
    $('#eq-next').addEventListener('click', () => { const r = stepRef(EQ.ref, 'dia', 1); if (r <= new Date()) { EQ.ref = r; render(); } });
    renderPanelCheck(alive, raw).catch(e => { const el = $('#panel-check'); if (el) el.innerHTML = `<div class="section-title">Mis paneles</div><div class="card empty">No pude calcular: ${esc(e.message || e)}</div>`; });
    const data = await Cloud.daySeries(EQ.ref, M.keys.map(k => k[0]));
    if (!alive()) return;
    C.seriesChart($('#chart-eq'), data.t, M.keys.map(([k, n], i) => ({ name: n, color: seriesColor(i), values: data.values[k] })), colors(), { unit: M.unit, dec: M.dec, zero: M.unit === 'kW' });
  }
  // ---------- MIS PANELES: cuántos hay y cuánto genera cada uno ----------
  // El inversor mide cada ENTRADA (una fila de paneles en serie), no cada panel. Con el número de paneles
  // y su potencia calculo lo que genera cada uno y lo comparo con lo esperado.
  async function renderPanelCheck(alive, raw) {
    const today = new Date();
    const d = await Cloud.daySeries(today, ['pvPower', 'pv2Power', 'pvVoltage', 'pv2Voltage']);
    if (!alive() || !$('#panel-check')) return;
    const integ = (arr) => { let e = 0; for (let i = 0; i < arr.length; i++) { const nx = i + 1 < d.t.length ? d.t[i + 1] : d.t[i] + 5 / 60; e += arr[i] * Math.min(Math.max(0, nx - d.t[i]), 10 / 60); } return e; };
    const inputs = [
      { n: 1, key: 'p1', P: +(raw('pvPower') || 0), V: +(raw('pvVoltage') || 0), A: +(raw('pvCurrent') || 0), E: integ(d.values.pvPower), peak: Math.max(0, ...d.values.pvPower), vmax: Math.max(0, ...d.values.pvVoltage) },
      { n: 2, key: 'p2', P: +(raw('pv2Power') || 0), V: +(raw('pv2Voltage') || 0), A: +(raw('pv2Current') || 0), E: integ(d.values.pv2Power), peak: Math.max(0, ...d.values.pv2Power), vmax: Math.max(0, ...d.values.pv2Voltage) },
    ];
    // Estimación por voltaje: cada panel aporta ~41 V trabajando y ~50 V sin carga
    inputs.forEach(x => { const v = Math.max(x.V, x.vmax); x.estLo = v > 30 ? Math.max(1, Math.round(v / 50)) : 0; x.estHi = v > 30 ? Math.max(1, Math.round(v / 41)) : 0; x.count = S[x.key] || 0; });
    const wp = S.wp || 0;
    const known = wp > 0 && inputs.every(x => x.count > 0 || x.vmax < 30);
    const totalPanels = inputs.reduce((a, x) => a + x.count, 0);
    const kwp = totalPanels * wp / 1000;
    const totalE = inputs.reduce((a, x) => a + x.E, 0);
    const hour = today.getHours() + today.getMinutes() / 60;

    let verdict = '';
    if (known && kwp > 0) {
      const yieldNow = totalE / kwp;                                           // kWh por kWp hoy
      const expected = dailyGoalPerKwp(today) * solarFraction(today, hour);   // lo esperado a esta hora (kWh por kWp)
      const pctPeak = Math.max(...inputs.map(x => (x.count ? x.peak / (x.count * wp / 1000) : 0))) * 100;
      const perPanel = inputs.filter(x => x.count).map(x => x.E / x.count);
      const unbalance = perPanel.length === 2 && Math.max(...perPanel) > 0 ? 1 - Math.min(...perPanel) / Math.max(...perPanel) : 0;
      const lvl = expected > 0.5 && yieldNow < expected * 0.25 ? 'bad' : expected > 0.5 && yieldNow < expected * 0.6 ? 'warn' : 'good';
      // ¿Los paneles están "frenados"? Voltaje alto + poca corriente + batería llena + casa alimentada por la red
      const soc = +(raw('batteryCapacity') || 0), mode = String(raw('mode') || '');
      const highV = inputs.some(x => x.count && x.V > x.count * 36), lowA = inputs.every(x => x.A < 1.5);
      const throttled = lvl !== 'good' && highV && lowA && soc >= 95;
      if (throttled) {
        verdict = `<div class="verdict warn">
          <b>Los paneles parecen estar bien: el inversor los está frenando</b>
          <div>Tienen buen voltaje (${C.fmt(Math.max(...inputs.map(x => x.V)), 0)} V), o sea reciben sol, pero casi no les pide corriente (${C.fmt(Math.max(...inputs.map(x => x.A)), 1)} A).</div>
          <div>Pasa porque la batería está llena (${Math.round(soc)} %)${mode === 'L' || mode === 'M' ? ' y el inversor está en <b>modo red</b>: la casa se alimenta de la red y los paneles solo cargan la batería' : ''}${raw('gridConnectionFunction') !== null && String(raw('gridConnectionFunction')) === '0' ? ', y la venta a la red está desactivada' : ''}. Lo que sobra de sol se pierde.</div>
          <div><b>Qué revisar:</b> en la configuración del inversor, la <b>prioridad de salida</b> (SBU o SUB hace que la casa use primero el sol). Hoy pudiste generar unos ${C.fmt(expected * kwp, 0)} kWh y se aprovecharon ${C.fmt(totalE, 1)}.</div>
          <div>Pregúntale al instalador antes de cambiarlo.</div>
        </div>`;
      } else
      verdict = `<div class="verdict ${lvl}">
        <b>${lvl === 'bad' ? 'Están generando MUY por debajo de lo normal' : lvl === 'warn' ? 'Están generando menos de lo esperado' : 'Generación normal'}</b>
        <div>Hoy: ${C.fmt(totalE, 2)} kWh con ${C.fmt(kwp, 1)} kWp instalados = ${C.fmt(yieldNow, 2)} kWh por kWp. Lo normal en Santiago a esta hora es unos ${C.fmt(expected, 1)} (≈ ${C.fmt(expected * kwp, 1)} kWh).</div>
        <div>Mejor momento de hoy: ${C.fmt(pctPeak, 0)} % de la potencia de los paneles${pctPeak < 30 ? ' (con sol directo debería pasar del 60 %)' : ''}.</div>
        ${unbalance > 0.3 ? `<div>Una entrada genera ${Math.round(unbalance * 100)} % menos por panel que la otra: puede haber sombra, suciedad o un panel o conexión con problema en esa fila.</div>` : ''}
        ${lvl !== 'good' ? '<div>Si hoy estuvo despejado, revisa: sombra, suciedad, conexiones de los paneles y que el interruptor de los paneles esté encendido.</div>' : ''}
      </div>`;
    }

    const rows = inputs.map(x => {
      const c = x.count, cap = c && wp ? c * wp / 1000 : 0;
      const est = x.estLo === x.estHi ? String(x.estLo) : `${x.estLo}–${x.estHi}`;
      return `<div class="pv-input">
        <div class="pv-head"><b>Entrada ${x.n}</b><span>${C.fmt(x.V, 0)} V · ${C.fmt(x.A, 1)} A · ${kw(x.P)}</span></div>
        <label class="pv-row">Paneles en esta entrada <input type="number" inputmode="numeric" min="0" max="40" data-k="${x.key}" value="${c || ''}" placeholder="${x.estLo ? est : '?'}"></label>
        ${x.estLo ? `<div class="pv-hint">Según el voltaje parecen ser ${x.estLo === x.estHi ? x.estLo : `entre ${x.estLo} y ${x.estHi}`} paneles.</div>` : '<div class="pv-hint">Sin voltaje: puede que no tenga paneles conectados.</div>'}
        ${c ? `<div class="pv-grid">
          <div><span>Cada panel ahora</span><b>${kw(x.P / c)}</b></div>
          <div><span>Cada panel hoy</span><b>${C.fmt(x.E / c * 1000, 0)} Wh</b></div>
          <div><span>Máximo de hoy (por panel)</span><b>${kw(x.peak / c)}${wp ? ` <small>(${C.fmt(x.peak / cap * 100, 0)} %)</small>` : ''}</b></div>
          <div><span>Entrada completa hoy</span><b>${C.fmt(x.E, 2)} kWh</b></div>
        </div>` : ''}
      </div>`;
    }).join('');

    $('#panel-check').innerHTML = `<div class="section-title">Mis paneles</div>
      <div class="card">
        <div class="pv-top">${known ? `<b>${totalPanels} paneles de ${wp} W</b> = ${C.fmt(kwp, 2)} kWp` : '<b>Cuéntame tus paneles</b> para revisar si generan bien'}</div>
        <label class="pv-row">Potencia de cada panel (W) <input type="number" inputmode="numeric" min="50" max="1000" data-k="wp" value="${wp || ''}" placeholder="ej. 550"></label>
        <div class="pv-hint">Sale en la etiqueta de atrás del panel («Pmax» o «Potencia máxima»).</div>
        ${rows}
        ${verdict}
        <p class="note" style="margin:10px 0 0">El inversor mide cada entrada completa, no cada panel: «cada panel» es el promedio de su fila. Datos de hoy hasta las ${hhmm(today)}</p>
      </div>`;
    $('#panel-check').querySelectorAll('input[data-k]').forEach(i => i.addEventListener('change', () => {
      const v = parseInt(i.value, 10); S[i.dataset.k] = v > 0 ? v : null; save(); renderPanelCheck(alive, raw);
    }));
  }

  const seriesColor = (i) => [cssVar('--solar'), cssVar('--home'), cssVar('--batt')][i] || cssVar('--grid');

  // ---------- AVISOS ----------
  async function buildAlerts() {
    if (!isCloud()) return Demo.alerts();
    const out = [];
    const L = await Cloud.live();
    if (S.aOffline && L.raw) {
      FLAGS.forEach(([k, l, b]) => { const v = L.raw[k] && L.raw[k].value; if (v !== null && v !== undefined && String(v) === b) out.push({ level: 'bad', icon: 'warn', title: 'Falla del inversor', desc: l.replace('normal', 'anormal') + ': revisar.', at: L.at }); });
    }
    if (S.aOffline && !L.online) out.push({ level: 'bad', icon: 'off', title: 'Inversor sin conexión', desc: `No manda datos desde las ${hhmm(L.at)}.`, at: L.at });
    if (S.aBattLow && L.soc < S.battLow) out.push({ level: 'warn', icon: 'batt', title: `Batería bajo ${S.battLow} %`, desc: `Está en ${Math.round(L.soc)} %.`, at: L.at });
    if (S.aFull && L.soc >= 99.5) out.push({ level: 'info', icon: 'batt', title: 'Batería llena', desc: 'Está al 100 %.', at: L.at });
    if (S.aLowProd) {
      const now = new Date();
      const m = await Cloud.month(now.getFullYear(), now.getMonth());
      const past = m.items.filter(it => it && it.date.toDateString() !== now.toDateString() && it.gen > 0);
      if (past.length >= 3) {
        const y = past[past.length - 1];
        const avg = past.slice(0, -1).reduce((a, b) => a + b.gen, 0) / (past.length - 1);
        if (avg > 0 && y.gen < avg * 0.7) out.push({ level: 'warn', icon: 'down', title: 'Producción baja', desc: `El ${y.date.toLocaleDateString('es-CL', { weekday: 'long' })} generó ${Math.round((1 - y.gen / avg) * 100)} % menos que el promedio.`, at: y.date });
      }
    }
    return out;
  }

  async function renderAvisos(alive) {
    loading('avisos');
    const lvl = { bad: cssVar('--bad'), warn: cssVar('--warn'), info: cssVar('--tint') };
    const list = await buildAlerts();
    if (!alive()) return;
    const acc = isCloud() ? Cloud.account() : null;
    const sw = (key) => `<span class="switch"><input type="checkbox" data-k="${key}" ${S[key] ? 'checked' : ''}><span></span></span>`;
    const iconFor = (a) => a.icon || ({ bad: 'off', warn: a.title.startsWith('Producción') ? 'down' : 'warn', info: 'info' }[a.level]);
    $('#screen-avisos').innerHTML = `
      ${head('Avisos')}
      <div class="list">
        ${list.length ? list.map(a => `
          <div class="row"><div class="ico" style="background:${lvl[a.level]}">${svgIcon(iconFor(a))}</div>
            <div class="main"><div class="title">${esc(a.title)}</div><div class="desc">${esc(a.desc)}</div></div>
            <div class="right" style="font-size:13px">${ago(a.at)}</div></div>`).join('')
          : `<div class="row"><div class="ico" style="background:${cssVar('--good')}">${svgIcon('ok')}</div><div class="main"><div class="title">Todo bien</div><div class="desc">No hay nada que revisar.</div></div></div>`}
      </div>
      <div class="section-title">Avisarme cuando</div>
      <div class="list">
        <div class="row"><div class="ico" style="background:${cssVar('--warn')}">${svgIcon('batt')}</div><div class="main"><div class="title">La batería baje de</div></div>
          <input type="number" inputmode="numeric" min="5" max="95" id="in-low" value="${S.battLow}" style="width:44px">%&nbsp;${sw('aBattLow')}</div>
        <div class="row"><div class="ico" style="background:${cssVar('--bad')}">${svgIcon('off')}</div><div class="main"><div class="title">El inversor se desconecte o falle</div></div>${sw('aOffline')}</div>
        <div class="row"><div class="ico" style="background:${cssVar('--warn')}">${svgIcon('down')}</div><div class="main"><div class="title">La producción sea baja</div><div class="desc">30 % menos que el promedio</div></div>${sw('aLowProd')}</div>
        <div class="row"><div class="ico" style="background:${cssVar('--good')}">${svgIcon('batt')}</div><div class="main"><div class="title">La batería se llene</div></div>${sw('aFull')}</div>
      </div>
      <div class="section-title">Cuenta de Solar of Things</div>
      ${acc ? `
      <div class="list">
        <div class="row"><div class="ico" style="background:${cssVar('--good')}">${svgIcon('link')}</div><div class="main"><div class="title">${esc(acc.account)}</div><div class="desc">${esc(acc.device.name || '')} · ${esc(acc.device.model || 'Inversor')}${acc.device.ratedKw ? ' · ' + acc.device.ratedKw + ' kW' : ''}</div></div></div>
        <button class="row plain btn-row danger" id="logout">Desconectar</button>
      </div>
      <p class="note">Los avisos aparecen al abrir la app. Para que te lleguen con la app cerrada falta el paso 3.</p>` : `
      <form class="list" id="login-form" autocomplete="on">
        <label class="row plain"><div class="main"><div class="title">Usuario</div></div><input type="text" name="username" id="in-user" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="tu usuario" style="width:60%;text-align:right"></label>
        <label class="row plain"><div class="main"><div class="title">Clave</div></div><input type="password" name="password" id="in-pass" autocomplete="current-password" placeholder="••••••" class="pass"></label>
        <button class="row plain btn-row" type="submit" id="login-btn">Conectar</button>
      </form>
      <p class="note" id="login-msg">Tu usuario y clave se guardan solo en este celular y se usan únicamente para hablar con Solar of Things.</p>`}`;
    document.querySelectorAll('#screen-avisos input[type=checkbox]').forEach(i => i.addEventListener('change', () => { S[i.dataset.k] = i.checked; save(); render(); }));
    $('#in-low').addEventListener('change', (e) => { const v = parseInt(e.target.value, 10); if (v >= 5 && v <= 95) { S.battLow = v; save(); render(); } });
    if (acc) {
      $('#logout').addEventListener('click', () => { if (confirm('¿Desconectar tu cuenta de este celular?')) { Cloud.disconnect(); clearScreens(); render(); } });
    } else {
      $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('#login-btn'), msg = $('#login-msg');
        btn.disabled = true; btn.textContent = 'Conectando…';
        try {
          await Cloud.connect($('#in-user').value, $('#in-pass').value);
          clearScreens();
          go('ahora');
        } catch (err) {
          btn.disabled = false; btn.textContent = 'Conectar';
          msg.textContent = err.message || 'No se pudo conectar.';
          msg.style.color = cssVar('--bad');
        }
      });
    }
  }

  function clearScreens() { document.querySelectorAll('.screen').forEach(s => { s.innerHTML = ''; }); }

  // ---------- Arranque ----------
  let rt, lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(render, 150); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  setInterval(() => { if (tab === 'ahora' && !document.hidden) render(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && tab === 'ahora') render(); });
  if (['light', 'dark'].includes(qs.get('theme'))) document.documentElement.dataset.theme = qs.get('theme');
  const start = qs.get('tab');
  go(['ahora', 'historial', 'ahorro', 'equipo', 'avisos'].includes(start) ? start : 'ahora');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
