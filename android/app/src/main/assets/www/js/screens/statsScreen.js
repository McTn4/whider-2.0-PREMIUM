/**
 * WHIDER PRO - PANTALLA 4: RENDIMIENTO & ESTADÍSTICAS (SCREEN LOGIC)
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function () {
  'use strict';

  Whider.Screens.Stats = {
    init: function () {
      // Sin eventos interactivos específicos necesarios al inicio
    },

    render: function () {
      var metrics = Whider.State.getMetrics();

      // Métricas clave
      var elRate = document.getElementById('statCompletionRate');
      if (elRate) elRate.textContent = metrics.rate + '%';

      var elStreak = document.getElementById('statCurrentStreak');
      if (elStreak) elStreak.textContent = metrics.streak + (metrics.streak === 1 ? ' d' : ' d');

      var elCompleted = document.getElementById('statTotalCompleted');
      if (elCompleted) elCompleted.textContent = metrics.completed;

      var elPendingWarns = document.getElementById('statPendingWarns');
      if (elPendingWarns) elPendingWarns.textContent = metrics.warningsCount;

      // Gráfico de 7 Días
      var chartContainer = document.getElementById('stats7DayChart');
      if (chartContainer) {
        chartContainer.textContent = '';
        var activity = Whider.State.get7DayActivity();

        // Encontrar valor máximo para escalar barras
        var maxCount = 1;
        activity.forEach(function (d) {
          if (d.count > maxCount) maxCount = d.count;
        });

        activity.forEach(function (day) {
          var col = document.createElement('div');
          col.className = 'bar-column';

          var countLabel = document.createElement('span');
          countLabel.className = 'bar-count';
          countLabel.textContent = day.count > 0 ? String(day.count) : '-';
          col.appendChild(countLabel);

          var pillarWrap = document.createElement('div');
          pillarWrap.className = 'bar-pillar-wrap';

          var pillar = document.createElement('div');
          pillar.className = 'bar-pillar' + (day.isToday ? ' today' : '');
          var heightPct = day.count > 0 ? Math.round((day.count / maxCount) * 85) + 15 : 6;
          pillar.style.height = heightPct + '%';
          pillarWrap.appendChild(pillar);
          col.appendChild(pillarWrap);

          var dayLabel = document.createElement('span');
          dayLabel.className = 'bar-label';
          dayLabel.textContent = day.label;
          col.appendChild(dayLabel);

          chartContainer.appendChild(col);
        });
      }

      // Desglose de Prioridades
      var tasks = Whider.State.tasks;
      var starCount = tasks.filter(function (t) { return t.highlight === 'star'; }).length;
      var dangerCount = tasks.filter(function (t) { return t.highlight === 'danger'; }).length;
      var purpleCount = tasks.filter(function (t) { return t.highlight === 'purple'; }).length;
      var warnTotal = tasks.filter(function (t) { return t.warn; }).length;

      var elStars = document.getElementById('breakdownStars');
      if (elStars) elStars.textContent = starCount;

      var elUrgent = document.getElementById('breakdownUrgent');
      if (elUrgent) elUrgent.textContent = dangerCount;

      var elPurple = document.getElementById('breakdownPurple');
      if (elPurple) elPurple.textContent = purpleCount;

      var elWarns = document.getElementById('breakdownWarns');
      if (elWarns) elWarns.textContent = warnTotal;
    }
  };
})();
