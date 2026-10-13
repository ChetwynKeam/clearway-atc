// ═════════════════════════ saved stint ═════════════════════════
// The stint you are working is saved on this device as you play (every 10 s, and when the page is hidden or closed),
// one per airport, so the next visit can carry on where you left off: the website's home page and the airport's
// session setup offer "Continue last stint". Not for Live now (the real flights have moved on by the next visit) or
// the Academy's guided exercises. A saved stint is the whole session: every aircraft where it was and what it was
// doing, the schedule still to come, the vehicles, emergencies, slots, AI seats, score and the message log.
const STINT_V = 1, STINT_PRE = 'cw-stint-', STINT_KEY = STINT_PRE + APT.icao;
const stintSaveable = () => S.running && !isLiveMode(S.mode) && !EXERCISES[S.mode];
// session state that is not part of the stint: the page's own wiring and the controller's display preferences
const STINT_SKIP = new Set(['listeners', 'view', 'paused', 'running', 'preview', 'voice', 'voiceAt', 'fromVoice', 'aiHear', 'showProc', 'liveWait']);

// ── the saved graph: aircraft refer to each other, to stands, vehicles and holding points. Objects that belong to the
// airport (stands, aircraft types, waypoints, taxiway nodes, runways, jet bridges) are saved by name; an object used in
// more than one place is saved once and referred to ($r), so it is still one object when it comes back.
function stintGlobals(){
  const G = new Map(), reg = (tag, o) => { if (o && typeof o === 'object' && !G.has(o)) G.set(o, tag); };
  const each = (name, X) => { if (X) for (const k of Object.keys(X)) reg(name + ':' + k, X[k]); };
  STANDS.forEach(s => reg('ST:' + s.id, s)); HANGARS.forEach(h => reg('HG:' + h.id, h));
  each('TY', TYPES); each('VT', VTYPES); each('WP', WP); each('HO', HOLDS); each('IH', IHPS); each('FI', FINAL); each('GN', GN);
  each('GE', GE); each('RW', RWYS); each('EN', ENTRY); each('AP', AP); each('BR', VEH.bridges); each('VG', VG); each('WX', WX_PRESETS);
  reg('APT', APT); each('APT', APT);
  return G;
}
function stintEncode(root){
  const G = stintGlobals(), seen = new Map(), R = [], ids = new Map();
  const skip = o => !o || typeof o !== 'object' || G.has(o) || (typeof Node !== 'undefined' && o instanceof Node);
  const kids = o => o instanceof Map ? [...o.keys(), ...o.values()] : o instanceof Set ? [...o] : Object.keys(o).map(k => o[k]);
  const walk = o => { if (skip(o)) return; const n = seen.get(o) || 0; seen.set(o, n + 1); if (!n) for (const v of kids(o)) walk(v); };
  walk(root);
  const encA = v => { const e = enc(v); return e === undefined ? null : e; };
  const body = o => {
    if (o instanceof Set) return { $set: [...o].map(encA) };
    if (o instanceof Map) return { $map: [...o].map(([k, v]) => [encA(k), encA(v)]) };
    if (Array.isArray(o)) {
      const a = o.map(encA), x = Object.keys(o).filter(k => !/^\d+$/.test(k)); if (!x.length) return a;
      const p = {}; for (const k of x) { const e = enc(o[k]); if (e !== undefined) p[k] = e; } return { $a: a, p };   // a path point's flags (hs, tight, ext)
    }
    const out = o instanceof Aircraft ? { $c: 'ac' } : {};
    for (const k of Object.keys(o)) { const e = enc(o[k]); if (e !== undefined) out[k] = e; }
    return out;
  };
  function enc(o){
    if (o === undefined || typeof o === 'function' || typeof o === 'symbol') return undefined;
    if (typeof o === 'number') return Number.isFinite(o) ? o : { $n: String(o) };
    if (o === null || typeof o !== 'object') return o;
    if (G.has(o)) return { $g: G.get(o) };
    if (typeof Node !== 'undefined' && o instanceof Node) return undefined;
    if (seen.get(o) > 1) { if (ids.has(o)) return { $r: ids.get(o) }; const i = R.length; ids.set(o, i); R.push(null); R[i] = body(o); return { $r: i }; }
    return body(o);
  }
  return { root: enc(root), R };
}
function stintDecode(pk){
  const G = new Map([...stintGlobals()].map(([o, t]) => [t, o])), out = [], made = [];
  const shell = e => Array.isArray(e) || e.$a ? [] : e.$set ? new Set() : e.$map ? new Map() : e.$c === 'ac' ? Object.create(Aircraft.prototype) : {};
  const fill = (o, e) => {
    if (Array.isArray(e)) { for (const v of e) o.push(dec(v)); return o; }
    if (e.$a) { for (const v of e.$a) o.push(dec(v)); Object.assign(o, Object.fromEntries(Object.entries(e.p).map(([k, v]) => [k, dec(v)]))); return o; }
    if (e.$set) { for (const v of e.$set) o.add(dec(v)); return o; }
    if (e.$map) { for (const [k, v] of e.$map) o.set(dec(k), dec(v)); return o; }
    for (const k of Object.keys(e)) if (k !== '$c') o[k] = dec(e[k]);
    return o;
  };
  function dec(e){
    if (e === null || typeof e !== 'object') return e;
    if (!Array.isArray(e)) {
      if ('$n' in e) return Number(e.$n);
      if ('$g' in e) { if (!G.has(e.$g)) throw new Error('not in this version of the airport: ' + e.$g); return G.get(e.$g); }
      if ('$r' in e) { const i = e.$r; if (!made[i]) { made[i] = true; out[i] = shell(pk.R[i]); fill(out[i], pk.R[i]); } return out[i]; }
    }
    return fill(shell(e), e);
  }
  return dec(pk.root);
}

