// Imagen para compartir la portada (Open Graph, 1200×630, JPEG) a partir de sitio/img/pc-hoy.webp
//   node tools/capturas/og.js   → escribe sitio/img/og.jpg
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..', '..') + path.sep;
const b64 = f => fs.readFileSync(R + f).toString('base64');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${b64('fonts/inter-latin-opsz-normal.woff2')}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #121316; color: #ECEDEF; font-family: Inter, sans-serif; position: relative; }
  .txt { position: absolute; left: 72px; top: 74px; width: 520px; }
  .brand { display: flex; align-items: center; gap: 14px; font-weight: 800; letter-spacing: -.02em; font-size: 26px; color: #ECEDEF; }
  .brand svg { width: 40px; height: 40px; }
  h1 { font-family: Inter; font-weight: 800; font-size: 84px; line-height: .98; letter-spacing: -.035em; margin-top: 54px; }
  p { margin-top: 26px; font-size: 26px; line-height: 1.35; color: #A9ADB4; }
  .tags { position: absolute; left: 72px; bottom: 64px; display: flex; gap: 10px; }
  .tags span { padding: 9px 16px; border-radius: 999px; border: 1px solid #3D4048; color: #ECEDEF; font-size: 18px; font-weight: 500; }
  .shot { position: absolute; left: 640px; top: 96px; width: 760px; border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px #3D4048; }
  .shot img { display: block; width: 100%; }
  </style></head><body>
  <div class="shot"><img src="data:image/webp;base64,${b64('sitio/img/pc-hoy.webp')}"></div>
  <div class="txt">
    <div class="brand"><svg viewBox="0 0 64 64"><path d="M12.5 22.5 23 45l9-15.5L41 45l11-28" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>WHIDER</div>
    <h1>Tu día,<br>bajo control.</h1>
    <p>Tus tareas por importancia, las de cada día, el calendario y tus notas. Gratis y en todos tus dispositivos.</p>
  </div>
  <div class="tags"><span>Windows</span><span>macOS</span><span>Linux</span><span>Web</span></div>
  </body></html>`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  const out = path.join(R, 'sitio/img/og.jpg');
  await p.screenshot({ path: out, type: 'jpeg', quality: 86 });
  console.log('og.jpg', Math.round(fs.statSync(out).size / 1024), 'KB');
  await b.close();
})();
