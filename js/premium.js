/* WHIDER PRO 2.2 — navegación, perfil local y paneles de rendimiento */
window.Whider = window.Whider || {};
(function () {
  'use strict';
  var PROFILE_KEY = 'whider.profile.v1';
  function byId(id) { return document.getElementById(id); }
  function readProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
    renderProfile();
  }
  function initials(name) { return (name || 'W').trim().charAt(0).toUpperCase(); }
  function renderProfile() {
    var p = readProfile() || { name: 'Usuario WHIDER', email: 'Perfil local · Este dispositivo' };
    var name = p.name || 'Usuario WHIDER', email = p.email || 'Perfil local';
    [['profileName', name], ['profileEmail', email], ['drawerName', name], ['drawerEmail', email],
     ['profileAvatar', initials(name)], ['headerAvatar', initials(name)], ['drawerAvatar', initials(name)]]
      .forEach(function (pair) { var node = byId(pair[0]); if (node) node.textContent = pair[1]; });
    var f = byId('accountName'), em = byId('accountEmail');
    if (f && document.activeElement !== f) f.value = p.name === 'Usuario WHIDER' ? '' : p.name;
    if (em && document.activeElement !== em) em.value = p.email && p.email.indexOf('Perfil local') < 0 ? p.email : '';
  }
  function openDrawer(open) {
    var drawer = byId('appDrawer'), scrim = byId('drawerScrim'), trigger = byId('btnMenu');
    if (!drawer) return;
    drawer.classList.toggle('open', open);
    if (scrim) scrim.classList.toggle('visible', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (trigger) trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('drawer-open', open);
  }
  function openAccount() {
    renderProfile();
    var modal = byId('accountModal');
    if (modal) modal.style.display = 'flex';
    openDrawer(false);
  }
  function renderHome() {
    var tasks = Whider.State.tasks || [], today = Whider.State.today();
    var todays = tasks.filter(function (t) { return t.date === today; });
    var done = todays.filter(function (t) { return t.done; }).length;
    var pct = todays.length ? Math.round(done / todays.length * 100) : 0;
    var totalDone = tasks.filter(function (t) { return t.done; }).length;
    var pending = tasks.filter(function (t) { return !t.done; }).length;
    var streak = Whider.State.getStreak();
    function set(id, value) { var n = byId(id); if (n) n.textContent = value; }
    set('homeCompletion', pct + '%'); set('homeTaskCount', done + ' de ' + todays.length + ' tareas');
    set('homeStreak', streak + (streak === 1 ? ' DÍA DE RACHA' : ' DÍAS DE RACHA'));
    set('homeDone', totalDone); set('homePending', pending); set('homeStreakSmall', streak);
    var fill = byId('homeProgressFill'); if (fill) fill.style.width = pct + '%';
    var greeting = byId('homeGreeting'), profile = readProfile();
    if (greeting) greeting.textContent = profile && profile.name ? 'Bienvenido de nuevo, ' + profile.name.split(' ')[0] + '. Tu siguiente avance empieza aquí.' : 'Cada acción cuenta. Empieza ahora.';
    var list = byId('homePriorityList');
    if (list) {
      list.textContent = '';
      var priorities = tasks.filter(function (t) { return !t.done; }).sort(function (a, b) {
        var rank = { danger: 0, star: 1, purple: 2, none: 3 };
        return (rank[a.highlight || 'none'] - rank[b.highlight || 'none']) || ((a.date || '9999') > (b.date || '9999') ? 1 : -1);
      }).slice(0, 3);
      if (!priorities.length) {
        var empty = document.createElement('div'); empty.className = 'home-empty'; empty.textContent = 'Todo despejado. Añade una tarea y empieza a avanzar.'; list.appendChild(empty);
      } else priorities.forEach(function (t) {
        var row = document.createElement('button'); row.className = 'home-priority-row'; row.type = 'button';
        var dot = document.createElement('i'); dot.className = 'priority-dot ' + (t.highlight || 'none');
        var title = document.createElement('span'); title.textContent = t.text;
        var arrow = document.createElement('b'); arrow.textContent = '↗';
        row.append(dot, title, arrow); row.addEventListener('click', function () { Whider.Router.navigate('tasks'); });
        list.appendChild(row);
      });
    }
    renderProfile();
  }
  function renderRecords() {
    var tasks = Whider.State.tasks || [];
    var done = tasks.filter(function (t) { return t.done; }).length;
    var streak = Whider.State.getStreak();
    var completedDays = {};
    tasks.forEach(function (t) { if (t.done && t.doneOn) completedDays[t.doneOn] = true; });
    var dayKeys = Object.keys(completedDays).sort(), bestStreak = 0, run = 0, previous = null;
    dayKeys.forEach(function (day) {
      run = previous && Whider.State.addDays(previous, 1) === day ? run + 1 : 1;
      if (run > bestStreak) bestStreak = run;
      previous = day;
    });
    [['recordStreak', bestStreak + (bestStreak === 1 ? ' día' : ' días')], ['recordCompleted', done], ['recordTotal', tasks.length]]
      .forEach(function (pair) { var n = byId(pair[0]); if (n) n.textContent = pair[1]; });
  }
  function init() {
    var bind = function (id, fn) { var n = byId(id); if (n) n.addEventListener('click', fn); };
    bind('btnMenu', function () { openDrawer(true); });
    bind('btnBottomMenu', function () { openDrawer(true); });
    bind('btnCloseMenu', function () { openDrawer(false); });
    bind('drawerScrim', function () { openDrawer(false); });
    bind('btnAccount', openAccount); bind('drawerAccount', openAccount); bind('btnEditProfile', openAccount);
    bind('btnCloseAccount', function () { var n = byId('accountModal'); if (n) n.style.display = 'none'; });
    document.querySelectorAll('[data-screen]:not(.nav-tab)').forEach(function (node) {
      node.addEventListener('click', function () {
        var target = node.getAttribute('data-screen');
        if (target && Whider.Router) { Whider.Router.navigate(target); openDrawer(false); }
      });
    });
    var form = byId('accountForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (byId('accountName').value || '').trim();
      var email = (byId('accountEmail').value || '').trim();
      if (!name || !email) return;
      saveProfile({ name: name, email: email, updatedAt: new Date().toISOString() });
      var modal = byId('accountModal'); if (modal) modal.style.display = 'none';
      if (Whider.Toast && Whider.Toast.show) Whider.Toast.show('Perfil actualizado');
      else if (Whider.Components && Whider.Components.Toast) Whider.Components.Toast.show('Perfil actualizado');
    });
    var accountModal = byId('accountModal');
    if (accountModal) accountModal.addEventListener('click', function (e) { if (e.target === accountModal) accountModal.style.display = 'none'; });
    renderProfile();
  }
  Whider.Premium = { renderHome: renderHome, renderRecords: renderRecords, renderProfile: renderProfile };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
