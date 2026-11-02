// ═════════════════════════ ground vehicles ═════════════════════════
// The airside traffic that works round the aircraft: the turnaround fleet (steps, baggage tractors with their carts,
// belt loaders, catering high-loaders, fuel bowsers, ground power, toilet service), apron buses to the remote stands,
// the pushback tug that comes to the nose and pushes or tows, the jet bridges that swing out to the door, engineers'
// vans between the hangars and the stands, and the fire service out on training runs.
// They drive the real airside roads (OpenStreetMap service roads inside the aerodrome fence, from the airport's
// <icao>-veh.js, built by tools/vehicles_osm.py), keep to their side of the road (left in the UK) and give way to
// aircraft. Where an airport's map has no road somewhere, they use the taxiway edge: then they stop and ask you
// before driving along a taxiway, and they stop short of every runway and ask to cross (see "asking" below).
// Clicking one says what it is doing (no route is drawn).
const VM = M2NM;   // metres to NM
const VD = typeof VEH_DATA !== 'undefined' ? VEH_DATA : { nodes: [], edges: [], fire: [], firetrain: [], hangars: [], fuel: [], catering: [], terms: [], bridges: [] };
const VP = ([e, n]) => [e*VM, n*VM];
const KEEP_LEFT = /^EG/.test(APT.icao);
// ── the road graph: the airside roads, plus the taxiway graph (no runways) for where the roads don't go
const VG = {};
let VG_BUILT = false;
const VG_GRID = new Map(), VG_CELL = 120;   // metres
const vgKey = (x, y) => Math.floor(x/VM/VG_CELL) + ',' + Math.floor(y/VM/VG_CELL);
function vgAdd(id, p, road){ VG[id] = { id, p, adj: [], road }; const k = vgKey(...p); if (!VG_GRID.has(k)) VG_GRID.set(k, []); VG_GRID.get(k).push(id); }
function vgLink(a, b, kind){ const L = dist(...VG[a].p, ...VG[b].p); if (L < 1e-9) return; VG[a].adj.push([b, L, kind]); VG[b].adj.push([a, L, kind]); }
// nearest graph nodes to a point (roads only, taxiways only, or either), within r metres
function vgNear(p, r = 300, pick){
  const n = Math.ceil(r/VG_CELL), cx0 = Math.floor(p[0]/VM/VG_CELL), cy0 = Math.floor(p[1]/VM/VG_CELL); let best = null, bd = r*VM;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const id of VG_GRID.get((cx0 + i) + ',' + (cy0 + j)) || []) {
    const N = VG[id]; if (pick && !pick(N)) continue; const d = dist(...p, ...N.p); if (d < bd) { bd = d; best = id; }
  }
  return best;
}
// a line across a runway (a road end joined to a taxiway on the far side, say): vehicles never drive across one
// unless cleared on to it (a runway check), so the graph has no such links
function crossesRwy(a, b){
  for (const R of RWYS) {
    const oa = R.offOf(a), ob = R.offOf(b), ma = R.mOf(a), mb = R.mOf(b), L = R.len || RWY_M;
    if (Math.max(ma, mb) < -60 || Math.min(ma, mb) > L + 60) continue;
    if (oa*ob < 0 || Math.min(Math.abs(oa), Math.abs(ob)) < (APT.rwyHalfWidth || 22.5) + 8) return true;
  }
  return false;
}
function vgBuild(){
  if (VG_BUILT) return; VG_BUILT = true;
  VD.nodes.forEach((q, i) => vgAdd('r:' + i, VP(q), true));
  for (const [a, b] of VD.edges) vgLink('r:' + a, 'r:' + b, 'r');
  // the taxiways (never the runway itself): a vehicle drives along their edge where the roads don't reach
  for (const id in GN) if (id[0] !== 'R' && GN[id].adj.length) vgAdd('t:' + id, GN[id].p, false);   // (a node left with no taxiway is not somewhere to drive)
  for (const e of GE) if (VG['t:' + e.a] && VG['t:' + e.b] && !crossesRwy(GN[e.a].p, GN[e.b].p)) vgLink('t:' + e.a, 't:' + e.b, 't');
  // across a runway where a taxiway crosses it: from the taxiway node one side, over the runway's own nodes, to the
  // taxiway node the other side (only ever driven with the tower's clearance)
  const HW = (APT.rwyHalfWidth || 22.5) + 8, onR = p => RWYS.find(R => Math.abs(R.offOf(p)) < HW && R.mOf(p) > -60 && R.mOf(p) < rLen(R) + 60);
  for (const id in GN) {
    if (!VG['t:' + id] || onR(GN[id].p)) continue;
    for (const [r0] of GN[id].adj) {
      if (!onR(GN[r0].p)) continue;
      const seen = new Set([id, r0]), q = [[r0, dist(...GN[id].p, ...GN[r0].p)]];
      while (q.length) {
        const [n, L] = q.shift();
        for (const [m] of GN[n].adj) {
          if (seen.has(m)) continue; seen.add(m); const L2 = L + dist(...GN[n].p, ...GN[m].p); if (L2 > 400*VM) continue;
          if (onR(GN[m].p)) { q.push([m, L2]); continue; }
          if (!VG['t:' + m] || VX.has('t:' + id + '|t:' + m)) continue;
          const a = GN[id].p, b = GN[m].p, R = RWYS.find(R => R.offOf(a)*R.offOf(b) < 0 && Math.abs(R.mOf(a) - R.mOf(b)) < 250 && R.mOf(a) > -60 && R.mOf(a) < rLen(R) + 60);
          if (!R) continue;
          vgLink('t:' + id, 't:' + m, 'x'); VX.set('t:' + id + '|t:' + m, R); VX.set('t:' + m + '|t:' + id, R);
        }
      }
    }
  }
  // roads join the taxiways where they meet them (an apron road running onto a taxiway, a dead end at the apron edge)
  for (let i = 0; i < VD.nodes.length; i++) {
    const id = 'r:' + i, deg = VG[id].adj.length, t = vgNear(VG[id].p, deg <= 1 ? 90 : 35, N => !N.road && !crossesRwy(VG[id].p, N.p));
    if (t) vgLink(id, t, 'l');
  }
}
// shortest drive, roads preferred; emergency vehicles take the taxiways freely. Remembered: the graph never changes.
const VR_MEMO = new Map();
function vroute(from, to, urgent){
  if (from === to) return [from];
  const ck = from + '>' + to + (urgent ? '!' : ''); if (VR_MEMO.has(ck)) return VR_MEMO.get(ck);
  // a runway crossing costs a detour's worth: the roads round are taken if there are any
  const w = urgent ? { r: 1, l: 1, t: 1.15, x: 1 } : { r: 1, l: 1.5, t: 3, x: 3 }, xc = (urgent ? 150 : 900)*VM;
  const dd = new Map([[from, 0]]), prev = new Map(), done = new Set(), h = [[0, from]]; let found = false;
  while (h.length) {
    const [d, u] = heapPop(h); if (done.has(u)) continue; if (u === to) { found = true; break; } done.add(u);
    for (const [v, L, k] of VG[u].adj) { const nd = d + L*w[k] + (k === 'x' ? xc : 0), o = dd.get(v); if (o === undefined || nd < o) { dd.set(v, nd); prev.set(v, u); heapPush(h, [nd, v]); } }
  }
  let r = null; if (found) { r = [to]; let c = to; while (c !== from) { c = prev.get(c); r.unshift(c); } }
  if (VR_MEMO.size > 4000) VR_MEMO.clear();
  VR_MEMO.set(ck, r); return r;
}
// a route's points, moved to the driver's side of the road (more on a taxiway, which a vehicle keeps to the edge of)
function laneOffset(ids){
  const P = ids.map(id => VG[id].p), out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], h = brg(...a, ...b);
    const road = VG[ids[i]].road, off = (road ? 2.2 : 9)*VM*(KEEP_LEFT ? -1 : 1);
    out.push(i === 0 || i === P.length - 1 ? P[i].slice() : [P[i][0] + Math.cos(h*D2R)*off, P[i][1] - Math.sin(h*D2R)*off]);
  }
  return out;
}

// ── asking: a vehicle drives the roads and aprons by itself, but asks the tower before it drives along a taxiway
// (more than a short hop across one, and not the apron lanes or a stand's lead-in) and stops short of every runway to
// ask to cross. Fire tenders and the ambulance on blue lights don't ask for the taxiways, and cross a runway as soon as
// it is clear. In the Academy exercises nobody asks.
const VX = new Map();   // 't:a|t:b' across a runway -> that runway
const edgeKind = (a, b) => { const e = VG[a] && VG[a].adj.find(x => x[0] === b); return e ? e[2] : null; };
function edgeTw(a, b){
  if (a[0] !== 't' || b[0] !== 't') return null;
  const e = GN[a.slice(2)].adj.find(([n]) => n === b.slice(2)); return e ? e[1].tw : null;
}
// the taxiway a node is on, by the way into the runway (for "holding short on Juliet")
function twAt(id){ const n = id.slice(2), e = GN[n] && GN[n].adj.find(([m, E]) => E.tw && E.tw !== 'APRON'); return e ? e[1].tw : null; }
let STAND_NODES = null;
const standNode = id => { if (!STAND_NODES) STAND_NODES = new Set(STANDS.map(s => s.node).filter(Boolean)); return id[0] === 't' && STAND_NODES.has(id.slice(2)); };
// a route's points, with the stops where it has to ask
function routePts(ids, v){
  const pts = laneOffset(ids);
  // taxiway stretches: one request at the start of each (over any crossings: those it asks for again)
  for (let i = 0; i < ids.length - 1; i++) {
    const k = edgeKind(ids[i], ids[i+1]); if (k !== 't') continue;
    const k0 = i ? edgeKind(ids[i-1], ids[i]) : null; if (k0 === 't' || k0 === 'x') continue;
    let j = i, L = 0; const tws = [];
    for (; j < ids.length - 1; j++) {
      const kj = edgeKind(ids[j], ids[j+1]); if (kj !== 't' && kj !== 'x') break; if (kj === 'x') continue;
      const tw = edgeTw(ids[j], ids[j+1]);
      if (tw && tw !== 'APRON' && !standNode(ids[j]) && !standNode(ids[j+1])) { L += dist(...VG[ids[j]].p, ...VG[ids[j+1]].p); if (!tws.includes(tw)) tws.push(tw); }
    }
    if (L > 150*VM) pts[i].stop = { k: 'twy', tws };
    i = j - 1;
  }
  // the crossings (last first: points are added): a stop at the holding position, well short of the runway, and the
  // runway clear again once over it
  const HOLD_OFF = (APT.rwyHalfWidth || 22.5) + 55;
  for (let i = ids.length - 2; i >= 0; i--) {
    if (edgeKind(ids[i], ids[i+1]) !== 'x') continue;
    const R = VX.get(ids[i] + '|' + ids[i+1]), off = p => Math.abs(R.offOf(p)), X = { k: 'rwy', R, tw: twAt(ids[i]) };
    (pts[i+1].cb ||= []).unshift(['xclear', R]);
    let k = i, sp, at;
    if (off(pts[k]) >= HOLD_OFF) { sp = pts[k].slice(); at = k + 1; }
    else {
      while (k > 0 && off(pts[k-1]) < HOLD_OFF) k--;
      if (!k) { sp = pts[0].slice(); at = 0; }
      else { const a = pts[k-1], b = pts[k], fa = off(a), t = (fa - HOLD_OFF)/(fa - off(b)); sp = [a[0] + (b[0] - a[0])*t, a[1] + (b[1] - a[1])*t]; at = k; }
    }
    sp.stop = X; pts.splice(at, 0, sp);
  }
  return pts;
}
// what a vehicle does on reaching a point of its route (p.cb: a list of [name, arg], so a saved stint keeps it): clear of
// the runway it crossed, Ops 1 at the runway's holding point, or off the runway after its inspection
const VEH_AT = {
  xclear: (w, R) => { if (w.onRwy === R.id) { w.onRwy = null; if (!w.xAuto) vcall(w, `runway ${rwN(R)} vacated`); w.xing = null; w.xAuto = false; } },
  rcHold: () => rcAtHold(),
  rcOff: (w, done) => rcOff(done)
};
// callsigns, given when a vehicle first calls ("Fuel 3")
const VCS = { bus: 'BUS', steps: 'STEPS', bags: 'BAGGAGE', belt: 'LOADER', cater: 'CATERING', fuel: 'FUEL', gpu: 'POWER', lav: 'SERVICE', water: 'WATER', tug: 'TUG', van: 'ENGINEER', fire: 'FIRE', amb: 'AMBULANCE', ops: 'OPS', follow: 'FOLLOW', crew: 'CREW' };
function vehCs(v){ if (v.cs) return v.cs; const p = VCS[v.type] || 'VEHICLE'; let n = 1; while (VEH.list.some(w => w.cs === p + n && !w.gone)) n++; return v.cs = p + n; }
// nothing on or about to use the runway: an arrival inside 3 NM, anything on it or lined up
function rwyClearFor(R){
  return !S.acs.some(o => (o.onRwy && (o.rwyId || RWYS[0].id) === R.id) || (o.kind === 'ARR' && o.airborne && o.ctl && rwyOf(landRw(o)) === R && finalDist(o) < 3) || ((o.state === 'LINEUP' || o.state === 'TAKEOFF') && rwyOf(depRw(o)) === R))
    && !VEH.list.some(w => w.onRwy === R.id && !w.gone);
}
function vehDest(v){
  const sw = APT.standWord || 'stand';
  if (S.rc && S.rc.v === v) return `holding point ${hpWords(S.rc.hp)}`;
  if (v.home) return { fire: 'the fire station', fuel: 'the fuel farm', cater: 'the catering base', maint: 'the hangars' }[BASE_OF[v.type]] || 'the terminal';
  if (v.training) return v.atGround ? 'the fire training ground' : 'the far side of the airfield';
  if (v.ac && v.ac.stand && v.type !== 'fire') return `${sw} ${v.ac.stand.id}`;
  if (v.ac) return spoken(v.ac.cs);
  if (v.job && v.job.k === 'trip') return 'the other side of the airfield';
  return 'the apron';
}
// a runway by the end in use (13L, not 13L/31R)
const rwN = R => rwyName(R.id).split('/')[0];
const twList = tws => tws.map(t => hpWords(t)).join(', ');
// at a stop: ask (or, on blue lights and in the exercises, go when it may)
function vehAsk(v, X){
  v.req = X; X.t = S.t; X.asked = S.t; vehCs(v);
  if (X.k === 'twy' && (v.urgent || !S.rtow || VEH.autoTwy)) { X.ok = true; v.req = null; return; }
  if (X.k === 'rwy' && (v.urgent || !S.rtow)) { X.auto = true; return; }   // across as soon as the runway is clear
  if (X.k === 'twy') vcall(v, `request to proceed via taxiway${X.tws.length > 1 ? 's' : ''} ${twList(X.tws)} to ${vehDest(v)}`);
  else vcall(v, `holding short of runway ${rwN(X.R)}${X.tw ? ' on ' + hpWords(X.tw) : ''}, request to cross`);
  if (typeof renderStrips === 'function') renderStrips(true);
}
function vehGo(v){
  const X = v.req; if (!X) return; X.ok = true; v.req = null;
  if (X.k === 'rwy') { v.onRwy = X.R.id; v.xing = S.t; v.xAuto = !!X.auto; }
}
// the controller approves a vehicle's request (or tells it to hold)
function vehApprove(v){
  const X = v.req; if (!X) return false;
  if (X.k === 'rwy') {
    const rw = rwN(X.R), busy = S.acs.find(o => onRunway(o, rw)), fin = S.acs.find(o => o.kind === 'ARR' && o.airborne && o.ctl && rwyOf(landRw(o)) === X.R && finalDist(o) < 3);
    if (busy) sys(`Careful: ${busy.cs} is on the runway.`, true);
    else if (fin) sys(`Careful: ${fin.cs} is on ${finalDist(fin).toFixed(1)} NM final: it will go around if ${radioName(v)} is still crossing.`, true);
    vatc(v, `cross runway ${rw}, report vacated`); vread(v, `crossing runway ${rw}, wilco`);
  } else { vatc(v, `proceed via ${X.tws.join(', ')}, give way to all aircraft`); vread(v, `via ${twList(X.tws)}, giving way to aircraft`); }
  vehGo(v); return true;
}
// blue-light crossings once the runway is clear, and a reminder when one has waited a while
function stepVehReqs(){
  for (const v of VEH.list) {
    const X = v.req; if (!X || v.gone) continue;
    if (X.auto) { if (rwyClearFor(X.R)) vehGo(v); continue; }
    if (S.t - X.asked > 240) { X.asked = S.t; vcall(v, X.k === 'rwy' ? `still holding short of runway ${rwN(X.R)}` : `still waiting to proceed via ${twList(X.tws)}`); }
  }
}
// taxiway requests approved for you (runway crossings still ask): VEHICLES AUTO / VEHICLES ASK, or the weather panel
function setVehAuto(on){
  VEH.autoTwy = on; try { localStorage.setItem('cw-veh-auto', on ? '1' : '0'); } catch (e) {}
  if (on) for (const v of VEH.list) if (v.req && v.req.k === 'twy') vehGo(v);
  sys(on ? 'Vehicles now drive the taxiways without asking (they still ask to cross a runway).' : 'Vehicles now ask before driving on a taxiway.');
}
const vehAsking = () => VEH.list.filter(v => v.req && !v.req.auto && !v.gone);

