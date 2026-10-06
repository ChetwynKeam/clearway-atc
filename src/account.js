// ═════════════════════════ accounts: plans, sign-in, airport access, feedback, airport requests ═════════════════════════
// CW_CFG comes from subs.json via build.py. With enabled: false every airport stays open (the preview) and nothing is sold.
// Sign-in is Supabase email codes (or the magic link); plans, payments and the airport check go through the Clearway API
// (api/account.js on Vercel). The check runs in the browser, so it keeps honest players honest rather than locking the code.
// Private test switch: ?cwtest=on turns accounts on in this browser only (for trying Stripe test payments), ?cwtest=off undoes it
const CW_TEST = (() => { if (CW_CFG.test_switch === false) return false; try {
  const q = (location.search.match(/[?&]cwtest=(on|off)/) || [])[1];
  if (q === 'on') localStorage.setItem('cw-test', '1'); else if (q === 'off') localStorage.removeItem('cw-test');
  return !CW_CFG.enabled && localStorage.getItem('cw-test') === '1'; } catch(e) { return false; } })();
const CW_ON = !!((CW_CFG.enabled || CW_TEST) && CW_CFG.supabase_url && CW_CFG.supabase_anon_key && CW_CFG.api);
const CW_FB = !!(CW_CFG.feedback && CW_CFG.api);
const CW_PLANS = [
  { k: 'a1', n: 1, name: 'Alpha', p: 'One airport of your choice' },
  { k: 'a3', n: 3, name: 'Bravo', p: 'Three airports of your choice', hot: true },
  { k: 'a5', n: 5, name: 'Charlie', p: 'Five airports of your choice' },
  { k: 'a10', n: 10, name: 'Delta', p: 'Ten airports of your choice' },
  { k: 'all', n: 0, name: 'Echo', p: 'Every airport, including new ones as they open, with Foxtrot early access included' },
];
const cwPrice = k => CW_CFG.currency + (+CW_CFG.prices[k]).toFixed(2);
// a launch offer (subs.json "offer"): percent off the first N months, applied in Stripe by the STRIPE_COUPON coupon
const CW_OFF = CW_CFG.offer && +CW_CFG.offer.percent > 0 ? CW_CFG.offer : null;
const cwOffer = k => CW_CFG.currency + (Math.round(CW_CFG.prices[k]*(100 - CW_OFF.percent))/100).toFixed(2);
const cwOfferTerm = () => CW_OFF.months ? `for your first ${CW_OFF.months} month${CW_OFF.months > 1 ? 's' : ''}` : 'for as long as you subscribe';
const CW = { ses: null, ent: null, loading: false, want: null };
const cwLS = { get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } },
  set(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} } };
