#!/usr/bin/env python3
"""
WHIDER - Empaquetador para Android Studio y PWABuilder

1. Sincroniza la app web (index.html, css/, js/, fonts/, icons/, manifest.json, sw.js)
   dentro de android/app/src/main/assets/www para que el APK use siempre la última versión.
2. Crea whider-android-project.zip listo para Android Studio o PWABuilder.

Uso:
    python package_apk.py          # sincroniza y crea el ZIP
    python package_apk.py --sync   # solo sincroniza los assets de Android
"""
import os
import shutil
import sys
import zipfile

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_NAME = "whider-android-project.zip"
ZIP_OUTPUT = os.path.join(BASE_DIR, ZIP_NAME)
ANDROID_WWW = os.path.join(BASE_DIR, "android", "app", "src", "main", "assets", "www")

WEB_FILES = ["index.html", "manifest.json", "sw.js"]
WEB_DIRS = ["css", "js", "fonts", "icons"]

# Carpetas y extensiones que nunca deben ir en el paquete
SKIP_DIRS = {".git", "__pycache__", ".gradle", "build", ".idea", ".cxx", "node_modules"}
SKIP_EXT = (".zip", ".pyc", ".exe", ".apk", ".aab", ".keystore", ".jks")
SKIP_FILES = {"local.properties", "cloudflared"}


def sync_android_assets():
    print("[*] Sincronizando la app web con android/app/src/main/assets/www ...")
    if os.path.isdir(ANDROID_WWW):
        shutil.rmtree(ANDROID_WWW)
    os.makedirs(ANDROID_WWW)
    for name in WEB_FILES:
        shutil.copy2(os.path.join(BASE_DIR, name), os.path.join(ANDROID_WWW, name))
    for name in WEB_DIRS:
        shutil.copytree(os.path.join(BASE_DIR, name), os.path.join(ANDROID_WWW, name))
    print("[OK] Assets de Android actualizados.")


def package():
    print("[*] Creando paquete de distribución para Android...")
    with zipfile.ZipFile(ZIP_OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(BASE_DIR):
            # Poda en sitio: os.walk no entra en las carpetas excluidas
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for file in files:
                if file.endswith(SKIP_EXT) or file in SKIP_FILES:
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, BASE_DIR)
                zipf.write(file_path, rel_path)

    size_mb = os.path.getsize(ZIP_OUTPUT) / (1024 * 1024)
    print(f"[OK] Paquete creado con éxito: {ZIP_OUTPUT} ({size_mb:.2f} MB)")


if __name__ == '__main__':
    sync_android_assets()
    if '--sync' not in sys.argv[1:]:
        package()
