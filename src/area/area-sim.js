// ═════════════════════════ Clearway Area Control · the simulation ═════════════════════════
// Every aircraft flies its route at its own performance: climbs and descents by type and level, IAS then Mach, the upper
// wind, rate-one turns at airline bank angles, racetrack holds. Each one belongs to a unit: you, an AI controller next
// door, or (live traffic you don't work) the real world. Flights about to enter your airspace are offered to you, call
// you when the next unit transfers them, and are yours until you transfer them on. Separation is 5 NM or 1,000 ft.

const S = { t: 0, start: Date.now(), running: false, paused: false, speed: 1, acs: [], sel: null, log: [], score: 0, stats: {}, coord: [], events: [],
  conflicts: new Map(), stca: new Set(), listeners: [], seq: 0, mode: 'live', wdir: 255, wkt: 0, airports: {}, flowRegs: [], cbs: [], turb: [], opts: {} };
const emit = (ev, d) => { for (const f of S.listeners) try { f(ev, d); } catch (e) { console.error(e); } };
const simMs = () => S.start + S.t*1000;
const zHM = ms => new Date(ms).toISOString().slice(11, 16);
const zHMS = ms => new Date(ms).toISOString().slice(11, 19);

// ── aircraft performance ──
const HEAVY = /^(A33|A34|A35|A38|B74|B76|B77|B78|MD11|IL96|A30|C17|K35|A400|A3ST)/;
const PROP = /^(AT4|AT7|DH8|SF3|JS4|B190|BE20|BE9|C208|PC12|D328|L410|F50|SW4|E120|C130|P3)/;
const BIZ = /^(C25|C5|C6|C7|CL3|CL6|GL|GLF|F2TH|F900|FA|E35|E55|LJ|H25|PC24|PRM1)/;
const famOf = t => HEAVY.test(t) ? 'heavy' : PROP.test(t) ? 'prop' : BIZ.test(t) ? 'biz' : 'jet';
const PERF = {
  jet:   { mach: .78, ias: 290, clb: [2600, 2100, 1600, 900], des: 2300, ceil: 39000, rfl: [33000, 38000] },
  heavy: { mach: .84, ias: 300, clb: [2200, 1800, 1300, 800], des: 2200, ceil: 41000, rfl: [34000, 40000] },
  biz:   { mach: .80, ias: 280, clb: [3200, 2800, 2200, 1500], des: 2600, ceil: 45000, rfl: [37000, 43000] },
  prop:  { mach: .45, ias: 220, clb: [1500, 1200, 800, 500], des: 1500, ceil: 25000, rfl: [17000, 25000] }
};
const isaT = alt => alt < 36089 ? 288.15 - 0.0019812*alt : 216.65;
const sound = alt => 38.967*Math.sqrt(isaT(alt));
const tasFromIas = (ias, alt) => ias*(1 + alt/1000*0.02);
const machOf = (tas, alt) => tas/sound(alt);
// the upper wind: westerly, stronger with height (S.wdir/S.wkt set it at FL300)
function windAt(alt){ const k = clamp(alt/30000, 0.15, 1.25); return { dir: S.wdir + (1 - k)*-25, kt: S.wkt*k }; }
function climbRate(ac){ const c = PERF[ac.fam].clb, a = ac.alt; return (a < 10000 ? c[0] : a < 25000 ? c[1] : a < 33000 ? c[2] : c[3])*(ac.heavyLoad || 1); }
function tasTarget(ac){
  const P = PERF[ac.fam];
  if (ac.spd && ac.spd.k === 'M') return ac.spd.v*sound(ac.alt);
  if (ac.spd && ac.spd.k === 'K') return tasFromIas(ac.spd.v, ac.alt);
  const ias = ac.alt < 10000 ? 250 : (ac.hold ? Math.min(P.ias, 240) : P.ias), m = ac.hold ? P.mach - .03 : P.mach;
  return Math.min(tasFromIas(ias, ac.alt), m*sound(ac.alt));
}
const iasOf = ac => ac.tas/(1 + ac.alt/1000*0.02);

let ACN = 0;
class Aircraft {
  constructor(o){
    Object.assign(this, { id: ++ACN, cs: o.cs, t: o.t || 'A320', dep: o.dep, arr: o.arr, la: o.la, lo: o.lo, alt: o.alt || 0, vs: 0,
      hdg: o.hdg || 0, trk: o.hdg || 0, tas: o.tas || 400, gs: o.tas || 400, cfl: o.cfl ?? o.alt, rfl: o.rfl || 35000,
      route: o.route || [], ri: o.ri || 1, mode: 'NAV', tgtHdg: null, turnDir: 0, spd: null, hold: null, track: [], need: null, needT: 0,
      owner: o.owner || 'L', st: o.st || 'AI', src: o.src || 'plan', live: o.live || null, sq: o.sq || String(1000 + Math.floor(Math.random()*6777)).replace(/[89]/g, '7'),
      sid: o.sid || null, star: o.star || null, holdFix: o.holdFix || null, real: o.real || null, born: S.t, reqs: {}, notes: [] });
    this.fam = famOf(this.t); this.rfl = Math.min(this.rfl, PERF[this.fam].ceil); if (this.cfl > PERF[this.fam].ceil) this.cfl = PERF[this.fam].ceil;
    this.wtc = this.fam === 'heavy' ? 'H' : this.fam === 'prop' || this.fam === 'biz' ? 'M' : 'M';
  }
  get mine(){ return this.st === 'MINE' || this.st === 'CALL'; }
}
const findAc = s => { s = String(s || '').toUpperCase(); if (!s) return null;
  return S.acs.find(a => a.cs === s) || (/^\d+[A-Z]?$/.test(s) ? S.acs.filter(a => a.mine || a.st === 'OFFER').find(a => a.cs.replace(/^[A-Z]+/, '') === s) || S.acs.find(a => a.cs.replace(/^[A-Z]+/, '') === s) : null); };

