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
 * Se activa con la prueba gratuita o con un código; el pago se configura en js/config.js
 * (premium.checkoutUrl): tras pagar se entrega un código de activación.
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
    trialDays: typeof CFG.trialDays === 'number' ? CFG.trialDays : 14
  };
  // Códigos de activación: SHA-256 del código en mayúsculas (ver docs)
  var CODES = (CFG.codes || []).map(function (h) { return String(h).toLowerCase(); });

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
      return !!p && p.tier === 'premium' && (!p.until || p.until > now());
    },
    isTrial: function () { var p = plan(); return Plan.isPremium() && p.source === 'trial'; },
    daysLeft: function () { var p = plan(); return p && p.until ? Math.max(0, Math.ceil((p.until - now()) / DAY)) : null; },
    label: function () { return Plan.isPremium() ? (Plan.isTrial() ? 'Premium (prueba)' : 'Premium') : 'Gratis'; },
    /** Texto corto del estado: «Premium · quedan 9 días de prueba» */
    status: function () {
      if (!Plan.isPremium()) return plan() && plan().trialUsed ? 'Plan gratuito · ya usaste la prueba' : 'Plan gratuito';
      var d = Plan.daysLeft();
      if (Plan.isTrial()) return 'Prueba de Premium · ' + (d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días');
      return d != null ? 'Premium · ' + (d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días') : 'Premium activo';
    },
    canTrial: function () { var p = plan(); return !(p && p.trialUsed) && !Plan.isPremium(); },

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
    /** Pago: abre la página de pago configurada (o explica cómo conseguir un código) */
    checkout: function (period) {
      var url = CFG.checkoutUrl && (period === 'yearly' && CFG.checkoutUrlYearly ? CFG.checkoutUrlYearly : CFG.checkoutUrl);
      if (url) {
        var uid = W.Auth && W.Auth.user ? W.Auth.user.uid : '';
        var full = url + (url.indexOf('?') < 0 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(uid || 'invitado');
        if (window.WhiderDesktop) window.WhiderDesktop.openExternal(full); else window.open(full, '_blank', 'noopener');
        W.Toast.show({ text: 'Al completar el pago recibirás tu código de activación', icon: 'mail', duration: 5000 });
        return true;
      }
      return false;
    },
    hasCheckout: function () { return !!CFG.checkoutUrl; },

    /** Al abrir la app: avisa (una vez) de que la prueba terminó */
    check: function () {
      var p = plan();
      if (!p || p.tier !== 'premium' || !p.until || p.until > now() || warnedEnd) return;
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
