// Calendarios suscritos: añadir uno por su enlace (con los errores claros de un enlace malo, uno que ya no existe y
// una página que no es un calendario), sus eventos en todas las vistas del calendario (ordenador y móvil) y en Hoy,
// la ficha de un evento con «Crear una tarea», ocultarlo, que siga ahí sin conexión y quitarlo.
// La función del servidor (api/calendario.js) se simula: tiene sus propias pruebas unitarias.
const { chromium } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!c) fails++; };

const pad = (n) => String(n).padStart(2, '0');
const ymd = (x) => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate());

/** El calendario «Trabajo», con fechas relativas a hoy (en la hora de Madrid, la del navegador de la prueba) */
function trabajo() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  const dia = (n) => ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Trabajo',
    'BEGIN:VEVENT', 'UID:r1', 'SUMMARY:Reunión de equipo', 'LOCATION:Sala 4', 'DESCRIPTION:Cifras del trimestre<br>y <b>planes</b>',
    'DTSTART;TZID=Europe/Madrid:' + dia(0) + 'T100000', 'DTEND;TZID=Europe/Madrid:' + dia(0) + 'T110000', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:f1', 'SUMMARY:Festivo local', 'DTSTART;VALUE=DATE:' + dia(1), 'DTEND;VALUE=DATE:' + dia(2), 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:c1', 'SUMMARY:Clase de inglés', 'DTSTART;TZID=Europe/Madrid:' + dia(0) + 'T183000', 'DURATION:PT1H', 'RRULE:FREQ=WEEKLY;COUNT=6', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:x1', 'SUMMARY:Cancelada', 'STATUS:CANCELLED', 'DTSTART;TZID=Europe/Madrid:' + dia(0) + 'T120000', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 60 * 86400000 }));
  });
  // La función del servidor, simulada: lo que pediría la app y lo que respondería
  const pedidas = [];
  let caido = false;
  await ctx.route('**/api/calendario', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"method"}' });
    const { url } = JSON.parse(req.postData() || '{}');
    pedidas.push(url);
    if (caido) return route.abort('internetdisconnected');
    if (url === 'https://cal.example/trabajo.ics') return route.fulfill({ status: 200, contentType: 'text/calendar; charset=utf-8', body: trabajo() });
    if (url === 'https://cal.example/no-existe.ics') return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"status","upstream":404}' });
    if (url === 'https://cal.example/pagina') return route.fulfill({ status: 422, contentType: 'application/json', body: '{"error":"format"}' });
    return route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"network"}' });
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  // Las respuestas de error de la función simulada salen en la consola del navegador: son las esperadas
  p.on('console', (m) => { if (m.type() === 'error' && !/status of (4|5)\d\d|ERR_INTERNET_DISCONNECTED/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(APP);
  await sleep(1500);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  const hoy = await p.evaluate(() => Whider.U.today());

  // ---- Ajustes → Calendarios suscritos
  await p.evaluate(() => Whider.Settings.open());
  await sleep(500);
  await p.locator('.sheet .cell', { hasText: 'Calendarios suscritos' }).first().click();
  await sleep(500);
  ok(await p.locator('.sheet .cell', { hasText: 'Añadir un calendario' }).count() === 1, 'Ajustes → Calendarios suscritos, con «Añadir un calendario»');
  ok(await p.locator('.sheet .cell', { hasText: 'Google Calendar' }).count() === 1, 'explica dónde está el enlace en Google, Outlook y Apple');
  await p.locator('.sheet .cell', { hasText: 'Añadir un calendario' }).click();
  await sleep(500);
  const enlace = p.locator('.sheet input[type="url"]');
  const msg = p.locator('.sheet .form-msg');
  const anadir = p.locator('.sheet .sheet-foot .btn.primary');
  await enlace.fill('esto no es un enlace');
  await anadir.click();
  await sleep(300);
  ok(/no es válido/.test(await msg.textContent()), 'un enlace mal escrito se dice sin preguntar a nadie', await msg.textContent());
  ok(pedidas.length === 0, 'y no llega al servidor');
  await enlace.fill('https://cal.example/no-existe.ics');
  await anadir.click();
  await sleep(500);
  ok(/no se encuentra o ya no es público/.test(await msg.textContent()), 'un calendario que ya no existe (404) se explica', await msg.textContent());
  await enlace.fill('https://cal.example/pagina');
  await anadir.click();
  await sleep(500);
  ok(/no lleva a un calendario/.test(await msg.textContent()), 'una página web que no es un calendario, también', await msg.textContent());
  ok(await p.evaluate(() => Whider.Calendars.list().length) === 0, 'nada de eso se añade');
  // webcal:// (como lo dan Apple y Outlook) se pide por https
  await enlace.fill('webcal://cal.example/trabajo.ics');
  await anadir.click();
  await sleep(800);
  ok(pedidas[pedidas.length - 1] === 'https://cal.example/trabajo.ics', 'webcal:// se pide por https', pedidas);
  const toast = await p.locator('.toast').last().textContent().catch(() => '');
  ok(/Calendario añadido: 6 eventos|Calendario añadido: \d+ eventos/.test(toast || ''), 'aviso: calendario añadido con sus eventos', toast);
  const guardado = await p.evaluate(() => ({ cals: Whider.State.settings.calendars, cache: JSON.parse(localStorage.getItem('whider.cal.v1') || '{}') }));
  ok(guardado.cals.length === 1 && guardado.cals[0].name === 'Trabajo' && guardado.cals[0].url === 'https://cal.example/trabajo.ics', 'en los ajustes (se sincronizan): nombre del propio calendario y enlace https', guardado.cals);
  ok(Object.keys(guardado.cache).length === 1 && Object.values(guardado.cache)[0].events.length === 3, 'en el dispositivo, sus eventos (el cancelado no)', Object.values(guardado.cache).map((c) => c.events.length));
  ok(await p.locator('.sheet .cell', { hasText: 'Trabajo' }).count() === 1, 'la lista lo enseña');
  const sub = await p.locator('.sheet .cell', { hasText: 'Trabajo' }).locator('.cell-sub').textContent();
  ok(/Actualizado/.test(sub) && /3 eventos/.test(sub), 'con cuándo se actualizó y cuántos eventos tiene', sub);
  // Opciones con «…» (la fila no es un botón: el interruptor funciona en todos los navegadores)
  ok(await p.locator('.sheet button.cell', { hasText: 'Trabajo' }).count() === 0, 'la fila del calendario no es un botón con un interruptor dentro');
  await p.locator('.sheet .cal-more').click();
  await sleep(500);
  ok(await p.locator('.sheet .cell', { hasText: 'Actualizar ahora' }).count() === 1 && await p.locator('.sheet .cell', { hasText: 'Quitar este calendario' }).count() === 1, '«…»: actualizar, cambiar el nombre o quitar');
  await p.keyboard.press('Escape');
  await sleep(200);
  await p.evaluate(() => { while (Whider.Sheet.isOpen()) Whider.Sheet.closeTop(); });
  await sleep(400);

  // ---- Hoy
  await p.evaluate(() => Whider.Router.go('home'));
  await sleep(500);
  const agenda = await p.locator('#screen-home .ev-sec').innerText().catch(() => '');
  ok(/Agenda de hoy/.test(agenda) && /Reunión de equipo/.test(agenda) && /Clase de inglés/.test(agenda) && !/Cancelada/.test(agenda), 'Hoy: «Agenda de hoy» con los eventos de hoy', agenda);
  ok(/10:00/.test(agenda) && /Trabajo/.test(agenda) && /Sala 4/.test(agenda), 'con la hora, el calendario y el lugar', agenda);

  // ---- Calendario en el ordenador: mes, semana y día
  await p.evaluate(() => { Whider.State.ui.calView = 'month'; Whider.State.ui.calSelected = Whider.U.today(); Whider.Router.go('calendar'); });
  await sleep(600);
  ok(await p.locator('.cal-toolbar .ct-cals', { hasText: 'Calendarios (1)' }).count() === 1, 'barra del calendario: «Calendarios (1)»');
  const celda = p.locator('.mg-cell[data-date="' + hoy + '"]');
  ok(await celda.locator('.mg-chip.ev', { hasText: 'Reunión de equipo' }).count() === 1, 'mes: el evento en la casilla de hoy');
  const manana = await p.evaluate(() => Whider.U.addDays(Whider.U.today(), 1));
  const enMes = await p.evaluate((d) => !!document.querySelector('.mg-cell[data-date="' + d + '"]'), manana);
  if (enMes) ok(await p.locator('.mg-cell[data-date="' + manana + '"] .mg-chip.ev', { hasText: 'Festivo local' }).count() === 1, 'mes: el de todo el día, mañana');
  ok(/evento/.test(await celda.getAttribute('aria-label')), 'la casilla dice que hay eventos (lectores de pantalla)', await celda.getAttribute('aria-label'));
  ok(await p.locator('.cal-side .ev-row', { hasText: 'Reunión de equipo' }).count() === 1, 'panel del día elegido: el evento en su lista');
  await p.evaluate(() => { Whider.State.ui.calView = 'week'; Whider.Router.refresh(); });
  await sleep(500);
  const blk = p.locator('.wg-col[data-date="' + hoy + '"] .wg-blk.ev', { hasText: 'Reunión de equipo' });
  ok(await blk.count() === 1, 'semana: el evento como bloque en su hora');
  const alto = await blk.evaluate((el) => el.getBoundingClientRect().height);
  ok(alto > 45, 'del alto de su duración (una hora)', alto);
  await p.evaluate(() => { Whider.State.ui.calView = 'day'; Whider.Router.refresh(); });
  await sleep(500);
  ok(await p.locator('.wg-blk.ev', { hasText: 'Clase de inglés' }).count() === 1, 'día: también el que se repite');
  // Un evento no se arrastra: abre su ficha
  await p.locator('.wg-blk.ev', { hasText: 'Reunión de equipo' }).click();
  await sleep(500);
  const ficha = await p.locator('.sheet.ev-sheet').innerText().catch(() => '');
  ok(/Reunión de equipo/.test(ficha) && /10:00 – 11:00/.test(ficha) && /Trabajo/.test(ficha) && /Sala 4/.test(ficha), 'ficha del evento: título, horas, calendario y lugar', ficha);
  ok(/Cifras del trimestre\ny planes/.test(ficha) && !/<b>/.test(ficha), 'notas sin etiquetas HTML', ficha);
  ok(await p.evaluate((d) => Whider.State.tasks.every((t) => t.date !== d || t.text !== 'Reunión de equipo'), hoy), 'el evento no es una tarea…');
  await p.locator('.sheet.ev-sheet .btn.primary', { hasText: 'Crear una tarea' }).click();
  await sleep(700);
  const tarea = await p.evaluate(() => Whider.State.tasks.find((t) => t.text === 'Reunión de equipo'));
  ok(!!tarea && tarea.date === hoy && tarea.time === '10:00' && tarea.duration === 60 && /Sala 4/.test(tarea.notes), '…pero con «Crear una tarea» sale una, con su día, hora, duración y notas', tarea);
  ok(await p.locator('.sheet.editor').count() >= 1, 'y se abre para ajustarla');
  await p.evaluate(() => { while (Whider.Sheet.isOpen()) Whider.Sheet.closeTop(); });
  await sleep(400);

  // ---- Agenda: lo que se repite, en cada semana (COUNT=6)
  await p.evaluate(() => { Whider.State.ui.calView = 'agenda'; Whider.Router.refresh(); });
  await sleep(500);
  const clases = await p.locator('#screen-calendar .ev-row', { hasText: 'Clase de inglés' }).count();
  ok(clases === 5, 'agenda (30 días): la clase semanal en cada semana (hoy y cuatro más)', clases);

  // ---- Sin conexión: se sigue viendo lo último que llegó
  caido = true;
  const st = await p.evaluate(() => Whider.Calendars.refresh(Whider.Calendars.list()[0].id, true));
  ok(st && st.ok === false && st.count === 3, 'si falla la descarga, se quedan los eventos que ya había', st);
  ok(await p.locator('#screen-calendar .ev-row', { hasText: 'Reunión de equipo' }).count() >= 1, 'y siguen en el calendario');
  caido = false;

  // ---- Móvil
  await p.setViewportSize({ width: 390, height: 844 });
  await sleep(700);
  await p.evaluate(() => { Whider.State.ui.calView = 'month'; Whider.State.ui.calSelected = Whider.U.today(); Whider.Router.refresh(); });
  await sleep(600);
  ok(await p.locator('.cal-day.today .cal-dots i.ev, .cal-day.selected .cal-dots i.ev').count() >= 1, 'móvil, mes: un rombo en el día con eventos');
  ok(await p.locator('#screen-calendar .ev-row', { hasText: 'Reunión de equipo' }).count() === 1, 'móvil, panel del día: el evento');
  ok(await p.locator('.cal-tools .chip', { hasText: 'Calendarios (1)' }).count() === 1, 'móvil: «Calendarios (1)» junto a los filtros');
  await p.evaluate(() => { Whider.State.ui.calView = 'week'; Whider.Router.refresh(); });
  await sleep(500);
  ok(await p.locator('.hours .blk.ev', { hasText: 'Reunión de equipo' }).count() === 1, 'móvil, semana: el evento en el día por horas');
  await p.screenshot({ path: require('path').join(require('./_util').OUT, 'calendarios-movil.png') });

  // ---- Ocultar y quitar
  await p.evaluate(() => Whider.Calendars.update(Whider.Calendars.list()[0].id, { on: false }));
  await sleep(400);
  ok(await p.locator('#screen-calendar .ev-row, #screen-calendar .blk.ev').count() === 0, 'oculto: sus eventos dejan de verse');
  await p.evaluate(() => Whider.Router.go('home'));
  await sleep(400);
  ok(await p.locator('#screen-home .ev-sec').count() === 0, 'tampoco en Hoy');
  await p.evaluate(() => Whider.Calendars.remove(Whider.Calendars.list()[0].id));
  await sleep(300);
  const fin = await p.evaluate(() => ({ cals: Whider.State.settings.calendars.length, cache: Object.keys(JSON.parse(localStorage.getItem('whider.cal.v1') || '{}')).length }));
  ok(fin.cals === 0 && fin.cache === 0, 'quitado: fuera de los ajustes y del dispositivo', fin);

  ok(errs.length === 0, 'sin errores en la página', errs);
  await b.close();
  console.log(fails ? '\n' + fails + ' FALLOS' : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
