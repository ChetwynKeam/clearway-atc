// ═════════════════════════ Clearway · the airway network ═════════════════════════
// One library for Area Control and the airport consoles: the real ATS route network (UK AIP ENR 3 through the VATSIM UK
// sector file, see tools/area_data.py), a router that flies between two points the way flights are planned (SID or
// feed fix, airways, STAR or exit fix, great circle where there are no airways), the geometry of a fly-by turn (a tangent
// arc whose radius follows from speed and bank, not a rounded corner), the position of an aircraft against a leg
// (cross-track and along-track, for tracking a leg instead of heading for a fix), and a chart renderer (airway lines by
// type, designators set along the line, VOR / NDB / waypoint symbols, names kept clear of each other).
// Everything here is in latitude / longitude and nautical miles; it has no globals but AW.
const AW = (() => {
  'use strict';
  const D2R = Math.PI/180, R2D = 180/Math.PI, RE = 3440.065;
  const norm = a => ((a % 360) + 360) % 360;
  const angDiff = (a, b) => { const d = norm(b - a); return d > 180 ? d - 360 : d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ── the sphere ──
  function gcNM(a, b){ const p1 = a[0]*D2R, p2 = b[0]*D2R, dp = p2 - p1, dl = (b[1] - a[1])*D2R;
    const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*RE*Math.asin(Math.min(1, Math.sqrt(h))); }
  function gcBrg(a, b){ const p1 = a[0]*D2R, p2 = b[0]*D2R, dl = (b[1] - a[1])*D2R;
    return norm(Math.atan2(Math.sin(dl)*Math.cos(p2), Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*R2D); }
  function gcAt(a, b, f){
    const d = gcNM(a, b)/RE; if (d < 1e-9) return [a[0], a[1]];
    const A = Math.sin((1 - f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d), p1 = a[0]*D2R, l1 = a[1]*D2R, p2 = b[0]*D2R, l2 = b[1]*D2R;
    const x = A*Math.cos(p1)*Math.cos(l1) + B*Math.cos(p2)*Math.cos(l2), y = A*Math.cos(p1)*Math.sin(l1) + B*Math.cos(p2)*Math.sin(l2), z = A*Math.sin(p1) + B*Math.sin(p2);
    return [Math.atan2(z, Math.hypot(x, y))*R2D, Math.atan2(y, x)*R2D];
  }
  function dest(p, brg, nm){ const d = nm/RE, p1 = p[0]*D2R, l1 = p[1]*D2R, t = brg*D2R, p2 = Math.asin(Math.sin(p1)*Math.cos(d) + Math.cos(p1)*Math.sin(d)*Math.cos(t));
    return [p2*R2D, (l1 + Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p1), Math.cos(d) - Math.sin(p1)*Math.sin(p2)))*R2D]; }
  // cross-track distance (NM, + to the right of the leg a→b), along-track distance from a, and what is left to b
  function xtk(p, a, b){
    const d13 = gcNM(a, p)/RE, t13 = gcBrg(a, p)*D2R, t12 = gcBrg(a, b)*D2R, L = gcNM(a, b);
    const xte = Math.asin(clamp(Math.sin(d13)*Math.sin(t13 - t12), -1, 1));
    const atd = Math.acos(clamp(Math.cos(d13)/Math.max(1e-12, Math.cos(xte)), -1, 1))*RE*(Math.cos(t13 - t12) < 0 ? -1 : 1);
    return { xte: xte*RE, atd, togo: L - atd, len: L, crs: gcBrg(a, b) };
  }
  // ── the turn: 25° of bank at the speed it is flown at (knots true) gives the radius in NM; the fly-by turn starts
  // radius × tan(half the change of course) before the point and rolls out on the next leg ──
  const turnRadius = (tas, bank = 25) => Math.max(0.5, tas*tas/(11.26*Math.tan(bank*D2R))/6076.12);
  const turnLead = (R, dc) => R*Math.tan(Math.min(Math.abs(dc), 165)*D2R/2);

  // ── the network ──
  let FIX = {}, AWYS = {}, AP = {}, RWY = {}, ADJ = {}, SEGS = [], NODES = [], DEG = {}, READY = false;
  let COVER = { la: [48.2, 61.5], lo: [-13.5, 4.8] };
  const inCover = p => p[0] > COVER.la[0] && p[0] < COVER.la[1] && p[1] > COVER.lo[0] && p[1] < COVER.lo[1];
  function init(D){
    FIX = D.fix || {}; AWYS = D.awy || {}; AP = D.ap || {}; RWY = D.rwy || {};
    // the region the airways cover (data may bring its own: the airport consoles carry the wider Europe network)
    COVER = D.cover ? { la: [D.cover[0], D.cover[1]], lo: [D.cover[2], D.cover[3]] } : { la: [48.2, 61.5], lo: [-13.5, 4.8] };
    ADJ = {}; SEGS = []; DEG = {};
    const seen = new Set();
    for (const [name, A] of Object.entries(AWYS)) for (const s of A.s) for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i], pa = FIX[a], pb = FIX[b]; if (!pa || !pb || a === b) continue;
      const d = gcNM(pa, pb); if (d > 420) continue;
      const k = (a < b ? a + '|' + b : b + '|' + a) + '|' + name; if (seen.has(k)) continue; seen.add(k);
      (ADJ[a] ||= []).push([b, name, d, A.l, A.t]); (ADJ[b] ||= []).push([a, name, d, A.l, A.t]);
      SEGS.push({ a, b, n: name, l: A.l, t: A.t, d, c: gcBrg(pa, pb), bb: [Math.min(pa[0], pb[0]), Math.min(pa[1], pb[1]), Math.max(pa[0], pb[0]), Math.max(pa[1], pb[1])] });
      (DEG[a] ||= new Set()).add(name); (DEG[b] ||= new Set()).add(name);
    }
    // Networks from different sources (the UK file and the rest of Europe) meet at the border, mostly without a shared point: the
    // nearest points of different networks within 35 NM are joined by a short direct leg (not drawn), so routes cross the border
    { const comp = {}; let nc = 0;
      for (const n of Object.keys(ADJ)) { if (comp[n] != null) continue; const st = [n]; comp[n] = nc; while (st.length) { const u = st.pop(); for (const e of ADJ[u]) if (comp[e[0]] == null) { comp[e[0]] = nc; st.push(e[0]); } } nc++; }
      if (nc > 1) {
        const ns = Object.keys(ADJ), grid = new Map(), key = (la, lo) => Math.floor(la/0.6) + ':' + Math.floor(lo/0.9);
        for (const n of ns) { const q = FIX[n], k = key(q[0], q[1]); (grid.get(k) || grid.set(k, []).get(k)).push(n); }
        const links = [];
        for (const a of ns) { const pa = FIX[a], ka = key(pa[0], pa[1]).split(':').map(Number), near = [];
          for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get((ka[0] + i) + ':' + (ka[1] + j)) || []) {
            if (comp[b] === comp[a] || a >= b) continue; const d = gcNM(pa, FIX[b]); if (d < 35) near.push([d, b]); }
          near.sort((x, y) => x[0] - y[0]); for (const [d, b] of near.slice(0, 2)) links.push([a, b, d]); }
        for (const [a, b, d] of links) { (ADJ[a] ||= []).push([b, '', d, 'U', 'C']); (ADJ[b] ||= []).push([a, '', d, 'U', 'C']); }
      } }
    NODES = Object.keys(ADJ); READY = true;
  }
  // a min-heap
  function hpush(h, it){ let i = h.length; h.push(it); while (i) { const p = (i - 1) >> 1; if (h[p][0] <= it[0]) break; h[i] = h[p]; i = p; } h[i] = it; }
  function hpop(h){ const top = h[0], last = h.pop(), n = h.length; if (!n) return top; let i = 0;
    for (;;) { let c = 2*i + 1; if (c >= n) break; if (c + 1 < n && h[c+1][0] < h[c][0]) c++; if (h[c][0] >= last[0]) break; h[i] = h[c]; i = c; } h[i] = last; return top; }
  // where a great circle from far away first comes inside the covered region (null when it never does)
  function edgeOf(far, near){
    const D = gcNM(far, near), n = Math.max(8, Math.ceil(D/25));
    for (let i = 0; i <= n; i++) { const p = gcAt(far, near, i/n); if (inCover(p)) return p; }
    return null;
  }
  // the airway fixes a point can join: those within r NM, the straighter ahead of a given course the better. cone: the
  // greatest angle off `course` (a fix to the side or behind would mean a turn back)
  function joinFixes(p, r, course, cone, outward){
    const out = [];
    for (const f of NODES) {
      const q = FIX[f]; if (Math.abs(q[0] - p[0]) > r/60) continue;
      const d = gcNM(p, q); if (d > r || d < 0.5) continue;
      let pen = 0;
      if (course != null) { const off = Math.abs(angDiff(course, gcBrg(p, q))); if (off > cone) continue; pen = off*d/90; }
      if (outward && gcNM(q, outward.from) < outward.d - 15) continue;
      out.push([f, d*1.2 + pen]);
    }
    return out.sort((a, b) => a[1] - b[1]).slice(0, 14);
  }
  // The shortest airway routing. starts / goals: [[fix, extra cost, tag]]: fixes of a procedure (its last / first point), or
  // when null a spread of airway fixes round `from` / `to` (the nearest, within `rf` / `rt` NM). farFrom / farTo: an
  // airport beyond the covered region: the join is on the great circle to it, costed by what is left to fly.
  // A start or goal that is not on any airway joins the network by the nearest fixes in its direction. Returns
  // { fixes, start: tag, goal: tag } or null.
  function search(o){
    if (!READY) return null;
    const { from, to, starts, goals, hi = true, farFrom, farTo } = o, rf = o.rf || 90, rt = o.rt || 90;
    const dist0 = new Map(), prev = new Map(), done = new Set(), h = [], tagS = new Map(), goalCost = new Map(), tagG = new Map();
    const target = farTo || to;
    const expand = (list, p, into, tags) => {   // procedure fixes that are not on an airway: join by the nearest ones
      for (const [f, c, tag] of list) {
        if (ADJ[f]) { if (!into.has(f) || c < into.get(f)) { into.set(f, c); tags.set(f, tag); } continue; }
        const q = FIX[f] || p; if (!q) continue;
        for (const [g, cc] of joinFixes(q, 120, null, 180, null).slice(0, 8)) { const v = c + cc; if (!into.has(g) || v < into.get(g)) { into.set(g, v); tags.set(g, tag); } }
      }
    };
    if (goals) expand(goals, to, goalCost, tagG);
    else for (const f of NODES) { const p = FIX[f];
      if (farTo) { const e = gcNM(p, to); if (e < 200) goalCost.set(f, gcNM(p, farTo) - gcNM(to, farTo) + e*0.5); }
      else { const d = gcNM(p, to); if (d < rt) goalCost.set(f, d*1.25); } }
    const hOf = f => (farTo ? Math.max(0, gcNM(FIX[f], farTo) - gcNM(to, farTo)) : gcNM(FIX[f], to))*0.9;
    const add = (f, c, pr) => { const old = dist0.get(f); if (old === undefined || c < old) { dist0.set(f, c); prev.set(f, pr); hpush(h, [c + hOf(f), f]); } };
    if (starts) { const m = new Map(); expand(starts, from, m, tagS); for (const [f, c] of m) add(f, c, null); }
    else for (const f of NODES) { const p = FIX[f];
      if (farFrom) { const e = gcNM(p, from); if (e < 200) add(f, e*0.5, null); }
      else { const d = gcNM(p, from); if (d < rf) add(f, d*1.25, null); } }
    if (!h.length || !goalCost.size) return null;
    let best = null, bestC = Infinity;
    while (h.length) {
      const [k, u] = hpop(h); if (done.has(u)) continue; done.add(u);
      const cu = dist0.get(u); if (k >= bestC) break;
      if (goalCost.has(u) && cu + goalCost.get(u) < bestC) { bestC = cu + goalCost.get(u); best = u; }
      for (const [v, , d, l, t] of ADJ[u] || []) { if (done.has(v)) continue;
        add(v, cu + d*(hi && l === 'L' ? 1.1 : !hi && l === 'U' ? 1.2 : 1)*(t === 'C' ? 1.04 : 1) + 2, u); }
    }
    if (!best) return null;
    const fixes = [best]; let c = best; while (prev.get(c)) { c = prev.get(c); fixes.unshift(c); }
    return { fixes, start: tagS.get(fixes[0]) ?? null, goal: tagG.get(best) ?? null };
  }
  // the legs of a fix sequence: the airway each pair of fixes is on (null when there is none: a direct leg)
  function airwayOf(a, b, hi){
    let best = null;
    for (const [v, name, d, l] of ADJ[a] || []) if (v === b && (!best || (hi ? l === 'U' : l === 'L'))) best = name;
    return best;
  }
  // The en-route part between two points as an array of [lat, lon, name?]: the airways between them where the great circle
  // crosses the network, the plain great circle where it does not. a / b are [lat, lon]. outward: the airport the route is
  // for; fixes closer to it than `b` is are not used to join (no doubling back at the end).
  function legBetween(a, b, o = {}){
    const D = gcNM(a, b); if (!READY || D < 30) return [];
    const ia = inCover(a), ib = inCover(b);
    const sA = ia ? a : edgeOf(a, b), sB = ib ? b : edgeOf(b, a);
    if (!sA || !sB || gcNM(sA, sB) < 30) return [];
    const r = search({ from: sA, to: sB, hi: o.hi !== false, farFrom: ia ? null : a, farTo: ib ? null : b, rf: o.rf || 90, rt: o.rt || 90 });
    if (!r) return [];
    return r.fixes.map(f => [FIX[f][0], FIX[f][1], f]);
  }

  // ── a fly-by turn, flown: points of the path through a list of points [lat, lon, ...], tangent arcs at the corners ──
  // R: the radius in NM (turnRadius at the speed it is flown). Where two corners are close together the arcs are made
  // smaller so they never overlap. Returns [[lat, lon, i]] where i is the index of the point a corner belongs to.
  function flyPath(pts, R, opt = {}){
    const out = [[pts[0][0], pts[0][1], 0]]; if (pts.length < 3) { for (let i = 1; i < pts.length; i++) out.push([pts[i][0], pts[i][1], i]); return out; }
    const L = [], C = [];
    for (let i = 1; i < pts.length; i++) { L.push(gcNM(pts[i-1], pts[i])); C.push(gcBrg(pts[i-1], pts[i])); }
    // the tangent length at each interior corner, held to under half of each neighbouring leg (and to what is left of it)
    const T = pts.map(() => 0), dc = pts.map(() => 0);
    for (let i = 1; i < pts.length - 1; i++) { dc[i] = angDiff(C[i-1], C[i]); T[i] = Math.abs(dc[i]) < 0.6 ? 0 : turnLead(R, dc[i]); }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < pts.length - 1; i++) {
      const room = Math.min(L[i-1]*(i > 1 ? 0.5 : 0.92), L[i]*(i < pts.length - 2 ? 0.5 : 0.92));
      if (T[i] > room) T[i] = room;
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const t = T[i];
      if (t < 0.05) { out.push([pts[i][0], pts[i][1], i]); continue; }
      const th = Math.abs(dc[i])*D2R, r = t/Math.tan(th/2), s = Math.sign(dc[i]);
      const p0 = dest(pts[i], C[i-1] + 180, t);
      out.push([p0[0], p0[1], i]);
      const n = Math.max(2, Math.ceil(Math.abs(dc[i])/(opt.stepDeg || 3))), da = dc[i]/n, ds = r*th/n;
      let p = p0, b = C[i-1] + da/2;
      for (let k = 0; k < n; k++) { p = dest(p, b, ds); b += da; out.push([p[0], p[1], i]); }
    }
    out.push([pts[pts.length-1][0], pts[pts.length-1][1], pts.length - 1]);
    return out;
  }
  // ── the circuit of a hold (standard: one minute legs, right turns unless left): points of the racetrack ──
  function holdPath(fix, inb, left, tas, legNM, bank = 25){
    const s = left ? -1 : 1, r = turnRadius(tas, bank), L = legNM || tas/60, out = [];
    const o1 = dest(fix, inb + 90*s, r), o2 = dest(o1, inb + 180, L);
    const arc = (c, from, sweep) => { const n = Math.max(2, Math.ceil(Math.abs(sweep)/6)); for (let k = 0; k <= n; k++) out.push(dest(c, from + sweep*k/n, r)); };
    arc(o1, inb - 90*s, 180*s);   // round the end at the fix onto the outbound leg
    arc(o2, inb + 90*s, 180*s);   // along the outbound leg, round again onto the inbound track
    out.push([fix[0], fix[1]]);
    return out;
  }

  // ── the way a hold is joined: 'direct', 'parallel' or 'teardrop' from the track the aircraft arrives on (the 70° rule) ──
  function holdEntry(inb, left, trk){
    const r = angDiff(inb, norm(trk + 180))*(left ? -1 : 1);
    return r >= -110 && r <= 70 ? 'direct' : r > 70 && r <= 140 ? 'parallel' : 'teardrop';
  }
  // ── the chart ──
  // v: { cx, P(la, lo) → [X, Y], W, H, dark, lvl: 'U' | 'L' | 'all', scale (px per NM), mine: Set of fix names to stress,
  //      label: bool, awyLabels: bool, detail: 0..2 }
  const PAL = {
    light: { U: 'rgba(36,88,170,.55)', L: 'rgba(160,98,20,.5)', C: 'rgba(70,84,104,.6)', txtU: '#1f4e96', txtL: '#8a5410', txtC: '#44546a', box: 'rgba(250,251,253,.88)', fix: '#33445a', vor: '#1c3a63', nd: '#6a4a1c' },
    dark: { U: 'rgba(110,178,245,.5)', L: 'rgba(230,170,90,.45)', C: 'rgba(170,190,205,.5)', txtU: '#93c8ff', txtL: '#f0bf7a', txtC: '#b9c8d6', box: 'rgba(4,16,22,.82)', fix: '#a9bdd2', vor: '#8ad0ff', nd: '#e8b878' }
  };
  const FONT = '"JetBrains Mono", ui-monospace, monospace';
  function drawChart(v){
    if (!READY) return;
    const cx = v.cx, P = v.P, W = v.W, H = v.H, pal = PAL[v.dark ? 'dark' : 'light'], sc = v.scale, lvl = v.lvl || 'all', M = 60;
    const busy = new Set(), cell = (x, y, w = 56, h = 14) => { const k = Math.floor(x/w) + ':' + Math.floor(y/h); return k; };
    const taken = (x, y, w, h) => { for (let X = x; X <= x + w; X += 28) for (let Y = y; Y <= y + h; Y += 12) if (busy.has(cell(X, Y, 28, 12))) return true; return false; };
    const take = (x, y, w, h) => { for (let X = x; X <= x + w; X += 28) for (let Y = y; Y <= y + h; Y += 12) busy.add(cell(X, Y, 28, 12)); };
    const on = new Map(), vis = [];
    cx.save(); cx.lineCap = 'round';
    // the lines: upper (blue), lower (amber), conventional (grey); the level not being looked at stays as a faint line
    for (const pass of ['back', 'front']) for (const s of SEGS) {
      const front = lvl === 'all' || s.l === lvl; if ((pass === 'front') !== front) continue;
      const pa = FIX[s.a], pb = FIX[s.b], [X1, Y1] = P(pa[0], pa[1]), [X2, Y2] = P(pb[0], pb[1]);
      if ((X1 < -M && X2 < -M) || (Y1 < -M && Y2 < -M) || (X1 > W + M && X2 > W + M) || (Y1 > H + M && Y2 > H + M)) continue;
      const len = Math.hypot(X2 - X1, Y2 - Y1); if (len < 3) continue;
      cx.strokeStyle = s.t === 'C' ? pal.C : s.l === 'U' ? pal.U : pal.L;
      cx.globalAlpha = front ? 1 : 0.22; cx.lineWidth = s.t === 'C' ? 1.5 : s.l === 'U' ? 1.2 : 1;
      cx.beginPath(); cx.moveTo(X1, Y1); cx.lineTo(X2, Y2); cx.stroke();
      if (front) { vis.push([s, X1, Y1, X2, Y2, len]); on.set(s.a, 1); on.set(s.b, 1); }
    }
    cx.globalAlpha = 1;
    // fixes: symbols, then names where they fit
    const syms = [];
    for (const f of on.keys()) { const q = FIX[f], [X, Y] = P(q[0], q[1]); if (X < -10 || Y < -10 || X > W + 10 || Y > H + 10) continue; syms.push([f, X, Y, q[2] || 'F']); }
    const rank = e => (e[3] === 'V' ? 0 : e[3] === 'N' ? 1 : 2) - Math.min(4, (DEG[e[0]] ? DEG[e[0]].size : 0))*0.5 - (v.mine && v.mine.has(e[0]) ? 3 : 0);
    syms.sort((a, b) => rank(a) - rank(b));
    const size = clamp(2.6 + Math.log2(Math.max(0.1, sc))*0.9, 2.6, 5.2);
    for (const [f, X, Y, k] of syms) {
      if (sc < 0.25 && k !== 'V') continue;
      cx.lineWidth = 1.1; cx.strokeStyle = k === 'V' ? pal.vor : k === 'N' ? pal.nd : pal.fix; cx.fillStyle = cx.strokeStyle;
      cx.beginPath();
      if (k === 'V') { for (let i = 0; i < 6; i++) { const a = i*Math.PI/3 + Math.PI/6; cx[i ? 'lineTo' : 'moveTo'](X + size*1.25*Math.cos(a), Y + size*1.25*Math.sin(a)); } cx.closePath(); cx.stroke(); cx.beginPath(); cx.arc(X, Y, 0.9, 0, 7); cx.fill(); }
      else if (k === 'N') { cx.setLineDash([1.5, 1.8]); cx.arc(X, Y, size, 0, 7); cx.stroke(); cx.setLineDash([]); cx.beginPath(); cx.arc(X, Y, 0.9, 0, 7); cx.fill(); }
      else if (sc >= 0.6) {   // a waypoint: the four-pointed star
        const r1 = size*0.95, r2 = size*0.32; for (let i = 0; i < 8; i++) { const a = i*Math.PI/4 - Math.PI/2, r = i % 2 ? r2 : r1; cx[i ? 'lineTo' : 'moveTo'](X + r*Math.cos(a), Y + r*Math.sin(a)); } cx.closePath(); cx.stroke();
      } else { cx.arc(X, Y, 1.1, 0, 7); cx.fill(); }
    }
    // airway designators, set along the line and turned to read upright, one every so often per airway
    if (v.awyLabels !== false && sc > 0.3) {
      cx.font = `600 10px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
      const lastAt = new Map(), spacing = clamp(200 - sc*5, 120, 220);
      vis.sort((a, b) => b[5] - a[5]);
      for (const [s, X1, Y1, X2, Y2, len] of vis) {
        const w = s.n.length*6.2 + 8; if (len < w + 28) continue;
        const mx = (X1 + X2)/2, my = (Y1 + Y2)/2; if (mx < 8 || my < 8 || mx > W - 8 || my > H - 8) continue;
        const prev = lastAt.get(s.n); if (prev && prev.some(([x, y]) => Math.hypot(x - mx, y - my) < spacing)) continue;
        if (taken(mx - w/2, my - 7, w, 14)) continue;
        take(mx - w/2, my - 7, w, 14);
        (prev || lastAt.set(s.n, []).get(s.n)).push([mx, my]);
        let ang = Math.atan2(Y2 - Y1, X2 - X1); if (Math.cos(ang) < 0) ang += Math.PI;
        cx.save(); cx.translate(mx, my); cx.rotate(ang);
        cx.fillStyle = pal.box; cx.strokeStyle = s.t === 'C' ? pal.C : s.l === 'U' ? pal.U : pal.L; cx.lineWidth = 1;
        cx.beginPath(); cx.roundRect ? cx.roundRect(-w/2, -6.5, w, 13, 3) : cx.rect(-w/2, -6.5, w, 13); cx.fill(); cx.stroke();
        cx.fillStyle = s.t === 'C' ? pal.txtC : s.l === 'U' ? pal.txtU : pal.txtL; cx.fillText(s.n, 0, 0.5);
        cx.restore();
      }
    }
    // the track and distance of a long leg, when zoomed in (as the enroute charts print them beside the line)
    if (v.awyLabels !== false && sc > 2.2) {
      cx.font = `500 9.5px ${FONT}`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; const done = new Set();
      for (const [s, X1, Y1, X2, Y2, len] of vis) {
        if (len < 150) continue; const k = s.a + s.b; if (done.has(k)) continue; done.add(k);
        let ang = Math.atan2(Y2 - Y1, X2 - X1), flip = Math.cos(ang) < 0; if (flip) ang += Math.PI;
        const f = 0.2, mx = X1 + (X2 - X1)*f, my = Y1 + (Y2 - Y1)*f, nx = -Math.sin(ang)*9, ny = Math.cos(ang)*9;
        const trk = flip ? norm(s.c + 180) : s.c, t = `${String(Math.round(trk) || 360).padStart(3, '0')}° ${Math.round(s.d)}`, w = t.length*5.6 + 4;
        if (taken(mx + nx - w/2, my + ny - 6, w, 12)) continue; take(mx + nx - w/2, my + ny - 6, w, 12);
        cx.save(); cx.translate(mx + nx, my + ny); cx.rotate(ang); cx.fillStyle = s.t === 'C' ? pal.txtC : s.l === 'U' ? pal.txtU : pal.txtL; cx.globalAlpha = 0.85; cx.fillText(t, 0, 0); cx.restore();
      }
    }
    // fix names
    if (v.label !== false) {
      cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
      for (const [f, X, Y, k] of syms) {
        const vor = k === 'V' || k === 'N', mine = v.mine && v.mine.has(f), junction = DEG[f] && DEG[f].size >= 3;
        if (!(vor ? sc > 0.7 : mine ? sc > 1 : junction ? sc > 1.8 : sc > 3.6)) continue;
        const t = f, w = t.length*6.4 + 4, big = vor || mine;
        if (taken(X + 6, Y - 12, w, 13)) continue; take(X + 6, Y - 12, w, 13);
        cx.font = `${big ? 600 : 500} ${big ? 11 : 10}px ${FONT}`; cx.fillStyle = k === 'V' ? pal.vor : k === 'N' ? pal.nd : pal.fix; cx.fillText(t, X + 6, Y - 3);
      }
    }
    cx.restore();
  }
  return { init, search, legBetween, airwayOf, joinFixes, edgeOf, inCover, flyPath, holdPath, holdEntry, turnRadius, turnLead, xtk, drawChart,
    gcNM, gcBrg, gcAt, dest, norm, angDiff, clamp,
    get ready(){ return READY; }, fix: n => FIX[n], fixes: () => FIX, airways: () => AWYS, adj: n => ADJ[n], nodes: () => NODES, segs: () => SEGS, aps: () => AP, rwy: ic => RWY[ic], rwys: () => RWY };
})();
