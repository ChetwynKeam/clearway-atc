# Stands whose aircraft would stand inside a terminal or other building outline (OpenStreetMap) get no jet bridge: writes VEH_DATA.nobr.
# python3 tools/nobridge_on_buildings.py YSSY   (needs /tmp/vd/<ICAO>.json and /tmp/vd/stands_<ICAO>.json: see tools/synth_bridges.py)
import json,math,sys,re
ICAO=sys.argv[1]
ORIGIN={'EGKK':(51+8/60+53/3600,-(11/60+25/3600)),'LEMD':(40+28/60+20/3600,-(3+33/60+39/3600)),'EGCC':(53+21/60+13/3600,-(2+16/60+30/3600)),'EGLL':(51+28/60+39/3600,-(27/60+41/3600)),'KJFK':(40.639925,-73.778939),'YSSY':(-(33+56/60+46/3600),151+10/60+38/3600)}
LAT0,LON0=ORIGIN[ICAO];KX,KY=60*1852*math.cos(math.radians(LAT0)),60*1852
en=lambda g:((g['lon']-LON0)*KX,(g['lat']-LAT0)*KY)
E=json.load(open(f'/tmp/vd/{ICAO}.json'))['elements']
def inside(p,r):
    c=False;j=len(r)-1
    for i in range(len(r)):
        (xi,yi),(xj,yj)=r[i],r[j]
        if (yi>p[1])!=(yj>p[1]) and p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi:c=not c
        j=i
    return c
B=[]
for e in E:
    t=e.get('tags',{})
    if e['type']=='way' and 'geometry' in e and len(e['geometry'])>3 and (t.get('building') or t.get('aeroway')=='terminal') and t.get('building') not in ('roof','parking') and t.get('aeroway')!='apron':
        B.append(([en(g) for g in e['geometry']],t.get('name') or t.get('building') or t.get('aeroway')))
stands=json.load(open(f'/tmp/vd/stands_{ICAO}.json'))
bad=[]
for s in stands:
    if s['area']!='civil':continue
    sp=s.get('span') or 36;L=72.7 if sp>=78 else 63.7 if sp>52 else 37.5;w=2.0
    h=math.radians(s['hdg']);n=0;hit=0
    for i in range(-10,11):
        for sd in (-w,0,w):
            f=L*i/20;p=(s['x']+f*math.sin(h)+sd*math.cos(h),s['y']+f*math.cos(h)-sd*math.sin(h));n+=1
            if any(inside(p,r) for r,_ in B):hit+=1
    if hit/n>0.45:bad.append(s['id'])
p=f'src/airports/{ICAO.lower()}-veh.js';src=open(p).read();m=re.search(r'const VEH_DATA = (\{.*\});',src);d=json.loads(m.group(1));d['nobr']=bad
open(p,'w').write(src[:m.start(1)]+json.dumps(d,separators=(',',':'))+src[m.end(1):]);print(ICAO,'no bridge at stands inside a building:',bad)
