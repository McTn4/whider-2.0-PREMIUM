// Capturas «de escaparate» para la portada (sitio/img/*.webp) con datos de ejemplo cuidados y sin
// nombres de personas. Necesita la app servida (python3 serve.py 8642, o WHIDER_URL).
//
//   node tools/capturas/portada.js            → deja los PNG en tests/e2e/logs/capturas/portada
//   node tools/capturas/portada.js --guardar  → además sustituye las imágenes de sitio/img
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const { APP, OUT } = require('../../tests/e2e/_util');

const DIR = path.join(OUT, 'portada');
const IMG = path.join(__dirname, '..', '..', 'sitio', 'img');
const GUARDAR = process.argv.includes('--guardar');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(DIR, { recursive: true });

// captura → imagen publicada (ancho final en píxeles; la altura sale de la proporción)
const DESTINOS = [
  ['pc-home', 'pc-hoy', 1920],
  ['movil-home', 'movil-hoy', 600],
  ['movil-page', 'movil-cuaderno', 560],
  ['movil-focus', 'movil-enfoque', 560],
  ['movil-calendar', 'movil-calendario', 560]
];

async function seed(p) {
  await p.evaluate(() => {
    const S = Whider.State,
      U = Whider.U,
      td = U.today(),
      tm = U.addDays(td, 1);
    if (S.tasks.length) return;
    const L = (n, ic) => (S.lists.find((l) => l.name === n) || S.addList(n, 'iris', ic)).id;
    const work = L('Trabajo', 'briefcase'),
      pers = L('Personal', 'user'),
      salud = L('Salud', 'heart'),
      casa = L('Casa', 'home');
    [
      ['Preparar la presentación del lunes', td, '10:00', 'danger', work],
      ['Revisar el presupuesto del viaje', td, '12:30', 'purple', pers],
      ['Llamar al dentista', td, '17:00', 'star', salud],
      ['Comprar fruta y pan', td, null, 'none', casa],
      ['Leer 20 páginas', td, '21:30', 'none', pers],
      ['Enviar el informe semanal', td, '09:00', 'purple', work],
      ['Salir a correr', td, '07:30', 'none', salud],
      ['Reunión con el equipo de diseño', tm, '09:30', 'purple', work],
      ['Renovar el pasaporte', U.addDays(td, 3), null, 'danger', null]
    ].forEach((x) => S.addTask({ text: x[0], date: x[1], time: x[2], highlight: x[3], listId: x[4] }));
    ['Enviar el informe semanal', 'Salir a correr'].forEach((t) => {
      const k = S.tasks.find((z) => z.text === t);
      if (k) S.setDone(k.id, true);
    });
    S.addHabit({ name: 'Beber agua', icon: 'leaf' });
    S.addHabit({ name: 'Leer', icon: 'book' });
    S.addHabit({ name: 'Caminar 30 min', icon: 'dumbbell' });
    const agua = (S.habits || []).find((h) => h.name === 'Beber agua');
    if (agua && S.setHabitCount) S.setHabitCount(agua.id, td, agua.target || 1);
    const P = Whider.Pages;
    P.fromTemplate('project', { title: 'Lanzamiento de la web' });
    P.fromTemplate('meeting', { title: 'Reunión semanal' });
    const pg = P.create({
      title: 'Viaje a Lisboa',
      icon: 'pin',
      cover: 'waves',
      blocks: [
        P.block('h2', 'Plan'),
        P.block('p', 'Tres días en <b>Lisboa</b>: Alfama, Belém y el atardecer en el mirador.'),
        P.block('todo', 'Reservar el hotel', { c: true }),
        P.block('todo', 'Comprar los billetes de tren'),
        P.block('todo', 'Mirar restaurantes cerca del río'),
        P.block('callout', 'Llevar el cargador del móvil y el pasaporte', { ic: 'alert' }),
        P.block('h2', 'Presupuesto'),
        P.block('p', 'Hotel, trenes y comidas: unos 450 € por persona.')
      ]
    });
    window.__pg = pg.id;
  });
}

async function run(b, label, ctxOpts) {
  const ctx = await b.newContext(ctxOpts);
  await ctx.clock.install({ time: new Date(new Date().toISOString().slice(0, 10) + 'T09:40:00') });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    if (!localStorage.getItem('whider.meta.v1'))
      localStorage.setItem(
        'whider.meta.v1',
        JSON.stringify({ onboarded: true, createdAt: Date.now() - 20 * 86400000 })
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
  const shot = async (name) => {
    await p.evaluate(() => document.fonts.ready);
    await sleep(700);
    await p.evaluate(() => {
      const t = document.getElementById('toastRoot');
      if (t) t.innerHTML = '';
    });
    await p.screenshot({ path: path.join(DIR, label + '-' + name + '.png') });
  };
  const go = async (id) => {
    await p.evaluate((x) => Whider.Router.go(x), id);
    await sleep(600);
  };
  for (const id of ['home', 'calendar', 'focus', 'habits']) {
    await go(id);
    await shot(id);
  }
  await go('notes');
  await p.evaluate(() => Whider.Notes.openPage(window.__pg));
  await sleep(1300);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await shot('page');
  if (errs.length) console.log(label, 'errores en la página:', JSON.stringify(errs));
  await ctx.close();
  return errs.length;
}

/** Reescala un PNG a WebP con el propio Chromium (sin dependencias de imagen) */
async function aWebp(b, png, ancho, calidad) {
  const p = await b.newPage();
  const data = await p.evaluate(
    async ({ b64, w, q }) => {
      const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
      const img = await createImageBitmap(blob);
      const h = Math.round((img.height * w) / img.width);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/webp', q).split(',')[1];
    },
    { b64: fs.readFileSync(png).toString('base64'), w: ancho, q: calidad }
  );
  await p.close();
  return Buffer.from(data, 'base64');
}

(async () => {
  const b = await chromium.launch();
  let errs = await run(b, 'pc', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  errs += await run(b, 'movil', { ...devices['Pixel 7'], deviceScaleFactor: 3 });
  console.log('Capturas en', DIR);
  if (GUARDAR) {
    for (const [captura, nombre, ancho] of DESTINOS) {
      const out = path.join(IMG, nombre + '.webp');
      fs.writeFileSync(out, await aWebp(b, path.join(DIR, captura + '.png'), ancho, 0.8));
      console.log(path.relative(process.cwd(), out), Math.round(fs.statSync(out).size / 1024) + ' KB');
    }
    console.log('Si cambió pc-hoy.webp, regenera también la imagen para compartir: node tools/capturas/og.js');
  }
  await b.close();
  process.exit(errs ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
