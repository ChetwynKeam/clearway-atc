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
  if (sc < 1800) { fxDrawBlast(sc/1852); return; }
  const tags = [];
  const mpx = sc/1852, dark = C.name === 'dark';
  cx.save(); cx.font = `600 9px ${FONT_D}`; cx.textAlign = 'center';
  for (const s of STANDS) {
    if (!s.p || s.hdg == null || s.area === 'hangar') continue;
    const sz = standSize(s), f = sz.f || 0.62, head = (sz.l*f + 7)*M2NM, h = s.hdg*D2R;
    const X = sx(s.p[0] + Math.sin(h)*head), Y = sy(s.p[1] + Math.cos(h)*head);
    if (X < -40 || Y < -20 || X > W + 40 || Y > H + 20) continue;
    const code = s.maxShort || fxCode(s.maxSpan || 36), t = `${s.id} ${code}${s.contact === false ? ' BUS' : ''}`, w = cx.measureText(t).width + 6, box = [X - w/2, Y - 7, w, 13];
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
if (typeof depHold === 'function') { const dh = depHold; depHold = function(ac){
  if (ac && ac.fxGA && ac.kind === 'DEP') {   // the club aircraft: from the south-side intersection nearest them, if it is long enough (it always is)
    const need = fxTodrOf(ac), ks = Object.keys(HOLDS).filter(k => fxServes(ac, k) && HOLDS[k].off < 0 && fxTora(ac, k) >= need && GN[HOLDS[k].node]);
    const k = ks.sort((a, b) => dist(ac.x, ac.y, ...GN[HOLDS[a].node].p) - dist(ac.x, ac.y, ...GN[HOLDS[b].node].p))[0]; if (k) return k; }
  const k = dh(ac); if (!ac || ac.kind !== 'DEP' || !ac.cs || !k || !fxServes(ac, k)) return k; const full = fxFull(ac); return fxTora(ac, k) >= fxTodrOf(ac) || !full ? k : full; }; }
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
  if (prev === 'TAXI' && ac.kind === 'ARR') { if (ac.fxGA) add(GA.ihp, 'the southside'); if (ac.stand) add(ac.stand.id, 'its stand'); add('VIA', 'route'); return out; }
  if (prev === 'VIA' || (words.includes('VIA') && done)) { const tws = [...new Set(GE.map(e => e.tw).filter(t => t && t !== 'APRON' && !/~/.test(t)))].sort(); for (const t of tws) add(t, 'taxiway'); return out; }
  if (prev === 'VAC') { for (const e of (typeof vacChoices === 'function' ? vacChoices(ac) : [])) add(e.replace(/~\d+$/, ''), 'exit'); return out; }
  if (prev === 'PUSH') { for (const d of ['N', 'E', 'S', 'W']) add(d, 'facing'); return out; }
  if (prev === 'STAND' || prev === 'GATE') { for (const s of (typeof standChoices === 'function' ? standChoices(ac) : []).filter(s => !s.occ).slice(0, 6)) add(s.id, 'free'); add('AUTO', 'pick one'); return out; }
  if (prev === 'CROSS' || prev === 'X') { for (const r of RW_ENDS || []) add(r, 'runway'); return out; }
  const nx = typeof stripNext === 'function' && stripNext(ac); if (nx) add(nx.cmd.split(' ')[0], nx.label);
  if (ac.fxCct && ac.fxCct.leg && ac.airborne) { const c = ac.fxCct;
    if (ac.need === 'Request practice ILS') { add('PILS', 'approve practice ILS'); add('NEG', 'continue circuits'); }
    if (c.leg === 'DEAD') add('REJOIN', 'rejoin crosswind');
    if (c.pi && c.leg === 'FINAL') add('LOW', 'low approach');
    add('TG', 'touch and go'); add('CTL', 'land, full stop'); add('RF', 'report final'); add('ORB', 'orbit'); add('DEAD', 'to the deadside'); add('EXT', 'extend downwind'); add('BASE', 'turn base'); add('FS', 'make it a full stop'); add('GA', 'go around');
    return out.slice(0, 10); }
  if (ac.fxGA && ac.kind === 'ARR' && prev === undefined) add('TAXI', 'to the southside');
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

// ═════════ aircraft in their airline colours ═════════
// Seen from above: a white crown with the belly colour showing along each side, the fin, the winglets and the engine
// cowlings in the airline's colours, light grey wings. Colours only (no logos or titles). The state colour (amber
// departure, blue arrival, grey parked) stays as a thin outline, and the tag says the rest. Used once an aircraft is big
// enough on the screen to show it (about 12 px across); smaller than that it stays the plain coloured shape.
const FX_LIV = {
  EZY: { fin: '#ff6600', eng: '#ff6600', wl: '#ff6600' }, EJU: 'EZY', EZS: 'EZY',
  RYR: { belly: '#073590', fin: '#073590', eng: '#073590', wl: '#f1c933' }, RUK: 'RYR', MAY: 'RYR', LDM: 'RYR',
  EXS: { belly: '#d50032', fin: '#d50032', wl: '#d50032' },
  TOM: { belly: '#6cc4f0', fin: '#6cc4f0', eng: '#0b2d5b', wl: '#6cc4f0' }, TUI: 'TOM',
  KLM: { belly: '#00a1de', fin: '#00a1de', eng: '#00a1de', wl: '#00a1de' }, KLC: 'KLM',
  EIN: { belly: '#00857d', fin: '#00857d', wl: '#00857d' }, EAI: 'EIN',
  LOG: { fin: '#1d3767', eng: '#1d3767', wl: '#1d3767' },
  AUR: { fin: '#f6c400', eng: '#f6c400' },
  BAW: { belly: '#1b3d7a', fin: '#1b3d7a', eng: '#c8ced6', wl: '#1b3d7a' }, CFE: 'BAW', SHT: 'BAW',
  WZZ: { belly: '#c6007e', fin: '#c6007e', eng: '#c6007e', wl: '#c6007e' }, WUK: 'WZZ', WMT: 'WZZ',
  DLH: { fin: '#05164d', eng: '#05164d', wl: '#05164d' }, AFR: { fin: '#002157', eng: '#d0d4d9' },
  VLG: { fin: '#f7d117', eng: '#5c5c5c', wl: '#f7d117' }, IBE: { fin: '#d7192d', eng: '#f5b400' },
  VJT: { fin: '#c8102e', eng: '#c8102e' }, NJE: { fin: '#3d4550', eng: '#3d4550' }, BCI: { fin: '#1360b0', eng: '#1360b0' },
  TAP: { fin: '#d91f26', eng: '#1d8c3b' }, SWR: { fin: '#e2001a' }, BEL: { fin: '#06235a', eng: '#06235a' }
};
const FX_GENERIC = { fin: '#8f99a3', eng: '#d2d6db' };
function fxLivery(ac){
  let L = FX_LIV[String(ac.cs || '').slice(0, 3)]; if (typeof L === 'string') L = FX_LIV[L];
  L = L || FX_GENERIC;
  return { body: '#f3f5f7', wing: '#c5cbd2', eng: L.eng || '#dfe3e7', fin: L.fin || '#8f99a3', belly: L.belly || null, wl: L.wl || null };
}
function fxDrawLivery(sh, X, Y, hdg, m, L, edge, o){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); cx.scale(m, m); cx.lineJoin = 'round';
  const both = f => { f(); cx.scale(-1, 1); f(); cx.scale(-1, 1); }, fill = (p, c) => { cx.fillStyle = c; cx.fill(p); };
  const lw = (o.lw || 1)*2/m, stroke = p => { cx.strokeStyle = edge; cx.lineWidth = lw; cx.stroke(p); };
  // the outline of the whole aircraft first (state colour), the fills over it, so only the outside edge shows
  both(() => stroke(sh.under)); stroke(sh.body); both(() => stroke(sh.half)); both(() => stroke(sh.over)); stroke(sh.centre);
  both(() => fill(sh.under, L.eng)); both(() => fill(sh.under, 'rgba(20,28,40,.12)')); both(() => fill(sh.intake, 'rgba(14,20,30,.6)'));
  both(() => fill(sh.half, L.wing));
  // the wing root and walkway a shade darker, the control surfaces a hinge line, the winglets in colour
  if (m > 0.5) { cx.strokeStyle = 'rgba(20,28,40,.28)'; cx.lineWidth = 0.6/m; both(() => cx.stroke(sh.hinge)); }
  if (L.wl) both(() => { cx.save(); cx.clip(sh.half); cx.fillStyle = L.wl; cx.fillRect(sh.tip[0] - Math.max(1.4, sh.size*0.035), -200, 30, 400); cx.restore(); });
  fill(sh.body, L.body);
  if (L.belly) { cx.save(); cx.clip(sh.body); cx.fillStyle = L.belly; cx.fillRect(sh.h*0.58, -200, sh.h, 400); cx.fillRect(-sh.h*1.58, -200, sh.h, 400); cx.restore(); }
  if (!sh.gradL) { const g = cx.createLinearGradient(-sh.h, 0, sh.h, 0);
    g.addColorStop(0, 'rgba(10,18,30,.22)'); g.addColorStop(.25, 'rgba(10,18,30,0)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(.62, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,18,30,.2)'); sh.gradL = g; }
  fill(sh.body, sh.gradL);
  if (m > 0.35) fill(sh.win, 'rgba(14,22,34,.85)');
  // the fin seen from above, a little wider than it is so the colour reads
  cx.save(); cx.scale(2.4, 1); fill(sh.fin, L.fin); cx.restore();
  both(() => fill(sh.over, L.eng)); fill(sh.centre, L.eng); both(() => fill(sh.over, 'rgba(20,28,40,.12)'));
  if (sh.props.length) {
    cx.strokeStyle = 'rgba(20,24,30,.85)'; cx.lineWidth = Math.max(0.25, 1.1/m);
    cx.beginPath(); for (const [x, y, d] of sh.props) { cx.moveTo(x - d/2, y); cx.lineTo(x + d/2, y); } cx.stroke();
    if (o.spin) { cx.fillStyle = 'rgba(20,24,30,.14)'; for (const [x, y, d] of sh.props) { cx.beginPath(); cx.ellipse(x, y, d/2, d*0.08, 0, 0, 7); cx.fill(); } }
  }
  cx.restore();
}
{ const ds = drawShape; drawShape = function(sh, X, Y, hdg, m, col, o){ const L = FX.liv; if (!L || o.shadow) return ds.apply(this, arguments); fxDrawLivery(sh, X, Y, hdg, m, L, FX.edge, { ...o, lw: FX.edgeW }); }; }
{ const si = silhouette; silhouette = function(ac, X, Y, mpx, col, shadow){
  const big = ac.ground && !shadow && fxField() && (Math.max(ac.perf.span || 30, ac.perf.len || 30)*mpx >= 12);
  if (big) { const parked = (ac.state === 'PARKED' || ac.state === 'ONSTAND') && !ac.need && S.sel !== ac, dark = C.name === 'dark';
    FX.liv = fxLivery(ac); FX.edge = parked ? (dark ? 'rgba(0,0,0,.7)' : 'rgba(40,50,60,.55)') : dark ? col : (ac.kind === 'ARR' ? C.arr : C.dep); FX.edgeW = parked ? 0.7 : 1.5; }
  try { return si.apply(this, arguments); } finally { FX.liv = null; } }; }

