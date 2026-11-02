import re,sys,subprocess,math,glob,os,json
from extract import white_shapes, words
def pathinfo(s):
    for m in re.finditer(r'<path ([^>]*?)/>',s):
        p=m.group(1); d=re.search(r' d="([^"]*)"',p)
        if not d: continue
        nums=[float(x) for x in re.findall(r'-?\d+\.?\d*',d.group(1))]
        xs=nums[0::2]; ys=nums[1::2]
        if not xs: continue
        f=re.search(r'fill="([^"]*)"',p)
        yield (f.group(1) if f else '-'), min(xs),min(ys),max(xs),max(ys),len(xs),d.group(1)
FIX=re.compile(r'^([A-Z]{5}|GG\d{3}|[A-Z]{3}|[A-Z]\d{2}[A-Z])$')
def chart(pdf):
    key=os.path.basename(pdf)[:8]; svg=f'svg/{key}.svg'
    if not os.path.exists(svg): subprocess.run(['pdftocairo','-svg',pdf,svg],check=True)
    s=open(svg).read(); P=list(pathinfo(s))
    # runway symbol: grey circle n=14 r~13.4
    rw=[(x0+x1)/2 for f,x0,y0,x1,y1,n,d in P if f.startswith('rgb(78.4') and n==14 and 25<x1-x0<29]
    rws=[((x0+x1)/2,(y0+y1)/2) for f,x0,y0,x1,y1,n,d in P if f.startswith('rgb(78.4') and n==14 and 20<x1-x0<45 and abs((x1-x0)-(y1-y0))<2]
    # runway black rectangle
    rect=[(x0,y0,x1,y1,d) for f,x0,y0,x1,y1,n,d in P if f=='rgb(0%, 0%, 0%)' and n==5 and 10<(x1-x0)+(y1-y0)<60]
    # scale bar: black rect height ~4.2 near bottom, adjoining white rect
    bars=[(x0,x1,y0) for f,x0,y0,x1,y1,n,d in P if 3.5<y1-y0<5 and n<=6 and 700<y0<790 and 60<x0<200 and f in ('rgb(0%, 0%, 0%)','rgb(100%, 100%, 100%)')]
    return dict(key=key,rwy=rws,rect=rect,bars=sorted(bars))
if __name__=='__main__':
    for pdf in sorted(glob.glob('/mnt/user-data/uploads/LSGG/*.pdf')):
        c=chart(pdf); print(c['key'],'rwy',[(round(a,1),round(b,1)) for a,b in c['rwy']],'bars',[(round(a,1),round(b,1)) for a,b,_ in c['bars']])