// ── where it is going ──
const nextPt = ac => ac.route[ac.ri] || null;
const lastPt = ac => ac.route[ac.route.length - 1];
// the distance still to fly along the route, and the time at each point ahead (for ETAs)
function distToGo(ac){
  let d = 0, p = [ac.la, ac.lo];
  for (let i = ac.ri; i < ac.route.length; i++) { const q = ac.route[i]; d += gcNM(p, q); p = q; }
  return d;
}
function etaTo(ac, i){ let d = 0, p = [ac.la, ac.lo]; for (let k = ac.ri; k <= i && k < ac.route.length; k++) { const q = ac.route[k]; d += gcNM(p, q); p = q; } return S.t + d/Math.max(150, ac.gs)*3600; }
const arrivesHere = ac => !!(ac.arr && APS[ac.arr] && inMap(apLL(ac.arr)));
// the level it should be at for its destination (3 NM a thousand feet, a little in hand) and where it starts down
const todNM = ac => (ac.alt - (APS[ac.arr] ? 1000 : 0))/1000*3.1 + 12;
// a level for the way it is going: odd levels eastbound, even westbound (above FL290 in 2,000 ft steps the other way)
function levelFor(course, fl){ const east = course < 180; let f = Math.round(fl/1000);
  if (f % 2 !== (east ? 1 : 0)) f += 1; return f*1000; }

