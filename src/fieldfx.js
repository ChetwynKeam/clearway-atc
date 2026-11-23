// ═════════════════════════ field effects: the airfield view and ground realism (Bristol first) ═════════════════════════
// Built into an airport's page only when its build entry lists it (build.py: fx). Everything here hooks the engine through
// the typeof-guarded calls in sim.js and ui.js (fxStep, fxTaxiSpd, fxBrake, fxToShort, fxReject, fxFrame, fxDrawField,
// fxLabelPos, fxAcCol, fxSelLine, fxStrip), so an airport without it is untouched.
//   1. Airfield map: our own airside-only chart (grass inside the field, pavement, buildings, stand size tags) in place of
//      the street map, which stays one tap away (the Airfield button).
//   2. Labels: ground tags without boxes, placed round each aircraft where they overlap least, with a leader line.
//   3. Runway surface condition from the weather (UK RCR/GRF): wet or contaminated braking on the roll-out and exits,
//      longer take-off distances, the condition on the ATIS.
//   4. Take-off distance: each departure needs a distance for its type, weight (stage length) and the day; an entry
//      that is too short is refused and the crew asks for the full length.
//   5. Jet blast: take-off thrust and breakaway thrust leaving a stand blow a cone behind; crews stop short of it, and a
//      light aircraft caught in it is an incident.
//   6. Typical weather: a real METAR for this month drawn from six years of reports (eggd-wx.js).
//   7. Command suggestions: the instructions that make sense next for the flight in the box, one tap to add.
//   8. Engine sound: every aircraft near the middle of the screen heard where it is, louder at take-off thrust, with
//      a Doppler shift as it passes (Web Audio, no sound files).
//   9. Rejected take-off (STOP or RTO on the take-off roll) and cancelling a landing clearance (CXL on approach).

const FX = { map: 'field', snd: true, lab: new Map(), placed: [], icons: [], blast: [], rc: null, tod: new Map() };
try { const m = localStorage.getItem('cw-fx-map'); if (m === 'street') FX.map = 'street'; FX.snd = localStorage.getItem('cw-fx-snd') !== '0'; } catch (_) {}
const fxField = () => FX.map === 'field' && cv && cv.id === 'scope';

// ── 1. the airfield map ───────────────────────────────────
// the street map only when chosen (the website's previews and thumbnails keep it)
{ const street = mapImagery; mapImagery = function(){ return (cv && cv.id !== 'scope' || FX.map === 'street') && street(); }; }
// the airside: everything the airport has drawn, wrapped in a hull 90 m out, rounded, so the field reads as one piece of
// mown grass on the dark ground outside the fence
let FX_HULL = null;
function fxHull(){
  if (FX_HULL) return FX_HULL;
  const pts = [];
  for (const R of RWYS) for (const m of [-60, (R.len || RWY_M) + 60]) for (const o of [-110, 110]) pts.push((R.rm || rm)(m, o));
  for (const n of Object.values(GN)) if (n && n.p) pts.push(n.p);
  for (const a of AD.aprons || []) for (const [m, o] of a) pts.push(rm(m, o));
  for (const b of AD.buildings || []) for (const [m, o] of b.pts) pts.push(rm(m, o));
  // convex hull (monotone chain), then pushed out 90 m along each corner's bisector
  const P = pts.map(p => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = [], hi = [];
  for (const p of P) { while (lo.length > 1 && cr(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (hi.length > 1 && cr(hi[hi.length-2], hi[hi.length-1], p) <= 0) hi.pop(); hi.push(p); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1)), c = h.reduce((s, p) => [s[0] + p[0]/h.length, s[1] + p[1]/h.length], [0, 0]), out = 90*M2NM;
  const ring = [];
  for (let i = 0; i < h.length; i++) {
    const a = h[(i + h.length - 1) % h.length], p = h[i], b = h[(i + 1) % h.length];
    const n1 = [p[1] - a[1], a[0] - p[0]], n2 = [b[1] - p[1], p[0] - b[0]], L1 = Math.hypot(...n1) || 1, L2 = Math.hypot(...n2) || 1;
    const s = (p[0]-c[0])*n1[0] + (p[1]-c[1])*n1[1] >= 0 ? 1 : -1;
    for (let k = 0; k <= 4; k++) {   // a rounded corner from one edge's normal to the next
      const f = k/4, nx = (n1[0]/L1)*(1-f) + (n2[0]/L2)*f, ny = (n1[1]/L1)*(1-f) + (n2[1]/L2)*f, L = Math.hypot(nx, ny) || 1;
      ring.push([p[0] + s*nx/L*out, p[1] + s*ny/L*out]);
    }
  }
  return FX_HULL = ring;
}
{ const base = drawGroundBase; drawGroundBase = function(){ base(); if (!fxField() || APT.drawnTown) return;
  const ring = fxHull(), dark = C.name === 'dark';
  cx.save();
  cx.beginPath(); ring.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](sx(p[0]), sy(p[1]))); cx.closePath();
  cx.fillStyle = (typeof texPattern === 'function' && texPattern('grass', 60, RWY_ANGLE())) || (dark ? '#132019' : '#cfdcb9'); cx.fill();
  cx.strokeStyle = dark ? 'rgba(160,190,175,.28)' : 'rgba(70,90,70,.35)'; cx.lineWidth = 1; cx.setLineDash([5, 4]); cx.stroke(); cx.setLineDash([]);   // the perimeter fence
  cx.restore();
}; }
// the airfield's own colours on the night map: dark ground, pavement a step lighter, amber departures, sky-blue arrivals
const FX_DARK = { ground: '#0a100f', concrete: '#2d3639', asphalt: '#262d30', rwy: '#1c2225', gShoulder: '#1f2628', bld: '#1b252a', gRoof: '#26333a', gRoof2: '#1f2a30', gRoofEdge: '#5a6d76',
  acDep: '#f5b83d', acArr: '#62c7ff' };
