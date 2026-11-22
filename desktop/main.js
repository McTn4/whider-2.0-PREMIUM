/**
 * WHIDER para ordenador (Windows, macOS y Linux).
 *
 *  - La app web de WHIDER va dentro de la app y se sirve desde app://whider: funciona sin
 *    conexión y guarda tus datos en la carpeta de la app, igual que en el navegador.
 *  - Ventana con la franja de título integrada en el diseño (Windows y macOS) y su tamaño
 *    y posición recordados.
 *  - Bandeja del sistema: al cerrar la ventana, WHIDER sigue abierta para avisarte de tus
 *    tareas (se puede desactivar en Ajustes → Ordenador). También puede abrirse al iniciar.
 *  - Google: el acceso se completa en el navegador del ordenador (ver lib/google.js).
 *  - Las exportaciones (CSV, JSON, texto) se guardan donde elijas.
 *  - Actualizaciones: solas en Windows y Linux AppImage; aviso con enlace en macOS y .deb (lib/updates.js).
 */
'use strict';
const { app, BrowserWindow, protocol, ipcMain, Menu, Tray, nativeImage, shell, nativeTheme, Notification, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const prefs = require('./lib/prefs');
const google = require('./lib/google');
const updatesLib = require('./lib/updates');
const backupsLib = require('./lib/backups');
const i18n = require('./lib/i18n');
const t = i18n.t;

const SCHEME = 'app';
const HOST = 'whider';
const WWW = path.join(__dirname, 'www');
const START_URL = SCHEME + '://' + HOST + '/index.html';
const E2E = process.env.WHIDER_E2E === '1';
const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';

// Pruebas automáticas: carpeta de datos propia y sin abrir el navegador de verdad
if (process.env.WHIDER_USER_DATA) app.setPath('userData', process.env.WHIDER_USER_DATA);
global.__whider = { externalUrls: [] };

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

let win = null, tray = null, quitting = false, badge = null, updates = null, backups = null;
/** Copias automáticas en la carpeta de datos de la app (se crea al pedirla) */
function copias() { if (!backups) backups = backupsLib.create(path.join(app.getPath('userData'), 'Copias')); return backups; }

/* ---------- Archivos de la app web ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};
function serve(request) {
  const url = new URL(request.url);
  if (url.host !== HOST) return new Response('No encontrado', { status: 404 });
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch (e) { return new Response('Dirección no válida', { status: 400 }); }
  if (!rel || rel === '/') rel = '/index.html';
  // Pruebas automáticas: cuentas contra los emuladores de Firebase
  if (E2E && process.env.WHIDER_E2E_CONFIG && rel === '/js/config.js') {
    return new Response(process.env.WHIDER_E2E_CONFIG, { status: 200, headers: { 'content-type': MIME['.js'] } });
  }
  const file = path.normalize(path.join(WWW, rel));
  if (file !== WWW && !file.startsWith(WWW + path.sep)) return new Response('Prohibido', { status: 403 });
  return fs.promises.readFile(file).then(function (buf) {
    return new Response(buf, { status: 200, headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' } });
  }, function () { return new Response('No encontrado', { status: 404 }); });
}

/* ---------- Ventana ---------- */
function visibleBounds(b) {
  if (!b || typeof b.x !== 'number') return false;
  return screen.getAllDisplays().some(function (d) {
    const a = d.workArea;
    return b.x + 80 > a.x && b.y + 40 > a.y && b.x < a.x + a.width - 80 && b.y < a.y + a.height - 40;
  });
}

let saveTimer = null;
function saveBounds() {
  if (!win || win.isDestroyed()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    if (!win || win.isDestroyed() || win.isMinimized()) return;
    const max = win.isMaximized() || win.isFullScreen();
    const b = max ? (prefs.get('window') || {}) : win.getBounds();
    prefs.set('window', Object.assign({}, b, { maximized: max }));
  }, 400);
}

