// Personaje, logros y niveles: Hoy, Perfil, editor, celebración y desbloqueos (móvil y ordenador)
const { chromium } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; let failed = 0;
const ok = (name, cond, extra) => { results.push((cond ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!cond) failed++; };
const URL = process.argv[2] || APP;
const SHOTS = process.argv[3] || null;

async function setup(b, viewport, mobile) {
  const ctx = await b.newContext(Object.assign({ viewport }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}));
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] })); });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await sleep(1900);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch();
  {
    const { p, errs } = await setup(b, { width: 390, height: 844 }, true);
    ok('Hoy (móvil): el personaje en la tarjeta del día', await p.evaluate(() => !!document.querySelector('#screen-home .day-card .ch-svg')));
    await p.click('#screen-home .day-card .buddy'); await sleep(400);
    ok('tocar el personaje cambia la frase', await p.evaluate(() => document.querySelector('#screen-home .buddy-bubble').textContent.length > 5));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/m-buddy-home.png' });
    await p.evaluate(() => Whider.Character.edit()); await sleep(500);
    ok('editor abierto con opciones', await p.evaluate(() => document.querySelectorAll('.buddy-editor .be-opt').length) >= 8);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/m-buddy-editor.png' });
    // Opción bloqueada (nivel) → aviso; opción libre → se aplica
    await p.click('.buddy-editor .be-opt:has-text("Cubo")'); await sleep(200);
    await p.click('.buddy-editor .segmented button:has-text("Cabeza")'); await sleep(250);
    await p.click('.buddy-editor .be-opt:has-text("Flequillo")'); await sleep(200);
    const locked = await p.evaluate(() => document.querySelectorAll('.buddy-editor .be-opt.locked').length);
    ok('1.0: ningún objeto bloqueado', locked === 0, locked);
    await p.click('.buddy-editor .sheet-foot .btn.primary'); await sleep(500);
    ok('personaje guardado', await p.evaluate(() => { const c = Whider.State.character; return c.body === 'cubo' && c.head === 'flequillo' && c.at > 0; }));
    // 8.0: Perfil sin logros ni niveles; completar tareas no lanza celebraciones de juego
    await p.evaluate(() => { Whider.State.ui.profileTab = 'achievements'; Whider.Router.go('progress'); }); await sleep(600);
    ok('perfil: personaje e imagen de perfil', await p.evaluate(() => /Personaje e imagen de perfil/.test(document.getElementById('screen-progress').innerText)));
    ok('perfil: sin logros, niveles ni XP', await p.evaluate(() => !/Logros|Nivel \d|\bXP\b/.test(document.getElementById('screen-progress').innerText) && !document.querySelector('#screen-progress .fam')));
    await p.evaluate(() => { document.getElementById('toastRoot').innerHTML = ''; const S = Whider.State, U = Whider.U; for (let i = 0; i < 12; i++) { const t = S.addTask({ text: 'T' + i, date: U.today(), listId: 'personal' }); S.setDone(t.id, true); } });
    await sleep(1400);
    ok('sin celebración de juego al completar', await p.evaluate(() => !document.querySelector('.celebrate')));
    const toast = await p.evaluate(() => document.getElementById('toastRoot').innerText);
    ok('aviso sobrio de día completado, sin XP', /Todo lo de hoy está hecho/.test(toast) && !/XP|[Ll]ogro/.test(toast), toast);
    ok('sin errores (móvil)', errs.length === 0, errs.slice(0, 5));
  }
  {
    const { p, errs } = await setup(b, { width: 1440, height: 900 });
    ok('Hoy (ordenador): tarjeta del personaje en el lateral', await p.evaluate(() => !!document.querySelector('#screen-home .desk-side .buddy-card .ch-svg')));
    await p.evaluate(() => { Whider.State.setCharacter({ tone: 'cromo', body: 'gema', head: 'halo', acc: 'capa', eyes: 'grandes' }); }); await sleep(300);
    ok('1.0: acabados y accesorios para todos; la especie retirada vuelve a la de siempre', await p.evaluate(() => { const c = Whider.Character.config(); return c.tone === 'cromo' && c.body === 'gota' && c.head === 'halo' && c.acc === 'capa'; }));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/d-buddy-home.png' });
    await p.evaluate(() => { Whider.State.ui.profileTab = 'achievements'; Whider.Router.go('progress'); }); await sleep(600);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/d-achievements.png' });
    // Galería de todos los estados y tonos (para revisar el dibujo)
    await p.evaluate(() => {
      const C = Whider.Character, box = document.createElement('div');
      box.style.cssText = 'position:fixed;inset:0;z-index:99;background:#050505;display:flex;flex-wrap:wrap;gap:6px;padding:12px;overflow:auto';
      const bodies = ['gota', 'cubo', 'capsula', 'nube', 'gato'], tones = ['blanco', 'perla', 'grafito', 'negro', 'cromo'], heads = ['nada', 'antena', 'flequillo', 'gorro', 'lazo', 'brote', 'auriculares', 'cresta', 'birrete', 'corona', 'halo'];
      const accs = ['nada', 'gafas', 'bufanda', 'pajarita', 'medalla', 'capa'], moods = Object.keys(C.MOODS);
      bodies.forEach((bd, i) => tones.forEach((tn, j) => box.appendChild(C.svg({ size: 104, cfg: { body: bd, tone: tn, head: heads[(i * 5 + j) % heads.length], acc: accs[(i + j) % accs.length], eyes: 'puntos', mouth: 'sonrisa', cheeks: true }, mood: moods[(i + j) % moods.length] }))));
      heads.forEach(h => box.appendChild(C.svg({ size: 104, cfg: { body: 'gota', tone: 'blanco', head: h, acc: 'nada', eyes: 'grandes', mouth: 'abierta', cheeks: false } })));
      accs.forEach(a => box.appendChild(C.svg({ size: 104, cfg: { body: 'capsula', tone: 'grafito', head: 'nada', acc: a, eyes: 'felices', mouth: 'gato', cheeks: true } })));
      ['estrellas', 'corazones', 'grandes'].forEach(e => box.appendChild(C.svg({ size: 104, cfg: { body: 'nube', tone: 'perla', head: 'antena', eyes: e, mouth: 'o' } })));
      ['coffee', 'sprout', 'note', 'search', 'friends', 'trophy'].forEach(pr => box.appendChild(C.svg({ size: 104, prop: pr })));
      document.body.appendChild(box);
    });
    await sleep(500);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/d-buddy-gallery.png' });
    ok('sin errores (ordenador)', errs.length === 0, errs.slice(0, 5));
  }
  await b.close();
  console.log(results.join('\n'));
  console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
