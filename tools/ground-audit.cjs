// Ground layout audit: checks every airport's taxiway graph the way the game uses it.
// usage: python3 -m http.server 8765 (repo root, after python3 build.py), then
//        node tools/ground-audit.cjs [icao ...]   → tools/audit/<icao>.json and a summary table
// Checks
//  graph   ISLAND     nodes cut off from the main taxiway network
//          DEADEND    a lane that just stops (not a stand, holding point or runway node)
//          GAP        two lane ends within 8 m of each other that aren't joined (a missing link)
//          XCROSS     two taxiway edges that cross with no junction node (aircraft can't turn there, and may collide)
//  departures, per stand and departure runway end, after a push either way
//          DEP_NONE   no route at all to the runway's departure holding points
//          DEP_TURN   only reachable by turning round on a taxiway (no facing route)
//          DEP_DETOUR route more than 3.5x the straight-line distance and 1.5 km longer
//  arrivals, per landing runway end and stand, from every exit off that end
//          ARR_NONE   no exit has any route to the stand
//          ARR_TURN   only reachable by turning round
//          ARR_INTO   the route arrives at the lead-in from the wrong way (more than the max turn onto the stand line)
//          EXIT_DEAD  an exit from which no stand can be reached facing forward
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ALL = ['lxgb', 'lpma', 'eglc', 'lowi', 'kjfk', 'yssy', 'egkk', 'lemd', 'egcc', 'egll', 'eidw', 'omdb', 'egaa', 'eggd', 'lsgg', 'egnt'];
const args = process.argv.slice(2), SHOTS = args.includes('--shots'), codes = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : ALL;
const WT = { DEP_NONE: 5, ARR_NONE: 5, DEP_TURN: 3, ARR_TURN: 3, STAND_OFFPAVE: 3, GAP: 3, KINK: 3, ARR_INTO: 2, XCROSS: 2, OFFPAVE: 2, EXIT_DEAD: 2, ISLAND: 2, DEP_DETOUR: 1, DEADEND: 0.5, ORPHAN: 0 };
const scoreOf = count => Object.entries(count).reduce((t, [k, n]) => t + (WT[k] ?? 1)*n, 0);
// the worst spots: issues bucketed on a 250 m grid, heaviest first
function clusters(issues, n = 4){
  const g = new Map(); for (const i of issues) { if (!i.p || !(WT[i.t] >= 1)) continue; const k = Math.round(i.p[0]/250) + ',' + Math.round(i.p[1]/250);
    if (!g.has(k)) g.set(k, { w: 0, list: [] }); const c = g.get(k); c.w += WT[i.t]; c.list.push(i); }
  return [...g.values()].sort((a, b) => b.w - a.w).slice(0, n).map(c => ({ ...c, x: c.list.reduce((t, i) => t + i.p[0], 0)/c.list.length, y: c.list.reduce((t, i) => t + i.p[1], 0)/c.list.length }));
}
async function shoot(p, code, r){
  await p.setViewportSize({ width: 1700, height: 1100 });
  await p.evaluate(() => { try { cwGate = () => true; } catch (e) {} for (const k of AI_SEATS) S.seats[k] = 'AI'; try { liveBox.checked = false; } catch (e) {} start(); });
  await p.waitForTimeout(1000);
  const out = [];
  for (const [i, c] of clusters(r.issues).entries()) {
    await p.evaluate(([x, y, list]) => { S.paused = true; V.cx = x/1852; V.cy = y/1852; V.scale = 2600; window.__iss = list;
      if (!window.__d0) { window.__d0 = draw; draw = function(){ window.__d0(); const g = cx; g.save(); g.setTransform(DPR, 0, 0, DPR, 0, 0);
        g.lineWidth = 1.5; for (const e of GE) { const a = GN[e.a].p, b = GN[e.b].p; g.strokeStyle = e.a[0] === 'R' || e.b[0] === 'R' ? '#f0f' : e.bare ? 'rgba(0,170,255,.3)' : '#0af'; g.beginPath(); g.moveTo(sx(a[0]), sy(a[1])); g.lineTo(sx(b[0]), sy(b[1])); g.stroke(); }
        for (const n of Object.values(GN)) { const d = waysOn(n.id).length; g.fillStyle = d === 1 ? '#f33' : '#0af'; g.beginPath(); g.arc(sx(n.p[0]), sy(n.p[1]), d === 1 ? 4 : 1.5, 0, 7); g.fill(); }
        g.font = 'bold 11px sans-serif'; for (const s of STANDS) { g.strokeStyle = g.fillStyle = '#0c0'; g.beginPath(); g.moveTo(sx(s.lp[0]), sy(s.lp[1])); g.lineTo(sx(s.p[0]), sy(s.p[1])); g.stroke(); g.fillText(s.id, sx(s.p[0]) + 3, sy(s.p[1])); }
        g.font = 'bold 12px sans-serif'; for (const it of window.__iss) { const X = sx(it.p[0]/1852), Y = sy(it.p[1]/1852); g.strokeStyle = '#ff0'; g.lineWidth = 2.5; g.beginPath(); g.arc(X, Y, 10, 0, 7); g.stroke(); g.fillStyle = '#ff0'; g.fillText(it.t, X + 12, Y - 8); }
        g.restore(); }; } }, [c.x, c.y, c.list]);
    await p.waitForTimeout(700);
    const bx = await p.evaluate(() => { const q = cv.getBoundingClientRect(); return { x: q.x, y: q.y, width: q.width, height: q.height }; });
    const f = path.join(OUT, `${code}-${i + 1}.png`); await p.screenshot({ path: f, clip: bx }); out.push({ f: path.basename(f), w: c.w, n: c.list.length, x: Math.round(c.x), y: Math.round(c.y), kinds: [...new Set(c.list.map(i => i.t))] });
  }
  return out;
}
const OUT = path.join(__dirname, 'audit'); fs.mkdirSync(OUT, { recursive: true });

