// Datos de ejemplo para las pruebas (120 días de actividad), se inyectan antes de cargar la app
module.exports = function seedScript() {
  return function () {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var now = new Date(), tasks = [], log = {}, focus = {}, lists = ['personal', 'work', 'health'], prios = ['none', 'none', 'star', 'purple', 'danger'];
    var seed = 7; var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 120; i >= 1; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i), ds = ymd(d), wd = d.getDay();
      var n = Math.round(rnd() * (wd === 0 || wd === 6 ? 2 : 6));
      for (var k = 0; k < n; k++) {
        var h = 8 + Math.floor(rnd() * 12), at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, Math.floor(rnd() * 60)).getTime();
        tasks.push({ id: 'seed' + i + '_' + k, text: ['Revisar presupuesto', 'Llamar a cliente', 'Entrenar', 'Leer capítulo', 'Preparar reunión', 'Enviar factura', 'Ordenar escritorio'][Math.floor(rnd() * 7)],
          date: ds, time: rnd() > .5 ? pad(h + (rnd() > .3 ? 1 : -1)) + ':00' : null, done: true, doneOn: ds, doneAt: at, highlight: prios[Math.floor(rnd() * 5)],
          listId: lists[Math.floor(rnd() * 3)], createdAt: at - 86400000, updatedAt: at, mine: true, subtasks: [] });
      }
      if (n) log[ds] = n;
      if (rnd() > .45) focus[ds] = { min: 25 * (1 + Math.floor(rnd() * 3)), sessions: 1 + Math.floor(rnd() * 3) };
    }
    var t0 = ymd(now);
    tasks.push({ id: 'p1', text: 'Presentación trimestral', date: t0, time: '17:00', done: false, highlight: 'danger', listId: 'work', createdAt: Date.now(), updatedAt: Date.now(), mine: true, subtasks: [] });
    tasks.push({ id: 'p2', text: 'Pagar el seguro', date: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2)), done: false, highlight: 'purple', listId: 'personal', createdAt: Date.now(), updatedAt: Date.now(), mine: true, subtasks: [] });
    localStorage.setItem('whider.v1', JSON.stringify({ tasks: tasks }));
    localStorage.setItem('whider.donelog.v1', JSON.stringify(log));
    localStorage.setItem('whider.focus.v1', JSON.stringify(focus));
    var hlog = {}, created = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60).getTime();
    hlog.h1 = {}; hlog.h2 = {};
    for (var j = 60; j >= 1; j--) { var dd = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - j)); if (rnd() > .25) hlog.h1[dd] = { n: 8, at: 1 }; if (rnd() > .55) hlog.h2[dd] = { n: 1, at: 1 }; }
    localStorage.setItem('whider.habits.v1', JSON.stringify({ habits: [
      { id: 'h1', name: 'Beber agua', icon: 'coffee', freq: 'daily', target: 8, unit: 'vasos', createdAt: created, updatedAt: created, order: 0 },
      { id: 'h2', name: 'Leer 20 minutos', icon: 'book', freq: 'daily', target: 1, createdAt: created, updatedAt: created, order: 1 }], log: hlog }));
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: created, seenAchievements: [], levelSeen: 99 }));
  };
};