CW.ses = cwLS.get('cw-session');
// the magic link brings the player back with #access_token=...; keep the session and show the account page
(() => {
  const h = location.hash;
  if (!/^#(access_token|error)=/.test(h) || !CW_ON) return;
  const p = new URLSearchParams(h.slice(1));
  if (p.get('access_token')) cwKeep({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600 });
  else CW.signErr = p.get('error_description') || 'That sign-in link has expired. Ask for a new code.';
  history.replaceState(null, '', location.pathname + location.search + '#account');
})();
function cwKeep(s){
  const email = (() => { try { return JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email; } catch(e) { return ''; } })();
  CW.ses = { at: s.access_token, rt: s.refresh_token, exp: Date.now()/1000 + (s.expires_in || 3600), email: (s.user && s.user.email) || email };
  cwLS.set('cw-session', CW.ses);
}
async function cwAuth(path, body){
  const res = await fetch(CW_CFG.supabase_url.replace(/\/$/, '') + '/auth/v1/' + path, { method: 'POST',
    headers: { apikey: CW_CFG.supabase_anon_key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.msg || j.error_description || j.message || 'Sign-in failed. Please try again.');
  return j;
}
async function cwToken(){
  if (!CW.ses) return null;
  if (CW.ses.exp - 60 < Date.now()/1000) {
    try { cwKeep(await cwAuth('token?grant_type=refresh_token', { refresh_token: CW.ses.rt })); }
    catch(e) { cwSignOut(); return null; }
  }
  return CW.ses.at;
}
async function cwApi(path, body){
  const t = await cwToken();
  // text/plain keeps anonymous posts a "simple" request (no CORS preflight); the server reads the JSON either way
  let res;
  try { res = await fetch(CW_CFG.api.replace(/\/$/, '') + '/' + path, { method: body ? 'POST' : 'GET',
    headers: { ...(t ? { authorization: 'Bearer ' + t } : {}), ...(body ? { 'content-type': 'text/plain;charset=UTF-8' } : {}) }, body: body ? JSON.stringify(body) : undefined }); }
  catch(e) {
    // a short code tells us why without the browser console: does a plain request get through when this one did not?
    const plain = await fetch(CW_CFG.api.replace(/\/$/, '') + '/feedback?requests').then(r => 'P' + r.status, x => 'PX').catch(() => 'PX');
    throw new Error(`Clearway’s server could not be reached. Check your connection, or allow this site in any ad or tracker blocker, and try again. (Code ${t ? 'A' : 'N'}${body ? 'W' : 'R'}-${plain}: ${e && e.message || e})`);
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error || 'Something went wrong. Please try again.'); e.status = res.status; throw e; }
  return j;
}
function cwSignOut(){ CW.ses = null; CW.ent = null; cwLS.set('cw-session', null); cwLS.set('cw-ent', null); cwRefreshUI(); }
// the player's plan: cached for 10 minutes, and for up to 3 days if the API cannot be reached
async function cwLoad(force){
  if (!CW_ON || !CW.ses) { CW.ent = null; return null; }
  const c = cwLS.get('cw-ent');
  if (!force && c && c.email === CW.ses.email && Date.now() - c.at < 10*60e3) { CW.ent = c.ent; return CW.ent; }
  CW.loading = true;
  try { CW.ent = await cwApi('account'); cwLS.set('cw-ent', { at: Date.now(), email: CW.ses.email, ent: CW.ent }); }
  catch(e) {
    if (e.status === 401) cwSignOut();
    else if (c && c.email === CW.ses.email && Date.now() - c.at < 3*864e5) CW.ent = c.ent;
  } finally { CW.loading = false; }
  return CW.ent;
}
const cwStatusOf = icao => (AIRPORTS_NET.find(a => a.icao === icao) || {}).status || 'live';
function cwCanPlay(icao){
  if (!CW_ON) return true;
  const e = CW.ent; if (!e) return false;
  if (e.owner) return true;   // the site owner opens every airport, in development too
  if ((e.owned || []).includes(icao)) return true;   // a commissioned airport is the player's whatever their plan
  if (!e.active) return false;
  if (cwStatusOf(icao) === 'dev') return !!e.early;
  return e.airports === '*' || e.airports.includes(icao);
}
// airports in development that this player may preview: the owner, and Foxtrot (early access) members
const cwPreview = () => !!(CW_ON && CW.ent && (CW.ent.owner || (CW.ent.active && CW.ent.early)));
// called by start(): opening a position needs a plan that includes this airport
function cwGate(){ if (cwCanPlay(APT.icao)) return true; cwPaywall(); return false; }
const cwHost = h => (IS_HOST ? '' : SITE[SITE_HOST]) + '#' + h;
const cwDate = s => s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '';

// ── the paywall over the console ──
function cwPaywall(){
  if (!CW_ON || EMBED) return;
  let el = $('cwPay');
  if (!el) { el = document.createElement('div'); el.className = 'overlay cw-pay'; el.id = 'cwPay'; $('setup').parentNode.appendChild(el); }
  if (cwCanPlay(APT.icao)) { el.hidden = true; return; }
  el.hidden = false;
  const e = CW.ent, name = APT.name, trial = CW_CFG.trial_days, dev = cwStatusOf(APT.icao) === 'dev';
  let h = '', btns = '';
  if (CW.ses && !e && CW.loading) { h = `<h1>${esc(name)}</h1><p>Checking your plan…</p>`; }
  else if (!CW.ses) { h = `<h1>Control ${esc(name)}</h1><p>Opening a position needs a plan. Try one airport of your choice free for ${trial} days, then pick one airport, three, five, ten or the whole network.</p>`;
    btns = `<a class="btn primary" href="${cwHost('pricing')}">Start your ${trial}-day free trial</a><a class="btn" href="${cwHost('account')}">Sign in</a>`; }
  else if (!e || !e.active) { h = `<h1>Control ${esc(name)}</h1><p>Your account has no active plan${e && e.trial_used ? '' : `. Try one airport of your choice free for ${trial} days`}.</p>`;
    btns = `<a class="btn primary" href="${cwHost('pricing')}">See plans</a><a class="btn" href="${cwHost('account')}">Your account</a>`; }
  else if (dev) { h = `<h1>${esc(name)} is in development</h1><p>Airports in development are open to Foxtrot (early access) members.</p>`;
    btns = `<a class="btn primary" href="${cwHost('account')}">Add Foxtrot</a>`; }
  else if (e.airports.length < e.limit) { h = `<h1>Add ${esc(name)} to your ${e.trial ? 'trial' : 'plan'}?</h1><p>${e.trial ? `Your free trial includes one airport of your choice.` : `Your plan includes ${e.limit} airport${e.limit > 1 ? 's' : ''} and you have chosen ${e.airports.length}${e.airports.length ? ': ' + e.airports.join(', ') : ''}.`}</p>`;
    btns = `<button class="btn primary" id="cwPayAdd">Add ${esc(name)}</button><a class="btn" href="${cwHost('account')}">Choose on your account</a>`; }
  else { h = `<h1>${esc(name)} is not in your ${e.trial ? 'trial' : 'plan'}</h1><p>${e.trial ? `Your free trial is for one airport, ${e.airports.join(', ')}. The rest of your plan’s airports unlock when the trial ends, or you can swap airports on your account during the trial.` : `Your plan includes ${e.limit} airport${e.limit > 1 ? 's' : ''}: ${e.airports.join(', ')}. Swap one on your account, or move up a plan.`}</p>`;
    btns = `<a class="btn primary" href="${cwHost('account')}">Your airports</a><a class="btn" href="${cwHost('pricing')}">Plans</a>`; }
  el.innerHTML = `<div class="card"><div class="eyebrow">${APT.icao}</div>${h}<p class="cw-msg" id="cwPayMsg"></p><div class="row">${btns}<a class="btn" href="${cwHost(HOME_RT)}">Airport briefing</a></div></div>`;
  const add = $('cwPayAdd');
  if (add) add.onclick = async () => {
    add.disabled = true;
    try { CW.ent = { ...CW.ent, ...await cwApi('account', { action: 'airports', airports: [...e.airports, APT.icao] }) }; cwLS.set('cw-ent', { at: Date.now(), email: CW.ses.email, ent: CW.ent }); cwPaywall(); }
    catch(err) { $('cwPayMsg').textContent = err.message; add.disabled = false; }
  };
}
function cwOnRoute(){
  const r = document.body.dataset.route, pay = $('cwPay');
  if (r === 'airports' && cwPreview()) renderAirports();   // previews unlock once the plan has loaded
  if (r === 'sim' && CW_ON && !cwCanPlay(APT.icao) && !S.running) cwPaywall(); else if (pay) pay.hidden = true;
  if (r === 'pricing') cwRenderPricing();
  if (r === 'account') cwRenderAccount();
  if (r === 'request') { cwRenderRequests(); cwRenderCommission(); }
  if (r === 'admin') cwRenderAdmin();
}

// ── pricing ──
function cwRenderPricing(){
  $('cwPreviewNote').hidden = CW_ON;
  $('cwOfferNote').hidden = !CW_OFF;
  if (CW_OFF) $('cwOfferNote').innerHTML = `<b>${esc(CW_OFF.label || 'Offer')}:</b> ${CW_OFF.percent}% off every plan ${cwOfferTerm()}${CW_ON ? ', applied at checkout' : ' when subscriptions open'}.`;
  $('cwEarlyPick').hidden = !CW_ON;
  const e = CW.ent, cur = e && e.active ? e.plan : null, trial = !(e && e.trial_used);
  $('cwPlans').innerHTML = CW_PLANS.map(p => {
    const per = p.n ? `<span class="per">${CW_CFG.currency}${(CW_CFG.prices[p.k]/p.n).toFixed(2)} per airport</span>` : '<span class="per">Every airport · Foxtrot included</span>';
    const btn = !CW_ON ? `<a class="btn" href="#airports">Free during the preview</a>`
      : cur === p.k ? `<button class="btn" disabled>Your plan</button>`
      : `<button class="btn${p.hot ? ' primary' : ''}" data-plan="${p.k}">${cur ? 'Switch to ' + p.name : trial ? `Start ${CW_CFG.trial_days}-day free trial` : 'Choose ' + p.name}</button>`;
    return `<div class="cw-plan${p.hot ? ' hot' : ''}">${p.hot ? '<span class="badge new">Most popular</span>' : ''}
      <div class="lbl">${p.n ? p.n + ' airport' + (p.n > 1 ? 's' : '') : 'All airports'}</div><h3>${p.name}</h3>
      <div class="price">${CW_OFF ? `<s>${cwPrice(p.k)}</s><b>${cwOffer(p.k)}</b>` : `<b>${cwPrice(p.k)}</b>`}<span>/month</span></div>${CW_OFF ? `<span class="cw-off">${CW_OFF.percent}% off ${cwOfferTerm()}, then ${cwPrice(p.k)}</span>` : ''}${per}<p>${p.p}.</p>${btn}</div>`;
  }).join('');
  $('cwPlans').querySelectorAll('[data-plan]').forEach(b => b.onclick = () => cwChoose(b.dataset.plan, $('cwEarlyBox').checked, b));
}
async function cwChoose(plan, early, btn){
  if (!CW.ses) { try { sessionStorage.setItem('cw-want', JSON.stringify({ plan, early })); } catch(e) {} location.hash = '#account'; return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Opening secure checkout…'; }
  try { const { url } = await cwApi('account', { action: 'checkout', plan, early }); try { sessionStorage.setItem('cw-paying', 'plan'); } catch(_) {} location.href = url; }
  catch(e) { if (btn) { btn.disabled = false; btn.textContent = e.message; } }
}

// ── account ──
const CW_ST = { trialing: 'Free trial', active: 'Active', past_due: 'Payment failed', canceled: 'Ended', unpaid: 'Unpaid', incomplete: 'Waiting for payment' };
async function cwRenderAccount(){
  const signed = !!CW.ses;
  $('cwSignIn').hidden = signed; $('cwAccount').hidden = !signed;
  $('cwAccH').textContent = signed ? 'Your account' : 'Sign in to Clearway';
  $('cwAccP').textContent = !CW_ON ? 'Accounts open with subscriptions. Every airport is free during the preview.' : signed ? 'Your plan, your airports and billing.' : 'We email you a sign-in link: no password to remember.';
  if (!CW_ON) { $('cwSignIn').hidden = true; return; }
  if (CW.signErr) { $('cwSignMsg').textContent = CW.signErr; CW.signErr = null; }
  if (!signed) return;
  $('cwWho').textContent = CW.ses.email;
  const done = /(checkout|card)=done/.test(location.search);
  if (!CW.ent || done) $('cwPlanBox').innerHTML = '<p class="cw-sub">Loading your plan…</p>';
  await cwLoad(true);   // the account page always asks the server, so releases and plan changes show at once
  // just back from Stripe: the webhook can take a few seconds to land
  // a commission payment is back when that airport is owned; a plan when it is active
  const paying = (() => { try { return sessionStorage.getItem('cw-paying'); } catch(_) { return null; } })();
  const card = /card=done/.test(location.search);
  const landed = () => CW.ent && (card ? !(CW.ent.commissions || []).some(c => c.status === 'card')
    : paying && paying !== 'plan' ? (CW.ent.owned || []).includes(paying) : CW.ent.active);
  for (let i = 0; done && i < 6 && !landed(); i++) { await new Promise(r => setTimeout(r, 2000)); await cwLoad(true); }
  if (done) try { sessionStorage.removeItem('cw-paying'); } catch(_) {}
  if (done) history.replaceState(null, '', location.pathname + '#account');
  const e = CW.ent;
  if (!e) { $('cwPlanBox').innerHTML = '<p class="cw-sub">Your plan could not be loaded. Please try again shortly.</p>'; return; }
  const want = (() => { try { const w = JSON.parse(sessionStorage.getItem('cw-want')); sessionStorage.removeItem('cw-want'); return w; } catch(_) { return null; } })();
  if (want && !e.active) return cwChoose(want.plan, want.early);
  const plan = CW_PLANS.find(p => p.k === e.plan);
  if (e.owner && !e.active) {
    $('cwPlanBox').innerHTML = `<div class="cw-planrow"><div><span class="badge live">Owner</span><h3>Every airport</h3><p class="cw-sub">As the site owner you can open every airport without a plan, including airports still in development.</p></div>
      <div class="cw-row"><a class="btn primary" href="#airports">Airports</a><a class="btn" href="#admin">Commissions</a></div></div>`;
  } else if (!e.active) {
    $('cwPlanBox').innerHTML = `<p>${e.status === 'canceled' ? 'Your plan has ended.' : 'You have no plan yet.'} ${e.trial_used ? '' : `Every plan starts with a free ${CW_CFG.trial_days}-day trial of one airport of your choice.`}</p><div class="cw-row"><a class="btn primary" href="#pricing">See plans</a>${e.billing ? '<button class="btn" data-portal>Billing history</button>' : ''}</div>`;
  } else {
    const when = e.status === 'trialing' ? `Free trial until ${cwDate(e.trial_end)}${e.cancel_at ? ', then ends' : CW_OFF ? `, then ${cwOffer(e.plan)} a month ${cwOfferTerm().replace('your ', 'the ')} and ${cwPrice(e.plan)} after that` : ', then ' + cwPrice(e.plan) + ' a month'}`
      : e.cancel_at ? `Ends on ${cwDate(e.cancel_at)}` : e.status === 'past_due' ? 'Your last payment failed: please update your card' : `Renews on ${cwDate(e.period_end)}`;
    $('cwPlanBox').innerHTML = `<div class="cw-planrow"><div><span class="badge ${e.status === 'past_due' ? 'dev' : 'live'}">${CW_ST[e.status] || e.status}</span><h3>${plan ? plan.name : e.plan}</h3><p class="cw-sub">${when}.</p></div>
      <div class="cw-row"><button class="btn primary" data-portal>Manage billing</button><a class="btn" href="#pricing">Compare plans</a></div></div>
      <div class="cw-earlyrow"><div><b>Foxtrot</b> (early access)<p class="cw-sub">${e.plan === 'all' ? 'Included with Echo.' : e.early ? 'On: airports in development are open to you.' : `Play airports in development, for ${cwPrice('early')} a month.`}</p></div>
      ${e.plan === 'all' ? '' : `<button class="btn" id="cwEarlyTog">${e.early ? 'Remove Foxtrot' : 'Add Foxtrot'}</button>`}</div>`;
    const t = $('cwEarlyTog');
    if (t) t.onclick = async () => { t.disabled = true; try { CW.ent = await cwApi('account', { action: 'early', on: !e.early }); cwLS.set('cw-ent', null); await cwLoad(true); cwRenderAccount(); } catch(err) { t.textContent = err.message; } };
  }
  $('cwPlanBox').querySelectorAll('[data-portal]').forEach(b => b.onclick = async () => { b.disabled = true; try { location.href = (await cwApi('account', { action: 'portal' })).url; } catch(err) { b.disabled = false; b.textContent = err.message; } });
  cwRenderPicks(); cwRenderNew(); cwRenderCommissions();
}
function cwRenderPicks(){
  const e = CW.ent, box = $('cwPickBox');
  box.hidden = !(e && (e.active || e.owner));
  if (box.hidden) return;
  const live = AIRPORTS_NET.filter(a => a.status === 'live'), dev = AIRPORTS_NET.filter(a => a.status === 'dev');
  if (e.airports === '*' || e.owner) {
    const prev = cwPreview() ? dev.filter(a => SITE[a.icao]) : [];
    $('cwPickSub').textContent = e.owner ? 'Every airport is open to you.' + (prev.length ? ' Airports in development are marked Preview.' : '') : 'Every airport is included in your plan.';
    $('cwPicks').innerHTML = [...live, ...prev].map(a => `<a class="cw-pick on" href="${SITE[a.icao] || '#'}#sim"><b>${a.icao}</b><span>${esc(a.name)}${a.status === 'dev' ? ' · Preview' : ''}</span></a>`).join('');
  } else {
    let sel = [...e.airports];
    const draw = () => {
      $('cwPickSub').textContent = e.trial ? `Your free trial includes one airport of your choice; swap it as often as you like. The rest of your plan’s ${e.plan_airports || ''} airports unlock when the trial ends.`.replace('plan’s  airports', 'plan’s airports') : `${sel.length} of ${e.limit} chosen. Fill empty places at any time; you can swap an airport once every 30 days.`;
      $('cwPicks').innerHTML = live.map(a => `<button type="button" class="cw-pick${sel.includes(a.icao) ? ' on' : ''}" data-i="${a.icao}" aria-pressed="${sel.includes(a.icao)}"><b>${a.icao}</b><span>${esc(a.name)}</span></button>`).join('')
        + `<div class="cw-row" style="grid-column:1/-1"><button class="btn primary" id="cwPickSave"${String(sel) === String(e.airports) ? ' disabled' : ''}>Save my airports</button></div>`;
      $('cwPicks').querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
        const i = b.dataset.i;
        if (sel.includes(i)) sel = sel.filter(x => x !== i); else if (sel.length < e.limit) sel.push(i); else { $('cwPickMsg').textContent = `Your plan includes ${e.limit}. Untick one first, or move up a plan.`; return; }
        $('cwPickMsg').textContent = ''; draw();
      });
      $('cwPickSave').onclick = async () => {
        try { CW.ent = { ...CW.ent, ...await cwApi('account', { action: 'airports', airports: sel }) }; cwLS.set('cw-ent', { at: Date.now(), email: CW.ses.email, ent: CW.ent }); $('cwPickMsg').textContent = 'Saved.'; cwRenderPicks(); }
        catch(err) { $('cwPickMsg').textContent = err.message; }
      };
    };
    draw();
  }
  if (e.early && dev.length) $('cwPicks').insertAdjacentHTML('beforeend', `<p class="cw-sub" style="grid-column:1/-1">Early access: ${dev.map(a => esc(a.name)).join(', ')} open${dev.length === 1 ? 's' : ''} to you as soon as its first build is playable.</p>`);
}
// ── a new airport is out: swap it in (once a month) or move up a plan with its code (subs.json releases + upgrade_offer) ──
const CW_UP = CW_CFG.upgrade_offer || { percent: 50, months: 3, days: 30 };
const cwNewAirports = () => (CW_CFG.releases || []).filter(r => Date.now() - Date.parse(r.date) < (CW_UP.days || 30)*864e5 && AIRPORTS_NET.some(a => a.icao === r.icao && a.status === 'live'));
function cwRenderNew(){
  const e = CW.ent, box = $('cwNewBox'), news = e && e.active && e.limit !== 0 ? cwNewAirports() : [];
  box.hidden = !news.length;
  if (box.hidden) return;
  const cur = CW_PLANS.findIndex(p => p.k === e.plan), bigger = CW_PLANS.slice(cur + 1);
  const last = e.airports_changed_at ? Date.parse(e.airports_changed_at) : 0, next = last + 30*864e5;
  box.innerHTML = news.map(r => {
    const ap = AIRPORTS_NET.find(a => a.icao === r.icao), mine = e.airports.includes(r.icao);
    const swap = mine ? `<p class="cw-sub">${esc(ap.name)} is already one of your airports.</p>`
      : `<p class="cw-sub"><b>Swap it in:</b> replace one of your airports with ${esc(ap.name)} in <a href="#account" data-swap>Your airports</a> below.${!e.trial && Date.now() < next ? ` Your next swap is free from ${cwDate(new Date(next))} (one swap a month).` : ' You can swap one airport a month.'}</p>`;
    const up = bigger.length ? `<p class="cw-sub"><b>Or add it by moving up a plan:</b> ${CW_UP.percent}% off for ${CW_UP.months} months with code <code>${esc(r.code)}</code>.</p>
      <div class="cw-row">${bigger.map(p => `<button class="btn${p === bigger[0] ? ' primary' : ''}" data-up="${p.k}" data-code="${esc(r.code)}">${p.name} (${p.n || 'all'} airports): <s>${cwPrice(p.k)}</s> ${CW_CFG.currency}${(CW_CFG.prices[p.k]*(100 - CW_UP.percent)/100).toFixed(2)}</button>`).join('')}</div>` : '';
    return `<div class="cw-new"><span class="badge new">New airport</span><h3>${esc(ap.name)} (${r.icao}) is open</h3>${swap}${up}</div>`;
  }).join('') + '<p class="cw-msg" id="cwNewMsg"></p>';
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = async () => {
    const p = CW_PLANS.find(x => x.k === b.dataset.up);
    if (!confirm(`Move up to ${p.name} with code ${b.dataset.code}? You get ${CW_UP.percent}% off for ${CW_UP.months} months and the difference for the rest of this month is added to your next bill.`)) return;
    b.disabled = true; $('cwNewMsg').textContent = 'Updating your plan…';
    try { CW.ent = { ...CW.ent, ...await cwApi('account', { action: 'upgrade', plan: p.k, code: b.dataset.code }) }; cwLS.set('cw-ent', null); await cwLoad(true); cwRenderAccount(); }
    catch(err) { b.disabled = false; $('cwNewMsg').textContent = err.message; }
  });
  const sw = box.querySelector('[data-swap]'); if (sw) sw.onclick = ev => { ev.preventDefault(); $('cwPickBox').scrollIntoView({ behavior: 'smooth' }); };
}

