// Utilidades comunes de las pruebas de extremo a extremo (Playwright).
// Direcciones configurables por variables de entorno para poder probar en local, en la integración
// continua o contra la web compilada.
const fs = require('fs');
const os = require('os');
const path = require('path');

const strip = (u) => String(u).replace(/\/+$/, '');
/** Servidor de desarrollo (python3 serve.py): la app está en / y en /app */
const BASE = strip(process.env.WHIDER_URL || 'http://127.0.0.1:8642');
const APP = BASE + '/app';
/** Web compilada (dist/ servida con las reglas de vercel.json): portada en /, app en /app */
const WEB = strip(process.env.WHIDER_WEB_URL || 'http://127.0.0.1:8650');
/** Archivos de ejemplo grandes: se generan al vuelo fuera del repositorio */
const FX = path.join(os.tmpdir(), 'whider-pruebas-fx');
/** Capturas y registros de las pruebas (no se guardan en git) */
const OUT = path.join(__dirname, 'logs', 'capturas');
const AXE = require.resolve('axe-core/axe.min.js');
const DESK = path.join(__dirname, '..', '..', 'desktop');
fs.mkdirSync(FX, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Antes de pasar axe: axe-core no sabe calcular el fondo de lo que hay dentro de un contenedor fijo (#app ocupa la
 * ventana con position: fixed) ni a través de un pseudo-elemento con fondo. Sin esto marca el contraste de casi
 * todo como «incompleto» y no comprueba nada. #app pasa a absolute (la misma caja y los mismos colores) y se oculta
 * el brillo decorativo de arriba de cada pantalla (un velo del 4 %).
 */
async function axePrep(p) {
  await p.evaluate(() => {
    if (document.getElementById('axe-prep')) return;
    const s = document.createElement('style');
    s.id = 'axe-prep';
    s.textContent = '#app { position: absolute !important; } .screen::before { display: none !important; }';
    document.head.appendChild(s);
  });
}

/** Crea (una vez) las fotos y archivos que usan las pruebas de adjuntos */
async function fixtures(browser) {
  if (fs.existsSync(path.join(FX, 'grande.jpg')) && fs.existsSync(path.join(FX, 'enorme.zip'))) return;
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.setContent('<!doctype html><title>fx</title>');
  const out = await p.evaluate(async () => {
    const mk = (w, h, noise, type, q) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#1d1d1d');
      g.addColorStop(1, '#e8e8e8');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff';
      x.font = 'bold ' + Math.round(h / 6) + 'px sans-serif';
      x.fillText('WHIDER', w * 0.1, h * 0.55);
      if (noise) {
        const d = x.getImageData(0, 0, w, h);
        for (let i = 0; i < d.data.length; i += 4) {
          const n = Math.random() * 90;
          d.data[i] += n;
          d.data[i + 1] += n;
          d.data[i + 2] += n;
        }
        x.putImageData(d, 0, 0);
      }
      return c.toDataURL(type, q).split(',')[1];
    };
    return { foto: mk(900, 600, false, 'image/png'), grande: mk(3600, 2400, true, 'image/jpeg', 0.97) };
  });
  fs.writeFileSync(path.join(FX, 'foto.png'), Buffer.from(out.foto, 'base64'));
  fs.writeFileSync(path.join(FX, 'grande.jpg'), Buffer.from(out.grande, 'base64'));
  const pdf =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n';
  fs.writeFileSync(path.join(FX, 'Factura marzo.pdf'), pdf + ' '.repeat(3000));
  fs.writeFileSync(path.join(FX, 'notas.txt'), 'Lista de la compra\n- pan\n- leche\n');
  fs.writeFileSync(path.join(FX, 'enorme.zip'), Buffer.alloc(16 * 1024 * 1024, 1));
  fs.writeFileSync(path.join(FX, 'instalar.bat'), '@echo off\necho hola\n');
  await ctx.close();
}

module.exports = { BASE, APP, WEB, FX, OUT, AXE, DESK, sleep, fixtures, axePrep };
