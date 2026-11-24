/**
 * WHIDER · Fotos de perfil
 *
 * En toda la app (barra superior, personas, chats, equipos, bases de datos) cada persona aparece con su foto o, si no
 * tiene, con su inicial en un círculo. Los perfiles antiguos con personaje se ven con la inicial.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  /** Tu elección: 'photo' (si hay foto) o 'initial' */
  function mode() {
    var p = S().getProfile() || {};
    return p.avatar !== 'initial' && S().photo() ? 'photo' : 'initial';
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
  /** Tu foto de perfil (o tu inicial) */
  function me(size, o) {
    return mode() === 'photo' ? photo(S().photo(), size, S().displayName(), o) : initial(S().displayName(), size, o);
  }
  /** Otra persona, a partir de su perfil público */
  function forProfile(p, size, o) {
    p = p || {};
    return p.avatar === 'photo' && p.photo ? photo(p.photo, size, p.name, o) : initial(p.name, size, o);
  }
  /** Un contacto por su cuenta (o tú, con null o «me») */
  function small(uid, size, o) {
    var my = W.Auth && W.Auth.user ? W.Auth.user.uid : null;
    if (!uid || uid === 'me' || uid === my) return me(size, o);
    var p = W.People && W.People.profile ? W.People.profile(uid) : null;
    if (p) return forProfile(p, size, o);
    var f = S().social && S().social.friends[uid];
    return initial(f ? f.name : '?', size, o);
  }

  W.Avatar = { mode: mode, initial: initial, photo: photo, me: me, forProfile: forProfile, small: small };
})(window.Whider);
