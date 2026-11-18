// @ts-check
/*
 * WHIDER · Portada (la comparten / y /en/): la descarga para cada dispositivo, apariciones suaves y la cabecera.
 * Las direcciones de descarga están en sitio/descargas.js. El idioma sale de <html lang>.
 */
(function () {
  'use strict';
  var $ = function (/** @type {string} */ s) { return /** @type {HTMLElement} */ (document.querySelector(s)); };
  var $$ = function (/** @type {string} */ s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var EN = /^en\b/i.test(document.documentElement.lang);
  var T = EN
    ? { get: 'Download for ', version: 'Version ', for: ' for ', also: ' · Also for ', and: ' and ', yours: 'Your system: ',
      pc: 'On your computer: ', ios: 'On iPhone and iPad: open it in Safari and add it to your Home Screen', play: 'Download' }
    : { get: 'Descargar para ', version: 'Versión ', for: ' para ', also: ' · También para ', and: ' y ', yours: 'Tu sistema: ',
      pc: 'En el ordenador: ', ios: 'En el iPhone y el iPad: ábrela en Safari y añádela a la pantalla de inicio', play: 'Descargar' };

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Cabecera: una regla fina al bajar
  var top = $('#cabecera'), onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // La tira de capturas, cuando se desplaza de lado (móvil), también se recorre con el teclado
  var strip = $('.phones'), fitStrip = function () { if (strip.scrollWidth > strip.clientWidth + 2) strip.setAttribute('tabindex', '0'); else strip.removeAttribute('tabindex'); };
  if (strip) { fitStrip(); window.addEventListener('resize', fitStrip); }

  // Apariciones al llegar a cada parte
  var rv = $$('.rv');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // Descarga según el dispositivo
  var D = /** @type {any} */ (window).WhiderDescargas;
  if (!D) return;
  var OS = D.ordenador, pl = D.plataforma(), movil = D.esMovil(pl), mine = OS[pl] || null, root = document.documentElement;
  root.setAttribute('data-plataforma', pl);
  if (movil) root.setAttribute('data-movil', '');
  $$('[data-os]').forEach(function (a) { var o = OS[a.getAttribute('data-os')]; if (o) a.href = o.url; });
  var keys = ['windows', 'mac', 'linux'];
  var names = function (/** @type {string[]} */ ks) { return ks.map(function (k) { return OS[k].nombre; }); };
  var join = function (/** @type {string[]} */ a) { return a.length > 1 ? a.slice(0, -1).join(', ') + T.and + a[a.length - 1] : a.join(''); };

  if (mine) {
    // Héroe: descarga directa para este ordenador
    $('#cta-dl').setAttribute('href', mine.url);
    $('#cta-dl span').textContent = T.get + mine.nombre;
    $('#cta-note').innerHTML = T.version + D.version + T.for + mine.nombre + T.also + '<a href="#descargar">' + join(names(keys.filter(function (k) { return k !== pl; }))) + '</a>';
    // Tarjeta: el suyo destacado y el resto debajo
    $('#pc-main').hidden = false;
    $('#pc-main-btn').setAttribute('href', mine.url);
    $('#pc-main-btn span').textContent = T.get + mine.nombre;
    var item = $('.dl-item[data-os="' + pl + '"]');
    $('#pc-main-meta').innerHTML = item.querySelector('small').innerHTML;
    /** @type {HTMLElement} */ (item.parentNode).hidden = true;
    $('#pc-others').hidden = false;
    $('#pc-chip').hidden = false;
    $('#pc-chip').textContent = T.yours + mine.nombre;
    // Ayuda: primero la de su sistema
    var dl = $('.help dl');
    $$('[data-help="' + pl + '"]').reverse().forEach(function (n) { dl.insertBefore(n, dl.firstChild); });
  } else if (movil) {
    $('#cta-dl').hidden = true;
    $('#mob-chip').hidden = false;
    // Lo de cada móvil: Google Play en Android; en el iPhone, instalarla desde Safari
    $$('[data-pl]').forEach(function (el) { if (el.getAttribute('data-pl') !== pl) el.hidden = true; });
    if (pl === 'ios') $('#cta-note').textContent = T.ios;
    else {
      $('#cta-play').hidden = false;
      $('#cta-note').innerHTML = T.pc + '<a href="#descargar">' + join(names(keys)) + '</a>';
    }
  }

  // Google Play, cuando esté publicada: el aviso «Próximamente» pasa a ser el enlace
  if (D.play) {
    ['play', 'cta-play'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var a = document.createElement('a');
      a.id = id; a.className = 'store'; a.href = D.play; a.hidden = el.hidden;
      if (el.hasAttribute('data-pl')) a.setAttribute('data-pl', /** @type {string} */ (el.getAttribute('data-pl')));
      a.innerHTML = '<b>Google Play</b><span class="soon">' + T.play + '</span>';
      /** @type {Node} */ (el.parentNode).replaceChild(a, el);
    });
  }

  // Tamaño de cada instalador
  D.tamanos().then(function (/** @type {Record<string, string> | null} */ m) {
    if (!m) return;
    $$('[data-size]').forEach(function (el) { var v = m[el.getAttribute('data-size')]; if (v) el.textContent = ' · ' + v; });
    if (mine && m[mine.archivo]) $('#pc-main-meta').innerHTML = $('.dl-item[data-os="' + pl + '"] small').innerHTML;
  });
})();
