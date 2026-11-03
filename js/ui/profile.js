/**
 * WHIDER · Perfil: avatar con foto (en toda la app) y hoja "Editar perfil".
 * La foto se recorta en cuadrado, se comprime (≈25 KB) y se sincroniza con la cuenta.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PHOTO_SIZE = 320;

  /** Avatar redondo: foto si existe, si no la inicial sobre el color de acento */
  function avatar(cls) {
    var wrap = U.el('span.avatar' + (cls ? '.' + cls : ''), { attrs: { 'data-avatar': '' } });
    paint(wrap);
    return wrap;
  }

  function paint(wrap) {
    var src = S().photo();
    U.clear(wrap);
    wrap.classList.toggle('has-photo', !!src);
    if (src) {
      var img = U.el('img', { attrs: { alt: '', src: src, referrerpolicy: 'no-referrer', decoding: 'async', draggable: 'false' } });
      img.onerror = function () { wrap.classList.remove('has-photo'); U.clear(wrap); wrap.appendChild(document.createTextNode(S().initial())); };
      wrap.appendChild(img);
    } else {
      wrap.appendChild(document.createTextNode(S().initial()));
    }
  }

  /** Actualiza todos los avatares visibles (barra superior, perfil, ajustes…) */
  function refreshAll() { U.$$('[data-avatar]').forEach(paint); }

  /** Abre el selector de imágenes del sistema y devuelve el archivo elegido */
  function pickFile() {
    return new Promise(function (resolve) {
      var input = U.el('input', { attrs: { type: 'file', accept: 'image/*' }, style: { position: 'fixed', left: '-9999px', opacity: '0' } });
      var done = false;
      var finish = function (f) { if (done) return; done = true; resolve(f || null); setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 0); };
      input.addEventListener('change', function () { finish(input.files && input.files[0]); });
      input.addEventListener('cancel', function () { finish(null); });
      document.body.appendChild(input);
      input.click();
    });
  }

  /** Recorta al centro en cuadrado y comprime a JPEG */
  function processImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, side = Math.min(w, h);
          var canvas = document.createElement('canvas');
          canvas.width = canvas.height = PHOTO_SIZE;
          var ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', 0.84));
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('formato')); };
      img.src = url;
    });
  }

  function choosePhoto() {
    return pickFile().then(function (file) {
      if (!file) return null;
      return processImage(file).catch(function () {
        W.Toast.show({ text: 'No se pudo leer esa imagen. Prueba con otra (JPG o PNG).', type: 'danger' });
        return null;
      });
    });
  }

  /** Hoja "Editar perfil": foto + nombre, guardados juntos */
  function edit(after) {
    var st = S(), p = st.getProfile() || {};
    var draft = { photo: p.photo || '', removed: false };
    var preview = U.el('span.avatar.xl');
    var name = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 30, placeholder: 'Tu nombre', autocomplete: 'name', enterkeyhint: 'done', 'aria-label': 'Nombre' } });
    name.value = st.displayName();
    var removeBtn = U.el('button.link-btn.danger', { text: 'Quitar foto', on: { click: function () { draft.photo = ''; draft.removed = true; renderPreview(); } } });
    var renderPreview = function () {
      U.clear(preview);
      var src = draft.photo || (!draft.removed && p.photoURL) || '';
      preview.classList.toggle('has-photo', !!src);
      if (src) preview.appendChild(U.el('img', { attrs: { alt: '', src: src, referrerpolicy: 'no-referrer' } }));
      else preview.appendChild(document.createTextNode((name.value.trim() || 'W').charAt(0).toUpperCase()));
      removeBtn.style.display = src ? '' : 'none';
    };
    name.addEventListener('input', function () { if (!preview.classList.contains('has-photo')) renderPreview(); });
    var change = function () {
      choosePhoto().then(function (data) { if (data) { draft.photo = data; draft.removed = false; renderPreview(); } });
    };
    var save = function () {
      var n = name.value.trim();
      if (!n) { name.focus(); name.closest('.group').classList.add('shake'); setTimeout(function () { name.closest('.group').classList.remove('shake'); }, 450); return; }
      var patch = { name: n, photo: draft.photo };
      if (draft.removed) patch.photoURL = '';
      st.setProfile(patch);
      if (W.Auth) W.Auth.updateName(n);
      sheet.close();
      if (after) after();
    };
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    var u = W.Auth && W.Auth.user;
    var sheet = W.Sheet.open({
      title: 'Perfil',
      lead: { text: 'Cancelar', onTap: function () { sheet.close(); } },
      trail: { text: 'OK', bold: true, onTap: save },
      body: [
        U.el('div.profile-head', [
          U.el('button.photo-pick', { attrs: { 'aria-label': 'Cambiar foto' }, on: { click: change } }, [preview]),
          U.el('div.cell-row', [U.el('button.link-btn', { text: 'Cambiar foto', on: { click: change } }), removeBtn])
        ]),
        W.UI.section({ header: 'Nombre', items: [U.el('label.cell', [name])] }),
        u && u.email ? W.UI.section({ header: 'Correo', items: [W.UI.cell({ title: u.email })] }) : null
      ]
    });
    renderPreview();
  }

  W.Profile = { avatar: avatar, refreshAll: refreshAll, edit: edit, choosePhoto: choosePhoto, processImage: processImage };
})(window.Whider);
