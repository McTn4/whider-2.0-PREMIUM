/* WHIDER PRO 2.2 — navegación, perfil local y paneles de rendimiento */
window.Whider = window.Whider || {};
(function () {
  'use strict';
  var PROFILE_KEY = 'whider.profile.v1';
  function byId(id) { return document.getElementById(id); }
  function readProfile() {
    try {
      var p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      return p && typeof p === 'object' ? p : null;
    } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
    renderProfile();
  }
  function initials(name) { return (name || 'W').trim().charAt(0).toUpperCase(); }
  function renderProfile() {
    var p = readProfile() || {};
    var hasProfile = !!(p.name && String(p.name).trim());
    var name = hasProfile ? String(p.name).trim() : 'Usuario WHIDER';
    var email = p.email ? String(p.email) : 'Perfil local · Este dispositivo';
    [['profileName', name], ['profileEmail', email], ['drawerName', name], ['drawerEmail', email],
     ['profileAvatar', initials(hasProfile ? name : 'W')], ['headerAvatar', initials(hasProfile ? name : 'W')], ['drawerAvatar', initials(hasProfile ? name : 'W')]]
      .forEach(function (pair) { var node = byId(pair[0]); if (node) node.textContent = pair[1]; });
    var f = byId('accountName'), em = byId('accountEmail');
    if (f && document.activeElement !== f) f.value = hasProfile ? name : '';
    if (em && document.activeElement !== em) em.value = p.email ? String(p.email) : '';
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
  function isDrawerOpen() {
    var drawer = byId('appDrawer');
    return !!drawer && drawer.classList.contains('open');
  }
  function closeAccount() {
    var modal = byId('accountModal');
    if (modal) modal.style.display = 'none';
  }
  function isAccountOpen() {
    var modal = byId('accountModal');
    return !!modal && modal.style.display !== 'none';
  }
  function openAccount() {
    renderProfile();
    var modal = byId('accountModal');
    if (modal) modal.style.display = 'flex';
    openDrawer(false);
    setTimeout(function () { var n = byId('accountName'); if (n) n.focus(); }, 60);
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
        var byRank = (rank[a.highlight] != null ? rank[a.highlight] : 3) - (rank[b.highlight] != null ? rank[b.highlight] : 3);
        if (byRank) return byRank;
        var da = (a.date || '9999-99-99') + ' ' + (a.time || '99:99');
        var db = (b.date || '9999-99-99') + ' ' + (b.time || '99:99');
        return da < db ? -1 : da > db ? 1 : 0;
      }).slice(0, 3);
      if (!priorities.length) {
        var empty = document.createElement('div'); empty.className = 'home-empty'; empty.textContent = 'Todo despejado. Añade una tarea y empieza a avanzar.'; list.appendChild(empty);
      } else priorities.forEach(function (t) {
        var row = document.createElement('button'); row.className = 'home-priority-row'; row.type = 'button';
        var dot = document.createElement('i'); dot.className = 'priority-dot ' + (t.highlight || 'none');
        var title = document.createElement('span'); title.textContent = t.text;
        var arrow = document.createElement('b'); arrow.textContent = '↗';
        row.appendChild(dot); row.appendChild(title); row.appendChild(arrow);
        row.addEventListener('click', function () {
          Whider.Router.navigate('tasks');
          if (Whider.Modal && Whider.State.find(t.id)) Whider.Modal.open(t.id);
        });
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
    bind('btnCloseAccount', closeAccount);
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
      closeAccount();
      if (Whider.Router && Whider.State.activeScreen === 'home') renderHome();
      if (Whider.Toast) Whider.Toast.show('Perfil actualizado', 'success');
    });
    var accountModal = byId('accountModal');
    if (accountModal) accountModal.addEventListener('click', function (e) { if (e.target === accountModal) closeAccount(); });
    renderProfile();
  }
  Whider.Premium = {
    renderHome: renderHome,
    renderRecords: renderRecords,
    renderProfile: renderProfile,
    openDrawer: function () { openDrawer(true); },
    closeDrawer: function () { openDrawer(false); },
    isDrawerOpen: isDrawerOpen,
    closeAccount: closeAccount,
    isAccountOpen: isAccountOpen
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