// ── saving
function stintState(){
  const s = {}; for (const k of Object.keys(S)) if (!STINT_SKIP.has(k)) s[k] = S[k];
  return {
    S: s, sqk, lastCallT, view: { cx: V.cx, cy: V.cy, scale: V.scale, name: V.name },
    stands: STANDS.filter(t => t.ownOcc).map(t => [t, t.ownOcc]), hangars: HANGARS.filter(h => h.occ).map(h => [h, h.occ]),
    veh: { list: VEH.list, n: VEH.n, tick: VEH.tick, nextRoam: VEH.nextRoam, nextFire: VEH.nextFire, cap: VEH.cap, ends: VEH.bridges.map(B => B.end) },
    far: { list: FAR.list, done: FAR.done }, slot: { ...SLOT }, car: carCur, custom: CUSTOM.src
  };
}
// a few words for the "Continue last stint" prompts
function stintMeta(){
  return { v: STINT_V, ap: APT.icao, name: APT.name, at: Date.now(), mode: S.mode, day: S.day, hour: S.hour, t: Math.round(S.t), start: S.start,
    n: S.acs.filter(a => !a.handed && a.state !== 'PRE').length, pts: S.score.pts, rwy: S.rwy, ai: AI_SEATS.filter(k => S.seats && S.seats[k] === 'AI') };
}
let stintLastT = null, stintFull = false;
function stintSave(){
  if (!stintSaveable() || S.t === stintLastT) return;
  let txt;
  try {
    const log = [...logEl.children].slice(-150).map(d => d.outerHTML.replace(/ class="ln ([^"]*?)\bgo\b/, ' class="ln $1')).join('');
    txt = JSON.stringify({ meta: stintMeta(), data: stintEncode(stintState()), log });
  } catch (e) { console.warn('Stint not saved:', e); return; }
  const put = () => { localStorage.setItem(STINT_KEY, txt); return true; };
  try { put(); stintLastT = S.t; stintFull = false; return; } catch (e) {}
  // the device's storage is full: make room by dropping the stints saved longest ago at other airports
  try { for (const m of stintList().filter(m => m.ap !== APT.icao).sort((a, b) => a.at - b.at)) { localStorage.removeItem(STINT_PRE + m.ap); try { put(); stintLastT = S.t; return; } catch (_) {} } } catch (e) {}
  if (!stintFull) { stintFull = true; sys('This stint is too big to save on this device, so it can’t be continued next time.', true); }
}
setInterval(stintSave, 10000);
addEventListener('pagehide', stintSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') stintSave(); });

// ── the saved stints on this device: every airport's (one each), newest first
function stintRead(ap){ try { const j = JSON.parse(localStorage.getItem(STINT_PRE + ap) || 'null'); return j && j.meta && j.meta.v === STINT_V ? j : null; } catch (e) { return null; } }
function stintList(){
  const L = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(STINT_PRE)) { const j = stintRead(k.slice(STINT_PRE.length)); if (j) L.push(j.meta); } } } catch (e) {}
  return L.sort((a, b) => b.at - a.at);
}
function stintDrop(ap){ try { localStorage.removeItem(STINT_PRE + ap); } catch (e) {} if (ap === APT.icao) stintLastT = null; stintRender(); }

