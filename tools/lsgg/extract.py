import re,sys,subprocess,math,glob,os,json
def white_shapes(svgfile):
    s=open(svgfile).read(); out=[]
    for m in re.finditer(r'<path ([^>]*?)/>',s):
        p=m.group(1)
        if 'rgb(100%, 100%, 100%)' not in p: continue
        d=re.search(r' d="([^"]*)"',p)
        if not d: continue
        nums=[float(x) for x in re.findall(r'-?\d+\.?\d*',d.group(1))]
        xs=nums[0::2]; ys=nums[1::2]
        if not xs: continue
        out.append(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,max(xs)-min(xs),max(ys)-min(ys),len(xs)))
    return out
def words(pdf):
    h=subprocess.run(['pdftotext','-bbox',pdf,'-'],capture_output=True,text=True).stdout
    return [(float(a),float(b),float(c),float(d),t) for a,b,c,d,t in re.findall(r'<word xMin="([^"]*)" yMin="([^"]*)" xMax="([^"]*)" yMax="([^"]*)">([^<]*)</word>',h)]
def analyse(pdf):
    svg='svg/'+os.path.basename(pdf)[:8]+'.svg'
    if not os.path.exists(svg): subprocess.run(['pdftocairo','-svg',pdf,svg],check=True)
    W=words(pdf); S=white_shapes(svg)
    syms=[(x,y,w,h,n) for x,y,w,h,n in S if (11<w<14 and 11<h<14) or (5.5<w<8 and 5.5<h<8 and n>=10)]
    res=[]
    for x,y,w,h,n in syms:
        near=[(math.hypot((a+c)/2-x,(b+d)/2-y),t,(a+c)/2,(b+d)/2) for a,b,c,d,t in W if 'A'<=t[0]<='Z' and len(t)>=3 and t.isalnum() and 14<(d-b)<30 or (a<9999 and False)]
        res.append((x,y,w,n,sorted(near)[:2]))
    return res,W
if __name__=='__main__':
    res,W=analyse(sys.argv[1])
    for r in res: print([round(r[0],1),round(r[1],1),round(r[2],1),r[3]], [(round(d,1),t) for d,t,_,_ in r[4]])
