// axe-core (WCAG 2.1 A/AA) en la portada, la invitación y la privacidad, en ordenador y móvil
const { chromium, devices } = require('playwright');
const { WEB, AXE: AXE_RUTA } = require('./_util');
const fs = require('fs');
const AXE = fs.readFileSync(AXE_RUTA, 'utf8');
const BASE = process.argv[2] || WEB;
const PAGES = [['portada', process.argv[3] || '/'], ['invitacion', '/i/?c=WH-ABC123&k=x&t=f&n=Ana'], ['privacidad', '/privacidad/']];
(async () => {
  const b = await chromium.launch(); let total = 0;
  for (const [dev, opts] of [['pc', { viewport: { width: 1366, height: 900 } }], ['movil', devices['Pixel 7']]]) {
    for (const [name, path] of PAGES) {
      const c = await b.newContext(opts); const p = await c.newPage();
      await p.goto(BASE + path); await p.waitForTimeout(3200);
      await p.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in')));
      await p.waitForTimeout(900);
      await p.addScriptTag({ content: AXE });
      const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      const v = r.violations.map(x => x.id + ' (' + x.nodes.length + '): ' + x.help + ' → ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | '));
      total += r.violations.length;
      console.log(dev, name, v.length ? '\n  ' + v.join('\n  ') : 'OK (0)');
      await c.close();
    }
  }
  await b.close();
  console.log('reglas incumplidas en total:', total);
  process.exit(total ? 1 : 0);
})();
