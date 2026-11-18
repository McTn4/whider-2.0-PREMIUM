// @ts-check
/**
 * WHIDER · Copias de seguridad automáticas (sobre todo para quien no tiene cuenta: sus datos solo están en el
 * dispositivo)
 *  - Ordenador: una copia al día en la carpeta de datos de la app (se guardan las 10 últimas), con la lista
 *    para recuperarlas y «Abrir la carpeta».
 *  - Android (10 o posterior): una copia al día en Descargas › WHIDER › Copias (se guardan las 7 últimas).
 *    Sigue ahí aunque se desinstale la app.
 *  - Navegador: no puede guardar archivos sin preguntar, así que si pasa una semana sin copia, un aviso en Hoy.
 * Con cuenta, la nube ya guarda todo: la copia automática viene apagada (se puede encender en Ajustes → Datos).
 * La copia es la misma que «Guardar una copia» (tareas, Cuaderno, hábitos, sistemas y ajustes).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var KEY = 'whider.backup.v1';
  var DIA = 86400000, SEMANA = 7 * DIA;

  function get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function put(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } }
  function desktop() { var D = /** @type {any} */ (window).WhiderDesktop; return D && D.backup ? D.backup : null; }
  function android() { var A = /** @type {any} */ (window).WhiderAndroid; return A && typeof A.backupWrite === 'function' ? A : null; }
  function signed() { return !!(W.Auth && W.Auth.user); }
  /** ¿Dónde se puede guardar sola? 'desktop', 'android' o '' (navegador: solo aviso) */
  function where() { return desktop() ? 'desktop' : android() ? 'android' : ''; }
  /** Encendida: lo que diga Ajustes o, si no se ha tocado, encendida sin cuenta y apagada con ella */
  function enabled() { var o = get(); return typeof o.on === 'boolean' ? o.on : !signed(); }
  function setEnabled(on) { var o = get(); o.on = !!on; put(o); if (on) setTimeout(function () { run(false); }, 300); }

  /** Todo lo que guarda una copia (lo mismo que «Guardar una copia») */
  function data() {
    var snap = S().snapshot();
    if (W.Pages) {
      var mine = W.Pages.all().concat(W.Pages.all({ trash: true })).filter(function (m) { return !m.team; });
      snap.pages = mine.map(function (m) { return { meta: m, content: W.Pages.content(m.id) }; });
    }
    snap.backup = { app: 'WHIDER', version: W.VERSION, at: Date.now() };
    return snap;
  }
  function hasData() { var st = S(); return !!(st && (st.tasks.length || (st.habits && st.habits.length) || (W.Pages && W.Pages.count && W.Pages.count() > 0))); }

  /**
   * Hace la copia si toca (una al día) o si se pide (force). Devuelve una promesa con
   * { ok, where, name } o { ok: false, reason }.
   */
  function run(force) {
    var w = where(), o = get();
    if (!w) return Promise.resolve({ ok: false, reason: 'browser' });
    if (!force && (!enabled() || !hasData() || (o.at && Date.now() - o.at < DIA))) return Promise.resolve({ ok: false, reason: 'not-due' });
    var name = 'whider-copia-auto-' + U.today() + '.json', json = JSON.stringify(data());
    var done = function (ok) {
      if (!ok) return { ok: false, reason: 'error' };
      var n = get();
      n.at = Date.now(); n.where = w; n.name = name;
      put(n);
      return { ok: true, where: w, name: name };
    };
    if (w === 'desktop') return desktop().write(name, json).then(function (r) { return done(r && r.ok); }, function () { return done(false); });
    try { return Promise.resolve(done(!!android().backupWrite(name, json))); } catch (e) { return Promise.resolve(done(false)); }
  }

  /** Navegador sin cuenta: ¿toca recordar que guarde una copia? (una semana sin copia, con datos) */
  function reminderDue() {
    if (where() || signed() || !hasData()) return false;
    var o = get(), last = Math.max(o.manual || 0, o.at || 0, o.snooze || 0);
    var since = last || (S().meta && S().meta.createdAt) || Date.now();
    return Date.now() - since > SEMANA;
  }
  /** Se guardó a mano (Ajustes → Datos → Guardar una copia) */
  function markManual() { var o = get(); o.manual = Date.now(); put(o); }

  /** Tarjeta en Hoy (navegador sin cuenta, una semana sin copia) */
  function card() {
    if (!reminderDue()) return null;
    var later = U.el('button.circle-btn', { attrs: { type: 'button', 'aria-label': 'Recordármelo dentro de una semana' }, on: { click: function () {
      var o = get(); o.snooze = Date.now(); put(o);
      W.Router.refresh();
    } } }, [U.icon('close', 'xs')]);
    var save = U.el('button.btn.sm.soft', { text: 'Guardar una copia', attrs: { type: 'button' }, on: { click: function () { download(); W.Router.refresh(); } } });
    return U.el('div.wn-card.bk-card', { attrs: { role: 'status' } }, [
      U.el('span.wn-badge', { attrs: { 'aria-hidden': 'true' } }, [U.icon('shield', 'xs')]),
      U.el('div.wn-text', [
        U.el('b', { text: 'Guarda una copia de tus datos' }),
        U.el('small', { text: 'Sin cuenta, solo están en este navegador. Hace más de una semana de la última copia.' })
      ]),
      save, later
    ]);
  }
  /** Descargar la copia (lo que hacía «Guardar una copia») */
  function download() {
    markManual();
    return U.saveFile('whider-copia-' + U.today(), JSON.stringify(data(), null, 1), 'json');
  }
  /** Estado para Ajustes */
  function status() {
    var o = get(), w = where();
    if (!w) return o.manual ? 'Última copia guardada ' + U.fmtRel(o.manual - Date.now()) : 'Todavía no has guardado ninguna copia';
    if (!enabled()) return 'Apagada';
    return o.at ? 'Última: ' + U.fmtRel(o.at - Date.now()) + (w === 'android' ? ' · en Descargas › WHIDER › Copias' : '') : 'La primera se hará hoy';
  }

  /** Al abrir la app y al volver a ella: la copia del día, sin prisa */
  function init() {
    var tick = function () { if (!document.hidden) run(false); };
    setTimeout(tick, 15000);
    document.addEventListener('visibilitychange', tick);
  }

  W.Backup = { data: data, run: run, where: where, enabled: enabled, setEnabled: setEnabled, reminderDue: reminderDue, card: card, download: download, markManual: markManual, status: status, init: init, desktop: desktop };
})(window.Whider);