// ═════════ passengers on foot and by bus ═════════
// Walk-out stands: the passengers walk a marked route, never straight across the apron. From the terminal door nearest
// the stand out to the head of the stand (in front of the noses, where the service road and the walkways are), along it
// to the stand, down the left side to the front steps; the rear steps are reached round the outside of the left
// wingtip, never under the wing. A stand whose walk would be long (over 170 m) or would cross a taxiway is a bus stand.
// The buses load at the departure bus gate and drop at the arrivals door, with the passengers walking between the
// terminal and the bus there too.
const FX_WALK = new Map();
const fxSegX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
function fxTermDoors(){ return (VD.terms || []).map(VP); }
// the walk from the terminal to a stand, for an aircraft of this size (null: no sensible walk, so it is bussed)
function fxWalk(st, P){
  const key = st.id + '|' + P.len + '|' + P.span; if (FX_WALK.has(key)) return FX_WALK.get(key);
  const doors = fxTermDoors(), M = st.p, h = st.hdg, L = P.len, S2 = P.span/2, w = (typeof fusW === 'function' ? fusW(P) : 4)/2, pt = (f, s) => mPt(M, h, f, s);
  const inv = q => { const dx = (q[0] - M[0])/VM, dy = (q[1] - M[1])/VM; return [dx*Math.sin(h*D2R) + dy*Math.cos(h*D2R), dx*Math.cos(h*D2R) - dy*Math.sin(h*D2R)]; };   // world → stand frame [f, s]
  let r = null;
  if (doors.length) {
    const fH = L/2 + 9, sH = -(w + 5), Hn = pt(fH, sH);
    const D = doors.slice().sort((a, b) => dist(...a, ...Hn) - dist(...b, ...Hn))[0], [fD, sD] = inv(D);
    const K = Math.abs(sD - sH) > 6 && fD > fH ? pt(fH, sD) : null;   // out from the door to the head of the stand line, then along it
    const legs = K ? [D, K, Hn] : [D, Hn];
    let len = 0; for (let i = 1; i < legs.length; i++) len += dist(...legs[i - 1], ...legs[i])/VM;
    const twys = GE.filter(e => e.tw && e.tw !== 'APRON').map(e => [GN[e.a].p, GN[e.b].p]);
    const crosses = legs.some((p, i) => i && twys.some(([a, b]) => fxSegX(legs[i - 1], p, a, b)));
    if (len <= 170 && !crosses) {
      const term = legs.slice().reverse();   // stand end first
      r = { len, term,
        front: f => [pt(f, -(w + 5.8)), Hn, ...term.slice(1)],
        rear: f => [pt(f, -(w + 5.8)), pt(f, -(S2 + 4)), pt(L/2 - L*0.27, -(S2 + 4)), Hn, ...term.slice(1)] };
    }
  }
  FX_WALK.set(key, r); return r;
}
{ const bs = bussed; bussed = function(ac, br){ const st = ac.stand; if (!st || br || small(ac) || st.area === 'hangar') return bs(ac, br);
  if (st.contact != null) return !st.contact;   // the published stand plan: contact (walk) or non-contact (coach)
  if (bs(ac, br)) return true; return !fxWalk(st, ac.perf); }; }
{ const ps = paxStreams; paxStreams = function(ac){
  const out = ps(ac); if (!out.length || !ac.stand) return out;
  const Wk = fxWalk(ac.stand, ac.perf), P = ac.perf, M = ac.stand.p, h = ac.hdg, w = fusW(P)/2;
  for (const st of out) {
    if (st.walk && Wk) {   // the marked route instead of the straight line
      const foot = st.pts[1], fF = doorFirst(P).f, fR = doorLast(P).f, rear = dist(...foot, ...mPt(M, h, fR, -(w + 1.6))) < dist(...foot, ...mPt(M, h, fF, -(w + 1.6)));
      st.pts = [st.pts[0], st.pts[1], ...(rear ? Wk.rear(fR) : Wk.front(fF))]; st.route = true;
    } else if (!st.walk && !st.inside) {   // to a bus: only one that is really at the foot of the steps
      const b = st.pts[st.pts.length - 1]; if (dist(...b, ...st.pts[2]) > 40*VM) st.pts.length = 0;
    }
  }
  return out.filter(s => s.pts.length);
}; }
// the bus gate (departures load here) and the arrivals door, each a bay 14 m out from its own terminal door
let FX_BAYS = null;
function fxBays(){
  if (FX_BAYS) return FX_BAYS;
  const arr = typeof termBay === 'function' && termBay(), doors = fxTermDoors(); if (!arr || !doors.length) return FX_BAYS = {};
  const da = doors.slice().sort((a, b) => dist(...a, ...arr.p) - dist(...b, ...arr.p))[0];
  const c = STANDS.reduce((s, t) => [s[0] + t.p[0]/STANDS.length, s[1] + t.p[1]/STANDS.length], [0, 0]);
  const dd = doors.filter(q => dist(...q, ...da)/VM > 45).sort((a, b) => dist(...a, ...c) - dist(...b, ...c))[0];
  // out from a door: towards the stand nearest it (square to the terminal face), the kerb at right angles to that
  const out = d => { const n = STANDS.slice().sort((a, b) => dist(...a.p, ...d) - dist(...b.p, ...d))[0]; return n ? brg(...d, ...n.p) : brg(...d, ...c); };
  const bay = d => { const h = out(d); return { p: [d[0] + Math.sin(h*D2R)*14*VM, d[1] + Math.cos(h*D2R)*14*VM], h, door: d }; };
  return FX_BAYS = { arr: { ...arr, h: out(da), door: da }, dep: dd ? bay(dd) : null };
}
// departure buses: start at the bus gate, load there (the passengers walk out of the terminal into it), then drive to the aircraft
if (typeof taPlan === 'function' && typeof VEH_GO !== 'undefined') {
  const tp = taPlan; taPlan = function(ac, T, arr, hdg){ const J = tp(ac, T, arr, hdg); for (const j of J) if (j.type === 'bus' && !j.arr && !j.bay) { j.at -= 200; j.fxLoad = true; } return J; };
  VEH_GO.fxToStand = (v, a) => { v.fxGate = null; driveTo(v, a[0], a[1]); v.parked = false; v.endH = a[1]; };
  const dp = dispatch; dispatch = function(type, p, h, job, urgent){
    const B = fxBays().dep; if (type !== 'bus' || !job || !job.fxLoad || !B) return dp.apply(this, arguments);
    const n = VEH.list.filter(w => w.fxGate && S.t < w.fxGate.until).length, k = norm(B.h + 90), at = [B.p[0] + Math.sin(k*D2R)*n*16*VM, B.p[1] + Math.cos(k*D2R)*n*16*VM];   // along the kerb, one behind the other
    const v = newVeh('bus', at, k, { job }); v.parked = true; v.fxGate = { until: S.t + rnd(150, 210), door: B.door };
    v.leaveAt = v.fxGate.until; v.go = ['fxToStand', [p, h]]; return v;
  };
}
// the walkways in use (a pale band with its barriers, under the passengers) and the people at the bus gate and arrivals door
function fxDrawPaxWays(mpx){
  if (V.scale < (typeof VEH_MIN_SCALE !== 'undefined' ? VEH_MIN_SCALE : 260) || typeof paxStreams !== 'function') return;
  const dark = C.name === 'dark';
  for (const ac of S.acs) {
    if (!ac.ta || !ac.stand || !onStandNow(ac)) continue;
    for (const st of paxStreams(ac)) { if (!st.route) continue;
      const pts = st.pts.slice(1).map(q => [sx(q[0]), sy(q[1])]);
      cx.save(); cx.lineJoin = cx.lineCap = 'round';
      cx.strokeStyle = dark ? 'rgba(210,225,220,.12)' : 'rgba(255,255,255,.55)'; cx.lineWidth = Math.max(3, 3*mpx); cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(...q) : cx.moveTo(...q)); cx.stroke();
      if (mpx > 1.2) { cx.fillStyle = '#ff7a1a'; for (const q of pts.slice(1, -1)) { cx.beginPath(); cx.arc(q[0], q[1], Math.max(1.2, 0.5*mpx), 0, 7); cx.fill(); } }   // a cone at each corner of the barriers
      cx.restore(); }
  }
  // the terminal ends of the buses: a stream between the door and a bus loading at the gate or unloading at arrivals
  const B = fxBays(), r = Math.max(1.4, 0.55*mpx);
  for (const v of VEH.list) {
    if (v.type !== 'bus' || !v.parked) continue;
    let from = null, to = null;
    if (v.fxGate && B.dep && S.t < v.fxGate.until - 15 && dist(v.x, v.y, ...B.dep.p) < 60*VM) { from = v.fxGate.door; to = [v.x, v.y]; }
    else if (v.job && v.job.k === 'shuttle' && B.arr && B.arr.door && dist(v.x, v.y, ...B.arr.p) < 15*VM && v.visitUntil && v.visitUntil - S.t > 100) { from = [v.x, v.y]; to = B.arr.door; }
    if (!from) continue;
    const A = [sx(from[0]), sy(from[1])], Z = [sx(to[0]), sy(to[1])], Lm = dist(...from, ...to)/VM, gap = 1.6;
    for (let u = (S.t*1.4) % gap; u < Lm; u += gap) { const f = u/Lm, id = Math.floor(S.t*1.4/gap - u/gap);
      cx.fillStyle = PAX_COL[((id*7) % 10 + 10) % 10]; cx.beginPath(); cx.arc(A[0] + (Z[0] - A[0])*f, A[1] + (Z[1] - A[1])*f, r, 0, 7); cx.fill(); }
  }
  // the bays themselves, marked on the apron
  if (V.scale > 900) for (const [k, b] of [['BUS GATE', B.dep], ['ARRIVALS', B.arr]]) { if (!b) continue;
    const X = sx(b.p[0]), Y = sy(b.p[1]); cx.save(); cx.translate(X, Y); cx.rotate((b.h + 90)*D2R);
    cx.strokeStyle = dark ? 'rgba(230,236,232,.55)' : 'rgba(255,255,255,.9)'; cx.lineWidth = Math.max(1, 0.25*mpx); cx.setLineDash([2*mpx, 1.5*mpx]); cx.strokeRect(-2*mpx, -8*mpx, 4*mpx, 30*mpx); cx.restore();
    cx.font = `600 9px ${FONT_D}`; cx.textAlign = 'center'; cx.fillStyle = dark ? 'rgba(190,212,206,.7)' : 'rgba(30,45,65,.7)'; cx.fillText(k, X, Y - 9*mpx - 4); cx.textAlign = 'left'; }
}
{ const df = fxDrawField; fxDrawField = function(){ df(); if (fxField()) fxDrawPaxWays(V.scale/1852); }; }

