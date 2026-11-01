#!/usr/bin/env python3
"""
WHIDER PRO - Servidor Local con Túnel HTTPS Seguro para Móviles (Android / APK)
Genera automáticamente un enlace HTTPS público temporal para que puedas abrir,
testear e instalar la app directamente en tu teléfono móvil sin copiar archivos.
"""
import http.server
import socketserver
import webbrowser
import os
import sys
import socket
import subprocess
import threading
import time
import re
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
CLOUDFLARED_BIN = os.path.join(DIRECTORY, "cloudflared.exe")

tunnel_info = {
    "https_url": None,
    "local_url": f"http://localhost:{PORT}"
}

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
        '.woff2': 'font/woff2'
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Endpoint de API para informar a la app del enlace HTTPS del túnel
        if self.path == '/api/tunnel':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            payload = json.dumps({
                "tunnel_url": tunnel_info["https_url"],
                "local_ip_url": f"http://{get_local_ip()}:{PORT}",
                "local_url": tunnel_info["local_url"]
            }).encode('utf-8')
            self.wfile.write(payload)
            return

        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def start_cloudflared_tunnel(port):
    if not os.path.exists(CLOUDFLARED_BIN):
        return

    print("[-] Conectando túnel seguro HTTPS para móviles...")
    try:
        proc = subprocess.Popen(
            [CLOUDFLARED_BIN, 'tunnel', '--url', f'http://localhost:{port}'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        start_time = time.time()
        while time.time() - start_time < 15:
            line = proc.stdout.readline()
            if not line:
                break
            match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            if match:
                tunnel_info["https_url"] = match.group(0)
                break
                
        if tunnel_info["https_url"]:
            print("\n" + "="*70)
            print("  📲 ENLACE SEGURO PARA ABRIR EN TU TELÉFONO MÓVIL (HTTPS):")
            print(f"  👉  {tunnel_info['https_url']}  👈")
            print("="*70)
            print("  CÓMO INSTALARLO EN TU MÓVIL:")
            print("  1. Abre ese enlace en el navegador Chrome de tu teléfono.")
            print("  2. Pulsa en 'Añadir a pantalla de inicio' o 'Instalar aplicación'.")
            print("  3. ¡Android compilará e instalará el APK en tu móvil al instante!")
            print("="*70 + "\n")
        else:
            print("[!] El túnel tardó en responder. Puedes usar la IP Wi-Fi.")
    except Exception as e:
        print("[!] No se pudo iniciar el túnel Cloudflare:", e)

def run():
    os.chdir(DIRECTORY)
    local_ip = get_local_ip()

    for port in range(PORT, PORT + 20):
        try:
            httpd = socketserver.TCPServer(('0.0.0.0', port), CustomHandler)
            tunnel_info["local_url"] = f"http://localhost:{port}"
            
            print("\n" + "="*70)
            print("  WHIDER PRO - SERVIDOR LOCAL ACTIVO")
            print(f"  💻 Ordenador (PC): {tunnel_info['local_url']}")
            print(f"  📶 Red Wi-Fi Local: http://{local_ip}:{port}")
            print("="*70)
            
            # Lanzar túnel HTTPS en un hilo separado
            t = threading.Thread(target=start_cloudflared_tunnel, args=(port,), daemon=True)
            t.start()
            
            try:
                webbrowser.open(tunnel_info["local_url"])
            except Exception:
                pass
                
            httpd.serve_forever()
            break
        except OSError:
            continue

if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        sys.exit(0)