// ── the fleet
// len, wid (metres), body colour, cab colour, top speed on the road (kt)
const VTYPES = {
  bus:    { name: 'Apron bus',              len: 13.5, wid: 2.9, col: '#f4f6f9', cab: '#2d5fa8', kt: 16 },
  steps:  { name: 'Passenger steps',        len: 8,    wid: 2.4, col: '#c9ced6', cab: '#6b7380', kt: 12, stairs: true },
  bags:   { name: 'Baggage tractor',        len: 3,    wid: 1.6, col: '#3f7fc4', cab: '#25496e', kt: 14, carts: 3 },
  belt:   { name: 'Belt loader',            len: 7.5,  wid: 2,   col: '#e1a23a', cab: '#7a5a1e', kt: 10, belt: true },
  cater:  { name: 'Catering high-loader',   len: 9,    wid: 2.5, col: '#f2f2f2', cab: '#5d6875', kt: 14, box: true },
  fuel:   { name: 'Fuel bowser',            len: 10.5, wid: 2.5, col: '#e8ece9', cab: '#2f7a43', kt: 14, tank: true },
  gpu:    { name: 'Ground power unit',      len: 3.2,  wid: 1.7, col: '#e88c30', cab: '#8a4e14', kt: 8 },
  lav:    { name: 'Toilet service truck',   len: 6,    wid: 2.1, col: '#8495a8', cab: '#3d4855', kt: 12 },
  water:  { name: 'Water truck',            len: 6,    wid: 2.1, col: '#5aa0d8', cab: '#2a5578', kt: 12 },
  tug:    { name: 'Pushback tug',           len: 6,    wid: 2.6, col: '#f2c230', cab: '#444', kt: 12 },
  van:    { name: 'Engineers’ van',         len: 5.2,  wid: 2,   col: '#ffffff', cab: '#ff9d1c', kt: 16 },
  fire:   { name: 'Fire tender',            len: 11.5, wid: 3,   col: '#d8251d', cab: '#f2f2f2', kt: 20, blue: true },
  amb:    { name: 'Ambulance',              len: 6.5,  wid: 2.3, col: '#ffe600', cab: '#1f8f3a', kt: 18, blue: true },
  ops:    { name: 'Airside operations car', len: 4.6,  wid: 1.9, col: '#ffd21a', cab: '#1a1a1a', kt: 18, check: true },
  follow: { name: 'Follow-me car',          len: 4.6,  wid: 1.9, col: '#ffd21a', cab: '#1a1a1a', kt: 18, check: true },
  crew:   { name: 'Crew minibus',           len: 6,    wid: 2.1, col: '#e9edf2', cab: '#2d5fa8', kt: 16 }
};
const VEH = { list: [], n: 0, tick: 0, nextRoam: 0, nextFire: 0, bridges: [], bridgeBy: new Map(), cap: 0 };
try { VEH.autoTwy = localStorage.getItem('cw-veh-auto') === '1'; } catch (e) {}
const vehUnder = () => VEH.list.length < VEH.cap;
// where each kind of vehicle is based: graph nodes near the real places (fire station, fuel farm, hangars, catering,
// the terminal's apron face). Where the map has none, the handling base by the terminal stands in.
const VBASE = {};
function baseNodes(pts){ return [...new Set(pts.map(q => vgNear(VP(q), 400, N => N.road) || vgNear(VP(q), 400)).filter(Boolean))]; }
function vehBases(){
  const terms = baseNodes(VD.terms);
  // no terminal faces in the map: the road nodes nearest the middle of the contact stands
  if (!terms.length && STANDS.length) {
    const c = STANDS.filter(s => s.area === 'civil'), A = c.length ? c : STANDS;
    // one base per terminal where an airport has two (Belfast: Aldergrove and City), not one between them
    for (const t of [...new Set(A.map(s => s.term || ''))]) {
      const L = A.filter(s => (s.term || '') === t), m = L.reduce((a, s) => [a[0] + s.p[0]/L.length, a[1] + s.p[1]/L.length], [0, 0]);
      const n = vgNear(m, 800, N => N.road) || vgNear(m, 800); if (n && !terms.includes(n)) terms.push(n);
    }
  }
  VBASE.hand = terms;
  VBASE.fire = baseNodes(VD.fire); VBASE.fuel = baseNodes(VD.fuel); VBASE.cater = baseNodes(VD.catering); VBASE.maint = baseNodes(VD.hangars);
  for (const k of ['fire', 'fuel', 'cater', 'maint']) if (!VBASE[k].length) VBASE[k] = terms;
}
const BASE_OF = { bus: 'hand', steps: 'hand', bags: 'hand', belt: 'hand', gpu: 'hand', lav: 'hand', water: 'hand', tug: 'hand', crew: 'hand', cater: 'cater', fuel: 'fuel', van: 'maint', fire: 'fire', amb: 'fire', ops: 'fire', follow: 'fire' };
// the base of that kind nearest a point (by road)
function baseFor(type, p){
  const L = VBASE[BASE_OF[type]] || VBASE.hand; if (!L || !L.length) return null;
  return L.length === 1 ? L[0] : L.slice().sort((a, b) => dist(...VG[a].p, ...p) - dist(...VG[b].p, ...p))[0];
}

// ── doors: where an aircraft's doors and holds are, by its type's length and kind (f: metres forward of the middle, aft
// negative). The passengers' doors are on the left, where the steps and the jet bridge come; the service doors and the
// baggage holds are on the right. A widebody has three passenger doors a side, a narrowbody two, a turboprop one (rear
// left: its front door is the cargo door) and a small business jet its own airstair.
const fusW = P => Math.max(2.2, Math.min(6.2, P.len*0.1));
// the A380: its two decks give it a third passenger bridge, to the upper-deck door (U1) between the main-deck pair
const super_ = P => P.span >= 75 && P.len >= 70;
const DOORS = new Map();
function doorsOf(P){
  const key = P.len + '|' + P.wake + '|' + P.shape; let D = DOORS.get(key); if (D) return D;
  const L = P.len, wide = P.wake === 'H' || L > 50, prop = P.shape === 'prop', tiny = P.wake === 'L' || L < 20, long = L >= 42;
  if (tiny) D = { pax: [{ id: 'L1', f: L*0.2 }], svc: [{ id: 'R1', f: L*0.2 }], hold: [{ f: -L*0.3 }] };
  else if (prop) D = { pax: [{ id: 'L2', f: -L*0.34 }], svc: [{ id: 'R1', f: L*0.34 }], hold: [{ f: L*0.3 }] };
  else if (super_(P)) D = { pax: [{ id: 'L1', f: L*0.385 }, { id: 'U1', f: L*0.30, up: true }, { id: 'L2', f: L*0.22 }, { id: 'L4', f: -L*0.28 }], svc: [{ id: 'R1', f: L*0.385 }, { id: 'R4', f: -L*0.28 }], hold: [{ f: L*0.17 }, { f: -L*0.22 }] };
  else if (wide) D = { pax: [{ id: 'L1', f: L*0.38 }, { id: 'L2', f: L*0.25 }, { id: 'L4', f: -L*0.27 }], svc: [{ id: 'R1', f: L*0.38 }, { id: 'R4', f: -L*0.27 }], hold: [{ f: L*0.17 }, { f: -L*0.22 }] };
  else D = { pax: [{ id: 'L1', f: L*0.35 }, { id: long ? 'L4' : 'L2', f: -L*(long ? 0.36 : 0.27) }], svc: [{ id: 'R1', f: L*0.35 }, { id: long ? 'R4' : 'R2', f: -L*(long ? 0.36 : 0.27) }], hold: [{ f: L*0.2 }, { f: -L*0.25 }] };
  DOORS.set(key, D); return D;
}
const doorFirst = P => doorsOf(P).pax[0], doorLast = P => { const L = doorsOf(P).pax; return L[L.length - 1]; };
const SLOTS = {
  stepsF: P => ({ f: doorFirst(P).f, s: -(fusW(P)/2 + 3.6), h: 90 }),
  stepsR: P => ({ f: doorLast(P).f, s: -(fusW(P)/2 + 3.6), h: 90 }),
  // the apron bus pulls up alongside, at the foot of the steps, facing the way the aircraft does
  bus:    P => ({ f: doorFirst(P).f - 2.5, s: -(fusW(P)/2 + 14.5), h: 0 }),
  bus2:   P => ({ f: doorLast(P).f - 2.5, s: -(fusW(P)/2 + 14.5), h: 0 }),
  beltF:  P => ({ f: doorsOf(P).hold[0].f, s: fusW(P)/2 + 3.2, h: -90 }),
  beltR:  P => ({ f: doorsOf(P).hold.slice(-1)[0].f, s: fusW(P)/2 + 3.2, h: -90 }),
  bags:   P => ({ f: doorsOf(P).hold[0].f, s: fusW(P)/2 + 12, h: 180 }),
  bagsR:  P => ({ f: doorsOf(P).hold.slice(-1)[0].f, s: fusW(P)/2 + 12, h: 0 }),
  cater:  P => ({ f: doorsOf(P).svc[0].f, s: fusW(P)/2 + 4.4, h: -90 }),
  caterR: P => ({ f: doorsOf(P).svc.slice(-1)[0].f, s: fusW(P)/2 + 4.4, h: -90 }),
  fuel:   P => ({ f: P.len*0.02 - 3, s: Math.max(fusW(P)/2 + 6, P.span*0.27), h: 0 }),
  gpu:    P => ({ f: P.len*0.42, s: fusW(P)/2 + 2.5, h: 0 }),
  lav:    P => ({ f: -P.len*0.44, s: fusW(P)/2 + 3.4, h: -90 }),
  water:  P => ({ f: -P.len*0.47, s: -(fusW(P)/2 + 3.4), h: 90 }),
  van:    P => ({ f: P.len*0.1, s: -(P.span*0.3 + 4), h: 180 }),
  amb:    P => ({ f: P.len*0.42, s: -(fusW(P)/2 + 9), h: 0 }),
  tug:    P => ({ f: P.len/2 + 6.5, s: 0, h: 180 }),
  fireA:  P => ({ f: P.len*0.5 + 10, s: -P.span*0.3, h: 150 }),
  fireB:  P => ({ f: P.len*0.5 + 10, s: P.span*0.3, h: -150 }),
  fireC:  P => ({ f: -P.len*0.2, s: -(P.span/2 + 9), h: 70 }),
  fireD:  P => ({ f: -P.len*0.2, s: P.span/2 + 9, h: -70 })
};
function slotFrom(M, h, P, slot){
  const o = SLOTS[slot](P);
  return { p: [M[0] + (Math.sin(h*D2R)*o.f + Math.cos(h*D2R)*o.s)*VM, M[1] + (Math.cos(h*D2R)*o.f - Math.sin(h*D2R)*o.s)*VM], h: norm(h + o.h) };
}
// on the stand it is the way the aircraft actually sits (a drive-through stand's arrival can be parked the other way round)
function slotAt(ac, slot){
  const on = ac.stand && (ac.state === 'PARKED' || ac.state === 'ONSTAND');
  return slotFrom(on ? ac.stand.p : acMid(ac), on ? ac.hdg : bodyHdg(ac), ac.perf, slot);
}
// a point in the aircraft's own frame (f forward, s to the right, metres) and back
const mPt = (M, h, f, s) => [M[0] + (Math.sin(h*D2R)*f + Math.cos(h*D2R)*s)*VM, M[1] + (Math.cos(h*D2R)*f - Math.sin(h*D2R)*s)*VM];
const toFS = (M, h, p) => { const dx = (p[0] - M[0])/VM, dy = (p[1] - M[1])/VM; return [dx*Math.sin(h*D2R) + dy*Math.cos(h*D2R), dx*Math.cos(h*D2R) - dy*Math.sin(h*D2R)]; };
// ── a vehicle: drives a list of points; parks; goes home (and is gone, into its base)
function newVeh(type, at, hdg, o = {}){
  const T = VTYPES[type], v = { id: ++VEH.n, type, T, x: at[0], y: at[1], hdg: hdg || 0, v: 0, pts: [], spd: T.kt, job: null, trail: [], ...o };
  VEH.list.push(v); return v;
}
// drive from where it is to point p (arriving facing h): along the roads to the node nearest p, then in on the apron
function driveTo(v, p, h, urgent){
  const a = vgNear([v.x, v.y], 400), b = vgNear(p, 350, N => N.road) || vgNear(p, 600);
  let pts = [];
  v.req = null; if (v.onRwy && !(S.rc && S.rc.v === v)) v.onRwy = null;
  if (a && b) { const r = vroute(a, b, urgent); if (r) pts = routePts(r, v); if (pts.length && dist(v.x, v.y, ...pts[0]) < 4*VM && !pts[0].stop) pts.shift(); }
  // the last bit, across the apron: lined up a few lengths out so it noses in square to its slot
  if (h != null) { const back = v.T.len*1.6 + 8; pts.push([p[0] - Math.sin(h*D2R)*back*VM, p[1] - Math.cos(h*D2R)*back*VM]); }
  pts.push([p[0], p[1]]);
  v.pts = pts; v.endH = h; v.urgent = !!urgent; v.parked = false;
}
function sendHome(v, wait = 0){
  const n = baseFor(v.type, [v.x, v.y]); if (!n) { v.gone = true; return; }
  v.job = null; v.home = true; v.leaveAt = S.t + wait; v.pts = []; v.endH = null; v.req = null;
  v.go = ['home', n];
}
// what a vehicle does when it sets off (v.go: [name, arg], so a saved stint keeps it): home to its base node, or on
// to the next aircraft's nose for a push
const VEH_GO = {
  home: (v, n) => { const a = vgNear([v.x, v.y], 400), r = a && vroute(a, n); v.pts = r ? routePts(r, v) : [VG[n].p.slice()]; v.parked = false; },
  tug: (v, ac) => { const s = slotAt(ac, 'tug'); driveTo(v, s.p, s.h); },
  toTerm: v => { const t = termBay(); driveTo(v, t.p, t.h); v.parked = false; v.visitUntil = S.t + rnd(160, 260); }
};
// a vehicle out of its base at node n, heading off for point p
function dispatch(type, p, h, job, urgent){
  const n = baseFor(type, p); if (!n) return null;
  const r = vgNear(p, 350, N => N.road) || vgNear(p, 600), route0 = r && vroute(n, r, urgent);
  const start = VG[n].p, nx = route0 && route0.length > 1 ? VG[route0[1]].p : p;
  const v = newVeh(type, start, brg(...start, ...nx), { job }); driveTo(v, p, h, urgent);
  return v;
}
// already there when the session opens (a busy apron doesn't start empty)
function placeAt(type, slot, job){
  const v = newVeh(type, slot.p, slot.h, { job }); v.parked = true; v.pts = []; return v;
}