// ═════════ helicopters and VFR transits: seen further out, with their route ═════════
// They show 14 NM beyond the point where they call, flying in (grey, not on frequency yet), and every VFR flight shows
// where it means to go as a dashed line: in to its calling point, across the zone, out the far side (vfr.js).
APT.vfrLead = 14; APT.vfrRoutes = true;

// ═════════ local light aircraft: circuits, touch-and-goes and the taxi ═════════
// Club and training aircraft from the southside apron (the hangars at the south end of Juliett): they call for taxi
// for circuits, taxi, line up and go like any departure (TAXI, LU, CTO), then fly the visual circuit to the south of the
// runway at 1,000 ft above the field, calling downwind and final. On final each needs a clearance:
//   TG    cleared touch and go          CTL   cleared to land (a full stop)      GA    go around
//   RF    number in traffic, report final (answers the downwind call)            FS    make the next one a full stop
//   EXT   extend downwind (until BASE)  BASE  turn base now
//   ORB   orbit (a 360, away from the runway; ORBL / ORBR to say which way), then carry on
//   DEAD  route to the deadside (north of the runway) and orbit there; REJOIN brings it back, crosswind
//   PILS  approve a practice ILS (instrument students ask now and then on downwind); NEG continue in the circuit
//   LOW   cleared low approach (the practice ILS ends in a go-around at about 200 ft)
// Without a clearance at a quarter of a mile they go around. They fit themselves in behind airline traffic on final
// (extending downwind until it has passed), and a few circuits later make a full stop, vacate and ask to taxi back to
// the southside (TAXI H1). Only in VMC (5 km, cloud 1,500 ft) and daylight; they make a full stop if it closes in.
Object.assign(TYPES, {
  C172: { name: 'Cessna 172', wake: 'L', vapp: 65, vr: 55, climb: 700, desc: 500, cruise: 110, span: 11.0, len: 8.3, shape: 'prop' },
  PA28: { name: 'Piper PA-28', wake: 'L', vapp: 70, vr: 60, climb: 700, desc: 500, cruise: 115, span: 10.7, len: 7.3, shape: 'prop' },
  DA40: { name: 'Diamond DA40', wake: 'L', vapp: 70, vr: 59, climb: 750, desc: 500, cruise: 125, span: 11.9, len: 8.0, shape: 'prop' }
});
Object.assign(FX_TODR, { C172: 500, PA28: 560, DA40: 460 });
const GA = { next: 0, regs: new Set(), home: 'n7', ihp: 'H1', side: -1, W: 1850, H: 1000 };   // side: -1 south of the runway; W: downwind 1 NM out
{ const sp = spoken; spoken = cs => GA.regs.has(cs) ? ['Golf', ...cs.slice(1).split('').map(phonetic)].join(' ') : sp(cs); }   // G-ABCD: "Golf Alfa Bravo Charlie Delta"
const gaVmc = () => S.wx && S.wx.vis >= 5000 && S.wx.ceil >= 1500 && (S.wx.gust || S.wx.spd) < 25;
const gaDay = () => { const h = new Date(S.start + S.t*1000).getUTCHours(); return h >= 7 && h < 20; };
const gaElev = () => (typeof ELEV !== 'undefined' ? +ELEV : 0) || 600;
function gaSpawn(){
  const n = GN[GA.home], n2 = GN.n8; if (!n || !n2) return;
  const gate = (S.acs.find(a => a.kind === 'DEP' && a.gate) || S.sched.find(f => f.k === 'DEP' && f.gate) || {}).gate; if (!gate) return;
  let cs; do { cs = 'G' + 'ABCDEFGHJKLMNOPRSTUVWXYZ'.split('').sort(() => Math.random() - 0.5).slice(0, 4).join(''); } while (S.acs.some(a => a.cs === cs));
  const t = ['C172', 'PA28', 'DA40', 'C172'][Math.floor(Math.random()*4)];
  const ac = new Aircraft({ cs, t, d: 'CCT', o: APT.icao, gate, m: 0 });
  Object.assign(ac, { kind: 'DEP', freq: 'TWR', ground: true, state: 'READY', leftStand: true, pushed: false, reqAt: Infinity, readyAt: Infinity, fxGA: true,
    x: n.p[0], y: n.p[1], hdg: brg(...n.p, ...n2.p), fxCct: { leg: null, left: 2 + Math.floor(Math.random()*4), clr: null, n: 0, ifr: Math.random() < 0.4 } });
  ac.alt = gElev(ac); GA.regs.add(ac.cs); S.acs.push(ac); emit('spawn', ac);
  ac.need = 'Ready to taxi';
  pilot(ac, `${(typeof EGGD !== 'undefined' && EGGD.UNITS && EGGD.UNITS.gnd && EGGD.UNITS.gnd.name) || APT.tower[0]}, ${spoken(ac.cs)}, ${typeSay(t) === t ? TYPES[t].name : typeSay(t)} at the southside, information ${phonetic(S.atis)}, request taxi for circuits`);
}
// the runway frame for the circuit: a point a metres along the landing direction from the threshold, o metres off the centreline (north +)
function gaFrame(){
  const rw = S.rwy, R = rwyOf(rw), dir = rw === R.lo ? 1 : -1, thr = R.thr ? R.thr[rw] : (dir > 0 ? THR_LO_M : THR_HI_M), L = R.len || RWY_M;
  return { rw, R, dir, end: dir > 0 ? L - thr : thr, P: (a, o) => R.rm(thr + dir*a, o), A: q => (R.mOf(q) - thr)*dir, O: q => R.offOf(q) };
}
S.listeners.push((ev, ac) => {
  if (ev === 'start') { GA.next = 0; GA.regs.clear(); }
  if (ev === 'airborne' && ac && ac.fxGA && ac.fxCct) { const c = ac.fxCct; c.leg = 'UP'; c.n++; ac.mode = 'FXCCT'; ac.freq = 'TWR'; ac.need = null; ac.cto = false; ac.tgtAlt = ac.cleared = gaElev() + GA.H; ac.onSid = false; }
});
// circuit legs: UP (climb out past the end), CROSS (out to the downwind line), DOWN, BASE, FINAL, ROLL (a touch and go)
function fxCctStep(ac, dt){
  const c = ac.fxCct, F = gaFrame(), E = gaElev(), Hc = E + GA.H, P = ac.perf, W = GA.side*GA.W;
  const a = F.A([ac.x, ac.y]), o = F.O([ac.x, ac.y]);
  let tgt, alt = Hc, spd = 85;
  if (c.leg === 'ROLL') {   // the touch and go: down, along the runway, power on and away
    ac.onRwy = true; ac.rwyId = F.R.id; ac.alt = F.R.elev ? (F.R.elev[F.rw] || E) : E;
    c.roll = (c.roll || 0) + dt; ac.ias = c.roll < 7 ? Math.max(42, ac.ias - 3.5*dt) : ac.ias + 4*dt; ac.gs = ac.ias; ac.hdg = crsOf(F.rw);
    const mv = ac.ias/3600*dt; ac.x += Math.sin(ac.hdg*D2R)*mv; ac.y += Math.cos(ac.hdg*D2R)*mv;
    if (c.roll > 7 && ac.ias >= P.vr) { ac.onRwy = false; c.roll = 0; c.leg = 'UP'; c.n++; ac.alt += 10; }
    return;
  }
  // an orbit (ORB, or holding on the deadside): rate one round, height held, then on with the leg it was on
  if (c.orbit) {
    const O = c.orbit, turn = 3*dt; O.deg += turn; ac.hdg = norm(ac.hdg + O.dir*turn);
    ac.ias += clamp(80 - ac.ias, -3*dt, 3*dt); ac.gs = ac.ias; ac.vs = 0; ac.alt += clamp((O.alt || ac.alt) - ac.alt, -P.desc/60*dt, P.climb/60*dt);
    const mv = ac.gs/3600*dt; ac.x += Math.sin(ac.hdg*D2R)*mv; ac.y += Math.cos(ac.hdg*D2R)*mv; ac.trk = ac.hdg;
    if (O.deg >= 360 && !O.hold) { c.orbit = null; pilot(ac, 'orbit complete'); }
    return;
  }
  if (c.leg === 'DEAD') { tgt = F.P(F.end*0.5, -W); alt = Hc; if (dist(ac.x, ac.y, ...tgt) < 0.25) { c.orbit = { deg: 0, dir: -GA.side*(F.dir), hold: true, alt: Hc }; if (!c.deadTold) { c.deadTold = true; pilot(ac, 'deadside, orbiting'); } } }
  if (c.leg === 'PIOUT') {   // out for the practice ILS: away on the circuit side, 2,000 ft above the field, to about 6 NM, then in on the localiser
    tgt = F.P(-12500, W); alt = E + 2000; spd = 95;
    if (a < -11000) { c.leg = 'BASE'; c.pi = true; }
  }
  if (c.leg === 'UP') { tgt = F.P(F.end + 900, 0); alt = Hc; if (a > F.end + 600 && ac.alt > E + 450) c.leg = 'CROSS'; }
  if (c.leg === 'CROSS') { tgt = F.P(F.end + 900, W); if (Math.abs(o - W) < 250) { c.leg = 'DOWN'; c.called = false; } }
  if (c.leg === 'DOWN') {
    tgt = F.P(-6000, W);
    if (!c.called && a < F.end*0.7) { c.called = true; const fs = c.left <= 0 || !gaVmc() || !gaDay();
      if (fs) c.left = 0;
      if (!fs && c.ifr && c.n >= 2 && !c.piAsked) { c.piAsked = true; ac.need = 'Request practice ILS'; pilot(ac, `downwind, request a practice ILS approach runway ${F.rw}`); }
      else { ac.need = 'Downwind'; pilot(ac, `downwind${fs ? ', full stop' : ', touch and go'}`); } }
    if (c.wantPi) { c.wantPi = false; c.leg = 'PIOUT'; ac.need = null; }
    // fit in behind airline traffic: extend while one is on final inside 4.5 NM and not yet past us
    // (an airliner inside 7 NM gets there before a base and final are flown, about two minutes: wait for it to pass)
    const ifr = S.acs.find(x => x !== ac && x.airborne && x.mode === 'FINAL' && x.app === F.rw && x.state !== 'MISSED' && typeof finalDist === 'function' && finalDist(x) < 7 && finalDist(x) > 0.6)
      || S.acs.find(x => x !== ac && x.fxCct && (x.fxCct.leg === 'BASE' || (x.fxCct.leg === 'FINAL' && F.A([x.x, x.y]) < -200)));   // another club aircraft turning in ahead
    if (ifr && !c.ext && !c.toldExt && a < -800) { c.toldExt = ifr.cs; pilot(ac, `extending downwind, traffic in sight, the ${ifr.fxGA ? TYPES[ifr.t].name : typeSay(ifr.t)} ${ifr.fxCct && ifr.fxCct.leg === 'BASE' ? 'on base' : 'on final'}`); }
    const turn = a < -1300 && !c.ext && !(ifr && a > -5500);
    if ((turn || a < -6000) && c.leg === 'DOWN') { c.leg = 'BASE'; c.toldExt = null; if (ac.need === 'Request practice ILS') { ac.need = null; pilot(ac, 'continuing in the circuit'); } }
  }
  if (c.leg === 'BASE') { tgt = F.P(Math.min(a, -1300) - 300, 0); alt = c.pi ? E + 2000 : E + 600; spd = c.pi ? 95 : spd;
    if (Math.abs(o) < 300) { c.leg = 'FINAL';
      if (c.pi) { ac.need = 'Final, practice ILS'; pilot(ac, `established ILS runway ${F.rw}, practice approach, low approach and go around`); }
      else if (!c.clr) { ac.need = c.left <= 0 ? 'Final, full stop' : 'Final, touch and go'; pilot(ac, `final${c.left <= 0 ? ', full stop' : ', touch and go'}`); } } }
  if (c.leg === 'FINAL') {
    tgt = F.P(Math.max(a + 400, 150), 0); spd = c.pi && a < -3700 ? P.vapp + 20 : P.vapp; alt = E + Math.max(0, -a)*0.0524*3.281 + 15;
    // a practice ILS with an airliner catching up behind on the same final (within 2.5 NM and closing): break off to the
    // circuit side and rejoin crosswind, before it is a near miss
    if (c.pi) { const me = -a/1852, chase = S.acs.find(x => x !== ac && !x.fxGA && x.airborne && x.mode === 'FINAL' && x.app === F.rw && typeof finalDist === 'function' && finalDist(x) > me && finalDist(x) - me < 2.5 && (x.gs || 140) > ac.gs);
      if (chase && a < -1500) { c.pi = false; c.piDone = true; c.clr = null; ac.need = null; c.leg = 'CROSS'; pilot(ac, `breaking off the practice approach to the ${GA.side < 0 ? 'south' : 'north'}, traffic behind, rejoining crosswind`); return; } }
    // a practice ILS cleared for a low approach: around at about 200 ft, back into the circuit
    if (c.clr === 'LOW' && a > -1100) { c.clr = null; c.pi = false; c.piDone = true; ac.need = null; c.leg = 'UP'; pilot(ac, 'going around, practice approach complete, rejoining the circuit'); return; }
    const occ = S.acs.some(x => x !== ac && x.onRwy && (x.rwyId || RWYS[0].id) === F.R.id) || (typeof vehOnRwy === 'function' && vehOnRwy(F.rw));
    if (a > -420 && (!c.clr || occ)) { c.pi = false; return gaAround(ac, !c.clr ? 'no clearance' : 'runway occupied'); }
    if (a > 120) {   // touchdown
      if (c.clr === 'LAND') return gaLand(ac, F);
      c.leg = 'ROLL'; c.clr = null; c.left--; ac.need = null; return;
    }
  }
  // fly it: turn towards the target (standard rate and a bit), speed and level by the leg
  const want = brg(ac.x, ac.y, ...tgt), d = angDiff(ac.hdg, want);
  ac.hdg = norm(ac.hdg + clamp(d, -5*dt, 5*dt));
  ac.ias += clamp(spd - ac.ias, -3*dt, 3*dt); ac.gs = ac.ias;
  const vs = alt > ac.alt ? P.climb : -P.desc, dz = alt - ac.alt; ac.vs = Math.abs(dz) < 20 ? 0 : vs; ac.alt += clamp(dz, -P.desc/60*dt, P.climb/60*dt);
  const mv = ac.gs/3600*dt; ac.x += Math.sin(ac.hdg*D2R)*mv; ac.y += Math.cos(ac.hdg*D2R)*mv; ac.trk = ac.hdg;
}
function gaAround(ac, why){
  const c = ac.fxCct; c.leg = 'UP'; c.clr = null; ac.need = null; ac.onRwy = false;
  pilot(ac, `going around${why ? ', ' + why : ''}`);
  if (why === 'no clearance' && seatOf(ac) && !aiOwns(ac)) { S.score.pts -= 5; sys(`${ac.cs} went around: no clearance on final (−5).`); }
}
// a full stop: handed to the engine as a landing roll, then off the runway and back to the southside
function gaLand(ac, F){
  const R = F.R; Object.assign(ac, { ground: true, onRwy: true, rwyId: R.id, state: 'ROLLOUT', mode: 'GROUND', vs: 0, kind: 'ARR', app: null, ctl: false, rollDir: F.dir, need: null });
  ac.alt = R.elev ? (R.elev[F.rw] || gaElev()) : gaElev(); ac.hdg = crsOf(F.rw); ac.ias = Math.min(ac.ias, 50); ac.fxCct.leg = null; ac.fxCct.done = true;
  // off to the south, the side the southside is on: the first south exit it can make
  const sx_ = Object.keys(HOLDS).filter(k => HOLDS[k].off < 0 && String(HOLDS[k].dirs || '').split(',').includes(F.rw) && GN[HOLDS[k].node]);
  try { const ok = sx_.filter(k => { const c = exitCheck(ac, k); return c && c.ok && !c.back; }).sort((x, y) => exitCheck(ac, x).ahead - exitCheck(ac, y).ahead); if (ok.length) { ac.reqExit = ok[0]; planVac(ac); } } catch (e) {}
  emit('landed', ac);
}
{ const pv = PH.vacated; if (pv) PH.vacated = ac => ac.fxGA ? `runway vacated via ${PHON[ac.exit] || String(ac.exit).replace(/~\d+$/, '')}, request taxi to the southside` : pv(ac); }
{ const pc = PH.cto; if (pc) PH.cto = (ac, sid, chg) => ac.fxGA ? [`runway ${depRw(ac)}, cleared for take-off, ${GA.side < 0 === (depRw(ac) === rwyOf(depRw(ac)).lo) ? 'right' : 'left'} hand circuit`, `cleared for take-off runway ${depRw(ac)}, ${GA.side < 0 === (depRw(ac) === rwyOf(depRw(ac)).lo) ? 'right' : 'left'} hand`] : pc(ac, sid, chg); }
function fxCctCmd(ac, t, said, reads){
  const c = ac.fxCct, F = gaFrame(), w = S.wx, wind = w.vrb ? `variable ${w.spd} knots` : `${hdg3(w.dir)} degrees ${w.spd} knots`;
  const num = () => 1 + S.acs.filter(x => x !== ac && x.airborne && ((x.mode === 'FINAL' && x.app === F.rw && finalDist(x) < 6) || (x.fxCct && x.fxCct.leg === 'FINAL') || (x.fxCct && x.fxCct.leg === 'BASE'))).length;
  if (t === 'TG' && c.left > 0) { c.clr = 'TG'; ac.need = null; said.push(`runway ${F.rw}, cleared touch and go, surface wind ${wind}`); reads.push(`cleared touch and go runway ${F.rw}`); return true; }
  if (t === 'CTL' || t === 'LAND' || (t === 'TG' && c.left <= 0)) { c.clr = 'LAND'; c.left = 0; ac.need = null; said.push(`runway ${F.rw}, cleared to land, surface wind ${wind}`); reads.push(`cleared to land runway ${F.rw}`); return true; }
  if (t === 'GA') { said.push('go around'); reads.push('going around'); gaAround(ac, null); return true; }
  if (t === 'RF') { const n = num(); ac.need = null; said.push(`number ${NUM_WORD[n] || n}${n > 1 ? ', follow the traffic ahead' : ''}, report final`); reads.push(`number ${NUM_WORD[n] || n}, wilco`); return true; }
  if (t === 'FS') { c.left = 0; said.push('make this a full stop'); reads.push('full stop'); return true; }
  if (t === 'EXT' && c.leg === 'DOWN') { c.ext = true; said.push("extend downwind, I'll call your base"); reads.push('extending downwind'); return true; }
  if (t === 'BASE' && (c.leg === 'DOWN' || c.leg === 'CROSS')) { c.ext = false; c.leg = 'BASE'; said.push('turn base now'); reads.push('turning base'); return true; }
  if (/^ORB[LR]?$/.test(t) && c.leg !== 'FINAL') {   // a 360: away from the runway unless told which way
    const right = [Math.cos(ac.hdg*D2R), -Math.sin(ac.hdg*D2R)], away = Math.abs(F.O([ac.x + right[0]*0.06, ac.y + right[1]*0.06])) > Math.abs(F.O([ac.x, ac.y])) ? 1 : -1;
    const dir = t === 'ORBL' ? -1 : t === 'ORBR' ? 1 : away, w = dir > 0 ? 'right' : 'left';
    c.orbit = { deg: 0, dir, alt: ac.alt }; said.push(`orbit ${w}, report complete`); reads.push(`orbit ${w}, wilco`); return true; }
  if (t === 'DEAD') { c.orbit = null; c.leg = 'DEAD'; c.deadTold = false; ac.need = null; said.push(`route to the deadside, ${Math.round((gaElev() + GA.H)/100)*100} feet, orbit there, I'll call you back`); reads.push('deadside, wilco'); return true; }
  if (t === 'REJOIN' && (c.leg === 'DEAD' || c.orbit)) { c.orbit = null; c.leg = 'CROSS'; said.push('rejoin the circuit crosswind, report downwind'); reads.push('rejoining crosswind'); return true; }
  if (t === 'PILS' && (ac.need === 'Request practice ILS' || c.leg === 'DOWN')) { c.wantPi = true; c.orbit = null; said.push(`practice ILS runway ${F.rw} approved, fly downwind, climb to ${altWords(Math.round((gaElev() + 2000)/100)*100)}, report established`); reads.push('practice ILS approved, wilco'); return true; }
  if (t === 'NEG' && ac.need === 'Request practice ILS') { ac.need = null; said.push('negative, no practice approaches at this time, continue in the circuit'); reads.push('continuing in the circuit'); return true; }
  if (t === 'LOW' && c.leg === 'FINAL') { c.clr = 'LOW'; ac.need = null; said.push(`runway ${F.rw}, cleared low approach, not below 200 feet, surface wind ${wind}`); reads.push('cleared low approach'); return true; }
  if (!aiCtx) sys(`${ac.cs} is in the circuit: TG, CTL, GA, RF, FS, EXT / BASE, ORB (orbit), DEAD (deadside) / REJOIN, PILS / NEG, LOW.`);
  return true;
}
// separation: circuit traffic is not radar-separated from the airliners (Class D: traffic information); only a real
// near miss counts
{ const so = APT.sepOk; APT.sepOk = (a, b, d) => { if ((a.fxCct && a.fxCct.leg) || (b.fxCct && b.fxCct.leg)) return d > 0.35 || Math.abs(a.alt - b.alt) > 300; return so ? so(a, b, d) : false; }; }
// the AI controllers work them too
if (typeof aiTower === 'function') { const at = aiTower; aiTower = function(ac){
  if (ac.fxCct && ac.fxCct.leg && ac.airborne) { const n = ac.need || '', F = gaFrame();
    if (n === 'Downwind' && aiDue(ac, n + ac.fxCct.n, 2, 5)) return aiDo('TWR', ac, 'RF');
    // a practice ILS only with nothing inbound inside 20 NM (it is slow down the final): otherwise no
    if (n === 'Request practice ILS' && aiDue(ac, n, 3, 6)) return aiDo('TWR', ac, S.acs.some(x => x.kind === 'ARR' && x.airborne && x.state !== 'PRE' && !x.fxGA && Math.hypot(x.x - RADAR_REF[0], x.y - RADAR_REF[1]) < 20) ? 'NEG' : 'PILS');
    if (n === 'Final, practice ILS' && aiDue(ac, n, 2, 5)) return aiDo('TWR', ac, 'LOW');
    if (/^Final/.test(n) && aiDue(ac, n + ac.fxCct.n, 2, 4)) {
      const me = F.A([ac.x, ac.y]), busy = S.acs.some(x => x !== ac && (x.onRwy || (x.airborne && x.mode === 'FINAL' && x.app === F.rw && finalDist(x) < 3) || ['LINEUP', 'LINEDUP', 'TAKEOFF'].includes(x.state) || (x.fxCct && x.fxCct.leg === 'FINAL' && F.A([x.x, x.y]) > me)));
      return busy ? null : aiDo('TWR', ac, n === 'Final, full stop' ? 'CTL' : 'TG'); }
    return; }
  return at(ac); }; }
