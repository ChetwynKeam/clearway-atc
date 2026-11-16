# Amsterdam Schiphol (EHAM): every aircraft stand's coordinates from the Dutch AIP's parking/docking charts (AD 2 EHAM
# APDC: Schiphol Centre, the K-apron, the M-apron and the U-apron, AIRAC AMDT 12/2026) -> tools/eham/stands_aip.json
# usage: python3 tools/eham/stands.py EHAM-APDC-CENTRE.pdf EHAM-APDC-K.pdf EHAM-APDC-M.pdf EHAM-APDC-U.pdf tools/eham/stands_aip.json
# The charts' "INS coordinates for aircraft stands" tables: each latitude is paired with the longitude and the stand
# designator on the same printed line (pymupdf word boxes). 276 stands; the AIP gives the stop position ("for aircraft
# stands with multiple stop lines, the INS coordinates reflect the location amidst the two outermost stop lines").
import pymupdf, re, json, sys
res = {}
for f in sys.argv[1:-1]:
    W = pymupdf.open(f)[0].get_text('words')
    lat = [w for w in W if re.fullmatch(r'\d{6}\.\d{2}N', w[4])]
    lon = [w for w in W if re.fullmatch(r'\d{7}\.\d{2}E', w[4])]
    ids = [w for w in W if re.fullmatch(r'(?:[A-Z]\d{1,2}[A-Z]?|P[A-D])', w[4])]
    for la in lat:
        cy = (la[1] + la[3])/2
        lo = min((w for w in lon if abs((w[1] + w[3])/2 - cy) < 2 and w[0] > la[0]), key=lambda w: w[0] - la[0], default=None)
        idw = max((w for w in ids if abs((w[1] + w[3])/2 - cy) < 2 and w[2] <= la[0] + 1 and la[0] - w[2] < 60), key=lambda w: w[2], default=None)
        if lo and idw: res[idw[4]] = (la[4], lo[4])
json.dump(res, open(sys.argv[-1], 'w'), indent=0)
print(len(res), 'stands')
