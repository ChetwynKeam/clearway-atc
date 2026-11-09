# The stand table of AIP Ireland AD 2.24-2 (EIDW aircraft parking/docking chart, page 2: INS check points) -> stands.json:
# every stand's nose position, largest wingspan and length, how it is used and which stands it shares space with.
# usage: pdftotext -f 2 -l 2 -layout EI_AD_2_EIDW_24-2_en.pdf stands.txt; python3 tools/eidw/stands.py stands.txt > tools/eidw/stands.json
import re, json, sys
rows = {}
st = re.compile(r'(?:(?<=\s)|^)(\d{2,3}[A-Z]?\*?|L[123]\*?)\s+(?=53 ?\d)')
one = re.compile(r'(\S+)\s+(\d\d) (\d\d) (\d\d\.\d+) ?N\s+(\d{3}) (\d\d) ?(\d\d\.\d+) ?W\s+([\d.]+)m\s+([\d.]+)m\s+([A-Z ,]+?)\.?(?:\s{2,}(.*))?$')
for line in open(sys.argv[1]):
    pos = [m.start() for m in st.finditer(line)]
    for i, p in enumerate(pos):
        seg = line[p:pos[i+1] if i+1 < len(pos) else None].strip(); m = one.match(seg)
        if not m: print('unparsed', seg, file=sys.stderr); continue
        rows[m[1].rstrip('*')] = dict(lat=round(int(m[2]) + int(m[3])/60 + float(m[4])/3600, 7), lon=round(-(int(m[5]) + int(m[6])/60 + float(m[7])/3600), 7),
            span=float(m[8]), len=float(m[9]), cond=m[10].replace(',P', ', P').strip(), rem=(m[11] or '').strip().rstrip('.'), unverified=m[1].endswith('*'))
json.dump(rows, sys.stdout, indent=0)
print(len(rows), 'stands', file=sys.stderr)
