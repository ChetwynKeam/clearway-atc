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
function rwyBusy(R, skip, rolling){
  for (const o of S.acs) {
    if (o === skip) continue;
    if (o.onRwy && sameRwy(R, o.rwyId || RWYS[0].id) && !(rolling && o.state === 'TAKEOFF')) return o;
    if (o.kind === 'DEP' && ['LINEUP', 'LINEDUP'].includes(o.state) && sameRwy(R, rwyOf(depRw(o)).id)) return o;
  }
  if (typeof VEH !== 'undefined' && VEH.list.some(v => v.onRwy && sameRwy(R, v.onRwy) && !v.gone)) return true;
  return rwyBlocked() ? true : null;
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
const WAKE_NM = { HH: 4, HM: 5, HL: 6, MH: 3, MM: 3, ML: 5, LH: 3, LM: 3, LL: 3 };
// the time between two landings: wake (or radar) spacing plus a mile at the approach speed, or the runway occupancy
const landGapS = (lead, trail, R) => Math.max(((WAKE_NM[(lead.perf.wake || 'M') + (trail.perf.wake || 'M')] || 3) + 1)/((trail.perf.vapp || 135))*3600, occS(R) + 25);
// track miles to touchdown: along its route to the approach's start, then down the final
function estToGo(ac, F){
  if (!F) return 99;
  if (ac.mode === 'FINAL') return finalDist(ac);
  const rt = ac.mode === 'HOLD' ? [] : ac.route || [], entry = F.entry && WP[F.entry] ? F.entry : null;
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
  if (rwyBlocked()) return why('runway closed');
  if (APT.xing && S.xing.st !== 'CLOSED') return why('the road is closing');
  if (needRel(ac)) { const L = ac.rel; if (!L || L.st === 'EXP') { why('release requested'); return aiDo('TWR', ac, 'REL'); } if (L.st !== 'OK') return why('waiting for the release'); if (L.nb && S.t < L.nb - 20) return why('released not before ' + zt(L.nb).slice(0, 5)); }
  const sl = typeof SLOT !== 'undefined' && SLOT[ac.cs];
  if (sl && sl.ctot != null && nowMin() < sl.ctot - 4) return why('waiting for its slot');
  if (S.acs.some(o => o.state === 'MISSED' && o.airborne && S.t - (o.gaT || 0) < 150 && dist(o.x, o.y, ac.x, ac.y) < 10)) return why('a go-around climbing out');
  // an arrival close by and low, not lined up behind it (Madeira's VOR to 05 passes over the field before turning in)
  const dh = parseInt(rw, 10)*10, over = S.acs.find(o => o.kind === 'ARR' && o.airborne && o.state !== 'PRE' && !o.handed && o.alt < ELEV + 4000 && dist(o.x, o.y, ac.x, ac.y) < 6 + (o.gs || 180)*depSecs(ac)/3600 && Math.abs(((o.hdg - dh + 540) % 360) - 180) > 90);
  if (over) return why(`${over.cs} passing overhead`);
  const a = arrNear(R, ac), need = clearS(ac);
  const last = S.aiDep && S.aiDep[R.id], gap = last ? (last.wake === 'H' && ac.perf.wake !== 'H' ? 150 : last.wake === 'M' && ac.perf.wake === 'L' ? 120 : 100) : 0;
  const wait = last ? last.t + gap - S.t : 0, busy = rwyBusy(R, ac);
  if (!busy && a.eta >= need && wait <= 0) { why(''); return aiDo('TWR', ac, 'CTO'); }
  why(busy ? 'runway occupied' + (busy.cs ? ' by ' + busy.cs : '') : a.eta < need ? `arrival ${a.nm.toFixed(1)} NM out` : 'spacing behind the last departure');
  // the one ahead is rolling (or just gone): line up and wait behind it, ready to go once the spacing allows, if the next
  // arrival leaves room for that. Lined up, it needs about 45 s to be rolling away instead of the taxi on
  const rolling = S.acs.some(o => o !== ac && o.state === 'TAKEOFF' && o.onRwy && sameRwy(R, o.rwyId || RWYS[0].id));
  const lineNeed = 45 + 110 + (a.opp ? 300 : a.head ? 150 : 0);
  if (!lined && ac.state === 'HOLDPT' && (wait > 0 || rolling) && luBehind(ac, R) && a.eta >= Math.max(wait, rolling ? 30 : 0) + lineNeed + 30) { ac.aiWhy = 'lining up behind the departure'; return aiDo('TWR', ac, 'LU'); }
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
  if (rwyBlocked()) return 'runway closed';
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
      ac.aiWhy = b ? 'runway occupied' : a.eta <= 110 ? `arrival ${a.nm.toFixed(1)} NM out` : S.acs.some(o => o.state === 'TAKEOFF' && sameRwy(R, o.rwyId || RWYS[0].id)) ? 'departure rolling' : '';
      if (!ac.aiWhy) aiDo('TWR', ac, 'CROSS');
      return;
    }
    if (ac.kind === 'DEP' && (n === 'Ready for departure' || n === 'Lined up') && aiDue(ac, n, 3, 7)) aiDepart(ac);
    return;
  }
  if (ac.kind === 'DEP') { if (n.startsWith('Airborne') && aiDue(ac, n, 2, 6)) aiDo('TWR', ac, 'HO'); return; }
  // arrivals: cleared to land inside 5 NM once the runway is clear; sent around if it still isn't at about a mile
  if (ac.mode !== 'FINAL' || !ac.app || ac.state === 'MISSED' || ac.ctl && !rwyBusy(rwyOf(landRw(ac)), ac, true)) return;
  const togo = finalDist(ac), blk = landBlock(ac); ac.aiWhy = blk || '';
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
const holdFixOf = ac => ac.mode === 'HOLD' && ac.hold ? ac.hold.name : (ac.route && ac.route.length ? ac.route[ac.route.length - 1] : 'pp');
const holdFixP = ac => ac.mode === 'HOLD' && ac.hold ? ac.hold.c : ac.route && ac.route.length && WP[ac.route[ac.route.length - 1]] ? WP[ac.route[ac.route.length - 1]].p : [ac.x, ac.y];
// the bottom of the stack: the approach altitude once it is near the fix where it waits (so it starts the approach
// from the right height), its arrival altitude while still far out
function stackBase(ac){
  const F = FINAL[landRw(ac)], low = Math.max((F && F.alt) || APT.appAlt || 3000, APT.appAlt || 0);
  return dist(ac.x, ac.y, ...holdFixP(ac)) < 22 ? low : Math.max(APT.inboundAlt ? APT.inboundAlt(ac.gate) : 7000, low);
}
// the others waiting at the same fix, or at one close by (New York's fixes are a few miles apart)
const stackPeers = ac => { const fix = holdFixOf(ac), P = holdFixP(ac); return S.acs.filter(o => o !== ac && o.kind === 'ARR' && o.airborne && o.state !== 'PRE' && !o.app && !o.handed && (holdFixOf(o) === fix || dist(...holdFixP(o), ...P) < 14)); };
const lvlOf = o => o.cleared ?? Math.round(o.alt/100)*100;
function stackLevel(ac, base = stackBase(ac)){
  const used = stackPeers(ac).map(lvlOf);
  let lv = base; while (used.some(u => Math.abs(u - lv) < 900) && lv < 24000) lv += 1000;
  return lv;
}
function aiSequence(list){
  // nearest first, so a flight further out never jumps the queue; one held back holds back those behind it
  const blocked = new Set();
  list.sort((a, b) => (Math.round(estToGo(a, FINAL[landRw(a)])/2) - Math.round(estToGo(b, FINAL[landRw(b)])/2)) || (lvlOf(a) - lvlOf(b)));
  for (const ac of list) {
    const rw = landRw(ac), F = FINAL[rw], R = rwyOf(rw), n = ac.need || '';
    if (S.t < (ac.aiNext || 0) || !F) continue;
    if (ac.state === 'MISSED' && S.t - (ac.gaT || 0) < 75) { ac.aiWhy = 'climbing out after the go-around'; continue; }
    let ok = !blocked.has(R.id) || !!ac.emerg;
    ac.aiWhy = ok ? '' : 'in sequence behind the others';
    if (ok && !ac.emerg) {
      const e = eta(ac, F), gap = depGapS(R);
      for (const o of S.acs) {
        if (o === ac || o.kind !== 'ARR' || !o.airborne || !o.app || o.state === 'MISSED' || o.state === 'DIVERTING' || o.handed || !sameRwy(R, rwyOf(landRw(o)).id)) continue;
        const oe = eta(o), lead = oe <= e ? o : ac, trail = lead === o ? ac : o, need = Math.max(landGapS(lead, trail, R), gap)*1.05;
        if (Math.abs(oe - e) < need) { ok = false; ac.aiWhy = `spacing behind ${o.cs}${gap > landGapS(lead, trail, R) ? ', with a gap for a departure' : ''}`; break; }
      }
      // too close behind (or level with) one already on the approach: slow down to open the gap, rather than hold
      if (!ok && ac.mode !== 'HOLD' && ac.state !== 'MISSED' && !ac.spdAssigned && ac.ias > 195 && aiDue(ac, 'spd', 3, 8)) aiDo('APP', ac, estToGo(ac, F) > 25 ? 'S210' : 'S180');
    }
    // others waiting lower down near its way in: they go first (it would descend through them)
    const spaced = ok;   // only a flight held for spacing holds back those behind it
    if (ok && !ac.emerg) { const ep = F.entry && WP[F.entry] ? WP[F.entry].p : F.pts[0], under = S.acs.find(o => o !== ac && o.kind === 'ARR' && o.airborne && !o.app && o.state !== 'PRE' && !o.handed && o.alt < ac.alt - 400 && (dist(o.x, o.y, ac.x, ac.y) < 10 || dist(o.x, o.y, ...ep) < 8));
      if (under) { ok = false; ac.aiWhy = `waiting for ${under.cs} below to go first`; } }
    // too high to start the approach from here: down to the approach altitude first
    const high = ok && !ac.emerg && ac.alt > ELEV + estToGo(ac, F)*290 + 1000;
    if (high) ac.aiWhy = 'descending before the approach';
    // the descent on the approach would meet someone not on it (a departure climbing out, a flight in the hold)
    if (ok && !high && !ac.emerg) { const clash = airNow().find(o => o !== ac && !(o.app && o.kind === 'ARR') && conflictWith(ac, o, (F.alt || APT.appAlt || 3000)) >= 0);
      if (clash) { ok = false; ac.aiWhy = `waiting for ${clash.cs} to pass`; } }
    if (ok && !high && !ac.aiLev && aiDue(ac, 'app' + (ac.gaCount || 0), 3, 7)) { if (aiDo('APP', ac, 'APP')) { ac.aiWhy = ''; continue; } }
    if (!spaced) blocked.add(R.id);
    // not yet: answer the call and keep it 1,000 ft clear of the others waiting at the same fix
    if (ac.aiLev || (ac.state === 'MISSED' && !n)) continue;
    const cur = lvlOf(ac), d = estToGo(ac, F), peers = stackPeers(ac), free = L => !peers.some(o => Math.abs(lvlOf(o) - L) < 900);
    if (n === 'Initial call' || n === 'Missed approach' || n === 'Back on frequency') { if (aiDue(ac, n, 3, 7)) { const want = free(cur) && (n !== 'Initial call' || cur >= stackBase(ac)) ? cur : stackLevel(ac); aiDo('APP', ac, `A${Math.round((safeLevel(ac, [want, want + 1000, want + 2000, Math.ceil(ac.alt/1000)*1000]) ?? cur)/100)}`); } continue; }
    if (S.t - (ac.aiStack || 0) < 25) continue;
    // sharing a level with one nearer the runway (or not ours): move up out of its way
    if (peers.some(o => Math.abs(lvlOf(o) - cur) < 900 && (!aiOwns(o) || estToGo(o, FINAL[landRw(o)]) < d))) { const lv = stackLevel(ac), to = safeLevel(ac, [lv, lv + 1000, lv + 2000]); ac.aiStack = S.t; if (to != null) aiDo('APP', ac, `A${Math.round(to/100)}`); continue; }
    // lower levels free: step down, never through a level someone else holds at the same fix
    let to = cur; const base = stackBase(ac);
    while (to - 1000 >= base - 50 && free(to - 1000)) to -= 1000;
    if (to < cur && cur - base >= 900) { const lv = safeLevel(ac, Array.from({ length: Math.round((cur - Math.max(to, base))/1000) }, (_, i) => Math.max(to, base) + i*1000)); if (lv != null && lv < cur) { ac.aiStack = S.t; aiDo('APP', ac, `A${Math.round(lv/100)}`); } }
  }
}
function aiApproach(ac){
  const n = ac.need || '';
  if (ac.state === 'DIVERTING') return true;
  if (ac.diverting && n.startsWith('Diverting') && aiDue(ac, n, 3, 7)) { aiDo('APP', ac, 'DCT ' + ac.diverting); return true; }
  if (n === 'Unable approach') return true;   // holding for the weather; the crew will ask to divert
  if (n === 'Request RNP approach' && aiDue(ac, n, 3, 6)) { aiDo('APP', ac, 'APP RNP'); return true; }
  if (ac.app) {
    // on the approach: transfer to Tower once established inside about 11 NM
    if (ac.mode === 'FINAL' && finalDist(ac) < 11 && aiDue(ac, 'ho', 1, 4)) aiDo('APP', ac, ac.spdAssigned ? 'SN HO' : 'HO');
    else if (n === 'Initial call' && aiDue(ac, n, 3, 7)) aiDo('APP', ac, 'IDENT');
    return true;
  }
  return false;   // to be sequenced
}

