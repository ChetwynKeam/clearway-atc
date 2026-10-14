// ═════════════════════════ AI controllers ═════════════════════════
// Any of the four seats (Ground, Tower, Approach, Departure) can be worked by an AI controller instead of you, to share
// the load. Who owns a flight follows where it is, the way a real unit hands traffic on: Ground from start-up to the
// runway holding point and from vacating to the stand, Tower on and around the runway (line-up, take-off, landing,
// crossings) and until a departure is transferred, Approach for arrivals until they are handed to Tower on final (and
// after a go-around), Departure from Tower's transfer to the next unit. The AI gives the same instructions you would,
// through the same command path, so they appear in the radio log (marked AI) and the aircraft read them back. It is
// rule-based and deterministic: no network calls. Clicking or typing to an AI flight takes it back for that seat
// (Take over); Hand to AI does the opposite. Only flights in your seats count towards your score and Career.
var AI_SEATS = ['GND', 'TWR', 'APP', 'DEP'];
var AI_NAME = { GND: 'Ground', TWR: 'Tower', APP: 'Approach', DEP: 'Departure' };
var aiCtx = null;   // { seat, said } while an AI controller is transmitting
S.seats = { GND: 'ME', TWR: 'ME', APP: 'ME', DEP: 'ME' };
try { const s = JSON.parse(localStorage.getItem('cw-seats') || 'null'); if (s) for (const k of AI_SEATS) if (s[k] === 'AI') S.seats[k] = 'AI'; } catch(e) {}
try { S.aiHear = localStorage.getItem('cw-ai-hear') === '1'; } catch(e) { S.aiHear = false; }
S.aiScore = { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 };

// the unit names each seat answers to at this airport
function seatUnit(k){
  const dep = APT.depRadar && APT.depRadar[0] !== APT.radar[0] ? APT.depRadar[0] : APT.radar[0];
  return { GND: APT.gnd ? APT.gnd[0] : APT.tower[0].replace(/Tower$/, 'Ground'), TWR: APT.tower[0], APP: APT.radar[0], DEP: dep }[k];
}
// which seat a flight belongs to right now (null: pending, or transferred to the next unit)
function seatOf(ac){
  if (!ac || ac.state === 'PRE' || ac.handed) return null;
  if (ac.ground) {
    if (ac.hsAt || ac.onRwy) return 'TWR';   // holding short of a runway, crossing it, landing, lining up: Tower
    if (ac.kind === 'DEP') return ['HOLDPT', 'LINEUP', 'LINEDUP', 'TAKEOFF'].includes(ac.state) || (ac.state === 'TAXI' && (ac.luq || ac.cto)) ? 'TWR' : 'GND';
    return ['ROLLOUT', 'ROLLED'].includes(ac.state) ? 'TWR' : 'GND';
  }
  if (ac.kind === 'DEP') return ac.freq === 'TWR' ? 'TWR' : 'DEP';
  return ac.freq === 'TWR' || ac.ctl ? 'TWR' : 'APP';
}
const aiActive = () => S.running && !EXERCISES[S.mode] && AI_SEATS.some(k => S.seats[k] === 'AI');
// worked by an AI controller (its seat is AI, unless you took this one back; or you handed it to the AI)
function aiOwns(ac){
  if (!S.running || EXERCISES[S.mode]) return false;
  const s = seatOf(ac); if (!s) return false;
  if (ac.aiSeat === s) return true;
  if (ac.meSeat === s) return false;
  return S.seats[s] === 'AI';
}
// the score a flight's events count towards: yours, or the AI's (kept apart, never in your Career)
function SC(ac){ return ac && aiOwns(ac) ? S.aiScore : S.score; }
function takeOver(ac, quiet){
  const s = seatOf(ac); if (!s) return;
  ac.meSeat = s; ac.aiSeat = null;
  if (!quiet) sys(`You have taken ${ac.cs} from the AI ${AI_NAME[s]}.`);
}
function handToAi(ac){
  const s = seatOf(ac); if (!s) return;
  ac.aiSeat = s; ac.meSeat = null;
  sys(`${ac.cs} handed to the AI ${AI_NAME[s]}.`);
}
function setSeat(k, who, quiet){
  if (S.seats[k] === who) return;
  S.seats[k] = who;
  try { localStorage.setItem('cw-seats', JSON.stringify(S.seats)); } catch(e) {}
  for (const ac of S.acs) { if (ac.meSeat === k) ac.meSeat = null; if (ac.aiSeat === k) ac.aiSeat = null; }
  if (!quiet && S.running) sys(who === 'AI' ? `An AI controller is working ${AI_NAME[k]} (${seatUnit(k)}).` : `You are working ${AI_NAME[k]} (${seatUnit(k)}).`);
  renderSeats(); if (S.running) { renderSel(); renderStrips(true); }
}

// ── transmitting: the same command path as yours, without touching your selection or the command box
function aiDo(seat, ac, cmd){
  const sel = S.sel; aiCtx = { seat, said: false };
  try { command(ac.cs + ' ' + cmd); } catch(e) {}
  const ok = aiCtx.said; aiCtx = null;
  S.sel = sel && S.acs.includes(sel) ? sel : null;
  ac.aiNext = S.t + (ok ? 4 : 15);   // a refused instruction: try again a little later
  return ok;
}
function aiVeh(seat, fn){ aiCtx = { seat, said: false }; try { fn(); } catch(e) {} aiCtx = null; }
// a controller answers a call after a few seconds, not instantly (deterministic per flight and call)
function aiDue(o, key, lo = 3, hi = 8){
  const T = o.aiT ||= {};
  if (!(key in T)) T[key] = S.t + lo + (hash((o.cs || '') + key) % ((hi - lo)*10 + 1))/10;
  return S.t >= T[key];
}
const aiSince = (o, key) => o.aiT && key in o.aiT ? S.t - o.aiT[key] : 0;

