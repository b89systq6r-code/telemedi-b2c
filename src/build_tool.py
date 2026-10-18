"""Składa narzędzie: dist/index.html (pełny dokument, np. GitHub Pages) i dist/artifact.html (fragment dla Artifact)."""
import pathlib
t = pathlib.Path('tool')
head = '<title>Telemedi B2C Kohorty</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' \
       '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' \
       '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">\n'
css = '<style>\n' + (t/'app.css').read_text() + '\n</style>\n'
import base64
body = (t/'body.html').read_text()
for k,f in [('{{SABRES_S}}','sabres64.png'),('{{SABRES_L}}','sabres160.png')]:
    body = body.replace(k, 'data:image/png;base64,' + base64.b64encode((t/'assets'/f).read_bytes()).decode())
scripts = '<script>' + (t/'data.js').read_text() + '</script>\n<script>' + (t/'app.js').read_text() + '</script>\n'
frag = head + css + body + scripts
pathlib.Path('dist').mkdir(exist_ok=True)
pathlib.Path('dist/artifact.html').write_text(frag)
full = '<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + head + css + \
       '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n' + body + scripts + '</body>\n</html>\n'
pathlib.Path('dist/index.html').write_text(full)
print('ok', round(len(full)/1e6,2), 'MB')
