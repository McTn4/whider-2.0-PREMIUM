// @ts-check
/*
 * WHIDER · Enlaces de descarga (los usan la portada y las invitaciones)
 * Todas las direcciones están aquí. Cuando WHIDER esté en Google Play, pon su enlace en «play»
 * y las dos páginas lo ofrecerán en lugar de «Google Play · Próximamente».
 */
(function () {
  'use strict';
  var REL = 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/desktop-latest/';

  var D = window.WhiderDescargas = {
    version: '1.1.0',
    /** Ficha de Google Play (vacío mientras no esté publicada) */
    play: '',
    /** La app en el navegador */
    app: '/app',
    /** Instaladores para ordenador (los publica GitHub Actions en cada versión) */
    ordenador: {
      windows: { nombre: 'Windows', archivo: 'WHIDER-Setup.exe', url: REL + 'WHIDER-Setup.exe' },
      mac: { nombre: 'macOS', archivo: 'WHIDER-mac.dmg', url: REL + 'WHIDER-mac.dmg' },
      linux: { nombre: 'Linux', archivo: 'WHIDER-linux.AppImage', url: REL + 'WHIDER-linux.AppImage' }
    },
    /** Datos de la publicación (tamaño de cada instalador) */
    publicacion: 'https://api.github.com/repos/McTn4/whider-2.0-PREMIUM/releases/tags/desktop-latest',

    /** El dispositivo de quien visita: windows, mac, linux, android, ios u otro */
    plataforma: function () {
      var ua = navigator.userAgent || '';
      var p = String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
      if (/Android/i.test(ua) || /Android/i.test(p)) return 'android';
      if (/iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(p) && navigator.maxTouchPoints > 1)) return 'ios';
      if (/CrOS|Chrome OS/i.test(ua + ' ' + p)) return 'otro';
      if (/Win/i.test(p) || /Windows/i.test(ua)) return 'windows';
      if (/Mac/i.test(p) || /Mac OS X|Macintosh/i.test(ua)) return 'mac';
      if (/Linux|X11/i.test(p + ' ' + ua)) return 'linux';
      return 'otro';
    },
    esMovil: function (pl) { pl = pl || D.plataforma(); return pl === 'android' || pl === 'ios'; },

    /** Tamaño de cada instalador en MB, leído de GitHub. Si no responde, null (se muestra sin tamaño). */
    tamanos: function () {
      if (!window.fetch) return Promise.resolve(null);
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
      return fetch(D.publicacion, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          clearTimeout(t);
          if (!j || !j.assets) return null;
          var m = {};
          j.assets.forEach(function (a) { if (a && a.name && a.size) m[a.name] = Math.max(1, Math.round(a.size / 1e6)) + ' MB'; });
          return m;
        })
        .catch(function () { clearTimeout(t); return null; });
    }
  };
})();