// ── runways
const RX = {};   // each runway id: it and the runways crossing it
function rwyCross(R){
  if (RX[R.id]) return RX[R.id];
  const end = Q => [Q.rm(0, 0), Q.rm(Q.len || RWY_M, 0)];
  const [a, b] = end(R);
  return RX[R.id] = new Set([R.id, ...RWYS.filter(Q => Q !== R && segSegM(a, b, ...end(Q)) < 30).map(Q => Q.id)]);
}
const sameRwy = (R, id) => rwyCross(R).has(id);
// anything on the runway (or one crossing it), lined up on it, or a vehicle out there; skip: the flight asking
function rwyBusy(R, skip, rolling, ok){
  for (const o of S.acs) {
    if (o === skip || (ok && ok(o))) continue;
    if (o.onRwy && sameRwy(R, o.rwyId || RWYS[0].id) && !(rolling && o.state === 'TAKEOFF')) return o;
    if (o.kind === 'DEP' && ['LINEUP', 'LINEDUP'].includes(o.state) && sameRwy(R, rwyOf(depRw(o)).id)) return o;
  }
  if (typeof VEH !== 'undefined' && VEH.list.some(v => v.onRwy && sameRwy(R, v.onRwy) && !v.gone)) return true;
  return rwyBlocked(R.lo) ? true : null;
}
// seconds to touchdown from this many track miles out, at the speeds arrivals fly here (slowing to the approach
// speed for the last four miles): what spacing is judged on, so the closing-up on final is allowed for
function etaD(d, ac){
  const v = (ac && ac.perf && ac.perf.vapp) || 135, bands = [[4, v + 5], [10, 165], [20, 195], [1e9, 235]];
  const cap = ac && ac.spdAssigned && ac.tgtSpd ? ac.tgtSpd : 1e9;   // slowed down by Approach
  let t = 0, lo = 0;
  for (let [hi, kt] of bands) { if (hi > 4 && cap < 1e9) kt = cap; const seg = Math.max(0, Math.min(d, hi) - lo); t += seg/kt*3600; lo = hi; if (d <= hi) break; }
  return t;
}
const eta = (ac, F) => etaD(ac.mode === 'FINAL' ? finalDist(ac) : estToGo(ac, F || (ac.app ? finOf(ac) : FINAL[landRw(ac)])), ac);
// the nearest arrival to this runway (or one crossing it): miles, seconds, and whether it lands towards us
function arrNear(R, skip){
  let best = 99, bt = 1e9, opp = false, head = false;
  for (const o of S.acs) {
    if (o === skip || o.kind !== 'ARR' || !o.airborne || o.state === 'PRE' || o.state === 'MISSED' || o.state === 'DIVERTING' || o.handed) continue;
    const rw = landRw(o), F = o.app ? finOf(o) : FINAL[rw]; if (!F || !sameRwy(R, rwyOf(rw).id)) continue;
    const d = o.mode === 'FINAL' ? finalDist(o) : estToGo(o, F);
    if (d < best) { best = d; bt = etaD(d, o);
      // landing the other way, or its approach comes in head-on before turning in (Madeira's VOR to 05 from the north-east)
      const dh = skip ? parseInt(depRw(skip), 10)*10 : NaN;
      opp = rwyOf(rw) === R && rw !== (skip ? depRw(skip) : rw);
      head = !opp && o.mode === 'FINAL' && d < 15 && dh === dh && Math.abs(((o.hdg - dh + 540) % 360) - 180) > 120; }
  }
  return { nm: best, eta: bt, opp, head };
}
// seconds for a departure from where it is to line up and be rolling away (Gibraltar: a backtrack first)
function depSecs(ac){
  let secs = 45;
  if (ac.state === 'HOLDPT' || ac.state === 'TAXI') { try { const P = lineUpPath(ac, ac.hp); let L = dist(ac.x, ac.y, ...P[0]); for (let i = 1; i < P.length; i++) L += dist(...P[i-1], ...P[i]); secs += L*1852/(16*0.5144); } catch(e) { secs += 60; } }
  else if (ac.state === 'LINEUP') secs += 20;
  return secs;
}
// how long the next arrival must still be away for the departure to go: its line-up and roll plus a minute; landing
// towards it (Innsbruck: land 26, depart 08) five minutes more, so it is well clear before they meet
const clearS = ac => { const a = arrNear(rwyOf(depRw(ac)), ac); return depSecs(ac) + 110 + (a.opp ? 300 : a.head ? 150 : 0); };
// how long a landing occupies the runway, learned from the landings so far (a backtrack at Gibraltar takes minutes)
const occS = R => (S.aiOcc && S.aiOcc[R.id]) || (BIG_GROUND ? 75 : 150);
// departures waiting for a runway (or one crossing it): Approach leaves them a gap (the landing ahead vacates, then
// the departure lines up and rolls before the next one is close)
function depGapS(R){
  let g = 0;
  for (const o of S.acs) if (o.kind === 'DEP' && o.ground && (['HOLDPT', 'LINEUP', 'LINEDUP'].includes(o.state) || (o.state === 'TAXI' && o.hp && HOLDS[o.hp])) && sameRwy(R, rwyOf(depRw(o)).id)) g = Math.max(g, occS(R) + clearS(o) + 15);
  return g;
}
// the level a departure must stop at below anyone holding within 10 NM of the field (null: no limit, -1: too low to go)
function capUnderStack(ac){
  const top = sidTop(ac) || 6000; let low = 1e9;
  for (const o of S.acs) if (o.kind === 'ARR' && o.airborne && !o.app && o.mode === 'HOLD' && o.hold && Math.hypot(...o.hold.c) < 10) low = Math.min(low, lvlOf(o), o.alt);
  if (low - 1000 >= top) return null;
  const cap = Math.floor((low - 1000)/1000)*1000;
  return cap < ELEV + 1000 ? -1 : cap;
}
// the arrival cleared for the approach ahead of this one, to the same runway
function appLeader(ac){
  const R = rwyOf(landRw(ac)), e = eta(ac); let best = null, be = -1;
  for (const o of S.acs) {
    if (o === ac || o.kind !== 'ARR' || !o.airborne || !o.app || o.state === 'MISSED' || o.state === 'DIVERTING' || !sameRwy(R, rwyOf(landRw(o)).id)) continue;
    const oe = eta(o); if (oe <= e && oe > be) { be = oe; best = o; }
  }
  return best;
}
// the runway opens again (debris cleared, the inspection done) before this flight would land
function shutOpenFor(ac){
  const B = S.emg && S.emg.rwyBlock;
  if (!B || S.emg.incursion) return false;
  return B.until - S.t < eta(ac) - 60;
}
// with a queue in the hold, the departures get a gap only every third arrival (every fourth while four or more are
// waiting), so the hold empties in a steady stream at the minimum spacing
function holdGap(R, gap){
  if (!gap) return 0;
  // a departure already on the runway (lined up, or lining up) gets its gap now: it can't wait out three landings there
  if (S.acs.some(o => o.kind === 'DEP' && o.ground && o.onRwy && (o.state === 'LINEUP' || o.state === 'LINEDUP') && sameRwy(R, rwyOf(depRw(o)).id))) return gap;
  const held = S.acs.filter(o => o.kind === 'ARR' && o.airborne && o.mode === 'HOLD' && !o.app && sameRwy(R, rwyOf(landRw(o)).id)).length;
  if (held < 2) return gap;
  const n = (S.aiRun || {})[R.id] || 0;
  return n >= (held >= 4 ? 3 : 2) ? gap : 0;
}
const WAKE_NM = { HH: 4, HM: 5, HL: 6, MH: 3, MM: 3, ML: 5, LH: 3, LM: 3, LL: 3 };
// the time between two landings: wake (or radar) spacing plus a mile at the approach speed, or the runway occupancy
const landGapS = (lead, trail, R) => Math.max(((WAKE_NM[(lead.perf.wake || 'M') + (trail.perf.wake || 'M')] || 3) + 1)/((trail.perf.vapp || 135))*3600, occS(R) + 25);
// track miles to touchdown: along its route to the approach's start, then down the final
function estToGo(ac, F){
  if (!F) return 99;
  if (ac.mode === 'FINAL') return finalDist(ac);
  const rt = ac.route || [], entry = F.entry && WP[F.entry] ? F.entry : null;
  let seq = rt;
  if (entry) { const i2 = rt.indexOf(entry), iv = (F.via || []).map(x => rt.indexOf(x)).find(j => j >= 0); seq = i2 >= 0 ? rt.slice(0, i2 + 1) : iv != null ? [...rt.slice(0, iv + 1), entry] : [entry]; }
  let p = [ac.x, ac.y], L = 0;
  for (const id of seq) { const w = WP[id]; if (!w) continue; L += dist(...p, ...w.p); p = w.p; }
  const q = onFinal({ x: p[0], y: p[1] }, F);
  return L + (q ? Math.max(0, q.togo) : 0);
}

// ── Ground: start-up and push, taxi out, taxi in, tows, follow-me, vehicles on the taxiways
function pushClear(ac){
  const st = ac.stand; if (!st) return true;
  const p = st.lp || st.p;
  return !S.acs.some(o => o !== ac && o.ground && ((o.path && !['PARKED', 'ONSTAND'].includes(o.state) && dist(o.x, o.y, ...p) < 90*M2NM) || (o.state === 'PUSH' && dist(o.x, o.y, ...p) < 120*M2NM)));
}
// ── taxi routes like a controller would give them: not simply the shortest, but one that keeps clear of traffic coming
// the other way along the same taxiway (head to head) and of aircraft stopped on it. The shortest still wins unless it
// meets someone, and a way round is taken only if it is not much longer (1.8 times at most)
function groundFlows(me){
  const at = new Map(); for (const id in GN) at.set(GN[id].p[0] + ',' + GN[id].p[1], id);
  const dir = new Set(), used = new Set(), blockE = new Set();
  for (const o of S.acs) {
    if (o === me || !o.ground || o.state === 'PRE' || o.onRwy || ['TAKEOFF', 'LINEUP', 'LINEDUP', 'ROLLOUT'].includes(o.state)) continue;
    if (o.path && o.path.pts.length) {
      let prev = null;
      for (const p of o.path.pts) { const id = at.get(p[0] + ',' + p[1]); if (!id) continue;
        if (prev && prev !== id) { dir.add(prev + '>' + id); for (const [v, e] of GN[prev].adj) if (v === id) used.add(e); }
        prev = id; }
    } else if (!['PARKED', 'ONSTAND'].includes(o.state)) {   // stopped out on the taxiways: pushed back, holding, waiting for a route
      let be = null, bd = 40/1852;
      for (const e of GE) { if (e.a[0] === 'R' || e.b[0] === 'R') continue; const A = GN[e.a].p, B = GN[e.b].p, dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx*dx + dy*dy || 1e-12, f = clamp(((o.x - A[0])*dx + (o.y - A[1])*dy)/L2, 0, 1), d = dist(o.x, o.y, A[0] + dx*f, A[1] + dy*f); if (d < bd) { bd = d; be = e; } }
      if (be) blockE.add(be);
    }
  }
  return { dir, used, blockE };
}
const flowPen = F => e => (F.used.has(e) ? 6 : 1)*(F.blockE.has(e) ? 8 : 1);
// the candidate to give (null: the plain shortest is fine), from routes { nodes, tws }; costs in NM, a head-on leg six times
function pickRoute(cands, F){
  const ok = cands.filter(r => r && r.nodes && r.nodes.length > 1);
  for (const r of ok) { r.L = pathLen(r.nodes); let c = 0, head = 0;
    for (let i = 1; i < r.nodes.length; i++) { const u = r.nodes[i-1], v = r.nodes[i], d = dist(...GN[u].p, ...GN[v].p);
      if (F.dir.has(v + '>' + u)) { c += d*6; head += d; } else c += d;
      for (const [w, e] of GN[u].adj) if (w === v && F.blockE.has(e) && i > 1 && i < r.nodes.length - 1) c += 0.3; }
    r.cost = c; r.head = head; }
  if (!ok.length) return null;
  const short = ok.reduce((a, b) => b.L < a.L ? b : a), best = ok.reduce((a, b) => b.cost < a.cost ? b : a);
  if (best === short || best.L > short.L*1.8 || best.cost > short.cost - 0.05 || best.nodes.join() === short.nodes.join()) return null;
  return best;
}
const aiViaWords = v => v.length && v.every(t => /^[A-Z]{1,2}\d{0,2}$/.test(t) && PHON[t]) ? ' VIA ' + v.join(' ') : null;
// the taxi instruction for ac: TAXI, or TAXI ... VIA ... round the traffic
function aiTaxiCmd(ac){
  try {
    const F = groundFlows(ac), [from, face] = taxiStart(ac), pen = flowPen(F);
    if (ac.kind === 'ARR') {
      const st = ac.stand; if (!st) return 'TAXI';
      const lead = brg(...st.lp, ...st.p), rt = q => (face != null && route(from, st.node, q, face, lead)) || route(from, st.node, q, face) || route(from, st.node, q);
      const base = rt(); if (!base) return 'TAXI';
      const cands = [base, rt(pen), ...[...new Set(base.tws)].filter(t => t !== 'APRON').slice(0, 4).map(tw => rt(e => e.tw === tw ? 6 : 1))];
      const b = pickRoute(cands, F), w = b && aiViaWords(viaOf(b.tws, ac.exit));
      if (w) { ac.aiWhy = `routed round ${b === cands[1] ? 'traffic' : 'traffic on ' + viaOf(base.tws, ac.exit).join(', ')}`; return 'TAXI STAND' + w; }
      return 'TAXI';
    }
    let hp = ac.hp && ac.state !== 'READY' && ac.state !== 'PARKED' ? ac.hp : depHold(ac); if (APT.depHoldAs) hp = APT.depHoldAs(ac, hp);
    if (!HOLDS[hp]) return 'TAXI';
    const to = HOLDS[hp].node, ob = BIG_GROUND && face != null ? holdOut(hp) : null, rt = q => (ob != null && route(from, to, q, face, ob)) || route(from, to, q, face);
    const cands = [...taxiOptions(ac, hp), rt(pen)];
    const b = pickRoute(cands, F), w = b && aiViaWords(viaOf(b.tws, hp));
    if (w) { ac.aiWhy = 'routed round traffic'; return `TAXI ${hp}` + w; }
  } catch (e) {}
  return 'TAXI';
}
function aiGround(ac){
  const n = ac.need || '';
  if (n === 'Request start-up' && ac.state === 'PARKED') {
    if (!aiDue(ac, n, 5, 12)) return;
    const sl = typeof SLOT !== 'undefined' && SLOT[ac.cs];
    if (sl && sl.ctot != null && nowMin() < sl.ctot - 20) return;   // its slot is a while off: it waits on stand
    if (!pushClear(ac) && aiSince(ac, n) < 150) return;
    if (!aiDo('GND', ac, 'PUSH')) aiDo('GND', ac, aiTaxiCmd(ac));
    return;
  }
  if (n === 'Ready to taxi' && aiDue(ac, n, 3, 7)) return aiDo('GND', ac, aiTaxiCmd(ac));
  if (n.startsWith('Holding at') && aiDue(ac, n, 4, 9)) return aiDo('GND', ac, aiTaxiCmd(ac));
  if ((n === 'Request taxi' || n === 'Needs a stand') && aiDue(ac, n, 3, 7)) {
    if (!ac.stand) aiDo('GND', ac, 'STAND AUTO');
    return aiDo('GND', ac, ac.stand ? aiTaxiCmd(ac) : 'STAND AUTO TAXI');
  }
  if (n.startsWith('Request follow') && aiDue(ac, n, 3, 6)) return aiDo('GND', ac, ac.stand ? 'FOLLOW' : 'STAND AUTO FOLLOW');
  if ((n === 'Request tow' || n.startsWith('Tug holding')) && aiDue(ac, n, 4, 10)) return aiDo('GND', ac, 'TOW');
  // stopped nose to nose with someone coming the other way: send it round another way, if there is one
  if (ac.path && (ac.state === 'TAXI' || ac.taxiIn) && !ac.held && !ac.hsAt && (ac.gs || 0) < 1) {
    if (!ac.aiStop) ac.aiStop = S.t;
    const nose = S.t - ac.aiStop > 15 && S.acs.find(o => o !== ac && o.ground && dist(o.x, o.y, ac.x, ac.y) < 200/1852 && Math.abs(angDiff(o.hdg, ac.hdg)) > 120 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, o.x, o.y))) < 40);
    if (nose && aiDue(ac, 'round' + ac.aiStop, 1, 4)) { const c = aiTaxiCmd(ac); if (c !== 'TAXI') { aiDo('GND', ac, c); ac.aiWhy = `sent round ${nose.cs}`; } }
  } else ac.aiStop = null;
}

