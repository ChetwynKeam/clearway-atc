// ═════════════════════════ ground flow plan: one-way taxiways, precautionary holds, spread departure queues ═════════════════════════
// For the runways in use the ground controller first works out which way the traffic uses each taxiway: routes from
// every stand to the departure holding points, and from every runway exit to the stands, counted edge by edge. A taxiway
// used (nearly) only one way becomes one-way that way; the route searches then make going against it cost four times as
// much, so the default routes (the AI's and yours when you name no taxiways) flow round the airport instead of meeting
// head on. The plan is worked out twice, the second time with the first one's flows, so the loops settle.
// Taxiways that still carry traffic both ways are two-way stretches between junctions. At each end of one is a
// precautionary holding point: an aircraft about to enter waits there while another is in the stretch coming the other
// way, or nearer its own end of it, rather than meet it nose to nose in the middle.
// Departures are spread across a runway's holding points by queue as well as distance, so two or three queues build
// (and line up) instead of one long one at the nearest.

const GFLOW = { key: '', ready: false, dir: new Map(), corr: [], corrOf: new Map(), at: new Map(), entries: [], stats: null };
const gfOk = id => id && GN[id] && id[0] !== 'R';
// the runways in use: departures, landings
function gfConfig(){
  const dep = (typeof depRwys === 'function' ? depRwys() : [depRw()]).filter(Boolean);
  const land = (typeof landRwys === 'function' ? landRwys() : [S.rwy]).filter(Boolean);
  return { dep, land, key: dep.join(',') + '|' + land.join(',') };
}
// the holding points a runway's departures use: those at its end, or (an airport without them) where depHold sends stands
function gfDepHolds(rw){
  let ks = Object.keys(HOLDS).filter(k => HOLDS[k].end === rw && gfOk(HOLDS[k].node));
  if (!ks.length) { const set = new Set();
    for (const s of STANDS.slice(0, 80)) { try { const k = depHold({ kind: 'DEP', stand: s, leftStand: false, x: s.p[0], y: s.p[1], hdg: 0, perf: {} }); if (HOLDS[k] && gfOk(HOLDS[k].node)) set.add(k); } catch (e) {} }
    ks = [...set]; }
  return ks;
}
// the exits arrivals vacate a landing runway by: its holding points other than the ones at its own threshold end
function gfExits(rw){
  const R = rwyOf(rw); if (!R) return [];
  return Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; if (!gfOk(H.node) || H.end === rw) return false;
    const on = H.on != null ? H.on === R.id : (typeof holdRwy === 'function' ? holdRwy(k) === R : true); return on; });
}
// shortest routes from one node to every other (dir: 1 out from it, -1 in to it), costs from the current flow plan
function gfTree(src, way){
  const dd = new Map([[src, 0]]), nx = new Map(), done = new Set(), h = [[0, src]];
  while (h.length) {
    const [d, u] = heapPop(h); if (done.has(u)) continue; done.add(u);
    for (const [v, e] of GN[u].adj) {
      if (e.closed || !gfOk(v)) continue;
      // way 1: travelling u → v; way -1 (paths into src): travelling v → u
      const k = GFLOW_DIR ? (way > 0 ? gfK(e, u) : gfK(e, v)) : 1, nd = d + e.len*(e.k || 1)*k, o = dd.get(v);
      if (o === undefined || nd < o) { dd.set(v, nd); nx.set(v, [u, e]); heapPush(h, [nd, v]); }
    }
  }
  return { dd, nx };
}
function gfCount(T, from, cnt, w, way){
  // walk the tree from `from` back to its root, counting each edge in the direction it is flown
  let c = from, n = 0;
  while (T.nx.has(c) && n++ < 4000) { const [u, e] = T.nx.get(c), a = way < 0 ? c : u, b = way < 0 ? u : c;   // flown a → b
    const f = cnt.get(e) || [0, 0]; f[e.a === a ? 0 : 1] += w; cnt.set(e, f); c = u; }
}
function gfPlan(force){
  const C = gfConfig(); if (!force && C.key === GFLOW.key && GFLOW.ready) return;
  const t0 = performance.now();
  GFLOW.key = C.key; GFLOW.ready = false; GFLOW_DIR = null;
  // a sample is enough to see the flows: up to 70 stands spread across the airport, and up to 10 exits
  const all = STANDS.filter(s => gfOk(s.node)), stands = all.length > 70 ? all.filter((s, i) => i % Math.ceil(all.length/70) === 0) : all;
  const holds = [...new Set(C.dep.flatMap(gfDepHolds))], ex0 = [...new Set(C.land.flatMap(gfExits))], exits = ex0.length > 10 ? ex0.filter((k, i) => i % Math.ceil(ex0.length/10) === 0) : ex0;
  if (!stands.length || (!holds.length && !exits.length)) return;
  const pass = () => {
    const cnt = new Map();
    // out: each stand to its nearest holding points for each departure runway (the nearest counts double)
    for (const rw of C.dep) { const hs = gfDepHolds(rw); if (!hs.length) continue;
      const trees = hs.map(k => gfTree(HOLDS[k].node, -1));
      for (const s of stands) { const ds = trees.map(T => T.dd.get(s.node) ?? Infinity), best = Math.min(...ds); if (!isFinite(best)) continue;
        trees.forEach((T, i) => { if (ds[i] <= best*1.35 + 0.15) gfCount(T, s.node, cnt, ds[i] === best ? 2 : 1, -1); }); } }
    // in: each exit to every stand
    for (const k of exits) { const T = gfTree(HOLDS[k].node, 1), w = 3/exits.length; for (const s of stands) gfCount(T, s.node, cnt, w, 1); }
    return cnt;
  };
  const classify = cnt => { const dir = new Map(); for (const [e, [f, b]] of cnt) {
      if (e.tw === 'APRON' || e.a[0] === 'R' || e.b[0] === 'R' || e.len < 15/1852) continue;
      const t = f + b; if (t < 1.5) continue;
      if (Math.min(f, b)/Math.max(f, b) < 0.18) dir.set(e, f > b ? 1 : -1); else dir.set(e, 0);
    } return dir; };
  let cnt = pass(); GFLOW_DIR = new Map([...classify(cnt)].filter(([, d]) => d)); TAXI_MEMO.clear();
  cnt = pass(); const dir = classify(cnt);
  GFLOW.dir = dir; GFLOW_DIR = new Map([...dir].filter(([, d]) => d)); TAXI_MEMO.clear();
  gfCorridors(dir);
  GFLOW.at = new Map(); for (const id in GN) GFLOW.at.set(GN[id].p[0] + ',' + GN[id].p[1], id);
  GFLOW.ready = true;
  GFLOW.stats = { oneWay: GFLOW_DIR.size, twoWay: [...dir.values()].filter(d => !d).length, corridors: GFLOW.corr.length, ms: Math.round(performance.now() - t0) };
}
// two-way stretches: chains of two-way edges between junctions (a node with three or more ways, or a holding point)
function gfCorridors(dir){
  GFLOW.corr = []; GFLOW.corrOf = new Map(); GFLOW.entries = [];
  const two = new Set([...dir].filter(([, d]) => d === 0).map(([e]) => e));
  const deg = id => GN[id].adj.filter(([v]) => v[0] !== 'R').length;
  const isHold = new Set(Object.values(HOLDS).map(H => H.node));
  const seen = new Set();
  for (const e0 of two) {
    if (seen.has(e0)) continue;
    // grow both ways through plain (two-way, junction-free) nodes
    const nodes = [e0.a, e0.b], edges = [e0]; seen.add(e0);
    for (const side of [0, 1]) {
      for (let guard = 0; guard < 200; guard++) {
        const tip = side ? nodes[nodes.length - 1] : nodes[0], prev = side ? nodes[nodes.length - 2] : nodes[1], inE = side ? edges[edges.length - 1] : edges[0];
        if (isHold.has(tip)) break;
        // on through a plain bend, or straight on along the same taxiway through a junction (a crossing taxiway doesn't
        // end a two-way stretch of this one)
        const inB = brg(...GN[prev].p, ...GN[tip].p);
        const opts = GN[tip].adj.filter(([v, e]) => v !== prev && v[0] !== 'R' && two.has(e) && !seen.has(e) && (deg(tip) === 2 || (e.tw === inE.tw && Math.abs(angDiff(inB, brg(...GN[tip].p, ...GN[v].p))) < 35)));
        const nxt = opts.length === 1 ? opts[0] : null; if (!nxt) break;
        seen.add(nxt[1]); if (side) { nodes.push(nxt[0]); edges.push(nxt[1]); } else { nodes.unshift(nxt[0]); edges.unshift(nxt[1]); }
      }
    }
    const len = edges.reduce((L, e) => L + e.len, 0);
    if (len < 60/1852) continue;   // a short link across a junction: no room to meet in
    const C = { id: GFLOW.corr.length, nodes, edges, len, idx: new Map(nodes.map((n, i) => [n, i])) };
    GFLOW.corr.push(C); for (const e of edges) GFLOW.corrOf.set(e, C);
    for (const [a, b] of [[nodes[0], nodes[1]], [nodes[nodes.length - 1], nodes[nodes.length - 2]]]) {
      // the precautionary holding point: about 45 m into the stretch from the junction (less on a short one)
      const A = GN[a].p, B = GN[b].p, L = dist(...A, ...B), f = Math.min(0.45, 45/1852/L);
      GFLOW.entries.push({ C, node: a, p: [A[0] + (B[0] - A[0])*f, A[1] + (B[1] - A[1])*f], h: brg(...A, ...B) });
    }
  }
}
const gfEdge = (u, v) => { if (!u || !v || !GN[u]) return null; const a = GN[u].adj.find(([w]) => w === v); return a ? a[1] : null; };
// the taxiway edges an aircraft is about to use, in order, with the distance (NM) to the start of each: { segs: [[u, v, D]],
// keys: Map("u>v" -> D) }, about 600 m ahead (worked out once a second per aircraft)
function gfAhead(ac){
  if (ac.gfA && ac.gfA.t === S.t && ac.gfA.n === (ac.path ? ac.path.pts.length : -1)) return ac.gfA;
  const out = { t: S.t, n: ac.path ? ac.path.pts.length : -1, segs: [], keys: new Map() }; ac.gfA = out;
  if (!ac.path || ac.path.reverse || !GFLOW.ready) return out;
  const P = ac.path.pts, at = GFLOW.at, key = p => p[0] + ',' + p[1];
  let prev = ac.path.prev ? at.get(key(ac.path.prev)) : null, D = 0, last = [ac.x, ac.y];
  for (let i = 0; i < Math.min(P.length, 60) && D < 0.33; i++) {
    const id = at.get(key(P[i])) || null;
    if (prev && id && gfEdge(prev, id)) { const d0 = i === 0 ? 0 : D; out.segs.push([prev, id, d0]); if (!out.keys.has(prev + '>' + id)) out.keys.set(prev + '>' + id, d0); }
    D += dist(...last, ...P[i]); last = P[i]; prev = id;
  }
  return out;
}
// an aircraft's next stretch of two-way taxiway along its path (for the map and the strips): { C, inside, dir }
function gfNext(ac){
  const A = gfAhead(ac);
  for (const [u, v, D] of A.segs) { const e = gfEdge(u, v), C = e && GFLOW.corrOf.get(e); if (C) return { C, inside: D === 0, dir: C.idx.get(v) > C.idx.get(u) ? 1 : -1, entry: u, D }; }
  return null;
}
// moving along its path already: more than about 10 m past the last point it went through, or rolling
const gfMoving = ac => (ac.gs || 0) > 2 || !ac.path || !ac.path.prev || dist(ac.x, ac.y, ...ac.path.prev) > 0.006;
// called from the ground step: the speed it may taxi at. Anyone about to taxi along the same piece of taxiway the
// other way (a two-way stretch, the link past a junction, a lane against the flow) is a meeting waiting to happen: the
// one nearer that shared stretch has it, and the other waits short of it, at the junction before (the precautionary
// holding point), not nose to nose in the middle
function gflowGate(ac, spd){
  const me = gfAhead(ac); if (!me.segs.length) { ac.gfWait = null; return spd; }
  let block = null, zone = Infinity;
  for (const o of S.acs) {
    // (an arrival still rolling out counts once it is turning off: the exit it takes, and the way on from it, are known)
    if (o === ac || !o.ground || !o.path || o.path.reverse || (o.onRwy && o.state !== 'VACATING')) continue;
    if (Math.abs(o.x - ac.x) > 0.5 || Math.abs(o.y - ac.y) > 0.5) continue;
    if (o.waiting === ac.cs && (o.gs || 0) < 1) continue;   // it is already giving way to me: I go (two waiting on each other would never move)
    const oa = gfAhead(o); if (!oa.segs.length) continue;
    // the first edge of mine it will fly the other way, and how far each of us is from the shared stretch
    let mine = null, theirs = Infinity;
    for (const [u, v, D] of me.segs) { const Do = oa.keys.get(v + '>' + u); if (Do !== undefined) { mine = D; theirs = Do; break; } }
    if (mine == null) continue;
    // whoever is already moving along the shared stretch has it; one sitting at its start (just given its taxi off a
    // runway exit) waits for it. Otherwise the nearer has it; a tie: the one leaving a runway, then the lower callsign
    const inMe = mine === 0 && gfMoving(ac), inIt = theirs === 0 && gfMoving(o);
    const it = inIt && !inMe ? true : inMe && !inIt ? false : theirs + 0.004 < mine || (Math.abs(theirs - mine) <= 0.004 && (o.state === 'VACATING' || (ac.state !== 'VACATING' && o.cs < ac.cs)));
    if (it && mine < zone) { zone = mine; block = o; }
  }
  if (!block || zone > 0.12) { ac.gfWait = null; return spd; }
  if (!ac.gfWait || ac.gfWait.cs !== block.cs) ac.gfWait = { cs: block.cs, t: S.t };
  ac.waiting = block.cs;
  // in the shared stretch already: one still at its start waits where it is; one rolling along it can't stop short of it,
  // so it carries on and the give-way and the AI's re-routing sort it out
  if (zone <= 0.002) return gfMoving(ac) ? spd : 0;
  const stopAt = Math.max(0, zone - 0.006);   // about 10 m short of the junction
  return stopAt < 0.003 ? 0 : Math.min(spd, Math.max(3, Math.sqrt(2*TAXI_DEC*stopAt*3600)));
}

