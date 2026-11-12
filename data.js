/* Mi Solar — capa de datos.
 * Hoy: modo demostración (datos simulados, realistas para Chile central).
 * Después: modo conectado, que pedirá los datos al intermediario (Cloudflare Worker)
 * que lee la nube de Solar of Things. La app usa las mismas funciones en ambos modos.
 */
(function () {
  const STEP_MIN = 5;                 // un punto cada 5 minutos
  const PTS = (24 * 60) / STEP_MIN;   // 288 puntos por día
  const SYS = { pvPeak: 4.4, battKwh: 5.12, battMin: 20, battMaxKw: 3 };

  function rng(seed) {               // aleatorio repetible (mismo día = mismos datos)
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const dayKey = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const gauss = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
  const doy = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

  const cache = new Map();

  // Simula un día completo (o hasta "ahora" si es hoy)
  function simulateDay(date) {
    const key = dayKey(date);
    if (cache.has(key)) return cache.get(key);
    const r = rng(key * 7919);
    const season = Math.cos((2 * Math.PI * (doy(date) - 5)) / 365); // +1 enero, −1 julio
    const dayLen = 12 + 2.3 * season;                                 // horas de sol
    const noon = 13.6;
    const rise = noon - dayLen / 2;
    const cloudiness = r() < 0.18 ? 0.35 + r() * 0.35 : 0.85 + r() * 0.15; // algunos días nublados
    const peak = SYS.pvPeak * (0.72 + 0.28 * season) * cloudiness;
    let soc = 45 + r() * 25;

    const out = { t: [], pv: [], load: [], batt: [], grid: [], soc: [] };
    let cloudNoise = 1, applianceLeft = 0, applianceKw = 0, baseNoise = 0;
    for (let i = 0; i < PTS; i++) {
      const h = (i * STEP_MIN) / 60;
      cloudNoise = Math.min(1, Math.max(0.55, cloudNoise + (r() - 0.5) * 0.12));
      const x = (h - rise) / dayLen;
      const pv = x > 0 && x < 1 ? peak * Math.pow(Math.sin(Math.PI * x), 1.25) * (cloudiness < 0.8 ? cloudNoise : 0.96 + 0.04 * cloudNoise) : 0;
      if (applianceLeft <= 0 && r() < (h > 7 && h < 23 ? 0.012 : 0.002)) { applianceLeft = 2 + Math.floor(r() * 6); applianceKw = 0.8 + r() * 1.2; }
      const extra = applianceLeft-- > 0 ? applianceKw : 0;
      baseNoise += (r() - 0.5) * 0.04; baseNoise = Math.max(-0.08, Math.min(0.12, baseNoise));
      const load = 0.34 + baseNoise + 0.55 * gauss(h, 7.8, 0.9) + 0.45 * gauss(h, 13.5, 1.2) + 1.25 * gauss(h, 20.6, 1.6) + extra;

      // Balance: sobra → carga batería → inyecta a la red; falta → usa batería → compra a la red
      let net = pv - load, batt = 0, grid = 0;
      const dtH = STEP_MIN / 60;
      if (net >= 0) {
        const room = ((100 - soc) / 100) * SYS.battKwh / dtH;
        batt = Math.min(net, SYS.battMaxKw, room);
        grid = -(net - batt);                 // negativo = inyectando
      } else {
        const avail = ((soc - SYS.battMin) / 100) * SYS.battKwh / dtH;
        batt = -Math.min(-net, SYS.battMaxKw, Math.max(0, avail));
        grid = -net + batt;                   // positivo = comprando
      }
      soc = Math.min(100, Math.max(SYS.battMin, soc + (batt * dtH / SYS.battKwh) * 100));
      out.t.push(h); out.pv.push(pv); out.load.push(load); out.batt.push(batt); out.grid.push(grid); out.soc.push(soc);
    }
    out.totals = totalsOf(out, PTS);
    cache.set(key, out);
    return out;
  }

  function totalsOf(d, n) {
    const dt = STEP_MIN / 60;
    let gen = 0, load = 0, imp = 0, exp = 0;
    for (let i = 0; i < n; i++) {
      gen += d.pv[i] * dt; load += d.load[i] * dt;
      if (d.grid[i] > 0) imp += d.grid[i] * dt; else exp += -d.grid[i] * dt;
    }
    return { gen, load, imp, exp, self: Math.max(0, load - imp) };
  }

  const isToday = (d) => dayKey(d) === dayKey(new Date());
  const nowIndex = () => { const n = new Date(); return Math.min(PTS - 1, Math.floor((n.getHours() * 60 + n.getMinutes()) / STEP_MIN)); };

  // Día: curvas cada 5 min (cortadas en "ahora" si es hoy)
  function day(date, cutAt) {
    const d = simulateDay(date);
    let n = isToday(date) ? nowIndex() + 1 : PTS;
    if (cutAt != null) n = Math.min(n, Math.floor(cutAt * 12) + 1);  // cutAt = hora del día
    const cut = (a) => a.slice(0, n);
    return { t: cut(d.t), pv: cut(d.pv), load: cut(d.load), soc: cut(d.soc), totals: n === PTS ? d.totals : totalsOf(d, n), partial: n < PTS };
  }

  function sumTotals(list) {
    return list.reduce((a, b) => ({ gen: a.gen + b.gen, load: a.load + b.load, imp: a.imp + b.imp, exp: a.exp + b.exp, self: a.self + b.self }), { gen: 0, load: 0, imp: 0, exp: 0, self: 0 });
  }

  // Mes: un total por día
  // upTo: comparar periodos a la misma altura (ej.: del 1 al 12 de cada mes)
  function month(year, m, upTo) {
    const today = new Date();
    const days = new Date(year, m + 1, 0).getDate();
    const items = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(year, m, i);
      if (d > today || (upTo && i > upTo.day)) { items.push(null); continue; }
      items.push({ label: String(i), date: d, ...day(d, upTo && i === upTo.day ? upTo.hour : null).totals });
    }
    return { items, totals: sumTotals(items.filter(Boolean)) };
  }

  // Año: un total por mes
  function year(y, upTo) {
    const today = new Date();
    const items = [];
    for (let m = 0; m < 12; m++) {
      if (new Date(y, m, 1) > today || (upTo && m > upTo.month)) { items.push(null); continue; }
      const mm = month(y, m, upTo && m === upTo.month ? upTo : null);
      items.push({ label: MESES_CORTOS[m], month: m, ...mm.totals });
    }
    return { items, totals: sumTotals(items.filter(Boolean)) };
  }

  // Lectura en vivo
  function live() {
    const d = simulateDay(new Date());
    const i = nowIndex();
    return {
      at: new Date(), online: true,
      pv: d.pv[i], load: d.load[i], batt: d.batt[i], grid: d.grid[i], soc: d.soc[i],
      today: day(new Date()).totals,
    };
  }

  // Avisos de ejemplo
  function alerts() {
    const now = new Date();
    const ago = (h) => new Date(now.getTime() - h * 3600e3);
    return [
      { level: 'warn', title: 'Batería bajo 25 %', desc: 'Llegó a 22 % antes del amanecer.', at: ago(9) },
      { level: 'info', title: 'Batería llena', desc: 'Empezó a inyectar a la red.', at: ago(4) },
      { level: 'bad', title: 'Inversor sin conexión', desc: 'Se perdió la señal WiFi por 12 minutos.', at: ago(30) },
      { level: 'warn', title: 'Producción baja', desc: 'Ayer generó 38 % menos que el promedio (nublado).', at: ago(52) },
    ];
  }

  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  window.SolarData = { mode: 'demo', SYS, nowIndex, day, month, year, live, alerts, MESES, sumTotals };
})();
