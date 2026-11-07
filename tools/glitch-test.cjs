const {chromium}=require('playwright');
const code=process.argv[2]||'egll', mins=+process.argv[3]||60, wx=process.argv[4]||'';
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/dist/'+code+'/index.html'+'#wx/'+(wx||'fair'));await p.waitForTimeout(2500);
const r=await p.evaluate(async function(mins){
 try{cwGate=()=>true}catch(e){}
 for(const k of AI_SEATS)S.seats[k]='AI';try{liveBox.checked=false}catch(e){}$('trafficSel').value='event';$('hourSel').value='8';$('daySel').value='1';start();
 const T={},G=[],seen={};
 const rad=Math.PI/180;
 const dh=(a,b)=>Math.abs(((a-b)+540)%360-180);
 const add=(t,cs,msg)=>{const k=t+cs;if(seen[k])return;seen[k]=1;G.push({t,cs,msg,time:Math.round(S.t)})};
 let n=0;
 for(let i=0;i<mins*60;i++){
  try{step(1)}catch(e){add('EXC','-',String(e.message).slice(0,160));break}
  for(const a of S.acs){
   if(a.ground||!a.airborne&&a.kind==='DEP'&&a.state!=='CLIMB'&&a.state!=='AIRBORNE')continue;
   const t=T[a.cs]=T[a.cs]||{h:[],mx:0,tot:0,last:null,low:0,mode:{}};
   const hd=a.trk??a.hdg;
   t.h.push([hd,a.alt,a.x,a.y,a.mode]);if(t.h.length>12)t.h.shift();
   if(t.h.length===12&&i%3===0){const turn=dh(t.h[11][0],t.h[0][0]); const mode=t.h[11][4];
     if(turn>40&&mode==='NAV'&&t.h[0][4]==='NAV')add('SHARPTURN',a.cs,`${a.kind} ${a.d||''} turn ${Math.round(turn)} deg in 12s at alt ${Math.round(a.alt)} dist ${Math.round(Math.hypot(a.x,a.y))}NM`)}
   // low and far departure
   if(a.kind==='DEP'&&a.airborne){const d=Math.hypot(a.x,a.y);if(d>22&&a.alt<4000&&!a.aiLev)t.low++;else if(d>22&&a.alt<3000)t.low++; if(t.low===120)add('LOWFAR',a.cs,`${a.d} alt ${Math.round(a.alt)} at ${Math.round(d)}NM${a.handed?' handed':''} lev=${a.aiLev?1:0}`)
     // wrong way: beyond 25 NM, track >110deg from bearing to destination
     if(d>25&&typeof destOf==='function'){const de=destOf(a);if(de&&typeof gcBrg==='function'){const pl=toLL([a.x,a.y]);const br=gcBrg(pl,de);if(dh(hd,br)>110&&a.mode==='NAV')t.wrong=(t.wrong||0)+1; if(t.wrong===90)add('WRONGWAY',a.cs,`${a.d} track ${Math.round(hd)} vs bearing ${Math.round(br)} at ${Math.round(d)}NM sid=${a.sid}`)}}}
   // stuck: airborne arrival very slow
   if(a.ias<110&&a.alt>1500&&a.kind==='ARR'){t.slow=(t.slow||0)+1;if(t.slow===60)add('SLOW',a.cs,`ARR ias ${Math.round(a.ias)} alt ${Math.round(a.alt)} mode ${a.mode}`)}
   // cumulative turning (loops)
   if(t.prev!=null){const d=((hd-t.prev+540)%360)-180;t.tot=(t.tot||0)+d;if(a.mode==='HOLD'||a.mode==='HDG'||a.state==='VECTORS'||a.state==='HOLDING'||a.state==='MISSED')t.tot=0;if(Math.abs(t.tot)>420&&a.mode!=='HOLD'){add('LOOP',a.cs,`${a.kind} turned ${Math.round(t.tot)} deg in mode ${a.mode} alt ${Math.round(a.alt)}`);t.tot=0}} t.prev=hd;
  }
  // separation
  if(i%5===0){const A=S.acs.filter(a=>!a.ground&&a.alt>300);for(let x=0;x<A.length;x++)for(let y=x+1;y<A.length;y++){const a=A[x],c=A[y];const d=Math.hypot(a.x-c.x,a.y-c.y);if(d<1.6&&Math.abs(a.alt-c.alt)<500&&!(a.state==='FINAL'&&c.state==='FINAL')) add('LOSS',a.cs+'/'+c.cs,`${d.toFixed(1)}NM ${Math.round(Math.abs(a.alt-c.alt))}ft ${a.kind}/${c.kind} alts ${Math.round(a.alt)} ${a.mode}:${a.state}:${a.hold&&a.hold.name||''}:${a.aiLev?'L':''} | ${c.mode}:${c.state}:${c.hold&&c.hold.name||''}:${c.aiLev?'L':''} t=${Math.round(S.t)}`)}}
 }
 return {G,t:S.t,n:S.acs.length}
},mins);
console.log(code,'simmed',Math.round(r.t/60),'min; flights now',r.n,'; errors',errs.slice(0,3).join(' | '));
const by={};for(const g of r.G)(by[g.t]=by[g.t]||[]).push(g);
for(const k in by){console.log(' ',k,by[k].length);for(const g of by[k].slice(0,4))console.log('     ',g.cs,g.msg)}
await b.close()})();