// ── Tower: line-up and take-off, landing clearances, go-arounds, runway crossings, transfers, the road at Gibraltar
function aiDepart(ac){
  const rw = depRw(ac), R = rwyOf(rw), lined = ac.state === 'LINEDUP', why = t => { ac.aiWhy = t; };
  if ((APT.toLimit && APT.toLimit(rw)) || S.wx.vis < 1000 || windLimit(ac, rw)) return why('weather or wind out of limits');
  if (rwyBlocked(rw)) return why('runway closed');
  if (APT.xing && S.xing.st !== 'CLOSED') return why('the road is closing');
  if (needRel(ac)) { const L = ac.rel; if (!L || L.st === 'EXP') { why('release requested'); return aiDo('TWR', ac, 'REL'); } if (L.st !== 'OK') return why('waiting for the release'); if (L.nb && S.t < L.nb - 20) return why('released not before ' + zt(L.nb).slice(0, 5)); }
  const sl = typeof SLOT !== 'undefined' && SLOT[ac.cs];
  if (sl && sl.ctot != null && nowMin() < sl.ctot - 4) return why('waiting for its slot');
  if (S.acs.some(o => o.state === 'MISSED' && o.airborne && S.t - (o.gaT || 0) < 150 && dist(o.x, o.y, ac.x, ac.y) < 10)) return why('a go-around climbing out');
  // an arrival passing low over the field, not lined up behind it (Madeira's VOR to 05 circles round before turning in):
  // only one below 3,000 ft above the runway: close in, or flying an approach that brings it round over the field before
  // the departure is away. Higher up it passes over, and the departure is stopped below it on the climb if need be
  const dh = parseInt(rw, 10)*10, over = S.acs.find(o => o.kind === 'ARR' && o.airborne && o.state !== 'PRE' && !o.handed && o.alt < ELEV + 3000 && dist(o.x, o.y, ac.x, ac.y) < (o.app ? 6 + (o.gs || 180)*depSecs(ac)/3600 : 3) && Math.abs(((o.hdg - dh + 540) % 360) - 180) > 90);
  if (over) return why(`${over.cs} passing overhead`);
  const a = arrNear(R, ac), need = clearS(ac);
  const last = S.aiDep && S.aiDep[R.id], gap = last ? (last.wake === 'H' && ac.perf.wake !== 'H' ? 150 : last.wake === 'M' && ac.perf.wake === 'L' ? 120 : 100) : 0;
  // a departure lined up behind this one (further back up the runway: multiple line-ups) doesn't stop it going
  // (not one already cleared to go: it rolls first)
  const me = luM(ac), behind = o => o.kind === 'DEP' && !o.cto && (o.state === 'LINEUP' || o.state === 'LINEDUP') && depRw(o) === rw && luM(o) < me - 50;
  const wait = last ? last.t + gap - S.t : 0, busy = rwyBusy(R, ac, false, behind);
  // a hold close to the field with someone in it: the departure stops its climb 1,000 ft below the lowest, or waits
  let cap = capUnderStack(ac);
  if (cap === -1 && !lined) return why('waiting for the hold over the field to climb clear');
  if (cap === -1) cap = Math.ceil((ELEV + 1000)/1000)*1000;   // lined up already: off the runway, low
  if (!busy && a.eta >= need && wait <= 0) { why(''); ac.aiCap = cap; return aiDo('TWR', ac, 'CTO'); }
  why(busy ? 'runway occupied' + (busy.cs ? ' by ' + busy.cs : '') : a.eta < need ? `arrival ${a.nm.toFixed(1)} NM out` : 'spacing behind the last departure');
  // the one ahead is rolling (or just gone): line up and wait behind it, ready to go once the spacing allows, if the next
  // arrival leaves room for that. Lined up, it needs about 45 s to be rolling away instead of the taxi on
  const rolling = S.acs.some(o => o !== ac && o.state === 'TAKEOFF' && o.onRwy && sameRwy(R, o.rwyId || RWYS[0].id));
  const lineNeed = 45 + 110 + (a.opp ? 300 : a.head ? 150 : 0);
  if (!lined && ac.state === 'HOLDPT' && (wait > 0 || rolling) && luBehind(ac, R) && a.eta >= Math.max(wait, rolling ? 30 : 0) + lineNeed + 30) { ac.aiWhy = 'lining up behind the departure'; return aiDo('TWR', ac, 'LU'); }
  // an aircraft crossing the runway well away from this one's entry: line up meanwhile, ready to go once it is across
  if (!lined && ac.state === 'HOLDPT' && !ac.luAfter && busy && !rwyBusy(R, ac, false, o => xFar(o, ac) || behind(o)) && a.eta >= Math.max(wait, 0) + lineNeed + 30) { ac.aiWhy = 'lining up while traffic crosses'; return aiDo('TWR', ac, 'LU'); }
  // conditional line-up: a landing aircraft rolling out the same way, or a departure rolling, is all that is on the
  // runway: line up behind it (it waits at the holding point until the traffic has gone by), if the next arrival leaves room
  const tr = !lined && ac.state === 'HOLDPT' && !ac.luAfter && luTraffic(ac);
  if (tr && tr.o.onRwy && !rwyBusy(R, ac, true, o => o === tr.o || behind(o)) && a.eta >= Math.max(wait, 0) + lineNeed + (tr.kind === 'landing' ? 60 : 30)) { ac.aiWhy = `lining up behind the ${tr.kind} ${tr.o.cs}`; return aiDo('TWR', ac, 'LU'); }
  // multiple line-ups: one or two already lined up further down the runway (an intersection departure ahead), this one
  // lines up behind them to go next, if the next arrival leaves room for them all
  const ahead = luOthers(ac);
  if (!lined && ac.state === 'HOLDPT' && ahead.length && ahead.length < 3 && ahead.every(o => o.onRwy && luM(o) > me + 300) && !rwyBusy(R, ac, true, o => ahead.includes(o)) && a.eta >= wait + lineNeed + 220*ahead.length + 60) { ac.aiWhy = `lining up behind ${ahead[0].cs}`; return aiDo('TWR', ac, 'LU'); }
}
// free to line up on: nothing on the runway (or one crossing it) but a departure already rolling away, past the point
// where this one enters, on the same runway
function luBehind(ac, R){
  const H = HOLDS[ac.hp];
  for (const o of S.acs) {
    if (o === ac || o.state !== 'TAKEOFF' || !o.onRwy || !sameRwy(R, o.rwyId || RWYS[0].id)) continue;
    if ((o.rwyId || RWYS[0].id) !== R.id || !H || !GN[H.rwy]) return false;
    const dir = (o.depRwy || depRw(o)) === R.lo ? 1 : -1;
    if ((R.mOf([o.x, o.y]) - R.mOf(GN[H.rwy].p))*dir < 300) return false;
  }
  return !rwyBusy(R, ac, true);
}
// clear to land: nothing on the runway (a departure already rolling is fine) and nobody ahead still to land
function landBlock(ac){
  const R = rwyOf(landRw(ac));
  if (rwyBlocked(landRw(ac))) return 'runway closed';
  if (APT.xing && S.xing.st !== 'CLOSED') return 'the road is closing';
  const togo = finalDist(ac), ahead = S.acs.find(o => o !== ac && o.kind === 'ARR' && o.airborne && o.mode === 'FINAL' && o.app && o.state !== 'MISSED' && sameRwy(R, rwyOf(landRw(o)).id) && finalDist(o) < togo - 0.3);
  if (ahead) return ahead.cs + ' to land first';
  const b = rwyBusy(R, ac, true);
  return b ? 'runway occupied' + (b.cs ? ' by ' + b.cs : '') : null;
}
function aiTower(ac){
  const n = ac.need || '';
  if (ac.ground) {
    if (n.startsWith('Holding short') && ac.hsAt && aiDue(ac, n, 3, 7)) {
      const R = rwyById(ac.hsAt), b = rwyBusy(R, ac), a = arrNear(R);
      // only one aircraft still to go past the crossing (landing, rolling out, departing): cross behind it, if the
      // arrival after it leaves room. Traffic already past the crossing doesn't stop it
      const k = ac.path ? ac.path.pts.findIndex(p => p.hs === ac.hsAt) : -1, tx = xTraffic(R.id, R.mOf(k >= 0 ? ac.path.pts[k] : [ac.x, ac.y]), ac);
      const mine = o => (o.onRwy ? (o.rwyId || RWYS[0].id) : rwyOf(depRw(o)).id) === R.id;
      if (tx.length <= 1 && !rwyBusy(R, ac, false, o => mine(o) && (o === tx[0] || !tx.includes(o))) && (tx.length ? arrNear(R, tx[0]) : a).eta > (tx.length ? 170 : 110)) {
        ac.aiWhy = tx.length ? `crossing behind ${tx[0].cs}` : ''; aiDo('TWR', ac, 'CROSS'); return; }
      ac.aiWhy = b ? 'runway occupied' : a.eta <= 110 ? `arrival ${a.nm.toFixed(1)} NM out` : S.acs.some(o => o.state === 'TAKEOFF' && sameRwy(R, o.rwyId || RWYS[0].id)) ? 'departure rolling' : '';
      if (!ac.aiWhy) aiDo('TWR', ac, 'CROSS');
      return;
    }
    if (ac.kind === 'DEP' && (n === 'Ready for departure' || n === 'Lined up') && aiDue(ac, n, 3, 7)) aiDepart(ac);
    return;
  }
  if (ac.kind === 'DEP') { if (n.startsWith('Airborne') && aiDue(ac, n, 2, 6)) { const cap = ac.aiCap; ac.aiCap = null; if (cap && aiDo('TWR', ac, `A${Math.round(cap/100)} HO`)) { ac.aiLev = { t: S.t, o: 'the hold' }; ac.aiWhy = 'kept below the hold'; } else aiDo('TWR', ac, 'HO'); } return; }
  // arrivals: cleared to land inside 5 NM once the runway is clear; sent around if it still isn't at about a mile
  if (ac.mode !== 'FINAL' || !ac.app || ac.state === 'MISSED' || ac.ctl && !rwyBusy(rwyOf(landRw(ac)), ac, true)) return;
  const togo = finalDist(ac), blk = landBlock(ac); ac.aiWhy = blk || '';
  // closed for longer than it takes to get here: send it around now rather than at the last moment
  if (togo > 5.5 && toParallel(ac, 'TWR')) return;
  if (rwyShut(landRw(ac)) && !shutOpenFor(ac) && togo < 6 && ac.aiGa !== (ac.gaCount || 0)) { ac.aiGa = ac.gaCount || 0; return aiDo('TWR', ac, 'GA'); }
  if (!ac.ctl && togo < 5 && !blk) { const ex = vacAround(ac); return aiDo('TWR', ac, ex ? 'CTL VAC ' + ex : 'CTL'); }
  if (togo < 0.8 && (ac.ctl || blk) && ac.aiGa !== (ac.gaCount || 0)) { ac.aiGa = ac.gaCount || 0; return aiDo('TWR', ac, 'GA'); }
}
// an exit whose holding point has a departure waiting at it (or taxiing to it) would block the arrival's way off the
// runway (and the departure can't go with it there): name another exit it can make, with the landing clearance
function vacAround(ac){
  const taken = e => S.acs.some(o => o !== ac && o.ground && (o.hp === e && ['HOLDPT', 'TAXI', 'LINEUP'].includes(o.state) || (HOLDS[e] && GN[HOLDS[e].node] && dist(o.x, o.y, ...GN[HOLDS[e].node].p) < 60*M2NM && !o.onRwy)));
  let all; try { all = vacAll(ac); } catch(e) { return null; }
  if (!all.some(taken)) return null;
  let ch; try { ch = vacChoices(ac); } catch(e) { return null; }
  return ch.find(e => !taken(e)) || null;
}
// Winston Churchill Avenue (Gibraltar): closed for anything landing, taking off or crossing, open again once quiet
function aiRoad(){
  const X = S.xing; if (!APT.xing) return;
  const want = S.acs.some(o => o.onRwy || (o.kind === 'ARR' && o.airborne && o.app && o.state !== 'MISSED' && estToGo(o, finOf(o)) < 17) ||
    (o.kind === 'DEP' && o.ground && (['HOLDPT', 'LINEUP', 'LINEDUP', 'TAKEOFF'].includes(o.state) || (o.state === 'TAXI' && o.hp))) || (o.kind === 'DEP' && o.ground && o.state === 'READY'));
  if (want && (X.st === 'OPEN' || X.st === 'OPENING')) { aiVeh('TWR', () => { log('atc', 'Winston Churchill Avenue barriers, close the road for runway traffic', 'TOWER'); toggleXing(); }); S.aiRoadT = S.t; }
  else if (!want && X.st === 'CLOSED' && S.t - (S.aiRoadT || 0) > 240 && !S.acs.some(o => o.kind === 'ARR' && o.airborne && o.state !== 'PRE' && estToGo(o, o.app ? finOf(o) : FINAL[landRw(o)]) < 24)) aiVeh('TWR', () => { log('atc', 'Winston Churchill Avenue barriers, open the road', 'TOWER'); toggleXing(); });
}
function aiTowerVehicles(){
  if (typeof VEH === 'undefined') return;
  for (const v of vehAsking()) if (v.req.k === 'rwy' && aiDue(v, 'rwy' + v.req.t, 4, 9)) {
    const R = v.req.R; if (rwyClearFor(R) && !rwyBusy(R) && arrNear(R).eta > 120) aiVeh('TWR', () => vehApprove(v));
  }
  const C = S.rc;
  if (C && C.st === 'READY' && C.v.need && aiDue(C.v, 'enter' + C.t, 5, 10)) { if (!rwyBusy(C.R) && arrNear(C.R).eta > 300) aiVeh('TWR', () => command('OPS1 ENTER')); }
  if (C && C.st === 'ON' && arrNear(C.R).nm < 4 && aiDue(C.v, 'vac' + C.t, 1, 3)) aiVeh('TWR', () => command('OPS1 VACATE'));
}
function aiGroundVehicles(){
  if (typeof VEH === 'undefined') return;
  for (const v of vehAsking()) if (v.req.k === 'twy' && aiDue(v, 'twy' + v.req.t, 4, 9)) aiVeh('GND', () => vehApprove(v));
}