if (typeof aiGround === 'function') { const ag = aiGround; aiGround = function(ac){
  if (ac.fxGA && ac.kind === 'ARR') { if (/^(Request taxi|Needs a stand)$/.test(ac.need || '') && aiDue(ac, 'gahome', 3, 7)) aiDo('GND', ac, `TAXI ${GA.ihp}`); return; }
  return ag(ac); }; }
function gaStep(){
  if (!S.running || EXERCISES[S.mode]) return;
  if (!GA.next) GA.next = S.t + rnd(90, 420);
  if (S.t >= GA.next) { GA.next = S.t + rnd(18, 35)*60; if (gaVmc() && gaDay() && S.acs.filter(a => a.fxGA).length < 2) gaSpawn(); }
  for (const ac of S.acs.slice()) {
    if (!ac.fxGA) continue;
    // back at the southside after a full stop: parked, off the frequency
    if (ac.kind === 'ARR' && ac.stand) { if (ac.stand.occ === ac) ac.stand.occ = null; ac.stand = null; }   // no airline stand for it: it goes home to the southside
    if (ac.kind === 'ARR' && ac.ground && !ac.onRwy && (ac.need === `Holding at ${GA.ihp}` || (!ac.path && GN.n45 && dist(ac.x, ac.y, ...GN.n45.p) < 0.03))) { ac.gaHome ??= S.t;
      if (S.t - ac.gaHome > 20) { pilot(ac, 'parking at the southside, thanks for your help'); GA.regs.delete(ac.cs); S.acs = S.acs.filter(x => x !== ac); if (S.sel === ac) S.sel = null; } }   // parked: gone quietly, not "removed"
    if (ac.kind === 'ARR' && ac.need === 'Needs a stand') ac.need = 'Request taxi';
    if (ac.kind === 'ARR' && ac.need === 'Request taxi' && !ac.gaHint && seatOf(ac) && !aiOwns(ac)) { ac.gaHint = true; sys(`${ac.cs} wants the southside: ${ac.cs} TAXI ${GA.ihp}.`); }
  }
}
{ const fs = fxStep; fxStep = function(dt){ fs(dt); gaStep(); }; }
// the circuit drawn faintly for each one flying it, the leg it is on brighter
function fxDrawCct(){
  const L = S.acs.filter(a => a.fxCct && a.fxCct.leg && a.airborne); if (!L.length || V.scale < 25) return;
  const F = gaFrame(), W = GA.side*GA.W, pts = [[-300, 0], [F.end + 900, 0], [F.end + 900, W], [-1300, W], [-1600, 0], [150, 0]].map(([a, o]) => F.P(a, o));
  cx.save(); cx.strokeStyle = C.name === 'dark' ? 'rgba(199,166,255,.38)' : 'rgba(110,70,180,.4)'; cx.lineWidth = 1.2; cx.setLineDash([7, 6]);
  cx.beginPath(); pts.forEach((q, i) => cx[i ? 'lineTo' : 'moveTo'](sx(q[0]), sy(q[1]))); cx.stroke();
  if (L.some(a => ['PIOUT'].includes(a.fxCct.leg) || a.fxCct.pi)) {   // the practice ILS: out to 6 NM and in on the localiser
    cx.beginPath(); [[-1300, W], [-11500, W], [-11500, 0], [0, 0]].map(([a, o]) => F.P(a, o)).forEach((q, i) => cx[i ? 'lineTo' : 'moveTo'](sx(q[0]), sy(q[1]))); cx.stroke(); }
  if (L.some(a => a.fxCct.leg === 'DEAD')) { const q = F.P(F.end*0.5, -W); cx.setLineDash([3, 4]); cx.beginPath(); cx.arc(sx(q[0]), sy(q[1]), Math.max(8, 830/1852*V.scale), 0, 7); cx.stroke(); }
  cx.restore();
}
{ const df = fxDrawField; fxDrawField = function(){ df(); fxDrawCct(); }; }

