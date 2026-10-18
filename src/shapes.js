// ── aircraft shapes ──────────────────────────────────────
// Top-down outlines of each aircraft family, built from the real geometry: fuselage width, wing sweep, chords and
// planform kink, tailplane, where the engines hang, propellers. Every type is drawn at its own wingspan and length
// (TYPES span/len), so a 777-300ER on stand really is twice the size of an A319 next to it. Lengths are metres; y runs
// from the nose (0) to the tail (len), x out along the right wing. Fractions: wing/tail root leading edge as a share of
// the length, engine stations as a share of the semispan.
//   wing: le root LE, kc chord at the kink (inboard trailing edge runs straight across to the body, as on real airliners),
//         kink share of the exposed semispan (0: straight taper from rc), tc tip chord, sw LE sweep, rake [m, extra deg,
//         from span m]: raked tips; high: high wing (nacelles sit on top)
//   ht:   tailplane, t: on top of the fin (T-tail or cruciform), so the fin only shows ahead of it
//   eng:  under/on the wing; rear: on the rear fuselage (x m out from the centreline, y share of the length)
const AC_FAM = {
  a320:  { ref: [35.8, 37.6], fw: 3.95, nose: 4.0, cone: 9.0, wing: { le: .36, kc: 4.5, kink: .30, tc: 1.6, sw: 27.5 }, ht: { le: .845, span: 12.45, rc: 3.6, tc: 1.3, sw: 32 }, fin: .78, eng: [{ s: .32, l: 4.4, d: 2.1, fwd: 2.6 }] },
  b737:  { ref: [35.8, 39.5], fw: 3.76, nose: 4.6, cone: 8.5, wing: { le: .37, kc: 4.6, kink: .30, tc: 1.3, sw: 27 }, ht: { le: .82, span: 14.35, rc: 3.8, tc: 1.2, sw: 30 }, fin: .76, eng: [{ s: .27, l: 4.3, d: 2.1, fwd: 3.2 }] },
  a220:  { ref: [35.1, 38.7], fw: 3.51, nose: 4.2, cone: 8.5, wing: { le: .38, kc: 4.0, kink: .30, tc: 1.3, sw: 26 }, ht: { le: .835, span: 11.9, rc: 3.3, tc: 1.2, sw: 30 }, fin: .77, eng: [{ s: .32, l: 4.8, d: 2.3, fwd: 2.6 }] },
  b757:  { ref: [38.1, 47.3], fw: 3.76, nose: 4.6, cone: 9.0, wing: { le: .36, kc: 5.2, kink: .30, tc: 1.7, sw: 27 }, ht: { le: .83, span: 15.2, rc: 4.2, tc: 1.4, sw: 32 }, fin: .77, eng: [{ s: .32, l: 5.2, d: 2.5, fwd: 3.2 }] },
  b767:  { ref: [47.6, 54.9], fw: 5.03, nose: 5.5, cone: 11, wing: { le: .37, kc: 6.2, kink: .33, tc: 2.2, sw: 34 }, ht: { le: .84, span: 18.6, rc: 5.0, tc: 1.6, sw: 34 }, fin: .78, eng: [{ s: .32, l: 6.0, d: 2.9, fwd: 3.4 }] },
  a330:  { ref: [60.3, 63.7], fw: 5.64, nose: 6.0, cone: 12, wing: { le: .37, kc: 6.6, kink: .32, tc: 2.4, sw: 30 }, ht: { le: .845, span: 19.4, rc: 5.5, tc: 1.8, sw: 33 }, fin: .79, eng: [{ s: .32, l: 6.3, d: 3.0, fwd: 3.6 }] },
  a340:  { ref: [63.5, 63.7], fw: 5.64, nose: 6.0, cone: 12, wing: { le: .37, kc: 6.6, kink: .32, tc: 2.4, sw: 30 }, ht: { le: .845, span: 19.4, rc: 5.5, tc: 1.8, sw: 33 }, fin: .79, eng: [{ s: .27, l: 5.0, d: 2.4, fwd: 3.0 }, { s: .56, l: 5.0, d: 2.4, fwd: 3.0 }] },
  a350:  { ref: [64.8, 66.8], fw: 5.96, nose: 6.0, cone: 12, wing: { le: .37, kc: 7.0, kink: .30, tc: 2.2, sw: 32, rake: [3.5, 22, 0] }, ht: { le: .855, span: 18.8, rc: 5.5, tc: 1.8, sw: 32 }, fin: .79, eng: [{ s: .31, l: 7.0, d: 3.6, fwd: 3.8 }] },
  b787:  { ref: [60.1, 62.8], fw: 5.77, nose: 6.0, cone: 11, wing: { le: .375, kc: 6.5, kink: .30, tc: 2.0, sw: 32, rake: [5, 12, 0] }, ht: { le: .845, span: 19.8, rc: 5.4, tc: 1.7, sw: 35 }, fin: .79, eng: [{ s: .31, l: 6.5, d: 3.4, fwd: 3.4 }] },
  b777:  { ref: [64.8, 73.9], fw: 6.2, nose: 6.5, cone: 13, tail: 0.15, wing: { le: .37, kc: 7.0, kink: .30, tc: 2.6, sw: 33, rake: [5.5, 14, 63] }, ht: { le: .84, span: 21.5, rc: 6.0, tc: 2.0, sw: 34 }, fin: .79, eng: [{ s: .30, l: 7.3, d: 3.9, fwd: 3.6 }] },
  b747:  { ref: [68.4, 76.3], fw: 6.5, nose: 7.0, cone: 12, wing: { le: .33, kc: 8.0, kink: .30, tc: 3.0, sw: 37.5, rake: [6, 10, 66] }, ht: { le: .835, span: 22.2, rc: 6.5, tc: 2.2, sw: 37 }, fin: .77, eng: [{ s: .33, l: 6.5, d: 3.2, fwd: 3.4 }, { s: .58, l: 6.3, d: 3.1, fwd: 3.6 }] },
  a380:  { ref: [79.8, 72.7], fw: 7.14, nose: 6.5, cone: 12, wing: { le: .325, kc: 9.5, kink: .30, tc: 4.0, sw: 33.5 }, ht: { le: .83, span: 30.4, rc: 7.5, tc: 2.4, sw: 33 }, fin: .76, eng: [{ s: .30, l: 6.2, d: 3.1, fwd: 3.4 }, { s: .55, l: 6.0, d: 3.0, fwd: 3.4 }] },
  ejet:  { ref: [28.7, 36.2], fw: 3.01, nose: 3.8, cone: 7.5, wing: { le: .38, kc: 3.6, kink: .30, tc: 1.2, sw: 26 }, ht: { le: .84, span: 10.0, rc: 3.0, tc: 1.0, sw: 31 }, fin: .76, eng: [{ s: .30, l: 3.8, d: 1.75, fwd: 2.4 }] },
  crj:   { ref: [24.9, 36.2], fw: 2.69, nose: 4.0, cone: 6.5, wing: { le: .41, kc: 3.0, kink: .28, tc: 1.1, sw: 26 }, ht: { le: .90, span: 8.5, rc: 2.4, tc: 1.0, sw: 33, t: true }, fin: .80, rear: [{ x: 2.35, y: .64, l: 3.6, d: 1.45 }] },
  erj:   { ref: [20.0, 29.9], fw: 2.28, nose: 4.0, cone: 5.5, wing: { le: .44, rc: 3.4, tc: 1.0, sw: 23 }, ht: { le: .88, span: 7.6, rc: 2.2, tc: 1.0, sw: 30, t: true }, fin: .80, rear: [{ x: 2.05, y: .66, l: 3.4, d: 1.3 }] },
  atr:   { ref: [27.1, 27.2], fw: 2.57, nose: 3.2, cone: 6.5, wing: { le: .37, rc: 2.6, tc: 1.4, sw: 3, high: true }, ht: { le: .87, span: 7.3, rc: 1.9, tc: 1.1, sw: 12, t: true }, fin: .78, eng: [{ s: .30, l: 5.0, d: 1.1, fwd: 2.0, prop: 3.93 }] },
  dash8: { ref: [28.4, 32.8], fw: 2.69, nose: 3.5, cone: 7.0, wing: { le: .37, rc: 3.0, tc: 1.2, sw: 3, high: true }, ht: { le: .875, span: 8.6, rc: 2.3, tc: 1.1, sw: 18, t: true }, fin: .79, eng: [{ s: .28, l: 6.2, d: 1.25, fwd: 2.4, prop: 4.1 }] },
  a400:  { ref: [42.4, 45.1], fw: 5.4, nose: 4.5, cone: 11, wing: { le: .33, rc: 6.0, tc: 2.4, sw: 15, high: true }, ht: { le: .85, span: 19.6, rc: 4.8, tc: 2.2, sw: 24, t: true }, fin: .78, eng: [{ s: .28, l: 5.5, d: 1.3, fwd: 2.5, prop: 5.3 }, { s: .56, l: 5.0, d: 1.3, fwd: 2.3, prop: 5.3 }] },
  bizs:  { ref: [17.2, 15.8], fw: 1.7, nose: 2.6, cone: 3.5, wing: { le: .42, rc: 2.6, tc: 1.1, sw: 12 }, ht: { le: .84, span: 6.5, rc: 1.5, tc: .8, sw: 22, t: true }, fin: .80, rear: [{ x: 1.45, y: .62, l: 2.8, d: .95 }] },
  bizl:  { ref: [30.4, 30.4], fw: 2.6, nose: 3.6, cone: 5.0, wing: { le: .41, kc: 2.6, kink: .25, tc: 1.0, sw: 34 }, ht: { le: .87, span: 10.0, rc: 2.4, tc: 1.0, sw: 35, t: true }, fin: .81, rear: [{ x: 2.4, y: .66, l: 4.2, d: 1.5 }] },
  falcon:{ ref: [26.2, 23.4], fw: 2.35, nose: 3.2, cone: 4.0, wing: { le: .40, kc: 2.4, kink: .25, tc: .9, sw: 34 }, ht: { le: .88, span: 8.3, rc: 2.0, tc: 1.0, sw: 35, t: true }, fin: .81, rear: [{ x: 2.1, y: .66, l: 3.4, d: 1.2 }, { x: 0, y: .73, l: 3.0, d: 1.1 }] },
  single:{ ref: [16.3, 14.4], fw: 1.6, nose: 1.4, cone: 3.5, wing: { le: .36, rc: 2.2, tc: 1.1, sw: 2 }, ht: { le: .86, span: 5.2, rc: 1.3, tc: .8, sw: 15, t: true }, fin: .80, noseProp: 2.67 }
};
// ICAO type designator → family. Unknown types fall back to the A320 family.
const AC_FAM_RE = [
  [/^A38/, 'a380'], [/^B74/, 'b747'], [/^B77/, 'b777'], [/^B78/, 'b787'], [/^A35/, 'a350'], [/^A34/, 'a340'], [/^A33/, 'a330'],
  [/^B76/, 'b767'], [/^B75/, 'b757'], [/^(B73|B3[789]M|B3XM)/, 'b737'], [/^(BCS|A22)/, 'a220'], [/^(A3[12]|A2[01]N|A19N)/, 'a320'],
  [/^(E1[79]|E75|E29|E2[0-9]{2})/, 'ejet'], [/^(E1[34]|E45|E35)/, 'erj'], [/^CRJ/, 'crj'], [/^AT[4-7]/, 'atr'], [/^DH8/, 'dash8'],
  [/^(A400|C130|C30J)/, 'a400'], [/^(FA[5-9X]|F900|F2TH)/, 'falcon'], [/^(GLF|GL[5-7X]|G280|CL[36]|GLEX)/, 'bizl'],
  [/^(C5[0-9]|C68|C25|C7|E5[05]|LJ|H25|PC24|HDJT)/, 'bizs'], [/^(PC12|C208|TBM|PA|C1[0-9]{2}|SR2|DA[4-6]|BE)/, 'single']
];
const acFam = t => { for (const [re, f] of AC_FAM_RE) if (re.test(t || '')) return f; return 'a320'; };
// the size the family's icon is drawn at when zoomed out (half of the en-route icon is about 9 px)
const AC_ICON_K = { a380: 1.25, b747: 1.22, b777: 1.15, a350: 1.15, a340: 1.15, a330: 1.15, b787: 1.15, b767: 1.08, b757: 1.03, a400: 1.05, ejet: .94, crj: .9, erj: .9, atr: .9, dash8: .9, bizs: .8, bizl: .85, falcon: .82, single: .75 };