// ── departures spread across a runway's holding points: the nearest, unless another not much further has a shorter queue
if (typeof depHold === 'function') {
  const depHoldBase = depHold;
  depHold = function(ac){
    const base = depHoldBase(ac);
    try {
      if (!ac || ac.kind !== 'DEP' || (ac.hp && ac.leftStand && ac.state !== 'READY')) return base;
      const rw = depRw(ac), ks = Object.keys(HOLDS).filter(k => HOLDS[k].end === rw && HOLDS[k].node);
      if (ks.length < 2 || !ks.includes(base)) return base;
      const [from] = typeof taxiStart === 'function' && ac.x != null ? taxiStart(ac) : [ac.stand && ac.stand.node];
      if (!from) return base;
      const len = k => { const r = route(from, HOLDS[k].node); return r ? pathLen(r.nodes) : Infinity; };
      const L = new Map(ks.map(k => [k, len(k)])), Lmin = Math.min(...L.values()); if (!isFinite(Lmin)) return base;
      const load = k => S.acs.filter(o => o !== ac && o.kind === 'DEP' && o.ground && o.hp === k && ['TAXI', 'HOLDPT', 'LINEUP', 'LINEDUP', 'HELD'].includes(o.state)).length;
      let best = base, bc = Infinity;
      for (const k of ks) { const l = L.get(k); if (!isFinite(l) || l > Lmin*1.6 + 0.3) continue;
        const c = l + load(k)*0.25; if (c < bc - 1e-6) { bc = c; best = k; } }
      return best;
    } catch (e) { return base; }
  };
}
// ── the plan follows the runways: at the start and whenever they change
S.listeners.push(ev => { if (ev === 'start' || ev === 'rwy' || ev === 'rwyblock' || ev === 'rwyopen') { try { gfPlan(ev !== 'rwy'); } catch (e) { console.error(e); } } });
// ── drawn with the procedures on, close in: arrows along the one-way taxiways
function drawGFlow(){
  if (!GFLOW.ready || !S.showProc || V.scale < 260) return;
  const mpx = V.scale/1852;
  cx.save(); cx.lineCap = 'round';
  cx.strokeStyle = C.name === 'dark' ? 'rgba(126,200,255,.55)' : 'rgba(20,82,217,.45)'; cx.lineWidth = Math.max(1.2, 1.4*mpx);
  for (const [e, d] of GFLOW_DIR || []) {
    const A = GN[d > 0 ? e.a : e.b].p, B = GN[d > 0 ? e.b : e.a].p, L = dist(...A, ...B); if (L < 70/1852) continue;
    const h = brg(...A, ...B)*D2R, n = Math.max(1, Math.floor(L/(160/1852)));
    for (let k = 1; k <= n; k++) { const f = k/(n + 1), X = sx(A[0] + (B[0] - A[0])*f), Y = sy(A[1] + (B[1] - A[1])*f), s = Math.max(4, 5*mpx);
      cx.beginPath(); cx.moveTo(X - Math.sin(h - 0.5)*s, Y + Math.cos(h - 0.5)*s); cx.lineTo(X, Y); cx.lineTo(X - Math.sin(h + 0.5)*s, Y + Math.cos(h + 0.5)*s); cx.stroke(); }
  }
  // (the AI's precautionary hold points are not drawn: they have no published names, so they read as holding points a
  // controller can't use)
  cx.restore();
}