// ── Approach: answer check-ins, sequence arrivals onto the approach with wake spacing (and a gap for departures),
// stack the rest in the holds 1,000 ft apart, hand them to Tower on final, take go-arounds back, approve diversions
// the published hold a flight waits at (the charts' STAR holds, never over the final): the first one still on its
// arrival route, else the nearest one (after a go-around, or once past it)
const PUB_HOLDS = () => Object.values(WP).filter(w => w.hold && w.p && Math.hypot(...w.p) > 8);   // not the missed approach holds over the field
function holdFixFor(ac){
  const on = (ac.route || []).find(id => WP[id] && WP[id].hold);
  if (on) return on;
  let best = null, bd = 1e9;
  const all = PUB_HOLDS(), list = all.length ? all : Object.values(WP).filter(w => w.hold && w.p);   // Bristol: only BRI, over the field
  for (const w of list) { const d = dist(ac.x, ac.y, ...w.p); if (d < bd) { bd = d; best = w.id; } }
  return best;
}
// into the hold at hf, at a free level in its stack (its present level if that is one)
function holdCmd(ac, hf){
  ac.aiLev = null;   // a level-off for traffic ends with the hold: the stack gives it its level now
  const keep = { mode: ac.mode, hold: ac.hold }; ac.mode = 'HOLD'; ac.hold = { name: hf, c: WP[hf].p };   // judge the stack as if already in it
  const lv = ac.aiSlot != null && !stackNow(ac).some(o => Math.abs(slotOf(o) - ac.aiSlot) < 990) ? ac.aiSlot : joinLevel(ac); ac.mode = keep.mode; ac.hold = keep.hold;
  ac.aiSlot = lv;
  // the level first: it ends a descent on the approach profile, so the hold starts at a stack level, not wherever it was
  return ac.via || Math.abs(lv - (ac.tgtAlt ?? ac.alt)) >= 100 ? `A${Math.round(lv/100)} HOLD ${hf}` : 'HOLD ' + hf;
}
// ── the stack: everyone waiting at a fix (or at one close by) has a level of their own, a newcomer on top. The bottom
// one leaves first; those above step down one level at a time, and only once the level below is really empty
const slotOf = o => o.aiSlot ?? lvlOf(o);
function holdBase(ac){ const F = FINAL[landRw(ac)], H = WP[holdFixOf(ac)]; return Math.max((F && F.alt) || APT.appAlt || 3000, APT.appAlt || 0, (H && H.hold && H.hold.min) || 0); }
// a hold at the fix where an approach begins (Innsbruck's RTT): arrivals leave it descending on the approach
const holdOnEntry = fix => !!WP[fix] && Object.values(FINAL).some(F => F && (F.entry === fix || (F.pts && F.pts[0] && dist(...WP[fix].p, ...F.pts[0]) < 3)));
// those in the stack or on their way to it: every one of them keeps a level of their own
const stackNow = ac => stackPeers(ac);
function joinLevel(ac){
  const base = holdBase(ac), occ = stackNow(ac).map(slotOf), top = Math.max(-1e9, ...occ);
  const slots = []; for (let L = base; L <= 24000; L += 1000) slots.push(L);
  const free = L => !occ.some(u => Math.abs(u - L) < 990);
  // a level it can reach without climbing or descending through anyone in the stack
  const reach = L => !occ.some(u => u > Math.min(ac.alt, L) + 10 && u < Math.max(ac.alt, L) - 10);
  // the nearest free level it can reach without passing anyone's (a gap low down left by the one that went first will
  // do: it is then next to go); boxed in, the nearest free level of all
  const near = (a, b) => Math.abs(a - ac.alt) - Math.abs(b - ac.alt), ok = slots.filter(free);
  // under the stack (back from a go-around): a level below its base, down to the approach altitude, rather than climb through it
  const F = FINAL[landRw(ac)], floor = Math.max((F && F.alt) || 3000, 2000);
  const under = []; for (let L = base - 1000; L >= floor - 10; L -= 1000) if (free(L)) under.push(L);
  // not one an arrival just sent in from the hold is still descending through (Innsbruck's approach starts at RTT),
  // nor one a departure close by is climbing to or through (Bristol's hold is over the field)
  const calm = L => !appPathBusy(ac, L) && !S.acs.some(o => o.kind === 'DEP' && o.airborne && (o.tgtAlt ?? o.alt) > L - 990 && o.alt < L + 990 && dist(o.x, o.y, ac.x, ac.y) < 12);
  return ok.filter(reach).filter(calm).sort(near)[0] ?? under.filter(reach).filter(calm).sort(near)[0] ?? ok.filter(reach).sort(near)[0] ?? under.filter(reach).sort(near)[0] ?? ok.sort(near)[0] ?? Math.max(base, top + 1000);
}
const holdFixOf = ac => ac.mode === 'HOLD' && ac.hold ? ac.hold.name : holdFixFor(ac) || (ac.route && ac.route.length ? ac.route[ac.route.length - 1] : 'pp');
const holdFixP = ac => { const f = holdFixOf(ac); return ac.mode === 'HOLD' && ac.hold ? ac.hold.c : WP[f] ? WP[f].p : [ac.x, ac.y]; };
// the runway is shut (debris, an inspection, someone on it): nothing more is sent in until it reopens
// (a routine runway check by the ops car is Tower's to fit between arrivals: it isn't a closure)
const rwyShut = rw => rwyBlocked(rw);
// the bottom of the stack: the approach altitude once it is near the fix where it waits (so it starts the approach
// from the right height), its arrival altitude while still far out
function stackBase(ac){
  const low = holdBase(ac);
  return dist(ac.x, ac.y, ...holdFixP(ac)) < 22 ? low : Math.max(APT.inboundAlt ? APT.inboundAlt(ac.gate) : 7000, low);
}
// the others waiting at the same fix, or at one close by (New York's fixes are a few miles apart)
const stackPeers = ac => { const fix = holdFixOf(ac), P = holdFixP(ac); return S.acs.filter(o => o !== ac && o.kind === 'ARR' && o.airborne && o.state !== 'PRE' && !o.app && !o.handed && (holdFixOf(o) === fix || dist(...holdFixP(o), ...P) < 14)); };
const lvlOf = o => o.cleared ?? Math.round(o.alt/100)*100;
function stackLevel(ac, base = stackBase(ac)){
  const used = stackPeers(ac).map(slotOf);
  let lv = base; while (used.some(u => Math.abs(u - lv) < 990) && lv < 24000) lv += 1000;
  return lv;
}
// why an arrival can't be sent in yet: its landing time would be too close to one already on the approach (with a gap
// for a departure when one is due); null when there is room
function spacingFor(ac, F, R){
  const e = eta(ac, F), gap = holdGap(R, depGapS(R));
  for (const o of S.acs) {
    if (o === ac || o.kind !== 'ARR' || !o.airborne || !o.app || o.state === 'MISSED' || o.state === 'DIVERTING' || o.handed || !sameRwy(R, rwyOf(landRw(o)).id)) continue;
    const oe = eta(o), lead = oe <= e ? o : ac, trail = lead === o ? ac : o, need = Math.max(landGapS(lead, trail, R), gap)*1.05;
    if (Math.abs(oe - e) < need) return `spacing behind ${o.cs}${gap > landGapS(lead, trail, R) ? ', with a gap for a departure' : ''}`;
  }
  return null;
}
// the one holding lowest below it in the stack it is in (or whose fix it is about to pass over): it leaves first
function stackBelow(ac){
  const inStack = ac.mode === 'HOLD' || ((ac.route || []).includes(holdFixOf(ac)) && dist(ac.x, ac.y, ...holdFixP(ac)) < 25);
  if (!inStack) return null;
  return stackNow(ac).filter(o => o.mode === 'HOLD' && slotOf(o) < Math.min(slotOf(ac), ac.alt) - 500 && !o.emerg).sort((a, b) => slotOf(a) - slotOf(b))[0] || null;
}
// another arrival lower down near it or near the start of its approach, not yet cleared: it would descend through it
function waitsUnder(ac){
  const F = FINAL[landRw(ac)]; if (!F) return null;
  const ep = F.entry && WP[F.entry] ? WP[F.entry].p : F.pts[0];
  return S.acs.find(o => o !== ac && o.kind === 'ARR' && o.airborne && !o.app && o.state !== 'PRE' && !o.handed && o.alt < ac.alt - 400 && (dist(o.x, o.y, ac.x, ac.y) < 10 || dist(o.x, o.y, ...ep) < 8)) || null;
}
const waitsFor = ac => ac.emerg ? null : stackBelow(ac) || waitsUnder(ac);
function aiSequence(list){
  // soonest first
  list.sort((a, b) => (Math.round(eta(a, FINAL[landRw(a)])/10) - Math.round(eta(b, FINAL[landRw(b)])/10)) || (lvlOf(a) - lvlOf(b)));
  // first come, first served: only the arrival due first is sent in, or the one it is waiting for (the bottom of its
  // stack, someone below on its way in). One due later (still far out, or at a far stack) would take the gap those
  // waiting nearer need, and they would then sit in the hold while it closed in on them. So the holds empty one behind
  // the other at the minimum spacing
  const first = {};
  for (const ac of list) {
    const F = FINAL[landRw(ac)];
    if (!F || ac.emerg || (ac.state === 'MISSED' && S.t - (ac.gaT || 0) < 75)) continue;
    const R = rwyOf(landRw(ac)), e = eta(ac, F);
    if (!first[R.id] || e < first[R.id].e) first[R.id] = { e, ac };
  }
  const may = new Set();
  for (const id in first) { let a = first[id].ac; for (let k = 0; a && k < 12 && !may.has(a); k++) { may.add(a); a = waitsFor(a); } }
  for (const ac of list) {
    const rw = landRw(ac), F = FINAL[rw], R = rwyOf(rw), n = ac.need || '';
    if (S.t < (ac.aiNext || 0) || !F) continue;
    if (ac.state === 'MISSED' && S.t - (ac.gaT || 0) < 75) { ac.aiWhy = 'climbing out after the go-around'; continue; }
    const shut = rwyShut(rw);
    let ok = !shut;
    ac.aiWhy = shut ? `holding, runway closed (${shut})` : ok ? '' : 'in sequence behind the others';
    if (ok && !ac.emerg) {
      const dg = depGapS(R), gap = holdGap(R, dg); ac.aiGapRun = dg ? (gap ? 0 : 1) : null;
      const why = spacingFor(ac, F, R);
      if (why) { ok = false; ac.aiWhy = why; }
      else if (first[R.id] && !may.has(ac)) { ok = false; ac.aiWhy = 'in sequence behind the others'; }
      // too close behind (or level with) one already on the approach: slow down to open the gap, rather than hold
      if (!ok && ac.mode !== 'HOLD' && ac.state !== 'MISSED' && !ac.spdAssigned && ac.ias > 195 && aiDue(ac, 'spd', 3, 8)) aiDo('APP', ac, estToGo(ac, F) > 25 ? 'S210' : 'S180');
    }
    // others waiting lower down near its way in: they go first (it would descend through them)
    // anyone holding below in the stack it is in (or whose fix it is about to pass over) goes first
    if (ok && !ac.emerg) { const below = stackBelow(ac);
      if (below) { ok = false; ac.aiWhy = `${below.cs} below leaves the hold first`; } }
    if (ok && !ac.emerg) { const under = waitsUnder(ac);
      if (under) { ok = false; ac.aiWhy = `waiting for ${under.cs} below to go first`; } }
    // a departure passing under the hold (Heathrow's Detling departures under BIG): it leaves the hold all the same,
    // but stays at its level until the departure is past (the look-ahead then lets it down)
    // (a hold over the field, Bristol's BRI: the departures climb out right under it, so it waits for them instead)
    let keep = ok && !ac.emerg && ac.mode === 'HOLD' ? depUnder(ac) : null;
    if (keep && ac.hold && Math.hypot(...ac.hold.c) < 10) { ok = false; ac.aiWhy = `waiting for ${keep.cs} to pass below`; keep = null; }
    // too high to start the approach from here: down to the approach altitude first
    const high = ok && !ac.emerg && ac.alt > ELEV + estToGo(ac, F)*290 + 1000;
    if (high) ac.aiWhy = 'descending before the approach';
    // the descent on the approach would meet someone not on it (a departure climbing out, a flight in the hold), or
    // would while it is still at its level (the profile can keep it up there a while)
    if (ok && !high && !ac.emerg) { const clash = airNow().find(o => o !== ac && !(o.app && o.kind === 'ARR') && (conflictWith(ac, o, keep ? lvlOf(ac) : (F.alt || APT.appAlt || 3000)) >= 0 || conflictWith(ac, o, lvlOf(ac)) >= 0));
      if (clash) { ok = false; ac.aiWhy = `waiting for ${clash.cs} to pass`; } }
    if (ok && !high && !ac.aiLev && aiDue(ac, 'app' + (ac.gaCount || 0), 3, 7)) { const lv = keep ? Math.round(lvlOf(ac)/100) : 0; if (aiDo('APP', ac, keep ? `APP A${lv}` : 'APP')) { ac.aiWhy = ''; ac.aiSlot = null; if (keep) { ac.aiLev = { t: S.t, o: keep.cs }; ac.aiWhy = `level above ${keep.cs}`; } if (ac.aiGapRun != null) { const r = (S.aiRun ||= {}); r[R.id] = ac.aiGapRun ? (r[R.id] || 0) + 1 : 0; } continue; } }
    // waiting: into the published hold, joined as it reaches the fix (or straight there after a go-around or once past it)
    if (!(ok && !high) && !ac.emerg && ac.state !== 'DIVERTING' && !(ac.state === 'MISSED' && S.t - (ac.gaT || 0) < 75)) {
      const hf = holdFixFor(ac), W = hf && WP[hf];
      if (W && !(ac.mode === 'HOLD' && ac.hold && ac.hold.name === hf)) {
        const onRt = ac.mode === 'NAV' && (ac.route || []).includes(hf), near = dist(ac.x, ac.y, ...W.p) < 8;
        if ((onRt ? ac.route[0] === hf && near : !ok) && aiDue(ac, 'hold' + hf, 2, 5)) { aiDo('APP', ac, holdCmd(ac, hf)); ac.aiWhy = ac.aiWhy || 'holding'; }
      }
    }
    // not yet: answer the call and keep it 1,000 ft clear of the others waiting at the same fix
    if (ac.aiLev || (ac.state === 'MISSED' && !n)) continue;
    const cur = lvlOf(ac), d = estToGo(ac, F), peers = stackPeers(ac), free = L => !peers.some(o => Math.abs(slotOf(o) - L) < 990);
    if (n === 'Initial call' || n === 'Missed approach' || n === 'Back on frequency') { if (aiDue(ac, n, 3, 7)) { const want = free(cur) && (n !== 'Initial call' || cur >= stackBase(ac)) ? cur : stackLevel(ac); aiDo('APP', ac, `A${Math.round((safeLevel(ac, [want, want + 1000, want + 2000, Math.ceil(ac.alt/1000)*1000]) ?? cur)/100)}`); } continue; }
    if (S.t - (ac.aiStack || 0) < 20) continue;
    // heading for a stack and within 40 NM of it: given its level there now, while it has room to climb or descend to it
    if (ac.mode !== 'HOLD' && ac.aiSlot == null && ac.state !== 'MISSED' && (ac.route || []).includes(holdFixOf(ac)) && dist(ac.x, ac.y, ...holdFixP(ac)) < (stackNow(ac).some(o => o.mode === 'HOLD') ? 70 : 40)) {
      const lv = joinLevel(ac); ac.aiSlot = lv; ac.aiStack = S.t; if (Math.abs((ac.tgtAlt ?? ac.alt) - lv) >= 100) aiDo('APP', ac, `A${Math.round(lv/100)}`); continue; }
    if (ac.mode === 'HOLD' || ac.aiSlot != null) {
      if (ac.aiSlot == null) ac.aiSlot = Math.round(lvlOf(ac)/100)*100;   // holding by itself at the end of its route
      // in the stack: sharing a level (a newcomer it didn't know about) goes back on top; else one level down once it is empty
      const occ = stackNow(ac), mine = ac.aiSlot;
      if (occ.some(o => (o.mode === 'HOLD' || o.aiSlot != null) && Math.abs(slotOf(o) - mine) < 990 && (estToGo(o, FINAL[landRw(o)]) < d || o.cs < ac.cs))) { const lv = joinLevel(ac); ac.aiStack = S.t; ac.aiSlot = lv; aiDo('APP', ac, `A${Math.round(lv/100)}`); continue; }
      // (the stack keeps its own levels: anything else that moved it is put right)
      if (Math.abs((ac.tgtAlt ?? ac.alt) - mine) >= 100) { ac.aiStack = S.t; aiDo('APP', ac, `A${Math.round(mine/100)}`); continue; }
      const L = mine - 1000;
      if (L >= holdBase(ac) - 10 && !occ.some(o => Math.abs(slotOf(o) - L) < 990) && !airNow().some(o => o !== ac && Math.abs(o.alt - L) < 990 && dist(o.x, o.y, ac.x, ac.y) < 8) && !appPathBusy(ac, L) && !S.acs.some(o => o.kind === 'DEP' && o.airborne && (o.tgtAlt ?? o.alt) > L - 990 && o.alt < L + 990 && dist(o.x, o.y, ac.x, ac.y) < 12) && Math.abs(ac.alt - mine) < 200) {
        ac.aiStack = S.t; ac.aiSlot = L; aiDo('APP', ac, `A${Math.round(L/100)}`); }
      continue;
    }
    // on the way in: down towards the stack's base when the levels below are free, never through someone else's
    const base = stackBase(ac), slots = []; for (let L = base; L < cur - 50; L += 1000) slots.push(L);
    let to = cur; for (const L of slots.reverse()) { if (!free(L)) break; to = L; }
    if (to < cur) { const lv = safeLevel(ac, slots.filter(L => L >= to).reverse()); if (lv != null && lv < cur) { ac.aiStack = S.t; aiDo('APP', ac, `A${Math.round(lv/100)}`); } }
  }
}
// cleared for a runway that has shut while its parallel is open: cleared for the parallel instead (one already on the
// final is turned on to an intercept for it first). True while that is in hand
function toParallel(ac, seat){
  if (!ac.app || ac.emerg || ac.state === 'MISSED' || !rwyBlocked(ac.app)) return false;
  const p = parallelEnd(ac.app), F = p && FINAL[p];
  if (!F || rwyBlocked(p)) return false;
  if (!aiDue(ac, 'par' + p + (ac.gaCount || 0), 2, 5)) return true;
  // only into a gap in the parallel's own stream (and behind the ones already moved over); no gap: held, or sent around
  if (spacingFor(ac, F, rwyOf(p))) return false;
  let cmd = `APP ${p}`;
  if (ac.mode === 'FINAL') {
    // aim at the parallel's centreline 3 NM further on, at no more than 30 degrees to it
    const n = F.pts.length, thr = F.pts[n - 1], crs = brg(...F.pts[n - 2], ...thr), d = Math.max(0, finalDist(ac) - 3);
    const tgt = [thr[0] - Math.sin(crs*D2R)*d, thr[1] - Math.cos(crs*D2R)*d], off = Math.max(-30, Math.min(30, angDiff(crs, brg(ac.x, ac.y, ...tgt))));
    cmd = `H${String(Math.round((crs + off + 360) % 360) || 360).padStart(3, '0')} ${cmd}`;
  }
  ac.aiWhy = `runway ${ac.app} closed: on to ${p}`;
  aiDo(seat, ac, cmd);
  return true;
}
function aiApproach(ac){
  const n = ac.need || '';
  if (ac.state === 'DIVERTING') return true;
  if (ac.diverting && n.startsWith('Diverting') && aiDue(ac, n, 3, 7)) { aiDo('APP', ac, 'DCT ' + ac.diverting); return true; }
  if (n === 'Unable approach') return true;   // holding for the weather; the crew will ask to divert
  if (n === 'Request RNP approach' && aiDue(ac, n, 3, 6)) { aiDo('APP', ac, 'APP RNP'); return true; }
  if (ac.app) {
    // the runway has shut: over to the parallel if there is one, else off the approach and into the hold, unless it
    // opens again before it gets there
    if ((ac.mode !== 'FINAL' || finalDist(ac) > 5.5) && toParallel(ac, 'APP')) return true;
    const shut = rwyShut(ac.app);
    if (shut && !ac.emerg && ac.mode !== 'FINAL' && !shutOpenFor(ac) && aiDue(ac, 'shut', 2, 5)) { const hf = holdFixFor(ac); if (hf) { ac.aiWhy = `holding, runway closed (${shut})`; aiDo('APP', ac, holdCmd(ac, hf)); return true; } }
    // keep the gap to the one ahead: slow down while it closes up, back to the hold if it can't be made up
    const L = appLeader(ac), R = rwyOf(landRw(ac)), gap = L ? eta(ac) - eta(L) : 1e9, need = L ? landGapS(L, ac, R) : 0, togo = estToGo(ac, finOf(ac));
    if (L && !ac.emerg) {
      const slow = Math.max(160, (ac.perf.vapp || 135) + 15);
      if (gap < need*0.6 && ac.mode !== 'FINAL' && togo > 15 && aiDue(ac, 'rehold', 2, 4)) { const hf = holdFixFor(ac); if (hf) { ac.aiWhy = `too close behind ${L.cs}: back to the hold`; aiDo('APP', ac, holdCmd(ac, hf)); return true; } }
      if (gap < need*1.05 && togo > 5 && (!ac.spdAssigned || ac.tgtSpd > slow + 5) && aiDue(ac, 'slow' + L.cs, 2, 4)) { ac.aiWhy = `slowing behind ${L.cs}`; aiDo('APP', ac, 'S' + slow); }
    }
    // on the approach: transfer to Tower once established inside about 11 NM (still slowed if it is close behind)
    if (ac.mode === 'FINAL' && finalDist(ac) < 11 && aiDue(ac, 'ho', 1, 4)) aiDo('APP', ac, ac.spdAssigned && gap > need*1.1 ? 'SN HO' : 'HO');
    else if (n === 'Initial call' && aiDue(ac, n, 3, 7)) aiDo('APP', ac, 'IDENT');
    return true;
  }
  return false;   // to be sequenced
}

