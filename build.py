"""Assemble the single-file Clearway simulator from src/ parts: dist/gibraltar-atc.html (claude.ai artifact body)
and dist/index.html (standalone page for GitHub Pages)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root/'src'
r = lambda n: (src/n).read_text()
fonts = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
out = f'''<meta charset="utf-8">
<title>Clearway ATC Simulator</title>
<meta name="description" content="Clearway: browser-based air traffic control simulation at real airports, starting with Gibraltar (LXGB).">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
{r('styles.css')}
</style>
{r('site.html')}
<script>
const GEO = {r('geo.json').strip()};
{r('sim.js')}
{r('ui.js')}
{r('ground.js')}
{r('tiles.js')}
{r('far.js')}
{r('voice.js')}
{r('site.js')}
</script>
'''
(root/'dist').mkdir(exist_ok=True)
(root/'dist/gibraltar-atc.html').write_text(out)
head, body = out.split('<style>', 1)
standalone = ('<!doctype html>\n<html lang="en">\n<head>\n' + head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
              + '<style>' + body.replace('</style>', '</style>\n</head>\n<body>', 1) + '</body>\n</html>\n')
(root/'dist/index.html').write_text(standalone)
print(len(out))