// ── the step ──
function stepAc(ac, dt){
  // vertical
  const dz = ac.cfl - ac.alt;
  if (Math.abs(dz) > 20) {
    let rate = dz > 0 ? climbRate(ac) : PERF[ac.fam].des*(ac.emgDesc ? 2.4 : 1);
    if (ac.rate) rate = Math.min(rate*1.3, ac.rate);
    if (Math.abs(dz) < 1500) rate = Math.max(500, rate*Math.abs(dz)/1500);
    ac.vs = Math.sign(dz)*rate; ac.alt += ac.vs*dt/60;
    if (Math.sign(ac.cfl - ac.alt) !== Math.sign(dz)) { ac.alt = ac.cfl; ac.vs = 0; }
  } else { ac.alt = ac.cfl; ac.vs = 0; }
  if (ac.alt > PERF[ac.fam].ceil && ac.cfl > PERF[ac.fam].ceil) ac.cfl = PERF[ac.fam].ceil;
  // speed
  const tt = tasTarget(ac); ac.tas += clamp(tt - ac.tas, -1.2*dt, 1.2*dt);
  // lateral
  let tgt = ac.hdg, track = false;
  if (ac.mode === 'NAV') {
    const p = nextPt(ac);
    if (!p) { ac.mode = 'HDG'; ac.tgtHdg = ac.hdg; }
    else {
      const d = nm(ac.la, ac.lo, p[0], p[1]), b = crs(ac.la, ac.lo, p[0], p[1]);
      // turn early so the next leg is joined without overshooting (rate one at this speed)
      const q = ac.route[ac.ri + 1], rate = turnRate(ac), r = ac.tas/3600/(rate*D2R);
      const lead = q ? Math.min(12, r*Math.tan(Math.abs(angDiff(b, crs(p[0], p[1], q[0], q[1])))/2*D2R)) : 0.6;
      if (d < Math.max(0.6, lead) || (d < 6 && Math.abs(angDiff(ac.trk, b)) > 100)) {
        if (ac.holdAt && p[2] === ac.holdAt.fix) { startHold(ac, ac.holdAt); }
        else { ac.ri++; emit('fix', { ac, p }); }
      }
      tgt = b; track = true;
    }
  } else if (ac.mode === 'HDG') { tgt = ac.tgtHdg ?? ac.hdg; }
  else if (ac.mode === 'HOLD') { tgt = holdSteer(ac, dt); track = true; }
  const W = windAt(ac.alt), wx = -Math.sin(W.dir*D2R)*W.kt, wy = -Math.cos(W.dir*D2R)*W.kt;
  let hc = tgt;
  if (track) { const cw = wx*Math.cos(tgt*D2R) - wy*Math.sin(tgt*D2R); hc = norm(tgt - Math.asin(clamp(cw/Math.max(100, ac.tas), -0.4, 0.4))*R2D); }
  let diff = angDiff(ac.hdg, hc);
  if (ac.mode === 'HDG' && ac.turnDir && Math.abs(diff) > 5) diff = ac.turnDir > 0 ? (diff < 0 ? 360 + diff : diff) : (diff > 0 ? diff - 360 : diff);
  const tr = turnRate(ac)*dt; ac.hdg = norm(ac.hdg + clamp(diff, -tr, tr));
  if (ac.mode === 'HDG' && Math.abs(diff) < 2) ac.turnDir = 0;
  const vx = Math.sin(ac.hdg*D2R)*ac.tas + wx, vy = Math.cos(ac.hdg*D2R)*ac.tas + wy;
  ac.gs = Math.hypot(vx, vy); ac.trk = norm(Math.atan2(vx, vy)*R2D);
  const d = ac.gs*dt/3600; [ac.la, ac.lo] = moveLL(ac.la, ac.lo, ac.trk, d);
  if (S.t - (ac.trkT || -99) >= 8) { ac.trkT = S.t; ac.track.push([ac.la, ac.lo, ac.alt]); if (ac.track.length > 900) ac.track.splice(0, 300); }
}
const turnRate = ac => clamp(1091*Math.tan(25*D2R)/Math.max(150, ac.tas), 0.7, 3);
// a racetrack: inbound to the fix, turn outbound, a minute and a half above FL140, turn back in (right turns unless left)
function startHold(ac, H){
  ac.mode = 'HOLD'; ac.holdAt = null;
  const p = FIXP[H.fix] || [ac.la, ac.lo];
  ac.hold = { fix: H.fix, c: [p[0], p[1]], inb: H.inb ?? ac.trk, left: !!H.left, ph: 'turn1', t: 0, efc: H.efc || null, since: S.t, laps: 0 };
  emit('hold', ac);
}
function holdSteer(ac, dt){
  const h = ac.hold; h.t += dt; const leg = ac.alt > 14000 ? 90 : 60, dirn = h.left ? -1 : 1;
  if (h.ph === 'in') { const d = nm(ac.la, ac.lo, h.c[0], h.c[1]); if (d < 0.8) { h.ph = 'turn1'; h.t = 0; h.laps++; } return crs(ac.la, ac.lo, h.c[0], h.c[1]); }
  if (h.ph === 'turn1') { if (Math.abs(angDiff(ac.hdg, h.inb + 180)) < 10) { h.ph = 'out'; h.t = 0; } return norm(ac.hdg + 60*dirn); }
  if (h.ph === 'out') { if (h.t > leg) { h.ph = 'turn2'; h.t = 0; } return norm(h.inb + 180); }
  if (h.ph === 'turn2') { if (Math.abs(angDiff(ac.hdg, crs(ac.la, ac.lo, h.c[0], h.c[1]))) < 20) h.ph = 'in'; return norm(ac.hdg + 60*dirn); }
  return ac.hdg;
}
// back on its own navigation from wherever it is: the next point ahead on its route
function rejoin(ac){
  let bi = ac.ri, bd = Infinity;
  for (let i = Math.max(1, ac.ri - 1); i < ac.route.length; i++) {
    const p = ac.route[i], d = nm(ac.la, ac.lo, p[0], p[1]), ahead = Math.abs(angDiff(ac.trk, crs(ac.la, ac.lo, p[0], p[1]))) < 100;
    if (ahead && d < bd + (i - ac.ri)*3) { bd = d; bi = i; break; }
  }
  ac.ri = Math.min(bi, ac.route.length - 1); ac.mode = 'NAV'; ac.hold = null; ac.tgtHdg = null; ac.turnDir = 0;
}
// fly direct to a point: on the route it skips ahead to it, off the route it goes there and then on to the nearest route
// point beyond (or to the destination)
function directTo(ac, name){
  const i = ac.route.findIndex((p, k) => k >= ac.ri - 1 && p[2] === name);
  if (i >= 0) { ac.ri = i; }
  else {
    const f = FIXP[name] || APS[name]; if (!f) return false;
    let k = ac.route.length - 1, bd = Infinity;
    const dest = ac.route[ac.route.length - 1];
    for (let j = ac.ri; j < ac.route.length; j++) { const p = ac.route[j], d = nm(f[0], f[1], p[0], p[1]) + nm(p[0], p[1], dest[0], dest[1])*0.2; if (nm(f[0], f[1], dest[0], dest[1]) > nm(p[0], p[1], dest[0], dest[1]) && d < bd) { bd = d; k = j; } }
    ac.route = [...ac.route.slice(0, ac.ri), [f[0], f[1], name], ...ac.route.slice(k)];
  }
  ac.mode = 'NAV'; ac.hold = null; ac.holdAt = null; ac.tgtHdg = null; ac.turnDir = 0;
  return true;
}