// ── commissioned airports: card saved on request, charged once on release, then the player's for good ──
const cwComPrice = () => CW_CFG.currency + (+CW_CFG.commission || 25);
const cwPence = c => CW_CFG.currency + ((c.price_pence || 2500)/100).toFixed(0);
const CW_CST = { card: ['Card needed', 'dev'], requested: ['Requested', 'soon'], building: ['Being built', 'dev'], ready: ['Payment needed', 'new'], paid: ['Yours', 'live'], launched: ['Yours', 'live'], declined: ['Not possible', 'soon'] };
function cwSaveEnt(patch){ CW.ent = { ...CW.ent, ...patch }; cwLS.set('cw-ent', { at: Date.now(), email: CW.ses.email, ent: CW.ent }); }
function cwRenderCommissions(){
  const e = CW.ent, box = $('cwComBox'), list = (e && e.commissions) || [];
  box.hidden = !e;
  if (!e) return;
  const owned = (e.owned || []).filter(i => !list.some(c => c.icao === i && (c.status === 'paid' || c.status === 'launched')));
  const row = c => {
    const [txt, cls] = CW_CST[c.status] || [c.status, 'soon'], mine = c.status === 'paid' || c.status === 'launched';
    const when = c.status === 'card' ? 'Add a card to send your request. Nothing is taken until the airport is released to you.'
      : c.status === 'requested' ? `Asked on ${cwDate(c.created_at)}. Your card is saved; ${cwPence(c)} is taken only when we release it to you.`
      : c.status === 'building' ? `We are building it now. ${cwPence(c)} is taken from your saved card when we release it to you.`
      : c.status === 'ready' ? `Built and released, but your bank needs you to confirm the ${cwPence(c)} payment. Pay once and it is yours for good.`
      : c.status === 'paid' ? `Yours for good. Only you can control it until ${cwDate(c.public_from)}, then it opens to everyone.`
      : c.status === 'launched' ? 'Yours for good, whatever plan you are on.' : 'We could not build this one.';
    const btn = c.status === 'ready' ? `<button class="btn primary" data-cpay="${c.id}" data-icao="${esc(c.icao)}">Pay ${cwPence(c)}</button>`
      : c.status === 'card' ? `<span class="cw-row"><button class="btn primary" data-ccard="${c.id}">Add card</button><button class="btn" data-cdel="${c.id}">Withdraw</button></span>`
      : mine && SITE[c.icao] ? `<a class="btn" href="${SITE[c.icao]}#sim">Control ${esc(c.icao)}</a>`
      : c.status === 'requested' || c.status === 'building' ? `<button class="btn" data-cdel="${c.id}">Withdraw</button>` : '';
    return `<div class="cw-com"><div><b>${esc(c.icao)}</b> ${esc(c.name || '')} <span class="badge ${cls}">${txt}</span><p class="cw-sub">${when}${c.reply ? ' ' + esc(c.reply) : ''}</p></div>${btn}</div>`;
  };
  $('cwComs').innerHTML = list.map(row).join('') + owned.map(i => row({ icao: i, status: 'launched' })).join('')
    + (list.length || owned.length ? '' : `<p class="cw-sub">Want an airport we have not built? Commission it: save a card, we build it, and ${cwComPrice()} is taken once when we release it to you. It is yours whatever plan you are on.</p>`)
    + `<div class="cw-row"><a class="btn" href="#request">Commission an airport</a></div>`;
  $('cwComs').querySelectorAll('[data-cpay]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Opening secure checkout…';
    try { const { url } = await cwApi('account', { action: 'commission_pay', id: +b.dataset.cpay });
      try { sessionStorage.setItem('cw-paying', b.dataset.icao); } catch(_) {} location.href = url; } catch(err) { b.disabled = false; $('cwComMsg').textContent = err.message; b.textContent = 'Pay'; }
  });
  $('cwComs').querySelectorAll('[data-ccard]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Opening secure checkout…';
    try { location.href = (await cwApi('account', { action: 'commission_card', id: +b.dataset.ccard })).url; } catch(err) { b.disabled = false; b.textContent = 'Add card'; $('cwComMsg').textContent = err.message; }
  });
  $('cwComs').querySelectorAll('[data-cdel]').forEach(b => b.onclick = async () => {
    if (!confirm('Withdraw this commission? Nothing is charged and your saved card is removed.')) return;
    b.disabled = true;
    try { cwSaveEnt(await cwApi('account', { action: 'commission_cancel', id: +b.dataset.cdel })); cwRenderCommissions(); } catch(err) { b.disabled = false; $('cwComMsg').textContent = err.message; }
  });
}
// the commission form on the Request page
function cwRenderCommission(){
  const f = $('cwComForm'), go = f.querySelector('button'), note = $('cwComNote');
  document.querySelectorAll('[data-cw="commission-price"]').forEach(el => el.textContent = cwComPrice());
  go.disabled = !CW_ON;
  note.innerHTML = !CW_ON ? 'Commissions open with subscriptions.' : CW.ses ? '' : `<a href="#account">Sign in</a> to commission an airport, so we can tell you when it is ready.`;
  if (CW_ON && !CW.ses) go.disabled = true;
}
function cwCommissionForm(){
  $('cwComIcao').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  $('cwComForm').onsubmit = async ev => {
    ev.preventDefault(); const out = $('cwComOut');
    const icao = $('cwComIcao').value, known = AIRPORTS_NET.find(a => a.icao === icao);
    if (known && known.status === 'live') { out.textContent = `${known.name} is already open: pick it in your plan.`; return; }
    out.textContent = 'Opening secure checkout to save your card…';
    // Stripe saves the card; nothing is taken until the airport is released
    try { location.href = (await cwApi('account', { action: 'commission', icao, name: $('cwComName').value, notes: $('cwComWhy').value })).url; }
    catch(e) { out.textContent = e.message; }
  };
}
// ── the owner's page (#admin, not linked): commissions to build and release. The API checks ADMIN_EMAILS. ──
async function cwRenderAdmin(){
  const box = $('cwAdmin');
  if (!CW_ON) { box.innerHTML = '<p class="cw-sub">Accounts are switched off in subs.json.</p>'; return; }
  if (!CW.ses) { box.innerHTML = '<p class="cw-sub"><a href="#account">Sign in</a> with an admin email first.</p>'; return; }
  box.innerHTML = '<p class="cw-sub">Loading…</p>';
  try { cwDrawAdmin((await cwApi('admin')).commissions); } catch(e) { box.innerHTML = `<p class="cw-sub">${esc(e.message)}</p>`; }
}
function cwDrawAdmin(list){
  const box = $('cwAdmin'), st = s => (CW_CST[s] || [s])[0];
  box.innerHTML = list.length ? list.map(c => {
    const open = ['requested', 'building'].includes(c.status);
    return `<div class="cw-com"><div><b>${esc(c.icao)}</b> ${esc(c.name || '')} <span class="badge">${esc(st(c.status))}</span>
      <p class="cw-sub">${esc(c.email || '')} · ${cwDate(c.created_at)} · ${cwPence(c)}${c.paid_at ? ' · paid ' + cwDate(c.paid_at) : ''}${c.public_from ? ' · public from ' + cwDate(c.public_from) : ''}</p>
      ${c.notes ? `<p class="cw-sub">“${esc(c.notes)}”</p>` : ''}${c.reply ? `<p class="cw-sub">Your note: ${esc(c.reply)}</p>` : ''}</div>
      <span class="cw-row">${c.status === 'requested' ? `<button class="btn" data-a="building" data-id="${c.id}">Building</button>` : ''}
      ${open ? `<button class="btn primary" data-a="release" data-id="${c.id}">Release and charge ${cwPence(c)}</button>` : ''}
      ${['card', 'requested', 'building'].includes(c.status) ? `<button class="btn" data-a="declined" data-id="${c.id}">Decline</button>` : ''}
      ${c.status === 'paid' ? `<button class="btn" data-a="launched" data-id="${c.id}">Opened to everyone</button>` : ''}</span></div>`;
  }).join('') : '<p class="cw-sub">No commissions yet.</p>';
  box.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const a = b.dataset.a, id = +b.dataset.id, msg = $('cwAdminMsg');
    let reply;
    if (a === 'release' && !confirm('Release this airport to the player and charge their card?')) return;
    if (a === 'declined' && (reply = prompt('Why can it not be built? The player sees this.', '')) === null) return;
    b.disabled = true; msg.textContent = 'Working…';
    try {
      cwLS.set('cw-ent', null);   // the owner may also be the player: forget the cached account
      const r = await cwApi('admin', a === 'release' ? { action: 'release', id } : { action: 'status', id, status: a, ...(reply != null ? { reply } : {}) });
      msg.textContent = a !== 'release' ? 'Saved.' : r.paid ? 'Charged and released: it is on their account.' : 'Released, but the card could not be charged without the player. Their account now shows a Pay button; email them to let them know.';
      cwDrawAdmin(r.commissions);
    } catch(e) { b.disabled = false; msg.textContent = e.message; }
  });
}
function cwSignInForms(){
  let email = '';
  $('cwEmailForm').onsubmit = async ev => {
    ev.preventDefault(); email = $('cwEmail').value.trim(); $('cwSignMsg').textContent = 'Sending…';
    // the link comes back to this page (and keeps the test switch on); Supabase must list the site under Redirect URLs
    const back = location.origin + location.pathname + (CW_TEST ? '?cwtest=on' : '');
    try { await cwAuth('otp?redirect_to=' + encodeURIComponent(back), { email, create_user: true }); $('cwEmailForm').hidden = true; $('cwCodeForm').hidden = false; $('cwCode').focus();
      $('cwSignMsg').textContent = `We have emailed a sign-in link to ${email}. Open it on this device to sign in, or type the code if your email shows one. It can take a minute; check your spam folder too.`; }
    catch(e) { $('cwSignMsg').textContent = e.message; }
  };
  $('cwCodeForm').onsubmit = async ev => {
    ev.preventDefault(); $('cwSignMsg').textContent = 'Checking…';
    try { cwKeep(await cwAuth('verify', { type: 'email', email, token: $('cwCode').value.trim() })); $('cwSignMsg').textContent = ''; $('cwCodeForm').hidden = true; $('cwEmailForm').hidden = false; cwRefreshUI(); }
    catch(e) { $('cwSignMsg').textContent = e.message; }
  };
  $('cwCodeBack').onclick = () => { $('cwCodeForm').hidden = true; $('cwEmailForm').hidden = false; $('cwSignMsg').textContent = ''; };
  $('cwSignOut').onclick = cwSignOut;
}
function cwRefreshUI(){
  const a = $('cwAccLink');
  if (a) { a.hidden = !CW_ON; a.textContent = CW.ses ? 'Account' : 'Sign in'; }
  if (document.body.dataset.route) cwOnRoute();
  if (typeof renderAirports === 'function' && $('apGrid')) renderAirports();   // previews of airports in development
}