// ── Departure: direct to the exit fix, further climb, transfer to the next unit
function climbTop(){ return (APT.climbFL || 80)*100; }
function aiDeparture(ac){
  const n = ac.need || '';
  if (n === 'Ready for transfer' && aiDue(ac, n, 2, 6)) return aiDo('DEP', ac, 'HO');
  if (ac.aiLev) return;   // levelled off for traffic: the climb and the direct wait until it is clear
  if (n.startsWith('Request direct') && aiDue(ac, n, 3, 7)) return aiDo('DEP', ac, 'DCT ' + n.split(' ').pop());
  if (n === 'Request climb' && aiDue(ac, n, 3, 7)) return aiDo('DEP', ac, `C${Math.round(climbTop()/100)}`);
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
const appPathBusy = (ac, lv) => !ac.app && S.acs.some(o => o !== ac && o.kind === 'ARR' && o.airborne && o.app && o.mode !== 'FINAL' && o.state !== 'MISSED' && Math.abs((o.tgtAlt ?? o.alt) - lv) < 950 && o.alt > lv - 200 && dist(o.x, o.y, ac.x, ac.y) < 12);
const airNow = () => S.acs.filter(a => a.airborne && a.state !== 'PRE' && a.alt > 500);   // handed-off ones still fly here
// a level for ac that conflicts with nobody (null: none of the candidates works)
function safeLevel(ac, cands){
  const air = airNow().filter(o => o !== ac);
  return cands.find(lv => lv >= 1000 && lv <= 24000 && !appPathBusy(ac, lv) && !air.some(o => conflictWith(ac, o, lv) >= 0)) ?? null;
}
// who gives way: a departure to an arrival, a go-around to one on the approach, a flight not yet cleared for the
// approach to one that is; otherwise the later callsign
const yieldRank = a => a.kind === 'DEP' ? 0 : a.state === 'MISSED' ? 1 : !a.app ? 2 : 3;
const canMove = a => aiOwns(a) && a.mode !== 'FINAL' && !(a.kind === 'ARR' && a.app && a.state !== 'MISSED') && !(a.kind === 'DEP' && a.alt < ELEV + 2500) && ['APP', 'DEP', 'TWR'].includes(seatOf(a));
function aiProbe(){
  const air = airNow();
  for (const ac of air) {
    const s = seatOf(ac);
    if (!canMove(ac) || S.t < (ac.aiNext || 0) || (s === 'TWR' && ac.kind !== 'DEP')) continue;
    let hit = null;
    for (const o of air) {
      if (o === ac) continue;
      const t = conflictWith(ac, o); if (t < 0) continue;
      if (ac.app && o.app && o.kind === 'ARR' && t > 40) continue;   // both on the approach: the sequence spaced them
      const mine = yieldRank(ac) < yieldRank(o) || (yieldRank(ac) === yieldRank(o) && ac.cs > o.cs);
      if (!mine && canMove(o)) continue;   // the other gives way
      hit = o; break;
    }
    if (hit) {
      const now = Math.round(ac.alt/100)*100, floor = ac.kind === 'ARR' ? Math.max(APT.appAlt || 2000, 2000) : now;
      const r1 = Math.ceil(ac.alt/1000)*1000, d1 = Math.floor(ac.alt/1000)*1000;
      const cands = ac.kind === 'DEP' ? [now, d1, r1 + 1000, r1 + 2000] : [now, r1, r1 + 1000, d1, d1 - 1000, r1 + 2000].filter(l => l >= floor);
      const lv = safeLevel(ac, cands);
      if (lv != null && Math.abs(lv - (ac.tgtAlt ?? ac.alt)) >= 200) { if (aiDo(s, ac, `A${Math.round(lv/100)}`)) { ac.aiLev = { t: S.t, o: hit.cs }; ac.aiWhy = `kept clear of ${hit.cs}`; } }
      else if (ac.aiLev) ac.aiLev.t = S.t;
    } else if (ac.aiLev && S.t - ac.aiLev.t > 40) {
      // clear again: back down the published profile, or on with the climb (if that is clear too)
      if (ac.kind === 'ARR' && ac.app && ac.mode !== 'FINAL') { ac.aiLev = null; ac.aiWhy = ''; aiDo(s, ac, 'APP'); }
      else if (ac.kind === 'DEP') { const top = ac.reqClimb ? climbTop() : sidTop(ac); if (safeLevel(ac, [top]) != null) { ac.aiLev = null; ac.aiWhy = ''; aiDo(s, ac, `C${Math.round(top/100)}`); } else ac.aiLev.t = S.t - 20; }
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
  if (ev === 'takeoff' && ac) { (S.aiDep ||= {})[rwyOf(ac.depRwy || depRw(ac)).id] = { t: S.t, wake: ac.perf.wake }; for (const id of rwyCross(rwyOf(ac.depRwy || depRw(ac)))) S.aiDep[id] = S.aiDep[rwyOf(ac.depRwy || depRw(ac)).id]; }
  if (ev === 'start') { S.aiDep = {}; S.aiOcc = {}; S.aiAcc = 0; S.aiRoadT = 0; S.aiScore = { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 };
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