// one tap on the strip for the circuit calls
if (typeof stripNext === 'function') { const sn = stripNext; stripNext = function(ac){
  if (ac && ac.fxCct && ac.fxCct.leg && ac.airborne && !aiOwns(ac)) { const n = ac.need || '';
    if (n === 'Request practice ILS') return { cmd: 'PILS', label: 'Approve ILS' }; if (n === 'Final, practice ILS') return { cmd: 'LOW', label: 'Low approach' };
    if (ac.fxCct.leg === 'DEAD') return { cmd: 'REJOIN', label: 'Rejoin' };
    return n === 'Downwind' ? { cmd: 'RF', label: 'Report final' } : n === 'Final, touch and go' ? { cmd: 'TG', label: 'Touch & go' } : n === 'Final, full stop' ? { cmd: 'CTL', label: 'Land' } : null; }
  if (ac && ac.fxGA && ac.kind === 'ARR' && ac.need === 'Request taxi' && !aiOwns(ac)) return { cmd: `TAXI ${GA.ihp}`, label: 'Taxi home' };
  return sn(ac); }; }

// no airline stand for a club aircraft after a full stop, and off the runway to the south, the southside's side
if (typeof planStand === 'function') { const ps_ = planStand; planStand = function(ac){ if (ac && ac.fxGA) return; return ps_.apply(this, arguments); }; }
{ const vp = APT.vacPrefs; if (vp) APT.vacPrefs = (st, ac) => { const L = vp(st, ac) || [];
  if (!(ac && ac.fxGA)) return L; const south = Object.keys(HOLDS).filter(k => HOLDS[k].off < 0 && FIL[k]); return [...south, ...L.filter(k => !south.includes(k))]; }; }

