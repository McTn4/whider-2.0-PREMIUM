/**
 * WHIDER para ordenador · Actualizaciones
 *
 *  - «auto» (Windows con su instalador y Linux AppImage): electron-updater mira las publicaciones de
 *    GitHub, descarga la versión nueva en segundo plano (comprobando su suma SHA-512) y la instala al
 *    cerrar la app o al pulsar «Reiniciar ahora».
 *  - «notify» (macOS, porque sin la firma de pago de Apple no puede instalarse sola, y Linux .deb, que lo
 *    instala el sistema): se consulta la última publicación y se avisa con el enlace de descarga.
 *  - «off»: la app sin empaquetar (desarrollo), salvo en las pruebas (WHIDER_UPDATE_TEST=1).
 *
 * Solo versiones estables: una beta solo la instala quien la descarga a mano.
 * Se comprueba al poco de abrir la app, cada 6 horas y al pulsar «Buscar».
 */
'use strict';
const REPO = 'McTn4/whider-2.0-PREMIUM';
const PAGE = 'https://github.com/' + REPO + '/releases/latest';
const API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
const DOWNLOADS = 'https://github.com/' + REPO + '/releases/download/';
const EVERY = 6 * 3600 * 1000;
const FIRST = 25 * 1000;

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;
/** -1, 0 o 1 (1.1.0-beta.2 < 1.1.0-rc.1 < 1.1.0 < 1.1.1) */
function compare(a, b) {
  const pa = SEMVER.exec(String(a || '')), pb = SEMVER.exec(String(b || ''));
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 1; i <= 3; i++) if (+pa[i] !== +pb[i]) return +pa[i] < +pb[i] ? -1 : 1;
  const rank = (p) => (p[4] ? { alpha: 0, beta: 30, rc: 60 }[p[4]] + +p[5] : 99);
  const ra = rank(pa), rb = rank(pb);
  return ra === rb ? 0 : ra < rb ? -1 : 1;
}

/** Cómo se actualiza esta instalación */
function mode(platform, env, packaged) {
  if (!packaged && env.WHIDER_UPDATE_TEST !== '1') return 'off';
  if (platform === 'win32') return 'auto';
  if (platform === 'linux' && env.APPIMAGE) return 'auto';
  return 'notify';
}

/** El instalador que toca para este ordenador en una publicación (o null) */
function pickAsset(assets, platform, arch) {
  const want = platform === 'darwin' ? 'WHIDER-mac-' + (arch === 'arm64' ? 'arm64' : 'x64') + '.dmg'
    : platform === 'linux' ? 'WHIDER-linux.deb'
      : platform === 'win32' ? 'WHIDER-Setup.exe' : '';
  const a = (assets || []).find((x) => x && x.name === want);
  const url = a && String(a.browser_download_url || '');
  return url && url.indexOf(DOWNLOADS) === 0 ? url : null;
}

/** Un error dicho para personas */
function errorText(e) {
  const msg = String((e && (e.message || e.code)) || e || '');
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|net::ERR_|network|socket/i.test(msg)) return 'Sin conexión: se volverá a mirar más tarde.';
  if (/\b404\b|Cannot find .*latest|No published versions|ERR_UPDATER_CHANNEL_FILE_NOT_FOUND|ERR_UPDATER_NO_PUBLISHED_VERSIONS/i.test(msg)) return 'Todavía no hay una versión publicada para este sistema.';
  if (/\b403\b|rate limit/i.test(msg)) return 'GitHub no responde ahora mismo: se volverá a mirar más tarde.';
  if (/sha512|checksum/i.test(msg)) return 'La descarga no pasó la comprobación de seguridad: se volverá a intentar.';
  return 'No se pudo comprobar (' + msg.split('\n')[0].slice(0, 120) + ').';
}

/**
 * opts: { send(state), notify(title, body), openExternal(url), prefs, beforeInstall() }
 */
