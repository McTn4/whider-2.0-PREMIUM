// Adjuntos del Cuaderno: añadir fotos y archivos, verlos, descargarlos, quitarlos y que sigan ahí al recargar
const { chromium, devices } = require('playwright');
const { APP, FX, OUT, fixtures } = require('./_util');
const fs = require('fs'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const URL0 = APP;


async function setup(b, ctxOpts) {
  const ctx = await b.newContext(Object.assign({ acceptDownloads: true }, ctxOpts));
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return { ctx, p, errs };
}
async function openNotes(p, id) {
  await p.goto(URL0); await sleep(1500);
  await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Router.go('notes'); }); await sleep(900);
  if (id) { await p.evaluate(id => Whider.Notes.openPage(id), id); await sleep(900); }
}
const blocksOf = (p, id) => p.evaluate(id => Whider.Pages.content(id).blocks.map(b => ({ t: b.t, f: b.f || null, n: b.n || null, m: b.m || null, s: b.s || 0, ar: b.ar || null })), id);

async function desktop(b) {
  console.log('\n— Ordenador —');
  const { ctx, p, errs } = await setup(b, { viewport: { width: 1280, height: 860 } });
  await openNotes(p);
  const id = await p.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Viaje a Lisboa', blocks: [P.block('p', 'Billetes y reservas:'), P.block('p', '')] }); Whider.Notes.openPage(m.id); return m.id; });
  await sleep(900);
  // Cursor en la primera línea y «Adjuntar» de la cabecera (el foco se va al botón: se usa el último bloque con cursor)
  await p.click('#screen-notes .bk-text >> nth=0'); await p.keyboard.press('End');
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.pg-addons button:has-text("Adjuntar")')]);
  ok(fc.isMultiple(), 'el selector permite elegir varios archivos');
  await fc.setFiles([path.join(FX, 'foto.png'), path.join(FX, 'Factura marzo.pdf'), path.join(FX, 'notas.txt')]);
  await sleep(1500);
  let bl = await blocksOf(p, id);
  ok(bl[0].t === 'p' && bl[1].t === 'img' && bl[2].t === 'file' && bl[3].t === 'file', 'van en orden justo después de la línea con el cursor: ' + bl.map(x => x.t).join(' · '));
  ok(bl[1].f && bl[1].ar > 1.4 && bl[1].ar < 1.6 && bl[1].m === 'image/png', 'la foto queda como imagen con su proporción (' + bl[1].ar + ')');
  ok(bl[2].n === 'Factura marzo.pdf' && bl[2].m === 'application/pdf' && bl[2].s > 3000, 'el PDF guarda nombre, tipo y tamaño');
  ok(await p.locator('.bk-img-box.ready img[src^="blob:"]').count() === 1, 'la imagen se ve en la página');
  const card = await p.locator('.bkf').first().innerText();
  ok(/Factura marzo\.pdf/.test(card) && /3 KB · En este dispositivo/.test(card), 'tarjeta del PDF: ' + card.replace(/\n/g, ' | '));
  ok(/TXT/.test(await p.locator('.bkf').nth(1).locator('.bkf-ic').innerText()), 'el .txt lleva su etiqueta de tipo');
  await p.screenshot({ path: path.join(OUT, 'pc-adjuntos.png') });

  // Visor de la imagen
  await p.click('.bk-img-box img'); await sleep(500);
  ok(await p.locator('.fv-layer.open .fv-img').count() === 1, 'la imagen se abre en grande en el visor');
  await p.screenshot({ path: path.join(OUT, 'pc-visor.png') });
  await p.keyboard.press('Escape'); await sleep(350);
  ok(await p.locator('.fv-layer').count() === 0, 'Esc cierra el visor');
  // Texto: se ve dentro de la app
  await p.locator('.bkf').nth(1).locator('.bkf-main').click(); await sleep(500);
  ok(/Lista de la compra/.test(await p.locator('.fv-text').innerText().catch(() => '')), 'el .txt se lee en el visor');
  await p.keyboard.press('Escape'); await sleep(300);
  // Descargar el PDF
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('.bkf').first().locator('.bkf-btn').first().click()]);
  const dlPath = await dl.path();
  ok(dl.suggestedFilename() === 'Factura marzo.pdf' && fs.statSync(dlPath).size === fs.statSync(path.join(FX, 'Factura marzo.pdf')).size, 'se descarga entero y con su nombre (' + dl.suggestedFilename() + ')');

  // Recargar: todo sigue ahí (IndexedDB)
  await openNotes(p, id);
  bl = await blocksOf(p, id);
  ok(bl.filter(x => x.f).length === 3, 'tras recargar, la página conserva los 3 adjuntos');
  await sleep(600);
  ok(await p.locator('.bk-img-box.ready img[src^="blob:"]').count() === 1, 'tras recargar, la imagen se vuelve a ver');
  const recs = await p.evaluate(() => new Promise(res => { const r = indexedDB.open('whider-files'); r.onsuccess = () => { const t = r.result.transaction(['meta', 'data']); const a = t.objectStore('meta').getAll(), d = t.objectStore('data').count(); t.oncomplete = () => res({ meta: a.result.map(x => x.name + ':' + x.size), data: d.result }); }; }));
  ok(recs.data === 3, 'en el almacén del dispositivo: ' + recs.meta.join(', '));

  // Quitar con «Deshacer»
  await p.evaluate(() => { document.querySelector('#screen-notes .bk-editor').__mark = 1; window.__log = []; const o = Whider.Toast.show; Whider.Toast.show = function (x) { if (x && x.action) { const f = x.action.fn; x.action.fn = function () { window.__log.push('undo-fn, editor vivo: ' + !!(document.querySelector('#screen-notes .bk-editor') || {}).__mark); return f(); }; } return o.apply(this, arguments); }; });
  await p.locator('.bkf').first().locator('.bkf-btn').nth(1).click(); await sleep(400);
  ok((await blocksOf(p, id)).filter(x => x.t === 'file').length === 1, 'el botón de la papelera quita el archivo de la página');
  await p.click('.toast-action:has-text("Deshacer")'); await sleep(400);
  console.log('   registro:', await p.evaluate(() => window.__log));
  bl = await blocksOf(p, id);
  ok(bl.filter(x => x.t === 'file').length === 2 && bl[2].n === 'Factura marzo.pdf', '«Deshacer» lo devuelve a su sitio: ' + bl.map(x => x.n || x.t).join(' · ') + ' / avisos: ' + JSON.stringify(await p.locator('.toast').allInnerTexts()));

  // Pegar una captura y soltar un archivo arrastrándolo
  await p.click('#screen-notes .bk-text >> nth=0');
  await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 200; c.getContext('2d').fillRect(0, 0, 160, 100);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'captura.png', { type: 'image/png' }));
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await sleep(1200);
  bl = await blocksOf(p, id);
  ok(bl[1].t === 'img' && bl[1].n === 'captura.png', 'pegar una captura la añade como imagen debajo del cursor');
  await p.evaluate(() => {
    const target = [...document.querySelectorAll('#screen-notes .bk')].pop(), r = target.getBoundingClientRect();
    const dt = new DataTransfer(); dt.items.add(new File(['a,b\n1,2\n'], 'datos.csv', { type: 'text/csv' }));
    const at = { bubbles: true, cancelable: true, clientX: r.left + 20, clientY: r.bottom - 2, dataTransfer: dt };
    target.dispatchEvent(new DragEvent('dragover', at)); target.dispatchEvent(new DragEvent('drop', at));
  });
  await sleep(1000);
  bl = await blocksOf(p, id);
  ok(bl[bl.length - 1].n === 'datos.csv' || bl[bl.length - 2].n === 'datos.csv', 'soltar un archivo sobre la página lo adjunta: ' + bl.map(x => x.n || x.t).join(' · '));

  // Foto grande: se reduce; archivo de más de 15 MB: aviso claro
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.click('.pg-addons button:has-text("Adjuntar")')]);
  await fc2.setFiles([path.join(FX, 'grande.jpg'), path.join(FX, 'enorme.zip')]);
  await sleep(4000);
  bl = await blocksOf(p, id);
  const big = bl.filter(x => x.n === 'grande.jpg')[0];
  ok(big && big.s < fs.statSync(path.join(FX, 'grande.jpg')).size && big.s < 2.6e6, 'la foto grande (' + (fs.statSync(path.join(FX, 'grande.jpg')).size / 1e6).toFixed(1) + ' MB) se guarda reducida: ' + (big ? (big.s / 1e6).toFixed(2) + ' MB' : 'no está'));
  const toasts = await p.locator('.toast').allInnerTexts();
  ok(!bl.some(x => x.n === 'enorme.zip') && toasts.some(t => /enorme\.zip.*15 MB/.test(t)), 'el de 16 MB no se añade y se explica: ' + toasts.filter(t => /enorme/.test(t)).join(''));

  // Menú «/» → Archivo
  await p.click('#screen-notes .bk-text >> nth=0'); await p.keyboard.press('End'); await p.keyboard.press('Enter');
  await p.keyboard.type('/archivo'); await sleep(400);
  const first = (await p.locator('.bk-menu .bk-menu-i.on').innerText()).split('\n')[0];
  ok(first === 'Archivo', 'escribir «/archivo» propone el bloque Archivo');
  const [fc3] = await Promise.all([p.waitForEvent('filechooser'), p.keyboard.press('Enter')]);
  await fc3.setFiles([path.join(FX, 'notas.txt')]); await sleep(900);
  bl = await blocksOf(p, id);
  ok(bl[1].t === 'file' && bl[1].n === 'notas.txt', 'el bloque Archivo se rellena con lo elegido');
  // Buscar por el nombre del archivo
  const hits = await p.evaluate(() => Whider.Pages.search('factura').map(h => Whider.Pages.title(h.page)));
  ok(hits.indexOf('Viaje a Lisboa') >= 0, 'la búsqueda encuentra la página por el nombre de un adjunto');
  // Markdown
  const md = await p.evaluate(id => Whider.Pages.toMarkdown(id), id);
  ok(/\[Archivo: Factura marzo\.pdf\]/.test(md), 'al exportar a Markdown aparecen los archivos');
  await p.screenshot({ path: path.join(OUT, 'pc-adjuntos-2.png'), fullPage: false });
  ok(!errs.length, 'sin errores en el ordenador ' + JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}