function fxFrame(){
  FX.placed.length = 0; FX.icons.length = 0;
  const on = fxField() && C.name === 'dark', base = PAL[C.name === 'dark' ? 'dark' : 'light'];
  for (const k in FX_DARK) C[k] = on ? FX_DARK[k] : base[k];
  // every ground aircraft's footprint on the screen, so tags are kept off the aircraft themselves
  if (V.scale > 150) for (const ac of S.acs) { if (!ac.ground) continue; const M = acMid(ac), r = Math.max(6, (ac.perf.span || 30)/2*V.scale/1852); FX.icons.push([sx(M[0]) - r, sy(M[1]) - r, 2*r, 2*r]); }
}
// a departure's colour: dim once it is parked with nothing due, so the moving traffic stands out
function fxAcCol(ac){ if (!fxField() || C.name !== 'dark') return null;
  if ((ac.state === 'PARKED' || ac.state === 'ONSTAND') && !ac.need && S.sel !== ac) return '#7d8a90';
  return null; }
// ICAO aerodrome reference code letter from the widest wingspan a stand takes
const fxCode = span => span <= 15 ? 'A' : span <= 24 ? 'B' : span <= 36 ? 'C' : span <= 52 ? 'D' : span <= 65 ? 'E' : 'F';
function fxDrawField(){
  const sc = V.scale; if (!fxField() || sc > 5200) return;
  if (sc < 1250) { fxDrawBlast(sc/1852); return; }
  const tags = [];
  const mpx = sc/1852, dark = C.name === 'dark';
  cx.save(); cx.font = `600 9px ${FONT_D}`; cx.textAlign = 'center';
  for (const s of STANDS) {
    if (!s.p || s.hdg == null || s.area === 'hangar') continue;
    const sz = standSize(s), f = sz.f || 0.62, head = (sz.l*f + 7)*M2NM, h = s.hdg*D2R;
    const X = sx(s.p[0] + Math.sin(h)*head), Y = sy(s.p[1] + Math.cos(h)*head);
    if (X < -40 || Y < -20 || X > W + 40 || Y > H + 20) continue;
    const code = fxCode(s.maxSpan || 36), t = `${s.id} · ${code}`, w = cx.measureText(t).width + 6, box = [X - w/2, Y - 7, w, 13];
    if (tags.some(q => fxOver(q, box) > 0)) continue; tags.push(box);   // stands close together: the first tag only
    cx.lineWidth = 3; cx.lineJoin = 'round'; cx.strokeStyle = dark ? 'rgba(8,13,13,.9)' : 'rgba(255,255,255,.9)'; cx.strokeText(t, X, Y + 3);
    cx.fillStyle = dark ? (s.occ ? 'rgba(160,185,180,.38)' : 'rgba(190,212,206,.78)') : (s.occ ? 'rgba(30,45,65,.4)' : 'rgba(30,45,65,.8)'); cx.fillText(t, X, Y + 3);
    FX.placed.push([X - w/2, Y - 7, w, 13, 0.4]);   // tags avoid these too, though less than each other
  }
  cx.restore();
  fxDrawBlast(mpx);
}

// ── 2. labels: least overlap, stable, with a leader line ──
const FX_SLOTS = [[1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];   // NE first (the usual place), then round
const fxOver = (a, b) => { const x = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0])), y = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1])); return x*y; };
function fxLabelPos(ac, X, Y, w, h){
  if (!fxField() || V.scale < 150) return null;
  const sz = Math.max(10, (ac.perf.span || 30)*V.scale/1852), r = sz/2 + 8, prev = FX.lab.get(ac.cs);
  let best = null;
  FX_SLOTS.forEach(([dx, dy], i) => {
    const bx = dx > 0 ? X + r : dx < 0 ? X - r - w : X - w/2, by = dy > 0 ? Y + r : dy < 0 ? Y - r - h : Y - h/2, box = [bx, by, w, h];
    let cost = i*6 + (i === prev ? -60 : 0);   // keep where it was unless something has come in the way
    for (const p of FX.placed) cost += fxOver(box, p)*(p[4] || 1);
    for (const q of FX.icons) if (Math.abs(q[0] + q[2]/2 - X) > 1 || Math.abs(q[1] + q[3]/2 - Y) > 1) cost += fxOver(box, q)*0.8;
    if (bx < 0 || by < 40 || bx + w > W || by + h > H - 30) cost += 4000;
    if (!best || cost < best.cost) best = { cost, i, box };
  });
  FX.lab.set(ac.cs, best.i); FX.placed.push([...best.box, 1]);
  const [bx, by] = best.box, tx = clamp(X, bx, bx + w), ty = clamp(Y, by, by + h), d = Math.hypot(tx - X, ty - Y) || 1;
  return { x: bx + 3, y: by + 11, bare: !!ac.ground, lead: [X + (tx - X)/d*(sz/2 + 2), Y + (ty - Y)/d*(sz/2 + 2), tx, ty] };
}

