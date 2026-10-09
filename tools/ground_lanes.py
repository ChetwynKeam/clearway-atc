# Crossovers between the parallel lines of a lane painted with more than one (Manchester's NA, NB and Z: a blue and an
# orange line either side of the centre line; Gatwick's S: S West in blue, S East in red, either side of S), shared by
# the ground generators. Aircraft may cut across from one line to the next, so 45-degree links join neighbouring lines,
# one of each slant per pair of lines every 100 m or so (one for each direction of travel). They carry the lane's name
# and line 'x' (not painted).
# edges: [a, b, name, mid points, line?] (only names with a line-tagged edge get crossovers); nodes: [id, e, n], added to;
# gates: [stand, terminal, stop point, ..., painted lead-in at index 5 (if any)]. Returns the new edge list.
import math, collections
def add_crossovers(edges, nodes, gates, r1):
    lined = {e[2] for e in edges if len(e) > 4 and e[4]}
    PN = {n[0]: (n[1], n[2]) for n in nodes}
    def epl(e): return [PN[e[0]]] + [tuple(p) for p in e[3]] + [PN[e[1]]]
    lanes = collections.defaultdict(list)                              # name -> [(edge, i, q0, q1)]
    for e in edges:
        pl = epl(e)
        for i in range(len(pl) - 1):
            if math.dist(pl[i], pl[i+1]) > 0.5: lanes[e[2]].append((e, i, pl[i], pl[i+1]))
    def foot(p, segs):
        best = None
        for e, i, q0, q1 in segs:
            ex, ey = q1[0]-q0[0], q1[1]-q0[1]; LL = ex*ex + ey*ey; u = max(0, min(1, ((p[0]-q0[0])*ex + (p[1]-q0[1])*ey)/LL))
            q = (q0[0] + ex*u, q0[1] + ey*u); d = math.dist(p, q)
            if best is None or d < best[0]: best = (d, e, i, u, q, (ex/math.sqrt(LL), ey/math.sqrt(LL)))
        return best
    def seg_x(a, b, c, d):
        def cr(o, p, q): return (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0])
        return cr(a, b, c)*cr(a, b, d) < 0 and cr(c, d, a)*cr(c, d, b) < 0
    allsegs = [s for v in lanes.values() for s in v]
    paints = [(g[5][j], g[5][j+1]) for g in gates if len(g) > 5 and g[5] for j in range(len(g[5]) - 1)]
    def link_ok(a, b):
        """a crossover a-b: clear of every other line, painted lead-in and stand, and of the graph's junctions"""
        L = math.dist(a, b); ux, uy = (b[0]-a[0])/L, (b[1]-a[1])/L
        a2, b2 = (a[0] + ux*1.5, a[1] + uy*1.5), (b[0] - ux*1.5, b[1] - uy*1.5)
        if any(seg_x(a2, b2, q0, q1) for _, _, q0, q1 in allsegs): return False
        if any(seg_x(a, b, q0, q1) for q0, q1 in paints): return False
        mid = ((a[0]+b[0])/2, (a[1]+b[1])/2)
        if any(math.dist(mid, g[2]) < 30 for g in gates): return False
        return True
    XO, taken = [], []                                                # [(foot on one line, foot on the next, name)], accepted links
    def clear_of_nodes(q): return all(math.dist(q, v) >= 10 for v in PN.values()) and all(math.dist(q, x) >= 10 for t in taken for x in t[:2])
    for name, segs in lanes.items():
        if name not in lined or len(segs) < 4: continue
        for e, i, q0, q1 in segs:
            Ls = math.dist(q0, q1); u = ((q1[0]-q0[0])/Ls, (q1[1]-q0[1])/Ls)
            s = 2.0
            while s < Ls - 2:
                p = (q0[0] + u[0]*s, q0[1] + u[1]*s); s += 2
                # the neighbouring line: a same-named lane 15-30 m off square to this one, running parallel
                f = foot(p, [x for x in segs if x[0] is not e])
                if not f or not 15 < f[0] < 30: continue
                g, q = f[0], f[4]; n = ((q[0]-p[0])/g, (q[1]-p[1])/g)
                if abs(n[0]*u[0] + n[1]*u[1]) > 0.08 or abs(f[5][0]*u[1] - f[5][1]*u[0]) > 0.1: continue
                if not clear_of_nodes(p): continue
                for sg in (1, -1):
                    pb = (q[0] + sg*u[0]*g, q[1] + sg*u[1]*g); fb = foot(pb, segs)
                    if fb[0] > 1.0 or abs(fb[5][0]*u[1] - fb[5][1]*u[0]) > 0.1 or not clear_of_nodes(fb[4]): continue
                    a_, b_ = p, fb[4]; dv = ((b_[0]-a_[0]), (b_[1]-a_[1])); dl = math.hypot(*dv); dv = (dv[0]/dl, dv[1]/dl)
                    mid = ((a_[0]+b_[0])/2, (a_[1]+b_[1])/2)
                    # one of each kind ("/" or "\") per pair of lines every 100 m, never crossing another
                    if any(abs(dv[0]*t[2][1] - dv[1]*t[2][0]) < 0.3 and math.dist(mid, t[3]) < 100 and abs((t[3][0]-mid[0])*n[0] + (t[3][1]-mid[1])*n[1]) < 6 for t in taken): continue
                    if any(seg_x(a_, b_, t[0], t[1]) for t in taken) or not link_ok(a_, b_): continue
                    fa = (0, e, i, s/Ls - 2/Ls, p)
                    taken.append((a_, b_, dv, mid)); XO.append((fa, fb, name)); break
    # split the lanes where the crossovers meet them, then add the links
    xs = collections.defaultdict(list)
    for k, (fa, fb, name) in enumerate(XO):
        for j, f in enumerate((fa, fb)): xs[id(f[1])].append((f[2] + f[3], 'c%d%s' % (k, 'ab'[j]), f[4], f[1]))
    newedges = []
    for e in edges:
        lst = sorted(xs.get(id(e), []))
        if not lst: newedges.append(e); continue
        pl = epl(e); prev, mids, k = e[0], [], 0
        for idx in range(len(pl) - 1):
            while k < len(lst) and lst[k][0] <= idx + 1:
                nn, q = lst[k][1], lst[k][2]
                nodes.append([nn, r1(q[0]), r1(q[1])]); PN[nn] = q
                newedges.append([prev, nn, e[2], [[r1(x) for x in m] for m in mids]] + e[4:]); prev, mids = nn, []; k += 1
            if idx + 1 < len(pl) - 1: mids.append(pl[idx+1])
        newedges.append([prev, e[1], e[2], [[r1(x) for x in m] for m in mids]] + e[4:])
    for k, (fa, fb, name) in enumerate(XO): newedges.append(['c%da' % k, 'c%db' % k, name, [], 'x'])
    print('crossovers', len(XO), collections.Counter(x[2] for x in XO))
    return newedges