async function mobile(b) {
  console.log('\n— Móvil —');
  const { ctx, p, errs } = await setup(b, Object.assign({}, devices['Pixel 7']));
  await openNotes(p);
  const id = await p.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Recetas', blocks: [P.block('p', 'Ingredientes')] }); Whider.Notes.openPage(m.id); return m.id; });
  await sleep(1200);
  await p.tap('#screen-notes .bk-text >> nth=0'); await sleep(500);
  ok(await p.locator('.kb-bar.show button[aria-label^="Adjuntar"]').count() === 1, 'la barra del teclado tiene «Adjuntar»');
  await p.locator('.kb-bar.show button[aria-label^="Adjuntar"]').tap(); await sleep(600);
  const opts = await p.locator('.sheet .opt, .sheet [role="option"], .sheet button').allInnerTexts();
  ok(opts.join(' ').indexOf('Fotos') >= 0 && opts.join(' ').indexOf('Archivos') >= 0, 'pregunta «Fotos» o «Archivos», como en el móvil');
  await p.screenshot({ path: path.join(OUT, 'movil-elegir.png') });
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.sheet').getByText('Fotos', { exact: true }).tap()]);
  ok(/image/.test(await fc.element().getAttribute('accept') || ''), '«Fotos» abre la galería (solo imágenes)');
  await fc.setFiles([path.join(FX, 'foto.png')]); await sleep(1500);
  await p.tap('#screen-notes .bk-text >> nth=0'); await sleep(400);
  await p.locator('.kb-bar.show button[aria-label^="Adjuntar"]').tap(); await sleep(600);
  const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.sheet').getByText('Archivos', { exact: true }).tap()]);
  await fc2.setFiles([path.join(FX, 'Factura marzo.pdf')]); await sleep(1200);
  const bl = await blocksOf(p, id);
  ok(bl.map(x => x.t).join(',') === 'p,file,img' || bl.map(x => x.t).join(',') === 'p,img,file', 'en la página: ' + bl.map(x => x.n || x.t).join(' · '));
  await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(400);
  await p.screenshot({ path: path.join(OUT, 'movil-adjuntos.png') });
  // Las tarjetas caben en la pantalla
  const fit = await p.evaluate(() => [...document.querySelectorAll('.bkf, .bk-img-box')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 0.5; }));
  ok(fit, 'las tarjetas no se salen de la pantalla');
  // Visor en el móvil: se toca la imagen
  await p.tap('.bk-img-box img'); await sleep(500);
  ok(await p.locator('.fv-layer.open .fv-img').count() === 1, 'tocar la imagen la abre a pantalla completa');
  await p.screenshot({ path: path.join(OUT, 'movil-visor.png') });
  const back = await p.evaluate(() => Whider.App.handleBack());
  await sleep(300);
  ok(back && await p.locator('.fv-layer').count() === 0, 'el botón Atrás de Android cierra el visor');
  // Recargar
  await openNotes(p, id); await sleep(500);
  ok((await blocksOf(p, id)).filter(x => x.f).length === 2 && await p.locator('.bk-img-box.ready img').count() === 1, 'tras recargar siguen la foto y el PDF');
  ok(!errs.length, 'sin errores en el móvil ' + JSON.stringify(errs.slice(0, 3)));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  await fixtures(b);
  await desktop(b);
  await mobile(b);
  await b.close();
  console.log(fails ? '\n' + fails + ' FALLOS' : '\nTODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
