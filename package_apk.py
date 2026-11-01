#!/usr/bin/env python3
"""
WHIDER PRO - Empaquetador para Android Studio y PWABuilder
Crea un paquete .zip listo para compilar en Android Studio o generar APK en PWABuilder.
"""
import os
import sys
import zipfile

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ZIP_OUTPUT = os.path.join(BASE_DIR, "whider-pro-android-project.zip")

def package():
    print("[*] Creando paquete de distribucion para Android...")
    with zipfile.ZipFile(ZIP_OUTPUT, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(BASE_DIR):
            if '.git' in root or '__pycache__' in root:
                continue
            for file in files:
                if file.endswith('.zip') or file.endswith('.pyc') or file.endswith('.exe'):
                    continue
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, BASE_DIR)
                zipf.write(file_path, rel_path)
    
    size_mb = os.path.getsize(ZIP_OUTPUT) / (1024 * 1024)
    print(f"[OK] Paquete creado con exito: {ZIP_OUTPUT} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    package()