// ── who works it: offers, check-ins, transfers ──
// where it will be over the next minutes on its present clearance (route or heading, climbing or descending to its level)
function predict(ac, secs, step = 30){
  const out = []; let la = ac.la, lo = ac.lo, alt = ac.alt, ri = ac.ri, h = ac.trk;
  const gs = Math.max(150, ac.gs), rate = ac.cfl > ac.alt ? climbRate(ac) : PERF[ac.fam].des;
  for (let t = step; t <= secs; t += step) {
    let d = gs*step/3600;
    if (ac.mode === 'NAV') {
      while (d > 0 && ri < ac.route.length) { const p = ac.route[ri], L = nm(la, lo, p[0], p[1]); if (L <= d) { la = p[0]; lo = p[1]; d -= L; ri++; } else { h = crs(la, lo, p[0], p[1]); [la, lo] = moveLL(la, lo, h, d); d = 0; } }
      if (d > 0) [la, lo] = moveLL(la, lo, h, d);
    } else if (ac.mode === 'HOLD') { /* stays round the fix */ }
    else { h = ac.tgtHdg ?? ac.hdg; [la, lo] = moveLL(la, lo, h, d); }
    const dz = ac.cfl - alt; alt += clamp(dz, -rate*step/60, rate*step/60);
    out.push([la, lo, alt, S.t + t]);
  }
  return out;
}
const unitSay = code => { const u = unitOf(code); return `${u.name}${u.freq ? ' ' + u.freq : ''}`; };
// the call sign the crew uses for you
const meName = () => unitOf(ME).name.replace(/ Control$/, '') || 'London';
function offer(ac, eta){
  ac.st = 'OFFER'; ac.offerT = S.t; ac.entryEta = eta; ac.from = ac.owner;
  // the level it comes to you at: what the unit has cleared it to (the standing agreement when there is one)
  aiHandLevel(ac);
  emit('offer', ac);
}
function acceptOffer(ac, quiet){
  if (ac.st !== 'OFFER') return false;
  ac.accepted = true;
  if (!quiet) coord(`${UNIT_SHORT(ac.from)}: ${ac.cs} accepted`, ac.from, 'ok');
  return true;
}
// the crew calls you: the unit next door has transferred it
function checkIn(ac){
  ac.st = 'CALL'; ac.owner = ME; ac.callT = S.t;
  if (!ac.accepted) { score(-3, `${ac.cs} was transferred to you before you accepted it`); ac.accepted = true; }
  const lv = Math.abs(ac.cfl - ac.alt) > 300 ? `${spokenFL(ac.alt)} ${ac.cfl > ac.alt ? 'climbing' : 'descending'} ${spokenFL(ac.cfl)}` : spokenFL(ac.alt);
  say(ac, `${meName()}, ${spoken(ac.cs)}, ${lv}${ac.mode === 'HDG' ? `, heading ${hdg3(ac.tgtHdg ?? ac.hdg)}` : ''}`);
  if (S.opts.autoId) { ac.st = 'MINE'; ac.idT = S.t; setTimeout(() => S.acs.includes(ac) && atc(ac, `${spoken(ac.cs)}, ${meName()}, identified`), 900/Math.max(1, S.speed)); }
  else setNeed(ac, 'Check-in');
  emit('checkin', ac);
}
// you have answered its call: it is identified and yours
function identified(ac){ if (ac.st === 'CALL') { ac.st = 'MINE'; ac.idT = S.t; if (ac.need === 'Check-in') clearNeed(ac); } }
function setNeed(ac, what, extra){ ac.need = what; ac.needT = S.t; ac.needX = extra || null; ac.nagged = 0; emit('need', ac); }
function clearNeed(ac){ ac.need = null; ac.needX = null; }
// the next unit after you on its present clearance, and when it gets there
function exitOf(ac){
  const P = predict(ac, 900, 20);
  let prevSec = secAtMine(ac.la, ac.lo, ac.alt), inside = !!prevSec;
  for (const [la, lo, alt, t] of P) {
    if (!inMap([la, lo])) return inside ? { code: firAt(la, lo), t, la, lo, alt, from: prevSec, to: null } : null;
    const s = secAtMine(la, lo, alt);
    // still on its way in (it calls a little before the boundary): the exit is the one after it has been inside
    if (!inside) { if (s) { inside = true; prevSec = s; } continue; }
    if (!s) { const ss = secsAt(la, lo, alt/100), sp = ss.length ? specific(ss) : null; return { code: sp ? sp.own : firAt(la, lo), t, la, lo, alt, from: prevSec, to: sp }; }
    prevSec = s;
  }
  return null;
}
function transfer(ac, quiet){
  const X = ac.exit || exitOf(ac);
  if (!X) { sys(`${ac.cs} stays in your airspace on its present clearance: there is no one to transfer it to yet.`); return false; }
  // the next unit checks the standing agreement and anything it has asked for
  const ag = X.from && X.to ? agreementFor(ac, X.from, X.to) : null, why = refusal(ac, X, ag);
  if (why) { coord(`${UNIT_SHORT(X.code)}: unable ${ac.cs}, ${why}`, X.code, 'bad'); ac.refused = { t: S.t, why, code: X.code }; return false; }
  const u = unitOf(X.code);
  ac.st = 'XFER'; ac.owner = X.code; ac.xferT = S.t; ac.toUnit = X.code; clearNeed(ac);
  if (!quiet) atc(ac, `${spoken(ac.cs)}, contact ${u.name} ${spokenFreq(u.freq)}`, `contact ${u.name} ${spokenFreq(u.freq)}, ${spoken(ac.cs)}`);
  S.stats.handed = (S.stats.handed || 0) + 1;
  // early or late: inside about two minutes of the boundary is right
  const ahead = X.t - S.t;
  if (ahead > 8*60) score(-1, `${ac.cs} transferred early, ${Math.round(ahead/60)} minutes before your boundary`);
  emit('xfer', ac);
  return true;
}
// why the next unit won't take it now: the agreed level, a flow restriction, a closed airport
function refusal(ac, X, ag){
  if (ag && ag.des && ac.cfl > ag.des*100 + 50 && ac.vs <= 0 && arrivesHere(ac)) return `descend it to FL${String(ag.des).padStart(3, '0')} first, as agreed`;
  if (ag && ag.clb && ac.cfl < ag.clb*100 - 50 && !arrivesHere(ac) && ac.alt < ag.clb*100 - 50 && ac.vs >= 0 && X.alt > ac.alt - 100) return null;
  for (const R of S.flowRegs) if (R.code === X.code && S.t < R.until) {
    if (R.cap && ac.cfl > R.cap) return `level capped at FL${FLs(R.cap)} until ${zHM(simMs() + (R.until - S.t)*1000)}`;
    if (R.mit && R.last != null && S.t - R.last < R.mit) return `${R.why}: one every ${Math.round(R.mit/60)} minutes, hold it or slow it down, next at ${zHM(simMs() + (R.last + R.mit - S.t)*1000)}`;
  }
  const A = S.airports[ac.arr];
  if (A && A.slotGap && arrivesHere(ac) && /^TC|APP|DIR|RAD/.test(X.code + (AREA.pos[X.code] ? AREA.pos[X.code][0] : '')) && A.lastIn != null && S.t - A.lastIn < A.slotGap && !ac.slotOk)
    return `${apName(ac.arr)} is holding, ${A.delay} minute delays: hold it at ${ac.holdFix || 'a fix of yours'}, next slot ${zHM(simMs() + (A.lastIn + A.slotGap - S.t)*1000)}`;
  return null;
}
function xferDone(ac, X){
  for (const R of S.flowRegs) if (R.code === X && S.t < R.until && R.mit) R.last = S.t;
  const A = S.airports[ac.arr]; if (A && A.slotGap) A.lastIn = S.t;
}