// ── 3. runway surface condition ───────────────────────────
// from the present weather: rain or drizzle wets it (RWYCC 5), heavy rain leaves standing water (2), snow or freezing
// precipitation contaminates it (3). brake: share of dry braking on the roll-out; tod: take-off distance factor.
function fxRwyCond(){
  const w = S.wx || {}, wx = (w.wx || []).join(' '), raw = (w.raw || '').split(' RMK ')[0];
  let r;
  if (/(SN|SG|PL|FZRA|FZDZ)/.test(wx)) r = { code: 3, word: 'WET SNOW', say: 'wet snow', brake: 0.55, tod: 1.25 };
  else if (/\+(SH|TS)?RA|\+TSRA/.test(wx)) r = { code: 2, word: 'STANDING WATER', say: 'standing water', brake: 0.5, tod: 1.3 };
  else if (/(RA|DZ|SH|TS)/.test(wx)) r = { code: 5, word: 'WET', say: 'wet', brake: 0.8, tod: 1.12 };
  else r = { code: 6, word: 'DRY', say: 'dry', brake: 1, tod: 1 };
  r.key = raw + r.code;
  if (FX.rc && FX.rc.code !== r.code && S.running) sys(`Runway surface condition now ${r.word.toLowerCase()} (RWYCC ${r.code}/${r.code}/${r.code})${r.code < 6 ? ': longer landing rolls, later exits and longer take-off distances' : ''}.`, r.code < 5);
  return FX.rc = r;
}
function fxBrake(){ return (FX.rc || fxRwyCond()).brake; }
// on the ATIS (UK runway condition report: the code for each third, then the description)
{ const lines = APT.atisLines, panel = APT.atisPanel;
  if (lines) APT.atisLines = a => { const out = lines(a), r = fxRwyCond();
    if (r.code < 6) out.splice(3, 0, `Runway condition report runway ${S.rwy}, time ${zt(S.t).slice(0,5).replace(':', '')}: runway condition code ${r.code}, ${r.code}, ${r.code}, ${r.say}, ${r.say}, ${r.say}.${r.code <= 3 ? ' Braking action may be reduced.' : ''}`);
    return out; };
  APT.atisPanel = w => { const r = fxRwyCond();
    return (panel ? panel(w) : '') + `<div class="warnline${r.code <= 3 ? ' bad' : ''}">Runway surface: <b>${r.word}</b> · RWYCC ${r.code}/${r.code}/${r.code}${r.code < 6 ? ` · roll-outs about ${Math.round((1/r.brake - 1)*100)}% longer, take-off distances +${Math.round((r.tod - 1)*100)}%` : ''}</div>`; }; }

// ── 4. take-off distance required ─────────────────────────
// Take-off field length at maximum weight, ISA, sea level, dry (manufacturers' airport planning documents, rounded).
// A flight's weight comes from how far it is going: about 78% of maximum for a short hop, up to about 95% for the
// Canaries; the distance goes with the square of the weight. Then 10% per 1,000 ft of elevation, 1% per °C above ISA,
// the runway condition, and the wind: half the headwind, one and a half times the tailwind, 1% per knot each way.
const FX_TODR = { A319: 1850, A320: 2100, A20N: 1950, A21N: 2250, B738: 2300, B38M: 2450, E190: 2050, E145: 1970, AT76: 1370,
  C56X: 1080, GLF6: 1920, PC12: 790, A332: 2500, A400: 980, DH8D: 1420, CRJ9: 1940 };
function fxStageNM(ac){
  const a = AP[APT.icao] || AP.EGGD, b = AP[ac.d]; if (!a || !b) return 600;
  const p1 = a[0]*D2R, p2 = b[0]*D2R, dl = (b[1] - a[1])*D2R;
  return Math.acos(clamp(Math.sin(p1)*Math.sin(p2) + Math.cos(p1)*Math.cos(p2)*Math.cos(dl), -1, 1))*3440;
}
function fxTodr(ac){
  const base = FX_TODR[ac.t] || 2000, nm = fxStageNM(ac), wt = 0.78 + 0.17*Math.min(1, nm/1600) + ((hash(ac.cs) % 5) - 2)*0.008;
  const elev = APT.elev || (typeof ELEV !== 'undefined' ? +ELEV || 0 : 0), w = S.wx || { temp: 15 }, isa = 15 - 2*elev/1000;
  const hw = windComp(w, crsOf(depRw(ac))).head, wind = hw >= 0 ? 1 - 0.005*hw : 1 + 0.015*-hw;
  const r = (FX.rc || fxRwyCond()).tod;
  return Math.round(base*wt*wt*(1 + 0.1*elev/1000)*(1 + 0.01*Math.max(0, w.temp - isa))*r*wind/10)*10;
}
// the runway left from a holding point's entry to the far end, the way it departs
function fxTora(ac, hp){
  const H = HOLDS[hp]; if (!H) return Infinity;
  const rw = depRw(ac), R = rwyOf(rw), L = R.len || RWY_M, m = GN[H.rwy] ? R.mOf(GN[H.rwy].p) : H.m;
  return Math.round(rw === R.lo ? L - m : m);
}
const fxTodrOf = ac => { let v = FX.tod.get(ac.cs); if (!v || S.t - v.t > 120) FX.tod.set(ac.cs, v = { m: fxTodr(ac), t: S.t }); return v.m; };
// a holding point too short for it: why, in the crew's words
// only for an entry that serves this runway direction: one at the far end (the runway changed under it) is left to the
// engine, which lines it up as it always has
const fxServes = (ac, hp) => { const H = HOLDS[hp], rw = depRw(ac); return !!H && (H.end ? H.end === rw : String(H.dirs || '').split(',').includes(rw)); };
function fxToShort(ac){
  if (!ac || ac.kind !== 'DEP' || !ac.hp || !fxServes(ac, ac.hp)) return null;
  const need = fxTodrOf(ac), have = fxTora(ac, ac.hp), full = fxFull(ac);
  if (have >= need || !full || have >= fxTora(ac, full) - 20) return null;   // from the full length it goes, lighter (payload or fuel off) if it must
  return `unable from ${exitWord(ac.hp)}, we need ${need.toLocaleString('en-GB')} metres${full && full !== ac.hp ? `, request full length from ${exitWord(full)}` : ''}`;
}
// the departure-end holding point with the most runway ahead
const fxFull = ac => Object.keys(HOLDS).filter(k => HOLDS[k].end === depRw(ac) || (HOLDS[k].dirs || '').includes(depRw(ac))).sort((a, b) => fxTora(ac, b) - fxTora(ac, a))[0];
// the taxi: a named holding point that is too short is refused; the default one becomes the full length when it must
APT.taxiCheck = (ac, hp) => { if (!ac || ac.kind !== 'DEP' || !fxServes(ac, hp)) return null; const need = fxTodrOf(ac), have = fxTora(ac, hp);
  const full = fxFull(ac); if (have >= need || !full || have >= fxTora(ac, full) - 20) return null;
  return `${ac.cs} (${ac.t} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}) needs ${need.toLocaleString('en-GB')} m to take off today and from ${hp} there is ${have.toLocaleString('en-GB')} m${full ? `: taxi it to ${full} for the full length (${fxTora(ac, full).toLocaleString('en-GB')} m)` : ''}.`; };
