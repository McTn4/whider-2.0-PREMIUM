#!/usr/bin/env python3
"""
WHIDER - Servidor local con túnel HTTPS opcional para móviles (Android / APK)

Uso:
    python serve.py            # puerto 8080 (o el siguiente libre)
    python serve.py 9000       # puerto concreto
    python serve.py --no-open  # no abrir el navegador automáticamente

Si `cloudflared` está instalado (en el PATH o junto a este archivo) se crea un
enlace HTTPS público temporal, necesario para instalar la app como WebAPK.
"""
import http.server
import os
import re
import shutil
import socket
import socketserver
import subprocess
import sys
import threading
import time
import webbrowser

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

DEFAULT_PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

tunnel_info = {
    "https_url": None,
    "local_url": f"http://localhost:{DEFAULT_PORT}",
}


def find_cloudflared():
    """Busca cloudflared junto al script (Windows/Linux/macOS) o en el PATH."""
    for name in ("cloudflared.exe", "cloudflared"):
        candidate = os.path.join(DIRECTORY, name)
        if os.path.isfile(candidate):
            return candidate
    return shutil.which("cloudflared")


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = http.server.SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.apk': 'application/vnd.android.package-archive',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, fmt, *args):
        # Solo registrar errores para no saturar la consola
        if len(args) > 1 and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


class ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def start_cloudflared_tunnel(port):
    binary = find_cloudflared()
    if not binary:
        print("[i] cloudflared no encontrado: solo estará disponible la red Wi-Fi local.")
        print("    (Instálalo desde https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ para obtener un enlace HTTPS)")
        return

    print("[-] Conectando túnel seguro HTTPS para móviles...")
    try:
        proc = subprocess.Popen(
            [binary, 'tunnel', '--url', f'http://localhost:{port}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
        )
    except Exception as e:
        print("[!] No se pudo iniciar el túnel Cloudflare:", e)
        return

    deadline = time.time() + 30
    pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

    # Se lee la salida continuamente: si el búfer de la tubería se llena,
    # cloudflared se bloquea y el túnel deja de responder.
    for line in proc.stdout:
        if tunnel_info["https_url"] is None:
            match = pattern.search(line)
            if match:
                tunnel_info["https_url"] = match.group(0)
                print("\n" + "=" * 70)
                print("  📲 ENLACE SEGURO PARA ABRIR EN TU TELÉFONO MÓVIL (HTTPS):")
                print(f"  👉  {tunnel_info['https_url']}  👈")
                print("=" * 70)
                print("  CÓMO INSTALARLO EN TU MÓVIL:")
                print("  1. Abre ese enlace en el navegador Chrome de tu teléfono.")
                print("  2. Pulsa en 'Añadir a pantalla de inicio' o 'Instalar aplicación'.")
                print("  3. Android instalará la app (WebAPK) en tu cajón de aplicaciones.")
                print("=" * 70 + "\n")
            elif time.time() > deadline:
                print("[!] El túnel tardó en responder. Puedes usar la IP Wi-Fi.")
                deadline = float('inf')
    proc.wait()


def parse_args(argv):
    port = DEFAULT_PORT
    open_browser = True
    for arg in argv:
        if arg == '--no-open':
            open_browser = False
        elif arg.isdigit():
            port = int(arg)
    return port, open_browser


def run():
    os.chdir(DIRECTORY)
    start_port, open_browser = parse_args(sys.argv[1:])
    local_ip = get_local_ip()

    httpd = None
    for port in range(start_port, start_port + 20):
        try:
            httpd = ThreadingServer(('0.0.0.0', port), CustomHandler)
            break
        except OSError:
            continue
    if httpd is None:
        print(f"[!] No hay puertos libres entre {start_port} y {start_port + 19}.")
        sys.exit(1)

    tunnel_info["local_url"] = f"http://localhost:{port}"

    print("\n" + "=" * 70)
    print("  WHIDER - SERVIDOR LOCAL ACTIVO")
    print(f"  💻 Ordenador (PC): {tunnel_info['local_url']}")
    print(f"  📶 Red Wi-Fi Local: http://{local_ip}:{port}")
    print("  (Pulsa Ctrl+C para detener)")
    print("=" * 70)

    threading.Thread(target=start_cloudflared_tunnel, args=(port,), daemon=True).start()

    if open_browser:
        try:
            webbrowser.open(tunnel_info["local_url"])
        except Exception:
            pass

    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()


if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        sys.exit(0)