// ── turnarounds: what comes to an aircraft on stand, and when
// on an arrival (A = on-blocks): steps or the bridge, buses at a remote stand, bags off; before a departure
// (R = when the crew calls for start): catering, fuel, toilets and water, bags on, boarding, the tug
const isJet = ac => ac.perf.shape !== 'prop';
const small = ac => ac.perf.wake === 'L' || ac.perf.len < 20;
const heavy = ac => ac.perf.wake === 'H' || ac.perf.len > 50;
// a stand served by an apron bus: off the terminal (a remote stand, or anything over ~180 m from the terminal face)
function bussed(ac, br){
  const st = ac.stand; if (!st || small(ac) || st.area === 'hangar') return false;
  if (br) return false;   // a bridge reaches its door
  if (APT.shuttle && APT.shuttle(st)) return true;   // a satellite stand with no jet bridge: the bus comes to the aircraft
  if ((APT.remoteAreas || []).includes(st.area) || st.area === 'remote' || st.area === 'south' || st.term === 'R') return true;
  const t = VD.terms.length ? Math.min(...VD.terms.map(q => dist(...VP(q), ...st.p))) : 0;
  return t > 180*VM;
}
// ── satellite shuttles (profile hook APT.shuttle(stand), Geneva): the satellite stands have jet bridges, so the passengers' bus
// does not go to the aircraft. It meets them at the satellite building beside the bridge and runs between there and the
// terminal: for an arrival it is waiting when the doors open and drives to the terminal once loaded; for a departure it
// comes from the terminal with the passengers ahead of boarding and is gone before the doors close.
const shuttleStand = (st, br) => !!(st && APT.shuttle && APT.shuttle(st) && br);
const SAT_BAYS = new Map();
function satBay(st, k){
  const key = st.id + ':' + k; if (SAT_BAYS.has(key)) return SAT_BAYS.get(key);
  const B = bridgeOf(st), L = dist(...B.root, ...B.rest) || 1, u = [(B.rest[0] - B.root[0])/L, (B.rest[1] - B.root[1])/L], h = brg(...B.root, ...B.rest);
  const along = Math.min(L/VM*0.5, 14)*VM, side = (k ? -1 : 1)*6.5*VM, c = [B.root[0] + u[0]*along, B.root[1] + u[1]*along];
  const r = { p: [c[0] + u[1]*side, c[1] - u[0]*side], h }; SAT_BAYS.set(key, r); return r;
}
let TERM_BAY;
// where the shuttles load and unload at the main terminal: the terminal face nearest the stands that are not satellites
function termBay(){
  if (TERM_BAY !== undefined) return TERM_BAY;
  const near = STANDS.filter(s => s.term === (APT.shuttleTerm || s.term) && !(APT.shuttle && APT.shuttle(s)) && s.area !== 'hangar');
  if (!VD.terms.length || !near.length) return TERM_BAY = null;
  const c = [near.reduce((a, s) => a + s.p[0], 0)/near.length, near.reduce((a, s) => a + s.p[1], 0)/near.length];
  // not the satellites' own faces (a shuttle stand within 100 m): the main terminal's face nearest the terminal stands
  const sat = STANDS.filter(s => APT.shuttle && APT.shuttle(s)), faces = VD.terms.map(VP).filter(q => !sat.some(s => dist(...q, ...s.p) < 100*VM));
  const f = (faces.length ? faces : VD.terms.map(VP)).sort((a, b) => dist(...a, ...c) - dist(...b, ...c))[0], d = dist(...f, ...c) || 1;
  return TERM_BAY = { p: [f[0] + (c[0] - f[0])/d*14*VM, f[1] + (c[1] - f[1])/d*14*VM], h: brg(...f, ...c) };
}
function dispatchTerm(type, p, h, job){
  const t = termBay(); if (!t) return dispatch(type, p, h, job);
  const v = newVeh(type, t.p, t.h, { job }); driveTo(v, p, h); return v;
}
// an arrival's bus, loaded: off to the terminal, a short wait, then home
function shuttleOut(v){ v.job = { k: 'shuttle' }; v.ac = null; v.leaveAt = S.t + rnd(3, 12); v.go = ['toTerm', null]; v.endH = null; v.parked = false; v.pts = []; v.req = null; }
// ── passengers: how many, and how fast they get off and on, so the order of a turnaround follows from the aircraft.
// An arrival: on blocks, the chocks go in, the steps (or the bridge) come to the door, the door opens and the passengers
// come off (to the buses at a remote stand); the holds are opened and the bags come off. A departure: catering, toilets and
// water, fuel, bags on; the access comes back to the door and boarding starts; the last passenger, the holds and then the
// doors close; the bridge swings away, the steps and the belt go; the tug connects, the ground power comes off, push back.
const TA_V = 2;
function taPax(ac){
  const P = ac.perf, seats = Math.round(P.len*(isBiz(ac) ? 0.4 : P.shape === 'prop' ? 2.6 : heavy(ac) ? 4.4 : P.len >= 44 ? 4.2 : 4));
  return { seats, N: Math.max(2, Math.round(seats*rnd(0.72, 0.94))) };
}
const BUS_PAX = 70;   // an apron bus takes about 70 standing passengers
// the apron bus trips for N passengers: each bus is a job, a wave of them one to a door; frac is the share of the passengers that are on or off when the wave leaves
function busWaves(N, doors){
  const trips = Math.max(1, Math.ceil(N/BUS_PAX)), W = [];
  for (let i = 0; i < trips; i++) W.push({ w: Math.floor(i/doors), door: i % doors, f: Math.min(1, (Math.floor(i/doors) + 1)*doors*BUS_PAX/N) });
  return W;
}
// the turnaround's plan: the jobs (which vehicle comes to which place, and when), the bridges that serve it, when they are docked and when boarding is
function taPlan(ac, T, arr, hdg){
  const J = [], P = ac.perf, R = ac.reqAt, depart = ac.kind === 'DEP' && R != null && R < Infinity;
  const add = (k, type, at, until, extra) => J.push({ k, type, at, until, ...extra });
  const L = small(ac), H = heavy(ac), prop = P.shape === 'prop', biz = isBiz(ac), now = S.t;
  T.br = L ? [] : bridgePlan(ac, hdg); T.dock = []; T.brd = null;
  const br = T.br.length, ST = !!(APT.shuttle && ac.stand && APT.shuttle(ac.stand)), shuttle = !L && shuttleStand(ac.stand, br), bus = bussed(ac, br);
  if (L) {   // light aircraft and small business jets: their own airstair, the fuel bowser now and then, nothing else
    if (depart && Math.random() < 0.6) add('fuel', 'fuel', R - 25*60, R - 12*60);
    T.rate = 6; T.brate = 3; T.jobs = J; return J;
  }
  // the access to the doors: the bridge where it reaches (a widebody uses its second door too), steps at the others
  const steps = prop ? ['stepsR'] : biz ? (br ? [] : ['stepsF']) : H ? (br >= (super_(P) ? 3 : 2) ? [] : br ? ['stepsR'] : ['stepsF', 'stepsR']) : (br ? [] : ['stepsF', 'stepsR']);
  const doors = Math.max(1, br + steps.length);
  T.rate = Math.max(8, br*14 + steps.length*12);   // passengers a minute off; boarding is the slower trickle the gate lets through
  T.brate = biz ? 3 : prop ? 4 : super_(P) ? 13 : H ? 8.5 : 5;
  const busDoors = prop || biz ? 1 : Math.min(2, Math.max(1, steps.length)), shuttleWaves = shuttle || bus;
  const waves = busWaves(T.N, busDoors), slotOf = d => d === 0 ? 'bus' : 'bus2';
  const busExtra = (w, arrBus) => shuttle ? { bay: w.door, arr: arrBus } : { term: ST, arr: arrBus };
  if (arr) {
    const ch = T.chocks, wdur = BUS_PAX/(T.rate/doors)*60;   // one wave of buses off, in seconds
    // everything waits clear of the aircraft until the chocks are in
    steps.forEach((k, i) => add(k, 'steps', ch + 4 + i*rnd(14, 30), Infinity, { stage: true, rel: { f: 1, g: rnd(70, 130) } }));
    if (!br && isJet(ac)) add('gpu', 'gpu', ch + rnd(8, 14), depart ? R - 3*60 : T.A + rnd(16, 26)*60, { stage: true });
    if (shuttleWaves) for (const w of waves) add(slotOf(w.door), 'bus', w.w ? ch + w.w*wdur - 110 : ch + 6, Infinity, { ...busExtra(w, true), stage: !w.w && !shuttle && !ST, rel: { f: w.f, g: rnd(10, 30) }, wave: w.w });
    if (!biz) {
      const unl = ch + (H ? rnd(16, 22) : rnd(11, 16))*60;
      add('beltF', 'belt', ch + rnd(25, 45), unl); add('bags', 'bags', ch + rnd(60, 100), unl + rnd(30, 70), { carts: H ? 4 : 3 });
      if (H) add('beltR', 'belt', ch + rnd(35, 60), unl + 60);
    }
    if (br) T.dock.push([ch + 25, Infinity]);   // out to the door once the chocks are in (home again a little after the last passenger is off)
  }
  // an aircraft that will be towed off this stand before it leaves (a remote stand, a hangar) is served at the stand it is towed to
  const towing = !!(ac.tow && ac.tow.at != null && ac.tow.at < Infinity);
  if (depart && !towing) {
    // the boarding, from the back: the last passenger on a few minutes before the doors close, the doors closed a few before off-blocks
    const be = R - (H ? rnd(13, 16) : prop ? rnd(7, 9) : biz ? rnd(4, 6) : rnd(9, 11))*60, nW = waves[waves.length - 1].w + 1, wl = BUS_PAX/12*60;   // a bus load takes about six minutes to go up the steps
    const dur = shuttleWaves ? Math.min(clamp(T.N/T.brate*60, 4*60, 45*60), nW*wl + 150) : clamp(T.N/T.brate*60, 4*60, 45*60), bs = be - dur;
    const dc = Math.max(be + 60, R - (H ? rnd(7, 9) : prop ? rnd(3.5, 5) : biz ? rnd(2.5, 3.5) : rnd(4.8, 6.5))*60), hc = dc - rnd(40, 100);   // doors closed; holds closed
    const devOn = bs - 150, devOff = dc + rnd(40, 80);   // the access is at the door before boarding opens and goes once the door is shut
    T.brd = { t0: bs, t1: be, dc };
    const s = Math.max(now + 20, Math.min(R - 45*60, now + 60)), due = (m1, m2) => Math.max(s, R - rnd(m1, m2)*60);
    if (br) T.dock.push([devOn, devOff]);
    steps.forEach((k, i) => add(k, 'steps', devOn - 90 + i*20, devOff + i*rnd(10, 30)));
    // catering through the right-hand service doors, toilets and water, fuel, then the bags; all of it done before the doors close
    if (!biz && P.len >= 30) { add('cater', 'cater', due(H ? 58 : 42, H ? 66 : 50), R - rnd(H ? 30 : 24, H ? 36 : 30)*60); if (H) add('caterR', 'cater', due(56, 64), R - rnd(28, 34)*60); }
    add('fuel', 'fuel', due(H ? 56 : 38, H ? 62 : 44), R - rnd(H ? 20 : 14, H ? 26 : 20)*60);
    if (H || Math.random() < 0.35) add('lav', 'lav', due(46, 52), R - rnd(36, 40)*60);
    if (H) add('water', 'water', due(44, 50), R - rnd(34, 38)*60);
    if (!biz) {
      add('beltF', 'belt', due(H ? 46 : 32, H ? 52 : 36), hc + rnd(15, 40)); add('bagsR', 'bags', due(H ? 44 : 30, H ? 50 : 34), hc - rnd(5, 25), { carts: H ? 4 : 3 });
      if (H) add('beltR', 'belt', due(44, 50), hc + rnd(20, 50));
    }
    // a bus per door at a time; each waits at the steps while its passengers go up
    if (shuttleWaves) for (const w of waves) { const due = bs + 60 + w.w*wl, at = Math.max(s, due - 130); add(slotOf(w.door), 'bus', at, Math.max(at + 60, due + wl + 30), busExtra(w, false)); }
    if (!br && isJet(ac) && !J.some(j => j.k === 'gpu')) add('gpu', 'gpu', due(48, 58), R - rnd(2.2, 3.2)*60);
    if (Math.random() < 0.12) add('van', 'van', due(50, 70), R - rnd(25, 40)*60);
    if (!(ac.stand && ac.stand.out)) add('tug', 'tug', R - rnd(6, 9)*60, Infinity);   // a drive-through stand has no push back, so no tug
  }
  T.jobs = J; return J;
}
// the aircraft's turnaround: the chocks, the passengers' progress, the jobs
function newTA(ac, arr, hdg){
  const T = { v: TA_V, st: ac.stand, kind: ac.kind, req: ac.reqAt, first: S.t < 5, arr, A: arr ? (ac.inAt != null ? ac.inAt : S.t) : null, ...taPax(ac) };
  T.chocks = arr ? T.A + rnd(10, 20) : -1;
  taPlan(ac, T, arr, hdg); return T;
}
// is this aircraft parked where its turnaround happens (on a stand, not in a hangar, not being moved)?
const onStandNow = ac => ac.ground && ac.stand && ac.stand.area !== 'hangar' && (ac.state === 'PARKED' || ac.state === 'ONSTAND') && !ac.handed;
// where a vehicle that is to come to a slot waits until the chocks are in: out on the same line, well clear of the wing and the nose gear's way in
function stagePt(ac, slot, h){
  const P = ac.perf, M = ac.stand.p, o = SLOTS[slot](P), g = o.s < 0 ? -1 : 1, out = Math.abs(o.s) + (slot === 'gpu' ? 11 : 14);
  return { p: mPt(M, h, o.f, g*out), h: norm(h + o.h) };
}
// arrivals still taxiing in: the access, the first bus and the power wait at the stand already (the handlers do), clear of the aircraft
function stepPrestage(){
  for (const ac of S.acs) {
    if (ac.pre || ac.kind !== 'ARR' || !ac.ground || !ac.taxiIn || !ac.stand || ac.stand.out || ac.stand.area === 'hangar' || small(ac)) continue;
    if (ac.state === 'PARKED' || ac.state === 'ONSTAND' || dist(ac.x, ac.y, ...ac.stand.p)/VM > 900) continue;
    const T = { v: TA_V, st: ac.stand, kind: ac.kind, arr: true, A: S.t + 60, chocks: S.t + 75, ...taPax(ac) }, h = ac.stand.hdg;
    ac.pre = {};
    for (const j of taPlan(ac, T, true, h)) {
      if (!j.stage || !vehUnder() || j.bay != null) continue;
      const g = stagePt(ac, j.k, h), v = dispatch(j.type, g.p, g.h, null); if (!v) continue;
      v.staged = j.k; v.ac = ac; v.visitUntil = S.t + 600; ac.pre[j.k] = v;
    }
  }
}
// the chocks are in: a staged vehicle moves in to its place
function stageGo(v, slot){ v.staged = null; v.visitUntil = null; v.parked = false; v.pts = [slot.p.slice()]; v.endH = slot.h; v.req = null; v.v = 0; }
function preEnd(ac){ if (!ac.pre) return; for (const k of Object.keys(ac.pre)) { const v = ac.pre[k]; if (v && !v.gone && v.staged && !v.home) { v.staged = null; v.ac = null; sendHome(v, rnd(2, 8)); } } ac.pre = null; }
// the passengers' progress now, for the aircraft's panel and the vehicles' pop-ups
function paxState(ac){
  const T = ac.ta; if (!T || !T.N) return null;
  if (ac.kind === 'ARR' || !T.brd || S.t < T.brd.t0) {
    if (!T.dep || S.t < T.dep.t0) return null;
    const f = clamp((S.t - T.dep.t0)/Math.max(1, T.dep.t1 - T.dep.t0), 0, 1);
    return { k: f < 1 ? 'Deplaning' : 'Deplaned', n: Math.round(T.N*f), N: T.N, f };
  }
  const f = clamp((S.t - T.brd.t0)/Math.max(1, T.brd.t1 - T.brd.t0), 0, 1);
  return { k: S.t >= T.brd.dc ? 'Doors closed' : f < 1 ? 'Boarding' : 'Boarding complete', n: Math.round(T.N*f), N: T.N, f };
}
// the access devices at the doors now: the bridges docked, the steps in place
const accessNow = ac => ({ br: (ac.ta.br || []).filter(k => VEH.bridges[k.bi] && VEH.bridges[k.bi].dk), steps: ac.ta.jobs.filter(j => j.type === 'steps' && j.v && j.v.parked && !j.v.home && !j.v.staged && !j.done) });
function taTick(ac, T){
  const dep = ac.kind === 'DEP' && ac.reqAt != null && ac.reqAt < Infinity;
  // chocks and cones: on when it stops, off just before the tug takes it
  T.kit = S.t >= T.chocks && !(dep && S.t >= ac.reqAt - 150);
  // the first door opens once the access is there and the chocks are in: then the passengers come off
  if (T.arr && !T.dep && S.t >= T.chocks) {
    const a = accessNow(ac), ready = small(ac) ? S.t >= T.chocks + 20 : a.br.length + a.steps.length > 0;
    if (ready) { const t0 = S.t + rnd(12, 25); T.dep = { t0, t1: t0 + Math.max(60, T.N/Math.max(4, T.rate)*60) }; }
  }
  // a bridge goes back to its stowed place a little after the last passenger is off (unless the aircraft is boarding soon: its window already runs on)
  if (T.dep && T.dock && T.dock[0] && T.dock[0][1] === Infinity && !dep) T.dock[0][1] = T.dep.t1 + 120;
}
function stepTurnarounds(){
  for (const ac of S.acs) {
    const here = onStandNow(ac);
    if (!here) { if (ac.ta) taEnd(ac); continue; }
    if (!ac.ta || ac.ta.st !== ac.stand || ac.ta.v !== TA_V) {
      if (ac.ta) taEnd(ac);
      const arr = ac.inAt != null && S.t - ac.inAt < 120;
      ac.ta = newTA(ac, arr);
    } else if (ac.ta.kind !== ac.kind || ac.ta.req !== ac.reqAt) {   // turned round (ARR to DEP), or a new off-blocks time
      const T = ac.ta; T.kind = ac.kind; const keep = T.jobs.filter(j => j.v && !j.done && j.until === Infinity);
      const old = T.jobs, dock = T.dock;
      const fresh = taPlan(ac, T, false).filter(j => !keep.some(k => k.k === j.k));
      for (const j of old) if (j.v && !j.done && !keep.includes(j)) { if (fresh.some(f => f.k === j.k) && j.type !== 'tug') { const f = fresh.find(f => f.k === j.k); f.v = j.v; j.v.job = f; f.started = true; } else release(j); }
      T.jobs = [...keep, ...fresh];
      // a bridge docked now and wanted again soon keeps its place: the old window runs into the new one
      if (dock && dock[0] && T.dock.length && dock[0][1] > S.t && dock[0][1] !== Infinity && dock[0][1] + 300 > T.dock[0][0]) T.dock[0][0] = Math.min(T.dock[0][0], dock[0][0]);
    }
    const T = ac.ta; T.req = ac.reqAt;
    taTick(ac, T);
    for (const j of T.jobs) {
      if (j.done) continue;
      if (!j.started && (j.at < 0 || S.t >= j.at) && S.t < j.until - 60) {
        j.started = true; const slot = j.bay != null ? satBay(ac.stand, j.bay) : slotAt(ac, j.k), pre = j.stage && ac.pre && ac.pre[j.k];
        const same = T.jobs.find(o => o !== j && o.k === j.k && o.started && !o.done && o.v && !o.v.home);
        if (same) { j.v = same.v; same.v.job = j; same.v = null; same.done = true; }   // the arrival's steps stay on for the boarding
        else if (pre && !pre.gone && !pre.home) { j.v = pre; pre.job = j; delete ac.pre[j.k]; stageGo(pre, slot); }   // it was waiting here
        // a vehicle that should already be there when the session opens: in place
        else if (j.at < 0 || T.first) { if (VEH.list.length < VEH.cap*1.3) { j.v = placeAt(j.type, slot, j); j.v.ac = ac; } }
        else if (vehUnder() || j.type === 'tug' || j.type === 'amb') { j.v = (j.bay != null || j.term) ? dispatchTerm(j.type, slot.p, slot.h, j) : dispatch(j.type, slot.p, slot.h, j); if (j.v) j.v.ac = ac; }
        if (j.v && j.carts) j.v.carts = j.carts;
      }
      // away when the last passenger of its share is off, or at its time
      if (j.started && j.rel && T.dep && S.t >= T.dep.t0 + (T.dep.t1 - T.dep.t0)*j.rel.f + j.rel.g) release(j);
      else if (j.started && S.t >= j.until) release(j);
    }
    T.first = false;
  }
  for (const ac of S.acs) if (ac.pre && (!ac.ground || ac.state === 'PARKED' || ac.state === 'ONSTAND') && !ac.ta) preEnd(ac);
}
// a bus with its passengers goes on to the terminal; everything else goes home
function release(j){ j.done = true; if (j.v && !j.v.attached) { if (j.arr && j.type === 'bus' && !j.v.home && termBay()) shuttleOut(j.v); else sendHome(j.v, rnd(2, 10)); } j.v = null; }
function taEnd(ac){
  // pushed or towed away (the tug stays on it), or gone: everyone else drives off
  for (const j of ac.ta.jobs) if (j.v && !j.done) { if (j.v.attached) { j.done = true; continue; } release(j); }
  ac.ta = null; preEnd(ac);
}