// ── the AI controllers next door (and what they clear their flights to) ──
// an AI unit flies its flights on their route: up to the cruising level, and down on a 3-to-1 profile for the airport
function aiStep(ac){
  if (ac.mine || ac.st === 'OUT') return;
  if (ac.mode === 'HOLD' && ac.aiHold && S.t > ac.aiHold) { ac.aiHold = null; rejoin(ac); }
  if (ac.mode === 'HDG' && S.t - (ac.hdgT || 0) > 240 && !(ac.emg && ac.emg.kind === 'PRESS' && ac.alt > 10500)) rejoin(ac);
  const togo = arrivesHere(ac) ? distToGo(ac) : Infinity, el = APS[ac.arr] ? 1500 : 0;
  if (togo < todNM(ac)) {
    // descending to the airport: the AI clears it down in steps that keep it on the profile
    const want = Math.max(el + 2000, Math.floor((togo - 12)/3.1)*1000);
    const lim = ac.st === 'OFFER' && ac.handLevel != null ? ac.handLevel : -Infinity;
    if (want < ac.cfl) ac.cfl = Math.max(lim, Math.max(want, ac.holding ? 7000 : 0));
    const A = S.airports[ac.arr];
    if (A && A.hold && ac.holdFix && !ac.aiHeld && ac.mode === 'NAV' && nextPt(ac) && nextPt(ac)[2] === ac.holdFix && ac.st !== 'OFFER') {
      ac.aiHeld = true; ac.holdAt = { fix: ac.holdFix }; ac.aiHold = S.t + (A.delay || 10)*60*rnd(.6, 1.2); ac.holding = true;
    }
  } else if (ac.cfl < ac.rfl && ac.st !== 'OFFER' && (ac.st !== 'XFER' || S.t - ac.xferT > 40)) {
    // climbing: the departure unit stops it at the level it hands over at; after that, up to cruise
    ac.cfl = ac.aiCap ? Math.min(ac.rfl, ac.aiCap) : ac.rfl;
  }
  if (ac.arrived) return;
  // landed (or gone beyond the map): it leaves the picture
  if (arrivesHere(ac) && togo < 3 && ac.alt < el + 4000) { ac.arrived = true; ac.st = 'OUT'; }
}
// the level an AI unit hands a flight to you at
function aiHandLevel(ac){
  const P = predict(ac, 420, 30), entry = P.find(q => mineAt(q[0], q[1], q[2]));
  if (!entry) return;
  const to = secAtMine(entry[0], entry[1], entry[2]), from = secsAt(ac.la, ac.lo, ac.alt/100).find(s => s.own === ac.owner);
  const ag = from && to ? agreementFor(ac, from, to) : null;
  if (ag && ag.des && ac.vs <= 0 && arrivesHere(ac) && ag.des*100 < ac.alt + 500) ac.cfl = ac.handLevel = Math.max(ac.cfl, ag.des*100);
  else if (ag && ag.clb && ac.vs >= 0) { ac.cfl = ac.handLevel = Math.min(ac.rfl, ag.clb*100); ac.aiCap = ac.handLevel; }
  else if (ac.cfl > ac.alt + 300) { const lv = Math.min(ac.rfl, Math.max(ac.cfl, Math.ceil((to ? to.lo*100 : ac.alt)/1000)*1000 + 2000)); ac.cfl = ac.handLevel = levelFor(ac.trk, lv); ac.aiCap = ac.cfl; }
  else ac.handLevel = ac.cfl;
}

