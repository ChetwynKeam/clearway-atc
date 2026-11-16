import pymupdf, json, math, sys
def load(f):
    d=pymupdf.open(f); p=d[0]; M=p.rotation_matrix
    T=lambda pt: tuple(pymupdf.Point(pt)*M)
    out=[]
    for g in p.get_drawings():
        col=tuple(round(x,2) for x in (g.get('color') or ())); fill=tuple(round(x,2) for x in (g.get('fill') or ()))
        paths=[]; cur=[]
        for it in g['items']:
            if it[0]=='l': a,b=T(it[1]),T(it[2]); 
            elif it[0]=='c':
                P=[T(x) for x in it[1:5]]
                pts=[]
                for i in range(0,9):
                    t=i/8; mt=1-t
                    pts.append((mt**3*P[0][0]+3*mt*mt*t*P[1][0]+3*mt*t*t*P[2][0]+t**3*P[3][0], mt**3*P[0][1]+3*mt*mt*t*P[1][1]+3*mt*t*t*P[2][1]+t**3*P[3][1]))
                if cur and math.dist(cur[-1],pts[0])<1e-3: cur+=pts[1:]
                else:
                    if cur: paths.append(cur)
                    cur=pts
                continue
            elif it[0]=='re':
                r=it[1]; q=[T(x) for x in (r.tl,r.tr,r.br,r.bl,r.tl)]
                if cur: paths.append(cur); cur=[]
                paths.append(q); continue
            elif it[0]=='qu':
                q=it[1]; q=[T(x) for x in (q.ul,q.ur,q.lr,q.ll,q.ul)]
                if cur: paths.append(cur); cur=[]
                paths.append(q); continue
            if cur and math.dist(cur[-1],a)<1e-3: cur.append(b)
            else:
                if cur: paths.append(cur)
                cur=[a,b]
        if cur: paths.append(cur)
        out.append(dict(type=g['type'],color=col,fill=fill,width=g.get('width') or 0,paths=paths,dashes=g.get('dashes')))
    words=[]
    for b in p.get_text('rawdict')['blocks']:
        for l in b.get('lines',[]):
            for s in l['spans']:
                txt=''.join(c['c'] for c in s['chars'])
                if not txt.strip(): continue
                bb=pymupdf.Rect(s['bbox'])*M
                words.append((txt.strip(), (bb.x0+bb.x1)/2,(bb.y0+bb.y1)/2, s['size'], tuple(l['dir'])))
    return out, words, p.rect*M if False else (p.rect.height,p.rect.width)
if __name__=='__main__':
    dr,w,sz=load(sys.argv[1]); print(len(dr),len(w),sz)
    for x in w[:400]:
        if len(x[0])<=4: print(x[0], round(x[1],1), round(x[2],1), round(x[3],1), end=' | ')
