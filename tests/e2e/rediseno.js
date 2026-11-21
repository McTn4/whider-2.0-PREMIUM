// Rediseño: la presentación adapta la app (para qué la usas → categorías y pestaña Personas), Hoy por importancia con
// el campo de arriba (importancia y «Cada día»), los hábitos convertidos en tareas de cada día (con su aviso de una vez),
// las de cada día que se quedan sin hacer pasan solas a hoy, el editor elige días de la semana y el aspecto nuevo
// (Inter, barra inferior de cinco pestañas, «+» flotante, barra lateral como la de X).
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => {
  console.log((c ? 'OK   ' : 'FAIL ') + m + (extra !== undefined && !c ? '  → ' + JSON.stringify(extra) : ''));
  if (!c) fails++;
};
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const dias = (n) => ymd(new Date(Date.now() + n * 86400000));

async function abrir(b, opts, seed) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript((s) => {
    window.WHIDER_CONFIG = { firebase: null };
    if (!localStorage.getItem('whider.seeded')) {
      localStorage.setItem('whider.seeded', '1');
      Object.keys(s).forEach((k) => localStorage.setItem(k, JSON.stringify(s[k])));
    }
  }, seed || { 'whider.meta.v1': { onboarded: true, createdAt: Date.now() } });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text());
  });
  await p.goto(APP);
  await sleep(1500);
  await p.evaluate(() => {
    Whider.Notify.check = function () {};
  });
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch();

  /* 1. Presentación: para qué la usas → categorías y pestaña Personas */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] }, { 'whider.meta.v1': { onboarded: false, createdAt: Date.now() } });
    ok(await p.evaluate(() => Whider.Onboarding.isOpen()), 'la presentación se abre la primera vez');
    // Bienvenida → perfil → para qué la usas
    await p.click('.ob-foot .btn.primary');
    await sleep(300);
    await p.fill('.ob-input', 'Lucía');
    await p.click('.ob-foot .btn.primary');
    await sleep(300);
    ok(await p.isVisible('text=¿Para qué la vas a usar?'), 'pregunta para qué la vas a usar');
    await p.click('.ob-use:has-text("Estudios")');
    await p.click('.ob-use:has-text("Salud y deporte")');
    const marcadas = await p.$$eval('.ob-use.on b', (n) => n.map((x) => x.textContent));
    ok(marcadas.join() === 'Estudios,Salud y deporte', 'se marcan varias respuestas', marcadas);
    // Hasta el final (con o sin el paso de los avisos)
    for (let i = 0; i < 3 && (await p.evaluate(() => Whider.Onboarding.isOpen())); i++) {
      await p.click('.ob-foot .btn.primary');
      await sleep(400);
    }
    const st = await p.evaluate(() => ({
      uses: Whider.State.settings.uses,
      people: Whider.State.settings.peopleTab,
      lists: Whider.State.lists.map((l) => l.name),
      def: Whider.State.getList(Whider.State.settings.defaultList).name,
      attr: document.documentElement.getAttribute('data-people'),
      tab: getComputedStyle(document.querySelector('.dock .tab[data-go="friends"]')).display,
      name: Whider.State.displayName()
    }));
    ok(st.uses === 'study,health' && st.name === 'Lucía', 'guarda para qué la usas y tu nombre', st);
    ok(st.lists.join() === 'Personal,Salud,Estudios', 'categorías según el uso (sin «Trabajo», con «Estudios»)', st.lists);
    ok(st.def === 'Estudios', 'la categoría por defecto es la de estudios', st.def);
    ok(st.people === false && st.attr === 'off' && st.tab === 'none', 'sin «Con otras personas», la pestaña Personas no está', st);
    // Ajustes → Lo que ves → Personas: vuelve
    await p.evaluate(() => Whider.Settings.open('custom'));
    await sleep(500);
    await p.click('.sheet .cell:has-text("Personas") .switch');
    await sleep(300);
    ok(await p.evaluate(() => Whider.State.settings.peopleTab === true && getComputedStyle(document.querySelector('.dock .tab[data-go="friends"]')).display !== 'none'), 'Ajustes → Lo que ves la vuelve a poner');
    ok(!errs.length, 'sin errores (presentación)', errs);
    await ctx.close();
  }

  /* 2. Hoy: campo de arriba, importancia y «Cada día» */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] });
    const fuente = await p.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, h1: getComputedStyle(document.querySelector('#screen-home .lt h1')).fontFamily, ok: document.fonts.check('16px Inter') }));
    ok(/^"?Inter/.test(fuente.body) && /^"?Inter/.test(fuente.h1) && fuente.ok, 'todo en Inter (texto y títulos)', fuente);
    const barra = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('.dock .tab')].map((t) => t.dataset.go).join(), fab: getComputedStyle(document.getElementById('fab')).position }));
    ok(barra.tabs === 'home,tasks,calendar,notes,friends' && barra.fab === 'fixed', 'cinco pestañas y el «+» flotante', barra);
    // Una normal, una urgente (con el menú) y una importante (escrita con !!)
    await p.fill('#screen-home .composer input', 'Comprar pan');
    await p.press('#screen-home .composer input', 'Enter');
    await sleep(300);
    await p.click('#screen-home .cp-opt:has-text("Importancia")');
    await sleep(250);
    await p.click('.menu-item:has-text("Urgente")');
    await sleep(200);
    await p.fill('#screen-home .composer input', 'Entregar el informe');
    await p.press('#screen-home .composer input', 'Enter');
    await sleep(300);
    await p.fill('#screen-home .composer input', 'Llamar al banco !!');
    await p.press('#screen-home .composer input', 'Enter');
    await sleep(300);
    const orden = await p.$$eval('#screen-home .todo-sec .task-title', (n) => n.map((x) => x.textContent));
    ok(orden.join('|') === 'Entregar el informe|Llamar al banco|Comprar pan', 'Por hacer: de lo más importante a lo menos', orden);
    const aro = await p.evaluate(() => {
      const c = document.querySelector('#screen-home .todo-sec .task .check');
      return { cls: c.className, color: getComputedStyle(c).borderTopColor };
    });
    ok(/p-danger/.test(aro.cls) && /rgb\(255, 105, 97\)/.test(aro.color), 'lo urgente, con el círculo en rojo', aro);
    ok(await p.evaluate(() => document.querySelector('#screen-home .todo-sec .m-prio').textContent === 'Urgente'), 'la importancia también va escrita');
    ok(await p.evaluate(() => !document.querySelector('#screen-home .cp-opt.on')), 'tras añadir, la importancia vuelve a «normal»');
    // «Cada día»
    await p.click('#screen-home .cp-opt:has-text("Cada día")');
    await p.fill('#screen-home .composer input', 'Leer 20 minutos');
    await p.press('#screen-home .composer input', 'Enter');
    await sleep(300);
    const cada = await p.evaluate(() => ({
      sec: [...document.querySelectorAll('#screen-home .daily-sec .task-title')].map((x) => x.textContent),
      rep: (Whider.State.tasks.find((t) => t.text === 'Leer 20 minutos') || {}).repeat
    }));
    ok(cada.sec.join() === 'Leer 20 minutos' && cada.rep === 'daily', '«Cada día» crea una tarea que se repite y sale en su sección', cada);
    // Completarla: tachada en su sitio y la siguiente, mañana
    await p.click('#screen-home .daily-sec .task .check');
    await sleep(700);
    const hecha = await p.evaluate(() => ({
      done: document.querySelector('#screen-home .daily-sec .task').classList.contains('is-done'),
      cuenta: document.querySelector('#screen-home .daily-sec .sec-t small').textContent,
      manana: Whider.State.tasks.filter((t) => t.text === 'Leer 20 minutos' && !t.done).map((t) => t.date)
    }));
    ok(hecha.done && hecha.cuenta === '1 de 1' && hecha.manana[0] === hecha.manana[0] && hecha.manana.length === 1, 'hecha hoy, tachada en «Cada día»; vuelve mañana', hecha);
    ok(!errs.length, 'sin errores (Hoy)', errs);
    await ctx.close();
  }

  /* 3. Hábitos de antes → tareas de cada día; las diarias sin hacer pasan a hoy */
  {
    const viejo = Date.now() - 40 * 86400000;
    const seed = {
      'whider.meta.v1': { onboarded: true, createdAt: viejo },
      'whider.habits.v1': {
        habits: [
          { id: 'h1', name: 'Beber agua', freq: 'daily', target: 8, unit: 'vasos', reminder: '23:50', createdAt: viejo, updatedAt: viejo },
          { id: 'h2', name: 'Yoga', freq: 'days', days: [0, 1, 2, 3, 4, 5, 6], createdAt: viejo, updatedAt: viejo }
        ],
        log: { h1: {} }
      },
      'whider.v1': { tasks: [{ id: 'm1', text: 'Meditar', date: dias(-2), repeat: 'daily', mine: true, createdAt: viejo, updatedAt: viejo }] }
    };
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] }, seed);
    const r = await p.evaluate(() => ({
      aviso: !!document.querySelector('#screen-home .notice'),
      cada: [...document.querySelectorAll('#screen-home .daily-sec .task-title')].map((x) => x.textContent).sort(),
      agua: Whider.State.tasks.find((t) => /Beber agua/.test(t.text)),
      meditar: Whider.State.tasks.find((t) => t.text === 'Meditar').date,
      archivados: Whider.State.habits.every((h) => h.archived)
    }));
    ok(r.aviso, 'Hoy avisa una vez: «Tus hábitos ahora son tareas de cada día»');
    ok(r.cada.join('|') === 'Beber agua · 8 vasos|Meditar|Yoga', 'los hábitos y la diaria de antes, en «Cada día»', r.cada);
    ok(r.agua && r.agua.time === '23:50' && r.agua.warn === true && r.agua.repeat === 'daily', 'el recordatorio del hábito pasa a la hora y el aviso de la tarea', r.agua);
    ok(r.meditar === r.agua.date, 'la diaria sin hacer de hace dos días pasa sola a hoy', r);
    ok(r.archivados, 'los hábitos quedan archivados (con su historial)');
    await p.click('#screen-home .notice .nav-icon');
    await sleep(300);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .notice') && !Whider.State.meta.habitsMoved), 'el aviso se cierra y no vuelve');
    // Editor: «Cada semana» con varios días
    const id = await p.evaluate(() => Whider.State.addTask({ text: 'Gimnasio', date: Whider.U.today(), repeat: 'weekly' }).id);
    await p.evaluate((x) => Whider.Editor.open(x), id);
    await sleep(500);
    const dias7 = await p.$$eval('.sheet .day-opt', (n) => n.length);
    ok(dias7 === 7, 'con «Cada semana», el editor deja elegir los días', dias7);
    const libres = await p.$$eval('.sheet .day-opt:not(.on)', (n) => n.map((x) => x.getAttribute('aria-label')));
    await p.click('.sheet .day-opt[aria-label="' + libres[0] + '"]');
    await sleep(200);
    await p.click('.sheet .btn.primary');
    await sleep(500);
    const g = await p.evaluate((x) => Whider.State.find(x), id);
    ok(g.repeat === 'weekly' && g.days && g.days.length === 2, 'se guardan los días elegidos (dos: ya es «de cada día»)', g);
    ok(!errs.length, 'sin errores (hábitos)', errs);
    await ctx.close();
  }

  /* 4. Ordenador: barra lateral como la de X */
  {
    const { ctx, p, errs } = await abrir(b, { viewport: { width: 1440, height: 900 } });
    const sb = await p.evaluate(() => {
      const items = [...document.querySelectorAll('.sb-nav .sb-item')];
      const act = document.querySelector('.sb-nav .sb-item.active');
      const kids = [...document.querySelector('#sidebar').children].map((c) => c.className.split(' ')[0]);
      return {
        n: items.length,
        activo: act && act.dataset.go,
        peso: act && getComputedStyle(act).fontWeight,
        relleno: act && act.querySelector('use').getAttribute('href'),
        orden: kids.slice(0, 4).join(),
        fab: getComputedStyle(document.getElementById('fab')).display
      };
    });
    ok(sb.n === 5 && sb.activo === 'home', 'cinco secciones; Hoy activa', sb);
    ok(+sb.peso >= 700 && sb.relleno === '#i-sun-fill', 'la sección activa, en negrita y con su icono relleno', sb);
    ok(sb.orden === 'sb-brand,sb-search,sb-nav,sb-actions', 'logotipo, buscar, secciones y «Nueva tarea» debajo', sb.orden);
    ok(sb.fab === 'none', 'en el ordenador no hay «+» flotante (está «Nueva tarea»)', sb.fab);
    ok(!errs.length, 'sin errores (ordenador)', errs);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})();
