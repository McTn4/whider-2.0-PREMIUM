// Muestrario de los iconos de index.html a tres tamaños (22, 44 y 15 px), para revisarlos de un vistazo.
//   node tools/iconos/muestrario.js [id1,id2,…] [salida.png]   (por defecto tests/e2e/logs/capturas/iconos.png)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { OUT } = require('../../tests/e2e/_util');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const inicio = html.indexOf('<svg width="0" height="0" style="position:absolute" aria-hidden="true">');
const sprite = html.slice(inicio, html.indexOf('</svg>', inicio) + 6);
const ids = [...sprite.matchAll(/symbol id="i-([^"]+)"/g)].map((m) => m[1]);
const solo = process.argv[2] ? process.argv[2].split(',') : null;
const lista = solo ? ids.filter((i) => solo.includes(i)) : ids;
const salida = process.argv[3] || path.join(OUT, 'iconos.png');
const celda = (id) =>
  `<div class="c"><div class="row"><svg class="ic n"><use href="#i-${id}"/></svg><svg class="ic big"><use href="#i-${id}"/></svg>` +
  `<svg class="ic sm"><use href="#i-${id}"/></svg></div><span>${id}</span></div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent(`<html><head><style>
  :root{--bar:#111113;--hole:#000}
  body{margin:0;background:#070708;color:#F2F2F2;font:11px sans-serif;display:grid;grid-template-columns:repeat(12,1fr);gap:6px;padding:10px}
  .c{background:#111113;border-radius:10px;padding:8px 6px;display:flex;flex-direction:column;align-items:center;gap:6px}
  .row{display:flex;align-items:center;gap:8px}
  .ic{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  .n{width:22px;height:22px}.big{width:44px;height:44px;stroke-width:1.6}.sm{width:15px;height:15px;stroke-width:2}
  span{color:#8a8a8a}
  </style></head><body>${sprite}${lista.map(celda).join('')}</body></html>`);
  await p.waitForTimeout(300);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  await p.screenshot({ path: salida, fullPage: true });
  console.log(lista.length + ' iconos →', salida);
  await b.close();
})();
