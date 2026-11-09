/**
 * Puente seguro entre la app web y el ordenador: solo expone estas funciones (window.WhiderDesktop).
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = [];
ipcRenderer.on('whider:command', function (_e, cmd) {
  listeners.forEach(function (fn) { try { fn(String(cmd)); } catch (e) { /* una orden no rompe las demás */ } });
});

contextBridge.exposeInMainWorld('WhiderDesktop', {
  platform: process.platform,
  /** Acceso con Google en el navegador del ordenador → { ok, idToken, accessToken } o { ok: false, kind } */
  googleSignIn: function () { return ipcRenderer.invoke('whider:google-sign-in'); },
  cancelGoogle: function () { return ipcRenderer.invoke('whider:google-cancel'); },
  /** { openAtLogin, closeToTray, version } */
  getSettings: function () { return ipcRenderer.invoke('whider:get-settings'); },
  setSetting: function (key, value) { return ipcRenderer.invoke('whider:set-setting', String(key), !!value); },
  showWindow: function () { ipcRenderer.send('whider:show-window'); },
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
  /** Órdenes del menú y de la bandeja: 'new-task', 'search', 'settings', 'shortcuts', 'focus-toggle', 'report-pdf', 'data', 'go:home'… */
  onCommand: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
});