function audit(){
  const M = 1852, R2 = Math.PI/180;
  const issues = [], add = (t, where, msg, p) => issues.push({ t, where, msg, p: p ? [Math.round(p[0]*M), Math.round(p[1]*M)] : null });
  const isR = id => id[0] === 'R';
  const ids = Object.keys(GN), N = ids.length;
  const standNodes = new Set(STANDS.map(s => s.node)), holdNodes = new Set(Object.values(HOLDS).map(h => h.node));
  for (const s of STANDS) if (s.out && s.out.node) standNodes.add(s.out.node);
  for (const h of (typeof HANGARS !== 'undefined' ? HANGARS : [])) if (h.node) standNodes.add(h.node);
  // ── graph ──
  const comp = new Map(); let ci = 0, sizes = [];
  for (const id of ids) { if (comp.has(id) || isR(id)) continue; let n = 0; const st = [id]; comp.set(id, ci);
    while (st.length) { const u = st.pop(); n++; for (const [v, e] of GN[u].adj) if (!comp.has(v) && !isR(v) && !e.closed) { comp.set(v, ci); st.push(v); } }
    sizes.push(n); ci++; }
  const main = sizes.indexOf(Math.max(...sizes));
  // an airfield: a network with a holding point on it (Belfast has two). Nodes cut off from every airfield are an island
  const fields = new Set(Object.values(HOLDS).map(h => comp.get(h.node)));
  const field = id => comp.get(id);
  // a network reached only over the runway, whose departures line up by backtracking on it (Newcastle's Golf Apron and
  // maintenance area: H.back), is an airfield of its own however small
  const backField = new Set(Object.values(HOLDS).filter(h => (h.back || []).length).map(h => comp.get(h.node)));
  sizes.forEach((n, c) => { if (c === main || (fields.has(c) && n > 30) || backField.has(c)) return; const mem = ids.filter(i => comp.get(i) === c), st = mem.filter(i => standNodes.has(i)).length;
    add(n === 1 && !st ? 'ORPHAN' : 'ISLAND', mem[0], `${n} nodes cut off from the main network${st ? `, with ${st} stands` : ''}`, GN[mem[0]].p); });
  const deg = id => waysOn(id).filter(([v]) => !isR(v)).length + waysOn(id).filter(([v]) => isR(v)).length;
  const ends = ids.filter(id => !isR(id) && deg(id) === 1 && !standNodes.has(id) && !holdNodes.has(id) && !GN[id].adj.some(([v]) => isR(v)));   // a runway entry's end is joined to the runway
  for (const id of ends) add('DEADEND', id, `lane ends at ${id}`, GN[id].p);
  // kinks: a node joining two legs at a turn sharper than the turn limit can't be passed either way
  for (const id of ids) { if (isR(id)) continue; const ws = GN[id].adj.filter(([v, e]) => !e.bare && e.len > 0.3/M && !isR(v));
    if (ws.length !== 2 || GN[id].adj.some(([v]) => isR(v)) || standNodes.has(id) || holdNodes.has(id)) continue;
    const t = Math.abs(angDiff(brg(...GN[ws[0][0]].p, ...GN[id].p), brg(...GN[id].p, ...GN[ws[1][0]].p)));
    const by = new Set(ws.map(([v]) => v)); if (ws.some(([v]) => GN[v].adj.some(([x, e]) => e.fil && (by.has(x) || x === id || GN[x].adj.some(([y]) => by.has(y)))))) continue;   // bypassed by a corner link
    if (t > 145 && dist(...GN[ws[0][0]].p, ...GN[ws[1][0]].p)*M < 30) continue;
    if (id[0] === 'x' && ws[0][1].tw !== ws[1][1].tw) continue;   // two runway entries from either side meeting on the centreline: not a way across   // the tip of a V-shaped stub (a dead-end pad): nothing to pass
    if (t > TURN_MAX) add('KINK', id, `${Math.round(t)}° kink at ${id} on ${ws[0][1].tw}/${ws[1][1].tw}: can't be passed`, GN[id].p); }
  // near-miss: a dead end close to another node or edge it isn't joined to
  const near2 = (a, b) => { const seen = new Set([a]); let fr = [a]; for (let k = 0; k < 6; k++) { const nx = []; for (const u of fr) for (const [v] of GN[u].adj) if (!seen.has(v)) { if (v === b) return true; seen.add(v); nx.push(v); } fr = nx; } return false; };
  for (const id of ends) { const p = GN[id].p;
    for (const e of GE) { if (e.a === id || e.b === id || isR(e.a) || isR(e.b)) continue;
      const d = segDistM(p, GN[e.a].p, GN[e.b].p); if (d < 8 && !near2(id, e.a) && !near2(id, e.b)) { add('GAP', id, `lane end ${id} is ${d.toFixed(1)} m from ${e.tw || '?'} but not joined`, p); break; } } }
  // crossings without a node
  const cr = (o, p, q) => (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0]);
  const E = GE.filter(e => !isR(e.a) && !isR(e.b) && !e.bare && e.len > 1/M).map(e => { const a = GN[e.a].p, b = GN[e.b].p; return { e, a, b, x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }; });
  E.sort((u, v) => u.x0 - v.x0); const xs = new Set();
  for (let i = 0; i < E.length; i++) { const A = E[i];
    for (let j = i + 1; j < E.length && E[j].x0 <= A.x1; j++) { const B = E[j];
      if (B.y0 > A.y1 || B.y1 < A.y0) continue; const ea = A.e, eb = B.e;
      if (ea.a === eb.a || ea.a === eb.b || ea.b === eb.a || ea.b === eb.b) continue;
      if (cr(A.a, A.b, B.a)*cr(A.a, A.b, B.b) < 0 && cr(B.a, B.b, A.a)*cr(B.a, B.b, A.b) < 0) {
        // a lane into a stand crossing another stand's lead-in is the stand area, not a taxiway fault
        if ((ea.fil || eb.fil) && ea.tw === eb.tw) continue;
        // the turn-off curves of one junction cross each other (as painted): both lines lead into the same junction
        { const hop = (n0, j) => { const seen = new Set([n0]); let fr = [n0]; for (let k = 0; k < 8; k++) { if (seen.has(j)) return true; const nx = []; for (const u of fr) for (const [v] of GN[u].adj) if (!seen.has(v)) { seen.add(v); nx.push(v); } fr = nx; } return seen.has(j); };
          const X = A.a, js = ids.filter(j => !isR(j) && GN[j].adj.length >= 3 && dist(...GN[j].p, ...X)*M < 90);
          if (js.some(j => (hop(ea.a, j) || hop(ea.b, j)) && (hop(eb.a, j) || hop(eb.b, j)))) continue; }
        if ([ea.a, ea.b, eb.a, eb.b].some(n => standNodes.has(n)) && (ea.tw === eb.tw || /APRON|^$/.test(ea.tw + '') || /APRON/.test(eb.tw + ''))) continue;
        const k = [ea.tw, eb.tw].sort().join('×'); const key = k + Math.round(A.a[0]*M/50) + ',' + Math.round(A.a[1]*M/50); if (xs.has(key)) continue; xs.add(key);
        add('XCROSS', `${ea.tw}/${eb.tw}`, `${ea.tw || '?'} (${ea.a}-${ea.b}) crosses ${eb.tw || '?'} (${eb.a}-${eb.b}) with no junction`, A.a); } } }
  // ── pavement: every lane node and stand on a paved surface (taxiway strokes, aprons, runway) ──
  if (typeof AD !== 'undefined' && AD.twys) {
    const W = (AD.pave && AD.pave.w || 23)/2 + 4, cell = 60/M, grid = new Map(), key = (x, y) => Math.floor(x/cell) + ',' + Math.floor(y/cell);
    const put = (k, it) => { if (!grid.has(k)) grid.set(k, []); grid.get(k).push(it); };
    const lines = Object.values(AD.twys).filter(l => Array.isArray(l) && l.length > 1).map(l => l.map(([m, o]) => rm(m, o)));
    for (const l of lines) for (let i = 1; i < l.length; i++) { const a = l[i-1], b = l[i], n = Math.ceil(dist(...a, ...b)/cell) + 1;
      for (let j = 0; j <= n; j++) { const f = j/n; for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) put(key(a[0] + (b[0]-a[0])*f + dx*cell, a[1] + (b[1]-a[1])*f + dy*cell), ['s', a, b]); } }
    const polys = [...(AD.aprons || []), AD.rwyPoly, ...(AD.extraPolys || [])].filter(q => Array.isArray(q) && q.length > 2).map(q => q.map(([m, o]) => rm(m, o)));
    const inP = (p, q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj-xi)*(p[1]-yi)/(yj-yi) + xi) c = !c; } return c; };
    const rw = (typeof RWYS !== 'undefined' ? RWYS : []).filter(R => R.rm);
    const paved = p => (grid.get(key(...p)) || []).some(([, a, b]) => segDistM(p, a, b) < W) || polys.some(q => inP(p, q));
    const off = [];
    for (const id of ids) if (!isR(id) && GN[id].adj.length && !paved(GN[id].p)) off.push(id);
    // cluster lane nodes off the pavement (a stretch of lane is one fault)
    const done = new Set();
    for (const id of off) { if (done.has(id)) continue; const grp = [id], st = [id]; done.add(id);
      while (st.length) { const u = st.pop(); for (const [v] of GN[u].adj) if (!done.has(v) && off.includes(v)) { done.add(v); grp.push(v); st.push(v); } }
      const tws = [...new Set(grp.flatMap(n => GN[n].adj.map(([, e]) => e.tw)).filter(Boolean))].slice(0, 3).join('/');
      add('OFFPAVE', tws || id, `${grp.length} lane node${grp.length > 1 ? 's' : ''} on ${tws || '?'} not on any drawn pavement`, GN[id].p); }
    for (const s of STANDS) if (!paved(s.p)) add('STAND_OFFPAVE', s.id, `stand ${s.id} is not on any drawn apron`, s.p);
  }
  // ── runway ends and their holding points ──
  const endsOf = new Set(); for (const h of Object.values(HOLDS)) for (const d of h.dirs || []) endsOf.add(d);
  const rwEnds = [...endsOf];
  // a runway end's departure holding points: those at that end, and those that line up by backtracking to it (H.back)
  const holdsAt = rw => { const ks = Object.keys(HOLDS).filter(k => HOLDS[k].end === rw || (HOLDS[k].back || []).includes(rw)); return ks.length ? ks : Object.keys(HOLDS).filter(k => (HOLDS[k].dirs || []).includes(rw)); };
  const holdsOn = rw => Object.keys(HOLDS).filter(k => (HOLDS[k].dirs || []).includes(rw));
  const pl = r => r ? pathLen(r.nodes) : Infinity;
  const stats = { stands: STANDS.length, nodes: N, edges: GE.length, rwEnds, depPairs: 0, arrPairs: 0 };
  // departures
  const depBad = {};
  for (const st of STANDS) {
    if (!GN[st.node]) { add('DEP_NONE', st.id, `stand ${st.id} has no graph node`, st.p); continue; }
    const lp = st.lp || GN[st.node].p;
    // the faces the game itself would start the taxi with after each way of pushing (sim.js pushFace/taxiStart)
    const n0 = GN[st.node].p, faces = [], starts = [];
    if (typeof pushPath === 'function') for (const f of ['east', 'west', 'north', 'south']) { try {
      const pts = pushPath({ stand: st, type: 'A320', x: st.p[0], y: st.p[1], hdg: st.hdg }, f), end = pts[pts.length - 1], h = brg(...end, ...(pts.length > 1 ? pts[pts.length - 2] : st.p)), b = brg(...end, ...n0);
      const fc = dist(...end, ...n0) > 10/M && Math.abs(angDiff(h, b)) < 90 ? b : h;
      if (!faces.some(x => Math.abs(angDiff(x, fc)) < 2)) faces.push(fc); } catch (e) {} }
    if (!faces.length) { const wy = waysOn(st.node).filter(([v]) => !isR(v));
      for (const fc of wy.length === 1 ? [brg(...lp, ...GN[wy[0][0]].p)] : wy.map(([v]) => norm(brg(...lp, ...GN[v].p) + 180))) faces.push(fc); }
    if (st.out && st.out.node && GN[st.out.node]) { const P = st.out.pts, a = P.length > 1 ? P[P.length - 2] : st.p; starts.push([st.out.node, brg(...a, ...GN[st.out.node].p)]); }
    for (const rw of rwEnds) { const hs = holdsAt(rw).map(k => HOLDS[k].node).filter(h => field(h) === field(st.node)); if (!hs.length) continue; stats.depPairs++;
      let best = null; for (const [from, f] of faces.map(f => [st.node, f]).concat(starts)) { const m = routesFrom(from, hs, f); for (const h of hs) { const r = m.get(h); if (r && (!best || pl(r) < pl(best))) best = r; } }
      if (!best) { const m = routesFrom(st.node, hs); const any = hs.map(h => m.get(h)).filter(Boolean)[0];
        (depBad[any ? 'DEP_TURN' : 'DEP_NONE'] ||= []).push([st, rw]); continue; }
      const crow = Math.min(...hs.map(h => dist(...GN[st.node].p, ...GN[h].p))), L = pl(best);
      if (L > crow*3.5 && (L - crow)*M > 1500) (depBad.DEP_DETOUR ||= []).push([st, rw, Math.round(L*M), Math.round(crow*M)]); } }
  for (const [t, list] of Object.entries(depBad)) for (const [st, rw, L, c] of list) add(t, st.id, t === 'DEP_DETOUR' ? `stand ${st.id} → ${rw}: ${L} m taxi for ${c} m straight` : `stand ${st.id} → runway ${rw}`, st.p);
  // arrivals
  const dests = STANDS.filter(s => GN[s.node]);
  for (const rw of rwEnds) {
    // the exits the game itself offers off this end (exitsFor), else every holding point on it but the departure end's
    let ex0 = []; try { if (typeof exitsFor === 'function') ex0 = exitsFor(rw) || []; } catch (e) {}
    const ex = (ex0.length ? ex0 : holdsOn(rw).filter(k => HOLDS[k].end !== rw)).filter(k => HOLDS[k] && GN[HOLDS[k].rwy || ''] && GN[HOLDS[k].node]);
    if (!ex.length) continue;
    const reach = new Map(), turn = new Map();
    for (const k of ex) { const H = HOLDS[k], face = brg(...GN[H.rwy].p, ...GN[H.node].p);
      const m = routesFrom(H.node, dests.map(s => s.node), face); let n = 0;
      for (const s of dests) { const r = m.get(s.node); if (!r) continue; n++;
        const lead = s.lp && dist(...s.lp, ...s.p) > 5/M ? (typeof leadInB === 'function' ? leadInB(s) : brg(...s.lp, ...s.p)) : null, nn = r.nodes, last = nn.length > 1 ? brg(...GN[nn[nn.length-2]].p, ...GN[nn[nn.length-1]].p) : null;
        const chord = s.lp ? brg(...s.lp, ...s.p) : null;
        const ok = lead == null || last == null || s.out || Math.abs(angDiff(last, lead)) <= TURN_MAX || Math.abs(angDiff(last, chord)) <= TURN_MAX;
        const prev = reach.get(s); if (!prev || (ok && !prev.ok)) reach.set(s, { ok, k }); }
      if (!n) add('EXIT_DEAD', k, `exit ${k} off ${rw}: no stand reachable facing forward`, GN[H.node].p); }
    const fs = new Set(ex.map(k => field(HOLDS[k].node)));
    for (const s of dests) { if (!fs.has(field(s.node))) continue; stats.arrPairs++; const r = reach.get(s);
      if (!r) { const m = routesFrom(HOLDS[ex[0]].node, [s.node]); add(m.get(s.node) ? 'ARR_TURN' : 'ARR_NONE', s.id, `runway ${rw} → stand ${s.id}`, s.p); }
      else if (!r.ok && !ex.some(k => { const H = HOLDS[k]; return route(H.node, s.node, null, brg(...GN[H.rwy].p, ...GN[H.node].p), typeof leadInB === 'function' ? leadInB(s) : brg(...s.lp, ...s.p)) || route(H.node, s.node, null, brg(...GN[H.rwy].p, ...GN[H.node].p), brg(...s.lp, ...s.p)); })) add('ARR_INTO', s.id, `runway ${rw} → stand ${s.id}: arrives at the lead-in the wrong way`, s.p); } }
  const count = {}; for (const i of issues) count[i.t] = (count[i.t] || 0) + 1;
  return { stats, count, issues };
}