// ── Departure: direct to the exit fix, further climb, transfer to the next unit
function climbTop(){ return (APT.climbFL || 80)*100; }
function aiDeparture(ac){
  const n = ac.need || '';
  if (n === 'Ready for transfer' && aiDue(ac, n, 2, 6)) {
    // a hold ahead above it: kept on its level and on frequency until it is past (the next unit would climb it through)
    const st = stackAhead(ac); if (st) { ac.aiWhy = `staying below the hold, ${st.cs} above`; ac.aiNeedT = ac.aiNeedT || S.t; if (S.t - ac.aiNeedT < 600) return; }
    return aiDo('DEP', ac, 'HO');
  }
  // a hold on or near its way out (Heathrow's Detling departures pass BIG): stopped a level under the lowest one there
  const cap = depHoldCap(ac);
  if (cap != null && (ac.tgtAlt ?? ac.alt) > cap + 50) { ac.aiWhy = 'kept below the hold'; return aiDo('DEP', ac, `A${Math.round(cap/100)}`); }
  if (ac.aiLev) return;   // levelled off for traffic: the climb and the direct wait until it is clear
  if (n === 'Request climb' && cap != null) return;
  if (n.startsWith('Request direct') && aiDue(ac, n, 3, 7)) return aiDo('DEP', ac, 'DCT ' + n.split(' ').pop());
  if (n === 'Request climb' && aiDue(ac, n, 3, 7)) return aiDo('DEP', ac, `C${Math.round(climbTop()/100)}`);
}