// ── feedback ──
function cwFeedback(){
  const m = $('cwFb'); let kind = 'idea', rating = 0;
  $('cwFbStars').insertAdjacentHTML('beforeend', [1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}" aria-label="${n} of 5">★</button>`).join(''));
  const open = () => { m.hidden = false; $('cwFbEmailL').hidden = !!CW.ses; $('cwFbMsgOut').textContent = ''; setTimeout(() => $('cwFbMsg').focus(), 30); };
  const close = () => { m.hidden = true; };
  $('cwFbBtn').onclick = open;
  // the console gets its own Feedback button
  const tb = $('tgFull'); if (tb) { const b = document.createElement('button'); b.id = 'tgFeedback'; b.textContent = 'Feedback'; b.title = 'Tell us what works and what does not'; b.onclick = open; tb.before(b); }
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) close(); });
  $('cwFbKind').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $('cwFbKind').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
  $('cwFbStars').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; rating = +b.dataset.r; $('cwFbStars').querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', +x.dataset.r <= rating)); };
  $('cwFbForm').onsubmit = async ev => {
    ev.preventDefault(); const out = $('cwFbMsgOut'); out.textContent = 'Sending…';
    try {
      await cwApi('feedback', { kind, rating, message: $('cwFbMsg').value, email: $('cwFbEmail').value, page: document.body.dataset.route || '', airport: APT.icao });
      out.textContent = 'Thank you. Every message is read.'; $('cwFbMsg').value = ''; setTimeout(close, 1600);
    } catch(e) { out.textContent = e.message; }
  };
}

