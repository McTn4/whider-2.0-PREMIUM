/**
 * Puente seguro entre la app web y el ordenador: solo expone estas funciones (window.WhiderDesktop).
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = [];
ipcRenderer.on('whider:command', function (_e, cmd) {
  listeners.forEach(function (fn) { try { fn(String(cmd)); } catch (e) { /* una orden no rompe las demás */ } });
});
const updateListeners = [];
ipcRenderer.on('whider:update', function (_e, state) {
  updateListeners.forEach(function (fn) { try { fn(state); } catch (e) { /* un aviso no rompe los demás */ } });
});

contextBridge.exposeInMainWorld('WhiderDesktop', {
  platform: process.platform,
  /** Acceso con Google en el navegador del ordenador → { ok, idToken, accessToken } o { ok: false, kind } */
  googleSignIn: function () { return ipcRenderer.invoke('whider:google-sign-in'); },
  cancelGoogle: function () { return ipcRenderer.invoke('whider:google-cancel'); },
  /** Acceso con Microsoft o Apple en el navegador del ordenador → { ok, user } (la sesión) o { ok: false, kind } */
  browserSignIn: function (provider) { return ipcRenderer.invoke('whider:browser-sign-in', String(provider)); },
  cancelBrowserSignIn: function () { return ipcRenderer.invoke('whider:browser-cancel'); },
  /** { openAtLogin, closeToTray, version } */
  getSettings: function () { return ipcRenderer.invoke('whider:get-settings'); },
  setSetting: function (key, value) { return ipcRenderer.invoke('whider:set-setting', String(key), !!value); },
  showWindow: function () { ipcRenderer.send('whider:show-window'); },
  /** Tema de la app ('dark' o 'light') y si sigue al del sistema: la ventana y la barra de título lo siguen */
  setTheme: function (th, sys) { ipcRenderer.send('whider:set-theme', th === 'light' ? 'light' : 'dark', !!sys); },
  /** Alto de la franja de título: 60 (la barra superior del diseño de ordenador) o 34 (la franja fina) */
  setTitleBar: function (h) { ipcRenderer.send('whider:set-titlebar', h === 60 ? 60 : 34); },
  setLang: function (lang) { ipcRenderer.send('whider:set-lang', lang === 'en' ? 'en' : 'es'); },
  setBadge: function (n) { ipcRenderer.send('whider:set-badge', n | 0); },
  openExternal: function (url) { ipcRenderer.send('whider:open-external', String(url)); },
  /** Guarda un archivo donde elija el usuario → { ok, path } · kind: 'csv' | 'json' | 'txt' */
  saveFile: function (name, content, kind) { return ipcRenderer.invoke('whider:save-file', String(name), String(content), String(kind)); },
  /** Guarda la vista actual (el informe) como PDF → { ok, path } */
  printToPDF: function (name) { return ipcRenderer.invoke('whider:print-pdf', String(name)); },
  showFile: function (file) { ipcRenderer.send('whider:show-file', String(file)); },
  /** Adjuntos del Cuaderno: abrir con la aplicación del sistema → { ok, path } ({ ok: false, blocked } si es un programa) */
  openFile: function (name, bytes) { return ipcRenderer.invoke('whider:open-file', String(name), bytes instanceof Uint8Array ? bytes : new Uint8Array(0)); },
  /** …y guardarlos donde elija el usuario → { ok, path } */
  saveBinary: function (name, bytes) { return ipcRenderer.invoke('whider:save-binary', String(name), bytes instanceof Uint8Array ? bytes : new Uint8Array(0)); },
  /** Órdenes del menú y de la bandeja: 'new-task', 'new-note', 'search', 'settings', 'shortcuts', 'data', 'updates', 'go:home'… */
  onCommand: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
  /** Copias automáticas: una al día en la carpeta de datos de la app (las 10 últimas) */
  backup: {
    write: function (name, json) { return ipcRenderer.invoke('whider:backup-write', String(name), String(json)); },
    list: function () { return ipcRenderer.invoke('whider:backup-list'); },
    read: function (name) { return ipcRenderer.invoke('whider:backup-read', String(name)); },
    open: function () { ipcRenderer.send('whider:backup-open'); }
  },
  /** Versiones nuevas: estado { mode, state, current, version, percent, error, url }, buscar, instalar y descargar */
  updates: {
    state: function () { return ipcRenderer.invoke('whider:update-state'); },
    check: function () { return ipcRenderer.invoke('whider:update-check'); },
    install: function () { return ipcRenderer.invoke('whider:update-install'); },
    open: function () { ipcRenderer.send('whider:update-open'); },
    on: function (fn) { if (typeof fn === 'function') updateListeners.push(fn); }
  }
});