// the AI Tower keeps departures off the runway while a club aircraft cleared for a touch and go (or to land) is on
// short final or rolling, as it would for any arrival
if (typeof aiDepart === 'function') { const ad = aiDepart; aiDepart = function(ac){
  const F = gaFrame(), g = S.acs.find(x => x.fxCct && x.airborne && ((x.fxCct.leg === 'FINAL' && x.fxCct.clr && F.A([x.x, x.y]) > -2600) || x.fxCct.leg === 'ROLL'));
  if (g && ac.state !== 'LINEDUP') { ac.aiWhy = `${g.cs} on final for a ${g.fxCct.clr === 'LAND' ? 'full stop' : 'touch and go'}`; return; }
  // a club aircraft departing: two minutes' wake gap behind a medium jet, and slow away, so it only goes into a real
  // gap. Not lined up with an airliner inside 6 NM; caught lined up with one inside 3 NM, it vacates and waits
  if (ac.fxGA && typeof arrNear === 'function') { const A = arrNear(rwyOf(depRw(ac)), ac);
    if (ac.state === 'HOLDPT' && A.nm < 6) { ac.aiWhy = `waiting for a gap after the arrival ${A.nm.toFixed(1)} NM out`; return; }
    if (ac.state === 'LINEDUP' && A.nm < 3 && !ac.vacq && depExits(ac).length) { ac.aiWhy = 'off the runway for the arrival'; return aiDo('TWR', ac, 'VAC'); } }
  return ad(ac); }; }
