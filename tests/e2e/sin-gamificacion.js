// Toda la app sin gamificación: ninguna pantalla muestra XP, niveles, logros ni ranking, y no hay errores
const { chromium, devices } = require('playwright');
const path = require('path');
const { APP, OUT: CAPTURAS } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = process.argv[2] || path.join(CAPTURAS, 'sin-gamificacion'); require('fs').mkdirSync(OUT, { recursive: true });
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const BAD = /\bXP\b|\bNivel \d|\bnivel \d|[Ll]ogros?\b|Ranking|Subes de nivel|Próxima recompensa|desbloque/;
(async () => {
  const b = await chromium.launch();
  for (const [label, opts] of [['Ordenador', { viewport: { width: 1440, height: 900 } }], ['Móvil', Object.assign({}, devices['Pixel 7'])]]) {
    const ctx = await b.newContext(opts);
    await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await p.goto(APP); await sleep(1600);
    await p.evaluate(() => { Whider.Notify.check = function () {}; const S = Whider.State, t = Whider.U.today(); for (let i = 0; i < 6; i++) S.addTask({ text: 'Tarea ' + i, date: t }); S.tasks.slice(0, 6).forEach(x => S.toggleDone ? S.toggleDone(x.id) : S.updateTask(x.id, { done: true })); });
    await sleep(1500);
    const toasts = await p.evaluate(() => document.getElementById('toastRoot').textContent);
    ok(!BAD.test(toasts), label + ': al completar tareas no aparecen avisos de logros ni XP («' + toasts.slice(0, 80) + '»)');
    const screens = ['home', 'tasks', 'calendar', 'notes', 'chats', 'friends'];
    for (const s of screens) {
      await p.evaluate(x => { document.getElementById('toastRoot').innerHTML = ''; Whider.Router.go(x); }, s); await sleep(500);
      const txt = await p.evaluate(() => document.querySelector('.screen.active').innerText);
      const m = txt.match(BAD);
      ok(!m, label + ': ' + s + ' sin gamificación' + (m ? ' → «' + txt.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' ') + '»' : ''));
    }
    for (const [name, fn] of [['Ajustes', () => Whider.Settings.open()], ['Perfil', () => Whider.Profile.edit()]]) {
      await p.evaluate(fn); await sleep(600);
      const t = await p.evaluate(() => [...document.querySelectorAll('.sheet-layer.open')].map(x => x.innerText).join(' '));
      ok(!BAD.test(t), label + ': ' + name + ' sin gamificación' + (BAD.test(t) ? ' → «' + t.match(BAD)[0] + '»' : ''));
      await p.evaluate(() => { while (Whider.Sheet.isOpen()) Whider.Sheet.closeTop(); }); await sleep(400);
    }
    await p.evaluate(() => Whider.Router.go('home')); await sleep(400);
    await p.screenshot({ path: OUT + '/' + label + '-hoy.png' });
    ok(!errs.length, label + ': sin errores de JavaScript ' + JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close(); console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})();