function create(opts) {
  const { app, net } = require('electron');
  const env = process.env;
  const test = env.WHIDER_UPDATE_TEST === '1';
  const m = mode(process.platform, env, app.isPackaged);
  const state = { mode: m, state: m === 'off' ? 'off' : 'idle', current: app.getVersion(), version: null, percent: 0, error: null, url: PAGE, checkedAt: 0 };
  let updater = null, busy = null, timer = null;

  function snapshot() { return Object.assign({}, state); }
  function set(patch) { Object.assign(state, patch); try { opts.send(snapshot()); } catch (e) { /* sin ventana */ } }
  function tell(title, body, key) {
    if (key && opts.prefs.get('updateNotified') === key) return;
    if (key) opts.prefs.set('updateNotified', key);
    try { opts.notify(title, body); } catch (e) { /* sin notificaciones */ }
  }

  function setupAuto() {
    updater = require('electron-updater').autoUpdater;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.logger = { info() {}, debug() {}, warn: (m) => console.warn('[actualizaciones]', m), error: (m) => console.error('[actualizaciones]', m) };
    if (test) {
      // Pruebas: la app sin empaquetar lee su origen de un archivo propio (en su carpeta de datos), y al
      // cerrarla no se instala nada (lo descargado no es una app de verdad)
      updater.forceDevUpdateConfig = true;
      updater.autoInstallOnAppQuit = false;
      if (env.WHIDER_UPDATE_FEED) {
        const fs = require('fs'), path = require('path');
        const cfg = path.join(app.getPath('userData'), 'dev-app-update.yml');
        fs.writeFileSync(cfg, 'provider: generic\nurl: ' + env.WHIDER_UPDATE_FEED + '\nupdaterCacheDirName: whider-desktop-updater-pruebas\n');
        updater.updateConfigPath = cfg;
      }
    }
    updater.on('checking-for-update', () => set({ state: 'checking', error: null }));
    updater.on('update-not-available', () => set({ state: 'latest', version: null, checkedAt: Date.now() }));
    updater.on('update-available', (i) => set({ state: 'downloading', version: i.version, percent: 0, checkedAt: Date.now() }));
    updater.on('download-progress', (p) => set({ percent: Math.round((p && p.percent) || 0) }));
    updater.on('update-downloaded', (i) => {
      set({ state: 'ready', version: i.version, percent: 100 });
      tell('Actualización lista', 'WHIDER ' + i.version + ' se instalará al cerrar la app.', 'ready:' + i.version);
    });
    updater.on('error', (e) => { if (state.state !== 'ready') set({ state: 'error', error: errorText(e) }); });
  }

  function checkNotify() {
    const url = test && env.WHIDER_UPDATE_API ? env.WHIDER_UPDATE_API : API;
    set({ state: 'checking', error: null });
    return net.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'WHIDER/' + state.current } })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((rel) => {
        const v = String(rel.tag_name || '').replace(/^v/, '');
        if (rel.draft || rel.prerelease || !SEMVER.test(v) || compare(v, state.current) <= 0) {
          set({ state: 'latest', version: null, url: PAGE, checkedAt: Date.now() });
          return;
        }
        const page = String(rel.html_url || '').indexOf('https://github.com/' + REPO + '/') === 0 ? rel.html_url : PAGE;
        set({ state: 'available', version: v, url: pickAsset(rel.assets, process.platform, process.arch) || page, checkedAt: Date.now() });
        tell('Hay una versión nueva de WHIDER', 'La ' + v + ' ya se puede descargar.', 'available:' + v);
      })
      .catch((e) => set({ state: 'error', error: errorText(e) }));
  }

  function check() {
    if (state.mode === 'off' || state.state === 'ready' || state.state === 'downloading') return Promise.resolve(snapshot());
    if (busy) return busy;
    const run = state.mode === 'auto'
      ? Promise.resolve().then(() => updater.checkForUpdates()).catch((e) => set({ state: 'error', error: errorText(e) }))
      : checkNotify();
    busy = run.then(snapshot, snapshot).then((s) => { busy = null; return s; });
    return busy;
  }
  function install() {
    if (state.mode !== 'auto' || state.state !== 'ready') return false;
    try { opts.beforeInstall(); } catch (e) { /* sigue */ }
    setImmediate(() => updater.quitAndInstall(false, true));
    return true;
  }
  function open() { opts.openExternal(state.url || PAGE); }
  function start() {
    if (state.mode === 'off') return;
    if (state.mode === 'auto') setupAuto();
    setTimeout(check, test ? 300 : FIRST);
    clearInterval(timer);
    timer = setInterval(check, EVERY);
  }
  return { state: snapshot, check, install, open, start };
}

module.exports = { create, compare, mode, pickAsset, errorText, PAGE };
