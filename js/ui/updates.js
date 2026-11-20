// @ts-check
/**
 * WHIDER · Versiones nuevas
 *  - Ordenador: la app se actualiza sola (Windows y Linux AppImage) o avisa con el enlace de descarga
 *    (macOS y Linux .deb). Lo hace desktop/lib/updates.js; aquí se enseña el aviso y el estado.
 *  - Android instalado desde GitHub (no desde Google Play, que ya actualiza solo): una vez al día se mira
 *    si hay una versión estable nueva y se ofrece descargarla.
 *  - Web: se actualiza sola al recargar (Service Worker); no hace falta avisar.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var REPO = 'McTn4/whider-2.0-PREMIUM';
  var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
  var DOWNLOADS = 'https://github.com/' + REPO + '/releases/';
  var KEY = 'whider.updateCheck.v1';
  var EVERY = 20 * 3600 * 1000;

  /** @type {{ mode: string, state: string, current: string, version: string|null, percent: number, error: string|null, url: string|null }} */
  var state = { mode: 'none', state: 'idle', current: String(W.VERSION || ''), version: null, percent: 0, error: null, url: null };
  /** @type {Function[]} */
  var subs = [];
  /** @type {Record<string, boolean>} */
  var told = {};

  function desktop() { var D = /** @type {any} */ (window).WhiderDesktop; return D && D.updates ? D.updates : null; }
  /** APK instalado desde GitHub (desde Google Play, la tienda ya lo actualiza) */
  function sideloaded() {
    var A = /** @type {any} */ (window).WhiderAndroid;
    if (!A || typeof A.installer !== 'function') return false;
    var who;
    try { who = String(A.installer() || ''); } catch (e) { return false; }
    return who !== 'com.android.vending';
  }
  function label(v) { return W.WhatsNew ? W.WhatsNew.label(v) : v; }

  function set(patch) {
    Object.assign(state, patch);
    subs.forEach(function (fn) { try { fn(state); } catch (e) { console.error(e); } });
    tell();
  }
  /** Un aviso por versión: «lista para instalar» o «hay una nueva para descargar» */
  function tell() {
    var k = state.state + ':' + state.version;
    if (!state.version || told[k]) return;
    if (state.state === 'ready') {
      told[k] = true;
      W.Toast.show({ text: W.t('WHIDER {0} está lista: se instalará al cerrar la app', { 0: label(state.version) }), icon: 'download', duration: 12000,
        action: { label: W.t('Reiniciar ahora'), fn: install } });
    } else if (state.state === 'available') {
      told[k] = true;
      W.Toast.show({ text: W.t('Hay una versión nueva de WHIDER: la {0}', { 0: label(state.version) }), icon: 'download', duration: 12000,
        action: { label: W.t('Descargar'), fn: open } });
    }
  }

  /** Android desde GitHub: la última versión estable y su APK */
  function checkAndroid(force) {
    var last = 0;
    try { last = +(localStorage.getItem(KEY) || 0); } catch (e) { /* sin almacenamiento */ }
    if (!force && Date.now() - last < EVERY) return Promise.resolve(state);
    if (!window.fetch) return Promise.resolve(state);
    set({ state: 'checking', error: null });
    return fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rel) {
        try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* sin almacenamiento */ }
        var v = String(rel.tag_name || '').replace(/^v/, '');
        var apk = (rel.assets || []).filter(function (a) { return /\.apk$/i.test(a.name || ''); })[0];
        var url = apk && String(apk.browser_download_url || '');
        // Solo enlaces de las publicaciones de WHIDER en GitHub
        if (url && url.indexOf(DOWNLOADS) !== 0) url = '';
        if (!rel.prerelease && url && W.WhatsNew.cmp(v, state.current) > 0) set({ state: 'available', version: v, url: url });
        else set({ state: 'latest', version: null, url: null });
        return state;
      })
      .catch(function () { set({ state: 'error', error: W.t('No se pudo comprobar. Revisa la conexión.') }); return state; });
  }

  function check(force) {
    var d = desktop();
    if (d) return d.check().then(function (s) { if (s) set(s); return state; });
    if (state.mode === 'android') return checkAndroid(force);
    return Promise.resolve(state);
  }
  function install() { var d = desktop(); if (d) d.install(); }
  function open() {
    var d = desktop();
    if (d) { d.open(); return; }
    if (state.url) U.openExternal(state.url);
  }

  /** Texto del estado para Ajustes */
  function statusText() {
    switch (state.state) {
      case 'checking': return W.t('Buscando actualizaciones…');
      case 'latest': return W.t('Tienes la última versión');
      case 'downloading': return W.t('Descargando la {v}', { v: label(state.version || '') }) + (state.percent ? ' · ' + state.percent + ' %' : '') + '…';
      case 'ready': return W.t('La {v} está lista: se instala al cerrar WHIDER', { v: label(state.version || '') });
      case 'available': return W.t('Hay una versión nueva: la {v}', { v: label(state.version || '') });
      case 'error': return state.error || W.t('No se pudo comprobar');
      case 'off': return W.t('Las actualizaciones automáticas solo funcionan en la app instalada');
      default: return state.mode === 'android' ? W.t('Se comprueba una vez al día') : W.t('Se comprueba al abrir la app y cada 6 horas');
    }
  }
  /** Celda «Versión» con su estado y el botón que toque (Buscar, Reiniciar o Descargar) */
  function cell(nav) {
    var btn = null;
    // La acción que toca va en el botón principal (blanco); «Buscar», discreto
    if (state.state === 'ready') btn = U.el('button.btn.xs.primary', { text: W.t('Reiniciar'), attrs: { type: 'button', 'aria-label': W.t('Reiniciar para instalar la versión nueva') }, on: { click: install } });
    else if (state.state === 'available') btn = U.el('button.btn.xs.primary', { text: W.t('Descargar'), attrs: { type: 'button', 'aria-label': W.t('Descargar la versión nueva') }, on: { click: open } });
    else if (state.mode !== 'none' && state.state !== 'off' && state.state !== 'downloading') {
      btn = U.el('button.btn.xs.soft', { text: state.state === 'checking' ? W.t('Buscando…') : W.t('Buscar'), attrs: { type: 'button', 'aria-label': W.t('Buscar actualizaciones') }, on: { click: function () {
        check(true).then(function () { if (nav) nav.refresh(); });
        if (nav) setTimeout(function () { nav.refresh(); }, 50);
      } } });
      if (state.state === 'checking') btn.disabled = true;
    }
    return W.UI.cell({ icon: 'download', title: W.t('WHIDER {0}', { 0: label(state.current) }), sub: state.mode === 'none' ? W.t('En el navegador se actualiza sola al recargar') : statusText(),
      subCls: state.state === 'error' ? 'warn' : null, right: btn });
  }

  function init() {
    var d = desktop();
    if (d) {
      state.mode = 'desktop';
      d.on(function (s) { set(s || {}); });
      d.state().then(function (s) { if (s) set(s); }).catch(function () { /* sin estado */ });
      return;
    }
    if (sideloaded()) {
      state.mode = 'android';
      // Sin prisa: cuando la app ya está pintada y en uso
      setTimeout(function () { checkAndroid(false); }, 8000);
    }
  }

  W.Updates = {
    init: init, check: check, install: install, open: open, cell: cell, statusText: statusText,
    state: function () { return Object.assign({}, state); },
    subscribe: function (fn) { if (typeof fn === 'function') subs.push(fn); }
  };
})(window.Whider);
