/**
 * WHIDER · Fotos de perfil con tu personaje
 *
 * En toda la app (barra lateral, perfil, personas, chats, equipos, bases de datos) cada persona
 * aparece con su personaje: busto con fondo y marco a elegir (algunos de Premium). Quien lo
 * prefiera puede usar su foto o solo la inicial (Editar perfil → Foto de perfil).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function mode() {
    var p = S().getProfile() || {}, m = p.avatar || 'buddy';
    if (m === 'photo' && !S().photo()) m = 'buddy';
    return m;
  }
  function frameOverlay(frame) {
    if (frame === 'laurel') {
      var leaves = '';
      for (var i = 0; i < 7; i++) {
        // Dos ramas: de abajo hacia arriba por cada lado
        var a = (112 + i * 21) * Math.PI / 180, b = (68 - i * 21) * Math.PI / 180;
        [a, b].forEach(function (ang, k) {
          var x = 50 + 47 * Math.cos(ang), y = 50 + 47 * Math.sin(ang), rot = ang * 180 / Math.PI + (k ? -60 : 60);
          leaves += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="6" ry="2.6" transform="rotate(' + rot.toFixed(0) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')" fill="' + (i % 2 ? '#BDBDBD' : '#EDEDED') + '"/>';
        });
      }
      return '<svg viewBox="0 0 100 100" class="av-ov">' + leaves + '</svg>';
    }
    if (frame === 'diamante') {
      var gems = '';
      for (var j = 0; j < 8; j++) { var an = j * 45 * Math.PI / 180, gx = 50 + 48 * Math.cos(an), gy = 50 + 48 * Math.sin(an); gems += '<path d="M' + gx.toFixed(1) + ' ' + (gy - 4.5).toFixed(1) + 'l4 4.5-4 4.5-4-4.5z" fill="#FFF" stroke="#9A9A9A" stroke-width=".8"/>'; }
      return '<svg viewBox="0 0 100 100" class="av-ov"><circle cx="50" cy="50" r="48" fill="none" stroke="url(#avd)" stroke-width="3"/><defs><linearGradient id="avd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF"/><stop offset=".5" stop-color="#8A8A8A"/><stop offset="1" stop-color="#FFF"/></linearGradient></defs>' + gems + '</svg>';
    }
    if (frame === 'corona') return '<svg viewBox="0 0 100 100" class="av-ov crown"><path d="M33 9l5 11 12-11 12 11 5-11 3 16H30z" fill="#FFF" stroke="#8A8A8A" stroke-width="1.2" stroke-linejoin="round"/><circle cx="50" cy="16" r="2" fill="#1E1E1E"/></svg>';
    return '';
  }
  /** Avatar a partir de un personaje: busto con su fondo y su marco */
  function buddy(cfg, size, o) {
    o = o || {};
    var c = Object.assign({}, W.Character.DEFAULT, cfg || {});
    var px = size ? (typeof size === 'number' ? size + 'px' : size) : '100%';
    var el = U.el('span.av.av-bg-' + (c.bg || 'liso') + '.av-fr-' + (c.frame || 'nada') + (o.cls ? '.' + o.cls : ''), { style: { '--s': px }, attrs: { 'aria-hidden': 'true' } });
    var inner = U.el('span.av-in');
    inner.appendChild(W.Character.svg({ size: 100, cfg: c, mood: o.mood || 'happy', crop: true, still: !o.live }));
    el.appendChild(inner);
    var ov = frameOverlay(c.frame);
    if (ov) el.appendChild(U.el('span.av-ovw', { html: ov }));
    return el;
  }
  function initial(name, size, o) {
    o = o || {};
    var px = size ? size + 'px' : '100%';
    return U.el('span.av.av-init' + (o.cls ? '.' + o.cls : ''), { style: { '--s': px }, attrs: { 'aria-hidden': 'true' } }, [U.el('span.av-in', { text: (String(name || 'W').trim().charAt(0) || 'W').toUpperCase() })]);
  }
  function photo(src, size, fallbackName, o) {
    o = o || {};
    var px = size ? size + 'px' : '100%';
    var el = U.el('span.av.av-photo' + (o.cls ? '.' + o.cls : ''), { style: { '--s': px }, attrs: { 'aria-hidden': 'true' } });
    var img = U.el('img', { attrs: { alt: '', src: src, referrerpolicy: 'no-referrer', decoding: 'async', draggable: 'false' } });
    img.onerror = function () { el.parentNode && el.parentNode.replaceChild(initial(fallbackName, size, o), el); };
    el.appendChild(U.el('span.av-in', [img]));
    return el;
  }
  /** Tu avatar (según tu elección en Editar perfil) */
  function me(size, o) {
    var m = mode();
    if (m === 'photo') return photo(S().photo(), size, S().displayName(), o);
    if (m === 'initial') return initial(S().displayName(), size, o);
    return buddy(W.Character.config(), size, o);
  }
  /** Avatar de otra persona a partir de su perfil público */
  function forProfile(p, size, o) {
    p = p || {};
    if (p.avatar === 'photo' && p.photo) return photo(p.photo, size, p.name, o);
    if (p.avatar === 'initial' || (!p.buddy && p.name)) return initial(p.name, size, o);
    return buddy(p.buddy || null, size, o);
  }
  /** Avatar de un contacto por su cuenta (o el tuyo con null o «me») */
  function small(uid, size, o) {
    var my = W.Auth && W.Auth.user ? W.Auth.user.uid : null;
    if (!uid || uid === 'me' || uid === my) return me(size, o);
    var p = W.People && W.People.profile ? W.People.profile(uid) : null;
    if (p) return forProfile(p, size, o);
    var f = S().social && S().social.friends[uid];
    return initial(f ? f.name : '?', size, o);
  }

  W.Avatar = { mode: mode, buddy: buddy, initial: initial, photo: photo, me: me, forProfile: forProfile, small: small, frameOverlay: frameOverlay };
})(window.Whider);