// ── the tug: at the nose when it pushes or tows (it comes to the stand a few minutes before, and leaves after)
const TUG_STATES = new Set(['PUSH', 'PULL', 'TOW']);
function tugPose(ac){
  const P = ac.perf, M = acMid(ac), h = bodyHdg(ac), towing = ac.state === 'TOW' && !(ac.path && ac.path.reverse) && !ac.towAlign;
  const f = P.len/2 + 2.2 + VTYPES.tug.len/2;
  return { p: [M[0] + Math.sin(h*D2R)*f*VM, M[1] + Math.cos(h*D2R)*f*VM], h: towing ? h : norm(h + 180) };
}
function stepTugs(){
  for (const ac of S.acs) {
    const need = ac.ground && TUG_STATES.has(ac.state) && !(inHangar(ac));
    let v = ac.tugV;
    if (need) {
      if (!v || v.gone) {
        // the tug already waiting at its nose takes it; otherwise one is there (it came while you weren't looking)
        const w = VEH.list.find(x => x.type === 'tug' && x.ac === ac && !x.home && !x.gone);
        const pose = tugPose(ac); v = w || newVeh('tug', pose.p, pose.h); v.ac = ac; ac.tugV = v;
        if (v.job) { v.job.done = true; v.job = null; }
      }
      const pose = tugPose(ac); v.attached = true; v.x = pose.p[0]; v.y = pose.p[1]; v.hdg = pose.h; v.v = ac.gs || 0; v.pts = []; v.parked = false;
    } else if (v) {
      ac.tugV = null; v.attached = false; v.ac = null;
      // the towbar off and the headset in: it backs away and drives off
      if (!v.gone) { v.hdg = norm(v.hdg + 180); if (!nextTow(v)) sendHome(v, rnd(15, 30)); }
    }
  }
}
// a tug just off a push or a tow: on to the nearest aircraft that will want one soon (its tug not yet there), or home
function nextTow(v){
  let best = null, bd = 2;   // NM
  for (const ac of S.acs) {
    if (!ac.ta || !onStandNow(ac)) continue;
    const j = ac.ta.jobs.find(j => j.type === 'tug' && !j.done); if (!j || (j.v && !j.v.home && (j.v.parked || dist(j.v.x, j.v.y, ...ac.stand.p) < dist(v.x, v.y, ...ac.stand.p)))) continue;
    if (!j.started && j.at - S.t > 15*60) continue;
    const d = dist(v.x, v.y, ...ac.stand.p); if (d < bd) { bd = d; best = [ac, j]; }
  }
  if (!best) return false;
  const [ac, j] = best;
  if (j.v && j.v !== v) { j.v.ac = null; j.v.job = null; sendHome(j.v, 0); }   // the one on its way from base turns back
  j.started = true; j.v = v; Object.assign(v, { job: j, ac, home: false, leaveAt: S.t + rnd(15, 30), pts: [], endH: null });
  v.go = ['tug', ac];
  return true;
}

// ── jet bridges (aeroway=jet_bridge on the map): the rotunda is fixed to the terminal; the tunnel telescopes out and the cab
// swings square to the fuselage at a door of the aircraft that is actually on the stand: that type's own door, on the side
// the bridge comes from (a widebody takes a second bridge at its second door). It docks only where the tunnel can reach
// that door, between the length it telescopes to, without passing through the nose, the wing or the fuselage; at a stand
// where it can't (a type too long or too short for it) the aircraft is served by steps and buses like any other.
// Out from the terminal to a stand-off point beside the door first, then in square to the door at a creep.
const bridgesAt = st => (st && VEH.bridgeBy.get(st)) || [];
const bridgeOf = st => bridgesAt(st)[0] || null;
const REF_NARROW = { len: 37.6, span: 34.1, wake: 'M', shape: 'jet' }, REF_WIDE = { len: 63, span: 60, wake: 'H', shape: 'jet' };
// the aircraft's outline as convex pieces, in its own frame ([f, s] metres): the fuselage, tapered at both ends, and the wings
const HULLS = new Map();
function hullOf(P){
  const key = P.len + '|' + P.span + '|' + P.shape; let H = HULLS.get(key); if (H) return H;
  const L = P.len, w = fusW(P)/2 + 0.6, S = P.span/2, prop = P.shape === 'prop';
  const fus = [[L/2, -w*0.4], [L/2 - L*0.05, -w], [-L/2 + L*0.15, -w], [-L/2, -w*0.3], [-L/2, w*0.3], [-L/2 + L*0.15, w], [L/2 - L*0.05, w], [L/2, w*0.4]];
  const lead = prop ? L*0.04 : L*0.1, sweep = prop ? 0.05 : 0.5, chord = prop ? L*0.14 : L*0.17, tip = prop ? L*0.1 : L*0.07;
  const wing = g => [[lead, g*w], [lead - sweep*(S - w), g*(S + 0.6)], [lead - sweep*(S - w) - tip, g*(S + 0.6)], [lead - chord, g*w]];
  H = [fus, wing(-1), wing(1)]; HULLS.set(key, H); return H;
}
// does the segment a-b cross the convex polygon (Cyrus-Beck clipping)?
function segHits(a, b, poly){
  let ar = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; ar += p[0]*q[1] - q[0]*p[1]; }
  const sg = ar > 0 ? 1 : -1, dx = b[0] - a[0], dy = b[1] - a[1]; let t0 = 0, t1 = 1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = -(q[1] - p[1])*sg, ny = (q[0] - p[0])*sg;   // the inward normal
    const num = nx*(a[0] - p[0]) + ny*(a[1] - p[1]), den = nx*dx + ny*dy;
    if (den === 0) { if (num < 0) return false; continue; }
    const t = -num/den; if (den > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}
// how far from a point a stand's design doors are (a narrowbody's front door; a widebody's first and second): where a bridge's outer end was mapped
function standDoorDist(s, e){
  let best = Infinity;
  for (const [P, i] of [[REF_NARROW, 0], [REF_WIDE, 0], [REF_WIDE, 1]]) { const d = doorsOf(P).pax[i], w = fusW(P)/2; for (const g of [-1, 1]) best = Math.min(best, dist(...mPt(s.p, s.hdg, d.f, g*w), ...e)/VM); }
  return best;
}
function vehBridges(){
  VEH.bridges = []; VEH.bridgeBy = new Map();
  const cand = STANDS.filter(s => s.p && s.hdg != null && s.area !== 'hangar');
  for (const [a, b] of VD.bridges) {
    const pa = VP(a), pb = VP(b); let best = null;
    for (const s of cand) for (const [r, e] of [[pa, pb], [pb, pa]]) { const d = standDoorDist(s, e); if (!best || d < best.d) best = { s, r, e, d }; }
    if (!best || best.d > 45) continue;
    if (VEH.bridges.some(o => dist(...o.end0, ...best.e)/VM < 4 && dist(...o.root, ...best.r)/VM < 4)) continue;   // the same bridge mapped twice
    // parked back from the door, as they are with no aircraft on the stand
    const root = best.r, end = best.e, rest = [root[0] + (end[0] - root[0])*0.72, root[1] + (end[1] - root[1])*0.72];
    const B = { st: best.s, root, end0: end, rest, end: rest.slice(), want: rest, L: dist(...root, ...end) };
    B.sts = cand.filter(s => standDoorDist(s, end) <= Math.min(45, best.d + 6));   // every stand (a MARS centre and its halves) the bridge serves
    VEH.bridges.push(B);
    for (const s of B.sts) { const l = VEH.bridgeBy.get(s) || []; if (l.length < 6) l.push(B); VEH.bridgeBy.set(s, l); }
  }
}
// where B would dock to the aircraft's door, or null: the cab on the fuselage side the rotunda is on, the stand-off point
// beside it, and the tunnel's whole swing from its stowed position clear of the nose, the wings and the fuselage
function dockFor(B, M, h, P, door){
  const w = fusW(P)/2, R = toFS(M, h, B.root), g = -1;
  if (R[1] > 0) return null;   // passenger doors are on the left only: a bridge on the aircraft's right has no door to reach
  if (Math.abs(R[1]) < w + 5) return null;   // the rotunda is in the aircraft's way, not beside it
  const D = mPt(M, h, door.f, g*(w + 1)), A = mPt(M, h, door.f, g*(w + 4.5)), len = dist(...B.root, ...D)/VM, L0 = B.L/VM;
  if (len < Math.max(6, L0*0.5) || len > L0*1.3 + 8) return null;   // more or less than the tunnel telescopes to
  const hull = hullOf(P);
  for (const k of [0.34, 0.67, 1]) { const e = toFS(M, h, [B.rest[0] + (A[0] - B.rest[0])*k, B.rest[1] + (A[1] - B.rest[1])*k]); for (const poly of hull) if (segHits(R, e, poly)) return null; }
  return { door: door.id, f: door.f, side: g, dock: D, appr: A, len };
}
// the bridges that serve this aircraft, each at its own door: one (the front door) for most; a widebody takes a second at its second door
function bridgePlan(ac, hdg){
  const st = ac.stand, Bs = bridgesAt(st); if (!Bs.length || small(ac)) return [];
  const P = ac.perf, M = st.p, h = hdg != null ? hdg : ac.hdg, want = super_(P) ? 3 : heavy(ac) ? 2 : 1, out = [], used = new Set();
  // a narrowbody's bridge is at its front door, a widebody's at its first two; an aft door is for steps (a turboprop's one door is the rear one)
  const D = doorsOf(P).pax, front = P.shape === 'prop' ? D : D.slice(0, super_(P) ? 3 : heavy(ac) ? 2 : 1);
  for (const door of front) {
    if (out.length >= want) break;
    let best = null;
    for (const B of Bs) { if (used.has(B)) continue; const k = dockFor(B, M, h, P, door); if (k && (!best || Math.abs(k.len - B.L/VM) < Math.abs(best.k.len - best.B.L/VM))) best = { B, k }; }
    if (best) { used.add(best.B); out.push({ bi: VEH.bridges.indexOf(best.B), ...best.k }); }
  }
  return out;
}
// how the cab sits on its approach: perp metres off the line from the stand-off point to the door, t how far along it (0 stand-off, 1 docked)
function legOf(E, A, D){
  const ax = (D[0] - A[0])/VM, ay = (D[1] - A[1])/VM, ex = (E[0] - A[0])/VM, ey = (E[1] - A[1])/VM, L2 = ax*ax + ay*ay || 1, t = (ex*ax + ey*ay)/L2;
  return { t, perp: Math.hypot(ex - t*ax, ey - t*ay) };
}
function stepBridges(dt){
  const use = new Map();   // each bridge's aircraft, from the turnarounds' plans
  for (const ac of S.acs) { const T = ac.ta; if (!T || !T.br || !T.br.length || T.st !== ac.stand) continue; for (const k of T.br) { const B = VEH.bridges[k.bi]; if (B) use.set(B, [ac, k]); } }
  for (const B of VEH.bridges) {
    const u = use.get(B); let want = B.rest, spd = 0.9, face = null, on = false;
    if (u) {
      const [ac, k] = u, T = ac.ta; on = !!(T.dock && T.dock.some(([a, b]) => S.t >= a && S.t < b) && onStandNow(ac) && !(T.brd && S.t >= T.brd.dc + 70));   // never docked once the doors are shut
      const lg = legOf(B.end, k.appr, k.dock), inLeg = lg.perp < 0.7 && lg.t > -0.05, outLeg = lg.perp < 0.7 && lg.t > 0.03, dD = dist(...B.end, ...k.dock)/VM;
      face = norm(ac.hdg + (k.side < 0 ? 90 : -90)); B.up = k.door === 'U1';
      if (on) { if (dD < 0.12) want = k.dock; else if (inLeg) { want = k.dock; spd = 0.2; } else want = k.appr; }
      else if (outLeg) { want = k.appr; spd = 0.25; }   // backs off the door before it swings away
    }
    const d = dist(...B.end, ...want), mv = spd*VM*dt;   // a bridge drives at walking pace
    if (d <= mv) B.end = want.slice(); else { B.end[0] += (want[0] - B.end[0])/d*mv; B.end[1] += (want[1] - B.end[1])/d*mv; }
    B.dk = !!(u && on && dist(...B.end, ...u[1].dock)/VM < 0.12);   // docked: the door can open
    // the cab turns square to the fuselage as it nears it, and back along the tunnel when it leaves
    const tun = brg(...B.root, ...B.end), th = face != null && dist(...B.end, ...u[1].appr)/VM < 9 ? face : tun;
    B.ch = B.ch == null ? th : norm(B.ch + clamp(angDiff(B.ch, th), -30*dt, 30*dt));
  }
}