if (typeof depHold === 'function') { const dh = depHold; depHold = function(ac){ const k = dh(ac); if (!ac || ac.kind !== 'DEP' || !ac.cs || !k || !fxServes(ac, k)) return k; const full = fxFull(ac); return fxTora(ac, k) >= fxTodrOf(ac) || !full ? k : full; }; }
function fxSelLine(ac){
  if (ac.kind !== 'DEP' || !ac.ground || ac.state === 'PRE') return '';
  const need = fxTodrOf(ac), hp = ac.hp || depHold(ac), have = hp ? fxTora(ac, hp) : null, short = have != null && have < need;
  const lim = hp && fxFull(ac) && need > fxTora(ac, fxFull(ac));   // more than the whole runway: it goes from the full length with payload or fuel left behind
  if (lim) return `<div class="meta">Take-off distance <b>${need.toLocaleString('en-GB')} m</b> at its planned weight: more than the runway (${fxTora(ac, fxFull(ac)).toLocaleString('en-GB')} m from ${fxFull(ac)}). <b>Weight-restricted</b>: full length only, with payload or fuel offloaded.</div>`;
  return `<div class="meta">Take-off distance <b>${need.toLocaleString('en-GB')} m</b> (${typeSay(ac.t)}, ${Math.round(fxStageNM(ac)/10)*10} NM to ${AP[ac.d] ? AP[ac.d][2] : ac.d}${(FX.rc || {}).code < 6 ? ', ' + FX.rc.word.toLowerCase() + ' runway' : ''})${hp ? ` · from ${hp}: <span style="color:${short ? 'var(--bad,#ff6b6b)' : 'inherit'}">${have.toLocaleString('en-GB')} m</span>${short ? ' — too short' : ''}` : ''}</div>`;
}
function fxStrip(ac, d){
  if (ac.kind !== 'DEP' || !ac.ground || ac.airborne) return;
  const need = fxTodrOf(ac), hp = ac.hp || (ac.state === 'PARKED' ? null : depHold(ac)), full = fxFull(ac);
  d.title = `Take-off distance required ${need.toLocaleString('en-GB')} m`;
  // the crew will want the full length: shown on the strip, as a controller would note it
  if (full && fxTora(ac, full) - need < 250) { const k = document.createElement('span'); k.className = 'rel exp'; k.textContent = 'FULL'; k.title = `Needs the full length: ${need.toLocaleString('en-GB')} m`; const q = d.querySelector('.fq'); if (q) q.append(' ', k); }
}

