// ═════════════════════════ voice: spoken commands and accented pilots ═════════════════════════
// Speech in: the browser's speech recogniser hears standard phraseology ("Speedbird four niner two, turn left heading
// two five zero, descend altitude four thousand feet") and turns it into the same commands the command bar takes.
// Speech out: each airline's crews speak with a matching voice, so a Royal Air Maroc crew sounds different from a British one.

// ── accents: preferred voice languages per operator (first available wins; a hash picks among several) ──
const ACCENTS = {
  BAW: ['en-GB', 'en-GB', 'en-IE', 'en-ZA'], EZY: ['en-GB', 'en-IE', 'en-AU', 'en-GB'], RRR: ['en-GB'], EXS: ['en-GB', 'en-IE'],
  TOM: ['en-GB', 'en-AU'], VJT: ['en-US', 'de-DE', 'en-GB'], EJU: ['de-AT', 'de-DE', 'de-CH', 'fr-FR', 'it-IT'],
  RAM: ['fr-FR', 'ar-MA', 'ar-SA', 'fr-CA'], NJE: ['pt-PT', 'pt-BR', 'es-ES'], SWN: ['de-CH', 'de-DE', 'sv-SE'],
  IBE: ['es-ES'], VLG: ['es-ES'], RYR: ['en-IE'], G: ['en-GB']
};
let allVoices = [];
function loadAllVoices(){ try { allVoices = speechSynthesis.getVoices(); } catch(e) { allVoices = []; } }
try { speechSynthesis.addEventListener('voiceschanged', loadAllVoices); loadAllVoices(); } catch(e) {}
const voiceCache = {};
function voiceFor(who){
  if (voiceCache[who] !== undefined) return voiceCache[who];
  if (!allVoices.length) loadAllVoices();
  const langs = who === 'atc' ? ['en-GB'] : ACCENTS[who.slice(0,3)] || ACCENTS[who[0]] || ['en-GB', 'en-US'];
  const h = hash(who), order = [...langs.slice(h % langs.length), ...langs];
  let v = null;
  for (const l of order) {
    const m = allVoices.filter(x => x.lang.replace('_','-').toLowerCase() === l.toLowerCase());
    if (m.length) { v = m[h % m.length]; break; }
    const p = allVoices.filter(x => x.lang.toLowerCase().startsWith(l.slice(0,2).toLowerCase()));
    if (p.length) { v = p[h % p.length]; break; }
  }
  v = v || allVoices.find(x => /^en/i.test(x.lang)) || null;
  if (allVoices.length) voiceCache[who] = v;
  return v;
}
// a voice for another language reads digits and letters in that language ("treinta y seis" for 36), so for those the
// text is written out in English words first: the crew keeps its accent and still speaks English
const EN_DIG = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const digWords = s => s.split('').map(d => EN_DIG[d]).join(' ');
function inEnglish(t){
  return t.replace(/\b(\d{2})([LRC])\b/g, (m, n, s) => digWords(n) + ' ' + { L: 'left', R: 'right', C: 'centre' }[s])
    .replace(/\b(\d{1,2}),?(\d)00\b/g, (m, a, b) => digWords(a) + ' thousand' + (+b ? ' ' + EN_DIG[b] + ' hundred' : ''))
    .replace(/\b(\d)00 (feet|ft)\b/g, (m, a, f) => EN_DIG[a] + ' hundred ' + f)
    .replace(/(\d)\.(\d)/g, '$1 decimal $2')
    .replace(/\d+/g, digWords)
    .replace(/\bQNH\b/g, 'Q N H').replace(/\bILS\b/g, 'I L S').replace(/\bSID\b/g, 'sid');
}
const isEnglishVoice = v => !v || /^en/i.test(v.lang);
// replaces the plain speaker: accent by airline, steadier controller, slight per-crew pitch and pace
say = function(text, who){
  if (!S.voice) return;
  // you are the controller: your own transmissions stay written in the radio log but are never read aloud,
  // only pilots, tugs and other stations are heard
  if (who === 'atc') return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/FL(\d+)/g, (m,a) => 'flight level '+a.split('').map(d=>DIG[d]).join(' ')));
    const v = voiceFor(who); if (v) { u.voice = v; u.lang = v.lang; if (!isEnglishVoice(v)) u.text = inEnglish(u.text); }
    u.rate = who === 'atc' ? 1.1 : 1.05 + (hash(who) % 20)/100; u.pitch = who === 'atc' ? 1 : 0.85 + (hash(who+'p') % 30)/100;
    if (!/^tel:/.test(who) && typeof radioFx === 'function') { u.onstart = () => radioFx('open'); u.onend = () => radioFx('close'); }   // landline calls have no squelch
    speechSynthesis.speak(u);
  } catch(e) {}
};