// ── the clock ──
function tick(dt){
  S.t += dt;
  for (const ac of S.acs) stepAc(ac, dt);
  if (Math.floor(S.t) % 2 === 0) manage();
  stepEvents(dt);
}
// every two seconds: offers, check-ins, exits, separation, requests
function manage(){
  for (const ac of S.acs) {
    if (ac.st === 'OUT') continue;
    if (!ac.mine) aiStep(ac);
    const inMine = mineAt(ac.la, ac.lo, ac.alt);
    if (ac.st === 'AI') {
      // coming your way: offered five minutes out
      if (inMine) { offer(ac, S.t); }
      else if (S.t - (ac.predT || -99) > 10) { ac.predT = S.t; const P = predict(ac, 300, 30), e = P.find(q => mineAt(q[0], q[1], q[2])); if (e) offer(ac, e[3]); }
    }
    if (ac.st === 'OFFER') {
      // transferred a minute before the boundary (or as it crosses); unaccepted near the boundary, the unit rings you
      const tto = ac.entryEta - S.t;
      if (!ac.accepted && tto < 100 && !ac.rang) { ac.rang = true; coord(`${UNIT_SHORT(ac.from)}: ${ac.cs} is ${Math.max(1, Math.round(tto/60))} minute${Math.round(tto/60) > 1 ? 's' : ''} from your boundary at ${spokenFL(ac.cfl, true)}, are you accepting?`, ac.from, 'ask', ac); }
      if ((tto < 60 || inMine) && (ac.accepted || S.t - ac.offerT > 50)) checkIn(ac);
      else if (S.t - ac.offerT > 30 && !inMine && S.t - (ac.predT || -99) > 10) {
        // no longer coming: a turn or a level change took it away
        ac.predT = S.t; const P = predict(ac, 360, 30), e = P.find(q => mineAt(q[0], q[1], q[2])); if (!e) { ac.st = 'AI'; ac.accepted = false; } else ac.entryEta = e[3];
      }
    }
    if (ac.mine) manageMine(ac, inMine);
    if (ac.st === 'XFER' && !ac.xferDone && S.t - ac.xferT > 6) { ac.xferDone = true; xferDone(ac, ac.toUnit); }
    // gone: off the map, landed, or long out of your way
    if (!inMap([ac.la, ac.lo]) || ac.arrived) { if (ac.mine) score(-10, `${ac.cs} left the map still on your frequency`); ac.st = 'OUT'; }
    else if (!ac.mine && ac.st !== 'OFFER' && farFromMe(ac) > 320) ac.st = 'OUT';
  }
  S.acs = S.acs.filter(a => a.st !== 'OUT' || a === S.sel && S.t - (a.outT ||= S.t) < 5);
  if (Math.floor(S.t) % 10 === 0) aiSeparate();
  separation();
}
// the units next door keep their own traffic apart (and hand it to you that way): a level change for the later one
function aiSeparate(){
  const theirs = S.acs.filter(a => !a.mine && (a.st === 'AI' || a.st === 'OFFER' || a.st === 'XFER') && a.alt > 6000);
  for (let i = 0; i < theirs.length; i++) for (let j = i + 1; j < theirs.length; j++) {
    const a = theirs[i], b = theirs[j]; if (Math.abs(a.la - b.la) > 0.7 || nm(a.la, a.lo, b.la, b.lo) > 45) continue;
    let hit = false;
    for (let t = 0; t <= 240 && !hit; t += 20) {
      const pa = moveLL(a.la, a.lo, a.trk, a.gs*t/3600), pb = moveLL(b.la, b.lo, b.trk, b.gs*t/3600);
      const za = clamp(a.alt + a.vs*t/60, Math.min(a.alt, a.cfl), Math.max(a.alt, a.cfl)), zb = clamp(b.alt + b.vs*t/60, Math.min(b.alt, b.cfl), Math.max(b.alt, b.cfl));
      if (nm(pa[0], pa[1], pb[0], pb[1]) < 6.5 && Math.abs(za - zb) < 1000) hit = true;
    }
    if (!hit) continue;
    // the one that is level (or the later one) moves a thousand feet, the way that keeps clear of everything else
    const m = Math.abs(a.vs) < Math.abs(b.vs) ? b : a.born > b.born ? a : b, o = m === a ? b : a;
    const base = Math.abs(m.cfl - m.alt) < 300 ? m.alt : m.cfl, opts = [base + 1000, base - 1000, base + 2000, base - 2000].filter(v => v > 8000 && v <= PERF[m.fam].ceil);
    const free = opts.find(v => !theirs.some(x => x !== m && Math.abs(x.cfl - v) < 900 && nm(x.la, x.lo, m.la, m.lo) < 25)) ?? opts[0];
    if (free != null) { m.cfl = Math.round(free/1000)*1000; m.aiCap = m.cfl; if (m.st === 'OFFER') m.handLevel = m.cfl; }
  }
}
const farFromMe = ac => { const c = [(MYBB[0] + MYBB[2])/2, (MYBB[1] + MYBB[3])/2], r = nm(MYBB[0], MYBB[1], MYBB[2], MYBB[3])/2; return nm(ac.la, ac.lo, c[0], c[1]) - r; };
function manageMine(ac, inMine){
  // the transfer: the next unit after you, worked out every 10 s; due inside about four minutes of the boundary
  if (S.t - (ac.exitT || -99) > 10) { ac.exitT = S.t; ac.exit = exitOf(ac); }
  const X = ac.exit;
  ac.xferDue = !!(X && X.t - S.t < 240);
  if (!inMine && ac.st === 'MINE' && ac.wasIn) {
    // out of your airspace without a transfer
    const code = ownerAt(ac.la, ac.lo, ac.alt);
    if (code !== ME) { score(-8, `${ac.cs} left your airspace without a transfer: ${UNIT_SHORT(code)} had to call it up`); ac.forced = true; transfer(ac, true); if (ac.st !== 'XFER') { ac.st = 'XFER'; ac.owner = code; ac.xferT = S.t; ac.toUnit = code; } coord(`${UNIT_SHORT(code)}: ${ac.cs} has just entered my airspace on your frequency, transfer it now`, code, 'bad'); return; }
  }
  if (inMine) ac.wasIn = true;
  // unanswered calls: the crew calls again
  if (ac.need && S.t - ac.needT > 45 && ac.nagged < 3 && ac.need !== 'Transfer') { ac.nagged++; ac.needT = S.t; S.stats.slow = (S.stats.slow || 0) + 1; score(-1, `${ac.cs} waited for an answer`);
    say(ac, ac.need === 'Check-in' ? `${meName()}, ${spoken(ac.cs)}, how do you read?` : `${meName()}, ${spoken(ac.cs)}, ${ac.needSay || ac.need.toLowerCase()}`); }
  if (ac.st !== 'MINE') return;
  requests(ac);
}
// what the crew asks for: the cruising level, descent, a direct routing, a way round the weather, a smoother level
function requests(ac){
  if (ac.need || S.t - (ac.idT || 0) < 20 || ac.emg && ac.emg.done !== true && ac.emg.kind === 'NORDO') return;
  const togo = arrivesHere(ac) ? distToGo(ac) : Infinity;
  if (togo < todNM(ac) + 8 && ac.cfl > Math.max(10000, (togo - 10)/3.1*1000) && !ac.reqs.des) {
    ac.reqs.des = S.t; ac.needSay = 'request descent'; setNeed(ac, 'Request descent'); say(ac, `${spoken(ac.cs)}, request descent`); return; }
  if (togo > todNM(ac) + 40 && ac.cfl < ac.rfl - 500 && Math.abs(ac.alt - ac.cfl) < 200 && !ac.reqs.clb && S.t - (ac.idT || 0) > 25) {
    ac.reqs.clb = S.t; ac.needSay = `request ${spokenFL(ac.rfl, true)}`; setNeed(ac, `Request FL${FLs(ac.rfl)}`); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); return; }
  // a direct routing, now and then
  if (!ac.reqs.dct && Math.random() < 1/900 && ac.mode === 'NAV' && ac.route.length - ac.ri > 4) {
    const k = Math.min(ac.route.length - 2, ac.ri + 3 + Math.floor(Math.random()*3)), p = ac.route[k];
    if (p[2] && FIXP[p[2]]) { ac.reqs.dct = S.t; ac.reqDct = p[2]; ac.needSay = `request direct ${p[2]}`; setNeed(ac, `Request direct ${p[2]}`); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); return; }
  }
  // weather ahead: it asks to go round
  for (const cb of S.cbs) {
    if (ac.alt > cb.top || (ac.reqs.wx && S.t - ac.reqs.wx < 300)) continue;
    const P = predict(ac, 420, 30); const hit = P.find(q => nm(q[0], q[1], cb.la, cb.lo) < cb.r);
    if (hit && nm(ac.la, ac.lo, cb.la, cb.lo) > cb.r) {
      const side = angDiff(ac.trk, crs(ac.la, ac.lo, cb.la, cb.lo)) > 0 ? -1 : 1, h = norm(ac.trk + side*30);
      ac.reqs.wx = S.t; ac.wxHdg = h; ac.needSay = `request heading ${hdg3(h)} for weather`; setNeed(ac, `Weather: request heading ${hdg3(h)}`); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); return;
    }
  }
  for (const T of S.turb) if (ac.alt > T.lo - 100 && ac.alt < T.hi + 100 && nm(ac.la, ac.lo, T.la, T.lon) < T.r && !(ac.reqs.turb && S.t - ac.reqs.turb < 600)) {
    const up = ac.alt + 2000 <= PERF[ac.fam].ceil && T.hi + 1000 <= PERF[ac.fam].ceil && Math.random() < .5, lv = up ? Math.ceil((T.hi + 1000)/1000)*1000 : Math.floor((T.lo - 1000)/1000)*1000;
    ac.reqs.turb = S.t; ac.turbLv = lv; ac.needSay = `moderate turbulence, request ${spokenFL(lv, true)}`; setNeed(ac, `Turbulence: request FL${FLs(lv)}`); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); return;
  }
}