/** Colores de la ventana para cada tema (los mismos que --bg y --t2 en css/tokens.css) */
function themeColors(light) { return light ? { bg: '#FFFFFF', symbol: '#3C4650' } : { bg: '#000000', symbol: '#A1A5AB' }; }

function createWindow(show) {
  const st = prefs.get('window') || {};
  const tc = themeColors(prefs.get('theme') === 'light');
  const opts = {
    width: st.width || 1280, height: st.height || 820, minWidth: 420, minHeight: 560,
    show: false, title: 'WHIDER', backgroundColor: tc.bg, autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, spellcheck: true,
      // Los avisos se calculan con temporizadores: siguen exactos con la ventana oculta
      backgroundThrottling: false
    }
  };
  if (visibleBounds(st)) { opts.x = st.x; opts.y = st.y; }
  if (IS_WIN) Object.assign(opts, { titleBarStyle: 'hidden', titleBarOverlay: { color: tc.bg, symbolColor: tc.symbol, height: 34 } });
  if (IS_MAC) Object.assign(opts, { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 10 } });

  win = new BrowserWindow(opts);
  if (st.maximized) win.maximize();
  win.loadURL(START_URL);
  win.once('ready-to-show', function () { if (show) { win.show(); win.focus(); } });
  // Una invitación que llegó al abrir la app: se entrega cuando la web está lista
  win.webContents.on('did-finish-load', function () { if (pendingLink) setTimeout(function () { deliverLink(pendingLink); }, 1200); });

  win.on('close', function (e) {
    if (quitting || !tray || prefs.get('closeToTray') === false) return;
    e.preventDefault();
    win.hide();
    if (!prefs.get('trayHintShown') && Notification.isSupported()) {
      prefs.set('trayHintShown', true);
      new Notification({ title: t('WHIDER sigue abierta'), body: t('Te avisará de tus tareas desde {where}. Para salir, usa «Salir de WHIDER» en su menú.', { where: IS_MAC ? t('el Dock') : t('la bandeja del sistema') }), silent: true }).show();
    }
  });
  ['resize', 'move', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(function (ev) { win.on(ev, saveBounds); });
  win.on('closed', function () { win = null; });

  // Los enlaces externos se abren en el navegador; la ventana nunca sale de la app
  win.webContents.setWindowOpenHandler(function (d) { openExternal(d.url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', function (e, url) {
    if (url.indexOf(SCHEME + '://' + HOST + '/') === 0) return;
    e.preventDefault();
    openExternal(url);
  });
  if (process.env.WHIDER_DEBUG === '1') win.webContents.openDevTools({ mode: 'detach' });
}

/* ---------- Invitaciones: enlaces whider://i?… ---------- */
const LINK_SCHEME = 'whider';
let pendingLink = null;
function linkFrom(argv) { return (argv || []).filter(function (a) { return typeof a === 'string' && /^whider:/i.test(a); })[0] || null; }
/** Entrega la invitación a la app web (en cuanto haya cargado) */
function deliverLink(url) {
  if (!url) return;
  pendingLink = String(url).slice(0, 2000);
  if (win && !win.webContents.isLoading()) {
    const link = pendingLink; pendingLink = null;
    showWindow();
    setTimeout(function () { if (win) win.webContents.send('whider:command', 'invite:' + link); }, 300);
  }
}
if (!E2E) {
  try {
    if (process.defaultApp && process.argv.length >= 2) app.setAsDefaultProtocolClient(LINK_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
    else app.setAsDefaultProtocolClient(LINK_SCHEME);
  } catch (e) { /* sin registro del protocolo */ }
}
// macOS: el sistema avisa con «open-url» (también al abrir la app desde el enlace)
app.on('open-url', function (e, url) { e.preventDefault(); deliverLink(url); });
pendingLink = linkFrom(process.argv);

function showWindow() {
  if (!win) createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function toggleWindow() { if (win && win.isVisible() && win.isFocused()) win.hide(); else showWindow(); }

/** Una orden para la app web (nueva tarea, buscar, ir a una sección…) */
function command(cmd, show) {
  if (show !== false) showWindow();
  if (win) win.webContents.send('whider:command', cmd);
}

function openExternal(url) {
  if (!/^https?:\/\//i.test(String(url))) return;
  if (E2E) { global.__whider.externalUrls.push(url); return; }
  shell.openExternal(url);
}

function quit() { quitting = true; app.quit(); }

/* ---------- Actualizaciones ---------- */
function notifyUpdate(title, body) {
  if (E2E) { global.__whider.notifications = (global.__whider.notifications || []).concat({ title: title, body: body }); return; }
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: title, body: body });
  n.on('click', function () { command('updates'); });
  n.show();
}
function checkUpdates() {
  command('updates');
  if (updates) updates.check();
}

/* ---------- Bandeja y menús ---------- */
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', IS_MAC ? 'trayTemplate.png' : 'tray.png'));
  if (IS_MAC) icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('WHIDER');
  tray.setContextMenu(trayMenu());
  if (!IS_MAC) tray.on('click', toggleWindow);
}
/** Menú de la bandeja (en el idioma de la app) */
function trayMenu() {
  return Menu.buildFromTemplate([
    { label: t('Abrir WHIDER'), click: showWindow },
    { label: t('Nueva tarea'), click: function () { command('new-task'); } },
    { label: t('Buscar'), click: function () { command('search'); } },
    { type: 'separator' },
    { label: t('Tareas de hoy'), click: function () { command('go:home'); } },
    { label: t('Nueva página del Cuaderno'), click: function () { command('new-note'); } },
    { type: 'separator' },
    { label: t('Buscar actualizaciones'), click: checkUpdates },
    { label: t('Salir de WHIDER'), click: quit }
  ]);
}

function buildMenu() {
  const go = function (label, id, key) { return { label: label, accelerator: 'CmdOrCtrl+' + key, click: function () { command('go:' + id); } }; };
  const template = [];
  if (IS_MAC) template.push({ label: 'WHIDER', submenu: [
    { role: 'about', label: t('Acerca de WHIDER') }, { type: 'separator' },
    { label: t('Ajustes…'), accelerator: 'Cmd+,', click: function () { command('settings'); } }, { type: 'separator' },
    { role: 'hide', label: t('Ocultar WHIDER') }, { role: 'hideOthers', label: t('Ocultar otras') }, { role: 'unhide', label: t('Mostrar todas') }, { type: 'separator' },
    { label: t('Salir de WHIDER'), accelerator: 'Cmd+Q', click: quit }
  ] });
  template.push({ label: t('Archivo'), submenu: [
    { label: t('Nueva tarea'), accelerator: 'CmdOrCtrl+N', click: function () { command('new-task'); } },
    { label: t('Buscar…'), click: function () { command('search'); } },
    { type: 'separator' },
    { label: t('Importar o exportar tareas…'), click: function () { command('data'); } },
    { type: 'separator' },
    IS_MAC ? { role: 'close', label: t('Cerrar ventana') } : { label: t('Salir de WHIDER'), accelerator: 'Ctrl+Q', click: quit }
  ] });
  template.push({ label: t('Edición'), submenu: [
    { role: 'undo', label: t('Deshacer') }, { role: 'redo', label: t('Rehacer') }, { type: 'separator' },
    { role: 'cut', label: t('Cortar') }, { role: 'copy', label: t('Copiar') }, { role: 'paste', label: t('Pegar') }, { role: 'selectAll', label: t('Seleccionar todo') }
  ] });
  template.push({ label: t('Ver'), submenu: [
    go(t('Inicio'), 'home', '1'), go(t('Tareas'), 'tasks', '2'), go(t('Calendario'), 'calendar', '3'), go(t('Cuaderno'), 'notes', '4'), go(t('Personas'), 'friends', '5'), { type: 'separator' },
    { label: t('Chats'), click: function () { command('go:chats'); } }, { type: 'separator' },
    { role: 'resetZoom', label: t('Tamaño real') }, { role: 'zoomIn', label: t('Ampliar') }, { role: 'zoomOut', label: t('Reducir') }, { type: 'separator' },
    { role: 'togglefullscreen', label: t('Pantalla completa') }
  ] });
  template.push({ label: t('Ventana'), submenu: IS_MAC ? [{ role: 'minimize', label: t('Minimizar') }, { role: 'zoom', label: t('Zoom') }, { type: 'separator' }, { role: 'front', label: t('Traer todo al frente') }] : [{ role: 'minimize', label: t('Minimizar') }] });
  template.push({ label: t('Ayuda'), submenu: [
    { label: t('Atajos de teclado'), click: function () { command('shortcuts'); } },
    { label: t('Novedades'), click: function () { command('whats-new'); } },
    { type: 'separator' },
    { label: t('Buscar actualizaciones…'), click: checkUpdates }
  ] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- Abrir al iniciar el ordenador ---------- */
const AUTOSTART = path.join(os.homedir(), '.config', 'autostart', 'whider.desktop');
function getOpenAtLogin() {
  if (process.platform === 'linux') return fs.existsSync(AUTOSTART);
  try { return app.getLoginItemSettings(IS_WIN ? { args: ['--hidden'] } : undefined).openAtLogin; } catch (e) { return false; }
}
function setOpenAtLogin(on) {
  if (process.platform === 'linux') {
    try {
      if (!on) { fs.rmSync(AUTOSTART, { force: true }); return; }
      const exe = process.env.APPIMAGE || process.execPath;
      fs.mkdirSync(path.dirname(AUTOSTART), { recursive: true });
      fs.writeFileSync(AUTOSTART, '[Desktop Entry]\nType=Application\nName=WHIDER\nExec="' + exe + '" --hidden\nX-GNOME-Autostart-enabled=true\n');
    } catch (e) { /* sin permisos */ }
    return;
  }
  try { app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: true, args: ['--hidden'] }); } catch (e) { /* no disponible */ }
}

/* ---------- Puente con la app web ---------- */
ipcMain.handle('whider:google-sign-in', function () {
  return google.signIn({ www: WWW, open: openExternal, config: process.env.WHIDER_E2E_CONFIG || null }).then(function (r) {
    if (r.ok) showWindow();
    return r;
  });
});
ipcMain.handle('whider:google-cancel', function () { google.cancel(); });
ipcMain.handle('whider:get-settings', function () {
  return { openAtLogin: getOpenAtLogin(), closeToTray: prefs.get('closeToTray') !== false, version: app.getVersion() };
});
// Tema de la app (oscuro o claro): fondo de la ventana, barra de título de Windows y menús del sistema a juego
// Con «Como el sistema» el tema nativo sigue al del sistema (si no, la web dejaría de ver sus cambios). Se guarda
// para abrir la próxima vez ya con el fondo correcto, sin destello.
ipcMain.on('whider:set-theme', function (_e, th, sys) {
  const light = th === 'light';
  nativeTheme.themeSource = sys ? 'system' : (light ? 'light' : 'dark');
  global.__whider.theme = light ? 'light' : 'dark';
  if (prefs.get('theme') !== global.__whider.theme || prefs.get('themeSystem') !== !!sys) {
    prefs.set('theme', global.__whider.theme);
    prefs.set('themeSystem', !!sys);
  }
  if (!win || win.isDestroyed()) return;
  win.setBackgroundColor(themeColors(light).bg);
  if (IS_WIN) { try { win.setTitleBarOverlay({ color: themeColors(light).bg, symbolColor: themeColors(light).symbol }); } catch (e) { /* sin barra propia */ } }
});
// Idioma de la app (js/app.js): se guarda para abrir la próxima vez con los menús ya en ese idioma
ipcMain.on('whider:set-lang', function (_e, l) {
  const lang = l === 'en' ? 'en' : 'es';
  if (prefs.get('lang') === lang) return;
  prefs.set('lang', lang);
  buildMenu();
  if (tray) tray.setContextMenu(trayMenu());
});
ipcMain.handle('whider:backup-write', function (_e, name, json) { return copias().write(String(name), String(json)); });
ipcMain.handle('whider:backup-list', function () { return copias().list(); });
ipcMain.handle('whider:backup-read', function (_e, name) { return copias().read(String(name)); });
ipcMain.on('whider:backup-open', function () {
  if (E2E) { global.__whider.openedBackups = copias().dir; return; }
  fs.mkdirSync(copias().dir, { recursive: true });
  shell.openPath(copias().dir);
});
ipcMain.handle('whider:update-state', function () { return updates ? updates.state() : { mode: 'off', state: 'off' }; });
ipcMain.handle('whider:update-check', function () { return updates ? updates.check() : null; });
ipcMain.handle('whider:update-install', function () { return updates ? updates.install() : false; });
ipcMain.on('whider:update-open', function () { if (updates) updates.open(); });
ipcMain.handle('whider:set-setting', function (_e, key, value) {
  if (key === 'openAtLogin') setOpenAtLogin(!!value);
  else if (key === 'closeToTray') prefs.set('closeToTray', !!value);
  return true;
});
/* ---------- Guardar archivos: exportaciones e informes en PDF ---------- */
const SAVE_KINDS = {
  csv: { name: 'CSV (hoja de cálculo)', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
  txt: { name: 'Texto', extensions: ['txt'] },
  md: { name: 'Markdown', extensions: ['md'] },
  ics: { name: 'Calendario (iCalendar)', extensions: ['ics'] },
  pdf: { name: 'PDF', extensions: ['pdf'] }
};
function safeName(name, ext) {
  const base = String(name || 'whider').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'whider';
  return base.toLowerCase().endsWith('.' + ext) ? base : base + '.' + ext;
}
/** Pregunta dónde guardar (en las pruebas, directamente en la carpeta de datos) */
function askPath(name, kind) {
  const file = safeName(name, kind);
  if (E2E) {
    const dir = path.join(app.getPath('userData'), 'exports');
    fs.mkdirSync(dir, { recursive: true });
    return Promise.resolve(path.join(dir, file));
  }
  return dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), file), filters: [{ name: t(SAVE_KINDS[kind].name), extensions: SAVE_KINDS[kind].extensions }] })
    .then(function (r) { return r.canceled || !r.filePath ? null : r.filePath; });
}
ipcMain.handle('whider:save-file', function (_e, name, content, kind) {
  kind = SAVE_KINDS[kind] ? kind : 'txt';
  return askPath(name, kind).then(function (file) {
    if (!file) return { ok: false, canceled: true };
    return fs.promises.writeFile(file, String(content), 'utf8').then(function () { return { ok: true, path: file }; });
  }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
});
ipcMain.handle('whider:print-pdf', function (_e, name) {
  if (!win) return { ok: false };
  return askPath(name, 'pdf').then(function (file) {
    if (!file) return { ok: false, canceled: true };
    return win.webContents.printToPDF({ printBackground: false, pageSize: 'A4', margins: { marginType: 'default' } })
      .then(function (buf) { return fs.promises.writeFile(file, buf); })
      .then(function () { return { ok: true, path: file }; });
  }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
});
/* ---------- Adjuntos del Cuaderno ---------- */
// Lo que el sistema ejecutaría en vez de abrir: solo se puede descargar (podría llegar de un equipo)
const RUNNABLE = /\.(exe|msi|msix|appx|bat|cmd|com|scr|pif|cpl|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|jar|lnk|reg|inf|app|command|tool|sh|bash|zsh|csh|run|bin|deb|rpm|appimage|pkg|dmg|workflow|scpt|desktop)$/i;
function attachmentName(name) {
  // eslint-disable-next-line no-control-regex -- se quitan a propósito los caracteres de control de los nombres de archivo
  let n = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n || /^\.+$/.test(n)) n = 'archivo';
  return n.slice(0, 150);
}
function bytesOf(data) {
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  throw new Error('Archivo no válido');
}
/** Abre una copia temporal con la aplicación del sistema → { ok, path } · { ok: false, blocked } si es un programa */
ipcMain.handle('whider:open-file', function (_e, name, data) {
  const fileName = attachmentName(name);
  if (RUNNABLE.test(fileName)) return { ok: false, blocked: true };
  const dir = path.join(app.getPath('temp'), 'WHIDER', 'adjuntos');
  const file = path.join(dir, fileName);
  return fs.promises.mkdir(dir, { recursive: true })
    .then(function () { return fs.promises.writeFile(file, bytesOf(data)); })
    .then(function () {
      if (E2E) { global.__whider.openedFiles = (global.__whider.openedFiles || []).concat(file); return ''; }
      return shell.openPath(file);
    })
    .then(function (err) { return err ? { ok: false, error: err } : { ok: true, path: file }; })
    .catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
});
/** Guarda un adjunto donde elija el usuario (por defecto, en Descargas) → { ok, path } */
ipcMain.handle('whider:save-binary', function (_e, name, data) {
  const fileName = attachmentName(name);
  const ask = E2E
    ? Promise.resolve(path.join(app.getPath('userData'), 'exports', fileName))
    : dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('downloads'), fileName) }).then(function (r) { return r.canceled || !r.filePath ? null : r.filePath; });
  return ask.then(function (file) {
    if (!file) return { ok: false, canceled: true };
    return fs.promises.mkdir(path.dirname(file), { recursive: true })
      .then(function () { return fs.promises.writeFile(file, bytesOf(data)); })
      .then(function () { return { ok: true, path: file }; });
  }).catch(function (e) { return { ok: false, error: String(e && e.message || e) }; });
});
ipcMain.on('whider:show-file', function (_e, file) { if (file && !E2E) shell.showItemInFolder(String(file)); });
ipcMain.on('whider:show-window', showWindow);
ipcMain.on('whider:open-external', function (_e, url) { openExternal(url); });
ipcMain.on('whider:set-badge', function (_e, n) {
  n = Math.max(0, n | 0);
  if (IS_MAC && app.dock) app.dock.setBadge(n ? String(n) : '');
  else if (IS_WIN && win) {
    if (!badge) badge = nativeImage.createFromPath(path.join(__dirname, 'assets', 'badge.png'));
    win.setOverlayIcon(n ? badge : null, n ? n + (n === 1 ? ' tarea vencida' : ' tareas vencidas') : '');
  } else { try { app.setBadgeCount(n); } catch (e) { /* sin insignia */ } }
  if (tray) tray.setToolTip(n ? 'WHIDER · ' + n + (n === 1 ? ' tarea vencida' : ' tareas vencidas') : 'WHIDER');
});

