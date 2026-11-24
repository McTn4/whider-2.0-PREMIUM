// Recursos de la ficha de Google Play (docs/play/), con la app de verdad y los mismos datos de ejemplo que
// la portada (sin nombres de personas). Necesita la app servida (python3 serve.py 8642, o WHIDER_URL).
//
//   node tools/capturas/play.js
//     → docs/play/captura-1-hoy.jpg … (1080 × 1920, lo que pide Google Play para el móvil: JPEG sin
//       transparencia y el lado largo como mucho el doble del corto)
//     → docs/play/grafico-de-funciones.jpg (1024 × 500)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { APP } = require('../../tests/e2e/_util');
const { seed } = require('./portada');

const R = path.join(__dirname, '..', '..');
const DIR = path.join(R, 'docs', 'play');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (f) => fs.readFileSync(path.join(R, f)).toString('base64');
fs.mkdirSync(DIR, { recursive: true });

// Pantalla de la app → captura (en este orden en la ficha)
const PANTALLAS = [
  ['hoy', 'home'],
  ['tareas', 'tasks'],
  ['calendario', 'calendar'],
  ['cuaderno', 'page']
];

async function capturas(b) {
  const ctx = await b.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36'
  });
  await ctx.clock.install({ time: new Date(new Date().toISOString().slice(0, 10) + 'T09:40:00') });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.seenVersion', '999.0.0');
    if (!localStorage.getItem('whider.meta.v1'))
      localStorage.setItem(
        'whider.meta.v1',
        JSON.stringify({ onboarded: true, createdAt: Date.now() - 40 * 86400000, firstSteps: { hidden: true } })
      );
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(APP);
  await sleep(1800);
  await p.evaluate(() => {
    Whider.Notify.check = function () {};
    Whider.Notify.permission = function () {
      return 'granted';
    };
  });
  await seed(p);
  await sleep(300);
  let n = 0;
  for (const [nombre, id] of PANTALLAS) {
    if (id === 'page') {
      await p.evaluate(() => Whider.Router.go('notes'));
      await sleep(500);
      await p.evaluate(() => Whider.Notes.openPage(window.__pg));
      await sleep(1300);
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
    } else {
      await p.evaluate((x) => Whider.Router.go(x), id);
      await sleep(700);
    }
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => {
      const t = document.getElementById('toastRoot');
      if (t) t.innerHTML = '';
    });
    const out = path.join(DIR, 'captura-' + ++n + '-' + nombre + '.jpg');
    await p.screenshot({ path: out, type: 'jpeg', quality: 88 });
    console.log(path.relative(R, out), Math.round(fs.statSync(out).size / 1024) + ' KB');
  }
  await ctx.close();
  return errs;
}

/** Gráfico de funciones: 1024 × 500, el mensaje a la izquierda y dos capturas del móvil a la derecha */
async function grafico(b) {
  const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const shot = (f) => 'data:image/jpeg;base64,' + b64(path.relative(R, path.join(DIR, f)));
  await p.setContent(`<!doctype html><html><head><style>
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${b64('fonts/inter-latin-opsz-normal.woff2')}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1024px; height: 500px; overflow: hidden; background: #121316; color: #ECEDEF; font-family: Inter, sans-serif; position: relative; }
  .txt { position: absolute; left: 60px; top: 70px; width: 470px; }
  .brand { display: flex; align-items: center; gap: 12px; font-weight: 800; letter-spacing: -.02em; font-size: 23px; color: #ECEDEF; }
  .brand svg { width: 34px; height: 34px; }
  h1 { font-family: Inter; font-weight: 800; font-size: 66px; line-height: 1; letter-spacing: -.035em; margin-top: 40px; }
  p { margin-top: 22px; font-size: 21px; line-height: 1.38; color: #A9ADB4; }
  .phone { position: absolute; top: 46px; width: 216px; border-radius: 26px; overflow: hidden; box-shadow: 0 0 0 1px #3D4048; }
  .phone img { display: block; width: 100%; }
  .a { left: 560px; }
  .b { left: 790px; top: 86px; }
  </style></head><body>
  <div class="phone a"><img src="${shot('captura-1-hoy.jpg')}"></div>
  <div class="phone b"><img src="${shot('captura-4-cuaderno.jpg')}"></div>
  <div class="txt">
    <div class="brand"><svg viewBox="0 0 64 64"><path d="M12.5 22.5 23 45l9-15.5L41 45l11-28" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>WHIDER</div>
    <h1>Tu día,<br>bajo control.</h1>
    <p>Tus tareas por importancia, las de cada día, el calendario y tus notas. Gratis, sin anuncios y en todos tus dispositivos.</p>
  </div>
  </body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await sleep(400);
  const out = path.join(DIR, 'grafico-de-funciones.jpg');
  await p.screenshot({ path: out, type: 'jpeg', quality: 90 });
  console.log(path.relative(R, out), Math.round(fs.statSync(out).size / 1024) + ' KB');
  await p.close();
}

(async () => {
  const b = await chromium.launch();
  const errs = await capturas(b);
  await grafico(b);
  await b.close();
  if (errs.length) console.log('Errores en la página:', JSON.stringify(errs));
  process.exit(errs.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