// ── continuing: the position opens exactly as it was saved
function stintContinue(){
  const j = stintRead(APT.icao); if (!j) return false;
  if (S.running) { sys('A session is already open. Use New session first to continue your last stint.', true); return false; }
  if (!cwGate()) return false;   // continuing needs a plan that includes this airport, like opening a position (account.js)
  let D;
  try { D = stintDecode(j.data); }
  catch (e) { console.warn('Stint not restored:', e); stintDrop(APT.icao); sys('Your last stint could not be continued: the simulator has changed since it was saved. Open a new position below.', true); return false; }
  resetSession();
  vehInit();
  Object.assign(S, D.S); S.running = true; S.paused = false; S.liveWait = 0; S.preview = null;
  sqk = D.sqk; lastCallT = D.lastCallT ?? -99;
  for (const [t, ac] of D.stands) t.occ = ac;
  for (const [h, ac] of D.hangars) h.occ = ac;
  Object.assign(VEH, { list: D.veh.list, n: D.veh.n, tick: D.veh.tick, nextRoam: D.veh.nextRoam, nextFire: D.veh.nextFire, cap: D.veh.cap });
  VEH.bridges.forEach((B, i) => { if (D.veh.ends[i]) B.end = D.veh.ends[i]; });
  FAR.list = D.far.list; FAR.done = D.far.done;
  for (const k of Object.keys(SLOT)) delete SLOT[k]; Object.assign(SLOT, D.slot);
  CUSTOM.src = D.custom || CUSTOM.src;
  // the career entry carries on (the copy already in the career list, so it isn't counted twice)
  carCur = D.car ? CAR.sessions.find(x => x.at === D.car.at && x.ap === D.car.ap) || D.car : null;
  logEl.innerHTML = j.log || ''; logEl.scrollTop = logEl.scrollHeight;
  // the setup panel shows what is running (its pickers are locked while a session is open)
  const ts = $('trafficSel'); if ([...ts.options].some(o => o.value === S.mode)) ts.value = S.mode;
  if (S.day != null) daySel.value = S.day; renderSlots(); if (S.hour != null) hourSel.value = Math.floor(S.hour);
  $('tgSpeed').textContent = S.speed + '×'; $('tgPause').textContent = 'Pause';
  $('setup').hidden = true;
  if (typeof go === 'function') go('sim');
  V.cx = D.view.cx; V.cy = D.view.cy; V.scale = D.view.scale; V.name = D.view.name;
  if (typeof renderSeats === 'function') renderSeats();
  if (typeof slotRender === 'function') slotRender();
  stintLastT = S.t;
  const m = j.meta; sys(`Stint continued from ${stintAgo(m.at)}: ${zt(S.t)}Z, ${m.n} aircraft on your frequencies, ${S.score.pts} points so far.`);
  renderAtis(); renderSel(); renderStrips(true); renderScore();
  return true;
}

// ── the prompts
const stintAgo = at => { const m = Math.round((Date.now() - at)/60e3); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 48*60 ? `${Math.round(m/60)} h ago` : `${Math.round(m/1440)} days ago`; };
function stintLine(m){
  const mode = (typeof MODE_NAME !== 'undefined' && MODE_NAME[m.mode]) || m.mode, clock = new Date(m.start + m.t*1000).toISOString().substr(11, 5);
  const day = m.day != null && DAYS[m.day] ? DAYS[m.day] + ' ' : '';
  return `${esc(mode)} · ${esc(day)}${clock}Z · ${Math.round(m.t/60)} min in · ${m.n} aircraft · ${m.pts} pts · saved ${stintAgo(m.at)}`;
}
function stintRender(){
  // the session setup: this airport's stint, while no session is open
  const box = $('stintBox'), mine = stintRead(APT.icao);
  if (box) {
    box.hidden = !mine || S.running;
    if (mine && !S.running) {
      box.innerHTML = `<div class="stint-txt"><span class="lbl">Continue last stint?</span><b>${esc(mine.meta.name)} · runway ${esc(mine.meta.rwy)}</b><span class="stint-d">${stintLine(mine.meta)}</span></div>
        <div class="stint-bt"><button type="button" class="btn primary sm" data-stint="go">Continue stint</button><button type="button" class="btn sm" data-stint="drop">Start fresh</button></div>`;
      box.querySelector('[data-stint=go]').onclick = stintContinue;
      box.querySelector('[data-stint=drop]').onclick = () => stintDrop(APT.icao);
    }
  }
  // the website's home page: every airport's, newest first
  const home = $('stintHome'); if (!home) return;
  const L = stintList().filter(m => SITE[m.ap]);
  home.hidden = !L.length;
  home.innerHTML = L.length ? `<div class="wrap"><div class="stint-home">${L.map(m => `<div class="stint-row"><div class="stint-txt"><span class="lbl">Continue last stint?</span><b>${esc(m.name)} · ${esc(m.ap)}</b><span class="stint-d">${stintLine(m)}</span></div>
    <div class="stint-bt"><a class="btn primary sm" href="${SITE[m.ap]}#resume">Continue stint</a><button type="button" class="btn sm" data-drop="${esc(m.ap)}">Start fresh</button></div></div>`).join('')}</div></div>` : '';
  home.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => stintDrop(b.dataset.drop));
}
stintRender();
S.listeners.push(ev => { if (ev === 'start') stintRender(); });
window.__stint = { save: stintSave, read: stintRead, cont: stintContinue, encode: stintEncode, decode: stintDecode, state: stintState };