// finishing details per family: nb how blunt the nose is (0 pointed, 1 round), wl winglet/sharklet length (m, 0 square
// tip), ftf flap-track fairings per wing (the canoes behind the trailing edge)
const AC_DET = {
  a320: { nb: .62, wl: 1.4, ftf: 3 }, b737: { nb: .42, wl: 1.6, ftf: 3 }, a220: { nb: .55, wl: .8, ftf: 3 }, b757: { nb: .45, wl: 1.5, ftf: 3 },
  b767: { nb: .5, wl: 1.6, ftf: 3 }, a330: { nb: .6, wl: 1.8, ftf: 4 }, a340: { nb: .6, wl: 1.8, ftf: 4 }, a350: { nb: .55, ftf: 4 },
  b787: { nb: .5, ftf: 3 }, b777: { nb: .55, ftf: 3 }, b747: { nb: .58, ftf: 4 }, a380: { nb: .7, wl: .8, ftf: 5 },
  ejet: { nb: .5, wl: 1.1, ftf: 2 }, crj: { nb: .45, wl: .9, ftf: 2 }, erj: { nb: .4, ftf: 1 }, atr: { nb: .5 }, dash8: { nb: .45 },
  a400: { nb: .7 }, bizs: { nb: .4, wl: .6 }, bizl: { nb: .42, wl: .9, ftf: 1 }, falcon: { nb: .42, wl: .7, ftf: 1 }, single: { nb: .7 }
};
// build one type's outline as Path2Ds, centred on mid-length (acMid), nose up at -len/2. The wing and tailplane are
// built for the right side only and drawn twice, mirrored.
function buildShape(fam, span, len){
  const F = AC_FAM[fam], D = AC_DET[fam] || {}, kx = span/F.ref[0], h = F.fw/2, Y0 = len/2, b = span/2, W = F.wing, tanD = d => Math.tan(d*D2R);
  const body = new Path2D(), half = new Path2D(), under = new Path2D(), over = new Path2D(), intake = new Path2D(), hinge = new Path2D(), fin = new Path2D(), win = new Path2D(), props = [];
  const M = (p, x, y) => p.moveTo(x, y - Y0), Ln = (p, x, y) => p.lineTo(x, y - Y0), Q = (p, cx1, cy1, x, y) => p.quadraticCurveTo(cx1, cy1 - Y0, x, y - Y0);
  // fuselage: ogive nose, parallel cabin, tail cone tapering to the APU exhaust
  const te = F.tail != null ? F.tail : 0.3, nb = D.nb != null ? D.nb : .55;
  body.moveTo(0, -Y0);
  body.bezierCurveTo(h*nb, -Y0, h, F.nose*0.32 - Y0, h, F.nose - Y0); Ln(body, h, len - F.cone); body.bezierCurveTo(h, len - F.cone*0.45 - Y0, te*1.6, len - F.cone*0.12 - Y0, te, len - Y0);
  Ln(body, -te, len); body.bezierCurveTo(-te*1.6, len - F.cone*0.12 - Y0, -h, len - F.cone*0.45 - Y0, -h, len - F.cone - Y0); Ln(body, -h, F.nose); body.bezierCurveTo(-h, F.nose*0.32 - Y0, -h*nb, -Y0, 0, -Y0);
  body.closePath();
  // wing: leading edge (with raked tips), trailing edge straight across inboard of the kink, fillets into the body
  const yLE = W.le*len, sw = tanD(W.sw), tc = W.tc*kx, rk = W.rake && span >= W.rake[2] ? W.rake : null, wl = rk ? 0 : (D.wl || 0)*kx;
  const leAt = x => { const y = yLE + (x - h)*sw; return rk && x > b - rk[0] ? y + (x - (b - rk[0]))*(tanD(W.sw + rk[1]) - sw) : y; };
  const xk = W.kink ? h + W.kink*(b - h) : h, rc = W.kink ? W.kc*kx + (xk - h)*sw : W.rc*kx, yk = yLE + rc;
  const tipTE = leAt(b) + tc*(rk ? 0.55 : 1), xr = rk ? b - rk[0] : b, yr = rk ? leAt(xr) + tc : tipTE;
  const teAt = x => x <= xk ? yk : x >= xr ? yr + (x - xr)/(b - xr || 1)*(tipTE - yr) : yk + (x - xk)/(xr - xk)*(yr - yk);
  const chordAt = x => teAt(x) - leAt(x), g = Math.min(rc*0.16, b*0.08), fa = rc*0.22, fb = rc*0.32;
  M(half, h - 0.05, yLE - fa); Q(half, h, yLE, h + g, yLE + g*sw);
  if (rk) Ln(half, xr, leAt(xr));
  if (wl) { Ln(half, b - wl, leAt(b - wl)); Q(half, b - wl*0.15, leAt(b - wl*0.15), b, leAt(b) + tc*0.35); Ln(half, b, tipTE); }
  else { Ln(half, b, leAt(b)); Ln(half, b, tipTE); }
  if (rk) Ln(half, xr, yr);
  Ln(half, xk, yk); Ln(half, h + g, yk); Q(half, h, yk, h - 0.05, yk + fb); half.closePath();
  // flap-track fairings: canoes under the wing, sticking out behind the trailing edge
  for (let i = 0; i < (D.ftf || 0); i++) {
    const x = h + (b - h)*(0.2 + 0.62*i/Math.max(1, (D.ftf || 1) - 1)*((D.ftf || 1) > 1 ? 1 : 0)), c = chordAt(x), w = Math.max(0.35, c*0.09), y = teAt(x);
    M(half, x + w/2, y - c*0.25); Q(half, x + w/2, y + c*0.18, x, y + c*0.22); Q(half, x - w/2, y + c*0.18, x - w/2, y - c*0.25); half.closePath();   // wound like the wing, so they join it
  }
  // flap and aileron hinge line, seen at close range
  for (let i = 0; i <= 12; i++) { const x = h + g + (b*0.94 - h - g)*i/12, y = leAt(x) + chordAt(x)*0.74; i ? Ln(hinge, x, y) : M(hinge, x, y); }
  // tailplane with a fillet at the root
  const T = F.ht, yT = T.le*len, ts = T.span*kx/2, tst = tanD(T.sw), trc = T.rc*kx, ttc = T.tc*kx, hr = T.t ? 0.2 : Math.max(0.3, te*2);
  M(half, 0, yT - trc*0.3); Q(half, hr, yT, hr + trc*0.15, yT + trc*0.15*tst); Ln(half, ts, yT + ts*tst); Q(half, ts + ttc*0.15, yT + ts*tst + ttc*0.5, ts, yT + ts*tst + ttc);
  Ln(half, hr, yT + trc); Ln(half, 0, yT + trc); half.closePath();
  // fin seen from above: a narrow ridge with its dorsal fillet (only ahead of the tailplane on a T-tail)
  const fy = F.fin*len, ft = Math.max(0.3, F.fw*0.1), fe = T.t ? yT + 0.3 : len - 0.4;
  M(fin, 0, fy - (fe - fy)*0.25); Q(fin, ft/2, fy + (fe - fy)*0.15, ft/2, fy + (fe - fy)*0.4); Ln(fin, ft/2, fe); Ln(fin, -ft/2, fe); Ln(fin, -ft/2, fy + (fe - fy)*0.4); Q(fin, -ft/2, fy + (fe - fy)*0.15, 0, fy - (fe - fy)*0.25); fin.closePath();
  // engines: intake lip, fan cowl, tapering to the nozzle
  const pod = (p, x, y, l, d) => { const r = d/2;
    M(p, x - r*0.9, y); Ln(p, x + r*0.9, y); Q(p, x + r*1.02, y + l*0.12, x + r, y + l*0.35); Q(p, x + r*0.95, y + l*0.8, x + r*0.55, y + l);
    Ln(p, x - r*0.55, y + l); Q(p, x - r*0.95, y + l*0.8, x - r, y + l*0.35); Q(p, x - r*1.02, y + l*0.12, x - r*0.9, y); p.closePath();
    intake.ellipse(x, y + l*0.02 - Y0, r*0.85, Math.max(0.12, r*0.14), 0, 0, Math.PI*2); };
  for (const e of F.eng || []) { const x = e.s*b, y = leAt(x) - e.fwd; pod(W.high ? over : under, x, y, e.l, e.d); if (e.prop) props.push([x, y - 0.25 - Y0, e.prop], [-x, y - 0.25 - Y0, e.prop]); }
  const centre = new Path2D();
  for (const e of F.rear || []) pod(e.x ? over : centre, e.x, e.y*len, e.l, e.d);
  if (F.noseProp) props.push([0, -0.2 - Y0, F.noseProp]);
  // flight-deck windows
  const wy = F.nose*0.6, ww = h*0.7;
  win.moveTo(-ww, wy - Y0); win.quadraticCurveTo(0, wy - F.nose*0.16 - Y0, ww, wy - Y0); win.lineTo(ww*0.8, wy + F.nose*0.1 - Y0); win.quadraticCurveTo(0, wy - F.nose*0.04 - Y0, -ww*0.8, wy + F.nose*0.1 - Y0); win.closePath();
  return { body, half, under, over, centre, intake, hinge, fin, win, props, h, tip: [b, leAt(b) + tc*0.5 - Y0], size: Math.max(span, len), high: !!W.high };
}
const SHAPES = new Map();
function acShape(t, span, len){
  const fam = acFam(t), k = fam + '|' + span + '|' + len;
  let s = SHAPES.get(k); if (!s) { s = buildShape(fam, span, len); SHAPES.set(k, s); }
  return s;
}
// draw a shape at m px per metre. o: { line: outline colour, lw: outline px, shadow: fill only, detail: windows, shading
// and hinge lines, spin: propellers turning }
function drawShape(sh, X, Y, hdg, m, col, o){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); cx.scale(m, m);
  cx.lineJoin = 'round';
  const both = f => { f(); cx.scale(-1, 1); f(); cx.scale(-1, 1); };
  const line = o.shadow ? null : o.line, lw = 2*o.lw/m;
  const stroke = p => { cx.strokeStyle = line; cx.lineWidth = lw; cx.stroke(p); }, fill = (p, c) => { cx.fillStyle = c || col; cx.fill(p); };
  // every outline first and every fill after, so only the outside edge of the whole aircraft shows
  // engines under a low wing first, so the wing covers their back and only the intakes show ahead of it
  if (line) both(() => stroke(sh.under)); both(() => fill(sh.under));
  if (!o.shadow) { both(() => fill(sh.under, 'rgba(20,28,40,.16)')); both(() => fill(sh.intake, 'rgba(14,20,30,.55)')); }
  if (line) { stroke(sh.body); both(() => stroke(sh.half)); }
  both(() => fill(sh.half)); fill(sh.body);
  if (!o.shadow) {
    if (o.detail) {
      both(() => fill(sh.half, 'rgba(20,28,40,.05)'));
      // the fuselage as a cylinder: shaded at the sides, a highlight along the crown
      if (!sh.grad) { const g = cx.createLinearGradient(-sh.h, 0, sh.h, 0);
        g.addColorStop(0, 'rgba(10,18,30,.24)'); g.addColorStop(.2, 'rgba(10,18,30,.05)'); g.addColorStop(.42, 'rgba(255,255,255,.28)'); g.addColorStop(.6, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(10,18,30,.2)'); sh.grad = g; }
      fill(sh.body, sh.grad); fill(sh.body, 'rgba(0,0,0,0)');
      cx.strokeStyle = 'rgba(20,28,40,.28)'; cx.lineWidth = 0.7/m; both(() => cx.stroke(sh.hinge));
      fill(sh.win, 'rgba(14,22,34,.78)');
    }
    fill(sh.fin, 'rgba(20,28,40,.24)');
  }
  // engines on top: rear-mounted, or hung on a high wing
  if (line) { both(() => stroke(sh.over)); stroke(sh.centre); }
  both(() => fill(sh.over)); fill(sh.centre);
  if (!o.shadow) { both(() => fill(sh.over, 'rgba(20,28,40,.18)')); fill(sh.centre, 'rgba(20,28,40,.18)'); }
  if (!o.shadow && sh.props.length) {
    cx.strokeStyle = 'rgba(20,24,30,.8)'; cx.lineWidth = Math.max(0.25, 1.1/m);
    cx.beginPath(); for (const [x, y, d] of sh.props) { cx.moveTo(x - d/2, y); cx.lineTo(x + d/2, y); } cx.stroke();
    if (o.spin) { cx.fillStyle = 'rgba(20,24,30,.12)'; for (const [x, y, d] of sh.props) { cx.beginPath(); cx.ellipse(x, y, d/2, d*0.08, 0, 0, 7); cx.fill(); } }
  }
  cx.restore();
}
