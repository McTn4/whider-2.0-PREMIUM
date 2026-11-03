/**
 * WHIDER · Motor de avisos: recordatorios previos, alertas por incumplimiento,
 * horas de silencio, notificaciones del sistema y recordatorios nativos (Android).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var U = W.U, S = function () { return W.State; };
  var timer = null;
  var ICON = 'icons/icon-192.png';

  function bridge() {
    var b = window.WhiderAndroid;
    return b && typeof b.showNotification === 'function' ? b : null;
  }

  function remindMinutes(t) {
    return typeof t.remindBefore === 'number' ? t.remindBefore : S().settings.remindBefore;
  }

  /** ¿Está el instante (ms) dentro de las horas de silencio? */
  function quietAt(ts) {
    var q = S().settings.quietHours;
    if (!q.enabled) return false;
    var d = new Date(ts), m = d.getHours() * 60 + d.getMinutes();
    var from = U.hmToMin(q.from), to = U.hmToMin(q.to);
    return from <= to ? (m >= from && m < to) : (m >= from || m < to);
  }

  /** Si un aviso cae en horas de silencio, se retrasa hasta que terminan */
  function afterQuiet(ts) {
    if (!quietAt(ts)) return ts;
    var q = S().settings.quietHours, d = new Date(ts), to = q.to.split(':');
    var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +to[0], +to[1], 0, 0);
    if (end.getTime() <= ts) end.setDate(end.getDate() + 1);
    return end.getTime();
  }

  var Notify = {
    init: function () {
      Notify.check();
      if (timer) clearInterval(timer);
      timer = setInterval(Notify.check, 15000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) Notify.check(); });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function (e) {
          if (e.data && e.data.type === 'open-screen' && W.Router) W.Router.go(e.data.screen || 'home');
        });
      }
      S().subscribe(Notify.scheduleSync);
      Notify.scheduleSync();
    },

    isQuiet: function () { return quietAt(Date.now()); },

    /* ---------- Permisos ---------- */
    permission: function () {
      var b = bridge();
      if (b) { try { return b.getNotificationPermission(); } catch (e) { return 'default'; } }
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    },
    request: function () {
      var b = bridge();
      if (b) { try { b.requestNotificationPermission(); } catch (e) { /* sin puente */ } return Promise.resolve(Notify.permission()); }
      if (!('Notification' in window)) {
        W.Toast.show({ text: 'Este dispositivo no admite notificaciones del sistema', type: 'danger' });
        return Promise.resolve('unsupported');
      }
      return new Promise(function (resolve) {
        var r = Notification.requestPermission(resolve);
        if (r && r.then) r.then(resolve);
      }).then(function (res) {
        if (res === 'granted') W.Toast.show({ text: 'Notificaciones activadas', type: 'success', icon: 'bell' });
        else if (res === 'denied') W.Toast.show({ text: 'Bloqueadas: actívalas en los ajustes del navegador', type: 'danger' });
        Notify.emit();
        return res;
      });
    },
    /** La app Android llama aquí tras el diálogo de permiso */
    onNativePermissionResult: function (granted) {
      W.Toast.show({ text: granted ? 'Notificaciones activadas' : 'Permiso de notificaciones denegado', type: granted ? 'success' : 'danger' });
      Notify.emit();
      Notify.scheduleSync();
    },
    emit: function () { S().notify('permission'); },

    /* ---------- Notificación del sistema ---------- */
    system: function (title, body, tag) {
      var b = bridge();
      if (b) { try { b.showNotification(title, body, tag); } catch (e) { /* sin puente */ } return; }
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var opts = { body: body, tag: tag, renotify: true, icon: ICON, badge: ICON, data: { screen: 'home' } };
      var direct = function () {
        try {
          var n = new Notification(title, opts);
          n.onclick = function () { window.focus(); if (W.Router) W.Router.go('home'); n.close(); };
        } catch (e) { /* Android Chrome exige el Service Worker */ }
      };
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.showNotification) return reg.showNotification(title, opts);
          direct();
        }).catch(direct);
      } else direct();
    },

    /* ---------- Motor de comprobación ---------- */
    check: function () {
      var st = S();
      if (!st) return;
      // Durante la presentación inicial no se interrumpe con avisos
      if ((W.Onboarding && W.Onboarding.isOpen()) || (W.AuthScreen && W.AuthScreen.isOpen())) return;
      if (Notify.isQuiet()) { Notify.emitBadge(); return; }
      var now = Date.now(), alerts = [], reminders = [], dirty = false;
      var rewarn = st.settings.rewarn;

      st.tasks.forEach(function (t) {
        if (t.done || !t.warn || !t.date) return;
        var deadline = U.deadlineTs(t.date, t.time);
        var before = remindMinutes(t);

        // Recordatorio previo (solo tareas con hora)
        if (t.time && before > 0 && now >= deadline - before * 60000 && now < deadline && t.remindedAt !== deadline) {
          t.remindedAt = deadline; dirty = true; reminders.push(t);
        }
        // Alerta por incumplimiento
        if (now >= deadline) {
          var first = !t.warnedAt || t.warnedAt < deadline;
          var again = rewarn > 0 && t.warnedAt && now - t.warnedAt >= rewarn * 60000;
          if (first || again) { t.warnedAt = now; dirty = true; alerts.push(t); }
        }
      });

      reminders.forEach(function (t) {
        var mins = Math.max(1, Math.round((U.deadlineTs(t.date, t.time) - now) / 60000));
        Notify.system(t.text, 'Vence en ' + U.plural(mins, 'minuto', 'minutos') + ' (' + U.fmtTime(t.time) + ')', 'whider-pre-' + t.id);
      });
      if (reminders.length) {
        var r0 = reminders[0], m0 = Math.max(1, Math.round((U.deadlineTs(r0.date, r0.time) - now) / 60000));
        W.Toast.show({ text: reminders.length === 1 ? '«' + r0.text + '» vence en ' + m0 + ' min' : U.plural(reminders.length, 'tarea vence pronto', 'tareas vencen pronto'), icon: 'clock', type: 'info' });
      }
      alerts.forEach(function (t) {
        var reason = t.time && t.date === U.today() ? 'Superó la hora límite (' + U.fmtTime(t.time) + ')' : 'Venció ' + U.fmtDay(t.date).toLowerCase();
        Notify.system(t.text, reason + ' · Sigue pendiente', 'whider-due-' + t.id);
      });
      // Dentro de la app, un único aviso aunque venzan varias tareas a la vez
      if (alerts.length === 1) {
        var one = alerts[0];
        W.Toast.show({ text: '«' + one.text + '» sigue pendiente', type: 'danger', icon: 'alert', duration: 7000,
          action: { label: 'Completar', fn: function () { var x = st.find(one.id); if (x && !x.done) { st.setDone(one.id, true); W.Audio.success(); } } } });
      } else if (alerts.length > 1) {
        W.Toast.show({ text: U.plural(alerts.length, 'tarea sigue pendiente', 'tareas siguen pendientes'), type: 'danger', icon: 'alert', duration: 7000,
          action: { label: 'Ver', fn: function () { W.Router.go('home'); } } });
      }

      if (alerts.length) { W.Audio.warning(); W.Audio.vibrate([70, 60, 70, 60, 140]); }
      else if (reminders.length) { W.Audio.chime(); W.Audio.vibrate([30, 50, 30]); }
      if (dirty) st.save();
      Notify.emitBadge();
    },

    emitBadge: function () {
      var n = S().overdueAll().length;
      U.$$('[data-badge="alerts"]').forEach(function (b) {
        b.textContent = n > 9 ? '9+' : String(n);
        b.classList.toggle('show', n > 0);
      });
    },

    /* ---------- Recordatorios nativos con la app cerrada (Android) ---------- */
    scheduleSync: U.debounce(function () {
      var b = window.WhiderAndroid;
      if (!b || typeof b.syncReminders !== 'function') return;
      var now = Date.now(), horizon = now + 45 * 86400000, out = [];
      S().tasks.forEach(function (t) {
        if (t.done || !t.warn || !t.date) return;
        var deadline = U.deadlineTs(t.date, t.time);
        var before = remindMinutes(t);
        if (t.time && before > 0) {
          var pre = afterQuiet(deadline - before * 60000);
          if (pre > now && pre < deadline && pre < horizon) {
            out.push({ key: t.id + ':pre', at: pre, title: t.text, body: 'Vence a las ' + U.fmtTime(t.time) });
          }
        }
        var due = afterQuiet(deadline);
        if (due > now && due < horizon) {
          out.push({ key: t.id + ':due', at: due, title: t.text, body: 'El plazo ha terminado y sigue pendiente' });
        }
      });
      try { b.syncReminders(JSON.stringify(out)); } catch (e) { /* sin puente */ }
    }, 600)
  };

  W.Notify = Notify;
})(window.Whider);
