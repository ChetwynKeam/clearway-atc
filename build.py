"""Assemble the single-file Clearway simulator from src/ parts, one page per airport (same engine, site and Academy):
LXGB: dist/index.html (GitHub Pages) and dist/gibraltar-atc.html (claude.ai artifact body);
LPMA: dist/lpma/index.html and dist/madeira-atc.html; EGLC: dist/eglc/index.html and dist/london-city-atc.html;
LOWI: dist/lowi/index.html and dist/innsbruck-atc.html; KJFK: dist/kjfk/index.html and dist/new-york-jfk-atc.html."""
import pathlib
root = pathlib.Path(__file__).parent
src = root/'src'
r = lambda n: (src/n).read_text()
import re, urllib.parse
# favicon: the header logo, as an inline SVG data URI
_logo = re.search(r'<svg class="logo".*?</svg>', r('site.html')).group(0).replace(' class="logo"', '').replace(' aria-hidden="true"', '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('"', "'")
fav = 'data:image/svg+xml,' + urllib.parse.quote(_logo, safe=" =:/'.,-")
fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
AIRPORTS = {
    'LXGB': dict(title='Clearway ATC Simulator', desc='Clearway: browser-based air traffic control simulation at real airports: Gibraltar (LXGB), Madeira (LPMA), London City (EGLC), Innsbruck (LOWI) and New York JFK (KJFK).',
                 geo='geo.json', profile=['airports/lxgb.js'], artifact='gibraltar-atc.html', page='index.html'),
    'LPMA': dict(title='Madeira · Clearway ATC Simulator', desc='Clearway: air traffic control at Madeira (LPMA), with the real procedures, wind limits and live traffic.',
                 geo='airports/lpma.geo.json', profile=['airports/lpma.js', 'airports/lpma-engine.js'], artifact='madeira-atc.html', page='lpma/index.html',
                 data=('LPMA', 'airports/lpma.js')),
    'EGLC': dict(title='London City · Clearway ATC Simulator', desc='Clearway: air traffic control at London City (EGLC), with the 5.5° steep approaches, RNAV SIDs and STARs, and live traffic.',
                 geo='airports/eglc.geo.json', profile=['airports/eglc.js', 'airports/eglc-engine.js'], site=['airports/eglc-site.js'], artifact='london-city-atc.html', page='eglc/index.html',
                 data=('EGLC', 'airports/eglc.js')),
    'LOWI': dict(title='Innsbruck · Clearway ATC Simulator', desc='Clearway: air traffic control at Innsbruck (LOWI), in an Alpine valley: the LOC/DME East, circling to 08, RNP AR approaches, föhn and live traffic.',
                 geo='airports/lowi.geo.json', profile=['airports/lowi.js', 'airports/lowi-ground.js', 'airports/lowi-engine.js'], site=['airports/lowi-site.js'], artifact='innsbruck-atc.html', page='lowi/index.html',
                 data=('LOWI', 'airports/lowi.js')),
    'KJFK': dict(title='New York JFK · Clearway ATC Simulator', desc='Clearway: air traffic control at New York JFK (KJFK): four runways, parallel ILS approaches, runway crossings, FAA phraseology and live traffic.',
                 geo='airports/kjfk.geo.json', profile=['airports/kjfk.js', 'airports/kjfk-ground.js', 'airports/kjfk-engine.js'], site=['airports/kjfk-site.js'], artifact='new-york-jfk-atc.html', page='kjfk/index.html',
                 data=('KJFK', 'airports/kjfk.js')),
}
# One website: the airport whose page is index.html hosts every page of the site (home, airports, every briefing, the
# whole Academy, Career). The other airports' pages only run their simulator (#sim, #ex/<key>, #wx/<preset>, #live)
# and send everything else to the host. The host includes their pure-data profiles (data=(global, file)) for
# scenario cards and names; their maps are drawn by their own page in a hidden helper frame (#embed).
HOST = next(k for k, v in AIRPORTS.items() if v['page'] == 'index.html')
# where each airport's page lives, relative to this page (Pages site) or absolute (the claude.ai artifact, a single file)
SITE_URL = 'https://www.clearway-atc.co.uk/'
def links(icao, absolute):
    if absolute: return {k: SITE_URL + ('' if v['page'] == 'index.html' else v['page'].rsplit('/', 1)[0] + '/') for k, v in AIRPORTS.items()}
    up = '../' * AIRPORTS[icao]['page'].count('/')
    return {k: (up or './') if v['page'] == 'index.html' else up + v['page'].rsplit('/', 1)[0] + '/' for k, v in AIRPORTS.items()}
def page(icao, A):
    prof = '\n'.join(r(n) for n in A['profile'])
    others = [(k, B['data']) for k, B in AIRPORTS.items() if k != icao and B.get('data')] if icao == HOST else []
    prof += ''.join('\n' + r(f) for k, (g, f) in others)
    ap_data = '{' + ', '.join(f'{k}: {g}' for k, (g, f) in others) + '}'
    site = '\n'.join(r(n) for n in A.get('site', []))   # the airport's own Academy coach steps, after site.js
    out = f'''<meta charset="utf-8">
<title>{A['title']}</title>
<link rel="icon" type="image/svg+xml" href="{fav}">
<meta name="description" content="{A['desc']}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
{r('styles.css')}
</style>
<style>[data-only]:not([data-only~="{icao}"]){{display:none!important}}</style>
{r('site.html')}
<script>
const AIRPORT = '{icao}';
const SITE = @@SITE@@;
const SITE_HOST = '{HOST}';
const GEO = {r(A['geo']).strip()};
{r('core.js')}
{prof}
const AP_DATA = {ap_data};
{r('sim.js')}
{r('ui.js')}
{r('emerg.js')}
{r('career.js')}
{r('ground.js')}
{r('tiles.js')}
{r('far.js')}
{r('live.js')}
{r('voice.js')}
{r('radio.js')}
{r('site.js')}
{site}
</script>
'''
    import json
    (root/'dist').mkdir(exist_ok=True)
    (root/'dist'/A['artifact']).write_text(out.replace('@@SITE@@', json.dumps(links(icao, True))))
    out = out.replace('@@SITE@@', json.dumps(links(icao, False)))
    head, body = out.split('<style>', 1)
    standalone = ('<!doctype html>\n<html lang="en">\n<head>\n' + head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
                  + '<style>' + body.replace('</style>', '</style>\n</head>\n<body>', 1) + '</body>\n</html>\n')
    (root/'dist'/A['page']).parent.mkdir(parents=True, exist_ok=True)
    (root/'dist'/A['page']).write_text(standalone)
    print(icao, len(out))
for k, A in AIRPORTS.items(): page(k, A)
