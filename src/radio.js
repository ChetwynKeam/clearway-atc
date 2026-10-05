// ═════════════════════════ radio realism ═════════════════════════
// Squelch clicks and band-limited hiss around each transmission, a heterodyne squeal when two stations transmit at
// once, and the written ATIS broadcast. Sounds play only with Voice on, and only after the user has clicked something.
let actx = null;
function audio(){
  if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function noiseBuf(a){
  if (a._nb) return a._nb;
  const n = Math.floor(a.sampleRate*1.6), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random()*2 - 1;
  return a._nb = b;
}
function radioFx(kind){
  if (!S.voice) return;
  const a = audio(); if (!a) return;
  try {
    const t = a.currentTime, out = a.createGain(); out.gain.value = 0.16; out.connect(a.destination);
    // hiss: noise through a narrow "radio" band
    const src = a.createBufferSource(); src.buffer = noiseBuf(a);
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.9;
    const g = a.createGain(); src.connect(bp); bp.connect(g); g.connect(out);
    const dur = kind === 'close' ? 0.22 : kind === 'blocked' ? 1.5 : 0.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(kind === 'close' ? 0.9 : 0.55, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.start(t); src.stop(t + dur + 0.05);
    // key-up / key-down click
    const o = a.createOscillator(), og = a.createGain(); o.type = 'square'; o.frequency.value = kind === 'close' ? 820 : 1350;
    og.gain.setValueAtTime(0.22, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.03); o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.04);
    if (kind === 'blocked') {   // two carriers beating against each other
      for (const [f, w] of [[1020, 'sawtooth'], [1061, 'sawtooth'], [530, 'square']]) {
        const h = a.createOscillator(), hg = a.createGain(); h.type = w; h.frequency.setValueAtTime(f, t); h.frequency.linearRampToValueAtTime(f*1.04, t + 1.3);
        hg.gain.setValueAtTime(0.0001, t); hg.gain.linearRampToValueAtTime(0.07, t + 0.05); hg.gain.setValueAtTime(0.07, t + 1.2); hg.gain.exponentialRampToValueAtTime(0.001, t + 1.45);
        h.connect(hg); hg.connect(out); h.start(t); h.stop(t + 1.5);
      }
    }
  } catch(e) {}
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (S.voice) audio(); }, { once: true, capture: true }));

// ── written ATIS ──
const cloudWords = c => { const m = /^(FEW|SCT|BKN|OVC)(\d{3})(CB|TCU)?/.exec(c); if (!m) return c; return `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast' }[m[1]]} ${(+m[2]*100).toLocaleString('en-GB')} feet${m[3] === 'CB' ? ' cumulonimbus' : m[3] === 'TCU' ? ' towering cumulus' : ''}`; };
function atisText(){
  const w = S.wx, L = phonetic(S.atis), E = S.emg;
  const wind = w.vrb ? `variable ${w.spd} knots` : `${hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ' gusting ' + w.gust + ' knots' : ''}`;
  const vis = w.vis >= 9999 ? '10 kilometres or more' : w.vis >= 5000 ? `${Math.round(w.vis/1000)} kilometres` : `${w.vis} metres`;
  const cloud = w.raw.includes('CAVOK') ? 'CAVOK' : w.clouds.length ? 'cloud ' + w.clouds.map(cloudWords).join(', ') : 'no significant cloud';
  if (APT.atisLines) return APT.atisLines({ w, L, E, wind, vis, cloud: cloud[0].toUpperCase() + cloud.slice(1) });
  const out = [
    `This is Gibraltar information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
    `Runway in use ${S.rwy}. Expect surveillance radar approach runway ${S.rwy}, terminating at Point ${FINAL[S.rwy].name}.`,
    `Surface wind ${wind}. Visibility ${vis}. ${cloud[0].toUpperCase() + cloud.slice(1)}.`,
    `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level flight level 70.`
  ];
  if (turbExcess(w) > 0) out.push(`Warning: surface wind exceeds the Special Procedures turbulence limit. Expect moderate to severe turbulence and windshear on final${S.rwy === '09' ? ' in the lee of the Rock' : ''}.`);
  if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
  if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
  if (!sraMinsOk(w)) out.push('Weather below SRA minima.');
  out.push('Winston Churchill Avenue is closed to traffic for all runway movements.');
  out.push('Departures: release from Sevilla or Casablanca is required before take-off.');
  out.push(`Acknowledge receipt of information ${L} and advise aircraft type on first contact.`);
  return out;
}
const atisPop = document.createElement('div'); atisPop.className = 'atis-pop'; atisPop.hidden = true; atisPop.setAttribute('role', 'dialog'); atisPop.setAttribute('aria-label', 'ATIS broadcast'); document.body.appendChild(atisPop);
function openAtis(){
  const lines = atisText();
  atisPop.innerHTML = `<div class="atis-card"><div class="row"><span class="lbl">ATIS broadcast · ${APT.atisFreq}</span><span class="atis-letter">${S.atis}</span><span class="grow"></span><button class="pop-x" aria-label="Close">×</button></div>
    <p class="atis-body">${lines.map(esc).join(' ')}</p>
    <div class="row"><button class="btn" data-a="play">Broadcast it</button><button class="btn" data-a="stop">Stop</button><span class="grow"></span><span class="lbl dimmer">${esc(S.wx.raw)}</span></div></div>`;
  atisPop.hidden = false;
  atisPop.querySelector('.pop-x').onclick = closeAtis;
  atisPop.querySelector('[data-a=play]').onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(lines.join(' ').replace(/FL(\d+)|flight level (\d+)/g, (m, a, b) => 'flight level ' + (a || b).split('').map(d => DIG[d]).join(' '))); u.rate = 1.0; const v = typeof voiceFor === 'function' ? voiceFor('atis') : null; if (v) { u.voice = v; u.lang = v.lang; } speechSynthesis.speak(u); } catch(e) {} };
  atisPop.querySelector('[data-a=stop]').onclick = () => { try { speechSynthesis.cancel(); } catch(e) {} };
}
function closeAtis(){ atisPop.hidden = true; try { speechSynthesis.cancel(); } catch(e) {} }
atisPop.addEventListener('click', e => { if (e.target === atisPop) closeAtis(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !atisPop.hidden) closeAtis(); });