// ── separation ──
const SEP_NM = 5, SEP_FT = 1000;
function separation(){
  const air = S.acs.filter(a => a.st !== 'OUT' && a.alt > 1500);
  if (typeof liveGhosts === 'function') for (const g of liveGhosts()) if (g.alt > 1500 && nearBox(g.la, g.lo, 0.6)) air.push(g);
  const now = new Set(), stca = new Set(), pairs = { stca: [], los: [] };
  for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) {
    const a = air[i], b = air[j]; if (!(a.mine || b.mine)) continue;
    if ((a.ghost || b.ghost) && !(a.mine && b.ghost || b.mine && a.ghost)) continue;
    if (Math.abs(a.la - b.la) > 0.6) continue;
    const dv = Math.abs(a.alt - b.alt), dh = nm(a.la, a.lo, b.la, b.lo);
    const k = [a.cs, b.cs].sort().join('|');
    if (dh < SEP_NM - 0.05 && dv < SEP_FT - 100) {
      now.add(k); pairs.los.push([a, b]);
      if (!S.conflicts.has(k)) { S.conflicts.set(k, S.t); S.stats.los = (S.stats.los || 0) + 1; score(-25, `Loss of separation: ${a.cs} and ${b.cs}, ${dh.toFixed(1)} NM and ${Math.round(dv/100)*100} ft`); emit('los', [a, b]); }
      continue;
    }
    // short-term conflict alert: two minutes ahead on present tracks and rates
    if (dh > 40) continue;
    for (let t = 15; t <= 120; t += 15) {
      const pa = moveLL(a.la, a.lo, a.trk, a.gs*t/3600), pb = moveLL(b.la, b.lo, b.trk, b.gs*t/3600);
      const za = clamp(a.alt + a.vs*t/60, Math.min(a.alt, a.cfl), Math.max(a.alt, a.cfl)), zb = clamp(b.alt + b.vs*t/60, Math.min(b.alt, b.cfl), Math.max(b.alt, b.cfl));
      if (nm(pa[0], pa[1], pb[0], pb[1]) < SEP_NM && Math.abs(za - zb) < SEP_FT - 100) { stca.add(k); pairs.stca.push([a, b]); break; }
    }
  }
  for (const k of [...S.conflicts.keys()]) if (!now.has(k) && S.t - S.conflicts.get(k) > 30) S.conflicts.delete(k);
  for (const k of stca) if (!S.stca.has(k)) { const [a, b] = k.split('|'); sys(`STCA: ${a} and ${b}`, true); emit('stca', k); }
  S.stca = stca; S.los = now; S.pairs = pairs;
}
const inConflict = ac => { const P = S.pairs; if (!P) return false; for (const l of [P.stca, P.los]) for (const [a, b] of l) if (a === ac || b === ac) return true; return false; };

