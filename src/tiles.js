// ═════════════════════════ map imagery (tower and ground views) ═════════════════════════
// Web Mercator tiles drawn under the airfield overlays. Each tile's corners go through the same xy() projection
// as everything else, so imagery and sim geometry share one frame. Falls back to the drawn chart when tiles can't
// load (the claude.ai viewer blocks outside images) or when the player picks "Drawn".
const MAP_SRC = {
  sat: { name: 'Satellite', max: 19, url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
         credit: 'Imagery © Esri, Maxar, Earthstar Geographics' },
  street: { name: 'Map', max: 19, url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
            credit: '© OpenStreetMap contributors' }
};
const TILE = { cache: new Map(), ok: 0, err: 0, failed: false, use: 0 };
let MAP_LAYER = 'sat';
try { const v = localStorage.getItem('cw-map'); if (v === 'drawn' || MAP_SRC[v]) MAP_LAYER = v; } catch(_) {}

const tx2lon = (x, z) => x/2**z*360 - 180;
const ty2lat = (y, z) => Math.atan(Math.sinh(Math.PI*(1 - 2*y/2**z)))*R2D;
const lon2tx = (lon, z) => (lon + 180)/360*2**z;
const lat2ty = (lat, z) => { const r = lat*D2R; return (1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2*2**z; };
const xy2ll = (x, y) => [y/60 + LAT0, x/(60*COSL) + LON0];

function tileImg(src, z, x, y){
  const key = `${src}/${z}/${x}/${y}`; let t = TILE.cache.get(key);
  if (!t) {
    if (TILE.cache.size > 700) { const old = [...TILE.cache.entries()].sort((a, b) => a[1].use - b[1].use).slice(0, 200); for (const [k] of old) TILE.cache.delete(k); }
    const img = new Image(); t = { img, ok: false, bad: false, use: 0 };
    img.onload = () => { t.ok = true; TILE.ok++; };
    img.onerror = () => { t.bad = true; TILE.err++; if (TILE.ok === 0 && TILE.err >= 6) TILE.failed = true; };
    img.src = MAP_SRC[src].url(z, x, y); TILE.cache.set(key, t);
  }
  t.use = ++TILE.use; return t;
}
const peekTile = (src, z, x, y) => TILE.cache.get(`${src}/${z}/${x}/${y}`);

// true when the scope should show imagery instead of the drawn ground
function mapImagery(){
  return MAP_LAYER !== 'drawn' && !TILE.failed && V.scale > 70 && cv && cv.id === 'scope';
}
function drawImagery(){
  const src = MAP_LAYER, S0 = MAP_SRC[src];
  const [la1, lo1] = xy2ll(wx2(0), wy2(0)), [la2, lo2] = xy2ll(wx2(W), wy2(H));
  const mpp = 1852/V.scale/DPR, res0 = 156543.034*Math.cos(LAT0*D2R);
  let z = clamp(Math.round(Math.log2(res0/mpp) + 0.6), 12, S0.max);
  let x0, x1, y0, y1;
  for (;;) {
    x0 = Math.floor(lon2tx(lo1, z)); x1 = Math.floor(lon2tx(lo2, z)); y0 = Math.floor(lat2ty(la1, z)); y1 = Math.floor(lat2ty(la2, z));
    if ((x1 - x0 + 1)*(y1 - y0 + 1) <= 160 || z <= 12) break; z--;
  }
  cx.save(); cx.imageSmoothingQuality = 'high';
  const rect = (zz, x, y) => { const a = xy(ty2lat(y, zz), tx2lon(x, zz)), b = xy(ty2lat(y + 1, zz), tx2lon(x + 1, zz)); return [sx(a[0]), sy(a[1]), sx(b[0]), sy(b[1])]; };
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const t = tileImg(src, z, x, y), [X0, Y0, X1, Y1] = rect(z, x, y);
    if (t.ok) { cx.drawImage(t.img, Math.floor(X0), Math.floor(Y0), Math.ceil(X1 - X0) + 1, Math.ceil(Y1 - Y0) + 1); continue; }
    // not loaded yet: stretch the nearest cached ancestor so the view never flashes blank
    for (let up = 1; up <= 5; up++) {
      const zz = z - up, k = 2**up, px = Math.floor(x/k), py = Math.floor(y/k), p = peekTile(src, zz, px, py);
      if (p && p.ok) { const s = 256/k; cx.drawImage(p.img, (x - px*k)*s, (y - py*k)*s, s, s, Math.floor(X0), Math.floor(Y0), Math.ceil(X1 - X0) + 1, Math.ceil(Y1 - Y0) + 1); break; }
    }
  }
  // dark theme: dim the photo to a night scene so lighting and data blocks stand out
  if (C.name === 'dark') { cx.fillStyle = src === 'sat' ? 'rgba(2,10,16,.58)' : 'rgba(2,10,16,.72)'; cx.fillRect(0, 0, W, H); }
  cx.restore();
}
function drawImageryCredit(){
  const txt = MAP_SRC[MAP_LAYER].credit; cx.font = `10px ${FONT_L}`; const w = cx.measureText(txt).width + 10;
  cx.fillStyle = 'rgba(255,255,255,.72)'; cx.fillRect(W - 12 - w, H - 19, w, 15); cx.fillStyle = '#334'; cx.fillText(txt, W - 7 - w, H - 8);
}
// stand numbers only (the photo already shows the painted stand markings)
function drawStandTags(c, mpx){
  if (V.scale <= 160) return;
  for (const s of STANDS) {
    const box = s.area === 'civil' ? 40 : s.area === 'north' ? 32 : 46, h = s.hdg*D2R, bh = box*mpx;
    const fs = Math.max(9, 3.4*mpx); cx.font = `700 ${fs}px ${FONT_L}`; const tw = cx.measureText(s.id).width + fs*0.6;
    cx.save(); cx.translate(sx(s.p[0]), sy(s.p[1])); cx.rotate(h);
    const flip = Math.cos(h) < 0; if (flip) cx.rotate(Math.PI);
    const yb = flip ? -bh*0.42 - fs*0.2 : bh*0.42 - fs*1.0;
    cx.fillStyle = '#111'; cx.fillRect(-tw/2, yb, tw, fs*1.2); cx.fillStyle = C.yellow; cx.textAlign = 'center'; cx.fillText(s.id, 0, yb + fs*0.95); cx.textAlign = 'left';
    cx.restore();
  }
}
function setMapLayer(k){
  MAP_LAYER = k; TILE.failed = false; TILE.ok = 0; TILE.err = 0;
  const bt = document.getElementById('tgMap'); if (bt) bt.textContent = k === 'drawn' ? 'Drawn map' : MAP_SRC[k].name;
  try { localStorage.setItem('cw-map', k); } catch(_) {}
}
{ const bt = document.getElementById('tgMap'); if (bt) bt.onclick = () => setMapLayer(MAP_LAYER === 'sat' ? 'street' : MAP_LAYER === 'street' ? 'drawn' : 'sat'); }
setMapLayer(MAP_LAYER);