// ── 5. jet blast ──────────────────────────────────────────
// sources: take-off thrust (the first part of the roll and the spool-up), and breakaway thrust leaving a stand. A cone
// behind the engines: length by type and thrust, widening with distance.
function fxBlastSources(){
  const out = [];
  for (const ac of S.acs) {
    if (!ac.ground) continue;
    const jet = ac.perf.shape !== 'prop', big = ac.perf.wake === 'H';
    if (ac.state === 'TAKEOFF' && !ac.rto && (ac.ias || 0) < 90) out.push({ ac, L: jet ? (big ? 520 : 360) : 140, k: 'take-off' });
    else if (ac.state === 'TAXI' && ac.leftStand && ac.fxBrk == null) ac.fxBrk = S.t;
    if (ac.state === 'TAXI' && ac.fxBrk != null && S.t - ac.fxBrk < 14 && (ac.gs || 0) < 10) out.push({ ac, L: jet ? (big ? 120 : 75) : 30, k: 'breakaway' });
    if (ac.state !== 'TAXI') ac.fxBrk = ac.state === 'PARKED' || ac.state === 'PUSH' || ac.state === 'READY' ? null : ac.fxBrk;
  }
  return out;
}
// where p sits in a source's blast: null, or { b: metres behind, l: metres to the side }
function fxInBlast(src, p){
  const a = src.ac, M = acMid(a), u = [Math.sin(a.hdg*D2R), Math.cos(a.hdg*D2R)], dx = (p[0] - M[0])/M2NM, dy = (p[1] - M[1])/M2NM;
  const b = -(dx*u[0] + dy*u[1]) - (a.perf.len || 38)/2, l = Math.abs(dx*u[1] - dy*u[0]);
  return b > 0 && b < src.L && l < (a.perf.span || 34)/2 + b*0.14 ? { b, l } : null;
}
function fxStepBlast(){
  FX.blast = fxBlastSources();
  for (const v of S.acs) {
    if (!v.ground || v.state === 'TAKEOFF') { v.fxBl = null; continue; }
    let hit = null; for (const s of FX.blast) if (s.ac !== v) { const q = fxInBlast(s, acMid(v)); if (q && (!hit || q.b < hit.q.b)) hit = { s, q }; }
    if (hit && !v.fxBl) {
      const s = hit.s, light = v.perf.wake === 'L' || v.perf.shape === 'prop', close = hit.q.b < s.L*(s.k === 'take-off' ? 0.45 : 0.6);
      const moving = ['TAXI', 'LINEUP', 'VACATING', 'TOW'].includes(v.state);   // standing at a holding point or on stand: the holding points are laid out clear of it
      if (!moving) { v.fxBl = { cs: s.ac.cs, t: S.t }; continue; }
      if (light && close) {
        SC(v).incidents++; SC(v).pts -= 40;
        sys(`INCIDENT: ${v.cs} (${v.t}) was caught in the ${s.k} jet blast of ${s.ac.cs}, ${Math.round(hit.q.b)} m behind it.`, true);
        pilot(v, `we've just been hit by jet blast from the departing ${typeSay(s.ac.t)}, we're stopped, checking for damage`);
      } else { SC(v).pts -= 5; pilot(v, `we're in the jet blast of the ${typeSay(s.ac.t)} ahead`); }
    }
    v.fxBl = hit ? { cs: hit.s.ac.cs, t: S.t } : (v.fxBl && S.t - v.fxBl.t < 3 ? v.fxBl : null);
  }
}
// a taxiing aircraft stops short of a blast cone it is about to enter (crews see the engines spool up), and says so once
function fxTaxiSpd(ac, spd){
  if (spd > 0 && (FX.rc || {}).code < 6) spd = Math.min(spd, (FX.rc.code <= 3 ? 12 : 18));   // slower turns on a wet or slippery surface
  if (!(spd > 0) || !FX.blast.length || !ac.path) return spd;
  const ahead = ac.path.pts[0], d = dist(ac.x, ac.y, ...ahead), f = d > 1e-6 ? Math.min(1, 45*M2NM/d) : 0, p = [ac.x + (ahead[0] - ac.x)*f, ac.y + (ahead[1] - ac.y)*f];
  for (const s of FX.blast) { if (s.ac === ac || fxInBlast(s, acMid(ac))) continue; if (fxInBlast(s, p)) {
    if (ac.fxWaitBl !== s.ac.cs) { ac.fxWaitBl = s.ac.cs; pilot(ac, `holding position, jet blast from the ${typeSay(s.ac.t)}`); }
    return 0; } }
  if (ac.fxWaitBl) ac.fxWaitBl = null;
  return spd;
}
function fxDrawBlast(mpx){
  if (!FX.blast.length || V.scale < 300) return;
  cx.save(); cx.globalCompositeOperation = C.name === 'dark' ? 'lighter' : 'source-over';
  for (const s of FX.blast) {
    const a = s.ac, M = acMid(a), h = a.hdg*D2R, back = (a.perf.len || 38)/2, w0 = (a.perf.span || 34)/2, L = s.L, wl = w0 + L*0.14;
    const P = (b, l) => { const x = M[0] - Math.sin(h)*(back + b)*M2NM + Math.cos(h)*l*M2NM, y = M[1] - Math.cos(h)*(back + b)*M2NM - Math.sin(h)*l*M2NM; return [sx(x), sy(y)]; };
    const A = P(0, 0), B = P(L, 0), g = cx.createLinearGradient(...A, ...B);
    g.addColorStop(0, s.k === 'take-off' ? 'rgba(255,150,70,.22)' : 'rgba(255,170,90,.18)'); g.addColorStop(1, 'rgba(255,150,70,0)');
    cx.fillStyle = g; cx.beginPath(); cx.moveTo(...P(0, -w0)); cx.lineTo(...P(L, -wl)); cx.lineTo(...P(L, wl)); cx.lineTo(...P(0, w0)); cx.closePath(); cx.fill();
  }
  cx.restore();
}

// ── 9. rejected take-off and cancelled landing clearance ──
function fxReject(ac, said, reads){
  const v1 = ac.perf.vr - 6;
  said.push('stop immediately, I say again, stop immediately');
  if ((ac.ias || 0) >= v1) { reads.push('unable, continuing'); sys(`${ac.cs} was past V1 at ${Math.round(ac.ias)} kt: the crew continues the take-off, as they must.`, true); return; }
  ac.rto = { from: ac.ias }; reads.push('stopping');
}
function fxRtoStep(ac, dt){
  const R = rwyOf(ac.depRwy), u = ac.depRwy === R.hi ? -1 : 1;
  ac.ias = Math.max(0, ac.ias - 5.5*fxBrake()*dt); ac.gs = ac.ias;
  const mv = ac.ias/3600*dt; ac.x += R.RU[0]*u*mv; ac.y += R.RU[1]*u*mv;
  if (ac.ias <= 0.5) {
    const hot = ac.rto.from > 80; ac.rto = null; ac.ias = ac.gs = 0; ac.cto = false; ac.state = 'LINEDUP'; ac.onRwy = true;
    ac.need = 'Stopped on the runway';
    pilot(ac, `stopped on the runway${hot ? ', high-speed rejected take-off, brakes are hot, we will need to vacate and return to stand for inspection' : ', we can vacate and taxi back for another go'}`);
    sys(`${ac.cs} has stopped on runway ${ac.depRwy}: vacate it with VAC (an exit ahead of it), then taxi it ${hot ? 'back to a stand' : 'back to the holding point'}.`, true);
    if (typeof renderSel === 'function') renderSel();
  }
}

