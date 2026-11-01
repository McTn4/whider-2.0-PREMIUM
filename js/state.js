/**
 * WHIDER PRO - ESTADO REACTIVO & GESTOR DE DATOS
 * Centraliza las tareas, métricas, persistencia y eventos de actualización.
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var STORAGE_KEY = 'whider.v1';
  var SETTINGS_KEY = 'whider.settings.v1';

  // Utilidades de Fechas
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function today() { return ymd(new Date()); }
  function currentTimeStr() {
    var n = new Date();
    return pad(n.getHours()) + ':' + pad(n.getMinutes());
  }
  function uid() {
    return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Tareas de muestra iniciales
  function getSampleTasks() {
    var t = today();
    return [
      { id: 's1', text: 'Planificar prioridades de la semana', date: t, time: '10:00', done: false, doneOn: null, highlight: 'star', warn: true, example: true },
      { id: 's2', text: 'Entrenamiento o sesión de ejercicio', date: t, time: null, done: false, doneOn: null, highlight: 'none', warn: false, example: true },
      { id: 's3', text: 'Reunión de revisión de avances', date: addDays(t, 1), time: '12:30', done: false, doneOn: null, highlight: 'danger', warn: true, example: true }
    ];
  }

  // Sanitizador de tareas
  function cleanTasks(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
      out.push({
        id: typeof item.id === 'string' ? item.id : uid(),
        text: item.text.trim(),
        date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
        time: typeof item.time === 'string' && /^\d{2}:\d{2}$/.test(item.time) ? item.time : null,
        done: !!item.done,
        doneOn: typeof item.doneOn === 'string' ? item.doneOn : null,
        highlight: (item.highlight === 'star' || item.highlight === 'danger' || item.highlight === 'purple') ? item.highlight : 'none',
        warn: !!item.warn,
        warnedAt: typeof item.warnedAt === 'number' && isFinite(item.warnedAt) ? item.warnedAt : null,
        example: !!item.example
      });
    }
    return out;
  }

  // Carga Local
  function loadLocalTasks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks)) return cleanTasks(parsed.tasks);
      }
    } catch (e) {}
    return null;
  }

  function loadLocalSettings() {
    var def = { sound: true, vibrate: true };
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.sound === 'boolean') def.sound = parsed.sound;
          if (typeof parsed.vibrate === 'boolean') def.vibrate = parsed.vibrate;
        }
      }
    } catch (e) {}
    return def;
  }

  // Una tarea con aviso está vencida si pasó su fecha o, siendo hoy, su hora límite
  function isOverdue(t, td, curTime) {
    if (t.done || !t.date) return false;
    if (t.date < td) return true;
    return t.date === td && !!t.time && t.time <= curTime;
  }

  var storedTasks = loadLocalTasks();
  var hadStored = storedTasks !== null;
  var subscribers = [];

  var State = {
    tasks: hadStored ? storedTasks : getSampleTasks(),
    settings: loadLocalSettings(),
    filter: 'all',
    selectedCalDate: today(),
    calMonth: { y: new Date().getFullYear(), m: new Date().getMonth() },
    activeScreen: 'home',

    today: today,
    currentTimeStr: currentTimeStr,
    addDays: addDays,
    parseDate: parse,
    ymd: ymd,

    // Suscripción a cambios
    subscribe: function (fn) {
      subscribers.push(fn);
      return function () {
        subscribers = subscribers.filter(function (s) { return s !== fn; });
      };
    },

    notify: function () {
      State.saveLocal();
      subscribers.forEach(function (fn) {
        try { fn(State); } catch (e) { console.error(e); }
      });
    },

    saveLocal: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: State.tasks }));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(State.settings));
      } catch (e) {}
    },

    // Acciones CRUD
    find: function (id) {
      for (var i = 0; i < State.tasks.length; i++) {
        if (State.tasks[i].id === id) return State.tasks[i];
      }
      return null;
    },

    addTask: function (text, date, time, highlight, warn) {
      if (typeof text !== 'string' || !text.trim()) return null;
      var t = {
        id: uid(),
        text: text.trim(),
        date: date || null,
        time: time || null,
        done: false,
        doneOn: null,
        highlight: (highlight === 'star' || highlight === 'danger' || highlight === 'purple') ? highlight : 'none',
        warn: !!warn,
        warnedAt: null,
        example: false
      };
      State.tasks.push(t);
      State.notify();
      return t;
    },

    updateTask: function (id, fields) {
      var t = State.find(id);
      if (!t) return false;
      if (fields.text != null && String(fields.text).trim()) t.text = String(fields.text).trim();
      var oldDeadline = (t.date || '') + ' ' + (t.time || '');
      if (fields.date !== undefined) t.date = fields.date || null;
      if (fields.time !== undefined) t.time = fields.time || null;
      // Si cambia el plazo, el aviso debe poder volver a sonar con la nueva fecha/hora
      if ((t.date || '') + ' ' + (t.time || '') !== oldDeadline) t.warnedAt = null;
      if (fields.highlight !== undefined) t.highlight = fields.highlight;
      if (fields.warn !== undefined) t.warn = !!fields.warn;
      State.notify();
      return true;
    },

    toggleDone: function (id) {
      var t = State.find(id);
      if (!t) return null;
      t.done = !t.done;
      t.doneOn = t.done ? today() : null;
      State.notify();
      return t;
    },

    // Marca como hecha sin invertir el estado (para botones "Completar" de avisos)
    completeTask: function (id) {
      var t = State.find(id);
      if (!t) return null;
      if (!t.done) {
        t.done = true;
        t.doneOn = today();
        State.notify();
      }
      return t;
    },

    toggleHighlight: function (id) {
      var t = State.find(id);
      if (!t) return;
      var cycle = { none: 'star', star: 'danger', danger: 'purple', purple: 'none' };
      t.highlight = cycle[t.highlight || 'none'] || 'star';
      State.notify();
    },

    toggleWarn: function (id) {
      var t = State.find(id);
      if (!t) return;
      t.warn = !t.warn;
      State.notify();
    },

    removeTask: function (id) {
      State.tasks = State.tasks.filter(function (t) { return t.id !== id; });
      State.notify();
    },

    snoozeTask: function (id, hours) {
      var t = State.find(id);
      if (!t) return;
      var now = new Date();
      now.setHours(now.getHours() + (hours || 1));
      t.date = ymd(now);
      t.time = pad(now.getHours()) + ':' + pad(now.getMinutes());
      t.warnedAt = Date.now(); // Resetea la alerta
      State.notify();
    },

    clearExamples: function () {
      State.tasks = State.tasks.filter(function (t) { return !t.example; });
      State.notify();
    },

    // Métricas y Racha
    getStreak: function () {
      var td = today();
      var seen = {};
      State.tasks.forEach(function (t) {
        if (t.done && t.doneOn) seen[t.doneOn] = true;
      });
      var current = seen[td] ? td : addDays(td, -1);
      var count = 0;
      while (seen[current]) {
        count++;
        current = addDays(current, -1);
      }
      return count;
    },

    isOverdue: function (t) {
      return isOverdue(t, today(), currentTimeStr());
    },

    // Todas las tareas pendientes con aviso activo (vencidas primero)
    getUncompletedWarnings: function () {
      var td = today();
      var curTime = currentTimeStr();
      return State.tasks.filter(function (t) {
        return !t.done && t.warn;
      }).sort(function (a, b) {
        var la = isOverdue(a, td, curTime) ? 0 : 1;
        var lb = isOverdue(b, td, curTime) ? 0 : 1;
        if (la !== lb) return la - lb;
        var da = (a.date || '9999-99-99') + ' ' + (a.time || '99:99');
        var db = (b.date || '9999-99-99') + ' ' + (b.time || '99:99');
        return da < db ? -1 : da > db ? 1 : 0;
      });
    },

    // Solo las que ya han incumplido su plazo (las que generan alerta)
    getOverdueWarnings: function () {
      var td = today();
      var curTime = currentTimeStr();
      return State.tasks.filter(function (t) {
        return t.warn && isOverdue(t, td, curTime);
      });
    },

    getMetrics: function () {
      var total = State.tasks.length;
      var completed = State.tasks.filter(function (t) { return t.done; }).length;
      var pending = total - completed;
      var rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      var streak = State.getStreak();
      var warningsCount = State.getUncompletedWarnings().length;
      return { total: total, completed: completed, pending: pending, rate: rate, streak: streak, warningsCount: warningsCount };
    },

    get7DayActivity: function () {
      var days = [];
      var td = today();
      for (var i = 6; i >= 0; i--) {
        var dayDate = addDays(td, -i);
        var dateObj = parse(dayDate);
        var label = new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(dateObj);
        var count = State.tasks.filter(function (t) { return t.done && t.doneOn === dayDate; }).length;
        days.push({ date: dayDate, label: label.replace('.', ''), count: count, isToday: dayDate === td });
      }
      return days;
    },

    // Backup e Importación
    exportJSON: function () {
      return JSON.stringify({
        app: 'Whider Pro',
        version: '2.2',
        exportedAt: new Date().toISOString(),
        tasks: State.tasks
      }, null, 2);
    },

    importJSON: function (jsonString) {
      try {
        var data = JSON.parse(jsonString);
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : null);
        if (list) {
          State.tasks = cleanTasks(list);
          State.notify();
          return true;
        }
      } catch (e) {}
      return false;
    },

    resetAll: function () {
      State.tasks = [];
      State.notify();
    }
  };

  // Sincroniza los cambios hechos en otra pestaña/ventana de la app
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) {
      var fresh = loadLocalTasks();
      if (fresh) {
        State.tasks = fresh;
        subscribers.forEach(function (fn) {
          try { fn(State); } catch (err) { console.error(err); }
        });
      }
    } else if (e.key === SETTINGS_KEY) {
      State.settings = loadLocalSettings();
    }
  });

  Whider.State = State;
})();