// ── driving: speed up and slow down, follow the points, give way to aircraft and to the vehicle in front
const AC_MOVING = new Set(['TAXI', 'PUSH', 'PULL', 'TOW', 'VACATING', 'LINEUP', 'ROLLOUT', 'TAKEOFF']);
function giveWay(v, dt){
  const h = v.hdg, look = 9 + v.v*0.6, ax = v.x + Math.sin(h*D2R)*look*VM, ay = v.y + Math.cos(h*D2R)*look*VM;
  // aircraft on the move (or under a tug) always have right of way
  for (const o of S.acs) {
    if (!o.ground || o === v.ac || !(AC_MOVING.has(o.state) && (o.gs > 0.3 || o.path))) continue;
    const M = acMid(o), r = (Math.max(o.perf.span, o.perf.len)/2 + (v.urgent ? 6 : 14))*VM;
    if (Math.abs(M[0] - ax) > r*2 || Math.abs(M[1] - ay) > r*2) continue;
    if (dist(ax, ay, ...M) < r || dist(v.x, v.y, ...M) < r*0.8) { v.waitT = 0; return 'ac'; }
  }
  // the vehicle in front, while it is moving or has only just stopped; after a few seconds' wait it goes round
  if (v.urgent || (v.waitT || 0) > 6) { v.waitOn = null; if ((v.waitT || 0) > 6) v.waitT = Math.max(0, v.waitT - dt*0.5); return null; }
  for (const w of VEH.list) {
    if (w === v || w.gone || w.parked || w.attached || w.waitOn === v) continue;
    if (Math.abs(w.x - ax) > 15*VM || Math.abs(w.y - ay) > 15*VM) continue;
    const d = dist(ax, ay, w.x, w.y)/VM; if (d > (v.T.len + w.T.len)/2 + 1.5) continue;
    if (Math.abs(angDiff(h, brg(v.x, v.y, w.x, w.y))) < 50) { v.waitOn = w; v.waitT = (v.waitT || 0) + dt; return 'veh'; }
  }
  v.waitOn = null; v.waitT = 0; return null;
}
function driveStep(v, dt){
  if (v.leaveAt != null) { if (S.t < v.leaveAt) return; v.leaveAt = null; const g = v.go; v.go = null; if (g) VEH_GO[g[0]](v, g[1]); }
  if (v.req) { v.v = 0; return; }   // stopped, asking
  if (!v.pts.length) { if (v.home) v.gone = true; else if (!v.parked) { v.parked = true; v.v = 0; if (v.endH != null) v.hdg = v.endH; } return; }
  const tgt = v.pts[0], d = dist(v.x, v.y, ...tgt), last = v.pts.length === 1;
  // slow for the corner ahead and for the last leg in to the aircraft
  let top = v.spd*(v.urgent ? 1.6 : 1);
  if (v.pts.length > 1) { const turn = Math.abs(angDiff(brg(v.x, v.y, ...tgt), brg(...tgt, ...v.pts[1]))); if (turn > 35 && d < 30*VM) top = Math.min(top, turn > 100 ? 5 : 8); }
  if ((v.pts.length <= 2 && !v.home) || (tgt.stop && !tgt.stop.ok)) top = Math.min(top, 6 + d/VM*0.15);
  if (giveWay(v, dt)) top = 0;
  const acc = top >= v.v ? 2.4 : 5; v.v = top >= v.v ? Math.min(top, v.v + acc*dt) : Math.max(top, v.v - acc*dt);
  const mv = v.v*0.5144*dt*VM;
  if (mv <= 0) return;
  const want = brg(v.x, v.y, ...tgt), rate = Math.max(30, v.v*0.5144/6*R2D);
  v.hdg = norm(v.hdg + clamp(angDiff(v.hdg, want), -rate*dt, rate*dt));
  if (d <= mv || (d < 3*VM && Math.abs(angDiff(v.hdg, want)) > 100)) { v.x = tgt[0]; v.y = tgt[1]; if (tgt.stop && !tgt.stop.ok) { v.v = 0; vehAsk(v, tgt.stop); return; } v.pts.shift(); if (!v.pts.length && v.endH != null && !v.home) v.hdg = v.endH; if (tgt.cb) for (const [k, a] of tgt.cb) VEH_AT[k](v, a); }
  else { v.x += Math.sin(v.hdg*D2R)*mv; v.y += Math.cos(v.hdg*D2R)*mv; }
  if (v.T.carts) { const t = v.trail, p = t[0]; if (!p || dist(...p, v.x, v.y) > 0.8*VM) { t.unshift([v.x, v.y]); if (t.length > 40) t.pop(); } }
}

// ── comings and goings that aren't a turnaround: engineers' vans between the hangars and the aircraft, crew buses,
// the fire service out on a training run round the field
function stepRoamers(){
  if (S.t < VEH.nextRoam) return;
  const big = Math.min(1, STANDS.length/60);
  VEH.nextRoam = S.t + rnd(90, 240)*(1.4 - big);
  if (!vehUnder() || VEH.list.filter(v => v.job && /^(visit|crew|trip)$/.test(v.job.k)).length >= Math.max(3, VEH.cap*0.12)) return;
  const parked = S.acs.filter(a => onStandNow(a)), roll = Math.random();
  if (roll < 0.45 && parked.length && VBASE.maint.length) {   // an engineer goes to an aircraft and back
    const ac = parked[Math.floor(Math.random()*parked.length)], s = slotAt(ac, 'van');
    const v = dispatch('van', s.p, s.h, { k: 'visit', until: S.t + rnd(8, 20)*60 }); if (v) { v.ac = ac; v.visitUntil = v.job.until; }
  } else if (roll < 0.75 && VBASE.hand.length && STANDS.length > 4) {   // a crew bus out to a stand
    const st = STANDS[Math.floor(Math.random()*STANDS.length)], v = dispatch('crew', st.p, null, { k: 'crew', until: S.t + rnd(1, 3)*60 }); if (v) v.visitUntil = v.job.until;
  } else if (VG_BUILT && VD.nodes.length > 20) {   // a van across the field: hangar to terminal, terminal to hangar
    const from = Math.random() < 0.5 ? 'maint' : 'hand', to = from === 'maint' ? 'hand' : 'maint', L = VBASE[to]; if (!L.length) return;
    const n = L[Math.floor(Math.random()*L.length)], v = dispatch('van', VG[n].p, null, { k: 'trip', until: S.t + 30 }); if (v) v.visitUntil = v.job.until;
  }
}
function stepFireTraining(){
  if (S.t < VEH.nextFire || !VBASE.fire.length || !VD.fire.length || !S.rtow) return;   // not in the Academy exercises
  VEH.nextFire = S.t + rnd(35, 70)*60;
  if (S.emg && S.acs.some(a => a.emerg && !a.emerg.done)) return;
  // to the fire training ground where the airport has one; otherwise out along the perimeter road to a far corner
  const home = VBASE.fire[0], ground = baseNodes(VD.firetrain || []);
  const far = Object.values(VG).filter(N => N.road && N.adj.length === 1).sort((a, b) => dist(...b.p, ...VG[home].p) - dist(...a.p, ...VG[home].p)).slice(0, 12);
  const N = ground.length ? VG[ground[0]] : far.length ? far[Math.floor(Math.random()*far.length)] : null; if (!N || !vroute(home, N.id)) return;
  const atGround = !!ground.length;
  for (let k = 0; k < (Math.random() < 0.5 ? 2 : 1); k++) {
    const v = dispatch('fire', N.p, null, { k: 'training', until: S.t + rnd(6, 12)*60 }); if (!v) continue;
    v.training = true; v.atGround = atGround; v.visitUntil = v.job.until; v.leaveAt = S.t + k*20; v.go = null;
  }
}
function vehInit(){
  vgBuild(); vehBases(); vehBridges();
  VEH.list = []; VEH.n = 0; VEH.nextRoam = S.t + rnd(30, 90); VEH.nextFire = S.t + rnd(8, 25)*60;
  VEH.cap = Math.round(clamp(STANDS.length*1.6, 24, 160)); TERM_BAY = undefined; SAT_BAYS.clear();
  for (const B of VEH.bridges) { B.end = B.rest.slice(); B.dk = false; B.ch = null; }
  for (const ac of S.acs) { ac.ta = null; ac.tugV = null; ac.pre = null; }
}
function stepVehicles(dt){
  if (!VG_BUILT) return;
  VEH.tick += dt;
  if (VEH.tick >= 1) { VEH.tick = 0; stepPrestage(); stepTurnarounds(); stepRoamers(); stepFireTraining(); stepRadio(); stepVehReqs(); }
  stepTugs(); stepBridges(dt); stepFollow(dt);
  for (const v of VEH.list) {
    if (v.attached) continue;
    if (v.visitUntil != null && v.parked && S.t >= v.visitUntil) { v.visitUntil = null; sendHome(v, 0); }
    driveStep(v, dt);
  }
  if (VEH.list.some(v => v.gone)) VEH.list = VEH.list.filter(v => !v.gone);
}
S.listeners.push((ev, ac) => {
  if (ev === 'start') vehInit();
  if (ev === 'removed' && ac) { if (ac.ta) taEnd(ac); preEnd(ac); if (ac.tugV) { ac.tugV.attached = false; sendHome(ac.tugV, 5); ac.tugV = null; } }
});