(async () => {
  const b = await chromium.launch(), rows = [];
  for (const code of codes) {
    const p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
    const url = `http://localhost:8765/dist/${code === 'lxgb' ? '' : code + '/'}index.html#wx/fair`;
    try {
      await p.goto(url); await p.waitForTimeout(2500);
      const r = await p.evaluate(audit);
      r.errors = errs.slice(0, 5); r.score = scoreOf(r.count); r.rate = +(r.score/Math.max(1, r.stats.stands)).toFixed(2);
      if (SHOTS) r.shots = await shoot(p, code, r);
      fs.writeFileSync(path.join(OUT, code + '.json'), JSON.stringify(r, null, 1));
      rows.push({ code, stands: r.stats.stands, score: r.score, rate: r.rate, count: r.count, shots: r.shots || [] });
      console.log(code.toUpperCase().padEnd(5), `stands ${r.stats.stands}`.padEnd(11), `score ${r.score}`.padEnd(12), JSON.stringify(r.count));
    } catch (e) { console.log(code.toUpperCase(), 'FAILED', String(e.message).slice(0, 200)); }
    await p.close();
  }
  await b.close();
  // the report: worst first (fault score per stand)
  rows.sort((a, b) => b.rate - a.rate);
  const kinds = Object.keys(WT).filter(k => rows.some(r => r.count[k]));
  let md = `# Ground audit\n\nGenerated by \`node tools/ground-audit.cjs\` on ${new Date().toISOString().slice(0, 10)}. Worst first, by fault score per stand ` +
    `(weights: ${Object.entries(WT).map(([k, v]) => k + ' ' + v).join(', ')}).\n\n| Airport | Stands | Score | Per stand | ${kinds.join(' | ')} |\n|---|---|---|---|${kinds.map(() => '---').join('|')}|\n`;
  for (const r of rows) md += `| ${r.code.toUpperCase()} | ${r.stands} | ${r.score} | ${r.rate} | ${kinds.map(k => r.count[k] || '').join(' | ')} |\n`;
  if (rows.some(r => r.shots.length)) { md += `\n## Worst spots\n`; for (const r of rows) if (r.shots.length) { md += `\n### ${r.code.toUpperCase()}\n\n`; for (const s of r.shots) md += `- ${s.kinds.join(', ')} (${s.n} issues) near ${s.x}, ${s.y} m: ![](${s.f})\n`; } }
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
})();
