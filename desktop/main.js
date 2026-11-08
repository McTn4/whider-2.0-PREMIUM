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
 *  - Informes en PDF y exportaciones (CSV, JSON, texto) se guardan donde elijas.
 */
'use strict';
const { app, BrowserWindow, protocol, ipcMain, Menu, Tray, nativeImage, shell, nativeTheme, Notification, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const prefs = require('./lib/prefs');
const google = require('./lib/google');

const SCHEME = 'app';
const HOST = 'whider';
const WWW = path.join(__dirname, 'www');
const START_URL = SCHEME + '://' + HOST + '/index.html';
const RELEASES = 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/tag/desktop-latest';
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

let win = null, tray = null, quitting = false, badge = null;

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

function createWindow(show) {
  const st = prefs.get('window') || {};
  const opts = {
    width: st.width || 1280, height: st.height || 820, minWidth: 420, minHeight: 560,
    show: false, title: 'WHIDER', backgroundColor: '#050505', autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, spellcheck: true,
      // Los avisos se calculan con temporizadores: siguen exactos con la ventana oculta
      backgroundThrottling: false
    }
  };
  if (visibleBounds(st)) { opts.x = st.x; opts.y = st.y; }
  if (IS_WIN) Object.assign(opts, { titleBarStyle: 'hidden', titleBarOverlay: { color: '#050505', symbolColor: '#A3A3A3', height: 34 } });
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
      new Notification({ title: 'WHIDER sigue abierta', body: 'Te avisará de tus tareas desde ' + (IS_MAC ? 'el Dock' : 'la bandeja del sistema') + '. Para salir, usa «Salir de WHIDER» en su menú.', silent: true }).show();
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

/* ---------- Bandeja y menús ---------- */
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', IS_MAC ? 'trayTemplate.png' : 'tray.png'));
  if (IS_MAC) icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('WHIDER');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir WHIDER', click: showWindow },
    { label: 'Nueva tarea', click: function () { command('new-task'); } },
    { label: 'Buscar', click: function () { command('search'); } },
    { type: 'separator' },
    { label: 'Hábitos de hoy', click: function () { command('go:habits'); } },
    { label: 'Nuevo apunte', click: function () { command('new-note'); } },
    { label: 'Empezar o pausar el enfoque', click: function () { command('focus-toggle', false); } },
    { type: 'separator' },
    { label: 'Salir de WHIDER', click: quit }
  ]));
  if (!IS_MAC) tray.on('click', toggleWindow);
}

function buildMenu() {
  const go = function (label, id, key) { return { label: label, accelerator: 'CmdOrCtrl+' + key, click: function () { command('go:' + id); } }; };
  const template = [];
  if (IS_MAC) template.push({ label: 'WHIDER', submenu: [
    { role: 'about', label: 'Acerca de WHIDER' }, { type: 'separator' },
    { label: 'Ajustes…', accelerator: 'Cmd+,', click: function () { command('settings'); } }, { type: 'separator' },
    { role: 'hide', label: 'Ocultar WHIDER' }, { role: 'hideOthers', label: 'Ocultar otras' }, { role: 'unhide', label: 'Mostrar todas' }, { type: 'separator' },
    { label: 'Salir de WHIDER', accelerator: 'Cmd+Q', click: quit }
  ] });
  template.push({ label: 'Archivo', submenu: [
    { label: 'Nueva tarea', accelerator: 'CmdOrCtrl+N', click: function () { command('new-task'); } },
    { label: 'Buscar…', click: function () { command('search'); } },
    { type: 'separator' },
    { label: 'Informe en PDF…', accelerator: 'CmdOrCtrl+P', click: function () { command('report-pdf'); } },
    { label: 'Importar o exportar tareas…', click: function () { command('data'); } },
    { type: 'separator' },
    IS_MAC ? { role: 'close', label: 'Cerrar ventana' } : { label: 'Salir de WHIDER', accelerator: 'Ctrl+Q', click: quit }
  ] });
  template.push({ label: 'Edición', submenu: [
    { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' }, { type: 'separator' },
    { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }
  ] });
  template.push({ label: 'Ver', submenu: [
    go('Hoy', 'home', '1'), go('Tareas', 'tasks', '2'), go('Calendario', 'calendar', '3'), go('Cuaderno', 'notes', '4'), { type: 'separator' },
    go('Chats', 'chats', '5'), go('Personas', 'friends', '6'), { type: 'separator' },
    go('Hábitos', 'habits', '7'), go('Enfoque', 'focus', '8'), go('Estadísticas', 'stats', '9'),
    { label: 'Informes', click: function () { command('go:reports'); } }, { label: 'Sistemas', click: function () { command('go:automations'); } }, { type: 'separator' },
    { role: 'resetZoom', label: 'Tamaño real' }, { role: 'zoomIn', label: 'Ampliar' }, { role: 'zoomOut', label: 'Reducir' }, { type: 'separator' },
    { role: 'togglefullscreen', label: 'Pantalla completa' }
  ] });
  template.push({ label: 'Ventana', submenu: IS_MAC ? [{ role: 'minimize', label: 'Minimizar' }, { role: 'zoom', label: 'Zoom' }, { type: 'separator' }, { role: 'front', label: 'Traer todo al frente' }] : [{ role: 'minimize', label: 'Minimizar' }] });
  template.push({ label: 'Ayuda', submenu: [
    { label: 'Atajos de teclado', click: function () { command('shortcuts'); } },
    { label: 'Descargar la última versión', click: function () { openExternal(RELEASES); } }
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
  return dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), file), filters: [SAVE_KINDS[kind]] })
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
    nativeTheme.themeSource = 'dark';
    if (IS_WIN) app.setAppUserModelId('com.whider.desktop');
    protocol.handle(SCHEME, serve);
    buildMenu();
    createTray();
    let hidden = process.argv.indexOf('--hidden') >= 0;
    try { if (IS_MAC && app.getLoginItemSettings().wasOpenedAsHidden) hidden = true; } catch (e) { /* sin datos */ }
    createWindow(!hidden);
  });
  app.on('activate', showWindow);
  app.on('before-quit', function () { quitting = true; prefs.flush(); });
  app.on('window-all-closed', function () { if (!IS_MAC) app.quit(); });
}