// ── drawing (under the aircraft: a bowser stands under the wing)
const VEH_MIN_SCALE = 260;   // pixels per NM below which they are too small to see
function vehBox(len, wid){ cx.beginPath(); const r = Math.min(wid, len)*0.18; cx.roundRect ? cx.roundRect(-wid/2, -len/2, wid, len, r) : cx.rect(-wid/2, -len/2, wid, len); }
function drawVehicle(v, mpx){
  const T = v.T, X = sx(v.x), Y = sy(v.y); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) return;
  const k = Math.max(mpx, 2.6/T.len*1.6), len = T.len*k, wid = Math.max(1.6, T.wid*k);
  // baggage carts trailing along the road behind the tractor
  if (T.carts && v.carts !== 0 && v.trail.length > 2) {
    const n = v.carts || T.carts; let need = (T.len/2 + 2.4)*VM, acc = 0, prev = [v.x, v.y], placed = 0;
    for (const q of v.trail) { const sg = dist(...prev, ...q); acc += sg;
      while (acc >= need && placed < n) { const f = (acc - need)/sg, p = [q[0] + (prev[0] - q[0])*f, q[1] + (prev[1] - q[1])*f], hh = brg(...q, ...prev);
        cx.save(); cx.translate(sx(p[0]), sy(p[1])); cx.rotate(hh*D2R); vehBox(3.2*k, Math.max(1.4, 1.7*k)); cx.fillStyle = '#d7dbe1'; cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 0.6; cx.stroke(); cx.restore();
        placed++; need += 3.8*VM; }
      prev = q; if (placed >= n) break; }
  }
  cx.save(); cx.translate(X, Y); cx.rotate(v.hdg*D2R);
  vehBox(len, wid); cx.fillStyle = T.col; cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 0.7; cx.stroke();
  if (len > 5) {
    // the cab at the front, and the body's own detail: the tank, the stairs, the box, the belt, the chequers
    cx.fillStyle = T.cab; cx.fillRect(-wid/2 + 0.4, -len/2 + 0.4, wid - 0.8, Math.min(len*0.28, 2.2*k));
    if (T.tank) { cx.fillStyle = 'rgba(40,110,60,.55)'; cx.fillRect(-wid*0.32, -len*0.12, wid*0.64, len*0.55); }
    if (T.stairs) { cx.strokeStyle = 'rgba(40,40,40,.55)'; cx.lineWidth = 0.6; for (let i = 0; i < 6; i++) { const y = -len*0.1 + i*len*0.09; cx.beginPath(); cx.moveTo(-wid*0.4, y); cx.lineTo(wid*0.4, y); cx.stroke(); } }
    if (T.box) { cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 0.6; cx.strokeRect(-wid*0.42, -len*0.15, wid*0.84, len*0.6); }
    if (T.belt) { cx.fillStyle = '#333'; cx.fillRect(-wid*0.22, -len*0.2, wid*0.44, len*0.68); }
    if (T.check) { cx.fillStyle = '#1a1a1a'; for (let i = 0; i < 4; i++) cx.fillRect(-wid/2 + (i % 2)*wid/2, -len*0.05 + Math.floor(i/2)*len*0.12, wid/2, len*0.12); }
    if (v.type === 'fire') { cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(-wid*0.12, -len*0.2, wid*0.24, len*0.62); }
    if (v.type === 'amb') { cx.fillStyle = '#1f8f3a'; cx.fillRect(-wid/2, len*0.05, wid, len*0.1); }
  }
  // beacons: amber on the move round aircraft, blue for the emergency services on a call
  const blink = Math.floor(performance.now()/260 + v.id) % 2 === 0;
  if (blink && (v.v > 0.5 || v.attached || (T.blue && v.urgent))) {
    cx.fillStyle = T.blue && (v.urgent || v.blues) ? 'rgba(60,140,255,.95)' : 'rgba(255,170,0,.95)';
    cx.beginPath(); cx.arc(0, -len*0.3, Math.max(1.1, 0.7*k), 0, 7); cx.fill();
  }
  cx.restore();
}
function drawBridges(mpx){
  for (const B of VEH.bridges) {
    const a = [sx(B.root[0]), sy(B.root[1])], b = [sx(B.end[0]), sy(B.end[1])];
    if (Math.max(a[0], b[0]) < -50 || Math.min(a[0], b[0]) > W + 50 || Math.max(a[1], b[1]) < -50 || Math.min(a[1], b[1]) > H + 50) continue;
    const w = Math.max(2, 3.6*mpx), h = Math.atan2(b[1] - a[1], b[0] - a[0]), at = f => [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f];
    cx.save(); cx.lineCap = 'butt';
    // on the drawn chart (no imagery) the terminal may not be drawn here: a stub of the building face the rotunda stands on, so the bridge is never left floating
    if (typeof IMG === 'undefined' || !IMG) {
      cx.save(); cx.translate(...a); cx.rotate(h); const m = mpx;
      cx.fillStyle = 'rgba(84,92,106,.95)'; cx.strokeStyle = 'rgba(30,34,40,.85)'; cx.lineWidth = 0.9;
      cx.fillRect(-9*m, -7*m, 8.2*m, 14*m); cx.strokeRect(-9*m, -7*m, 8.2*m, 14*m);
      cx.fillStyle = 'rgba(120,130,146,.9)'; cx.fillRect(-1.5*m, -7*m, 0.7*m, 14*m);   // the glazed face towards the apron
      cx.restore();
    }
    // the tunnel in three telescoping sections, each a little narrower than the one it slides into, with the drive wheels at the cab end
    const secs = [[0, 0.4, 1], [0.4, 0.75, 0.92], [0.75, 1, 0.84]], tone = B.up ? ['#cdd5df', '#c2cad5'] : ['#b4bcc7', '#a9b1bc'];   // the A380's upper-deck bridge is a little paler, high over the others
    for (const [f0, f1, k] of secs) {
      const p0 = at(f0), p1 = at(f1);
      cx.strokeStyle = 'rgba(40,46,56,.75)'; cx.lineWidth = w*k + 1.4; cx.beginPath(); cx.moveTo(...p0); cx.lineTo(...p1); cx.stroke();
      cx.strokeStyle = f0 ? tone[0] : tone[1]; cx.lineWidth = w*k; cx.beginPath(); cx.moveTo(...p0); cx.lineTo(...p1); cx.stroke();
    }
    // the rotunda at the terminal
    cx.fillStyle = '#7e8794'; cx.strokeStyle = 'rgba(30,34,40,.8)'; cx.lineWidth = 0.8; cx.beginPath(); cx.arc(a[0], a[1], w*0.85, 0, 7); cx.fill(); cx.stroke();
    // the cab, turned square to the fuselage once it is near it; the canopy at its face closes on the door
    cx.translate(...b); cx.rotate((B.ch != null ? B.ch : brg(...B.root, ...B.end))*D2R);
    cx.fillStyle = '#8d96a2'; cx.strokeStyle = 'rgba(30,34,40,.8)'; cx.lineWidth = 0.8;
    cx.fillRect(-w*0.75, -w*0.8, w*1.5, w*1.2); cx.strokeRect(-w*0.75, -w*0.8, w*1.5, w*1.2);
    cx.fillStyle = B.dk ? '#cfd5dc' : '#aab2bd'; cx.fillRect(-w*0.55, -w*0.8 - w*0.35, w*1.1, w*0.35); cx.strokeRect(-w*0.55, -w*0.8 - w*0.35, w*1.1, w*0.35);
    if (B.dk && Math.floor(performance.now()/700) % 2 === 0) { cx.fillStyle = 'rgba(80,200,120,.95)'; cx.beginPath(); cx.arc(0, w*0.1, Math.max(0.9, 0.25*w), 0, 7); cx.fill(); }   // docked
    cx.restore();
  }
}
// chocks at the nose and main wheels and the cones round the aircraft while the turnaround is on
function drawStandKit(mpx){
  for (const ac of S.acs) {
    const T = ac.ta; if (!T || !T.kit || !onStandNow(ac)) continue;
    const P = ac.perf, M = ac.stand.p, h = ac.hdg, X = sx(M[0]), Y = sy(M[1]); if (X < -80 || Y < -80 || X > W + 80 || Y > H + 80) continue;
    const L = P.len, S2 = P.span/2, w = fusW(P)/2, r = Math.max(1.1, 0.45*mpx), pt = (f, s) => { const q = mPt(M, h, f, s); return [sx(q[0]), sy(q[1])]; };
    cx.save();
    cx.fillStyle = '#2a2a2a'; for (const [f, s] of [[L/2 - L*0.11, -0.6], [L/2 - L*0.11, 0.6], [-L*0.04, -(w*0.5 + 1)], [-L*0.04, w*0.5 + 1]]) { const q = pt(f, s); cx.fillRect(q[0] - r*0.6, q[1] - r*0.6, r*1.2, r*1.2); }
    cx.fillStyle = '#ff7a1a'; cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = Math.max(0.4, r*0.25);
    for (const [f, s] of [[L/2 + 4, 0], [-L/2 - 4, 0], [-L*0.1, -(S2 + 4)], [-L*0.1, S2 + 4]]) { const q = pt(f, s); cx.beginPath(); cx.arc(q[0], q[1], r, 0, 7); cx.fill(); cx.stroke(); }
    cx.restore();
  }
}
// ── the passengers: a stream of people on foot, drawn from the turnaround's state (no state of their own, so nothing to save).
// Off the aircraft down the steps and onto the apron bus, or across the apron to the terminal where it is close; through the
// bridge's tunnel; and the other way for boarding. Only while a device is at the door, and a bus at the foot of the steps.
const PAX_COL = ['#e8453c', '#2f6fdb', '#f2b01e', '#2aa876', '#8e5bd1', '#f7f7f7', '#2b2f36', '#e58a2b', '#4fb7d8', '#c9568f'];
function paxStreams(ac){
  const T = ac.ta, px = paxState(ac); if (!T || !px || (px.k !== 'Deplaning' && px.k !== 'Boarding')) return [];
  const P = ac.perf, M = ac.stand.p, h = ac.hdg, w = fusW(P)/2, out = [], dir = px.k === 'Deplaning' ? 1 : -1, a = accessNow(ac), n = a.br.length + a.steps.length || 1;
  const pt = (f, s) => mPt(M, h, f, s), rateOf = per => dir > 0 ? per : Math.max(10, T.brate/n);   // boarding: the gate lets people through in groups, so the stream is drawn at a steadier pace than the average
  for (const k of a.br) { const B = VEH.bridges[k.bi]; out.push({ pts: [B.end.slice(), B.root.slice()], rate: rateOf(14), dir, inside: true }); }
  const bus = bussed(ac, T.br.length);
  let tf = null;
  for (const j of a.steps) {
    const f = (j.k === 'stepsR' ? doorLast(P) : doorFirst(P)).f, pts = [pt(f, -w), pt(f, -(w + 1.6)), pt(f, -(w + 5.8))];
    if (bus) {
      const bj = T.jobs.find(q => q.k === (j.k === 'stepsR' ? 'bus2' : 'bus') && q.v && q.v.parked && !q.v.home && !q.v.staged && !q.done && q.v.ac === ac);
      if (!bj) continue;   // no bus at the foot of the steps yet: nobody comes down
      const v = bj.v, foot = pts[2], d = dist(...foot, v.x, v.y) || 1, e = 1.3*VM; pts.push([v.x + (foot[0] - v.x)/d*e, v.y + (foot[1] - v.y)/d*e]);
    } else {
      if (tf === null) { tf = VD.terms.length ? VD.terms.map(q => VP(q)).reduce((b, q) => !b || dist(...q, ...pts[2]) < dist(...b, ...pts[2]) ? q : b, null) : false; }
      if (!tf || dist(...tf, ...pts[2])/VM > 180) continue;
      pts.push(tf.slice()); out.walk = true;
    }
    out.push({ pts, rate: rateOf(12), dir, walk: !bus });
  }
  return out;
}
function drawPax(mpx){
  const SPD = 1.4, t = S.t*SPD, r = Math.max(1, 0.55*mpx);
  for (const ac of S.acs) {
    if (!ac.ta || !ac.stand || !onStandNow(ac) || !ac.ta.N) continue;
    const X = sx(ac.stand.p[0]), Y = sy(ac.stand.p[1]); if (X < -250 || Y < -250 || X > W + 250 || Y > H + 250) continue;
    for (const st of paxStreams(ac)) {
      const pts = st.pts.map(q => [sx(q[0]), sy(q[1])]), seg = [], tot = []; let L = 0;
      for (let i = 1; i < st.pts.length; i++) { const d = dist(...st.pts[i - 1], ...st.pts[i])/VM; seg.push(d); L += d; tot.push(L); }
      if (L < 1) continue;
      const gap = Math.max(0.9, 60*SPD/st.rate*0.4), cyc = Math.floor(t/gap), off = t - cyc*gap;
      if (st.walk) { cx.save(); cx.strokeStyle = 'rgba(255,214,64,.28)'; cx.lineWidth = Math.max(1, 1.4*mpx); cx.setLineDash([4*mpx, 4*mpx]); cx.beginPath(); pts.forEach((q, i) => i ? cx.lineTo(...q) : cx.moveTo(...q)); cx.stroke(); cx.restore(); }
      for (let n = 0; n*gap + off < L; n++) {
        let u = n*gap + off; if (st.dir < 0) u = L - u;
        let i = 0; while (i < seg.length - 1 && u > tot[i]) i++;
        const a0 = i ? tot[i - 1] : 0, f = clamp((u - a0)/(seg[i] || 1), 0, 1), A = pts[i], B = pts[i + 1], id = cyc - n;
        cx.globalAlpha = st.inside ? 0.45 : 1; cx.fillStyle = PAX_COL[((id*7) % 10 + 10) % 10];
        cx.beginPath(); cx.arc(A[0] + (B[0] - A[0])*f, A[1] + (B[1] - A[1])*f, st.inside ? r*0.8 : r, 0, 7); cx.fill();
      }
      cx.globalAlpha = 1;
    }
  }
}
function drawVehicles(){
  const sc = V.scale; if (sc < VEH_MIN_SCALE || !VG_BUILT) return;
  const mpx = sc/1852;
  drawBridges(mpx);
  drawStandKit(mpx);
  for (const v of VEH.list) drawVehicle(v, mpx);
  drawPax(mpx);
}
// what a vehicle is up to, for the pop-up when it is clicked
function vehDoing(v){
  const C = S.rc;
  if (v.req) return v.req.k === 'rwy' ? `Holding short of runway ${rwN(v.req.R)}, ${v.req.auto ? 'crossing when it is clear' : 'asking to cross'}` : `Asking to drive via taxiway ${v.req.tws.join(', ')}`;
  if (v.xing && v.onRwy) return `Crossing runway ${rwyName(v.onRwy).split('/')[0]}`;
  if (C && C.v === v) return C.st === 'OUT' ? `Driving to holding point ${C.hp.replace(/~\d+$/, '')} for a ${C.why}` : C.st === 'READY' ? `At holding point ${C.hp.replace(/~\d+$/, '')}, asking to enter runway ${C.rw}` : C.st === 'ON' ? `Inspecting runway ${C.rw}` : `Vacating runway ${C.rw}`;
  if (v.type === 'fire' && v.ac && v.blues) return v.parked ? (v.job && v.job.k === 'attend' ? `Attending ${v.ac.cs}` : `Standing by for ${v.ac.cs}'s ${v.ac.emerg ? v.ac.emerg.k : 'emergency'}`) : `On a call to ${v.ac.cs}`;
  if (v.type === 'follow' && v.ac) return v.leading ? `Leading ${v.ac.cs} to ${APT.standWord || 'stand'} ${v.ac.stand ? v.ac.stand.id : ''}` : v.ac.following ? `Pulling in front of ${v.ac.cs}` : v.parked ? `Waiting at the exit for ${v.ac.cs} (medical)` : `On the way to meet ${v.ac.cs} at its exit`;
  if (v.type === 'amb' && v.ac) return v.parked ? `Meeting ${v.ac.cs} on ${APT.standWord || 'stand'} ${v.ambSt ? v.ambSt.id : ''}` : `On a call to meet ${v.ac.cs}`;
  if (v.type === 'tug' && v.job && v.job.k === 'emgtug' && v.ac) return `Tug for ${v.ac.cs} after its emergency`;
  if (v.attached && v.ac) return `${v.ac.state === 'TOW' ? 'Towing' : v.ac.state === 'PULL' ? 'Pulling forward' : 'Pushing back'} ${v.ac.cs}`;
  if (v.home) return 'Returning to base';
  if (v.training) return v.parked ? (v.atGround ? 'Fire crew training at the fire training ground' : 'Fire service training') : 'Out on a training run';
  const J = v.job, ac = v.ac, cs = ac ? ac.cs : '', st = ac && ac.stand ? ` on ${APT.standWord || 'stand'} ${ac.stand.id}` : '';
  const w = { stepsF: 'Steps at the front door of', stepsR: 'Steps at the rear door of', bus: 'Bus for the passengers of', bus2: 'Second bus for', beltF: 'Belt loader at the hold of', beltR: 'Belt loader at the rear hold of',
    bags: 'Unloading the bags of', bagsR: 'Bringing the bags for', cater: 'Catering', caterR: 'Catering (rear galley)', fuel: 'Refuelling', gpu: 'Ground power for', lav: 'Toilet service for', water: 'Water service for', van: 'Engineer at', amb: 'Ambulance for', tug: 'Tug waiting at the nose of' };
  if (J && w[J.k]) { const px = v.parked && ac && /^(steps|bus)/.test(J.k) ? paxState(ac) : null; return `${v.parked ? '' : 'On the way: '}${w[J.k]} ${cs}${st}${px ? `: ${px.k.toLowerCase()}, ${px.n} of ${px.N} passengers` : ''}`; }
  if (v.staged && ac) return `Waiting clear of ${cs}${st} for the chocks to go in`;
  if (J && J.k === 'shuttle') return v.parked ? 'Bus unloading at the terminal' : 'Bus taking passengers to the terminal';
  if (J && J.k === 'crew') return v.parked ? 'Crew bus dropping off a crew' : 'Crew bus heading out';
  if (J && J.k === 'trip') return 'Driving across the airfield';
  return v.parked ? 'Parked' : 'Driving';
}
// the aircraft's panel (ui.js): what is happening round it on stand, and how many passengers are off or on
const TA_JOB = { cater: 'catering', fuel: 'fuelling', lav: 'toilet service', water: 'water', belt: 'baggage', bags: 'baggage', bagsR: 'baggage', gpu: 'ground power', van: 'engineers' };
function taLine(ac){
  const T = ac.ta; if (!T || !onStandNow(ac)) return '';
  const a = accessNow(ac), at = a.br.length ? (a.br.length > 1 ? 'jet bridges' : `jet bridge ${a.br[0].door}`) : a.steps.length ? (a.steps.length > 1 ? 'steps at both doors' : 'steps') : '', px = paxState(ac);
  const doing = [...new Set(T.jobs.filter(j => j.v && !j.done && j.v.parked && !j.v.home && TA_JOB[j.k.replace(/[FR]$/, '')] || TA_JOB[j.k]).map(j => TA_JOB[j.k] || TA_JOB[j.k.replace(/[FR]$/, '')]).filter(Boolean))];
  const parts = [];
  if (px) parts.push(`<b>${px.k}</b>${at && px.k !== 'Doors closed' ? ' by ' + at : ''}: ${px.n} of ${px.N} passengers`);
  else if (T.br && T.br.length && VEH.bridges[T.br[0].bi] && !VEH.bridges[T.br[0].bi].dk && T.dock.some(([x, y]) => S.t >= x && S.t < y)) parts.push(`Jet bridge ${T.br[0].door} moving in to the door`);
  else if (T.arr && !T.dep && S.t < T.chocks) parts.push('Engines off; chocks going in');
  if (doing.length) parts.push(doing.join(', '));
  return parts.length ? `<div class="meta">${parts.join(' · ')}</div>` : '';
}
const vehPop = document.createElement('div'); vehPop.className = 'vehpop'; vehPop.hidden = true; document.body.appendChild(vehPop);
function vehAt(X, Y){
  if (V.scale < VEH_MIN_SCALE) return null;
  let best = null, bd = 12;
  for (const v of VEH.list) { const d = Math.hypot(sx(v.x) - X, sy(v.y) - Y); if (d < bd) { bd = d; best = v; } }
  return best;
}
function showVehPop(v, e){
  vehPop.innerHTML = `<b>${esc(v.cs ? radioName(v) : v.T.name)}</b>${v.cs ? `<span class="vt">${esc(v.T.name)}</span>` : ''}<span>${esc(vehDoing(v))}</span>`;
  vehPop.hidden = false; const r = cv.getBoundingClientRect();
  vehPop.style.left = Math.min(window.innerWidth - 240, r.left + e.offsetX + 14) + 'px'; vehPop.style.top = (r.top + e.offsetY - 10 + window.scrollY) + 'px';
  clearTimeout(vehPop.t); vehPop.t = setTimeout(() => { vehPop.hidden = true; }, 4000);
}
document.addEventListener('pointerdown', e => { if (!vehPop.hidden && !vehPop.contains(e.target)) vehPop.hidden = true; });