// the level a departure stays at under holds near its way out: those holding above it within 6 NM, or within 15 NM
// and roughly ahead; null when there are none (or once it is past them). Not under a hold where an approach begins:
// arrivals come down out of it, so there the look-ahead keeps them apart
function depHoldCap(ac){
  let low = 1e9;
  for (const o of S.acs) {
    if (o.kind !== 'ARR' || !o.airborne || o.mode !== 'HOLD' || o.app || lvlOf(o) < ac.alt - 900 || (o.hold && holdOnEntry(o.hold.name))) continue;
    const c = o.hold && o.hold.c ? o.hold.c : [o.x, o.y], d = Math.min(dist(o.x, o.y, ac.x, ac.y), dist(...c, ac.x, ac.y));
    if (d < 6 || (d < 15 && Math.abs(angDiff(ac.trk ?? ac.hdg, brg(ac.x, ac.y, ...c))) < 70)) low = Math.min(low, lvlOf(o), o.alt);
  }
  if (low > 1e8) return null;
  return Math.max(Math.floor((low - 1000)/1000)*1000, Math.ceil((ELEV + 1500)/1000)*1000);
}
// a departure climbing out below a holder, within 12 NM of it and still closing (or within 5 NM)
function depUnder(ac){
  const c = ac.hold && ac.hold.c ? ac.hold.c : [ac.x, ac.y];
  return S.acs.find(o => o.kind === 'DEP' && o.airborne && !o.ground && o.alt < ac.alt - 300 && o.alt > ELEV + 1500 && (() => {
    const d = Math.min(dist(o.x, o.y, ...c), dist(o.x, o.y, ac.x, ac.y));
    return d < 5 || (d < 12 && Math.abs(angDiff(o.trk ?? o.hdg, brg(o.x, o.y, ...c))) < 80);
  })());
}
// someone holding above a departure, within 15 NM and roughly ahead of it
function stackAhead(ac){
  return S.acs.find(o => o.kind === 'ARR' && o.airborne && o.mode === 'HOLD' && o.alt > ac.alt + 500 && dist(o.x, o.y, ac.x, ac.y) < 15 && Math.abs(angDiff(ac.trk ?? ac.hdg, brg(ac.x, ac.y, o.x, o.y))) < 70);
}