/* ---------- Arranque ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function (_e, argv) { showWindow(); deliverLink(linkFrom(argv)); });
  app.whenReady().then(function () {
    nativeTheme.themeSource = prefs.get('themeSystem') ? 'system' : (prefs.get('theme') === 'light' ? 'light' : 'dark');
    if (IS_WIN) app.setAppUserModelId('com.whider.desktop');
    protocol.handle(SCHEME, serve);
    buildMenu();
    createTray();
    updates = updatesLib.create({
      send: function (s) { if (win && !win.isDestroyed()) win.webContents.send('whider:update', s); },
      notify: notifyUpdate, openExternal: openExternal, prefs: prefs,
      // Al instalar, la app se cierra de verdad (sin quedarse en la bandeja)
      beforeInstall: function () { quitting = true; prefs.flush(); }
    });
    updates.start();
    let hidden = process.argv.indexOf('--hidden') >= 0;
    try { if (IS_MAC && app.getLoginItemSettings().wasOpenedAsHidden) hidden = true; } catch (e) { /* sin datos */ }
    createWindow(!hidden);
  });
  app.on('activate', showWindow);
  app.on('before-quit', function () { quitting = true; prefs.flush(); });
  app.on('window-all-closed', function () { if (!IS_MAC) app.quit(); });
}
