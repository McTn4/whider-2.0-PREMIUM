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
        warnedAt: item.warnedAt || null,
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
      if (raw) return Object.assign(def, JSON.parse(raw));
    } catch (e) {}
    return def;
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
      var t = {
        id: uid(),
        text: text.trim(),
        date: date || null,
        time: time || null,
        done: false,
        doneOn: null,
        highlight: highlight || 'none',
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
      if (fields.text != null) t.text = fields.text.trim();
      if (fields.date !== undefined) t.date = fields.date || null;
      if (fields.time !== undefined) t.time = fields.time || null;
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

    getUncompletedWarnings: function () {
      var td = today();
      var curTime = currentTimeStr();
      return State.tasks.filter(function (t) {
        if (t.done || !t.warn) return false;
        if (t.date && t.date < td) return true;
        if (t.date === td && t.time && t.time <= curTime) return true;
        return true; // Cualquier tarea con aviso activo pendiente
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
        version: '2.0',
        exportedAt: new Date().toISOString(),
        tasks: State.tasks
      }, null, 2);
    },

    importJSON: function (jsonString) {
      try {
        var data = JSON.parse(jsonString);
        if (data && Array.isArray(data.tasks)) {
          State.tasks = cleanTasks(data.tasks);
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

  Whider.State = State;
})();
