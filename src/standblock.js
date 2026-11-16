// ═════════════════════════ a stand blocked in: the aircraft in the way move first ═════════════════════════
// At some stands the way off the stand (the push back, then the taxilane out of the apron) passes stands where other
// aircraft park: Sydney's domestic cul-de-sacs off DOM4, stands tucked behind others, a lane that only works when the
// stand on it is empty. An aircraft there can't push back (or taxi out) until the ones in its way have moved.
// • the way out: the push (or the drive-out line), then the first 300 m of its taxi route to its holding point
// • in the way: an aircraft parked (or under tow) whose body or wings that path would run into
// • a blocker that is itself about to leave (its crew calls within 10 minutes, or is calling) goes first; the one
//   behind waits for it
// • anything else (an arrival on its turnaround, a departure not due for a while) is towed out of the way to the
//   nearest free stand that doesn't block the way too, and towed back to its own stand once the way is clear (if it
//   is still free, else it stays where it is). The tug asks for each tow as any tow; you approve it with TOW (the AI
//   Ground does it itself), about ten minutes before the blocked aircraft is due off
// • PUSH (or TAXI off a drive-out stand) for a blocked aircraft is refused, saying who is in the way and what to do;
//   the AI Ground waits for the way to clear
const BLK_AHEAD = 300;   // metres of the taxi route out that must be clear
const BLK_SOON = 10*60;  // a blocker due off within this goes first rather than being towed
// the centre line of the way off the stand: the push (or the drive-out line), then the start of the taxi route
function blkWay(ac, face){
  const st = ac.stand; if (!st || !st.p) return null;
  let pts, start, h;
  const dO = typeof driveOut === 'function' && driveOut(ac);
  if (dO) { pts = [st.p, ...dO.pts]; start = dO.node; h = dO.face; }
  else {
    face = face || ac.face || pushFace(ac);
    let pp; try { pp = pushPath(ac, face); } catch (e) { return null; } if (!pp || !pp.length) return null;
    pts = [st.p, ...pp]; start = st.node;
    const e = pp[pp.length - 1], n = GN[st.node].p, b = brg(...e, ...n); h = brg(...(pp.length > 1 ? pp[pp.length - 2] : st.p), ...e); h = (h + 180) % 360;   // the nose, after a push, points back the way it came
    h = dist(...e, ...n) > 10/1852 && Math.abs(angDiff(h, b)) < 90 ? b : h;
  }
  let r = null; try { const H = HOLDS[depHold(ac)]; if (H) r = route(start, H.node, undefined, h); } catch (e) {}
  if (r) { let L = 0, last = pts[pts.length - 1];
    for (const id of r.nodes) { const q = GN[id].p, d = dist(...last, ...q)/M2NM; if (d < 0.5) continue;
      if (L + d > BLK_AHEAD) { pts.push(add(last, brg(...last, ...q), (BLK_AHEAD - L)*M2NM)); break; }
      pts.push(q); L += d; last = q; } }
  return pts;
}
// does a path of this aircraft run into what's parked on stand s (o: the aircraft there)?
function blkHit(pts, ac, s, o){
  const [n, t, wl, wr] = footprint(s, o);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    // through its body (the centre line within 6 m of its fuselage) or its wings (within 4 m of the line between its
    // wingtips). Passing behind a parked aircraft's tail, as on any apron lane, is not in the way: the stands' drawn
    // positions are a few metres out, so anything looser would stop the pushes along every ordinary lane too.
    if (segSegM(a, b, n, t) < 6 || segSegM(a, b, wl, wr) < 4) return true;
  }
  return false;
}
// the aircraft in the way of this one leaving its stand (none: [])
function blkBlockers(ac, face){
  if (!ac.stand || ac.stand.area === 'hangar') return [];
  const pts = blkWay(ac, face); if (!pts) return [];
  const out = [];
  for (const o of S.acs) {
    if (o === ac || !o.ground || !o.stand || o.stand === ac.stand) continue;
    const parked = (o.state === 'PARKED' || o.state === 'ONSTAND') && !o.leftStand && dist(o.x, o.y, ...o.stand.p) < 15*M2NM;
    if (!parked) continue;
    if (blkHit(pts, ac, o.stand, o)) out.push(o);
  }
  return out;
}
const blkSoon = o => o.kind === 'DEP' && o.state === 'PARKED' && (o.need === 'Request start-up' || (o.reqAt != null && o.reqAt - S.t < BLK_SOON)) && !o.slotHold && !o.slotCancelled;
// a free stand near the blocker to tow it to: big enough, not itself in the way, not wanted by an arrival
function blkSpot(o, way, ac){
  const fits = s => !s.occ && s.p && s.area !== 'hangar' && standFree(s, o) && !(s.waitBy) && !blkHit(way, ac, s, o) && s.area !== 'south';
  const c = STANDS.filter(fits).sort((a, b) => dist(...a.p, ...o.stand.p) - dist(...b.p, ...o.stand.p)).slice(0, 6)
    .map(s => [s, towLen(o.stand.node, s.node)]).filter(([, L]) => L < 2.5).sort((a, b) => a[1] - b[1]);
  return c.length ? c[0][0] : null;
}
// each 15 s: the departures due off in the next ten minutes that are blocked in have their blockers moved
function blkStep(){
  if (!S.running || Math.floor(S.t) % 15 !== 0 || BLK.t === Math.floor(S.t)) return;
  BLK.t = Math.floor(S.t);
  // towed out of the way: back again once the one it let out has gone (its stand still free; if not, it stays)
  for (const o of S.acs) {
    const B = o.blkTow; if (!B || !(o.state === 'PARKED' || o.state === 'ONSTAND') || o.need) continue;
    if (!o.stand || o.stand.id === B.home) { if (B.out) o.blkTow = null; continue; }   // not moved yet, or home again
    B.out = true;
    const a = S.acs.find(x => x.cs === B.for), gone = !a || a.leftStand || a.airborne || !a.stand || a.stand.id !== B.forStand;
    if (!gone) continue;
    const home = STANDS.find(s => s.id === B.home);
    const homeFree = home && (!home.occ || home.occ === o) && !(home.waitBy && home.waitBy !== o) && standRoom(home, o);   // (towed next door, it reads as taken by itself)
    if (!homeFree || (o.kind === 'DEP' && o.state === 'PARKED' && (o.need || o.reqAt - S.t < 8*60))) { o.blkTow = null; continue; }   // taken meanwhile, or nearly due off: it stays
    o.blkTow = null; o.tow = { at: S.t, pref: home.id, only: true, then: null }; towCall(o, home);
  }
  for (const ac of S.acs) {
    if (ac.kind !== 'DEP' || ac.state !== 'PARKED' || !ac.stand || ac.slotCancelled) continue;
    const due = ac.need === 'Request start-up' || ac.reqAt - S.t < BLK_SOON; if (!due) continue;
    const bl = blkBlockers(ac); if (!bl.length) { ac.blkBy = null; continue; }
    ac.blkBy = bl.map(o => o.cs);
    const way = blkWay(ac);
    for (const o of bl) {
      if (o.blkTow || o.state === 'TOW' || (o.tow && o.tow.asked) || o.need === 'Request tow') continue;   // already being moved
      if (blkSoon(o) && !(ac.need === 'Request start-up' && o.reqAt - S.t > 3*60 && o.need !== 'Request start-up')) continue;   // it goes first (unless it would keep this one waiting long)
      const to = blkSpot(o, way, ac); if (!to) continue;
      o.blkTow = { for: ac.cs, forStand: ac.stand.id, home: o.stand.id };
      o.tow = { at: S.t, pref: to.id, only: true, then: null };
      towCall(o, to);
      sys(`${o.cs} on ${APT.standWord || 'stand'} ${o.stand.id} is in the way of ${ac.cs} leaving ${APT.standWord || 'stand'} ${ac.stand.id}: the tug asks to tow it to ${towDest(to)} and back after.`);
    }
  }
}
const BLK = { t: -1 };
// PUSH (or TAXI off a drive-out stand): not while something is parked in the way
function blkPushCheck(ac, face){
  const bl = blkBlockers(ac, face); if (!bl.length) return null;
  const sw = APT.standWord || 'stand', o = bl[0];
  const what = o.need === 'Request tow' ? `approve the tug's tow of ${o.cs} out of the way (${o.cs} TOW)` : blkSoon(o) ? `${o.need === 'Request start-up' ? 'push' : 'it is due off within ten minutes: push'} ${o.cs} first` : `the tug will ask to tow ${o.cs} clear as soon as there is a free ${sw} to put it on`;
  return `${ac.cs} can't ${driveOut(ac) ? 'taxi out' : 'push back'} yet: ${bl.map(x => `${x.cs} on ${sw} ${x.stand.id}`).join(' and ')} ${bl.length > 1 ? 'are' : 'is'} in the way. ${what[0].toUpperCase() + what.slice(1)}.`;
}
// the AI Ground: a blocked aircraft waits (its blockers are moved by blkStep)
const blkWait = ac => !!(ac.stand && ac.state === 'PARKED' && blkBlockers(ac).length);
S.listeners.push(ev => { if (ev === 'start') BLK.t = -1; });
window.__blk = { way: blkWay, blockers: blkBlockers, hit: blkHit };
