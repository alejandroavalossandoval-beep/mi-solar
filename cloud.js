/* Mi Solar — conexión con la nube de Solar of Things (solar.siseli.com).
 * Funciona directo desde el iPhone (la nube permite pedidos desde otras páginas).
 * Guarda en el celular solo: usuario, la clave ya cifrada (MD5, como la manda su web) y los tokens de sesión.
 * La API no es oficial: se copió de cómo funciona su propia página web.
 */
(function (root) {
  const BASE = 'https://solar.siseli.com/apis';
  const APP_ID = 'rBrTRfAPXz';
  const APP_KEY = 'CJbrtLtqFES62bJ3ZW7c';   // clave pública que trae su propia página web
  const TZ = 'America/Santiago';
  const STORE = 'miSolar.cuenta';

  // ---------- MD5 (pequeño, sin librerías) ----------
  function md5(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    const K = [], S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0;
    const len = bytes.length, nBlocks = ((len + 8) >> 6) + 1;
    const w = new Uint32Array(nBlocks * 16);
    for (let i = 0; i < len; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
    w[len >> 2] |= 0x80 << ((len % 4) * 8);
    w[nBlocks * 16 - 2] = (len * 8) >>> 0;
    w[nBlocks * 16 - 1] = Math.floor(len / 0x20000000);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let blk = 0; blk < nBlocks; blk++) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + w[blk * 16 + g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(s => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
  }

  const subtle = () => (root.crypto && root.crypto.subtle);
  const hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  async function sha256Hex(text) { return hex(await subtle().digest('SHA-256', new TextEncoder().encode(text))); }
  async function hmacSha256(keyText, msgText) {
    const key = await subtle().importKey('raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle().sign('HMAC', key, new TextEncoder().encode(msgText)));
  }
  async function signedHeaders(body) {
    const nonce = hex(root.crypto.getRandomValues(new Uint8Array(16)));
    const bodyHash = await sha256Hex(body);
    const qs = `IOT-Open-AppID=${APP_ID}&IOT-Open-Body-Hash=${bodyHash}&IOT-Open-Nonce=${nonce}`;
    const sign = md5(await hmacSha256(APP_KEY, btoa(qs)));
    return { 'IOT-Open-AppID': APP_ID, 'IOT-Open-Nonce': nonce, 'IOT-Open-Body-Hash': bodyHash, 'IOT-Open-Sign': sign };
  }

  // ---------- Cuenta guardada ----------
  const storage = {
    get() { try { return JSON.parse(root.localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } },
    set(v) { try { root.localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
    clear() { try { root.localStorage.removeItem(STORE); } catch (e) { /* nada */ } },
  };
  let acc = storage.get();

  class CloudError extends Error { constructor(msg, code) { super(msg); this.code = code; } }

  async function loginRaw(account, passMd5) {
    const body = JSON.stringify({ account, password: passMd5 });
    const r = await fetch(BASE + '/login/account', { method: 'POST', body, headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', ...(await signedHeaders(body)) } });
    const j = await r.json();
    if (j.code !== 0 || !j.data || !j.data.accessToken) {
      const msg = j.code === 7 ? 'Usuario o clave incorrectos.' : j.code === 20050 ? 'Demasiados intentos. Espera un minuto.' : (j.localMessage || j.message || 'No se pudo entrar.');
      throw new CloudError(msg, j.code);
    }
    return j.data;
  }

  // Conectar por primera vez: entra, busca el inversor y guarda todo en el celular
  async function connect(account, password) {
    const passMd5 = md5(password);
    const d = await loginRaw(account.trim(), passMd5);
    acc = { account: account.trim(), passMd5, token: d.accessToken, refresh: d.refreshToken, exp: d.accessTokenWillExpiredAt };
    const dl = await post('/device/list', { page: 1, count: 50 });
    const dev = dl.list && dl.list[0];
    if (!dev) throw new CloudError('Tu cuenta no tiene inversores.');
    acc.device = { id: dev.id, stationId: dev.stationId, name: dev.name, model: dev.deviceManufacturerName, ratedKw: dev.ratedPower, installedAt: dev.installedAt, currency: dev.stationCurrencyCode };
    storage.set(acc);
    return acc;
  }
  function disconnect() { acc = null; storage.clear(); clearCache(); }
  const connected = () => !!(acc && acc.device);

  async function relogin() {
    const d = await loginRaw(acc.account, acc.passMd5);
    acc.token = d.accessToken; acc.refresh = d.refreshToken; acc.exp = d.accessTokenWillExpiredAt;
    storage.set(acc);
  }

  async function request(method, path, payload, retry = true) {
    if (!acc) throw new CloudError('Sin cuenta conectada.');
    if (acc.exp && Date.parse(acc.exp) - Date.now() < 5 * 60e3) await relogin();
    const r = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json', 'IOT-Token': acc.token, 'IOT-Time-Zone': TZ },
      body: method === 'GET' ? undefined : JSON.stringify(payload || {}),
    });
    let j = null; try { j = await r.json(); } catch (e) { /* respuesta rara */ }
    if (r.status === 401 || r.status === 403 || (j && j.code !== 0 && retry && /token|login|auth/i.test(j.message || ''))) {
      if (!retry) throw new CloudError('La sesión expiró.');
      await relogin();
      return request(method, path, payload, false);
    }
    if (!r.ok || !j || j.code !== 0) throw new CloudError((j && (j.localMessage || j.message)) || ('Error ' + r.status));
    return j.data;
  }
  const post = (p, body) => request('POST', p, body);
  const get = (p) => request('GET', p);

  // ---------- Fechas ----------
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function isoLocal(d) {
    const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o);
    return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${s}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
  }
  const sameDay = (a, b) => ymd(a) === ymd(b);

  // ---------- Caché (los días pasados no cambian) ----------
  const CACHE_KEY = 'miSolar.cacheDias';
  let dayCache = {};
  try { dayCache = JSON.parse(root.localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { dayCache = {}; }
  const saveCache = () => { try { root.localStorage.setItem(CACHE_KEY, JSON.stringify(dayCache)); } catch (e) { /* lleno o bloqueado */ } };
  function clearCache() { dayCache = {}; saveCache(); }
  const mem = new Map();
  const memo = async (key, ttlMs, fn) => {
    const hit = mem.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.v;
    const v = await fn(); mem.set(key, { at: Date.now(), v }); return v;
  };

  // ---------- Lecturas ----------
  const KEYS = ['generationPower', 'outputActivePower', 'mainsPower', 'batteryCapacity', 'batteryChargingCurrent', 'batteryDischargeCurrent', 'batteryVoltage', 'mainsCurrentFlowDirection'];
  const num = (v) => (v === null || v === undefined || v === '' || isNaN(+v) ? 0 : +v);

  function fromFields(f, i) {
    const pick = (k) => { const v = f[k]; return Array.isArray(v) ? v[i] : (v && typeof v === 'object' && 'value' in v ? v.value : v); };
    const batt = (num(pick('batteryChargingCurrent')) - num(pick('batteryDischargeCurrent'))) * num(pick('batteryVoltage')) / 1000; // kW, + = cargando
    const dir = pick('mainsCurrentFlowDirection');
    const mains = num(pick('mainsPower'));
    return { pv: num(pick('generationPower')), load: num(pick('outputActivePower')), grid: dir === '-' ? -mains : mains, batt, soc: num(pick('batteryCapacity')) };
  }

  // Integra kW → kWh (sin inventar energía en los cortes de señal: máximo 10 min por punto)
  function integrate(pts) {
    let gen = 0, load = 0, imp = 0, exp = 0, chg = 0, dis = 0;
    for (let i = 0; i < pts.length; i++) {
      const next = i + 1 < pts.length ? pts[i + 1].t : pts[i].t + 5 / 60;
      const dt = Math.min(Math.max(0, next - pts[i].t), 10 / 60);
      gen += pts[i].pv * dt; load += pts[i].load * dt;
      if (pts[i].grid > 0) imp += pts[i].grid * dt; else exp += -pts[i].grid * dt;
      if ((pts[i].batt || 0) > 0) chg += pts[i].batt * dt; else dis += -(pts[i].batt || 0) * dt;
    }
    return { gen, load, imp, exp, chg, dis, self: Math.max(0, load - imp) };
  }

  async function fetchDayPoints(date) {
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    const pts = [];
    for (let page = 1; page <= 5; page++) {
      const d = await post('/deviceState/simple/attribute/keys/history/v1', { deviceId: acc.device.id, count: 500, page, fromTime: isoLocal(from), toTime: isoLocal(to), orderByTimeAsc: true, keys: KEYS });
      const p = (d && d.payload) || {}; const ts = p.timeSeries || [], f = p.fields || {};
      ts.forEach((t, i) => { const at = new Date(t); pts.push({ t: at.getHours() + at.getMinutes() / 60 + at.getSeconds() / 3600, ...fromFields(f, i) }); });
      if (ts.length < 500) break;
    }
    return despike(pts);
  }

  // Quita lecturas sueltas imposibles (ej.: un punto de 5,8 kW entre dos de 0,1 kW)
  function despike(pts) {
    for (let i = 1; i < pts.length - 1; i++) {   // batería en 0 % por un instante = lectura fallida
      if (pts[i].soc < 5 && pts[i - 1].soc > 20 && pts[i + 1].soc > 20) pts[i].soc = (pts[i - 1].soc + pts[i + 1].soc) / 2;
    }
    for (const k of ['pv', 'load']) {
      for (let i = 1; i < pts.length - 1; i++) {
        const n = Math.max(pts[i - 1][k], pts[i + 1][k]);
        if (pts[i][k] > 1 && pts[i][k] > 4 * n) pts[i][k] = (pts[i - 1][k] + pts[i + 1][k]) / 2;
      }
    }
    return pts;
  }

  const installed = () => (acc && acc.device && acc.device.installedAt ? new Date(acc.device.installedAt) : new Date(2000, 0, 1));
  const beforeInstall = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) <= new Date(installed().getFullYear(), installed().getMonth(), installed().getDate());

  // Día: curvas + totales. cutHour: cortar a esa hora (para comparar con hoy a la misma altura)
  async function day(date, cutHour) {
    const today = sameDay(date, new Date());
    let pts;
    if (beforeInstall(date)) pts = [];
    else if (today) pts = await memo('dia-hoy', 60e3, () => fetchDayPoints(date));
    else {
      const k = ymd(date);
      if (!dayCache[k]) { dayCache[k] = await fetchDayPoints(date); saveCache(); }
      pts = despike(dayCache[k]);
    }
    if (cutHour != null) pts = pts.filter(p => p.t <= cutHour);
    const totals = integrate(pts);
    if (cutHour == null && pts.length) {          // total del día según el contador del propio inversor
      const g = today ? await liveGenToday().catch(() => null) : (await genByDay(date.getFullYear(), date.getMonth()).catch(() => ({})))[ymd(date)];
      if (g != null) totals.gen = g;
    }
    return { t: pts.map(p => p.t), pv: pts.map(p => p.pv), load: pts.map(p => p.load), soc: pts.map(p => p.soc), totals, partial: today };
  }

  // Generación por día del mes según el contador del propio inversor (más exacto)
  async function genByDay(y, m) {
    const k = `${y}-${pad(m + 1)}`;
    return memo('gen-mes-' + k, 5 * 60e3, async () => {
      const d = await post(`/stationOverView/stateAttributeSummary/category/monthly?stationId=${acc.device.stationId}&summaryCategoryKey=pvInverterElectricityQuantityClass`, { time: k });
      const prop = (d.properties || []).find(p => p.property && p.property.key === 'pvGeneratedEnergy');
      const out = {}; (prop ? prop.timePoints : []).forEach(tp => { if (tp.isRealValue) out[tp.time.slice(0, 10)] = num(tp.value); });
      return out;
    });
  }

  const sumTotals = (list) => list.reduce((a, b) => ({ gen: a.gen + b.gen, load: a.load + b.load, imp: a.imp + b.imp, exp: a.exp + b.exp, chg: a.chg + (b.chg || 0), dis: a.dis + (b.dis || 0), self: a.self + b.self }), { gen: 0, load: 0, imp: 0, exp: 0, chg: 0, dis: 0, self: 0 });

  async function month(y, m, upTo) {
    const now = new Date();
    const days = new Date(y, m + 1, 0).getDate();
    const gens = await genByDay(y, m).catch(() => ({}));
    const items = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i);
      if (d > now || (upTo && i > upTo.day)) { items.push(null); continue; }
      if (beforeInstall(d)) { items.push({ label: String(i), date: d, gen: 0, load: 0, imp: 0, exp: 0, chg: 0, dis: 0, self: 0 }); continue; }
      const cut = upTo && i === upTo.day ? upTo.hour : null;
      const t = (await day(d, cut)).totals;
      const g = gens[ymd(d)];
      if (g != null && cut == null && !sameDay(d, now)) t.gen = g;   // contador del inversor (día completo)
      items.push({ label: String(i), date: d, ...t });
    }
    return { items, totals: sumTotals(items.filter(Boolean)) };
  }

  async function year(y, upTo) {
    const now = new Date();
    const items = [];
    for (let m = 0; m < 12; m++) {
      if (new Date(y, m, 1) > now || (upTo && m > upTo.month) || new Date(y, m + 1, 0) < installed()) { items.push(new Date(y, m, 1) > now || (upTo && m > upTo.month) ? null : { label: '', month: m, gen: 0, load: 0, imp: 0, exp: 0, chg: 0, dis: 0, self: 0 }); continue; }
      const mm = await month(y, m, upTo && m === upTo.month ? upTo : null);
      items.push({ label: '', month: m, ...mm.totals });
    }
    return { items, totals: sumTotals(items.filter(Boolean)) };
  }

  const latest = () => memo('vivo', 20e3, () => get('/deviceState/simple/state/latest/v1?deviceId=' + acc.device.id));
  async function liveGenToday() {
    const s = await latest(); const f = (s && s.fields) || {};
    return f.pvGeneratedEnergyOfDay && f.pvGeneratedEnergyOfDay.value != null ? num(f.pvGeneratedEnergyOfDay.value) : null;
  }
  async function live() {
    const s = await latest();
    const f = (s && s.fields) || {};
    const at = s && s.time ? new Date(s.time) : new Date(0);
    const v = fromFields(f, 0);
    const today = (await day(new Date())).totals;
    return { at, ...v, today, online: Date.now() - at.getTime() < 15 * 60e3, raw: f };
  }

  // Lista de todos los datos que entrega el inversor (nombres, unidades y opciones). Cambia poco: se guarda 1 día.
  async function attributeGroups() {
    const K = 'miSolar.atributos';
    try { const c = JSON.parse(root.localStorage.getItem(K) || 'null'); if (c && c.dev === acc.device.id && Date.now() - c.at < 864e5) return c.groups; } catch (e) { /* nada */ }
    const d = await get('/device/query/attribute/group?deviceId=' + acc.device.id);
    const groups = (d.attributesGroups || []).map(g => ({
      key: g.key, name: (g.nameI18n && g.nameI18n.en) || g.key,
      attrs: (g.attributes || []).map(a => ({
        key: a.key, name: a.nameDisplay || a.name || a.key, unit: a.unit || '', read: /Read/.test(a.operationModeDict || ''), event: !!a.isEventAttribute,
        options: (a.enumValueDisplays || []).reduce((o, e) => { o[e.value] = e.localeText || e.text; return o; }, {}),
      })),
    }));
    try { root.localStorage.setItem(K, JSON.stringify({ dev: acc.device.id, at: Date.now(), groups })); } catch (e) { /* nada */ }
    return groups;
  }

  // Curvas del día para cualquier dato (ej.: pvPower, pv2Power, inverterTemperature)
  async function daySeries(date, keys) {
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return memo('serie-' + ymd(date) + keys.join(','), sameDay(date, new Date()) ? 60e3 : 36e5, async () => {
      const t = [], out = {}; keys.forEach(k => { out[k] = []; });
      for (let page = 1; page <= 5; page++) {
        const d = await post('/deviceState/simple/attribute/keys/history/v1', { deviceId: acc.device.id, count: 500, page, fromTime: isoLocal(from), toTime: isoLocal(to), orderByTimeAsc: true, keys });
        const p = (d && d.payload) || {}; const ts = p.timeSeries || [], f = p.fields || {};
        ts.forEach((x, i) => { const at = new Date(x); t.push(at.getHours() + at.getMinutes() / 60 + at.getSeconds() / 3600); keys.forEach(k => out[k].push(f[k] ? num(f[k][i]) : 0)); });
        if (ts.length < 500) break;
      }
      for (const k of keys) {   // quitar lecturas sueltas imposibles
        const a = out[k];
        for (let i = 1; i < a.length - 1; i++) { const n = Math.max(a[i - 1], a[i + 1]); if (a[i] > 1 && a[i] > 4 * n) a[i] = (a[i - 1] + a[i + 1]) / 2; }
      }
      return { t, values: out };
    });
  }

  // Alarmas registradas por Solar of Things
  async function alarms() {
    return memo('alarmas', 60e3, async () => { const d = await post('/alarm/query/list', { page: 1, count: 20 }); return (d && d.list) || []; });
  }

  root.SolarCloud = { attributeGroups, alarms, daySeries, latest: () => latest(), md5, connect, disconnect, connected, account: () => acc, live, day, month, year, sumTotals, clearCache, CloudError };
})(typeof window !== 'undefined' ? window : globalThis);
