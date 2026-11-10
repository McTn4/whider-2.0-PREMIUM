/**
 * WHIDER · Planes: Gratis y Premium
 *
 * Todo lo esencial es gratis en el móvil y en el ordenador. Premium añade lo profesional:
 * sistemas y automatizaciones, organización muy avanzada (filtros sin límite, tablero,
 * estadísticas e informes completos), personalización avanzada, invitar por enlace o QR y crear
 * equipos, gestionar el ordenador desde el móvil, acciones rápidas y personajes Premium.
 * Sin Premium se pueden aceptar invitaciones, tener contactos, chatear y unirse a equipos.
 *
 * El plan se guarda con su propia marca de tiempo y se sincroniza con la cuenta (el
 * dispositivo que lo activó gana aunque otro tenga ajustes más recientes).
 * Se activa con un código o, si premium.trialDays es mayor que 0, con la prueba gratuita; el pago
 * se configura en js/config.js (premium.checkoutUrl): tras pagar se entrega un código de activación.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var CFG = (window.WHIDER_CONFIG || {}).premium || {};
  var DAY = 86400000;

  var PRICES = {
    currency: CFG.currency || '€',
    monthly: typeof CFG.monthly === 'number' ? CFG.monthly : 3.99,
    yearly: typeof CFG.yearly === 'number' ? CFG.yearly : 29.99,
    trialDays: typeof CFG.trialDays === 'number' ? Math.max(0, Math.floor(CFG.trialDays)) : 14
  };
  // Prueba gratuita: con trialDays 0 no se ofrece, y una prueba que estuviera en marcha deja de dar Premium
  var TRIAL = PRICES.trialDays > 0;
  // Códigos de activación: SHA-256 del código en mayúsculas (ver docs)
  var CODES = (CFG.codes || []).map(function (h) { return String(h).toLowerCase(); });

  // Enlaces de pago. Mientras no haya enlace real (checkoutUrl), se usa el de prueba de Stripe para
  // todos, avisando de que es de prueba. Con enlace real, el de prueba solo en el dispositivo que
  // encienda el modo de pruebas de pago (Ajustes → 7 toques en la versión): forced.
  // Sin enlace anual, sirve el mensual.
  var TEST_KEY = 'whider.payTest';
  function testOn() { try { return localStorage.getItem(TEST_KEY) === '1'; } catch (e) { return false; } }
  function links() {
    var real = CFG.checkoutUrl || null, test = CFG.testCheckoutUrl || null;
    if (test && (!real || testOn())) return { monthly: test, yearly: CFG.testCheckoutUrlYearly || test, test: true, forced: !!real };
    return { monthly: real, yearly: CFG.checkoutUrlYearly || real, test: false, forced: false };
  }

  // Premium pagado (8.1): al confirmar Stripe un pago, el servidor de pagos (pagos/api/stripe-webhook.js)
  // guarda entitlements/{uid} en Firestore. La app lo lee al iniciar sesión, al volver a ella tras pagar
  // y, mientras espera la confirmación, cada pocos segundos. Solo el servidor puede escribirlo.
  var PEND_KEY = 'whider.payPending', PEND_TIME = 30 * 60000, POLL = 6000, POLL_FOR = 3 * 60000;
  var buy = { checking: null, last: 0, timer: null, since: 0 };
  var auto = { state: null, at: 0, p: null };   // ¿está configurada la activación automática en el servidor?
  function pendingUntil() { try { return +localStorage.getItem(PEND_KEY) || 0; } catch (e) { return 0; } }
  function setPending(t) { try { if (t) localStorage.setItem(PEND_KEY, String(t)); else localStorage.removeItem(PEND_KEY); } catch (e) { /* sin almacenamiento */ } }
  function stopWatch() { if (buy.timer) { clearInterval(buy.timer); buy.timer = null; } }
  /** Mientras se espera la confirmación: cada 6 s los primeros 3 minutos; después, al volver a la app */
  function watch() {
    stopWatch();
    buy.since = Date.now();
    buy.timer = setInterval(function () {
      if (pendingUntil() < Date.now()) { setPending(0); stopWatch(); return; }
      if (Date.now() - buy.since > POLL_FOR) { stopWatch(); return; }
      if (document.visibilityState !== 'hidden') Plan.syncPurchase();
    }, POLL);
  }
  function askLogin() {
    W.Sheet.confirm({ title: 'Inicia sesión para hacerte Premium', text: 'Premium se guarda en tu cuenta: así se activa solo al pagar y lo tienes en todos tus dispositivos.', ok: 'Iniciar sesión' })
      .then(function (ok) { if (ok && W.AuthScreen) W.AuthScreen.open({ mode: 'login' }); });
  }
  /** Aplica el Premium pagado que dice el servidor (null = la cuenta no tiene ninguno) */
  function applyEntitlement(e) {
    var p = plan() || {}, t = Date.now();
    var valid = !!e && e.premium === true && (typeof e.until !== 'number' || e.until > t);
    var bought = p.tier === 'premium' && p.source === 'purchase';
    if (valid) {
      setPending(0); stopWatch();
      if (p.tier === 'premium' && p.source === 'code' && !p.until) return false;   // ya tiene Premium para siempre
      var until = typeof e.until === 'number' ? e.until : null, test = !!e.test;
      if (bought && (p.until || null) === until && !!p.test === test) return false;
      var fresh = !bought || !Plan.isPremium();
      S().setPlan({ tier: 'premium', source: 'purchase', until: until, test: test, trialUsed: !!p.trialUsed });
      if (fresh) {
        W.Audio.complete();
        W.Toast.show({ text: test ? 'Premium activado con tu pago de prueba (24 horas). ¡Gracias!' : 'Premium activado. ¡Gracias por tu pago!', type: 'success', icon: 'gem', duration: 5000 });
      }
      Plan.changed();
      if (W.Router) W.Router.refresh();
      return true;
    }
    if (bought) {
      // Terminó o se retiró (baja de la suscripción, pago de prueba de más de 24 h…)
      S().setPlan({ tier: 'free', source: null, until: null, test: false, trialUsed: !!p.trialUsed });
      Plan.changed();
      if (W.Router) W.Router.refresh();
    }
    return false;
  }

  /** Qué incluye Premium (con su explicación para la ventana de «Hazte Premium») */
  var FEATURES = {
    systems: { icon: 'system', title: 'Sistemas profesionales', text: 'Monta en un toque métodos como GTD, la matriz de Eisenhower o el bloqueo de tiempo, y crea tus propias automatizaciones.' },
    automations: { icon: 'bolt', title: 'Automatizaciones avanzadas', text: 'Reglas sin límite con condiciones y acciones a tu medida, prueba antes de activar e historial.' },
    filters: { icon: 'filter', title: 'Filtros sin límite', text: 'Guarda todos los filtros que quieras para tener cada cosa a mano.' },
    board: { icon: 'board', title: 'Vista de tablero', text: 'Organiza las tareas en columnas por categoría, prioridad o fecha y muévelas arrastrando.' },
    stats: { icon: 'chart', title: 'Estadísticas avanzadas', text: 'Hasta un año de historia, comparativas, horas y días más productivos y conclusiones.' },
    reports: { icon: 'print', title: 'Informes completos', text: 'Cualquier periodo, en PDF, hoja de cálculo (CSV) o JSON, listos para compartir.' },
    custom: { icon: 'palette', title: 'Personalización avanzada', text: 'Elige qué ves en la barra lateral y en Hoy, el calendario a tu medida, ancho y contraste.' },
    community: { icon: 'users', title: 'Invitar y crear equipos', text: 'Añade a amigos y compañeros con tu enlace o tu código QR y crea equipos con su chat y páginas compartidas.' },
    remote: { icon: 'phone', title: 'Gestionar el ordenador', text: 'Desde el móvil, mira y controla el enfoque del ordenador y tus dispositivos conectados.' },
    quick: { icon: 'bolt', title: 'Mayor rapidez', text: 'Plantillas de un toque, accesos directos y sincronización al instante entre dispositivos.' },
    items: { icon: 'gem', title: 'Personajes Premium', text: 'Astronauta, dragón, fénix, unicornio y gema, con acabados, efectos, fondos y marcos para tu foto de perfil.' }
  };
  /** Límites del plan gratuito (Premium: sin límite) */
  var FREE = { filters: 3, rules: 2, statsDays: 30, spaces: 0 };

  var subs = [];
  var warnedEnd = false;

  function plan() { return S().plan; }
  function now() { return Date.now(); }

  /* ---------- SHA-256 (también sin contexto seguro, p. ej. archivos locales) ---------- */
  function sha256(ascii) {
    var rr = function (v, n) { return (v >>> n) | (v << (32 - n)); };
    var pow = Math.pow, maxWord = pow(2, 32), result = '', words = [], bitLen = ascii.length * 8;
    var hash = [], k = [], primes = 0, composite = {}, i, j;
    for (var cand = 2; primes < 64; cand++) {
      if (!composite[cand]) {
        for (i = 0; i < 313; i += cand) composite[i] = cand;
        hash[primes] = (pow(cand, 0.5) * maxWord) | 0;
        k[primes++] = (pow(cand, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (bitLen / maxWord) | 0;
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? '0' : '') + b.toString(16); }
    return result;
  }
  // El código se compara en mayúsculas. Los espacios valen como guiones o se ignoran: se prueban las dos formas.
  function codeForms(c) {
    var up = String(c || '').toUpperCase().trim();
    var dashed = up.replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
    var joined = up.replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
    return dashed === joined ? [dashed] : [dashed, joined];
  }

  function fmtPrice(v) { return v.toFixed(2).replace('.', ',') + ' ' + PRICES.currency; }

  var Plan = {
    PRICES: PRICES,
    FEATURES: FEATURES,
    FREE: FREE,
    sha256: sha256,
    fmtPrice: fmtPrice,

    get: plan,
    isPremium: function () {
      var p = plan();
      if (!p || p.tier !== 'premium') return false;
      if (p.source === 'trial' && !TRIAL) return false;
      return !p.until || p.until > now();
    },
    isTrial: function () { var p = plan(); return Plan.isPremium() && p.source === 'trial'; },
    /** Premium pagado (activado por el servidor de pagos) y, de ellos, los pagos de prueba de Stripe */
    isPurchase: function () { var p = plan(); return Plan.isPremium() && p.source === 'purchase'; },
    isTestPurchase: function () { var p = plan(); return Plan.isPurchase() && !!p.test; },
    daysLeft: function () { var p = plan(); return p && p.until ? Math.max(0, Math.ceil((p.until - now()) / DAY)) : null; },
    label: function () { return Plan.isPremium() ? (Plan.isTrial() ? 'Premium (prueba)' : Plan.isTestPurchase() ? 'Premium (pago de prueba)' : 'Premium') : 'Gratis'; },
    /** Texto corto del estado: «Premium · quedan 9 días de prueba» */
    status: function () {
      if (!Plan.isPremium()) return TRIAL && plan() && plan().trialUsed ? 'Plan gratuito · ya usaste la prueba' : 'Plan gratuito';
      var d = Plan.daysLeft();
      if (Plan.isTrial()) return 'Prueba de Premium · ' + (d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días');
      if (Plan.isTestPurchase()) {
        var h = Math.max(1, Math.ceil((plan().until - now()) / 3600000));
        return 'Premium con un pago de prueba · ' + (h > 48 ? 'quedan ' + d + ' días' : h === 1 ? 'queda 1 hora' : 'quedan ' + h + ' horas');
      }
      return d != null ? 'Premium · ' + (d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días') : 'Premium activo';
    },
    canTrial: function () { var p = plan(); return TRIAL && !(p && p.trialUsed) && !Plan.isPremium(); },
    /** ¿Ofrece la app prueba gratuita? (premium.trialDays > 0 en js/config.js) */
    trialOn: function () { return TRIAL; },

    can: function (feature) { return Plan.isPremium() || !FEATURES[feature]; },
    /** Límite del plan gratuito (Infinity con Premium) */
    limit: function (name) { return Plan.isPremium() ? Infinity : (FREE[name] != null ? FREE[name] : Infinity); },

    /** true si se puede usar; si no, abre la ventana de Premium con esa función destacada */
    gate: function (feature, opts) {
      if (Plan.can(feature)) return true;
      Plan.paywall(feature, opts);
      return false;
    },
    /** Para límites: gateLimit('filters', ya tienes 3) */
    gateLimit: function (name, current, feature) {
      if (current < Plan.limit(name)) return true;
      Plan.paywall(feature || name, { limit: FREE[name] });
      return false;
    },

    onChange: function (fn) { subs.push(fn); },
    changed: function () { subs.forEach(function (fn) { try { fn(Plan.isPremium()); } catch (e) { console.error(e); } }); },

    startTrial: function () {
      if (!Plan.canTrial()) return false;
      S().setPlan({ tier: 'premium', source: 'trial', until: now() + PRICES.trialDays * DAY, trialUsed: true });
      W.Audio.complete();
      W.Toast.show({ text: 'Premium activado: ' + PRICES.trialDays + ' días gratis', type: 'success', icon: 'gem', duration: 4000 });
      Plan.changed();
      return true;
    },
    /** Activa Premium con un código (devuelve true si es válido) */
    redeem: function (code) {
      var c = codeForms(code).filter(function (f) { return f && CODES.indexOf(sha256(f)) >= 0; })[0];
      if (!c) return false;
      var p = plan() || {};
      S().setPlan({ tier: 'premium', source: 'code', until: null, trialUsed: true, code: c.slice(0, 4) + '…' });
      W.Audio.complete();
      W.Toast.show({ text: 'Premium activado. ¡Gracias por apoyar WHIDER!', type: 'success', icon: 'gem', duration: 4500 });
      Plan.changed();
      return true;
    },
    /** Vuelve al plan gratuito (desde Ajustes) */
    cancel: function () {
      var p = plan() || {};
      S().setPlan({ tier: 'free', source: null, until: null, trialUsed: !!p.trialUsed });
      Plan.changed();
    },
    /**
     * Pago: abre la página de pago configurada (o explica cómo conseguir un código).
     * Lleva la cuenta (client_reference_id) y su correo, para saber en Stripe quién ha pagado.
     */
    checkout: function (period) {
      var L = links(), url = period === 'yearly' ? L.yearly : L.monthly;
      if (!url) return false;
      var A = W.Auth, u = A && A.user;
      // Premium se guarda en la cuenta: sin sesión no se sabría a quién activárselo
      if (A && A.configured() && !u) { askLogin(); return true; }
      var full = url + (url.indexOf('?') < 0 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(u ? u.uid : 'invitado') +
        (u && u.email ? '&prefilled_email=' + encodeURIComponent(u.email) : '');
      // En el navegador del sistema: en el APK y en la app de escritorio, nunca dentro de la propia app
      if (window.WhiderDesktop) window.WhiderDesktop.openExternal(full);
      else if (window.WhiderAndroid && window.WhiderAndroid.openUrl) window.WhiderAndroid.openUrl(full);
      else window.open(full, '_blank', 'noopener');
      if (u) { setPending(now() + PEND_TIME); watch(); if (W.Router) W.Router.refresh(); }
      var ready = Plan.autoActivation() && !!u;
      if (L.test) W.Toast.show({ text: 'Pago de prueba: usa la tarjeta 4242 4242 4242 4242 (fecha futura y cualquier CVC). No se cobra nada' + (ready ? '. Al terminar, vuelve a WHIDER: Premium se activará solo durante 24 horas.' : ' y, por ahora, no activa Premium.'), icon: 'gem', duration: 9000 });
      else if (ready) W.Toast.show({ text: 'Al terminar el pago, vuelve a WHIDER: Premium se activará solo.', icon: 'gem', duration: 6000 });
      else W.Toast.show({ text: 'Al completar el pago recibirás tu código de activación', icon: 'mail', duration: 5000 });
      return true;
    },

    /**
     * Lee el Premium pagado de la cuenta (entitlements/{uid}) y lo aplica. force: sin esperar.
     * Mientras se espera un pago se mira como mucho cada 5 s; si no, cada 10 minutos.
     */
    syncPurchase: function (force) {
      var A = W.Auth;
      if (!A || !A.configured() || !A.user) return Promise.resolve(false);
      if (buy.checking) return buy.checking;
      var gap = pendingUntil() > now() ? 5000 : 10 * 60000;
      if (!force && now() - buy.last < gap) return Promise.resolve(false);
      buy.last = now();
      var uid = A.user.uid;
      buy.checking = A.whenReady().then(function () {
        var F = A.sdk(), db = A.db();
        if (!F || !db || !A.user || A.user.uid !== uid) return false;
        return F.getDoc(F.doc(db, 'entitlements', uid)).then(function (snap) { return applyEntitlement(snap.exists() ? snap.data() : null); });
      }).catch(function (e) { console.warn('Premium pagado:', e && (e.code || e.message)); return false; })
        .then(function (r) { buy.checking = null; return r; });
      return buy.checking;
    },
    /** ¿Se está esperando la confirmación de un pago hecho desde este dispositivo? */
    isPending: function () { return pendingUntil() > now() && !Plan.isPremium(); },
    /** Al arrancar: vigila el pago pendiente y, al volver a la app, mira si ya está confirmado */
    initPurchases: function () {
      var back = function () {
        if (document.visibilityState === 'hidden') return;
        var p = plan() || {};
        if (pendingUntil() > now() || p.source === 'purchase') Plan.syncPurchase();
      };
      document.addEventListener('visibilitychange', back);
      window.addEventListener('focus', back);
      if (W.Auth && W.Auth.onChange) W.Auth.onChange(function (u) { if (u) Plan.syncPurchase(true); });
      if (pendingUntil() > now()) watch(); else setPending(0);
      Plan.autoStatus();
    },
    /** ¿Está configurada la activación automática? Lo pregunta al servidor de pagos (sin secretos) */
    autoStatus: function () {
      var url = CFG.activationUrl;
      if (!url || typeof fetch !== 'function') return Promise.resolve(false);
      if (auto.p) return auto.p;
      if (auto.state !== null && now() - auto.at < 5 * 60000) return Promise.resolve(auto.state);
      auto.p = fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return !!(j && j.ok && j.stripe && j.firebase); }, function () { return false; })
        .then(function (s) {
          var changed = s !== auto.state;
          auto.state = s; auto.at = now(); auto.p = null;
          if (changed && W.State && W.State.activeScreen === 'plans' && W.Router) W.Router.refresh();
          return s;
        });
      return auto.p;
    },
    autoActivation: function () { return auto.state === true; },
    hasCheckout: function () { return !!links().monthly; },
    /** ¿El pago abre el enlace de prueba de Stripe? (sin enlace real, o con el modo de pruebas encendido) */
    isTestCheckout: function () { return links().test; },
    /** Modo de pruebas de pago encendido en este dispositivo aunque haya enlace real */
    isTestForced: function () { return links().forced; },
    /** Los 7 toques en la versión solo sirven si hay enlace real y de prueba entre los que cambiar */
    canTestCheckout: function () { return !!(CFG.testCheckoutUrl && CFG.checkoutUrl); },
    setTestCheckout: function (on) {
      try { if (on) localStorage.setItem(TEST_KEY, '1'); else localStorage.removeItem(TEST_KEY); } catch (e) { /* sin almacenamiento */ }
      Plan.changed();
      // La pantalla de debajo (p. ej. Planes, detrás de Ajustes) cambia de botón y de aviso al momento
      if (W.Router) W.Router.refresh();
    },

    /** Al abrir la app: avisa (una vez) de que la prueba terminó (o de que la app ya no ofrece prueba) */
    check: function () {
      var p = plan();
      if (!p || p.tier !== 'premium' || !p.until || warnedEnd) return;
      if (p.until > now() && !(p.source === 'trial' && !TRIAL)) return;
      warnedEnd = true;
      if (S().meta.trialEndSeen === p.until) return;
      S().setMeta('trialEndSeen', p.until);
      W.Toast.show({ text: p.source === 'trial' ? 'Tu prueba de Premium ha terminado. Todo lo tuyo sigue aquí.' : 'Tu Premium ha caducado. Todo lo tuyo sigue aquí.', icon: 'gem', duration: 6000,
        action: { label: 'Ver planes', fn: function () { Plan.open(); } } });
    },

    open: function () { W.Router.go('plans'); },

    /** Ventana de «Hazte Premium» con la función que se quería usar */
    paywall: function (feature, opts) {
      opts = opts || {};
      var f = FEATURES[feature] || FEATURES.systems;
      var others = Object.keys(FEATURES).filter(function (k) { return k !== feature; }).slice(0, 5).map(function (k) {
        var x = FEATURES[k];
        return U.el('li', [U.icon(x.icon, 'sm'), U.el('span', { text: x.title })]);
      });
      var actions = [];
      if (Plan.canTrial()) actions.push(U.el('button.btn.primary.block', { on: { click: function () { s.close(); Plan.startTrial(); } } }, [U.icon('gem', 'sm'), 'Probar ' + PRICES.trialDays + ' días gratis']));
      actions.push(U.el('button.btn.' + (Plan.canTrial() ? 'ghost' : 'primary') + '.block', { on: { click: function () { s.close(); setTimeout(Plan.open, 120); } } }, ['Ver planes y precios']));
      var s = W.Sheet.open({
        title: 'Premium', className: 'paywall',
        body: [
          U.el('div.pw-hero', [U.el('span.pw-gem', [U.icon(f.icon)]),
            U.el('strong', { text: f.title }),
            U.el('p', { text: opts.limit ? 'El plan gratuito incluye ' + opts.limit + '. ' + f.text : f.text })]),
          U.el('div.pw-price', [U.el('b', { text: 'Desde ' + fmtPrice(PRICES.yearly / 12) }), U.el('span', { text: ' al mes con el plan anual' })]),
          U.el('ul.pw-list', others),
          U.el('div.pw-actions', actions)
        ]
      });
      return s;
    }
  };

  W.Plan = Plan;
})(window.Whider);