// ── 6. typical weather from real reports ──────────────────
if (typeof EGGD_WXCLIM !== 'undefined' && typeof WX_PRESETS !== 'undefined') {
  const pick = () => { const L = EGGD_WXCLIM.m[new Date().getUTCMonth()] || EGGD_WXCLIM.m[0]; return APT.icao + ' ' + L[Math.floor(Math.random()*L.length)]; };
  const mon = new Date().toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  WX_PRESETS.clim = { name: `Typical ${mon}: a real ${APT.name || 'Bristol'} METAR`, short: 'Typical', get metar(){ return pick(); } };
  if (typeof wxSel !== 'undefined' && wxSel && !wxSel.querySelector('option[value="clim"]')) {
    const o = document.createElement('option'); o.value = 'clim'; o.textContent = WX_PRESETS.clim.name + ' (2019–2024)'; wxSel.insertBefore(o, wxSel.firstChild);
    try { if (!localStorage.getItem('cw-fx-wx')) wxSel.value = 'clim'; } catch (_) { wxSel.value = 'clim'; }
    wxSel.addEventListener('change', () => { try { localStorage.setItem('cw-fx-wx', '1'); } catch (_) {} });
  }
}

// ── 7. command suggestions ────────────────────────────────
// what the flight in the box can be told next: the obvious next instruction first, then the others that make sense in
// its state, then (once a word is typed that takes one) the holding points, taxiways, exits or stands for it
function fxSuggest(){
  const box = $('cmd'); if (!box) return [];
  const txt = box.value.toUpperCase(), toks = txt.trim().split(/\s+/).filter(Boolean), done = /\s$/.test(txt) || !txt;
  let ac = toks.length && findAc(toks[0]) ? findAc(toks[0]) : null; if (!ac) ac = S.sel;
  const words = ac && toks[0] === ac.cs ? toks.slice(1) : toks, last = done ? '' : (words[words.length - 1] || ''), prev = done ? words[words.length - 1] : words[words.length - 2];
  const out = [], add = (w, why) => { if (!out.some(o => o.w === w) && (!last || w.startsWith(last))) out.push({ w, why }); };
  if (!ac || !S.acs.includes(ac)) { for (const a of S.acs.filter(a => a.need && !outOfCtl(a) && !aiOwns(a)).slice(0, 6)) add(a.cs, a.need); return out; }
  const st = ac.state, air = ac.airborne;
  // arguments for the word before
  if (prev === 'TAXI' && ac.kind === 'DEP') { for (const k of Object.keys(HOLDS).filter(k => HOLDS[k].end === depRw(ac))) add(k, fxTora(ac, k) >= fxTodrOf(ac) ? `${fxTora(ac, k).toLocaleString('en-GB')} m` : 'too short'); add('VIA', 'route'); return out; }
  if (prev === 'TAXI' && ac.kind === 'ARR') { if (ac.stand) add(ac.stand.id, 'its stand'); add('VIA', 'route'); return out; }
  if (prev === 'VIA' || (words.includes('VIA') && done)) { const tws = [...new Set(GE.map(e => e.tw).filter(t => t && t !== 'APRON' && !/~/.test(t)))].sort(); for (const t of tws) add(t, 'taxiway'); return out; }
  if (prev === 'VAC') { for (const e of (typeof vacChoices === 'function' ? vacChoices(ac) : [])) add(e.replace(/~\d+$/, ''), 'exit'); return out; }
  if (prev === 'PUSH') { for (const d of ['N', 'E', 'S', 'W']) add(d, 'facing'); return out; }
  if (prev === 'STAND' || prev === 'GATE') { for (const s of (typeof standChoices === 'function' ? standChoices(ac) : []).filter(s => !s.occ).slice(0, 6)) add(s.id, 'free'); add('AUTO', 'pick one'); return out; }
  if (prev === 'CROSS' || prev === 'X') { for (const r of RW_ENDS || []) add(r, 'runway'); return out; }
  const nx = typeof stripNext === 'function' && stripNext(ac); if (nx) add(nx.cmd.split(' ')[0], nx.label);
  if (!air) {
    if (st === 'PARKED' && ac.kind === 'DEP') { add('PUSH', 'start-up and push'); add('TAXI', 'taxi out'); add('TSAT', 'start-up delay'); }
    if (['READY', 'TAXI', 'HOLDPT', 'HELD'].includes(st)) { add('TAXI', 'to a holding point'); add('HP', 'hold position'); add('RES', 'continue'); add('CROSS', 'cross a runway'); }
    if (st === 'HOLDPT' || (st === 'TAXI' && ac.kind === 'DEP')) { add('LU', 'line up and wait'); add('CTO', 'cleared for take-off'); }
    if (st === 'LINEUP' || st === 'LINEDUP') { add('CTO', 'cleared for take-off'); add('VAC', 'vacate'); add('CXL', 'cancel'); }
    if (st === 'TAKEOFF') add('STOP', 'reject the take-off');
    if (['ROLLOUT', 'ROLLED', 'VACATING'].includes(st)) { add('VAC', 'exit'); add('TAXI', 'to stand'); add('STAND', 'assign'); }
    if (st === 'PUSH' || st === 'READY') { add('PULL', 'back on stand'); add('TAXI', 'taxi'); }
  } else if (ac.kind === 'ARR') { add('CTL', 'cleared to land'); add('VAC', 'plan an exit'); add('STAND', 'assign'); if (ac.ctl) add('CXL', 'cancel landing clr'); add('GA', 'go around'); }
  else { add('HO', 'contact next'); }
  return out.slice(0, 9);
}
{ const bottom = document.querySelector('.bottom'), form = $('cmdForm');
  if (bottom && form && !$('cmdSug')) {
    const bar = document.createElement('div'); bar.id = 'cmdSug'; bar.className = 'cmd-sug'; bar.setAttribute('aria-label', 'Suggested instructions'); bottom.insertBefore(bar, form);
    const st = document.createElement('style'); st.textContent = `.cmd-sug{display:flex;gap:6px;overflow-x:auto;padding:4px 10px 2px;min-height:30px;scrollbar-width:none;align-items:center}
.cmd-sug::-webkit-scrollbar{display:none}.cmd-sug button{flex:0 0 auto;display:flex;gap:6px;align-items:baseline;font:600 12px var(--mono,"JetBrains Mono",monospace);padding:4px 9px;border-radius:6px;border:1px solid rgba(120,160,150,.35);background:rgba(20,32,30,.7);color:#e6efe9;cursor:pointer}
.cmd-sug button i{font:400 10.5px Inter,system-ui,sans-serif;font-style:normal;opacity:.6}.cmd-sug button.first{border-color:#4fd18b;color:#7dffb0}.cmd-sug:empty{display:none}
body:not(.theme-dark) .cmd-sug button{background:#fff;color:#0c1b2e;border-color:rgba(12,27,46,.2)}`;
    document.head.appendChild(st);
    let sig = '';
    const render = () => { const L = fxSuggest(), s = JSON.stringify(L) + (S.sel ? S.sel.cs : ''); if (s === sig) return; sig = s;
      bar.innerHTML = L.map((o, i) => `<button type="button" data-w="${esc(o.w)}" class="${i ? '' : 'first'}">${esc(o.w)}<i>${esc(o.why || '')}</i></button>`).join(''); };
    bar.addEventListener('pointerdown', e => e.preventDefault());   // keep the focus (and the phone keyboard state) in the box
    bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const box = $('cmd'); let v = box.value;
      if (!S.sel && !v.trim() && findAc(b.dataset.w)) { select(findAc(b.dataset.w)); render(); return; }
      v = /\s$/.test(v) || !v ? v : v.replace(/\S+$/, ''); if (!v.trim() && S.sel) v = S.sel.cs + ' '; box.value = v + b.dataset.w + ' '; sig = ''; render(); });
    $('cmd').addEventListener('input', render); setInterval(render, 700);
  } }

