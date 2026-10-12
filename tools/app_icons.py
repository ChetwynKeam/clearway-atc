"""Render the installable-app icons (icons/*.png) from the header logo in src/site.html, with headless Chromium.
icon-192/512: the rounded logo on a transparent background ("any"); maskable-192/512: the logo inside the safe zone
on a full-bleed navy square (Android crops these to its own shape); apple-touch-icon: 180 px, full-bleed, no rounding.
Run: python3 tools/app_icons.py  (needs Chromium and Pillow; CHROMIUM=/path overrides /opt/pw-browsers/chromium)"""
import os, re, pathlib, subprocess, tempfile
from PIL import Image
root = pathlib.Path(__file__).resolve().parent.parent
logo = re.search(r'<svg class="logo".*?</svg>', (root/'src'/'site.html').read_text()).group(0)
inner = re.sub(r'^<svg[^>]*>|</svg>$', '', logo)
chrome = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
out = root/'icons'; out.mkdir(exist_ok=True)

def svg(size, mode):
    if mode == 'any': body, bg = inner, ''
    else:   # full bleed: square navy ground, logo without its rounded tile, scaled into the safe zone
        k = 0.8 if mode == 'maskable' else 0.92
        body = re.sub(r'<rect width="40" height="40" rx="10" fill="url\(#\w+\)"/>', '', inner)
        body = f'<g transform="translate({20 - 20 * k} {20 - 20 * k}) scale({k})">{body}</g>'
        bg = re.search(r'<defs>.*?</defs>', inner).group(0) + '<rect width="40" height="40" fill="url(#' + re.search(r'id="(\w+)"', inner).group(1) + ')"/>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="{size}" height="{size}">{bg}{body}</svg>'

for name, size, mode in [('icon-192', 192, 'any'), ('icon-512', 512, 'any'), ('maskable-192', 192, 'maskable'),
                         ('maskable-512', 512, 'maskable'), ('apple-touch-icon', 180, 'apple')]:
    with tempfile.TemporaryDirectory() as d:
        h = pathlib.Path(d)/'i.html'
        h.write_text(f'<!doctype html><style>html,body{{margin:0;background:transparent}}svg{{display:block}}</style>{svg(size, mode)}')
        subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
                        f'--window-size={size},{size + 200}', f'--screenshot={out/(name + ".png")}', h.as_uri()], check=True, capture_output=True)
        Image.open(out/(name + '.png')).crop((0, 0, size, size)).save(out/(name + '.png'), optimize=True)
    print(name, size)
