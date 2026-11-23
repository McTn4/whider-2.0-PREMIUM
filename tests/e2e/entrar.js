// 2.1 · Entrar solo con Google, Microsoft o Apple (emuladores)
//  - La pantalla de acceso: los tres botones; ni «Continuar sin cuenta» ni crear una cuenta con correo.
//  - Microsoft en la web: entra aunque su correo no venga verificado, y la nube lo acepta (reglas nuevas).
//  - Android: la app abre /entrar/ en el navegador del móvil; la página vuelve a la app con la sesión
//    (whider://auth?s=…&u=…) y la app la adopta. Una vuelta que la app no ha pedido no hace nada; con otro código, no
//    se acepta.
//  - Las cuentas con correo y contraseña de antes siguen entrando («¿Tu cuenta es de correo y contraseña?»).
//  - Quien usaba WHIDER sin cuenta ve la pantalla de acceso y sus tareas pasan a su cuenta al entrar.
//  - Cerrar sesión vuelve a la pantalla de acceso.
// La ventana de cada proveedor se simula (ver _cuentas.js); todo lo demás es lo de verdad.
const { chromium } = require('playwright');
const { APP, BASE } = require('./_util');
const { simular, cuenta, entrar } = require('./_cuentas');

const EMU = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', PROJECT = 'demo-whider';
const cfg = {
  firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' },
  requireAccount: true,
  emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 },
  links: { base: 'https://whider-red.vercel.app' }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => {
  console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : ''));
  if (!c) fails++;
};
async function waitFor(p, fn, arg, ms) {
  const end = Date.now() + (ms || 20000);
  while (Date.now() < end) {
    try {
      if (await p.evaluate(fn, arg)) return true;
    } catch (e) {
      /* recargando */
    }
    await sleep(400);
  }
  return false;
}
const appDoc = async (uid) => {
  const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/state/app`, { headers: { Authorization: 'Bearer owner' } });
  return r.status === 200 ? JSON.stringify(await r.json()) : '';
};
async function device(b, init, label) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript((c) => {
    window.WHIDER_CONFIG = c;
  }, cfg);
  await ctx.addInitScript(simular);
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.errs = [];
  p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => p.errs.push(label + ': ' + e.message));
  await p.goto(APP);
  await sleep(2300);
  return p;
}
async function afterAuth(p) {
  await sleep(2500);
  await p.evaluate(() => {
    if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click();
  });
  await sleep(700);
}

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch();

  /* 1. La pantalla de acceso */
  const A = await device(b, null, 'A');
  const scr = await A.evaluate(() => {
    const r = document.getElementById('authRoot');
    return {
      open: Whider.AuthScreen.isOpen(),
      btns: Array.from(r.querySelectorAll('.provider-btn')).map((x) => x.textContent.trim()),
      inputs: r.querySelectorAll('input').length,
      text: r.textContent
    };
  });
  ok(
    scr.open && scr.btns.join(' | ') === 'Continuar con Google | Continuar con Microsoft | Continuar con Apple' && scr.inputs === 0,
    'al abrir: solo Google, Microsoft y Apple',
    scr.btns
  );
  ok(!/sin cuenta|Crear cuenta/i.test(scr.text) && /política de privacidad/.test(scr.text), 'sin «Continuar sin cuenta» ni «Crear cuenta», con la política de privacidad');
  ok(await A.evaluate(() => (Whider.App.handleBack(), Whider.AuthScreen.isOpen())), 'Atrás no deja usar la app sin cuenta');
  // Si se cierra la ventana del proveedor, no pasa nada (ni error)
  await A.click('#authRoot .provider-btn.apple');
  await sleep(600);
  ok(await A.evaluate(() => Whider.AuthScreen.isOpen() && !document.querySelector('#authRoot .auth-error.show') && !document.querySelector('#authRoot .provider-btn.loading')), 'cerrar la ventana de Apple: se puede volver a intentar');

  /* 2. Microsoft en la web (sin el correo verificado) */
  await entrar(A, 'ana@outlook.com', 'Ana Outlook', 'microsoft');
  await afterAuth(A);
  ok(await waitFor(A, () => Whider.Auth.user && !Whider.AuthScreen.isOpen() && Whider.Sync.status === 'synced'), 'Microsoft: entra y la nube lo acepta');
  const ms = await A.evaluate(() => ({ verified: Whider.Auth.user.emailVerified, ok: Whider.Auth.isVerified(), name: Whider.Auth.providerName(), shown: Whider.State.displayName() }));
  ok(ms.verified === false && ms.ok && ms.name === 'Microsoft', 'la cuenta de Microsoft sin el correo verificado sirve igual', ms);
  const uidA = await A.evaluate(() => Whider.Auth.user.uid);
  await A.evaluate(() => Whider.State.addTask({ text: 'Tarea desde Microsoft', date: Whider.U.today() }));
  await A.evaluate(() => Whider.Sync.push());
  await sleep(1200);
  ok(/Tarea desde Microsoft/.test(await appDoc(uidA)), 'sus tareas se guardan en su cuenta');
  await A.evaluate(() => Whider.Settings.open('account'));
  await sleep(700);
  ok(/Has iniciado sesión con Microsoft/.test(await A.evaluate(() => document.getElementById('sheetRoot').textContent)), 'Ajustes → Cuenta: «Has iniciado sesión con Microsoft»');
  await A.evaluate(() => {
    while (Whider.Sheet.closeTop());
  });
  await sleep(400);

  /* 3. Cerrar sesión vuelve a la pantalla de acceso */
  await A.evaluate(() => Whider.App.logout());
  ok(await waitFor(A, () => !Whider.Auth.user && Whider.AuthScreen.isOpen() && !!document.querySelector('#authRoot .provider-btn.google')), 'cerrar sesión: de vuelta a la pantalla de acceso');

  /* 4. Android: la página /entrar/ y la vuelta a la app con la sesión */
  const P = await device(b, null, 'Android');
  // Una vuelta que la app no ha pedido no hace nada
  await P.evaluate(() => window.WhiderOpenLink('whider://auth?s=' + '0'.repeat(48) + '&u=e30'));
  await sleep(600);
  ok(await P.evaluate(() => Whider.AuthScreen.isOpen() && !document.querySelector('.toast')), 'una vuelta que nadie ha pedido no hace nada');
  const url = await P.evaluate(() => {
    let u = '';
    Whider.U.openExternal = (x) => {
      u = x;
    };
    Whider.Auth.browserSignIn('apple.com').catch(() => {});
    return u;
  });
  ok(/^https:\/\/whider-red\.vercel\.app\/entrar\/\?p=apple\.com&s=[0-9a-f]{48}&to=android$/.test(url), 'la app abre /entrar/ en el navegador con su código', url);
  const ctxW = await b.newContext({ viewport: { width: 412, height: 860 } });
  await ctxW.addInitScript((c) => {
    window.WHIDER_CONFIG = c;
  }, cfg);
  await ctxW.addInitScript(simular);
  const Wp = await ctxW.newPage();
  const werrs = [];
  Wp.on('pageerror', (e) => werrs.push(e.message));
  await Wp.goto(BASE + '/entrar/' + url.split('/entrar/')[1]);
  await sleep(1200);
  ok(/Continuar con Apple/.test(await Wp.textContent('#go')), 'la página ofrece «Continuar con Apple»');
  await Wp.evaluate((c) => {
    window.__cuentaPrueba = c;
  }, cuenta('bea@icloud.com', 'Bea Apple', 'apple'));
  await Wp.click('#go');
  await Wp.waitForSelector('#back:not([hidden])', { timeout: 10000 }).catch(() => {});
  const back = await Wp.getAttribute('#back', 'href');
  ok(/^intent:\/\/auth\?s=[0-9a-f]{48}&u=[A-Za-z0-9_-]+#Intent;scheme=whider;package=com\.whider\.app;end$/.test(back || ''), '«Volver a WHIDER» lleva a la app (solo a la de WHIDER) con la sesión', (back || '').slice(0, 80));
  ok(await Wp.evaluate(() => !Object.keys(localStorage).some((k) => k.indexOf('firebase:authUser') === 0) && !/s=/.test(location.search)), 'la página cierra su sesión y olvida el código');
  ok(werrs.length === 0, 'la página /entrar/ sin errores', werrs);
  // Otro código: no se acepta (y hay que volver a empezar)
  const link = (back || '').replace(/^intent:\/\//, 'whider://').replace(/#Intent;.*$/, '');
  await P.evaluate((u) => window.WhiderOpenLink(u.replace(/s=[0-9a-f]+/, 's=' + 'a'.repeat(48))), link);
  await sleep(700);
  ok(await P.evaluate(() => !Whider.Auth.user && Whider.AuthScreen.isOpen()), 'con otro código no entra');
  // De nuevo, ya con el código bueno
  const url2 = await P.evaluate(() => {
    let u = '';
    Whider.U.openExternal = (x) => {
      u = x;
    };
    Whider.Auth.browserSignIn('apple.com').catch(() => {});
    return u;
  });
  await Wp.goto(BASE + '/entrar/' + url2.split('/entrar/')[1]);
  await sleep(1000);
  await Wp.evaluate((c) => {
    window.__cuentaPrueba = c;
  }, cuenta('bea@icloud.com', 'Bea Apple', 'apple'));
  await Wp.click('#go');
  await Wp.waitForSelector('#back:not([hidden])', { timeout: 10000 }).catch(() => {});
  const back2 = await Wp.getAttribute('#back', 'href');
  await P.evaluate((u) => window.WhiderOpenLink(u), (back2 || '').replace(/^intent:\/\//, 'whider://').replace(/#Intent;.*$/, ''));
  await afterAuth(P);
  ok(await waitFor(P, () => Whider.Auth.user && Whider.Auth.providerName() === 'Apple' && !Whider.AuthScreen.isOpen() && Whider.Sync.status === 'synced'), 'Android: la app adopta la sesión de Apple y sincroniza');
  // La misma vuelta repetida (dos toques en «Volver a WHIDER»): nada
  await P.evaluate((u) => window.WhiderOpenLink(u), (back2 || '').replace(/^intent:\/\//, 'whider://').replace(/#Intent;.*$/, ''));
  await sleep(600);
  ok(await P.evaluate(() => !!Whider.Auth.user && !document.querySelector('.toast.danger')), 'la vuelta repetida no molesta');

  /* 4b. Android, en la pantalla de acceso: «Continuar con Microsoft» abre el navegador; si vuelves sin terminar, el
     botón deja de esperar, y el aviso tiene «Cancelar» */
  const And = await device(
    b,
    () => {
      window.WhiderAndroid = { openUrl: (u) => (window.__abierto = u) };
    },
    'Android UI'
  );
  const fuera = (p) =>
    p.evaluate(() => {
      let estado = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
      document.dispatchEvent(new Event('visibilitychange'));
      estado = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
  await And.click('#authRoot .provider-btn.microsoft');
  await sleep(800);
  const abierto = await And.evaluate(() => ({ url: window.__abierto || '', loading: !!document.querySelector('#authRoot .provider-btn.loading'), aviso: (document.querySelector('.toast') || {}).textContent || '' }));
  ok(/\/entrar\/\?p=microsoft\.com&s=[0-9a-f]{48}&to=android$/.test(abierto.url) && abierto.loading && /navegador/.test(abierto.aviso) && /Cancelar/.test(abierto.aviso), 'Android: Microsoft abre /entrar/ en el navegador y lo explica', abierto);
  await fuera(And);
  await sleep(3200);
  ok(await And.evaluate(() => !document.querySelector('#authRoot .provider-btn.loading') && !document.querySelector('#authRoot .auth-error.show')), 'si vuelves a la app sin terminar, el botón deja de esperar (sin error)');
  await And.click('#authRoot .provider-btn.apple');
  await sleep(600);
  await And.click('.toast >> text=Cancelar');
  await sleep(500);
  ok(await And.evaluate(() => !document.querySelector('#authRoot .provider-btn.loading') && !document.querySelector('#authRoot .auth-error.show')), '«Cancelar» en el aviso deja volver a elegir');

  /* 5. Las cuentas con correo y contraseña de antes siguen entrando */
  const su = await (
    await fetch(`${EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'carla@ejemplo.com', password: 'Secreta123', returnSecureToken: true })
    })
  ).json();
  await fetch(`${EMU}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: su.localId, emailVerified: true, displayName: 'Carla' })
  });
  const C = await device(b, null, 'C');
  await C.click('#authRoot >> text=¿Tu cuenta es de correo y contraseña?');
  await sleep(400);
  ok(await C.evaluate(() => !document.querySelector('#authRoot input[autocomplete=name]') && !!document.querySelector('#authRoot input[type=password]')), 'correo y contraseña: solo para entrar (no se crean cuentas)');
  await C.fill('#authRoot input[type=email]', 'carla@ejemplo.com');
  await C.fill('#authRoot input[type=password]', 'Secreta123');
  await C.click('#authRoot .auth-submit');
  await afterAuth(C);
  ok(await waitFor(C, () => Whider.Auth.user && Whider.Auth.provider() === 'password' && !Whider.AuthScreen.isOpen() && Whider.Sync.status === 'synced'), 'una cuenta de correo de antes entra y sincroniza');

  /* 6. Quien usaba WHIDER sin cuenta: pantalla de acceso, y sus tareas pasan a su cuenta */
  const G = await device(
    b,
    () => {
      if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, guest: true, createdAt: Date.now() - 864e5 }));
    },
    'G'
  );
  ok(await G.evaluate(() => Whider.AuthScreen.isOpen()), 'quien usaba WHIDER sin cuenta ve la pantalla de acceso');
  await G.evaluate(() => Whider.State.addTask({ text: 'Tarea de antes sin cuenta', date: Whider.U.today() }));
  await entrar(G, 'dani@gmail.com', 'Dani');
  await afterAuth(G);
  ok(await waitFor(G, () => Whider.Auth.user && Whider.Sync.status === 'synced'), 'entra con Google');
  const uidG = await G.evaluate(() => Whider.Auth.user.uid);
  await G.evaluate(() => Whider.Sync.push());
  await sleep(1200);
  ok(
    (await G.evaluate(() => Whider.State.tasks.some((t) => t.text === 'Tarea de antes sin cuenta'))) && /Tarea de antes sin cuenta/.test(await appDoc(uidG)),
    'sus tareas de antes siguen ahí y se guardan en su cuenta'
  );

  const errs = [].concat(A.errs, P.errs, And.errs, C.errs, G.errs);
  ok(errs.length === 0, 'sin errores en la app', errs);
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
