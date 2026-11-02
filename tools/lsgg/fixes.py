import re,sys,math,glob,os,json,collections
from georef import chart, FIX
from extract import white_shapes, words
res=collections.defaultdict(list)
for pdf in sorted(glob.glob('/mnt/user-data/uploads/LSGG/*.pdf')):
    c=chart(pdf)
    if not c['rwy'] or not c['bars']: continue
    ax,ay=c['rwy'][0]
    sc=(c['bars'][-1][1]-c['bars'][0][0])/10.0     # pt per NM
    S=white_shapes(f"svg/{c['key']}.svg"); W=words(pdf)
    lab=[(a,b,cc,d,t) for a,b,cc,d,t in W if FIX.match(t) and 170<b<765 and a>46]
    for x,y,w,h,n in S:
        if not ((11<w<14 and 11<h<14 and n>=20) or (5.5<w<8 and 5.5<h<8 and 12<=n<=16)): continue
        if not (170<y<765 and x>46): continue
        near=sorted((math.hypot((a+cc)/2-x,(b+d)/2-y),t) for a,b,cc,d,t in lab)
        if not near or near[0][0]>45: continue
        res[near[0][1]].append((c['key'],round((x-ax)/sc,2),round(-(y-ay)/sc,2),round(near[0][0])))
for k in sorted(res):
    print(k, res[k])
json.dump(res,open('fixes_raw.json','w'))
