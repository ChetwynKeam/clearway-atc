// ═════════════════════════ ground handling shared by the airports ═════════════════════════
// The push-back, stand, exit and holding-point rules most airports use, written once. An airport whose layout needs
// something else defines its own function of the same name in its engine (loaded after this file), which replaces it.

// pushPath: shared by EGCC, EGGD, EGKK, EGLL, EIDW, KJFK, LEMD, LSGG, OMDB, YSSY
function pushPath(ac, face){ const st = ac.stand; return [st.lp, add(st.lp, laneDir(st, face), 40*M2NM)]; }

// turbExcess: shared by EGAA, EGCC, EGGD, EGKK, EGLL, EIDW, LEMD, LSGG, OMDB
function turbExcess(w){ if (w.vrb || w.spd < 15) return 0; return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25); }

// pushRec: shared by EGCC, EGGD, EGKK, EGLL, KJFK, LEMD, LSGG, YSSY
// face the way the route to the runway starts
function pushRec(ac){
  const st = ac.stand, to = HOLDS[depHold(ac)].node;
  const len = f => { const r = route(st.node, to, undefined, norm(laneDir(st, f) + 180)); return r ? pathLen(r.nodes) : Infinity; };
  const E = len('east'), W = len('west');
  if (E < Infinity || W < Infinity) return E <= W ? 'east' : 'west';
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return off('east') <= off('west') ? 'east' : 'west';
}

// laneDir: shared by EGAA, EGCC, EGGD, EGLL, EIDW, LEMD, LSGG, OMDB, YSSY (Madrid and Sydney only ever push east or west)
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : face === 'west' ? 90 : face === 'north' ? 180 : face === 'south' ? 0 : 90, lp = st.lp;
  const ways = waysOn(st.node); if (ways.length === 1) return norm(brg(...lp, ...GN[ways[0][0]].p) + 180);
  let best = null, bd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail)); if (d < bd) { bd = d; best = v; } }
  if (best && bd <= 60) return brg(...lp, ...GN[best].p);
  let fwd = null, fd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail + 180)); if (d < fd) { fd = d; fwd = v; } }
  return fwd && fd <= 60 ? norm(brg(...lp, ...GN[fwd].p) + 180) : best ? brg(...lp, ...GN[best].p) : tail;
}

// standAt: shared by EGAA, EGCC, EGGD, EGKK, LEMD, LSGG
function standAt(ac, t){
  const free = STANDS.filter(s => standFree(s, ac) && s.term === t).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80));
  const best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 12);
  return best[Math.floor(Math.random()*best.length)] || null;
}

// depHold: shared by EGKK, KJFK, YSSY
function depHold(ac){
  const rw = depRw(), from = ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id;
  const ks = endHolds(rw); let best = ks[0], bl = Infinity;
  for (const k of ks) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = k; } }
  return best;
}

// exitsFor: shared by EGCC, KJFK, LEMD
// exits for a landing runway: those the roll-out direction can turn into (700 m or more past the threshold), in the
// order met, the terminal side (R.side) first
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 700 : H.m < thr - 700); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}

