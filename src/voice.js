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
// replaces the plain speaker: accent by airline, steadier controller, slight per-crew pitch and pace
say = function(text, who){
  if (!S.voice) return;
  if (who === 'atc' && S.fromVoice) return;   // you said it yourself
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/FL(\d+)/g, (m,a) => 'flight level '+a.split('').map(d=>DIG[d]).join(' ')));
    const v = voiceFor(who); if (v) { u.voice = v; u.lang = v.lang; }
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
  for (const id of Object.keys(WP)) { const d = editDist(id, u); if (d < bd) { bd = d; best = id; } }
  return bd <= 2 ? best : null;
}
const sideOf = w => w.includes('east') ? 'E' : w.includes('west') ? 'W' : '';
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
  if (/ approach /.test(s) && !/ (contact|monitor) /.test(s)) out.push('APP' + ((m = s.match(/ runway (09|27|9) /)) ? ' ' + (m[1] === '9' ? '09' : m[1]) : ''));
  if (/ cleared to land /.test(s)) out.push('CTL');
  if (/ goaround /.test(s)) out.push('GA');
  if (/ hold position /.test(s) || / stop immediately /.test(s)) out.push('HP');
  else if ((m = s.match(/ hold( at| over)? (\S+) /)) && !/ holding point /.test(s)) { const f = fixFrom(m[2]); out.push(f ? 'HOLD ' + f : 'HOLD'); }
  if (/ (continue taxi|resume taxi|continue taxiing) /.test(s)) out.push('RES');
  if (/ (pushback|startup)/.test(s)) { const f = sideOf(s); out.push('PUSH' + (f ? ' ' + f : '')); }
  if ((m = s.match(/ taxi .*?holding point (\S+)/)) || (m = s.match(/ taxi (to )?(\S+)/))) {
    const hp = PHONW[m[m.length-1]] || (m[m.length-1].length === 1 ? m[m.length-1].toUpperCase() : null);
    if (hp && 'ACDE'.includes(hp)) {
      let cmd = 'TAXI ' + hp; const v = s.match(/ via (.+?)( hold| holding| cross| $)/);
      if (v) { const vl = v[1].split(' ').map(x => PHONW[x]).filter(x => x && 'ABCDE'.includes(x)); if (vl.length) cmd += ' VIA ' + vl.join(' '); }
      out.push(cmd);
    }
  }
  if (/ tow approved /.test(s) || / approved tow /.test(s)) out.push('TOW');
  if (/ lineup /.test(s)) out.push('LU');
  if (/ cleared( for)? takeoff /.test(s)) out.push('CTO');
  if (/ vacate /.test(s)) out.push('VAC');
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
function setHeard(t, cls){ if (!heard) return; heard.textContent = t; heard.className = 'heard' + (cls ? ' ' + cls : ''); heard.hidden = !t; }
function micBlocked(msg){
  sys(msg); ptt.disabled = true; ptt.title = msg; ptt.classList.remove('on');
}
function startTalk(){
  if (!SR || talking || ptt.disabled) return;
  try { speechSynthesis.cancel(); } catch(_) {}
  rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
  finalText = ''; talking = true; ptt.classList.add('on'); setHeard('Listening…');
  rec.onresult = e => {
    let interim = ''; finalText = '';
    for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; }
    setHeard((finalText + interim).trim() || 'Listening…');
  };
  rec.onerror = e => {
    talking = false; ptt.classList.remove('on');
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') micBlocked('The microphone is blocked here. Spoken commands work when the simulator is opened in its own browser tab with microphone access; typed commands and pilot voices still work.');
    else if (e.error !== 'no-speech' && e.error !== 'aborted') sys(`Speech recognition: ${e.error}.`);
  };
  rec.onend = () => { talking = false; ptt.classList.remove('on'); handleHeard(finalText.trim() || (heard && heard.textContent !== 'Listening…' ? heard.textContent : '')); };
  try { rec.start(); } catch(e) { talking = false; ptt.classList.remove('on'); }
}
function stopTalk(){ if (rec && talking) try { rec.stop(); } catch(_) {} }
function handleHeard(text){
  if (!text) { setHeard(''); return; }
  const { ac, cmd } = phraseToCmd(text);
  const target = ac || S.sel;
  if (!cmd) { setHeard(`“${text}” · not understood`, 'bad'); log('sys', `Heard “${text}” but found no instruction in it. Say again using standard phraseology.`); return; }
  if (!target) { setHeard(`“${text}” · no callsign`, 'bad'); sys('Start with the callsign, or select a flight first.'); return; }
  setHeard(`“${text}” → ${target.cs} ${cmd}`, 'ok');
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
const LIVE_SRC = ['metar.txt', 'https://metar.vatsim.net/LXGB', 'https://aviationweather.gov/api/data/metar?ids=LXGB&format=raw&hours=3'];
const liveBox = $('liveWx'), liveSt = $('liveWxSt');
let liveTimer = null, liveLast = '', liveFailed = false;
function liveStatus(t, cls){ liveSt.hidden = !t; liveSt.textContent = t; liveSt.className = 'fine' + (cls ? ' ' + cls : ''); }
async function fetchMetar(){
  for (const url of LIVE_SRC) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { signal: ctl.signal, cache: 'no-store' }); clearTimeout(to);
      if (!r.ok) continue;
      const line = (await r.text()).split('\n').map(x => x.trim()).find(x => /^(METAR |SPECI )?LXGB \d{6}Z/.test(x));
      if (line) return line.replace(/^(METAR|SPECI) /, '').replace(/=$/, '');
    } catch(e) {}
  }
  return null;
}
function applyLiveMetar(raw){
  $('wxPaste').value = raw;
  if (!S.running) return;
  S.wx = parseMetar(raw);
  const c27 = windComp(S.wx, CRS27), c09 = windComp(S.wx, CRS09), fav = c09.head > c27.head + 2 ? '09' : '27';
  nextAtis(); sys(`Live METAR: ${S.wx.raw}. Information ${phonetic(S.atis)} is now current.`);
  if (fav !== S.rwy) sys(`Wind now favours runway ${fav}.`);
  if (!sraMinsOk(S.wx)) sys('Weather is below SRA minima (5 km, 1000 ft).', true);
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
  liveStatus('Fetching the current LXGB METAR…'); pollLive(); liveTimer = setInterval(pollLive, 10*60*1000);
}
// the Weather menu's "Live weather" choice and the Live METAR switch are the same setting
const wxMenu = $('wxPreset');
liveBox.onchange = () => {
  setLive(liveBox.checked);
  if (liveBox.checked) { wxMenu.value = 'live'; if (liveLast) $('wxPaste').value = liveLast; }
  else { if (wxMenu.value === 'live') wxMenu.value = 'fair'; if ($('wxPaste').value.trim() === liveLast) $('wxPaste').value = ''; }
};
wxMenu.addEventListener('change', () => {
  const on = wxMenu.value === 'live';
  if (on !== liveBox.checked) { liveBox.checked = on; liveBox.onchange(); }
});
$('trafficSel').addEventListener('change', () => { if (/^live/.test($('trafficSel').value) && wxMenu.value !== 'live') { wxMenu.value = 'live'; liveBox.checked = true; liveBox.onchange(); } });
try { if (localStorage.getItem('cw-livewx')) { liveBox.checked = true; setLive(true); wxMenu.value = 'live'; } } catch(_) {}
