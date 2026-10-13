set -e
cd /home/claude/feel/build && npx esbuild main.js --bundle --minify --format=iife --target=es2019 --outfile=/home/claude/feel/site/app.js --log-level=warning
cd /home/claude/feel && rm -rf vercel && cp -r site vercel && python3 - <<'PY'
s=open('/home/claude/feel/site/index.html').read()
head,body=s.split('</style>',1)
out='<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'+head+'</style>\n</head>\n<body>'+body+'</body>\n</html>\n'
out=out.replace('<style>','<style>\n*,*::before,*::after{box-sizing:border-box}\nbody{margin:0}\n[hidden]{display:none!important}\nimg{max-width:100%}',1)
open('/home/claude/feel/vercel/index.html','w').write(out)
PY
cat > vercel/vercel.json <<'J'
{
  "cleanUrls": true,
  "headers": [
    { "source": "/data/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=300" }] },
    { "source": "/plantas/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=604800" }] }
  ]
}
J