// ── airport requests ──
async function cwRenderRequests(){
  const road = AIRPORTS_NET.filter(a => a.status !== 'live');
  $('cwRoadmap').innerHTML = road.map(a => `<div class="cw-reqrow"><b>${a.icao}</b><span>${esc(a.name)} · ${esc(a.ctry)}</span><span class="badge ${a.status}">${STATUS_TXT[a.status]}</span></div>`).join('');
  if (!CW_FB) { $('cwReqList').innerHTML = '<p class="cw-sub">Requests open soon.</p>'; $('cwReqForm').querySelector('button').disabled = true; return; }
  try { cwDrawReq((await cwApi('feedback?requests')).requests); } catch(e) { $('cwReqList').innerHTML = `<p class="cw-sub">${esc(e.message)}</p>`; }
}
function cwDrawReq(list){
  const top = Math.max(1, ...list.map(r => r.votes));
  $('cwReqList').innerHTML = list.length ? list.map(r => {
    const known = AIRPORTS_NET.find(a => a.icao === r.icao);
    return `<div class="cw-reqrow"><b>${esc(r.icao)}</b><span>${esc(r.name || (known && known.name) || '')}</span><i style="--w:${(r.votes/top*100).toFixed(0)}%"></i><span class="n">${r.votes}</span>${known ? `<span class="badge ${known.status}">${STATUS_TXT[known.status]}</span>` : ''}</div>`;
  }).join('') : '<p class="cw-sub">No requests yet: be the first.</p>';
}
function cwRequestForm(){
  $('cwReqIcao').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); const k = AIRPORTS_NET.find(a => a.icao === e.target.value); if (k && !$('cwReqName').value) $('cwReqName').value = k.name; };
  $('cwReqForm').onsubmit = async ev => {
    ev.preventDefault(); const out = $('cwReqMsg'); out.textContent = 'Sending…';
    try { const r = await cwApi('feedback', { kind: 'request', icao: $('cwReqIcao').value, name: $('cwReqName').value, reason: $('cwReqWhy').value });
      cwDrawReq(r.requests); out.textContent = 'Thanks! Your vote is in.'; $('cwReqForm').reset(); }
    catch(e) { out.textContent = e.message; }
  };
}