// ── a short look ahead (two minutes) for the radar seats: level off (or step up) whoever is climbing or descending
// into another, to a level that is clear of everyone
function project(a, t, lv){
  const m = (a.gs || 0)/3600*t, h = (a.trk ?? a.hdg)*D2R, tgt = lv ?? a.tgtAlt ?? a.alt;
  const vs = lv == null ? a.vs : Math.abs(lv - a.alt) < 100 ? 0 : lv > a.alt ? Math.max(1500, a.perf.climb) : -Math.max(2500, Math.abs(a.vs) || 0);
  // the last 100 ft to a level take a while: a flight levelling off counts as not quite there yet
  const alt = vs > 0 ? Math.min(tgt - (Math.abs(tgt - a.alt) > 30 ? 100 : 0), a.alt + vs*t/60) : vs < 0 ? Math.max(Math.min(tgt, a.alt) + (Math.abs(tgt - a.alt) > 30 ? 100 : 0), a.alt + vs*t/60) : a.alt;
  return [a.x + Math.sin(h)*m, a.y + Math.cos(h)*m, alt];
}
// the first time (s, within two minutes) a and b come within 3.6 NM and 1,000 ft, or -1; lv: a flying to that level instead
function conflictWith(a, b, lv){
  for (let t = 0; t <= 120; t += 5) { const [x1, y1, z1] = project(a, t, lv), [x2, y2, z2] = project(b, t); if (Math.hypot(x1 - x2, y1 - y2) < 3.6 && Math.abs(z1 - z2) < 950) return t; }   // 1,000 ft apart, give or take a few feet
  return -1;
}
// a flight cleared for the approach is descending to lv nearby: that level is its, not for holding at
// (every level from where it is now down to where it is going: it will descend through them)
const appPathBusy = (ac, lv) => !ac.app && S.acs.some(o => o !== ac && o.kind === 'ARR' && o.airborne && o.app && o.state !== 'MISSED' && lv < o.alt + 990 && lv > Math.min(o.tgtAlt ?? o.alt, o.alt) - 990 && dist(o.x, o.y, ac.x, ac.y) < 12);
const airNow = () => S.acs.filter(a => a.airborne && a.state !== 'PRE' && a.alt > 500);   // handed-off ones still fly here
// a level for ac that conflicts with nobody (null: none of the candidates works)
function safeLevel(ac, cands){
  const air = airNow().filter(o => o !== ac);
  return cands.find(lv => lv >= 1000 && lv <= 24000 && !appPathBusy(ac, lv) && !air.some(o => conflictWith(ac, o, lv) >= 0)) ?? null;
}
// who gives way: a departure to an arrival, a go-around to one on the approach, a flight not yet cleared for the
// approach to one that is; otherwise the later callsign
const yieldRank = a => a.kind === 'DEP' ? 0 : a.state === 'MISSED' ? 1 : !a.app ? 2 : 3;
// (a flight on the approach can still be stopped in its descent, until it is on the final)
const canMove = a => aiOwns(a) && a.mode !== 'FINAL' && !(a.kind === 'ARR' && a.aiSlot != null) && !(a.kind === 'DEP' && a.alt < ELEV + 2500) && ['APP', 'DEP', 'TWR'].includes(seatOf(a));
// two on the approach: the one behind (further to go) gives way to the one ahead
const yields = (a, o) => a.kind === 'ARR' && o.kind === 'ARR' && a.app && o.app && a.state !== 'MISSED' && o.state !== 'MISSED' ? eta(a) > eta(o) : yieldRank(a) < yieldRank(o) || (yieldRank(a) === yieldRank(o) && a.cs > o.cs);
function aiProbe(){
  const air = airNow();
  for (const ac of air) {
    const s = seatOf(ac);
    if (!canMove(ac) || S.t < (ac.aiNext || 0) || (s === 'TWR' && ac.kind !== 'DEP')) continue;
    let hit = null;
    for (const o of air) {
      if (o === ac) continue;
      const t = conflictWith(ac, o); if (t < 0) continue;
      const mine = yields(ac, o);
      if (!mine && canMove(o)) continue;   // the other gives way
      hit = o; break;
    }
    if (hit) {
      const now = Math.round(ac.alt/100)*100, floor = ac.kind === 'ARR' ? Math.max(APT.appAlt || 2000, 2000) : now;
      const r1 = Math.ceil(ac.alt/1000)*1000, d1 = Math.floor(ac.alt/1000)*1000;
      // whole thousands only, so it stays a full 1,000 ft from the levels everyone else is given
      // (one on the approach only stops its descent: climbing back would take it into the holds)
      const n1 = Math.round(ac.alt/1000)*1000, cands = (ac.kind === 'DEP' ? [n1, d1, r1, r1 + 1000, r1 + 2000] : ac.app && ac.state !== 'MISSED' ? [r1, n1].filter(l => l <= ac.alt + 300) : [n1, r1, d1, r1 + 1000, d1 - 1000, r1 + 2000].filter(l => l >= floor)).filter((l, i, A) => A.indexOf(l) === i);
      const lv = safeLevel(ac, cands);
      if (lv != null && Math.abs(lv - (ac.tgtAlt ?? ac.alt)) >= 200) { if (aiDo(s, ac, `A${Math.round(lv/100)}`)) { ac.aiLev = { t: S.t, o: hit.cs }; ac.aiWhy = `kept clear of ${hit.cs}`; } }
      else if (ac.aiLev) ac.aiLev.t = S.t;
    } else if (ac.aiLev && S.t - ac.aiLev.t > 40) {
      // clear again: back down the published profile, or on with the climb (if that is clear too)
      if (ac.kind === 'ARR' && ac.app && ac.mode !== 'FINAL') { if (depUnder(ac)) ac.aiLev.t = S.t - 20; else { ac.aiLev = null; ac.aiWhy = ''; aiDo(s, ac, 'APP'); } }
      else if (ac.kind === 'DEP') { const top = ac.reqClimb ? climbTop() : sidTop(ac); if (safeLevel(ac, [top]) != null && !stackAhead(ac)) { ac.aiLev = null; ac.aiWhy = ''; aiDo(s, ac, `C${Math.round(top/100)}`); } else ac.aiLev.t = S.t - 20; }
      else { ac.aiLev = null; ac.aiWhy = ''; }
    }
  }
}

