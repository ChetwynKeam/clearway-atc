// ═════════════════════════ night and low visibility operations ═════════════════════════
// Night: the sun is worked out for the airport and the session's date and time. After sunset the runway and taxiway
// lights come on, and the stop bars at the runway holding points are lit.
//
// Low visibility: three RVR readings (touchdown, mid-point, stop end) are given while the visibility is under 1,500 m.
// Low visibility procedures (LVP) are declared by the Tower (LVP, LVP OFF, or the button on the ATIS panel; an AI Tower
// does it on its own). Under LVP the stop bars are lit day and night, the ILS sensitive areas are protected (wider
// gaps), and crews may fly CAT II and III approaches and take off in low visibility. Without LVP declared, no crew
// will fly an approach below CAT I minima (RVR 550 m, 200 ft) or take off in less than 400 m.
//
// Each aircraft has its own low-visibility capability: most airliners CAT IIIB (RVR 75 m), regional jets CAT IIIA
// (200 m), turboprops and business jets CAT II (300 m), light aircraft CAT I (550 m). An arrival that cannot make
// the approach says so and holds, then diverts; one already on the approach goes around at its decision height.

// ── the sun
function sunElev(ms, lat, lon){
  const d = ms/864e5 - 10957.5, g = (357.529 + 0.98560028*d)*D2R, q = 280.459 + 0.98564736*d;
  const L = (q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*D2R, e = (23.439 - 0.00000036*d)*D2R;
  const ra = Math.atan2(Math.cos(e)*Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e)*Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908*d) % 24 + 24) % 24, ha = (gmst*15 + lon)*D2R - ra;
  return Math.asin(Math.sin(lat*D2R)*Math.sin(dec) + Math.cos(lat*D2R)*Math.cos(dec)*Math.cos(ha))/D2R;
}
const aptLL = () => typeof LAT0 !== 'undefined' ? [LAT0, LON0] : [51.5, 0];
const nowMs = () => (S.start || Date.now()) + S.t*1000;
const sunNow = () => { const [la, lo] = aptLL(); return sunElev(nowMs(), la, lo); };
// lights on from sunset (the sun's centre 0.833° below the horizon) to sunrise
const isNight = () => sunNow() < -0.833;
// sunrise and sunset for the session's UTC day, as "06:58" (null when the sun does not rise or set)
let SUNDAY = null;
function sunTimes(){
  const day = Math.floor(nowMs()/864e5)*864e5;
  if (SUNDAY && SUNDAY.day === day) return SUNDAY;
  const [la, lo] = aptLL(); let rise = null, set = null, prev = sunElev(day, la, lo) >= -0.833;
  for (let m = 2; m <= 1440; m += 2) { const up = sunElev(day + m*60e3, la, lo) >= -0.833; if (up && !prev && rise == null) rise = m; if (!up && prev && set == null) set = m; prev = up; }
  const hm = m => m == null ? null : `${String(Math.floor(m/60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return SUNDAY = { day, rise: hm(rise), set: hm(set) };
}

// ── RVR: three readings along the runway, a little different from each other and from the reported visibility,
// moving every minute or so
const RVR_STEP = v => v < 400 ? 25 : v < 800 ? 50 : 100;
const rvrRound = v => { const s = RVR_STEP(v); return clamp(Math.round(v/s)*s, 50, 2000); };
function rvrUpdate(force){
  const w = S.wx;
  if (w.vis >= 1500) { S.rvr = null; return; }
  if (!force && S.rvr && S.t - S.rvr.t < 60 && S.rvr.vis === w.vis) return;
  const base = w.vis*1.1, f = () => rvrRound(base*rnd(0.82, 1.25));
  S.rvr = { tdz: f(), mid: f(), end: f(), t: S.t, vis: w.vis };
}
const rvrTdz = () => S.rvr ? S.rvr.tdz : S.wx.vis;

// ── LVP
const lvpNeeded = () => rvrTdz() < 600 || S.wx.ceil < 200;
const lvpPrep = () => rvrTdz() < 1500 || S.wx.ceil < 300;
const lvpCanCancel = () => rvrTdz() >= 800 && S.wx.ceil >= 250;
function lvpSet(on, byMe){
  on = !!on; if (!!S.lvpOn === on) return;
  S.lvpOn = on; S.lvpT = S.t;
  const who = byMe ? '' : 'Tower (AI): ';
  sys(on ? `${who}Low visibility procedures in force. Stop bars lit, ILS sensitive areas protected: wider gaps between arrivals and departures. CAT II and III approaches and low visibility take-offs are now possible.`
         : `${who}Low visibility procedures cancelled.`);
  if (typeof nextAtis === 'function') nextAtis(true);
  if (typeof renderAtis === 'function') renderAtis();
  emit('lvp', on);
}
// typed: LVP, LVP ON, LVP OFF
function lvpCommand(toks){
  if (toks[0] !== 'LVP' || toks.length > 2) return false;
  const off = toks[1] === 'OFF' || toks[1] === 'CNL' || toks[1] === 'CANCEL';
  if (!off && toks[1] && toks[1] !== 'ON') return false;
  if (off && !S.lvpOn) { sys('Low visibility procedures are not in force.'); return true; }
  if (!off && S.lvpOn) { sys('Low visibility procedures are already in force.'); return true; }
  if (!off && !lvpPrep()) { sys(`No need for low visibility procedures: RVR ${rvrTdz() >= 1500 ? 'not reported' : rvrTdz() + ' m'}, cloud base ${S.wx.ceil >= 5000 ? 'high' : S.wx.ceil + ' ft'}. They are for an RVR under 600 m or a cloud base under 200 ft.`); return true; }
  lvpSet(!off, true); return true;
}
// what each aircraft can do in low visibility: its lowest RVR (m) and decision height (ft)
const LVO = { IIIB: { rvr: 75, dh: 0, n: 'CAT IIIB' }, IIIA: { rvr: 200, dh: 50, n: 'CAT IIIA' }, II: { rvr: 300, dh: 100, n: 'CAT II' }, I: { rvr: 550, dh: 200, n: 'CAT I' } };
function lvoCat(ac){
  const t = String(ac.t || '').toUpperCase();
  if (/^(C1\d\d|C2\d\d|PA\d\d|P28|SR2\d|DA4\d|BE\d\d|C208|PC12|BN2|B190|JS3\d|JS41|SF34|D228|DHC6)/.test(t)) return 'I';
  if (/^(AT\d\d|DH8|D328|E120|F50|SB20|C25|C5\d|C56X|C68A|C700|E55P|E50P|PC24|LJ\d\d|H25|CL30|CL35|CL60|FA\d|F2TH|G280|GLF|GL5T|GL7T|GLEX)/.test(t)) return 'II';
  if (/^(CRJ|E1\d\d|E2\d\d|E17|E19|E75|E29|E35|E45|BCS|RJ\d|B46)/.test(t)) return 'IIIA';
  return 'IIIB';
}
// why this arrival cannot fly the approach in this visibility, or null
function lvoLimit(ac, F, rw){
  if (!ac || (F && F.rnp)) return null;
  const r = rvrTdz(), c = S.wx.ceil, cat = LVO[lvoCat(ac)];
  if (r >= 550 && c >= 200) return null;   // CAT I or better: an ordinary approach
  if (!S.lvpOn) return 'low visibility procedures are not in force';
  if (r < cat.rvr || c < cat.dh) return `RVR ${r} metres, below our ${cat.n} minimum of ${cat.rvr}`;
  return null;
}
// a departure in low visibility
function lvtoLimit(ac){
  const r = rvrTdz();
  if (r >= 400) return null;
  if (!S.lvpOn) return 'low visibility procedures are not in force for a take-off below 400 metres';
  const min = lvoCat(ac) === 'I' ? 400 : lvoCat(ac) === 'II' ? 200 : 125;
  return r < min ? `RVR ${r} metres, below our take-off minimum of ${min}` : null;
}

// ── each step: RVR, the Tower's own LVP (an AI Tower, or none of yours), and the prompts
let lvpWarn = 0, lvpAiAt = 0, lastNight = null;
function nightStep(){
  if (!S.running) return;
  const before = S.rvr && S.rvr.tdz; rvrUpdate();
  if (S.rvr && before !== S.rvr.tdz && typeof renderAtis === 'function' && Math.floor(S.t) % 60 < 2) renderAtis();
  const aiTwr = S.seats && S.seats.TWR === 'AI';
  const need = lvpNeeded(), prep = lvpPrep();
  if (aiTwr) {
    // the AI Tower declares a couple of minutes after the RVR drops (it prepares first), and cancels once it is back up
    if (need && !S.lvpOn) { if (!lvpAiAt) lvpAiAt = S.t + rnd(60, 150); else if (S.t >= lvpAiAt) { lvpAiAt = 0; lvpSet(true); } }
    else if (S.lvpOn && lvpCanCancel()) { if (!lvpAiAt) lvpAiAt = S.t + rnd(120, 300); else if (S.t >= lvpAiAt) { lvpAiAt = 0; lvpSet(false); } }
    else lvpAiAt = 0;
  } else if (S.t - lvpWarn > (lvpWarn ? 600 : 0)) {
    if (need && !S.lvpOn) { lvpWarn = S.t; sys(`RVR ${rvrTdz()} m${S.wx.ceil < 200 ? `, cloud base ${S.wx.ceil} ft` : ''}: low visibility procedures are needed. Declare them (LVP, or the button on the ATIS panel) or crews will not fly approaches below CAT I.`, true); }
    else if (S.lvpOn && lvpCanCancel()) { lvpWarn = S.t; sys(`RVR ${rvrTdz() >= 1500 ? 'over 1,500' : rvrTdz()} m: low visibility procedures can be cancelled (LVP OFF), which lets the gaps close up again.`); }
    else if (prep && !need && !S.lvpOn && !S.lvpPrepSaid) { S.lvpPrepSaid = true; sys(`RVR ${rvrTdz()} m and falling: get ready for low visibility procedures (they are needed below 600 m or a cloud base under 200 ft).`); }
  }
  if (!prep) S.lvpPrepSaid = false;
  // sunset and sunrise
  const n = isNight();
  if (lastNight !== null && n !== lastNight) sys(n ? 'Sunset: runway and taxiway lights on, stop bars in use.' : 'Sunrise: the lights go off (stop bars stay lit under low visibility procedures).');
  lastNight = n;
}
S.listeners.push(ev => { if (ev === 'start') { S.lvpOn = false; S.lvpPrepSaid = false; lvpWarn = 0; lvpAiAt = 0; lastNight = null; SUNDAY = null; rvrUpdate(true);
  if (lvpNeeded() && S.seats && S.seats.TWR === 'AI') S.lvpOn = true;   // the session opens in fog that has been there all night
  else if (lvpNeeded()) S.lvpOn = true, setTimeout(() => sys('Low visibility procedures are in force from the last shift (LVP OFF cancels them when the RVR is back over 800 m).'), 0);
} });

// ── the ATIS panel and the sysbar
function lvpPanel(){
  const L = [], st = sunTimes();
  if (S.rvr) L.push(`<div class="warnline${S.rvr.tdz < 550 ? ' bad' : ''}">RVR ${S.rwy}: touchdown ${S.rvr.tdz}, mid-point ${S.rvr.mid}, stop end ${S.rvr.end} m</div>`);
  if (S.lvpOn) L.push(`<div class="warnline lvp-on">Low visibility procedures in force <button class="rops-btn" data-lvp="off"${lvpCanCancel() ? '' : ' title="The RVR is still under 800 m"'}>Cancel LVP</button></div>`);
  else if (lvpPrep()) L.push(`<div class="warnline${lvpNeeded() ? ' bad' : ''}">${lvpNeeded() ? 'LVP needed: not declared' : 'LVP preparation: visibility falling'} <button class="rops-btn" data-lvp="on">Declare LVP</button></div>`);
  if (isNight()) L.push(`<div class="warnline dimmer">Night${st.rise ? ` · sunrise ${st.rise}Z` : ''}: lights on, stop bars in use</div>`);
  return L.join('');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-lvp]'); if (!b) return; if (b.dataset.lvp === 'on') lvpSet(true, true); else lvpSet(false, true); });

// ── lights on the ground picture: stop bars at the runway holding points (red, or dropped with green lead-on lights
// for an aircraft cleared through), and "follow the greens" along each taxiing aircraft's cleared route ahead of it
const lightsOn = () => isNight() || S.lvpOn;
let HSN = null;
function hsNodes(){
  if (HSN && HSN.n === Object.keys(GN).length) return HSN.list;
  const list = [];
  for (const n of Object.values(GN)) if (n.p && n.p.hs) { try { const R = rwyById(n.p.hs); list.push({ n, R, rid: n.p.hs }); } catch (e) {} }
  HSN = { n: Object.keys(GN).length, list }; return list;
}
// cleared through this holding point: an aircraft close to it with a clearance onto or across that runway
function barDropped(h){
  for (const ac of S.acs) {
    if (!ac.ground || dist(ac.x, ac.y, ...h.n.p) > 0.12) continue;
    if (ac.xing === h.rid || (ac.xok || []).includes(h.rid)) return true;
    if (ac.kind === 'DEP' && (ac.luq || ac.cto) && rwyOf(depRw(ac)).id === h.rid) return true;
  }
  return false;
}
function drawLvpLights(){
  if (!S.running || V.scale < 70 || !lightsOn() || typeof GN === 'undefined') return;
  const k = V.scale/1852, r = Math.max(1.2, 0.8*k);
  cx.save(); cx.globalCompositeOperation = C.glow || 'source-over';
  const dot = (p, col, rr = r) => { cx.fillStyle = col; cx.beginPath(); cx.arc(sx(p[0]), sy(p[1]), rr, 0, 7); cx.fill(); };
  // stop bars: across the taxiway, parallel to the runway, at every holding point of a runway in use
  for (const h of hsNodes()) {
    if (!activeRwy(h.rid)) continue;
    const drop = barDropped(h), u = h.R.RU || [1, 0];
    for (let o = -15; o <= 15; o += 3) dot([h.n.p[0] + u[0]*o/1852, h.n.p[1] + u[1]*o/1852], drop ? 'rgba(255,60,60,.12)' : 'rgba(255,45,45,.95)', r*1.15);
    if (drop) { const m = h.R.mOf(h.n.p), off = h.R.offOf(h.n.p), s = Math.sign(off) || 1; for (let d = 10; d < Math.abs(off); d += 15) dot(h.R.rm(m, off - s*d), 'rgba(80,255,130,.9)'); }
  }
  // follow the greens: each taxiing aircraft's route lit for 400 m ahead, up to a stop bar it has no clearance through
  for (const ac of S.acs) {
    if (!ac.ground || !ac.path || !ac.path.pts || !ac.path.pts.length || ac.onRwy) continue;
    let prev = [ac.x, ac.y], left = 400/1852;
    for (const p of ac.path.pts) {
      const L = dist(...prev, ...p), n = Math.max(1, Math.floor(L/(15/1852)));
      for (let i = 1; i <= n && left > 0; i++) { const f = i/n; dot([prev[0] + (p[0] - prev[0])*f, prev[1] + (p[1] - prev[1])*f], 'rgba(80,255,130,.8)'); left -= L/n; }
      if (left <= 0 || (p.hs && p.hs !== ac.xing && !(ac.xok || []).includes(p.hs) && activeRwy(p.hs))) break;
      prev = p;
    }
  }
  cx.restore();
}
