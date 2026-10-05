import re, urllib.request, urllib.parse, collections, time
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0'}
seen, q, log, pdfs = set(), collections.deque(['https://eaip.austrocontrol.at/']), [], set()
t0 = time.time()
while q and len(seen) < 500 and time.time() - t0 < 900:
    u = q.popleft()
    if u in seen: continue
    seen.add(u)
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30) as r: b = r.read(); ct = r.headers.get('content-type', ''); fu = r.geturl()
    except Exception as e: log.append(f'ERR {u} {e}'); continue
    log.append(f'{len(b)} {ct} {u}')
    if 'pdf' in ct or u.lower().endswith('.pdf'):
        if 'LOWI' in u.upper(): open(re.sub(r'[^A-Za-z0-9_.-]', '_', u.split('/')[-1]), 'wb').write(b)
        continue
    h = b.decode('utf-8', 'replace')
    if 'LOWI' in u.upper(): open('page_' + re.sub(r'[^A-Za-z0-9_.-]', '_', u[29:])[-120:] + '.html', 'w').write(h)
    for l in re.findall(r'(?:href|src)\s*=\s*["\']([^"\'#]+)', h) + re.findall(r'(?:location|window\.open)\S*\(?\s*["\']([^"\']+)', h):
        a = urllib.parse.urljoin(fu, l)
        if not a.startswith('https://eaip.austrocontrol.at/') or a in seen: continue
        A = a.upper()
        if A.endswith('.PDF'):
            if 'LOWI' in A: q.appendleft(a)
        elif re.search(r'\.(HTML?|PHP|ASPX?)$|/$', A) and (re.search(r'INDEX|MENU|TOC|FRAME|NAV|LO_AD|/AD|LOWI|/LO/|AIRAC|EAIP|HISTORY|CURRENT', A)) and not re.search(r'LO_(GEN|ENR)_|/(GEN|ENR)[_/]', A):
            q.append(a)
open('crawl_log.txt', 'w').write('\n'.join(log))