// ── 8. engine sound ───────────────────────────────────────
// a voice per aircraft (the nearest few): roar (filtered noise) and fan whine for jets, blade buzz for turboprops. The
// listener is the middle of the screen at a height that grows as you zoom out; the pan is where it is on the screen and
// the Doppler shift comes from how fast it closes or opens.
const SND = { ctx: null, voices: [], master: null, noise: null, last: new Map() };
function sndInit(){
  if (SND.ctx || !FX.snd) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const c = SND.ctx = new AC(), n = c.createBuffer(1, c.sampleRate*2, c.sampleRate), d = n.getChannelData(0);
  let b = 0; for (let i = 0; i < d.length; i++) { b = 0.97*b + 0.03*(Math.random()*2 - 1); d[i] = b*4 + (Math.random()*2 - 1)*0.15; }   // brown-ish noise: a jet's roar
  SND.noise = n; SND.master = c.createGain(); SND.master.gain.value = 0.55; SND.master.connect(c.destination);
  for (let i = 0; i < 6; i++) {
    const src = c.createBufferSource(); src.buffer = n; src.loop = true; src.loopStart = Math.random();
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    const wh = c.createOscillator(); wh.type = 'sine'; wh.frequency.value = 3000; const wg = c.createGain(); wg.gain.value = 0;
    const pr = c.createOscillator(); pr.type = 'sawtooth'; pr.frequency.value = 85; const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 400; const pg = c.createGain(); pg.gain.value = 0;
    const g = c.createGain(); g.gain.value = 0; const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(bp); bp.connect(g); wh.connect(wg); wg.connect(g); pr.connect(pf); pf.connect(pg); pg.connect(g);
    if (pan) { g.connect(pan); pan.connect(SND.master); } else g.connect(SND.master);
    src.start(); wh.start(); pr.start();
    SND.voices.push({ src, bp, wh, wg, pr, pg, g, pan, cs: null });
  }
}
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => { sndInit(); if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); }, { passive: true });
const fxThrust = ac => ac.state === 'TAKEOFF' ? (ac.rto ? 0.75 : 1) : ac.state === 'ROLLOUT' ? (ac.ias > 70 ? 0.8 : 0.45) : !ac.ground ? (ac.alt < 4000 ? 0.75 : 0)
  : ac.state === 'TAXI' || ac.state === 'VACATING' || ac.state === 'LINEUP' ? (ac.fxBrk != null && S.t - ac.fxBrk < 14 ? 0.5 : 0.3)
  : ac.state === 'HOLDPT' || ac.state === 'LINEDUP' || ac.state === 'READY' || ac.state === 'HELD' ? 0.27 : ac.state === 'PUSH' ? 0.18 : 0;
