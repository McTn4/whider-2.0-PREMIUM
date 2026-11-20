// @ts-check
/**
 * WHIDER · Novedades
 * Qué ha cambiado en cada versión, con las notas de CHANGELOG.md (las trae js/core/version.js).
 *  - Tras una actualización aparece una tarjeta discreta en Hoy («WHIDER se ha actualizado»): no
 *    interrumpe; se abre con un toque o se cierra, y desaparece sola a las dos semanas.
 *  - Siempre a mano en Ajustes → Ayuda → Novedades (todas las versiones).
 * Cada dispositivo recuerda la última versión que ha visto (no se sincroniza: cada uno se actualiza a su ritmo).
 * En otro idioma, las notas se traducen con su catálogo (la clave es el texto del CHANGELOG) y solo salen las versiones
 * que lo tienen traducido: las anteriores al inglés no se enseñan a medias.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var KEY = 'whider.seenVersion';
  var FIRST_KEY = 'whider.updatedAt';
  var DIAS = 14;
  var SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  function releases() {
    var all = /** @type {any[]} */ (W.RELEASES || []);
    if (!W.I18n || W.I18n.lang === 'es') return all;
    return all.filter(function (r) { return !r.summary || W.I18n.has(r.summary); });
  }
  function current() { return String(W.VERSION || '0.0.0'); }

  /** -1, 0 o 1 (las de prueba van antes que la estable de la misma versión) */
  function cmp(a, b) {
    var pa = SEMVER.exec(String(a || '')), pb = SEMVER.exec(String(b || ''));
    if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
    for (var i = 1; i <= 3; i++) if (+pa[i] !== +pb[i]) return +pa[i] < +pb[i] ? -1 : 1;
    var rank = function (/** @type {RegExpExecArray} */ p) { return p[4] ? { alpha: 0, beta: 30, rc: 60 }[p[4]] + +p[5] : 99; };
    var ra = rank(pa), rb = rank(pb);
    return ra === rb ? 0 : ra < rb ? -1 : 1;
  }
  /** «1.1.0», «1.1.0 beta 2» */
  function label(v) {
    var p = SEMVER.exec(String(v || ''));
    if (!p) return String(v || '');
    return p[1] + '.' + p[2] + '.' + p[3] + (p[4] ? ' ' + p[4] + ' ' + p[5] : '');
  }
  function dateText(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    if (W.I18n && W.I18n.lang !== 'es') return W.I18n.date(new Date(+m[1], +m[2] - 1, +m[3]), { day: 'numeric', month: 'short', year: 'numeric' });
    return +m[3] + ' ' + MESES[+m[2] - 1] + ' ' + m[1];
  }
  /** Lo poco de Markdown que usa el CHANGELOG: **negrita** y `código` (todo lo demás, como texto) */
  function inline(s) {
    var esc = String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return esc
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

  /**
   * La última versión vista. Si no hay ninguna: quien ya usaba WHIDER viene de la 1.0 (la última sin esta
   * pantalla); en una instalación nueva no hay nada que contar.
   */
  function seen() {
    var v = get(KEY);
    if (v) return v;
    var st = S();
    return st && st.meta && st.meta.onboarded ? '1.0.0' : current();
  }
  function markSeen() { put(KEY, current()); put(FIRST_KEY, null); }

  /** Versiones posteriores a la vista, hasta la actual (si la actual es estable, sin sus betas) */
  function pending() {
    var from = seen(), now = current(), stableNow = !/-/.test(now);
    return releases().filter(function (r) {
      if (cmp(r.v, from) <= 0 || cmp(r.v, now) > 0) return false;
      return !(stableNow && /-/.test(r.v));
    });
  }
  /** ¿Toca la tarjeta en Hoy? (y, a las dos semanas, se da por vista) */
  function due() {
    if (!pending().length) {
      if (get(KEY) !== current()) put(KEY, current());
      return false;
    }
    var since = +(get(FIRST_KEY) || 0);
    if (!since) { put(FIRST_KEY, String(Date.now())); return true; }
    if (Date.now() - since > DIAS * 86400000) { markSeen(); return false; }
    return true;
  }

  function releaseNode(r) {
    var kids = [
      U.el('div.wn-head', [
        U.el('h4', { text: W.t('WHIDER {0}', { 0: label(r.v) }) }),
        /-/.test(r.v) ? U.el('span.pill', { text: W.t('De prueba') }) : null,
        r.date ? U.el('small', { text: dateText(r.date) }) : null
      ]),
      r.summary ? U.el('p.wn-summary', { html: inline(W.t(r.summary)) }) : null
    ];
    (r.groups || []).forEach(function (g) {
      kids.push(U.el('h5', { text: W.t(g.t) }));
      kids.push(U.el('ul', g.items.map(function (it) { return U.el('li', { html: inline(W.t(it)) }); })));
    });
    return U.el('section.wn-release', kids);
  }

  /** Hoja con las notas. o.only: solo esas versiones (lo nuevo desde la última vista) */
  function open(o) {
    o = o || {};
    var list = o.only && o.only.length ? o.only : releases();
    var all = list.length < releases().length;
    var sheet = W.Sheet.open({
      title: W.t('Novedades'), className: 'whatsnew',
      body: [
        U.el('div.wn-list', list.map(releaseNode)),
        all ? U.el('button.link-btn.wn-all', { text: W.t('Ver todas las versiones'), attrs: { type: 'button' }, on: { click: function () { sheet.close(); open(); } } }) : null,
        U.el('p.hint.wn-foot', { text: W.t('Estás usando WHIDER {0}.', { 0: label(current()) }) })
      ]
    });
    markSeen();
    if (W.Router && W.Router.current && W.Router.current() === 'home') W.Router.refresh();
    return sheet;
  }

  /** Tarjeta en Hoy tras actualizar (null si no toca) */
  function card() {
    if (!due()) return null;
    var list = pending(), top = list[0];
    var close = U.el('button.circle-btn.sm', { attrs: { type: 'button', 'aria-label': W.t('Cerrar el aviso de novedades') }, on: { click: function () {
      markSeen();
      W.Toast.show({ text: W.t('Las novedades quedan en Ajustes → Ayuda'), icon: 'info' });
      W.Router.refresh();
    } } }, [U.icon('close', 'xs')]);
    var go = U.el('button.btn.sm.soft', { text: W.t('Ver novedades'), attrs: { type: 'button' }, on: { click: function () { open({ only: list }); } } });
    return U.el('div.wn-card', { attrs: { role: 'status' } }, [
      U.el('span.wn-badge', { attrs: { 'aria-hidden': 'true' } }, [U.icon('star', 'xs')]),
      U.el('div.wn-text', [
        U.el('b', { text: W.t('WHIDER se ha actualizado a la {0}', { 0: label(current()) }) }),
        top && top.summary ? U.el('small', { text: W.t(top.summary) }) : null
      ]),
      go, close
    ]);
  }

  W.WhatsNew = { cmp: cmp, label: label, pending: pending, seen: seen, markSeen: markSeen, due: due, card: card, open: open, inline: inline };
})(window.Whider);
