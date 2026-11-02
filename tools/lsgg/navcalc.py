import json, math
raw=json.load(open('fixes_raw.json'))
F={k:(sum(v[1] for v in vs)/len(vs), sum(v[2] for v in vs)/len(vs)) for k,vs in raw.items() if k!='ROCCA'}
F['ROCCA_a']=(19.16,-27.26); F['ROCCA_b']=(21.98,-29.94)
F['PAS']=(-4.68,-4.44); F['CBY']=(-15.15,-21.12); F['GEVEA']=(0.0,0.0)
VAR=3.0
def mv(p,b,d): r=math.radians(b+VAR); return (p[0]+d*math.sin(r), p[1]+d*math.cos(r))
def brgd(a,b): return (math.degrees(math.atan2(b[0]-a[0],b[1]-a[1]))+360)%360
def dst(a,b): return math.hypot(b[0]-a[0],b[1]-a[1])
# rubber-band chain A: CBY -> ... -> GG512 -> SAPRE
legs=[('GG502',7.3,42),('PITOM',12,42),('BIVLO',8.8,43),('GG525',8.7,43),('GG512',8.5,43),('SAPRE',6,313)]
def solve(start,end,legs):
    best=None
    for vi in range(-100,200):
        v=vi/10
        for si in range(900,1101,2):
            s=si/1000
            p=start
            for n,L,b in legs:
                r=math.radians(b+v); p=(p[0]+s*L*math.sin(r),p[1]+s*L*math.cos(r))
            e=dst(p,end)
            if best is None or e<best[0]: best=(e,v,s)
    return best
e,v,s=solve(F['CBY'],F['SAPRE'],legs); print('chainA fit: err %.2f NM, var %.1f, scale %.3f'%(e,v,s))
p=F['CBY']
for n,L,b in legs:
    r=math.radians(b+v); p=(p[0]+s*L*math.sin(r),p[1]+s*L*math.cos(r)); F[n]=p
VAR=v
# BELUS chain
F['RILTI']=mv(F['CBY'],51+180,8.5*s); F['BELUS']=mv(F['RILTI'],26+180,5.7*s)
# BANKO chain from BIVLO
F['SUVEL']=mv(F['BIVLO'],301+180,4.9*s); F['VALBU']=mv(F['SUVEL'],301+180,7*s); F['GOLEB']=mv(F['VALBU'],301+180,3.7*s)
F['GG520']=mv(F['GOLEB'],301+180,10.3*s); F['BANKO']=mv(F['GG520'],301+180,14.5*s)
# KINES chain
F['ROCCA']=F['ROCCA_b']; F['GG519']=mv(F['ROCCA'],347+180,13.3*s); F['KINES']=mv(F['GG519'],346+180,12*s)
print('ROCCA chain',tuple(round(x,1) for x in F['ROCCA']),'vs SID',F['ROCCA_a'],F['ROCCA_b'])
# north chains from SAPRE
F['VADAR']=mv(F['SAPRE'],225+180,17*s); F['NEMOS']=mv(F['VADAR'],200+180,16.5*s); F['BENOT']=mv(F['NEMOS'],228+180,14*s)
F['VEROX']=mv(F['SAPRE'],196+180,16.4*s); print('NEMOS->VEROX',round(dst(F['NEMOS'],F['VEROX']),1),'(chart 17.6)')
F['ESEVA']=mv(F['VADAR'],225+180,13.8*s); F['ULMES']=mv(F['ESEVA'],228+180,14.7*s); F['FRIBU']=mv(F['VADAR'],247+180,20.7*s)
json.dump({k:[round(a,2),round(b,2)] for k,(a,b) in F.items()},open('fixes_nm.json','w'),indent=0)
for k in sorted(F): print(k,round(F[k][0],2),round(F[k][1],2))