// ── score and log ──
function score(n, why){ S.score += n; S.scoreLog = [...(S.scoreLog || []).slice(-60), [S.t, n, why]]; if (n < 0) logLine('sys', 'SCORE', `${why} (${n})`, true); emit('score'); }
function logLine(cls, who, text, bad){ S.log.push({ t: S.t, cls: bad ? cls + ' bad' : cls, who, text }); if (S.log.length > 400) S.log.splice(0, 100); emit('log'); }
const sys = (text, bad) => logLine('sys', '· · ·', text, bad);
function coord(text, code, kind = 'info', ac = null){
  const pre = UNIT_SHORT(code) + ': '; if (text.startsWith(pre)) text = text.slice(pre.length);
  text = text[0].toUpperCase() + text.slice(1);
  const c = { t: S.t, text, code, kind, ac }; S.coord.unshift(c); S.coord = S.coord.slice(0, 12);
  logLine('coord', UNIT_SHORT(code).toUpperCase(), text); emit('coord', c);
}
function say(ac, text){ logLine('plt', ac.cs, text); emit('say', { ac, text }); }
function atc(ac, text, readback){ logLine('atc', meName().toUpperCase(), text); emit('atc', { ac, text }); if (readback) setTimeout(() => { if (S.acs.includes(ac)) say(ac, readback); }, 1400/Math.max(1, S.speed)); }

// ── radio words ──
const DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
let TEL = {};   // airline telephony by ICAO code, from the airport profiles and a few of our own
Object.assign(TEL, { BAW: 'Speedbird', EZY: 'Easy', EJU: 'Alpine', EZS: 'Topswiss', RYR: 'Ryanair', RUK: 'Bluemax', WZZ: 'Wizz Air', WUK: 'Wizz Go', TOM: 'Tomson', EXS: 'Channex', VIR: 'Virgin',
  DLH: 'Lufthansa', AFR: 'Air France', KLM: 'KLM', SAS: 'Scandinavian', IBE: 'Iberia', VLG: 'Vueling', EIN: 'Shamrock', AAL: 'American', UAL: 'United', DAL: 'Delta', ACA: 'Air Canada',
  UAE: 'Emirates', QTR: 'Qatari', ETD: 'Etihad', SWR: 'Swiss', AUA: 'Austrian', TAP: 'Air Portugal', BEL: 'Beeline', LOG: 'Logan', SHT: 'Shuttle', JAI: 'Jet Airways', AIC: 'Air India',
  THY: 'Turkish', NAX: 'Nor Shuttle', FIN: 'Finnair', LOT: 'Pollot', EWG: 'Eurowings', CFE: 'Flyer', BCY: 'City Ireland', ICE: 'Iceair', JBU: 'Jetblue', CLX: 'Cargolux', FDX: 'Fedex', UPS: 'UPS',
  BOX: 'Germancargo', DHK: 'World Express', GTI: 'Giant', ABR: 'Contract', RCH: 'Reach', RRR: 'Ascot', TCX: 'Kestrel', JET: 'Wizzard', LGL: 'Luxair', AEA: 'Europa', BTI: 'Air Baltic' });
function spoken(cs){ const p = cs.slice(0, 3); return TEL[p] ? TEL[p] + ' ' + cs.slice(3).split('').map(c => /\d/.test(c) ? DIG[c] : c).join(' ') : cs.split('').map(c => /\d/.test(c) ? DIG[c] : c).join(' '); }
function spokenFL(alt, levelOnly){ const f = Math.round(alt/100);
  if (alt < 6000 && !levelOnly) return `altitude ${Math.round(alt/100)*100} feet`;
  return `flight level ${String(f).padStart(3, '0').split('').map(c => DIG[c]).join(' ')}`; }
const spokenFreq = f => f ? f.replace(/0+$/, '').replace(/\.$/, '').split('').map(c => c === '.' ? 'decimal' : DIG[c]).join(' ') : '';