// exitFor: shared by EGCC, EGLL, LEMD
// a name the controller says ("VAC B1") to the exit of that taxiway on the aircraft's runway, ahead of it
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ taxiway graph repairs and stand placement ═════════════════════════
// Called by an airport's engine once its graph and stands are built (see tools/ground-audit.cjs for what they fix).
// ── junction fillets: where a taxiway meets another at a T, the paint has a lead-on curve each way, but a generated graph
// often has only the straight centreline into the junction node. A turn there sharper than the turn limit can't be
// taken, so an aircraft can't turn that way at all (it goes round, or turns about on the taxiway). This lays a curved
// fillet of the graph along each such turn, from a point back up the branch to a point along the through line, as
// painted. opts: R (turn radius, m), skip(node id) to leave a junction alone. Returns the number of fillets added.
function tFillets(opts = {}){
  const R = opts.R || 30, M = 1/1852, skip = opts.skip || (() => false);
  const fixed = new Set(Object.values(HOLDS).map(h => h.node)); for (const s of (typeof STANDS !== 'undefined' ? STANDS : [])) fixed.add(s.node);
  const isR = id => id[0] === 'R' || /^CR\d|^XR$|^XH$/.test(id);
  // the point d (nm) along the chain from n through v (through degree-2 nodes of the same taxiway), and the edge it is on
  const along = (n, v, d) => { let u = n, w = v, acc = 0;
    for (let g = 0; g < 40; g++) { const e = GN[u].adj.find(([x]) => x === w)[1], L = e.len;
      if (acc + L >= d) { const f = (d - acc)/L, a = GN[u].p, b = GN[w].p; return { e, u, w, q: [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f], f }; }
      acc += L; const nx = GN[w].adj.filter(([x, f]) => x !== u && !f.bare);
      if (nx.length !== 1 || nx[0][1].tw !== e.tw || isR(nx[0][0]) || fixed.has(w)) return null; u = w; w = nx[0][0]; }
    return null; };
  const lenOn = (n, v) => { let u = n, w = v, acc = 0; for (let g = 0; g < 40; g++) { const e = GN[u].adj.find(([x]) => x === w)[1]; acc += e.len;
    const nx = GN[w].adj.filter(([x, f]) => x !== u && !f.bare); if (nx.length !== 1 || nx[0][1].tw !== e.tw || isR(nx[0][0]) || fixed.has(w)) return acc; u = w; w = nx[0][0]; } return acc; };
  const dirOn = (n, v) => { const a = along(n, v, Math.min(15*M, lenOn(n, v)*0.9)); const q = a ? a.q : GN[v].p; return brg(...GN[n].p, ...q); };
  const cut = (hit, id) => { const { e, q, f } = hit; if (f < 0.03) return hit.u; if (f > 0.97) return hit.w;
    TAXI_MEMO.clear(); GN[id] = { id, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
    GE.splice(GE.indexOf(e), 1); GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
    for (const [x, y] of [[e.a, id], [id, e.b]]) { ge(x, y, e.tw); const ne = GE[GE.length - 1]; for (const k of ['line', 'k', 'gf']) if (e[k] != null) ne[k] = e[k]; }
    return id; };
  let n0 = 0; const jobs = [];
  for (const id of Object.keys(GN)) {
    if (isR(id) || fixed.has(id) || skip(id)) continue;
    const ws = GN[id].adj.filter(([v, e]) => !e.bare && e.len > 0.3*M && !isR(v));
    if (ws.length !== 3 || GN[id].adj.some(([v]) => isR(v))) continue;
    const b = ws.map(([v]) => dirOn(id, v));
    let best = null; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { const st = Math.abs(angDiff(b[i], b[j] + 180)); if (st < 35 && (!best || st < best.st)) best = { i, j, st }; }
    if (!best) continue;
    const k = 3 - best.i - best.j, inB = norm(b[k] + 180);
    for (const t of [best.i, best.j]) { const turn = Math.abs(angDiff(inB, b[t]));
      if (turn > (opts.minTurn || TURN_MAX - 10) && turn < (opts.maxTurn || 172)) jobs.push({ id, bb: b[k], bt: b[t], turn, tw: ws[k][1].tw }); } }
  // earlier fillets split this junction's edges: find the neighbours again by their bearing
  const nbAt = (id, bg) => { let r = null, bd = 25; for (const [v, e] of GN[id].adj) { if (e.bare || e.fil || isR(v)) continue; const a = Math.abs(angDiff(dirOn(id, v), bg)); if (a < bd) { bd = a; r = v; } } return r; };
  for (const { id, bb, bt, turn, tw } of jobs) {
    const br = nbAt(id, bb), th = nbAt(id, bt); if (!br || !th) continue;
    const d = Math.min(R*Math.tan(Math.min(turn, 140)/2*D2R), 45)*M, Lb = lenOn(id, br), Lt = lenOn(id, th), dd = Math.min(d, Lb*0.8, Lt*0.8);
    if (dd < 8*M) continue;
    const A = along(id, br, dd), B = along(id, th, dd); if (!A || !B) continue;
    // the curve leaves each line along it (a quadratic's ends point at the junction): where the line itself bends
    // between the junction and the fillet's end (a branch that already curves in), the fillet would cusp, so not here
    const legB = h => brg(...GN[h.w].p, ...GN[h.u].p), toJ = q => brg(...q, ...GN[id].p);
    if (Math.abs(angDiff(legB(A), toJ(A.q))) > 60 || Math.abs(angDiff(legB(B), toJ(B.q))) > 60 || Math.abs(angDiff(toJ(A.q), brg(...GN[id].p, ...B.q))) > 150) continue;
    // the curve must not cross another line (a parallel lane, the through line beyond a bend): it would cut across it
    { const Q = []; for (let s = 0; s <= 8; s++) { const u = s/8, w = 1 - u; Q.push([w*w*A.q[0] + 2*w*u*GN[id].p[0] + u*u*B.q[0], w*w*A.q[1] + 2*w*u*GN[id].p[1] + u*u*B.q[1]]); }
      const cr = (o, p, q) => (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0]), X = (a, b, c, d) => cr(a, b, c)*cr(a, b, d) < 0 && cr(c, d, a)*cr(c, d, b) < 0;
      // the branch's own line between the junction and the curve's start may be crossed (a branch kinked just before the junction)
      const own = new Set([id]); { let u = id, w = br; for (let g = 0; g < 40 && w; g++) { own.add(w); if (w === A.w || w === A.u && g) break; const nx = GN[w].adj.filter(([y]) => y !== u); if (nx.length !== 1) break; u = w; w = nx[0][0]; } }
      const near = GE.filter(e => !isR(e.a) && !isR(e.b) && !(own.has(e.a) && own.has(e.b)) && segDistM(GN[id].p, GN[e.a].p, GN[e.b].p) < 120);
      if (near.some(e => e !== A.e && e !== B.e && Q.some((q, i) => i && X(Q[i-1], q, GN[e.a].p, GN[e.b].p)))) continue; }
    const na = cut(A, 'fa' + n0), nb = cut(along(id, th, dd), 'fb' + n0);
    const P0 = GN[na].p, P1 = GN[id].p, P2 = GN[nb].p; let prev = na;
    for (let s = 1; s < 8; s++) { const u = s/8, w = 1 - u, q = [w*w*P0[0] + 2*w*u*P1[0] + u*u*P2[0], w*w*P0[1] + 2*w*u*P1[1] + u*u*P2[1]], fid = 'fc' + n0 + '_' + s;
      TAXI_MEMO.clear(); GN[fid] = { id: fid, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
      ge(prev, fid, tw); GE[GE.length - 1].fil = true; prev = fid; }
    ge(prev, nb, tw); GE[GE.length - 1].fil = true; n0++; }
  return n0;
}
// ── kinks: a node joining just two legs at a turn sharper than the turn limit (a generated graph joining a branch to the
// wrong side of another taxiway's curve) can't be passed either way, so the two taxiways aren't joined at all. This adds
// a short link that cuts the corner: from a point back along one leg to a point along the other, where both turns on and
// off it stay gentle. Returns the number of links added.
function kinkLinks(opts = {}){
  const M = 1/1852, maxT = opts.maxTurn || 100, isR = id => id[0] === 'R';
  const chainPts = (x, v, maxD) => { const out = []; let u = x, w = v, acc = 0;   // nodes along the leg from x through v, with the node before each
    for (let g = 0; g < 30; g++) { const e = GN[u].adj.find(([y]) => y === w); if (!e) break; acc += e[1].len; out.push({ id: w, prev: u, d: acc, tw: e[1].tw });
      if (acc > maxD) break; const nx = GN[w].adj.filter(([y, f]) => y !== u && !f.bare && !isR(y)); if (nx.length !== 1) break; u = w; w = nx[0][0]; }
    return out; };
  let n = 0;
  for (const x of Object.keys(GN)) {
    if (isR(x)) continue; const ws = GN[x].adj.filter(([v, e]) => !e.bare && e.len > 0.3*M);
    if (ws.length !== 2 || ws.some(([v]) => isR(v))) continue;
    const [[u], [w]] = ws, t = Math.abs(angDiff(brg(...GN[u].p, ...GN[x].p), brg(...GN[x].p, ...GN[w].p)));
    if (t <= TURN_MAX) continue;
    // for each way round, the best corner cut: y on one leg (approached from beyond it), z on the other (left onwards)
    let best = null;
    for (const [a, b] of [[u, w], [w, u]]) {
      for (const Y of chainPts(x, a, 70*M)) for (const Z of chainPts(x, b, 50*M)) {
        if (Y.d < 6*M || Z.d < 6*M) continue;
        const yn = GN[Y.id].adj.map(([q]) => q).filter(q => q !== Y.prev && !isR(q)), zn = GN[Z.id].adj.map(([q]) => q).filter(q => q !== Z.prev && !isR(q));
        if (!yn.length || !zn.length) continue;
        const inB = brg(...GN[yn[0]].p, ...GN[Y.id].p), lb = brg(...GN[Y.id].p, ...GN[Z.id].p), outB = brg(...GN[Z.id].p, ...GN[zn[0]].p);
        const worst = Math.max(Math.abs(angDiff(inB, lb)), Math.abs(angDiff(lb, outB)));
        if (worst <= maxT && (!best || worst + (Y.d + Z.d)/M/10 < best.k)) best = { y: Y.id, z: Z.id, tw: Z.tw, k: worst + (Y.d + Z.d)/M/10 };
      }
    }
    if (!best || GN[best.y].adj.some(([q]) => q === best.z)) continue;
    ge(best.y, best.z, best.tw); GE[GE.length - 1].fil = true; n++;
  }
  return n;
}
// ── stands mapped at the nose: an OpenStreetMap parking position (or a stand line) ends where the nose stops, but a stand's
// point is the aircraft's middle. Each stand moves back along its line by the stop-bar distance of the largest aircraft
// it takes (judged from the room to the stands beside it), never closer than 15 m to its lead-in point. Sets t.lat (the
// room beside it, m) and t.maxSpan if not set. As at Heathrow, Madrid and Manchester. opts.same(a, b): halves of one stand.
function standsNoseToMiddle(opts = {}){
  const same = opts.same || (() => false), at = new Map();
  for (const t of STANDS) {
    if (t.area === 'remote' && t.noLead) continue;
    const u = dirv(t.hdg); let lat = Infinity, near = Infinity;
    for (const o of STANDS) { if (o === t || same(o, t)) continue;
      const dx = (o.p[0] - t.p[0])*1852, dy = (o.p[1] - t.p[1])*1852, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
      if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
      if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy)); }
    const w = clamp(Math.min(isFinite(lat) ? lat : 45, near*1.1) - 1, 30, 82), sb = clamp(w + 6, 24, 80)*0.56 - 4;
    t.lat = isFinite(lat) ? lat : 90; if (t.maxSpan == null) t.maxSpan = Math.round(clamp(2*t.lat - 42, 30, 82));
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)*1852 - 15))/1852));
  }
  for (const [t, p] of at) { t.p = p; if (typeof mOf === 'function') { t.m = mOf(p); t.off = offOf(p); } }
}
// a stand whose aircraft would sit across a taxiway (nose or wings within 12 m of a lane) slides along its line to the
// nearest spot at least 14 m clear
function standsClearLanes(){
  const body = (c, h) => [add(c, h, 19/1852), add(c, h + 180, 19/1852), add(c, h - 90, 18/1852), add(c, h + 90, 18/1852)];
  let n = 0;
  for (const t of STANDS) {
    const u = t.hdg, lanes = GE.filter(e => !e.bare && e.tw !== 'APRON' && dist(...GN[e.a].p, ...GN[e.b].p) > 1e-7 && segDistM(t.p, GN[e.a].p, GN[e.b].p) < 150);
    const clr = c => { const [nz, tl, wl, wr] = body(c, u); let m = Infinity; for (const e of lanes) { const a = GN[e.a].p, b = GN[e.b].p; m = Math.min(m, segSegM(nz, tl, a, b), segSegM(wl, wr, a, b)); } return m; };
    if (clr(t.p) >= 12) continue;
    const r0 = dist(...t.lp, ...t.p)*1852; let best = null;
    for (let r = 22; r <= 95; r++) { const c = add(t.lp, u, r/1852), k = clr(c), sc = k >= 14 ? 1000 - Math.abs(r - r0) : k; if (!best || sc > best.sc) best = { sc, c }; }
    t.p = best.c; if (typeof mOf === 'function') { t.m = mOf(t.p); t.off = offOf(t.p); } n++;
  }
  return n;
}
// ── gaps: a lane that ends within a few metres of another lane it isn't joined to (two surveyed lines that stop just
// short of each other) is joined to the nearest point on it. Returns the number joined.
function joinGaps(maxM = 8){
  const isR = id => id[0] === 'R', M = 1/1852, fixed = new Set(Object.values(HOLDS).map(h => h.node)); for (const t of STANDS) fixed.add(t.node);
  const near = (a, b) => { const seen = new Set([a]); let fr = [a]; for (let k = 0; k < 6; k++) { const nx = []; for (const u of fr) for (const [v] of GN[u].adj) if (!seen.has(v)) { if (v === b) return true; seen.add(v); nx.push(v); } fr = nx; } return false; };
  let n = 0;
  for (const id of Object.keys(GN)) {
    if (isR(id) || fixed.has(id) || GN[id].adj.length !== 1) continue;
    const p = GN[id].p; let best = null;
    for (const e of GE) { if (e.a === id || e.b === id || isR(e.a) || isR(e.b) || e.bare) continue;
      const d = segDistM(p, GN[e.a].p, GN[e.b].p); if (d < maxM && (!best || d < best.d) && !near(id, e.a) && !near(id, e.b)) best = { e, d }; }
    if (!best) continue;
    const { e } = best, a = GN[e.a].p, b = GN[e.b].p, dx = b[0]-a[0], dy = b[1]-a[1], f = clamp(((p[0]-a[0])*dx + (p[1]-a[1])*dy)/(dx*dx + dy*dy || 1e-12), 0, 1);
    let to = f < 0.05 ? e.a : f > 0.95 ? e.b : null;
    if (!to) { to = 'jg' + n; const q = [a[0] + dx*f, a[1] + dy*f]; TAXI_MEMO.clear();
      GN[to] = { id: to, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
      GE.splice(GE.indexOf(e), 1); GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
      for (const [x, y] of [[e.a, to], [to, e.b]]) { ge(x, y, e.tw); const ne = GE[GE.length - 1]; for (const k of ['line', 'k', 'gf']) if (e[k] != null) ne[k] = e[k]; } }
    ge(id, to, GN[id].adj[0][1].tw); n++;
  }
  return n;
}
// the way an aircraft turns into its stand off the lane: along the painted lead-in line where there is one (it often
// curves, so its start points well away from the straight line to the stop point), else straight at the stop point
function leadInB(st){
  const L = st.line;
  if (L && L.length > 1 && dist(...L[0], ...st.lp) < 5/1852) { let k = 1; while (k < L.length - 1 && dist(...L[0], ...L[k]) < 15/1852) k++; return brg(...L[0], ...L[k]); }
  return brg(...st.lp, ...st.p);
}
// ── sharp corners: a corner in a lane a little sharper than the turn limit (a surveyed centreline with its curve cut
// short, 115 to 145 degrees) is chamfered: the corner node goes and its two legs are joined by a short straight cut
// across it, so each turn is about half. Holding points, stands and runway entries are left alone. Returns the count.
function smoothKinks(opts = {}){
  const M = 1/1852, isR = id => id[0] === 'R', fixed = new Set(Object.values(HOLDS).map(h => h.node)); for (const t of STANDS) fixed.add(t.node);
  let n = 0;
  for (const x of Object.keys(GN)) {
    if (isR(x) || fixed.has(x) || !GN[x]) continue; const ws = GN[x].adj;
    if (ws.length !== 2 || ws.some(([v, e]) => isR(v) || e.bare || e.len < 0.3*M)) continue;
    const [[u, eu], [w, ew]] = ws, t = Math.abs(angDiff(brg(...GN[u].p, ...GN[x].p), brg(...GN[x].p, ...GN[w].p)));
    if (t <= TURN_MAX || t > (opts.max || 145)) continue;
    const d = Math.min(12*M, eu.len*0.45, ew.len*0.45), P = GN[x].p, at = (q, k) => [P[0] + (GN[q].p[0] - P[0])*k, P[1] + (GN[q].p[1] - P[1])*k];
    const a = 'sk' + n + 'a', b = 'sk' + n + 'b';
    for (const [id, q, e] of [[a, at(u, d/eu.len), eu], [b, at(w, d/ew.len), ew]]) { TAXI_MEMO.clear(); GN[id] = { id, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] }; }
    for (const e of [eu, ew]) { GE.splice(GE.indexOf(e), 1); for (const id of [e.a, e.b]) GN[id].adj = GN[id].adj.filter(([, z]) => z !== e); }
    delete GN[x];
    ge(u, a, eu.tw); ge(a, b, eu.tw); ge(b, w, ew.tw); n++;
  }
  return n;
}
