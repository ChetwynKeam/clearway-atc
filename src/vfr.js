// ═════════════════════════ VFR traffic: zone transits and helicopters ═════════════════════════
// Light aircraft and helicopters call up wanting to cross the control zone (Session › Failures and VFR traffic).
// They wait outside the zone, orbiting, until you clear them; the transit takes them across the final approach,
// so time it into a gap:
//   G-ABCD CROSS    cleared to transit, not above the level they asked for
//   G-ABCD HOLD     orbit where they are (outside the zone, or wherever they have got to)
//   G-ABCD SVFR     a special VFR clearance: needed instead of CROSS when the visibility is under 5 km or the cloud
//                   base under 1,500 ft
// The air ambulance (HEMS) is a priority: holding it more than two minutes costs points. Anything VFR that comes
// within 1 NM and 500 ft of an arrival or departure is an airprox (−40). Left unanswered for three minutes, a crew
// routes round the zone instead (−3). With Approach on AI, the AI clears them when final is clear.
const VFR = { list: [], next: 0, n: 0 };
const VFR_TYPES = [
  { t: 'C172', who: 'light aircraft', spd: 95, alt: 1500, reg: true },
  { t: 'PA28', who: 'light aircraft', spd: 100, alt: 2000, reg: true },
  { t: 'EC35', who: 'police helicopter', spd: 110, alt: 1000, cs: 'UKP', heli: true },
  { t: 'EC35', who: 'air ambulance', spd: 120, alt: 1000, cs: 'HLE', heli: true, hems: true },
  { t: 'AS50', who: 'helicopter', spd: 105, alt: 1200, reg: true, heli: true }
];
const regLetters = () => 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('').sort(() => Math.random() - 0.5).slice(0, 4).join('');
function vfrSpawn(){
  const T = VFR_TYPES[Math.floor(Math.random()*VFR_TYPES.length)];
  const cs = T.reg ? `G-${regLetters()}` : `${T.cs}${Math.floor(rnd(10, 99))}`, id = cs.replace('-', '');
  const R = RADAR_REF, b = rnd(0, 360)*D2R, b2 = b + Math.PI + rnd(-0.6, 0.6), r = 11;
  const from = [R[0] + Math.sin(b)*r, R[1] + Math.cos(b)*r], to = [R[0] + Math.sin(b2)*(r + 3), R[1] + Math.cos(b2)*(r + 3)];
  const compass = a => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((a/D2R) % 360 + 360) % 360/45) % 8];
  const v = { id, cs, ...T, x: from[0], y: from[1], hdg: 0, to, wait: [...from], st: 'CALL', t0: S.t, alt0: T.alt, asked: compass(b), dest: compass(b2) };
  v.hdg = brg(v.x, v.y, ...R);
  VFR.list.push(v);
  const svfr = S.wx.vis < 5000 || S.wx.ceil < 1500;
  v.call = `${APT.radar[0]}, ${v.cs}, ${v.hems ? 'HEMS priority, ' : ''}${/^[AEIOU]/.test(v.t) ? 'an' : 'a'} ${v.t}, ${v.who}, ${v.asked} of the zone, request ${svfr ? 'special VFR ' : ''}zone transit to the ${v.dest}, not above ${v.alt.toLocaleString('en-GB')} feet`;
  vfrSay(v, v.call);
  // it rings on the coordination board too, with the answers on it (its own three-minute wait applies, not the board's)
  if (vfrMine() && typeof cbAdd === 'function') v.cb = cbAdd({ from: `${v.cs} (VFR, ${v.who})`, text: v.call, free: true, opts: [
    { label: svfr ? 'Special VFR: cleared to cross' : 'Cleared to cross', do: () => vfrCommand([v.id, svfr ? 'SVFR' : 'CROSS']) },
    { label: 'Orbit, I\'ll call you back', do: () => vfrCommand([v.id, 'HOLD']) }] });
}
function vfrSay(v, text){ log('plt', text, v.cs, null, !vfrMine()); if (vfrMine()) setTimeout(() => say(text, v.cs), 300); }
const vfrMine = () => S.seats && S.seats.APP !== 'AI';
function vfrCommand(toks){
  const id = toks[0] && toks[0].replace('-', ''), v = VFR.list.find(x => x.id === id && x.st !== 'GONE'); if (!v) return false;
  const c = toks[1], svfr = S.wx.vis < 5000 || S.wx.ceil < 1500;
  if (c === 'CROSS' || c === 'SVFR') {
    if (svfr && c !== 'SVFR') { sys(`${v.cs}: the weather is below VFR minima in the zone, it needs a special VFR clearance (SVFR).`, true); return true; }
    v.st = 'TRANSIT'; v.clrT = S.t;
    log('atc', `${v.cs}, ${c === 'SVFR' ? 'cleared special VFR' : 'cleared'} zone transit to the ${v.dest}, not above ${v.alt.toLocaleString('en-GB')} feet${svfr ? ', report field in sight' : ''}`, 'RADAR');
    vfrSay(v, `cleared ${c === 'SVFR' ? 'special VFR ' : ''}zone transit, not above ${v.alt.toLocaleString('en-GB')} feet, ${v.cs}`);
    return true;
  }
  if (c === 'HOLD') {
    v.st = 'ORBIT'; v.wait = [v.x, v.y];
    log('atc', `${v.cs}, orbit present position, I'll call you back`, 'RADAR'); vfrSay(v, `orbiting, ${v.cs}`); return true;
  }
  sys(`${v.cs} is VFR: CROSS, HOLD or SVFR.`); return true;
}
function vfrStep(dt){
  if (!S.running || S.t < 1) return;   // (not before the session's own settings are read)
  const rate = { off: 0, some: 30*60, often: 12*60 }[EQ.level] || 0;
  if (rate && !VFR.next) VFR.next = S.t + rate*rnd(0.3, 0.8);
  if (rate && S.t >= VFR.next) { VFR.next = S.t + rate*rnd(0.7, 1.3); if (VFR.list.filter(v => v.st !== 'GONE').length < 2) vfrSpawn(); }
  const R = RADAR_REF;
  for (const v of VFR.list) {
    if (v.st === 'GONE') continue;
    const sp = v.spd/3600*dt;
    if (v.st === 'CALL' || v.st === 'ORBIT') {   // orbiting where it waits, a mile across
      v.hdg = norm(v.hdg + (v.heli ? 4 : 3)*dt); v.x += Math.sin(v.hdg*D2R)*sp; v.y += Math.cos(v.hdg*D2R)*sp;
      if (v.st === 'CALL' && v.hems && !v.hemsLate && S.t - v.t0 > 120 && vfrMine()) { v.hemsLate = true; S.score.pts -= 10; sys(`${v.cs} is an air ambulance on a priority flight: it has been kept waiting more than two minutes (−10).`, true); }
      if (v.st === 'CALL' && S.t - v.t0 > 180) { v.st = 'GONE'; vfrSay(v, `we'll route round the zone, ${v.cs}`); if (vfrMine()) { S.score.pts -= 3; sys(`${v.cs} gave up waiting and went round the zone (−3).`); } }
      if (v.st === 'ORBIT' && S.t - (v.orbT ??= S.t) > 600) { v.st = 'TRANSIT'; vfrSay(v, `resuming the transit, ${v.cs}`); }
      // an AI Approach clears it once nothing is on final or close in
      if (!vfrMine() && v.st === 'CALL' && S.t - v.t0 > 40 && !S.acs.some(a => a.airborne && a.state !== 'PRE' && dist(a.x, a.y, ...R) < 10 && a.alt < 4000)) { v.st = 'TRANSIT'; log('atc', `${v.cs}, cleared zone transit, not above ${v.alt} feet`, 'AI APP', null, true); }
    } else if (v.st === 'TRANSIT') {
      const tgt = v.to, h = brg(v.x, v.y, ...tgt); v.hdg = norm(v.hdg + clamp(angDiff(v.hdg, h), -4*dt, 4*dt));
      v.x += Math.sin(v.hdg*D2R)*sp; v.y += Math.cos(v.hdg*D2R)*sp;
      if (dist(v.x, v.y, ...tgt) < 0.5) { v.st = 'GONE'; vfrSay(v, `leaving the zone to the ${v.dest}, ${v.cs}`); }
    }
    // airprox: within 1 NM and 500 ft of an arrival or departure
    for (const a of S.acs) {
      if (a.ground || a.state === 'PRE' || v.prox === a.cs) continue;
      if (dist(a.x, a.y, v.x, v.y) < 1 && Math.abs(a.alt - v.alt) < 500) {
        v.prox = a.cs; const sc = vfrMine() ? S.score : S.aiScore; sc.incidents++; sc.pts -= 40;
        if (vfrMine()) sys(`Airprox: ${v.cs} (VFR, ${v.alt} ft) and ${a.cs} (${Math.round(a.alt)} ft), ${dist(a.x, a.y, v.x, v.y).toFixed(1)} NM apart (−40). Hold VFR traffic clear of the final approach until there is a gap.`, true);
        emit('airprox', { v, a });
      }
    }
  }
  VFR.list = VFR.list.filter(v => v.st !== 'GONE' || S.t - v.t0 < 1800);
}
function drawVfr(){
  if (!S.running || (typeof EQ !== 'undefined' && EQ.on && EQ.on.k === 'radar')) return;
  cx.save(); cx.font = `11px ${typeof FONT_L !== 'undefined' ? FONT_L : 'monospace'}`;
  for (const v of VFR.list) {
    if (v.st === 'GONE') continue;
    const X = sx(v.x), Y = sy(v.y), col = v.st === 'CALL' ? '#f0a020' : '#c7a6ff';
    cx.strokeStyle = cx.fillStyle = col; cx.lineWidth = 1.5;
    if (v.heli) { cx.beginPath(); cx.arc(X, Y, 5, 0, 7); cx.stroke(); cx.beginPath(); cx.moveTo(X - 7, Y); cx.lineTo(X + 7, Y); cx.stroke(); }
    else { cx.beginPath(); cx.moveTo(X, Y - 5); cx.lineTo(X + 5, Y); cx.lineTo(X, Y + 5); cx.lineTo(X - 5, Y); cx.closePath(); cx.stroke(); }
    cx.fillText(`${v.cs} ${String(Math.round(v.alt/100)).padStart(3, '0')} VFR${v.st === 'CALL' ? ' ?' : v.st === 'ORBIT' ? ' ⟳' : ''}`, X + 8, Y - 6);
  }
  cx.restore();
}
// a strip for each VFR flight: what it wants, where it is, and the answers as buttons (tap the strip to see it on the map)
function vfrStrips(doc = document){
  return VFR.list.filter(v => v.st !== 'GONE').map(v => {
    const d = doc.createElement('div'); d.className = `strip VEH${v.st === 'CALL' ? ' need' : ''}`;
    const svfr = S.wx.vis < 5000 || S.wx.ceil < 1500, R = RADAR_REF, nm = Math.round(dist(v.x, v.y, ...R));
    d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs"></span><span class="ty"></span></span><span class="c-b"><span class="rte"></span><span class="lv"></span></span><span class="c-c"><span class="stt"></span></span>`;
    d.querySelector('.cs').textContent = v.cs; d.querySelector('.ty').textContent = `${v.t} · ${v.who}`;
    d.querySelector('.rte').textContent = `${v.asked} → ${v.dest}`; d.querySelector('.lv').textContent = `${nm} NM · ≤${v.alt} ft`;
    d.querySelector('.stt').textContent = v.st === 'CALL' ? `◆ Zone transit${v.hems ? ' (HEMS priority)' : ''}` : v.st === 'ORBIT' ? 'Orbiting' : 'Crossing';
    if (v.st !== 'TRANSIT') {
      const acts = doc.createElement('span'); acts.className = 'vacts';
      const bt = (label, c, cls) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); vfrCommand([v.id, c]); if (v.cb && v.cb.st === 'RING') { v.cb.st = 'DONE'; v.cb.ans = label; cbRender(); } renderStrips(true); }; acts.append(b); };
      bt(svfr ? 'Special VFR' : 'Cross', svfr ? 'SVFR' : 'CROSS', 'go'); if (v.st === 'CALL') bt('Orbit', 'HOLD');
      d.append(acts);
    }
    d.onclick = () => { V.cx = v.x; V.cy = v.y; V.scale = Math.min(V.scale, (Math.min(W, H) || 600)/30); };
    return d;
  });
}
S.listeners.push(ev => { if (ev === 'start') { VFR.list = []; VFR.next = 0; } });