// ── every second: each AI seat works the flights it owns
function stepAI(dt){
  if (!aiActive()) return;
  S.aiAcc = (S.aiAcc || 0) + dt; if (S.aiAcc < 1) return; S.aiAcc = 0;
  const seq = [];
  for (const ac of S.acs.slice()) {
    if (!S.acs.includes(ac) || !aiOwns(ac) || S.t < (ac.aiNext || 0) || ac.lost) continue;
    const s = seatOf(ac), n = ac.need || '';
    if (ac.emerg && !ac.emerg.ack) { if (aiDue(ac, 'rog', 2, 5)) aiDo(s, ac, 'ROG'); continue; }
    if (n === 'Say again' && ac.lastCmd) { if (aiDue(ac, n + ac.lastCmd, 2, 4)) aiDo(s, ac, ac.lastCmd); continue; }
    if (n === 'Back on frequency' && ac.airborne && s !== 'APP') { if (aiDue(ac, n, 2, 5)) aiDo(s, ac, 'HO'); continue; }
    if (s === 'GND') aiGround(ac);
    else if (s === 'TWR') aiTower(ac);
    else if (s === 'DEP') aiDeparture(ac);
    else if (s === 'APP' && !aiApproach(ac)) seq.push(ac);
  }
  if (seq.length) aiSequence(seq);
  // learn how long landings occupy each runway
  for (const ac of S.acs) if (ac.aiTd && ac.ground && !ac.onRwy) { const id = ac.rwyId || RWYS[0].id, o = S.t - ac.aiTd; ac.aiTd = null; (S.aiOcc ||= {})[id] = S.aiOcc[id] ? S.aiOcc[id]*0.6 + o*0.4 : o; }
  if (S.seats.APP === 'AI' || S.seats.DEP === 'AI' || S.seats.TWR === 'AI' || S.acs.some(a => a.aiSeat)) aiProbe();
  if (S.seats.GND === 'AI') aiGroundVehicles();
  if (S.seats.TWR === 'AI') { aiTowerVehicles(); aiRoad(); }
  // the release for a departure taxiing out is Tower's to ask for
  if (S.seats.TWR === 'AI') for (const ac of S.acs) {
    if (ac.kind !== 'DEP' || !ac.ground || ac.cto || !['READY', 'TAXI'].includes(ac.state) || !needRel(ac) || (ac.rel && ac.rel.st !== 'EXP') || ac.meSeat === 'TWR') continue;
    if (S.t >= (ac.aiNext || 0) && aiDue(ac, 'rel' + (ac.rel ? ac.rel.until : ''), 6, 14)) aiDo('TWR', ac, 'REL');
  }
}
S.listeners.push((ev, ac) => {
  if (ev === 'landed' && ac) ac.aiTd = S.t;
  if (ev === 'ga' && ac) ac.aiSlot = null;
  if (ev === 'takeoff' && ac) { (S.aiDep ||= {})[rwyOf(ac.depRwy || depRw(ac)).id] = { t: S.t, wake: ac.perf.wake }; for (const id of rwyCross(rwyOf(ac.depRwy || depRw(ac)))) S.aiDep[id] = S.aiDep[rwyOf(ac.depRwy || depRw(ac)).id]; }
  if (ev === 'start') { S.aiDep = {}; S.aiOcc = {}; S.aiRun = {}; S.aiAcc = 0; S.aiRoadT = 0; S.aiScore = { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 };
    const on = AI_SEATS.filter(k => S.seats[k] === 'AI');
    if (EXERCISES[S.mode] && on.length) sys('Guided exercises are yours alone: the AI controllers sit this one out.');
    else if (on.length) sys(`AI controllers on ${on.map(k => AI_NAME[k]).join(', ')}. You work ${AI_SEATS.filter(k => S.seats[k] !== 'AI').map(k => AI_NAME[k]).join(', ') || 'nothing: watch them'}. Click a flight and Take over to work it yourself.`); }
});

// ── the seat picker: in the session setup and under the Positions button on the scope
function seatHtml(){
  return AI_SEATS.map(k => `<div class="seat"><div class="seat-n"><b>${AI_NAME[k]}</b><span>${esc(seatUnit(k))}</span></div><div class="seg sm" role="group" aria-label="${AI_NAME[k]}"><button type="button" data-seat="${k}" data-who="ME" class="${S.seats[k] !== 'AI' ? 'on' : ''}">Me</button><button type="button" data-seat="${k}" data-who="AI" class="${S.seats[k] === 'AI' ? 'on' : ''}">AI</button></div></div>`).join('');
}
function renderSeats(){
  for (const id of ['seatGrid', 'seatPopGrid']) { const el = document.getElementById(id); if (el) el.innerHTML = seatHtml(); }
  const h = document.getElementById('aiHear'); if (h) h.checked = !!S.aiHear;
  const b = document.getElementById('tgSeats'); if (b) { const n = AI_SEATS.filter(k => S.seats[k] === 'AI').length; b.classList.toggle('on', n > 0); b.textContent = n ? `Positions · ${n} AI` : 'Positions'; }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-seat]'); if (b) { setSeat(b.dataset.seat, b.dataset.who); return; }
  const t = e.target.closest && e.target.closest('#tgSeats'); if (t) { const p = document.getElementById('seatPop'); if (p) { p.hidden = !p.hidden; renderSeats(); } return; }
  const p = document.getElementById('seatPop'); if (p && !p.hidden && !(e.target.closest && e.target.closest('#seatPop'))) p.hidden = true;
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'aiHear') { S.aiHear = e.target.checked; try { localStorage.setItem('cw-ai-hear', S.aiHear ? '1' : '0'); } catch(_) {} } });
renderSeats();
window.__ai = { seatOf, aiOwns, setSeat, takeOver, handToAi };
