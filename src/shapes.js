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

// build one type's outline as Path2Ds, centred on mid-length (acMid), nose up at -len/2
function buildShape(fam, span, len){
  const F = AC_FAM[fam], kx = span/F.ref[0], h = F.fw/2, Y0 = len/2, b = span/2, W = F.wing, tanD = d => Math.tan(d*D2R);
  const frame = new Path2D(), wings = new Path2D(), under = new Path2D(), over = new Path2D(), fin = new Path2D(), win = new Path2D(), props = [];
  // the left side is traced backwards, so both sides wind the same way as the fuselage and the nonzero fill joins them
  const mirror = (path, pts) => { for (const s of [1, -1]) { const q = s > 0 ? pts : pts.slice().reverse(); path.moveTo(s*q[0][0], q[0][1] - Y0); for (const [x, y] of q.slice(1)) path.lineTo(s*x, y - Y0); path.closePath(); } };
  // fuselage: ogive nose, parallel cabin, tail cone tapering to the APU
  const te = F.tail != null ? F.tail : 0.3;
  frame.moveTo(0, -Y0);
  frame.bezierCurveTo(h*0.55, -Y0, h, F.nose*0.45 - Y0, h, F.nose - Y0); frame.lineTo(h, len - F.cone - Y0); frame.quadraticCurveTo(h, len - F.cone*0.3 - Y0, te, len - Y0);
  frame.lineTo(-te, len - Y0); frame.quadraticCurveTo(-h, len - F.cone*0.3 - Y0, -h, len - F.cone - Y0); frame.lineTo(-h, F.nose - Y0); frame.bezierCurveTo(-h, F.nose*0.45 - Y0, -h*0.55, -Y0, 0, -Y0);
  frame.closePath();
  // wing
  const yLE = W.le*len, sw = tanD(W.sw), tc = W.tc*kx, rk = W.rake && span >= W.rake[2] ? W.rake : null;
  const leAt = x => { const y = yLE + (x - h)*sw; return rk && x > b - rk[0] ? y + (x - (b - rk[0]))*(tanD(W.sw + rk[1]) - sw) : y; };
  const wpts = [[h*0.9, yLE]];
  if (rk) wpts.push([b - rk[0], leAt(b - rk[0])]);
  wpts.push([b, leAt(b)], [b, leAt(b) + tc*(rk ? 0.55 : 1)]);
  if (W.kink) { const xk = h + W.kink*(b - h), yk = leAt(xk) + W.kc*kx; if (rk) wpts.push([b - rk[0], leAt(b - rk[0]) + tc]); wpts.push([xk, yk], [h*0.9, yk]); }
  else { if (rk) wpts.push([b - rk[0], leAt(b - rk[0]) + tc]); wpts.push([h*0.9, yLE + W.rc*kx]); }
  mirror(frame, wpts); mirror(wings, wpts);
  // tailplane
  const T = F.ht, yT = T.le*len, ts = T.span*kx/2, tst = tanD(T.sw);
  const tpts = [[0, yT], [ts, yT + ts*tst], [ts, yT + ts*tst + T.tc*kx], [0, yT + T.rc*kx]];
  mirror(frame, tpts);
  // fin seen from above: a narrow ridge on the centreline (ahead of the tailplane only, on a T-tail)
  const fy = F.fin*len, ft = Math.max(0.3, F.fw*0.1), fe = T.t ? yT + 0.3 : len - 0.4;
  fin.moveTo(0, fy - Y0); fin.lineTo(ft/2, fy + (fe - fy)*0.35 - Y0); fin.lineTo(ft/2, fe - Y0); fin.lineTo(-ft/2, fe - Y0); fin.lineTo(-ft/2, fy + (fe - fy)*0.35 - Y0); fin.closePath();
  // engines
  const pod = (path, x, y, l, d) => { const r = d/2; path.moveTo(x - r, y + r*0.8 - Y0); path.quadraticCurveTo(x - r, y - Y0, x - r*0.85, y - Y0); path.lineTo(x + r*0.85, y - Y0); path.quadraticCurveTo(x + r, y - Y0, x + r, y + r*0.8 - Y0);
    path.lineTo(x + r*0.6, y + l - Y0); path.lineTo(x - r*0.6, y + l - Y0); path.closePath(); };
  for (const e of F.eng || []) for (const s of [1, -1]) { const x = s*(e.s*b), y = leAt(Math.abs(x)) - e.fwd; pod(W.high ? over : under, x, y, e.l, e.d); if (e.prop) props.push([x, y - 0.25 - Y0, e.prop]); }
  for (const e of F.rear || []) for (const s of e.x ? [1, -1] : [1]) pod(over, s*e.x, e.y*len, e.l, e.d);
  if (F.noseProp) props.push([0, -0.2 - Y0, F.noseProp]);
  // flight-deck windows
  const wy = F.nose*0.55, ww = h*0.62;
  win.moveTo(-ww, wy - Y0); win.quadraticCurveTo(0, wy - F.nose*0.16 - Y0, ww, wy - Y0); win.lineTo(ww*0.8, wy + F.nose*0.1 - Y0); win.quadraticCurveTo(0, wy - F.nose*0.04 - Y0, -ww*0.8, wy + F.nose*0.1 - Y0); win.closePath();
  return { frame, wings, under, over, fin, win, props, tip: [b, leAt(b) + tc*0.5 - Y0], size: Math.max(span, len), high: !!W.high };
}
const SHAPES = new Map();
function acShape(t, span, len){
  const fam = acFam(t), k = fam + '|' + span + '|' + len;
  let s = SHAPES.get(k); if (!s) { s = buildShape(fam, span, len); SHAPES.set(k, s); }
  return s;
}
// draw a shape at m px per metre. o: { line: outline colour, lw: outline px, shadow: fill only, detail: windows and shading }
function drawShape(sh, X, Y, hdg, m, col, o){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); cx.scale(m, m);
  cx.lineJoin = 'round';
  const outline = p => { if (!o.shadow && o.line) { cx.strokeStyle = o.line; cx.lineWidth = 2*o.lw/m; cx.stroke(p); } cx.fillStyle = col; cx.fill(p); };
  // engines under a low wing first, so the wing covers their back and only the intakes show ahead of it
  outline(sh.under); if (!o.shadow) { cx.fillStyle = 'rgba(20,28,40,.16)'; cx.fill(sh.under); }
  outline(sh.frame);
  if (!o.shadow) {
    if (o.detail) { cx.fillStyle = 'rgba(20,28,40,.06)'; cx.fill(sh.wings); }
    cx.fillStyle = 'rgba(20,28,40,.22)'; cx.fill(sh.fin);
    if (o.detail) { cx.fillStyle = 'rgba(14,22,34,.75)'; cx.fill(sh.win); }
  }
  outline(sh.over); if (!o.shadow) { cx.fillStyle = 'rgba(20,28,40,.16)'; cx.fill(sh.over); }
  if (!o.shadow && sh.props.length) {
    cx.strokeStyle = 'rgba(20,24,30,.8)'; cx.lineWidth = Math.max(0.25, 1.1/m);
    cx.beginPath(); for (const [x, y, d] of sh.props) { cx.moveTo(x - d/2, y); cx.lineTo(x + d/2, y); } cx.stroke();
    if (o.spin) { cx.fillStyle = 'rgba(20,24,30,.12)'; for (const [x, y, d] of sh.props) { cx.beginPath(); cx.ellipse(x, y, d/2, d*0.08, 0, 0, 7); cx.fill(); } }
  }
  cx.restore();
}
