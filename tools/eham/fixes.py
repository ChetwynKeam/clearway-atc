"""Every significant point the EHAM procedures use -> tools/eham/fixes.json: the named points of the Dutch AIP ENR 4.4,
the navaids of ENR 4.1 (SPL, PAM, SPY ...) and the procedures' own AMxxx points printed with their co-ordinates on the
AD 2 EHAM SID, STAR, transition and approach charts (AIRAC AMDT 12/2026).
usage: fixes.py <AIRAC folder> tools/eham/fixes.json"""
import sys, re, html, json, glob, subprocess
D, OUT = sys.argv[1:3]
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return round(-v if m[4] in 'SW' else v, 6)
F = {}
t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', open(D + '/EH-ENR_4.4-en-GB.html', errors='ignore').read())))
for k, la, lo in re.findall(r'\b([A-Z]{5})\s+(\d{6}(?:\.\d+)?N)\s+(\d{7}(?:\.\d+)?E)', t): F.setdefault(k, [dms(la), dms(lo)])
t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', open(D + '/EH-ENR_4.1-en-GB.html', errors='ignore').read())))
for k, la, lo in re.findall(r'\b([A-Z]{2,3})\s+\d{3}\.\d{3}\s*(?:MHz|kHz)[^N]{0,40}?\s(\d{6}(?:\.\d+)?N)\s+(\d{7}(?:\.\d+)?E)', t): F.setdefault(k, [dms(la), dms(lo)])
for pdf in sorted(glob.glob(D + '/pdf/*.pdf')):
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    for k, la, lo in re.findall(r'\b(AM\d{3}|[A-Z]{5})\s+(\d{6}(?:\.\d+)?N)\s+(\d{7}(?:\.\d+)?E)', txt): F.setdefault(k, [dms(la), dms(lo)])
json.dump(F, open(OUT, 'w'), indent=0, sort_keys=True)
print(len(F), 'points;', 'navaids', sorted(k for k in F if len(k) <= 3))
