/**
 * WHIDER · Calendarios suscritos en pantalla (los datos, en js/core/calendars.js):
 *  - Ajustes → Calendarios suscritos: la lista, añadir uno con su enlace, actualizar, renombrar y quitar.
 *  - La ficha de un evento (solo lectura) con «Crear una tarea» a partir de él.
 *  - Filas y fichas de eventos para el calendario y la sección «Agenda de hoy» de Hoy.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, C = function () { return W.Calendars; };

  /* ---------------------------------------------------------------- Textos */
  /** Por qué no se pudo traer un calendario, dicho para cualquiera */
  function errorText(code, upstream) {
    if (code === 'url') return W.t('Ese enlace no es válido. Copia el enlace del calendario en formato iCal (.ics).');
    if (code === 'dup') return W.t('Ese calendario ya está en la lista.');
    if (code === 'max') return W.t('Puedes tener hasta {n} calendarios.', { n: C().MAX });
    if (code === 'blocked') return W.t('Ese enlace apunta a una dirección privada o no permitida.');
    if (code === 'status') return upstream === 401 || upstream === 403 || upstream === 404 || upstream === 410
      ? W.t('El calendario no se encuentra o ya no es público. Comprueba el enlace.')
      : W.t('El servidor del calendario respondió con un error ({code}).', { code: upstream || '?' });
    if (code === 'format') return W.t('Ese enlace no lleva a un calendario (.ics). En Google Calendar, usa la «Dirección secreta en formato iCal».');
    if (code === 'size') return W.t('El calendario es demasiado grande.');
    if (code === 'timeout') return W.t('El servidor del calendario tarda demasiado en responder.');
    if (code === 'offline') return W.t('Sin conexión. Se volverá a intentar.');
    if (code === 'busy') return W.t('Demasiadas peticiones seguidas. Inténtalo dentro de unos minutos.');
    if (code === 'unavailable') return W.t('Los calendarios suscritos no están disponibles en esta copia de WHIDER.');
    return W.t('No se pudo conectar con el calendario.');
  }
  /** «Todo el día», «Todo el día · 2 de 5» o «09:30 – 10:30» */
  function when(ev) {
    if (ev.allDay) return ev.days > 1 ? W.t('Todo el día · {part} de {days}', { part: ev.part, days: ev.days }) : W.t('Todo el día');
    if (!ev.durMin) return U.fmtTime(ev.time);
    var p = ev.time.split(':'), end = (+p[0] * 60 + +p[1] + ev.durMin) % 1440;
    return U.fmtTime(ev.time) + ' – ' + U.fmtTime(U.pad(Math.floor(end / 60)) + ':' + U.pad(end % 60)) + (+p[0] * 60 + +p[1] + ev.durMin >= 1440 ? ' (+1)' : '');
  }
  function title(ev) { return ev.title || W.t('(Sin título)'); }
  /** ¿Ya terminó? (para atenuarlo en Hoy) */
  function past(ev) {
    if (ev.date !== U.today() || ev.allDay) return ev.date < U.today();
    var p = ev.time.split(':'), now = new Date(), end = +p[0] * 60 + +p[1] + Math.max(ev.durMin, 1);
    return end <= now.getHours() * 60 + now.getMinutes();
  }

  /* ---------------------------------------------------------------- Ficha de un evento */
  function open(ev) {
    var rows = [
      W.UI.cell({ icon: 'clock', title: U.cap(U.fmtLong(ev.start || ev.date)), sub: when(ev) + (ev.repeats ? ' · ' + W.t('se repite') : '') }),
      W.UI.cell({ icon: 'calendar', title: ev.calName || W.t('Calendario'), sub: W.t('Calendario suscrito: se cambia en su propia app') })
    ];
    if (ev.location) rows.push(W.UI.cell({ icon: 'pin', title: ev.location }));
    var body = [U.el('div.group', rows)];
    if (ev.notes) body.push(U.el('div.sec', [U.el('div.sec-h', { text: W.t('Notas') }), U.el('div.group', [U.el('p.ev-notes', { text: ev.notes })])]));
    var s = W.Sheet.open({
      title: title(ev), className: 'ev-sheet', body: body,
      foot: [U.el('button.btn.primary', { on: { click: function () {
        var st = S(), t = st.addTask({
          text: title(ev).slice(0, 200), date: ev.date, time: ev.allDay ? null : ev.time, duration: ev.allDay ? 0 : Math.min(ev.durMin || 0, 720),
          listId: st.defaultListId(), highlight: 'none', repeat: 'none', warn: st.settings.defaultWarn,
          notes: [ev.location, ev.notes].filter(Boolean).join('\n\n').slice(0, 2000), subtasks: []
        });
        s.close();
        if (t) {
          W.Toast.show({ text: W.t('Tarea creada a partir del evento'), icon: 'check', type: 'success' });
          setTimeout(function () { W.Editor.open(t.id); }, 260);
        }
      } } }, [U.icon('plus', 'sm'), W.t('Crear una tarea')])]
    });
    return s;
  }

  /* ---------------------------------------------------------------- Piezas para el calendario y Hoy */
  function label(ev) { return when(ev) + ', ' + title(ev) + (ev.calName ? ' · ' + ev.calName : ''); }
  /** Fila de lista (panel del día, agenda, Hoy) */
  function row(ev) {
    var b = U.el('button.ev-row' + (past(ev) ? '.past' : ''), { attrs: { type: 'button', 'aria-label': W.t('Evento: {label}', { label: label(ev) }) } }, [
      U.el('span.ev-time', { text: ev.allDay ? W.t('Todo el día') : U.fmtTime(ev.time) }),
      U.el('span.ev-bar', { attrs: { 'aria-hidden': 'true' } }),
      U.el('span.ev-main', [U.el('b', { text: title(ev) }), U.el('small', { text: [ev.allDay ? (ev.days > 1 ? when(ev) : '') : when(ev), ev.calName, ev.location].filter(Boolean).join(' · ') })])
    ]);
    b.addEventListener('click', function () { open(ev); });
    return b;
  }
  /** Lista de eventos de un día */
  function list(evs) { return U.el('div.ev-list', evs.map(row)); }
  /** Ficha corta (fila «todo el día» y casillas del mes en el ordenador) */
  function chip(ev, cls) {
    var c = U.el('button.' + (cls || 'chip') + '.ev', { attrs: { type: 'button', title: label(ev), 'aria-label': W.t('Evento: {label}', { label: label(ev) }) } }, [
      cls === 'mg-chip' && !ev.allDay ? U.el('b', { text: U.fmtTime(ev.time) }) : cls === 'mg-chip' ? null : U.icon('calendar'),
      U.el('span', { text: title(ev) })
    ]);
    c.addEventListener('click', function (e) { e.stopPropagation(); open(ev); });
    c.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    return c;
  }

  /** Hoy: los eventos de hoy de tus calendarios (nada si no hay) */
  function homeSection() {
    if (!C() || !C().any()) return null;
    var td = U.today(), evs = C().between(td, td);
    if (!evs.length) return null;
    var max = 6, shown = evs.slice(0, max);
    var more = evs.length > max ? U.el('div.cell-row', { style: { justifyContent: 'flex-end', padding: '6px 4px 0' } }, [
      U.el('button.link-btn', { text: W.t('Ver los {n} en el calendario', { n: evs.length }), on: { click: function () { var st = S(); st.ui.calSelected = td; st.ui.calView = W.Layout.desktop ? 'day' : 'week'; W.Router.go('calendar'); } } })]) : null;
    return W.UI.section({ cls: 'ev-sec', title: W.t('Agenda de hoy'), side: U.el('small', { text: evs.length }), items: U.el('div', [list(shown), more]) });
  }

  /* ---------------------------------------------------------------- Ajustes */
  function statusText(id) {
    var s = C().status(id);
    if (!s.at && s.ok === null) return W.t('Pendiente de descargar');
    var when2 = s.at ? W.t('Actualizado {when}', { when: U.fmtRel(s.at - Date.now()) }) : '';
    var count = U.plural(s.count, 'evento', 'eventos');
    if (s.ok === false) return errorText(s.error, s.upstream) + (s.at ? ' · ' + W.t('Se muestra lo último que llegó') : '');
    return [when2, count].filter(Boolean).join(' · ');
  }

  function page(nav) {
    var cals = C().list();
    var rows = cals.map(function (c) {
      var s = C().status(c.id);
      var more = U.el('button.circle-btn.cal-more', { attrs: { type: 'button', 'aria-label': W.t('Opciones de «{name}»', { name: c.name }), title: W.t('Actualizar, cambiar el nombre o quitar') },
        on: { click: function () { manage(c, nav); } } }, [U.icon('dots')]);
      return W.UI.cell({
        icon: 'calendar', title: c.name, sub: c.on ? statusText(c.id) : W.t('Oculto'), subCls: c.on && s.ok === false ? 'warn' : null,
        right: U.el('span.cell-row.cal-right', [more, W.UI.toggle(c.on, function (v) { C().update(c.id, { on: v }); nav.refresh(); }, W.t('Mostrar «{name}»', { name: c.name }))])
      });
    });
    rows.push(W.UI.cell({ icon: 'plus', title: W.t('Añadir un calendario'), accent: true, onTap: function () { addSheet(function () { nav.refresh(); }); } }));
    return {
      title: W.t('Calendarios suscritos'),
      body: [
        U.el('p.sheet-lead-text', { text: W.t('Ve en WHIDER los eventos de tus otros calendarios (trabajo, Google, Outlook, Apple, festivos…). Se actualizan solos cada hora; para cambiarlos, usa su propia app.') }),
        W.UI.section({ items: rows, footer: cals.length ? W.t('Con «…», actualízalo, cámbiale el nombre o quítalo. El interruptor lo oculta sin quitarlo.') : null }),
        W.UI.section({ header: W.t('Dónde está el enlace'), items: [
          W.UI.cell({ icon: 'calendar', title: 'Google Calendar', sub: W.t('En el ordenador: Configuración → tu calendario → «Dirección secreta en formato iCal».') }),
          W.UI.cell({ icon: 'calendar', title: 'Outlook', sub: W.t('Configuración → Calendario → Calendarios compartidos → Publicar un calendario → enlace ICS.') }),
          W.UI.cell({ icon: 'calendar', title: W.t('Apple (iCloud)'), sub: W.t('En Calendario, toca ⓘ junto al calendario → «Calendario público» → Compartir enlace.') })
        ], footer: W.t('La dirección secreta da acceso a tu calendario: no la compartas. WHIDER la guarda con tus ajustes y descarga el calendario a través de su servidor, que no guarda nada.') })
      ]
    };
  }

  function manage(c, nav) {
    W.Sheet.choose({ title: c.name, options: [
      { value: 'refresh', label: W.t('Actualizar ahora'), icon: 'refresh' },
      { value: 'rename', label: W.t('Cambiar el nombre'), icon: 'edit' },
      { value: 'remove', label: W.t('Quitar este calendario'), icon: 'trash', danger: true }
    ] }).then(function (v) {
      if (v === 'refresh') {
        W.Toast.show({ text: W.t('Actualizando «{name}»…', { name: c.name }), icon: 'refresh' });
        C().refresh(c.id, true).then(function (s) {
          if (nav) nav.refresh();
          if (!s) return;
          W.Toast.show(s.ok ? { text: W.t('«{name}» al día: {n}', { name: c.name, n: U.plural(s.count, 'evento', 'eventos') }), icon: 'check', type: 'success' }
            : { text: errorText(s.error, s.upstream), type: 'danger' });
        });
      } else if (v === 'rename') {
        W.Sheet.prompt({ title: W.t('Nombre del calendario'), value: c.name, maxLength: 60, ok: W.t('Guardar') }).then(function (n) {
          if (n) { C().update(c.id, { name: n }); if (nav) nav.refresh(); }
        });
      } else if (v === 'remove') {
        W.Sheet.confirm({ title: W.t('¿Quitar «{name}»?', { name: c.name }), text: W.t('Sus eventos dejarán de verse en WHIDER. El calendario original no cambia.'), ok: W.t('Quitar'), danger: true }).then(function (ok) {
          if (!ok) return;
          C().remove(c.id);
          if (nav) nav.refresh();
          W.Toast.show({ text: W.t('Calendario quitado'), icon: 'trash' });
        });
      }
    });
  }

  function addSheet(done) {
    var url = U.el('input.cell-input', { attrs: { type: 'url', inputmode: 'url', maxlength: 2048, placeholder: 'https://… .ics', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': W.t('Enlace del calendario') } });
    var name = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 60, placeholder: W.t('Nombre (opcional)'), 'aria-label': W.t('Nombre del calendario') } });
    var msg = U.el('p.form-msg', { attrs: { role: 'status', 'aria-live': 'polite' } });
    var btn = U.el('button.btn.primary', { text: W.t('Añadir'), attrs: { type: 'button' } });
    var working = false;
    var submit = function () {
      if (working) return;
      if (!url.value.trim()) { url.focus(); return; }
      working = true; btn.disabled = true; btn.textContent = W.t('Comprobando…');
      msg.textContent = ''; msg.classList.remove('error');
      C().test(url.value).then(function (r) {
        working = false; btn.disabled = false; btn.textContent = W.t('Añadir');
        if (!r.ok) { msg.textContent = errorText(r.error, r.upstream); msg.classList.add('error'); url.focus(); return; }
        var n = name.value.trim() || r.name;
        C().add(r, n);
        s.close();
        W.Toast.show({ text: W.t('Calendario añadido: {n}', { n: U.plural(r.count, 'evento', 'eventos') }), icon: 'calendar', type: 'success' });
        if (done) done();
      });
    };
    btn.addEventListener('click', submit);
    [url, name].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } }); });
    var s = W.Sheet.open({
      title: W.t('Añadir un calendario'), className: 'editor cal-add',
      body: [
        U.el('p.sheet-lead-text', { text: W.t('Pega el enlace del calendario en formato iCal (.ics o webcal://). Sus eventos se verán en tu calendario y en Inicio.') }),
        U.el('div.group', [U.el('label.cell', [url]), U.el('label.cell', [name])]),
        msg
      ],
      foot: [btn]
    });
    setTimeout(function () { url.focus(); }, W.Layout && W.Layout.desktop ? 30 : 420);
    return s;
  }

  W.CalSubs = { page: page, open: open, row: row, list: list, chip: chip, when: when, title: title, label: label, homeSection: homeSection, errorText: errorText, addSheet: addSheet };
})(window.Whider);
