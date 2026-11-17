"""Sirve la web compilada (dist/) con las mismas reglas que vercel.json (redirecciones y rewrites con
origen exacto), para probar en local lo mismo que se publica.

    node tools/web-build.js
    python3 -I tools/servir-web.py [carpeta del repositorio] [puerto]     (por defecto: . 8650)
"""
import http.server
import json
import os
import socketserver
import sys

REPO = sys.argv[1] if len(sys.argv) > 1 else '.'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8650
CONF = json.load(open(os.path.join(REPO, 'vercel.json'), encoding='utf-8'))
DIST = os.path.join(REPO, CONF.get('outputDirectory', 'dist'))
REDIRECTS = {r['source']: r['destination'] for r in CONF.get('redirects', [])}
REWRITES = {r['source']: r['destination'] for r in CONF.get('rewrites', [])}


class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **{
        '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2',
        '.webp': 'image/webp', '.svg': 'image/svg+xml'})

    def __init__(self, *a, **k):
        super().__init__(*a, directory=DIST, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass

    def route(self):
        path, sep, query = self.path.partition('?')
        if path in REDIRECTS:
            dest = REDIRECTS[path]
            if query and '#' not in dest:
                dest += '?' + query
            self.send_response(307)
            self.send_header('Location', dest)
            self.end_headers()
            return False
        # Vercel mira primero los archivos y, si no hay, aplica los rewrites
        fs_path = os.path.join(DIST, path.lstrip('/'))
        if not os.path.exists(fs_path) and path in REWRITES:
            self.path = REWRITES[path] + sep + query
        return True

    def do_GET(self):
        if self.route():
            super().do_GET()

    def do_HEAD(self):
        if self.route():
            super().do_HEAD()


class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if not os.path.isdir(DIST):
    sys.exit('No existe %s: ejecuta antes «node tools/web-build.js»' % DIST)
print('Web compilada en http://127.0.0.1:%d (portada en /, app en /app)' % PORT, flush=True)
S(('127.0.0.1', PORT), H).serve_forever()