// ═════════════════════════ radio vehicles: runway checks and the fire service ═════════════════════════
// The airside operations car (OPS1, "Ops One") inspects the runway: it drives to a holding point and asks the tower to
// enter; cleared on (OPS1 ENTER), it drives the length of the runway on one side, turns at the far end, comes back on
// the other and vacates where it came on, then reports vacated. While it is on the runway the runway is occupied: an
// arrival goes around and a departure must not be cleared. OPS1 VACATE gets it off at the nearest exit; OPS1 HOLD
// keeps it at the holding point. It asks for a routine inspection every hour or two, and you can send it (OPS1 CHECK
// [runway], or Runway check in the weather panel). With the runway closed for an inspection it goes on by itself.
// A MAYDAY: the fire tenders (FIRE1..) go out to standby by the runway on blue lights; after landing the aircraft
// stops clear of the runway, the tenders surround it and inspect it, and then a tug comes to tow it in: approve that
// tow like any other. A medical: the ambulance meets the aircraft on its stand.
const RC_SPEED = 40;   // kt on the runway
const radioName = v => v.cs ? v.cs.replace(/^([A-Z]+)(\d+)$/, (m, w, d) => w[0] + w.slice(1).toLowerCase() + ' ' + d) : v.T.name;
const radioSpoken = v => v.cs ? v.cs.replace(/^([A-Z]+)(\d+)$/, (m, w, d) => w[0] + w.slice(1).toLowerCase() + ' ' + d.split('').map(c => DIG[+c]).join(' ')) : v.T.name;
function vcall(v, text){ const t = `${APT.tower[0]}, ${radioSpoken(v)}, ${text}`; log('plt', t.replace(radioSpoken(v), radioName(v)), radioName(v).toUpperCase()); say(t, v.cs); }
function vread(v, text){ const t = `${text}, ${radioSpoken(v)}`; log('plt', t.replace(radioSpoken(v), radioName(v)), radioName(v).toUpperCase()); say(t, v.cs); }
function vatc(v, text){ log('atc', `${radioName(v)}, ${text}`, 'TOWER'); }
// the vehicle on that runway (any end of it), if any
function vehOnRwy(rw){ const id = rwyOf(rw).id; return VEH.list.find(v => v.onRwy === id && !v.gone) || null; }
const rcHolds = R => Object.keys(HOLDS).filter(h => holdRwy(h) === R && HOLDS[h].node && GN[HOLDS[h].node] && VG['t:' + HOLDS[h].node]);
const rLen = R => R.len || RWY_M;
const holdM = (R, h) => R.mOf(GN[HOLDS[h].rwy] ? GN[HOLDS[h].rwy].p : GN[HOLDS[h].node].p);
function rcEntry(R, from){
  // a holding point near one end of the runway (so the check covers it all), the nearest by road
  let best = null, bs = Infinity;
  for (const h of rcHolds(R)) {
    const r = vroute(from, 't:' + HOLDS[h].node, true); if (!r) continue;
    let L = 0; for (let i = 1; i < r.length; i++) L += dist(...VG[r[i-1]].p, ...VG[r[i]].p);
    const m = holdM(R, h), sc = L/VM + 1.5*Math.min(m, rLen(R) - m);
    if (sc < bs) { bs = sc; best = h; }
  }
  return best;
}
// OPS1 out to the runway: rw (an end designator), why (log text), auto (the runway is closed: no clearance needed)
function opsCheck(rw, why, auto){
  if (S.rc) { if (auto) S.rc.auto = true; return S.rc; }
  const R = rwyOf(rw || S.rwy), base = baseFor('ops', R.rm(rLen(R)/2, 0)); if (!base) return null;
  const hp = rcEntry(R, base); if (!hp) return null;
  const v = newVeh('ops', VG[base].p, 0, { cs: 'OPS1' });
  const r = vroute(base, 't:' + HOLDS[hp].node, true);
  v.pts = r ? routePts(r, v) : [GN[HOLDS[hp].node].p]; const end = v.pts[v.pts.length - 1] = GN[HOLDS[hp].node].p.slice();
  end.cb = [['rcHold']];
  if (r && r.length > 1) v.hdg = brg(...VG[r[0]].p, ...VG[r[1]].p);
  S.rc = { v, R, rw: rwyName(R.id), hp, st: 'OUT', auto: !!auto, why: why || 'routine runway inspection', t: S.t };
  v.need = null; renderAtisSoon();
  return S.rc;
}
function rcAtHold(){
  const C = S.rc; if (!C) return; C.st = 'READY'; C.t = S.t; C.v.v = 0; C.v.hdg = brg(...GN[HOLDS[C.hp].node].p, ...C.R.rm(holdM(C.R, C.hp), 0));
  if (C.auto || rwyBlocked(C.rw)) { vcall(C.v, `at holding point ${hpWords(C.hp)}, entering the closed runway ${C.rw} for the inspection`); rcEnter(true); return; }
  C.v.need = 'Request to enter runway'; C.asked = S.t;
  vcall(C.v, `at holding point ${hpWords(C.hp)}, request to enter runway ${C.rw} for a ${C.why}`);
  renderAtisSoon();
}
function rcPath(C){
  const R = C.R, L = rLen(R), mE = holdM(R, C.hp), dir = mE < L/2 ? 1 : -1, far = dir > 0 ? L - 45 : 45, s1 = 9*(KEEP_LEFT ? 1 : -1)*dir;
  const P = (m, o) => R.rm(m, o);
  const pts = [P(mE + dir*12, s1), P(far, s1), P(far + dir*25, 0), P(far, -s1), P(mE + dir*18, -s1), P(mE, 0), GN[HOLDS[C.hp].node].p.slice()];
  pts[pts.length - 1].cb = [['rcOff', true]];
  return pts;
}
function rcEnter(auto){
  const C = S.rc; if (!C || C.st !== 'READY') return false;
  C.st = 'ON'; C.v.need = null; C.v.onRwy = C.R.id; C.v.spd = RC_SPEED; C.v.urgent = true; C.v.pts = rcPath(C); C.v.parked = false; C.t = S.t;
  renderAtisSoon(); return true;
}
// off at the nearest holding point on its way (done: the whole length inspected)
function rcOff(done){
  const C = S.rc; if (!C) return; const v = C.v;
  v.onRwy = null; v.spd = v.T.kt; v.urgent = false;
  if (done) { vcall(v, `runway ${C.rw} vacated at ${hpWords(C.hp)}, inspection complete, ${Math.random() < 0.15 ? 'one item of FOD picked up, ' : ''}runway is clear`); if (!C.auto && S.seats.TWR !== 'AI') S.score.pts += 5; }
  else vcall(v, 'runway vacated');
  S.rc = null; sendHome(v, 3); renderAtisSoon(); emit('rcdone', done);
}
function rcVacate(){
  const C = S.rc; if (!C || C.st !== 'ON') return false;
  const R = C.R, v = C.v, m = R.mOf([v.x, v.y]), ahead = v.pts.length > 1 ? Math.sign(R.mOf(v.pts[0]) - m) || 1 : 1;
  // the nearest holding point, preferring one ahead of it
  const hs = rcHolds(R).map(h => [h, holdM(R, h)]).sort((a, b) => (Math.abs(a[1] - m) + ((a[1] - m)*ahead < -30 ? 400 : 0)) - (Math.abs(b[1] - m) + ((b[1] - m)*ahead < -30 ? 400 : 0)));
  if (!hs.length) return false;
  const [h, hm] = hs[0]; C.hp = h; C.st = 'OFF';
  const out = GN[HOLDS[h].node].p.slice(); out.cb = [['rcOff', false]];
  v.pts = [R.rm(hm, 0), out];
  return true;
}
// the controller's instructions to a radio vehicle: OPS1 ENTER / VACATE / HOLD / CHECK [rwy]; RWY CHECK [rwy]
const GO_WORDS = /^(GO|APPROVE|APPROVED|OK|CROSS|PROCEED|CLEAR|CLEARED|ENTER)$/;
function vehCommand(toks){
  let t0 = toks[0];
  if ((t0 === 'RWY' || t0 === 'RUNWAY') && toks[1] === 'CHECK') { toks = ['OPS1', 'CHECK', ...toks.slice(2)]; t0 = 'OPS1'; }
  if (t0 === 'VEHICLES' || t0 === 'VEH') {
    if (toks[1] === 'AUTO') setVehAuto(true); else if (toks[1] === 'ASK') setVehAuto(false);
    else if (toks[1] === 'GO' || toks[1] === 'APPROVE') { const L = vehAsking().filter(v => v.req.k === 'twy'); L.forEach(vehApprove); if (!L.length) sys('No vehicle is asking to use a taxiway.'); }
    else sys('VEHICLES AUTO (taxiways without asking), VEHICLES ASK, or VEHICLES GO (approve every taxiway request).');
    renderAtisSoon(); return true;
  }
  // a vehicle asking to use a taxiway or cross a runway: FUEL3 GO (or CROSS, PROCEED, APPROVE), FUEL3 HOLD
  const V0 = /^[A-Z]+\d+$/.test(t0) && VEH.list.find(v => v.cs === t0 && v.req && !v.req.auto && !v.gone);
  if (V0) {
    const what = toks[1] || 'GO';
    if (GO_WORDS.test(what)) { vehApprove(V0); return true; }
    if (what === 'HOLD' || what === 'WAIT') { V0.req.asked = S.t; vatc(V0, V0.req.k === 'rwy' ? `hold short of runway ${rwN(V0.req.R)}` : 'hold position'); vread(V0, 'holding'); return true; }
    sys(`${radioName(V0)}: GO (approve) or HOLD.`); return true;
  }
  if (/^[A-Z]+\d+$/.test(t0) && !/^(OPS1?|FIRE\d?)$/.test(t0) && VEH.list.some(v => v.cs === t0 && !v.gone)) { sys(`${radioName(VEH.list.find(v => v.cs === t0))} isn't asking for anything.`); return true; }
  if (!/^(OPS1?|FIRE\d?)$/.test(t0)) return false;
  const what = toks[1] || '', arg = toks[2];
  if (/^FIRE/.test(t0)) { sys('The fire service is busy with its emergency: it reports to you when the inspection is done.'); return true; }
  const C = S.rc;
  if (what === 'CHECK' || what === 'INSPECT') {
    if (C) { sys(`Ops 1 is already ${C.st === 'OUT' ? 'on its way to holding point ' + C.hp : C.st === 'READY' ? 'at holding point ' + C.hp + ', waiting to enter' : 'on the runway'}.`); return true; }
    const rw = arg && RW_ENDS.includes(arg) ? arg : S.rwy;
    const ok = opsCheck(rw, 'runway inspection');
    if (!ok) { sys('No holding point for a runway check can be reached by road.'); return true; }
    log('atc', `Ops 1, request runway inspection, runway ${rwyName(ok.R.id)}, call at holding point ${ok.hp.replace(/~\d+$/, '')}`, 'TOWER');
    vread(ok.v, `wilco, holding point ${hpWords(ok.hp)}`);
    return true;
  }
  if (!C) { sys('Ops 1 is not out on the airfield. Send it on a runway check with OPS1 CHECK.'); return true; }
  if (what === 'ENTER' || what === 'APPROVE' || what === 'CLEAR' || what === 'GO') {
    if (C.st !== 'READY') { sys(C.st === 'OUT' ? `Ops 1 is still driving to holding point ${C.hp}.` : 'Ops 1 is already on the runway.'); return true; }
    const busy = S.acs.find(o => onRunway(o, C.rw)), fin = S.acs.find(o => o.kind === 'ARR' && o.airborne && o.ctl && (o.app ? rwyOf(o.app) === C.R : rwyOf(S.rwy) === C.R) && finalDist(o) < 3);
    if (busy) sys(`Careful: ${busy.cs} is on the runway.`, true);
    if (fin) sys(`Careful: ${fin.cs} is cleared to land on ${finalDist(fin).toFixed(1)} NM final: it will go around.`, true);
    vatc(C.v, `enter runway ${C.rw} at ${C.hp.replace(/~\d+$/, '')}, report vacated`);
    vread(C.v, `entering runway ${C.rw} at ${hpWords(C.hp)}, wilco`);
    rcEnter(); return true;
  }
  if (what === 'VACATE' || what === 'VAC' || what === 'OFF') {
    if (C.st !== 'ON') { sys('Ops 1 is not on the runway.'); return true; }
    vatc(C.v, `vacate the runway ${rwyName(C.R.id)} immediately, report vacated`);
    rcVacate(); vread(C.v, `vacating, nearest exit, ${hpWords(C.hp)}`); return true;
  }
  if (what === 'HOLD' || what === 'WAIT') {
    if (C.st === 'READY') { vatc(C.v, 'hold position'); vread(C.v, 'holding'); C.asked = S.t; return true; }
    sys(C.st === 'ON' ? 'Ops 1 is on the runway: VACATE gets it off.' : 'Ops 1 will hold at the holding point and call you.'); return true;
  }
  if (what === 'HOME' || what === 'CANCEL') {
    if (C.st === 'ON') { sys('Ops 1 is on the runway: VACATE gets it off first.'); return true; }
    vatc(C.v, 'runway inspection cancelled'); vread(C.v, 'returning to base'); C.v.need = null; S.rc = null; sendHome(C.v, 2); renderAtisSoon(); return true;
  }
  sys('Ops 1: CHECK [runway], ENTER, HOLD, VACATE or CANCEL.'); return true;
}
let atisT = 0; function renderAtisSoon(){ atisT = 1; }
// routine inspections, the reminders, and incidents with the car on the runway
function stepRadio(){
  if (atisT) { atisT = 0; if (typeof renderAtis === 'function') renderAtis(); }
  const C = S.rc;
  if (S.rtow && S.running) {   // not in the Academy exercises
    if (S.rcNext == null) S.rcNext = S.t + rnd(12, 30)*60;
    if (!C && S.t >= S.rcNext) {
      S.rcNext = S.t + rnd(70, 130)*60;
      // each runway in use in turn, not always the same one
      const use = typeof rwysInUse === 'function' ? rwysInUse() : [S.rwy]; let rw = S.rwy;
      if (use.length > 1) rw = use.find(r => rwyOf(r).id !== S.rcLastRw) || use[0];
      if (!rwyBlocked(rw)) { S.rcLastRw = rwyOf(rw).id; opsCheck(rw, 'routine runway inspection'); }
    }
  }
  if (C && C.st === 'READY' && C.asked != null && S.t - C.asked > 240) { C.asked = S.t; vcall(C.v, `still holding at ${hpWords(C.hp)} for the runway inspection`); }
  if (C && C.st === 'ON') for (const ac of S.acs) {
    if (!(ac.onRwy && (ac.rwyId || RWYS[0].id) === C.R.id) || ac.rcHit === C.t) continue;
    if (ac.state === 'TAKEOFF' || ac.state === 'ROLLOUT') { ac.rcHit = C.t; SC(ac).incidents++; SC(ac).pts -= 60; sys(`INCIDENT: ${ac.cs} ${ac.state === 'TAKEOFF' ? 'took off' : 'landed'} with Ops 1 on the runway.`, true); }
  }
  // anything landing or taking off with a vehicle crossing
  for (const v of VEH.list) if (v.xing && v.onRwy && !v.gone) for (const ac of S.acs) {
    if (!(ac.onRwy && (ac.rwyId || RWYS[0].id) === v.onRwy) || ac.rcHit === v.xing || !(ac.state === 'TAKEOFF' || ac.state === 'ROLLOUT')) continue;
    ac.rcHit = v.xing; SC(ac).incidents++; SC(ac).pts -= 60; sys(`INCIDENT: ${ac.cs} ${ac.state === 'TAKEOFF' ? 'took off' : 'landed'} with ${radioName(v)} crossing the runway.`, true);
  }
  // the runway closed for an inspection (bird strike, debris, after an emergency): Ops 1 goes out and drives it
  if (S.emg && S.emg.rwyBlock && !C) opsCheck(blockRw(), 'runway inspection', true);
  stepFire();
}