// ── boot (after site.js has set up the routes) ──
function cwInit(){
  if (EMBED) return;
  if (CW_TEST) document.body.insertAdjacentHTML('beforeend', '<a class="cw-testpill" href="?cwtest=off" title="Only this browser sees sign-in and plans">Test mode: accounts on · turn off</a>');
  document.querySelectorAll('[data-cw="trial"]').forEach(el => el.textContent = CW_CFG.trial_days);
  document.querySelectorAll('[data-cw="early-price"]').forEach(el => el.textContent = cwPrice('early'));
  document.querySelectorAll('[data-cw="commission-price"]').forEach(el => el.textContent = cwComPrice());
  document.querySelectorAll('[data-cw="site"]').forEach(el => el.textContent = CW_CFG.site.replace(/^https?:\/\//, '').replace(/\/$/, ''));
  document.querySelectorAll('[data-cw="legal-date"]').forEach(el => el.textContent = CW_CFG.legal_date);
  if (CW_CFG.contact_email) document.querySelectorAll('[data-cw="contact-line"]').forEach(el => el.innerHTML = `Email <a href="mailto:${esc(CW_CFG.contact_email)}">${esc(CW_CFG.contact_email)}</a>, or use the feedback button on any page.`);
  document.querySelectorAll('[data-cw="analytics-line"]').forEach(el => el.textContent = CW_CFG.analytics_token ? 'We count visits with Cloudflare Web Analytics, which uses no cookies and does not track you across sites.' : 'We do not run analytics.');
  $('cwTeaser').innerHTML = CW_PLANS.map(p => `<a class="cw-tchip" href="#pricing"><b>${p.n || 'All'}</b><span>${p.n ? 'airport' + (p.n > 1 ? 's' : '') : 'airports'}</span><em>${CW_OFF ? `<s>${cwPrice(p.k)}</s> ${cwOffer(p.k)}` : cwPrice(p.k)}/mo</em></a>`).join('');
  if (CW_OFF) $('cwTeaserOff').textContent = `${CW_OFF.label || 'Offer'}: ${CW_OFF.percent}% off ${cwOfferTerm()}.`;
  document.querySelectorAll('[data-cw-fb]').forEach(el => el.hidden = !CW_FB);
  $('cwFbBtn').hidden = !CW_FB;
  if (CW_FB) cwFeedback();
  cwSignInForms(); cwRequestForm(); cwCommissionForm();
  new MutationObserver(cwOnRoute).observe(document.body, { attributes: true, attributeFilter: ['data-route'] });
  cwRefreshUI();
  // load the plan, then re-check the console (a player may have arrived on #sim before it loaded)
  if (CW_ON && CW.ses) cwLoad().then(() => { if (CW.ent && CW.ent.early || CW.ent && CW.ent.owner) renderAirports(); if (document.body.dataset.route === 'sim' || document.body.dataset.route === 'pricing') cwOnRoute(); });
}
setTimeout(cwInit, 0);