function sndStep(){
  if (!SND.ctx) return;
  const c = SND.ctx, t = c.currentTime, on = FX.snd && S.running && !S.paused && document.visibilityState === 'visible' && document.body.dataset.route === 'sim' && V.scale > 120;
  const hgt = Math.max(120, (W/V.scale)*1852*0.22), cxw = wx2(W/2), cyw = wy2(H/2), list = [];
  if (on) for (const ac of S.acs) {
    const th = fxThrust(ac); if (!th) continue;
    const dx = (ac.x - cxw)/M2NM, dy = (ac.y - cyw)/M2NM, alt = ac.ground ? 0 : Math.max(0, ac.alt - (APT.elev || 0))*0.3048, D = Math.hypot(dx, dy, alt + hgt);
    const prev = SND.last.get(ac.cs), vr = prev ? (D - prev)/(1/8) : 0; SND.last.set(ac.cs, D);
    const lvl = Math.pow(th, 1.3)*Math.min(1, 380/D)*(ac.perf.wake === 'H' ? 1.3 : ac.perf.wake === 'L' ? 0.6 : 1);
    if (lvl > 0.01) list.push({ ac, lvl, pan: clamp((sx(ac.x) - W/2)/(W/2), -1, 1), dop: clamp(343/(343 + clamp(vr, -120, 120)), 0.7, 1.4), th });
  }
  list.sort((a, b) => b.lvl - a.lvl);
  const use = list.slice(0, SND.voices.length), free = SND.voices.filter(v => !use.some(u => u.ac.cs === v.cs));
  for (const v of SND.voices) if (!use.some(u => u.ac.cs === v.cs)) { v.cs = null; v.g.gain.setTargetAtTime(0, t, 0.25); }
  for (const u of use) {
    const v = SND.voices.find(v => v.cs === u.ac.cs) || free.shift(); if (!v) continue; v.cs = u.ac.cs;
    const prop = u.ac.perf.shape === 'prop', g = Math.min(0.6, u.lvl*1.2);
    v.g.gain.setTargetAtTime(g, t, 0.2); if (v.pan) v.pan.pan.setTargetAtTime(u.pan, t, 0.1);
    v.bp.frequency.setTargetAtTime((prop ? 300 : 380 + 900*u.th)*u.dop, t, 0.2);
    v.wg.gain.setTargetAtTime(prop ? 0 : 0.02 + 0.05*u.th, t, 0.2); v.wh.frequency.setTargetAtTime((2200 + 2600*u.th)*u.dop, t, 0.2);
    v.pg.gain.setTargetAtTime(prop ? 0.18 + 0.25*u.th : 0, t, 0.2); v.pr.frequency.setTargetAtTime((70 + 40*u.th)*u.dop, t, 0.2);
  }
}
setInterval(sndStep, 125);

// ── the step: runway condition, take-off distances, jet blast ──
function fxStep(dt){
  if (!FX.rc || FX.rc.key !== ((S.wx && S.wx.raw || '').split(' RMK ')[0]) + FX.rc.code) fxRwyCond();
  fxStepBlast();
  // an AI controller hears "request full length" and sends it there (a controller of your own does it with TAXI)
  for (const ac of S.acs) if (ac.need === 'Needs full length' && ac.state === 'HOLDPT' && typeof aiOwns === 'function' && aiOwns(ac) && !(ac.aiNext > S.t)) {
    const full = fxFull(ac); if (full && full !== ac.hp && typeof aiDo === 'function') aiDo(seatOf(ac), ac, `TAXI ${full}`); else ac.need = 'Ready for departure'; }
}

// ── controls: Airfield map toggle on the scope toolbar, engine sound in the menu ──
{ const tb = document.querySelector('.scopewrap .toolbar'), fids = $('tgFids');
  if (tb && !$('tgField')) {
    const b = document.createElement('button'); b.id = 'tgField'; b.type = 'button'; b.title = 'Airfield chart or street map under the ground and tower views';
    const lbl = () => { b.textContent = FX.map === 'field' ? 'Airfield' : 'Street map'; b.classList.toggle('on', FX.map === 'field'); };
    b.onclick = () => { FX.map = FX.map === 'field' ? 'street' : 'field'; try { localStorage.setItem('cw-fx-map', FX.map); } catch (_) {} lbl(); };
    lbl(); fids && fids.nextSibling ? tb.insertBefore(b, fids.nextSibling) : tb.appendChild(b);
  }
  // phones: the toolbar is full, so the switch is in the menu there
  { const st = document.createElement('style'); st.textContent = '@media (max-width: 760px){#tgField{display:none}} @media (min-width: 761px){#tgField2{display:none}}'; document.head.appendChild(st); }
  const mp = $('menuPop'), vb = $('tgVoice');
  if (mp && !$('tgField2')) {
    const b = document.createElement('button'); b.id = 'tgField2'; b.type = 'button';
    const lbl = () => { b.textContent = `Map under the airfield · ${FX.map === 'field' ? 'chart' : 'street'}`; };
    b.onclick = () => { const t = $('tgField'); if (t) t.click(); else FX.map = FX.map === 'field' ? 'street' : 'field'; lbl(); };
    lbl(); vb && vb.nextSibling ? mp.insertBefore(b, vb.nextSibling) : mp.appendChild(b);
  }
  if (mp && !$('tgSnd')) {
    const b = document.createElement('button'); b.id = 'tgSnd'; b.type = 'button'; b.title = 'Engine sounds round the middle of the screen';
    const lbl = () => { b.textContent = `Engine sounds · ${FX.snd ? 'on' : 'off'}`; b.setAttribute('aria-pressed', String(FX.snd)); };
    b.onclick = () => { FX.snd = !FX.snd; try { localStorage.setItem('cw-fx-snd', FX.snd ? '1' : '0'); } catch (_) {} if (FX.snd) sndInit(); lbl(); };
    lbl(); vb && vb.nextSibling ? mp.insertBefore(b, vb.nextSibling) : mp.appendChild(b);
  }
}
