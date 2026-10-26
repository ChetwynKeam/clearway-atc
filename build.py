"""Assemble the single-file Clearway simulator from src/ parts, one page per airport (same engine, site and Academy):
LXGB: dist/index.html (GitHub Pages) and dist/gibraltar-atc.html (claude.ai artifact body);
LPMA: dist/lpma/index.html and dist/madeira-atc.html; EGLC: dist/eglc/index.html and dist/london-city-atc.html;
LOWI: dist/lowi/index.html and dist/innsbruck-atc.html; KJFK: dist/kjfk/index.html and dist/new-york-jfk-atc.html;
EGKK: dist/egkk/index.html and dist/london-gatwick-atc.html; LEMD: dist/lemd/index.html and dist/madrid-atc.html;
EGCC: dist/egcc/index.html and dist/manchester-atc.html; EGLL: dist/egll/index.html and dist/london-heathrow-atc.html;
EGGD: dist/eggd/index.html and dist/bristol-atc.html; YSSY: dist/yssy/index.html and dist/sydney-atc.html."""
import pathlib
root = pathlib.Path(__file__).parent
src = root/'src'
r = lambda n: (src/n).read_text()
import re, urllib.parse
# favicon: the header logo, as an inline SVG data URI
_logo = re.search(r'<svg class="logo".*?</svg>', r('site.html')).group(0).replace(' class="logo"', '').replace(' aria-hidden="true"', '').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace('"', "'")
fav = 'data:image/svg+xml,' + urllib.parse.quote(_logo, safe=" =:/'.,-")
import json
# subscriptions, feedback and analytics settings (see SUBSCRIPTIONS.md)
SUBS = json.loads((root/'subs.json').read_text())
fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
AIRPORTS = {
    'LXGB': dict(title='Clearway ATC Simulator', desc='Clearway: browser-based air traffic control simulation at real airports: Gibraltar (LXGB), Madeira (LPMA), London City (EGLC), Innsbruck (LOWI), New York JFK (KJFK), London Gatwick (EGKK), Madrid-Barajas (LEMD), Manchester (EGCC), London Heathrow (EGLL) and Bristol (EGGD).',
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
    'YSSY': dict(title='Sydney · Clearway ATC Simulator', desc='Clearway: air traffic control at Sydney Kingsford Smith (YSSY): three runways with parallel ILS approaches, runway crossings, RNAV SIDs and STARs and live traffic.',
                 geo='airports/yssy.geo.json', profile=['airports/yssy.js', 'airports/yssy-ground.js', 'airports/yssy-engine.js'], site=['airports/yssy-site.js'], artifact='sydney-atc.html', page='yssy/index.html',
                 data=('YSSY', 'airports/yssy.js')),
    'EGKK': dict(title='London Gatwick · Clearway ATC Simulator', desc='Clearway: air traffic control at London Gatwick (EGKK), the busiest single runway in Europe: mixed-mode 08R/26L, RNAV SIDs and STARs, the TIMBA and WILLO holds, ILS approaches and live traffic.',
                 geo='airports/egkk.geo.json', profile=['airports/egkk.js', 'airports/egkk-ground.js', 'airports/egkk-engine.js'], site=['airports/egkk-site.js'], artifact='london-gatwick-atc.html', page='egkk/index.html',
                 data=('EGKK', 'airports/egkk.js')),
    'LEMD': dict(title='Madrid-Barajas · Clearway ATC Simulator', desc='Clearway: air traffic control at Madrid-Barajas (LEMD): four runways at once, parallel ILS approaches to 32L/32R and 18R/18L, departures off 36L/36R and 14L/14R, RNAV SIDs and STARs, the 18R/36L crossing and live traffic.',
                 geo='airports/lemd.geo.json', profile=['airports/lemd.js', 'airports/lemd-ground.js', 'airports/lemd-engine.js'], site=['airports/lemd-site.js'], artifact='madrid-atc.html', page='lemd/index.html',
                 data=('LEMD', 'airports/lemd.js')),
    'EGCC': dict(title='Manchester · Clearway ATC Simulator', desc='Clearway: air traffic control at Manchester (EGCC): two parallel runways in segregated mode, landings on 23R or 05R, departures off 23L or 05L across runway 1, the ROSUN, MIRSI and DAYNE holds, ILS and RNP approaches, Scottish Control releases and live traffic.',
                 geo='airports/egcc.geo.json', profile=['airports/egcc.js', 'airports/egcc-ground.js', 'airports/egcc-engine.js'], site=['airports/egcc-site.js'], artifact='manchester-atc.html', page='egcc/index.html',
                 data=('EGCC', 'airports/egcc.js')),
    'EGLL': dict(title='London Heathrow · Clearway ATC Simulator', desc='Clearway: air traffic control at London Heathrow (EGLL): two parallel runways in segregated mode with the 15:00 runway alternation, the Bovingdon, Lambourne, Biggin and Ockham stacks, CAT III ILS approaches, five terminals and 252 real stands, crossings of the southern runway and a whole day of real traffic.',
                 geo='airports/egll.geo.json', profile=['airports/egll.js', 'airports/egll-ground.js', 'airports/egll-engine.js'], site=['airports/egll-site.js'], artifact='london-heathrow-atc.html', page='egll/index.html',
                 data=('EGLL', 'airports/egll.js')),
    'EGGD': dict(title='Bristol · Clearway ATC Simulator', desc='Clearway: air traffic control at Bristol (EGGD), on Broadfield Down: one runway, 09/27, with a parallel taxiway, the BRI hold over the field, conventional SIDs, ILS approaches and live traffic.',
                 geo='airports/eggd.geo.json', profile=['airports/eggd.js', 'airports/eggd-ground.js', 'airports/eggd-engine.js'], site=['airports/eggd-site.js'], artifact='bristol-atc.html', page='eggd/index.html',
                 data=('EGGD', 'airports/eggd.js')),
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
def cwcfg(live):
    c = {k: SUBS[k] for k in ('enabled', 'feedback', 'api', 'supabase_url', 'supabase_anon_key', 'currency', 'prices', 'trial_days', 'contact_email', 'analytics_token', 'legal_date')}
    c['offer'] = SUBS.get('offer')
    c['commission'] = SUBS.get('commission', 25)
    c['upgrade_offer'], c['releases'] = SUBS.get('upgrade_offer'), SUBS.get('releases', [])
    c['site'] = SITE_URL
    if not live: c['enabled'] = False; c['test_switch'] = False
    return json.dumps(c, ensure_ascii=False)
# search and social sharing: canonical address, Open Graph / Twitter card, structured data, optional cookieless analytics
def seo(icao, A):
    url = SITE_URL + ('' if A['page'] == 'index.html' else A['page'].rsplit('/', 1)[0] + '/')
    p = SUBS['prices']
    ld = {'@context': 'https://schema.org', '@type': 'VideoGame', 'name': 'Clearway ATC Simulator', 'url': SITE_URL, 'description': A['desc'],
          'applicationCategory': 'GameApplication', 'gamePlatform': 'Web browser', 'operatingSystem': 'Any', 'genre': ['Simulation'],
          'image': SITE_URL + 'og.png', 'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'GBP', 'lowPrice': p['a1'], 'highPrice': p['all'], 'offerCount': 5}}
    t = A['title']
    tags = [f'<link rel="canonical" href="{url}">', '<meta name="theme-color" content="#0b2a4a">',
            '<meta property="og:type" content="website">', '<meta property="og:site_name" content="Clearway">', f'<meta property="og:title" content="{t}">',
            f'<meta property="og:description" content="{A["desc"]}">', f'<meta property="og:url" content="{url}">', f'<meta property="og:image" content="{SITE_URL}og.png">',
            '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">', '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{t}">', f'<meta name="twitter:description" content="{A["desc"]}">', f'<meta name="twitter:image" content="{SITE_URL}og.png">']
    if A['page'] == 'index.html': tags.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>')
    if SUBS.get('analytics_token'): tags.append(f'<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{{"token": "{SUBS["analytics_token"]}"}}\'></script>')
    return '\n'.join(tags)
# installable app (Chrome "Install Clearway", Android "Add to home screen"): one app for the whole site, opening at the
# home page, with a shortcut to every airport's simulator. Icons come from tools/app_icons.py; src/sw.js is the
# service worker (pages network-first with an offline fallback; live data, sign-in and payments never cached).
def manifest():
    icons = [dict(src=f'icons/{n}-{z}.png', sizes=f'{z}x{z}', type='image/png', purpose=pu) for n, pu in (('icon', 'any'), ('maskable', 'maskable')) for z in (192, 512)]
    name = lambda k, A: A['title'].split(' · ')[0] if ' · ' in A['title'] else 'Gibraltar'
    short = [dict(name=f'{name(k, A)} ({k})', short_name=name(k, A), description=f'Open the {name(k, A)} simulator',
                  url=('./' if A['page'] == 'index.html' else A['page'].rsplit('/', 1)[0] + '/') + '#sim', icons=[icons[0]]) for k, A in AIRPORTS.items()]
    return json.dumps(dict(id='./', name='Clearway ATC Simulator', short_name='Clearway', description=AIRPORTS[HOST]['desc'],
                           start_url='./', scope='./', display='standalone', orientation='any', background_color='#0b2a4a', theme_color='#0b2a4a',
                           lang='en-GB', categories=['games', 'education', 'simulation'], icons=icons, shortcuts=short), indent=1, ensure_ascii=False) + '\n'
def pwa(icao):
    up = '../' * AIRPORTS[icao]['page'].count('/')
    return (f'<link rel="manifest" href="{up}manifest.webmanifest">\n<link rel="apple-touch-icon" href="{up}icons/apple-touch-icon.png">\n'
            '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Clearway">\n'
            f"<script>if ('serviceWorker' in navigator && window.top === window && (location.protocol === 'https:' || location.hostname === 'localhost'))"
            f" addEventListener('load', () => navigator.serviceWorker.register('{up}sw.js', {{ scope: '{up or './'}' }}).catch(() => {{}}));</script>")
def page(icao, A):
    prof = '\n'.join(r(n) for n in A['profile'])
    others = [(k, B['data']) for k, B in AIRPORTS.items() if k != icao and B.get('data')] if icao == HOST else []
    prof += ''.join('\n' + r(f) for k, (g, f) in others)
    ap_data = '{' + ', '.join(f'{k}: {g}' for k, (g, f) in others) + '}'
    vf = src/'airports'/f'{icao.lower()}-veh.js'   # the airside roads and ground-vehicle places (tools/vehicles_osm.py)
    veh = vf.read_text() if vf.exists() else ''
    site = '\n'.join(r(n) for n in A.get('site', []))   # the airport's own Academy coach steps, after site.js
    out = f'''<meta charset="utf-8">
<title>{A['title']}</title>
<link rel="icon" type="image/svg+xml" href="{fav}">
@@PWA@@
<meta name="description" content="{A['desc']}">
{seo(icao, A)}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
{r('styles.css')}
{r('account.css')}
</style>
<style>[data-only]:not([data-only~="{icao}"]){{display:none!important}}</style>
{r('site.html').replace('</main>', r('account.html') + '</main>').replace('@@AREA@@', '@@AREALINK@@')}
<script>
const AIRPORT = '{icao}';
const SITE = @@SITE@@;
const SITE_HOST = '{HOST}';
const CW_CFG = @@CWCFG@@;
const GEO = {r(A['geo']).strip()};
{r('core.js')}
{prof}
const AP_DATA = {ap_data};
{r('sim.js')}
{r('shapes.js')}
{r('ui.js')}
{r('emerg.js')}
{r('flow.js')}
{r('career.js')}
{r('ground.js')}
{veh}
{r('vehicles.js')}
{r('tiles.js')}
{r('far.js')}
{r('live.js')}
{r('custom.js')}
{r('slots.js')}
{r('ai.js')}
{r('voice.js')}
{r('radio.js')}
{r('account.js')}
{r('site.js')}
{site}
{r('stint.js')}
</script>
'''
    (root/'dist').mkdir(exist_ok=True)
    # the claude.ai artifact is a private preview: no paywall there
    (root/'dist'/A['artifact']).write_text(out.replace('@@AREALINK@@', SITE_URL + 'area/').replace('@@SITE@@', json.dumps(links(icao, True))).replace('@@CWCFG@@', cwcfg(False)).replace('@@PWA@@\n', ''))
    out = out.replace('@@AREALINK@@', '../'*A['page'].count('/') + 'area/').replace('@@SITE@@', json.dumps(links(icao, False))).replace('@@CWCFG@@', cwcfg(True))
    out = out.replace('@@PWA@@', pwa(icao))
    head, body = out.split('<style>', 1)
    standalone = ('<!doctype html>\n<html lang="en">\n<head>\n' + head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
                  + '<style>' + body.replace('</style>', '</style>\n</head>\n<body>', 1) + '</body>\n</html>\n')
    (root/'dist'/A['page']).parent.mkdir(parents=True, exist_ok=True)
    (root/'dist'/A['page']).write_text(standalone)
    print(icao, len(out))
for k, A in AIRPORTS.items(): page(k, A)

# Area Control: its own page (dist/area/index.html), the same look as the airport consoles, built from src/area/ with the
# shared styles, aircraft shapes and map tiles, and the UK airports' timetables for the planned traffic
def area_page():
    A = root/'src'/'area'
    ra = lambda n: (A/n).read_text()
    logo = re.search(r'<svg class="logo".*?</svg>', r('site.html')).group(0)
    desc = 'Clearway Area Control: work a sector of London or Scottish Control, with the real UK airways, sectors and standing agreements, live traffic or the airline timetables, delays, holds, diversions and weather.'
    url = SITE_URL + 'area/'
    data = '\n'.join(r(f'airports/{a}.js') for a in ('egll', 'egkk', 'egcc', 'eggd', 'eglc'))
    out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Area Control · Clearway ATC Simulator</title>
<link rel="icon" type="image/svg+xml" href="{fav}">
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}"><meta name="theme-color" content="#0b2a4a">
<meta property="og:type" content="website"><meta property="og:site_name" content="Clearway"><meta property="og:title" content="Area Control · Clearway ATC Simulator">
<meta property="og:description" content="{desc}"><meta property="og:url" content="{url}"><meta property="og:image" content="{SITE_URL}og.png">
<link rel="manifest" href="../manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
{r('styles.css')}
{ra('area.css')}
</style>
</head>
<body>
{ra('area.html').replace('@@LOGO@@', logo)}
<script>
"use strict";
{ra('area-data.js')}
{data}
{ra('area-geo.js').replace('"use strict";', '', 1)}
{r('shapes.js')}
{r('tiles.js')}
{ra('area-sim.js')}
{ra('area-cmd.js')}
{ra('area-traffic.js')}
{ra('area-ui.js')}
</script>
</body>
</html>
'''
    (root/'dist'/'area').mkdir(parents=True, exist_ok=True)
    (root/'dist'/'area'/'index.html').write_text(out)
    print('AREA', len(out))
area_page()
(root/'dist'/'manifest.webmanifest').write_text(manifest())
(root/'dist'/'sw.js').write_text(r('sw.js'))