// ── the fire service and the ambulance
const FIRE_SLOTS = ['fireA', 'fireB', 'fireC', 'fireD'];
function fireStandby(ac){
  if (!VBASE.fire.length || ac.fireV) return;
  const R = rwyOf(landRw(ac)), L = rLen(R), hs = rcHolds(R).map(h => [h, holdM(R, h)]);
  const n = STANDS.length > 40 ? 3 : 2; ac.fireV = [];
  for (let k = 0; k < n; k++) {
    const want = L*(k + 1)/(n + 1), h = hs.sort((a, b) => Math.abs(a[1] - want) - Math.abs(b[1] - want))[0]; if (!h) break;
    const p = GN[HOLDS[h[0]].node].p, v = dispatch('fire', p, null, { k: 'standby' }, true); if (!v) break;
    v.cs = null; vehCs(v); v.urgent = true; v.blues = true; v.ac = ac; v.leaveAt = S.t + k*6; ac.fireV.push(v);
  }
  if (ac.fireV.length) log('coord', `Fire service: ${ac.fireV.length} tenders to standby positions by runway ${rwyName(R.id)} for ${ac.cs}.`, 'FIRE');
}
// the aircraft has stopped clear of the runway: the tenders close in, inspect it, then a tug comes to tow it in
function emgStopped(ac){
  ac.need = 'Fire service attending'; ac.emgSeq = { st: 'FIRE', t: S.t };
  const ex = exitWord(ac.exit || '');
  pilot(ac, `${ac.unit()}, ${spoken(ac.cs)}, we're stopping here on ${ex || 'the taxiway'}, request the fire service to check the aircraft over`);
  if (!ac.fireV || !ac.fireV.length) fireStandby(ac);
  (ac.fireV || []).forEach((v, k) => { const s = slotAt(ac, FIRE_SLOTS[k % 4]); v.job = { k: 'attend' }; driveTo(v, s.p, s.h, true); v.blues = true; });
  if (S.sel === ac && typeof renderSel === 'function') renderSel();
}
function stepFire(){
  for (const ac of S.acs) {
    if (ac.emerg && !ac.emerg.done && ac.emerg.k === 'MAYDAY' && !ac.fireV && (ac.emerg.ack || S.t - ac.emerg.t > 30)) fireStandby(ac);
    const E = ac.emgSeq;
    if (E && E.st === 'FIRE') {
      const there = (ac.fireV || []).filter(v => !v.gone && v.parked).length;
      if ((ac.fireV && ac.fireV.length && there === ac.fireV.filter(v => !v.gone).length) || S.t - E.t > 240) { E.st = 'INSP'; E.t = S.t; E.until = S.t + rnd(3, 5)*60; ac.need = 'Fire service inspecting'; }
    } else if (E && E.st === 'INSP' && S.t >= E.until) {
      const f = (ac.fireV || [])[0] || { cs: 'FIRE1', T: VTYPES.fire };
      vcall(f, `inspection of ${spoken(ac.cs)} complete, no fire, brakes cooling, the aircraft will need a tow to ${APT.standWord || 'stand'}`);
      E.st = 'TUG'; E.t = S.t; ac.need = 'Waiting for a tug';
      const s = slotAt(ac, 'tug'), v = dispatch('tug', s.p, s.h, { k: 'emgtug' }, true); if (v) { v.ac = ac; ac.emgTug = v; }
    } else if (E && E.st === 'TUG' && ((ac.emgTug && ac.emgTug.parked) || !ac.emgTug || S.t - E.t > 600)) {
      E.st = 'TOW';
      // the tow in: like a tug holding with an aircraft at a holding point, it asks to go on to the stand
      const st = ac.stand && (!ac.stand.occ || ac.stand.occ === ac) ? ac.stand : freeStand(ac);
      if (!st) { E.st = 'TUG'; E.t = S.t; continue; }
      st.occ = ac; ac.stand = st;
      let node = ac.vacNode; if (!node || node[0] === 'R') { const n = vgNear(acMid(ac), 300, N => !N.road); node = n ? n.slice(2) : null; }
      Object.assign(ac, { state: 'TOW', towWas: 'ONSTAND', towNode: node, towHold: exitWord(ac.exit || '') || 'its position', tow: { to: st, asked: true }, need: 'Request tow', emgStop: false, emgTow: true, path: null, gs: 0, doneAt: Infinity });
      log('plt', `${APT.tower[0]}, tug with ${ac.cs} on ${ac.towHold}, request tow to ${towDest(st)}`, 'TUG', ac);
      say(`${APT.tower[0]}, tug with ${spoken(ac.cs)}, request tow to ${towDest(st)}`, 'tug');
      if (S.sel === ac && typeof renderSel === 'function') renderSel();
    }
    // the tenders go home once the tow is under way (or the aircraft has gone)
    if (ac.fireV && ac.fireV.length && ((ac.state === 'TOW' && ac.path) || (ac.state === 'ONSTAND' && !ac.emgSeq) || (ac.emerg && ac.emerg.done && !ac.emgStop && !ac.emgSeq && ac.ground && ac.state !== 'VACATING' && ac.state !== 'ROLLOUT'))) {
      for (const v of ac.fireV) if (!v.gone) { v.urgent = false; v.blues = false; sendHome(v, rnd(5, 20)); }
      ac.fireV = []; if (ac.emgSeq && ac.state === 'TOW') ac.emgSeq = null;
    }
    // a medical: the ambulance to its stand, there before it is
    if (ac.medical && ac.stand && !ac.ambV && (ac.ground || finalDist(ac) < 12)) {
      const s = slotFrom(ac.stand.p, ac.stand.hdg || 0, ac.perf, 'amb'), v = dispatch('amb', s.p, s.h, { k: 'amb' }, true);
      if (v) { v.ac = ac; v.blues = true; ac.ambV = v; v.ambSt = ac.stand; }
    }
    const A = ac.ambV;
    if (A && !A.gone) {
      if (ac.stand && A.ambSt !== ac.stand && !A.home) { A.ambSt = ac.stand; const s = slotFrom(ac.stand.p, ac.stand.hdg || 0, ac.perf, 'amb'); driveTo(A, s.p, s.h, true); }
      if (A.visitUntil == null && ac.state === 'ONSTAND' && A.parked) { A.visitUntil = S.t + rnd(8, 12)*60; A.urgent = false; }
      if (A.visitUntil != null && A.parked && S.t >= A.visitUntil) { A.blues = false; A.visitUntil = null; ac.medical = false; sendHome(A, 0); }
    }
  }
  // gone (removed, or left): any vehicles with nothing left to do go home
  for (const v of VEH.list) if (v.ac && !S.acs.includes(v.ac) && !v.home && !v.attached) { v.ac = null; v.urgent = false; v.blues = false; sendHome(v, 5); }
}
// a medical: an ops car (Follow 1) waits by the landing runway, meets the aircraft as it vacates and leads it to its
// stand, the aircraft following at a brisker taxi than usual; the ambulance is waiting on the stand
function leadPoint(ac, d){
  const P = ac.path ? ac.path.pts : []; let from = [ac.x, ac.y], left = d;
  for (let i = 0; i < P.length; i++) {
    const L = dist(...from, ...P[i]);
    if (L >= left) { const k = left/L; return { p: [from[0] + (P[i][0] - from[0])*k, from[1] + (P[i][1] - from[1])*k], h: brg(...from, ...P[i]) }; }
    left -= L; from = P[i];
  }
  return P.length ? { p: P[P.length - 1].slice(), h: P.length > 1 ? brg(...P[P.length - 2], ...P[P.length - 1]) : bodyHdg(ac) } : null;
}
// where the car waits: on the aircraft's way from its exit to its stand, far enough past the holding point that the
// aircraft stops behind it (ex: the exit it took; otherwise the one it will most likely take)
function followWait(ac, ex){
  const st = ac.stand || freeStand(ac);
  if (!ex) {
    const prefs = (APT.vacPrefs(st, ac) || []).filter(e => HOLDS[e]);
    // as the crew picks it (vacatePath): the first exit it prefers that it can reach the stand from and still make at normal braking
    const ok = prefs.filter(e => !st || route(HOLDS[e].node, st.node, undefined, vacFace(e))), want = ok.length ? ok : prefs, P = vacPos(ac);
    // the roll-out brakes at 4.2 kt/s and the crew picks its exit at 40 kt (stepGround)
    const roll = P ? Math.max(0, P.v*P.v - 1600)/(2*4.2)*0.5144 : 0, makes = e => { const c = P && exitCheck(ac, e); return c && c.ahead > roll + 15 + stopDist(40, VAC_DEC); };
    ex = ac.reqExit && HOLDS[ac.reqExit] ? ac.reqExit : want.find(makes) || want[0];
  }
  if (!ex || !HOLDS[ex]) return null;
  const r = st && route(HOLDS[ex].node, st.node, undefined, vacFace(ex)), P = r && r.nodes.length > 1 ? r.nodes.map(n => GN[n].p) : [GN[HOLDS[ex].node].p];
  let left = (ac.perf.len + 90)*VM, from = P[0];
  for (let i = 1; i < P.length; i++) {
    const L = dist(...from, ...P[i]);
    if (L >= left) { const k = left/L; return { ex, key: ex + (st ? st.id : ''), p: [from[0] + (P[i][0] - from[0])*k, from[1] + (P[i][1] - from[1])*k], h: brg(...from, ...P[i]) }; }
    left -= L; from = P[i];
  }
  return { ex, key: ex + (st ? st.id : ''), p: from.slice(), h: P.length > 1 ? brg(...P[P.length - 2], ...from) : vacFace(ex) };
}
function followHome(ac, F){ F.attached = false; F.leading = false; F.ac = null; ac.followV = null; ac.following = false; F.urgent = false; sendHome(F, 5); }
function stepFollow(dt){
  for (const ac of S.acs) {
    if (ac.medical && ac.kind === 'ARR' && ac.airborne && !ac.followV && finalDist(ac) < 12) {
      const W = followWait(ac), v = W && dispatch('follow', W.p, W.h, { k: 'follow' }, true);
      if (v) { v.ac = ac; ac.followV = v; vehCs(v); v.waitKey = W.key; v.waitT0 = S.t; }
    }
    const F = ac.followV; if (!F || F.gone) continue;
    if (ac.state === 'ONSTAND' || ac.state === 'PARKED' || (ac.taxiIn && !ac.following)) { followHome(ac, F); continue; }   // in, or taxied in on its own
    // until it is led away: waiting where the aircraft will vacate (moved if the exit or the stand changes)
    if (!ac.following) {
      if (!F.leading && (!F.recheck || S.t - F.recheck > 3)) {
        F.recheck = S.t; const W = followWait(ac, ac.state === 'VACATING' ? ac.exit : null);
        if (W && W.key !== F.waitKey) { F.waitKey = W.key; F.attached = false; driveTo(F, W.p, W.h, true); }
      }
      continue;
    }
    if (!(ac.ground && ac.path && !ac.onRwy)) continue;
    const ahead = (ac.perf.len/2 + 45)*VM, L = leadPoint(ac, ahead + dist(ac.x, ac.y, ...acMid(ac))); if (!L) continue;
    const d = dist(F.x, F.y, ...L.p);
    if (F.leading || d < 25*VM) {
      if (!F.leading) { F.leading = true; vcall(F, `leading ${spoken(ac.cs)} to ${APT.standWord || 'stand'} ${ac.stand ? ac.stand.id : ''}`); }
      F.attached = true; F.pts = []; F.parked = false; F.v = ac.gs || 0;
      F.hdg = norm(F.hdg + clamp(angDiff(F.hdg, L.h), -40*dt, 40*dt)); F.x = L.p[0]; F.y = L.p[1];
    } else if (d < 1000*VM) {
      // not quite in front yet: it pulls round ahead of the nose
      F.attached = true; F.pts = []; F.parked = false; F.v = Math.min(30, (F.v || 0) + 4*dt);
      const want = brg(F.x, F.y, ...L.p), mv = Math.min(d, F.v*0.5144*dt*VM);
      F.hdg = norm(F.hdg + clamp(angDiff(F.hdg, want), -90*dt, 90*dt)); F.x += Math.sin(F.hdg*D2R)*mv; F.y += Math.cos(F.hdg*D2R)*mv;
    } else if (!F.chase || S.t - F.chase > 15) { F.attached = false; F.chase = S.t; driveTo(F, L.p, L.h, true); }
    // the aircraft waits for the car to be in front (creeping once it is close), then follows it in briskly;
    // if it hasn't come in three minutes the aircraft taxis in by itself
    if (!F.leading) { F.waitT = (F.waitT || 0) + dt; if (F.waitT > 180) { ac.path.spd = 15; followHome(ac, F); continue; } }
    ac.path.spd = F.leading ? 22 : d < 300*VM ? 8 : 0;
  }
  for (const v of VEH.list) if (v.type === 'follow' && v.ac && !S.acs.includes(v.ac)) { v.attached = false; v.leading = false; v.ac = null; sendHome(v, 5); }
}
// FOLLOW: the controller tells the aircraft to follow the car in (instead of a taxi route)
function followCmd(ac){
  const F = ac.followV, sw = APT.standWord || 'stand';
  if (!F || F.gone) return { err: `${ac.cs} has no follow-me car. Give it a taxi route instead.` };
  if (ac.state !== 'VACATING' || ac.onRwy) return { err: `${ac.cs} has to vacate the runway first.` };
  if (ac.taxiIn) return { err: `${ac.cs} is already taxiing.` };
  if (!ac.stand) return { err: `${ac.cs} has no ${sw} yet. Assign one first (${ac.cs} STAND).` };
  ac.following = true; const vw = taxiIn(ac, ac.stand, []);
  if (!vw) { ac.following = false; return { err: `No taxi route to ${sw} ${ac.stand.id}.` }; }
  ac.need = null; F.waitT = 0;
  return { said: `follow the follow-me car to ${sw} ${ac.stand.id}`, read: `following the car to ${sw} ${ac.stand.id}` };
}
S.listeners.push((ev, ac) => {
  if (ev === 'emergency' && ac && ac.emerg && /medical/.test(ac.emerg.why)) ac.medical = true;
  if (ev === 'start') { S.rc = null; S.rcNext = null; }
});

// ── the strip board: a radio vehicle waiting for you (Ops 1 at the holding point) gets its own strip
function vehSig(){ const C = S.rc; return (C ? C.st + (C.v.need || '') : '') + vehAsking().map(v => v.cs + v.req.k).join(); }
// a vehicle asking to drive a taxiway or cross a runway
function reqStrip(v, doc){
  const X = v.req, d = doc.createElement('div'); d.className = 'strip VEH need';
  const what = X.k === 'rwy' ? `Cross ${rwN(X.R)}` : `Via ${X.tws.join(' ')}`;
  d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs"></span><span class="ty"></span></span><span class="c-b"><span class="rte"></span><span class="lv"></span></span><span class="c-c"><span class="stt"></span><span class="fq">${X.k === 'rwy' ? 'TWR' : 'GND'}</span></span>`;
  d.querySelector('.cs').textContent = radioName(v).toUpperCase(); d.querySelector('.ty').textContent = v.T.name;
  d.querySelector('.rte').textContent = what; d.querySelector('.lv').textContent = X.k === 'rwy' ? (X.tw ? 'On ' + X.tw : 'Holding short') : 'To ' + vehDest(v).replace(/^the /, '');
  d.querySelector('.stt').textContent = '◆ ' + (X.k === 'rwy' ? 'Wants to cross' : 'Wants taxiway');
  const acts = doc.createElement('span'); acts.className = 'vacts';
  const bt = (label, cmd, cls) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); command(cmd); renderStrips(true); }; acts.append(b); };
  bt(X.k === 'rwy' ? 'Cross' : 'Approve', v.cs + ' GO', 'go'); bt('Hold', v.cs + ' HOLD');
  d.append(acts);
  d.onclick = () => { V.cx = v.x; V.cy = v.y; V.scale = Math.max(V.scale, (Math.min(W, H) || 600)/(900*M2NM)); };
  return d;
}
function vehStrips(doc = document){
  const C = S.rc, out = vehAsking().map(v => reqStrip(v, doc)); if (!C) return out;
  const d = doc.createElement('div'); d.className = `strip VEH${C.v.need ? ' need' : ''}`;
  const st = C.st === 'OUT' ? `To ${C.hp.replace(/~\d+$/, '')}` : C.st === 'READY' ? `Hold ${C.hp.replace(/~\d+$/, '')}` : C.st === 'ON' ? `On ${C.rw}` : 'Vacating';
  d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs">OPS 1</span><span class="ty">Runway inspection</span></span><span class="c-b"><span class="rte">${esc(C.rw)}</span><span class="lv">${esc(st)}</span></span><span class="c-c"><span class="stt"></span><span class="fq">TWR</span></span>`;
  d.querySelector('.stt').textContent = C.v.need ? '◆ ' + C.v.need : C.st === 'ON' ? 'Runway occupied' : C.st === 'OFF' ? 'Vacating' : 'Driving';
  const acts = doc.createElement('span'); acts.className = 'vacts';
  const bt = (label, cmd, cls) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); command(cmd); renderStrips(true); }; acts.append(b); };
  if (C.st === 'READY') { bt('Enter runway', 'OPS1 ENTER', 'go'); bt('Hold', 'OPS1 HOLD'); }
  if (C.st === 'ON') bt('Vacate', 'OPS1 VACATE', 'danger');
  if (C.st === 'OUT' || C.st === 'READY') bt('Cancel', 'OPS1 CANCEL');
  d.append(acts);
  d.onclick = () => { V.cx = C.v.x; V.cy = C.v.y; V.scale = Math.max(V.scale, (Math.min(W, H) || 600)/(900*M2NM)); };
  return [d, ...out];
}
// the weather panel's runway line: send Ops 1 to inspect the runway, or see where it is
function rcPanel(){
  if (!VG_BUILT && !S.running) return '';
  const C = S.rc;
  const st = !C ? 'Runway inspection: Ops 1 at base' : C.st === 'OUT' ? `Ops 1 driving to ${C.hp.replace(/~\d+$/, '')} for a ${C.why}` : C.st === 'READY' ? `Ops 1 at ${C.hp.replace(/~\d+$/, '')}, requesting to enter ${C.rw}` : C.st === 'ON' ? `Ops 1 on runway ${C.rw}: runway occupied` : 'Ops 1 vacating';
  const b = !C ? '<button data-rc="OPS1 CHECK">Runway check</button>' : C.st === 'READY' ? '<button data-rc="OPS1 ENTER" class="go">Enter runway</button>' : C.st === 'ON' ? '<button data-rc="OPS1 VACATE" class="danger">Vacate</button>' : '';
  return `<div class="rcline${C && C.st === 'ON' ? ' on' : ''}${C && C.st === 'READY' ? ' ask' : ''}"><span>${esc(st)}</span>${b}</div>`
    + `<div class="rcline"><span>Vehicles on taxiways: ${VEH.autoTwy ? 'go without asking' : 'ask you first'}</span><button data-rc="VEHICLES ${VEH.autoTwy ? 'ASK' : 'AUTO'}">${VEH.autoTwy ? 'Make them ask' : 'Approve automatically'}</button></div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rc]'); if (b) { command(b.dataset.rc); renderAtis(); renderStrips(true); } });