// ── phraseology → command ──
const NUMW = { zero:0, one:1, two:2, three:3, tree:3, four:4, fower:4, five:5, fife:5, six:6, seven:7, eight:8, nine:9, niner:9 };
const PHONW = { alpha:'A', alfa:'A', bravo:'B', charlie:'C', delta:'D', echo:'E', foxtrot:'F', golf:'G', hotel:'H', india:'I', juliet:'J', juliett:'J', kilo:'K', lima:'L', mike:'M', november:'N', oscar:'O', papa:'P', quebec:'Q', romeo:'R', sierra:'S', tango:'T', uniform:'U', victor:'V', whiskey:'W', whisky:'W', xray:'X', 'x-ray':'X', yankee:'Y', zulu:'Z' };
function normSpeech(raw){
  let s = ' ' + raw.toLowerCase().replace(/[,.;:!?]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ') + ' ';
  s = s.replace(/ x ray /g, ' xray ').replace(/ take off /g, ' takeoff ').replace(/ line up /g, ' lineup ').replace(/ push back /g, ' pushback ')
       .replace(/ start up /g, ' startup ').replace(/ go around /g, ' goaround ').replace(/ flight level /g, ' fl ').replace(/ royal air maroc /g, ' royalairmaroc ')
       .replace(/ swiss ambulance /g, ' swissambulance ').replace(/ feet | ft /g, ' ').replace(/ degrees /g, ' ').replace(/ knots /g, ' ');
  // "4,000" / "4000" stay digits; "four thousand", "one zero thousand", "three hundred"
  const w = s.trim().split(' '), out = [];
  for (let i = 0; i < w.length; i++) {
    const t = w[i];
    if (NUMW[t] !== undefined) { let d = ''; while (i < w.length && NUMW[w[i]] !== undefined) d += NUMW[w[i++]]; i--; out.push(d); continue; }
    if (t === 'thousand' && out.length && /^\d+$/.test(out[out.length-1])) { out[out.length-1] = String(+out[out.length-1]*1000); continue; }
    if (t === 'hundred' && out.length && /^\d+$/.test(out[out.length-1])) { const v = +out[out.length-1]; if (v >= 1000) { out[out.length-1] = String(v); } else out[out.length-1] = String(v*100); continue; }
    out.push(t);
  }
  // merge "4000" + "500" (four thousand five hundred)
  for (let i = 1; i < out.length; i++) if (/^\d+000$/.test(out[i-1]) && /^\d00$/.test(out[i])) { out[i-1] = String(+out[i-1] + +out[i]); out.splice(i--, 1); }
  return out;
}
function editDist(a, b){
  const m = a.length, n = b.length, d = Array.from({ length: m+1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return d[m][n];
}
const TELW = Object.fromEntries(Object.entries(TEL).map(([k, v]) => [v.toLowerCase().replace(/\s+/g, ''), k]));
// find the callsign at the start of the words; returns [aircraft, words used]
function heardCallsign(w){
  let best = null;
  for (let n = 1; n <= Math.min(7, w.length); n++) {
    let key = '', i = 0;
    const head = w[0], tel = TELW[head] || Object.entries(TELW).find(([k]) => editDist(k, head) <= Math.max(1, Math.floor(k.length/4)))?.[1];
    if (tel) { key = tel; i = 1; }
    for (; i < n; i++) { const t = w[i]; if (/^\d+$/.test(t)) key += t; else if (PHONW[t]) key += PHONW[t]; else if (t.length === 1) key += t.toUpperCase(); else { key = null; break; } }
    if (!key) continue;
    key = key.toUpperCase();
    const ac = S.acs.find(a => a.cs === key) || (key.length >= 3 && /\d/.test(key) && !tel ? S.acs.find(a => a.cs.endsWith(key)) : null)
      || (tel ? S.acs.find(a => a.cs.startsWith(tel) && a.cs.endsWith(key.slice(tel.length)) && key.length > tel.length) : null);
    if (ac) best = [ac, n];
  }
  return best;
}
function fixFrom(word){
  if (!word) return null; const u = word.toUpperCase();
  if (WP[u]) return u;
  let best = null, bd = 9;
  for (const id of Object.keys(WP)) { if (WP[id].hide) continue; const d = editDist(id, u); if (d < bd) { bd = d; best = id; } }
  return bd <= 2 ? best : null;
}
const sideOf = w => w.includes('east') ? 'E' : w.includes('west') ? 'W' : '';
// "runway two two left" -> 22L, "runway zero niner" -> 09, matched against the airport's runway ends
function heardRwy(s, re = / runway (\d{1,2})( left| right| center)? /){
  const m = s.match(re); if (!m) return null;
  const r = String(+m[1]) + (m[2] ? m[2].trim()[0].toUpperCase() : '');
  return RW_ENDS.find(e => e === r || e === r.padStart(2, '0') || e === m[1] + (m[2] ? m[2].trim()[0].toUpperCase() : '')) || null;
}
// a spoken stand or gate ("five", "bravo two three", "five dash one four"): its id, if the airport has it
function heardStand(t){
  const parts = t.split(/ (?:via|hold) /)[0].trim().split(' ').filter(x => !/^(dash|hyphen)$/.test(x)).slice(0, 3).map(x => /^\d+$/.test(x) ? x : PHONW[x] || (x.length === 1 ? x.toUpperCase() : ''));
  return [parts.join(''), parts.join('-')].find(c => STANDS.some(x => x.id.toUpperCase() === c)) || null;
}
function phraseToCmd(raw){
  let w = normSpeech(raw);
  const hit = heardCallsign(w);
  let ac = null; if (hit) { ac = hit[0]; w = w.slice(hit[1]); }
  const s = ' ' + w.join(' ') + ' ', out = [];
  const num = (re) => { const m = s.match(re); return m ? m[1] : null; };
  let m;
  if ((m = s.match(/ (turn )?(left|right) (heading )?(\d{1,3}) /))) out.push((m[2] === 'left' ? 'L' : 'R') + m[4]);
  else if ((m = s.match(/ (fly |continue )?heading (\d{1,3}) /))) out.push('H' + m[2]);
  if ((m = s.match(/ (climb|descend)( and maintain| to)?( altitude)? (fl ?)?(\d{2,5}) /))) out.push('A' + (m[4] ? m[5] : m[5]));
  else if ((m = s.match(/ (maintain|altitude) (fl ?)?(\d{2,5}) /))) out.push('A' + m[3]);
  if (/ (no speed restriction|resume normal speed) /.test(s)) out.push('SN');
  else if ((m = s.match(/ speed (\d{2,3}) /))) out.push('S' + m[1]);
  if ((m = s.match(/ direct( to)? (\S+) /))) { const f = fixFrom(m[2]); if (f) out.push('DCT ' + f); }
  if (/ approach /.test(s) && !/ (contact|monitor) /.test(s)) { const r = heardRwy(s); out.push('APP' + (r ? ' ' + r : '')); }
  if (APT.rnp && out.length && out[out.length-1].startsWith('APP') && / (rnp|r n p|rmp) /.test(s)) out[out.length-1] += / (yankee|yankees|y) /.test(s) ? ' RNPY' : / (zulu|z) /.test(s) ? ' RNPZ' : ' RNP';
  if (/ cleared to land /.test(s)) out.push('CTL');
  if (/ goaround /.test(s)) out.push('GA');
  if (/ hold position /.test(s) || / stop immediately /.test(s)) out.push('HP');
  else if ((m = s.match(/ hold( at| over)? (\S+) /)) && !/ holding point /.test(s)) { const f = fixFrom(m[2]); out.push(f ? 'HOLD ' + f : 'HOLD'); }
  if (/ (continue taxi|resume taxi|continue taxiing) /.test(s)) out.push('RES');
  if (/ (pull (forward|back)|tow (it )?back) /.test(s)) out.push('PULL');
  else if (/ (pushback|startup)/.test(s)) { const f = sideOf(s); out.push('PUSH' + (f ? ' ' + f : '')); }
  // "taxi to holding point tango 3": an intermediate holding point (or, for an arrival, any holding point)
  const hpm = s.match(/ taxi .*?holding point (\S+)(?: (\d{1,2}))? /), hpId = hpm && ((PHONW[hpm[1]] || (hpm[1].length === 1 ? hpm[1].toUpperCase() : '')) + (hpm[2] || ''));
  const toHold = hpId && (IHPS[hpId] && !HOLDS[hpId] || (ac && ac.kind === 'ARR' && holdPt(hpId))) ? hpId : null;
  // an arrival given its stand without a taxi clearance: "stand 5", "gate bravo two three"
  if (ac && ac.kind === 'ARR' && !/ taxi /.test(s) && (m = s.match(/ (?:stand|gate) (.*)/))) { const id = heardStand(m[1]); if (id) out.push('STAND ' + id); }
  if (toHold) out.push('TAXI ' + toHold);
  // an arrival clear of the runway: "taxi to stand 5", "taxi to gate bravo two three via kilo"
  else if (ac && ac.kind === 'ARR' && / taxi /.test(s)) {
    let cmd = 'TAXI'; const g = s.match(/ (?:stand|gate) (.*)/);
    if (g) { const id = heardStand(g[1]); if (id) cmd += ' ' + id; }
    const v = s.match(/ via (.+?)( hold| $)/);
    if (v) { const vl = []; let solo = false; for (const x of v[1].split(' ')) { if (LINE_WORDS[x.toUpperCase()]) { vl.push(x.toUpperCase()); solo = false; continue; } const l = PHONW[x]; if (!l) continue; if (solo && PHON[vl[vl.length-1] + l]) { vl[vl.length-1] += l; solo = false; } else { vl.push(l); solo = true; } }
      const vv = vl.filter(x => PHON[x] || LINE_WORDS[x]); if (vv.length) cmd += ' VIA ' + vv.join(' '); }
    out.push(cmd);
  } else if ((m = s.match(/ taxi .*?holding point (\S+)/)) || (m = s.match(/ taxi (to )?(\S+)/))) {
    const hp = PHONW[m[m.length-1]] || (m[m.length-1].length === 1 ? m[m.length-1].toUpperCase() : null);
    if ((hp && HOLDS[hp]) || (!hp && / runway /.test(s) && RW_ENDS.length > 2)) {
      let cmd = 'TAXI' + (hp && HOLDS[hp] ? ' ' + hp : ''); const v = s.match(/ via (.+?)( hold| holding| cross| $)/);
      // two spoken letters make one taxiway where the airport has it (New York: "kilo delta" is KD); "centre", "blue" or
  // "orange" after a taxiway picks its line (Manchester: "via zulu centre line")
      if (v) { const vl = []; let solo = false; for (const x of v[1].split(' ')) { if (LINE_WORDS[x.toUpperCase()]) { vl.push(x.toUpperCase()); solo = false; continue; } const l = PHONW[x]; if (!l) continue; if (solo && PHON[vl[vl.length-1] + l]) { vl[vl.length-1] += l; solo = false; } else { vl.push(l); solo = true; } }
        const vv = vl.filter(x => PHON[x] || LINE_WORDS[x]); if (vv.length) cmd += ' VIA ' + vv.join(' '); }
      out.push(cmd);
    }
  }
  if (/ tow approved /.test(s) || / approved tow /.test(s)) out.push('TOW');
  if (/ lineup /.test(s)) out.push('LU');
  if (/ cross runway /.test(s)) { const r = heardRwy(s, / cross runway (\d{1,2})( left| right| center)? /); out.push('CROSS' + (r ? ' ' + r : '')); }
  if (/ cleared( for)? takeoff /.test(s)) out.push('CTO');
  // "vacate via bravo 2" / "foxtrot romeo": the exit named after it
  if ((m = s.match(/ vacate (?:(?:via|at|using|the|by) )*(.*)$/))) { const w = m[1].trim().split(' '); let ex = '', k = 0;
    while (k < 2 && k < w.length && PHONW[w[k]]) ex += PHONW[w[k++]];
    if (ex && /^\d{1,2}$/.test(w[k] || '')) ex += w[k];
    out.push('VAC' + (ex ? ' ' + ex : '')); }
  if ((m = s.match(/ (contact|monitor) .*?(1\d\d)( decimal | point | )(\d{1,3}) /))) out.push(`HO ${m[2]}.${m[4]}`);
  else if (/ (contact|monitor) /.test(s)) out.push('HO');
  if (/ (request|requesting) release /.test(s) || / release /.test(s) && !/ released /.test(s)) out.push('REL');
  if (/ (squawk )?ident /.test(s)) out.push('IDENT');
  if (/ roger (mayday|pan)/.test(s)) out.push('ROG');
  if (/ windshear /.test(s)) out.push('WS');
  return { ac, cmd: out.join(' ') };
}

// ── push-to-talk ──
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const ptt = $('tgTalk'), heard = $('heard');
let rec = null, talking = false, finalText = '';
// what you are saying appears in the command box as it is recognised
const cmdBox = $('cmd');
function liveCmd(t){ if (!cmdBox) return; cmdBox.classList.toggle('listening', !!t); cmdBox.value = t || ''; }
function setHeard(t, cls){ if (!heard) return; heard.textContent = t; heard.className = 'heard' + (cls ? ' ' + cls : ''); heard.hidden = !t; }
function micBlocked(msg){
  sys(msg); ptt.disabled = true; ptt.title = msg; ptt.classList.remove('on');
}
function startTalk(){
  if (!SR || talking || ptt.disabled) return;
  try { speechSynthesis.cancel(); } catch(_) {}
  rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
  finalText = ''; talking = true; ptt.classList.add('on'); setHeard('Listening…'); liveCmd('Listening…'); S.voiceAt = Date.now();
  rec.onresult = e => {
    let interim = ''; finalText = '';
    for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
    setHeard((finalText + interim).trim() || 'Listening…');
    liveCmd((finalText + interim).trim() || 'Listening…');
  };
  rec.onerror = e => {
    talking = false; ptt.classList.remove('on'); liveCmd('');
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micBlocked('The microphone is blocked here. Spoken commands work when the simulator is opened in its own browser tab with microphone access; typed commands and pilot voices still work.');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') sys(`Speech recognition: ${e.error}.`);
  };
  rec.onend = () => { talking = false; ptt.classList.remove('on'); handleHeard(finalText.trim() || (heard && heard.textContent !== 'Listening…' ? heard.textContent : '')); };
  try { rec.start(); } catch(e) { talking = false; ptt.classList.remove('on'); }
}
function stopTalk(){ if (rec && talking) try { rec.stop(); } catch(_) {} }
function handleHeard(text){
  liveCmd('');
  if (!text) { setHeard(''); return; }
  S.voiceAt = Date.now();
  const { ac, cmd } = phraseToCmd(text);
  const target = ac || S.sel;
  if (!cmd) { setHeard(`“${text}” · not understood`, 'bad'); log('sys', `Heard “${text}” but found no instruction in it. Say again using standard phraseology.`); return; }
  if (!target) { setHeard(`“${text}” · no callsign`, 'bad'); sys('Start with the callsign, or select a flight first.'); return; }
  setHeard(`“${text}” → ${target.cs} ${cmd}`, 'ok');
  liveCmd(`${target.cs} ${cmd}`); setTimeout(() => { if (cmdBox && cmdBox.classList.contains('listening') && !talking) liveCmd(''); }, 3000);
  S.fromVoice = true; try { command(`${target.cs} ${cmd}`); } finally { S.fromVoice = false; }
  setTimeout(() => setHeard(''), 6000);
}
if (!SR) { ptt.disabled = true; ptt.title = 'This browser has no speech recognition. Chrome, Edge and Safari support spoken commands.'; }
ptt.addEventListener('pointerdown', e => { e.preventDefault(); startTalk(); });
ptt.addEventListener('pointerup', stopTalk); ptt.addEventListener('pointerleave', stopTalk); ptt.addEventListener('pointercancel', stopTalk);
// hold T to talk (when not typing)
document.addEventListener('keydown', e => { if (document.body.dataset.route !== 'sim' || e.repeat) return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === 't' || e.key === 'T') { e.preventDefault(); startTalk(); } });
document.addEventListener('keyup', e => { if (e.key === 't' || e.key === 'T') stopTalk(); });
window.__phrase = phraseToCmd;

// ═════════════════════════ live METAR ═════════════════════════
// Pulls the current LXGB report from the NOAA Aviation Weather Center when the page is allowed to reach it, then refreshes
// every 10 minutes. A new report mid-session is applied like a weather update: new ATIS letter, runway advice.
// Sources in order: metar.txt beside the page (kept current by a scheduled job in the site's repo, so no cross-site
// request is needed), then VATSIM's METAR service, then the Aviation Weather Center.
const LIVE_SRC = ['metar.txt', `https://metar.vatsim.net/${APT.icao}`, `https://aviationweather.gov/api/data/metar?ids=${APT.icao}&format=raw&hours=3`];
const liveBox = $('liveWx'), liveSt = $('liveWxSt');
let liveTimer = null, liveLast = '', liveFailed = false;
function liveStatus(t, cls){ liveSt.hidden = !t; liveSt.textContent = t; liveSt.className = 'fine' + (cls ? ' ' + cls : ''); }
async function fetchMetar(){
  for (const url of LIVE_SRC) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { signal: ctl.signal, cache: 'no-store' }); clearTimeout(to);
      if (!r.ok) continue;
      const line = (await r.text()).split('\n').map(x => x.trim()).find(x => new RegExp(`^(METAR |SPECI )?${APT.icao} \\d{6}Z`).test(x));
      if (line) return line.replace(/^(METAR|SPECI) /, '').replace(/=$/, '');
    } catch(e) {}
  }
  return null;
}
function applyLiveMetar(raw){
  $('wxPaste').value = raw;
  if (!S.running) return;
  S.wx = parseMetar(raw);
  const cHi = windComp(S.wx, CRS_HI), cLo = windComp(S.wx, CRS_LO), fav = APT.rwyFor ? APT.rwyFor(S.wx).land : cLo.head > cHi.head + 2 ? RW_LO : RW_HI;
  nextAtis(); sys(`Live METAR: ${S.wx.raw}. Information ${phonetic(S.atis)} is now current.`);
  if (fav !== S.rwy) sys(`Wind now favours runway ${fav}.`);
  if (!APT.minsOk(S.wx, S.rwy)) sys(APT.minsLong + (APT.rnp && APT.rnpMinsOk(S.wx, S.rwy) ? ' The RNP approach is still available.' : ''), true);
  renderAtis();
}
async function pollLive(){
  const m = await fetchMetar();
  if (!m) {
    liveStatus('Could not reach the live METAR feed from this page. The claude.ai viewer blocks outside connections; it works when the simulator runs on its own web address. Paste the METAR below meanwhile.', 'bad');
    if (!liveFailed && S.running) sys('Live METAR unavailable here: the page cannot reach the weather feed. Keeping the current weather.', true);
    liveFailed = true; return;
  }
  liveFailed = false;
  const z = new Date().toISOString().substr(11,5);
  liveStatus(`Live · ${m} · checked ${z}Z`, 'ok');
  if (m !== liveLast) { liveLast = m; applyLiveMetar(m); }
}
function setLive(on){
  clearInterval(liveTimer); liveTimer = null;
  try { localStorage.setItem('cw-livewx', on ? '1' : ''); } catch(_) {}
  if (!on) { liveStatus(''); return; }
  liveStatus(`Fetching the current ${APT.icao} METAR…`); pollLive(); liveTimer = setInterval(pollLive, 10*60*1000);
}
// the Weather menu's "Live weather" choice and the Live METAR switch are the same setting
const wxMenu = $('wxPreset');
liveBox.onchange = () => {
  setLive(liveBox.checked);
  if (liveBox.checked) { wxMenu.value = 'live'; if (liveLast) $('wxPaste').value = liveLast; }
  else { if (wxMenu.value === 'live') wxMenu.value = APT.defWx; if ($('wxPaste').value.trim() === liveLast) $('wxPaste').value = ''; }
};
wxMenu.addEventListener('change', () => {
  const on = wxMenu.value === 'live';
  if (on !== liveBox.checked) { liveBox.checked = on; liveBox.onchange(); }
});
$('trafficSel').addEventListener('change', () => { if (/^live/.test($('trafficSel').value) && wxMenu.value !== 'live') { wxMenu.value = 'live'; liveBox.checked = true; liveBox.onchange(); } });
try { if (localStorage.getItem('cw-livewx')) { liveBox.checked = true; setLive(true); wxMenu.value = 'live'; } } catch(_) {}
