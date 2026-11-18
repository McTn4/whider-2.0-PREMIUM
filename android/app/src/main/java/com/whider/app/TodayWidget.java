package com.whider.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget «Hoy»: las primeras tareas de hoy (lo más importante primero), cuántas llevas y un botón
 * para añadir. La web le manda la lista cada vez que cambia (window.WhiderAndroid.updateWidget) y se
 * guarda aquí, así se ve aunque la app esté cerrada.
 */
public class TodayWidget extends AppWidgetProvider {

    private static final String PREFS = "whider_widget";
    private static final String KEY = "today";
    private static final int[] ROWS = {R.id.w_row1, R.id.w_row2, R.id.w_row3, R.id.w_row4, R.id.w_row5};

    /** Guarda la lista que manda la web y repinta los widgets que haya en la pantalla de inicio */
    static void save(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json == null ? "{}" : json).apply();
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        if (m == null) return;
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, TodayWidget.class))) render(ctx, m, id);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) render(ctx, m, id);
    }

    private static PendingIntent open(Context ctx, String screen, int code) {
        Intent i = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra(MainActivity.EXTRA_OPEN_SCREEN, screen);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void render(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_today);
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "{}");
        int shown = 0, total = 0, done = 0;
        try {
            JSONObject o = new JSONObject(raw);
            JSONArray list = o.optJSONArray("tasks");
            total = o.optInt("total", 0);
            done = o.optInt("done", 0);
            for (int i = 0; i < ROWS.length; i++) {
                if (list != null && i < list.length()) {
                    JSONObject t = list.getJSONObject(i);
                    String time = t.optString("time", ""), prio = t.optString("prio", "");
                    String line = (prio.isEmpty() ? "" : prio + "  ") + (time.isEmpty() ? "" : time + "  ") + t.optString("text", "");
                    v.setTextViewText(ROWS[i], line);
                    v.setViewVisibility(ROWS[i], View.VISIBLE);
                    shown++;
                } else {
                    v.setViewVisibility(ROWS[i], View.GONE);
                }
            }
        } catch (Exception e) {
            for (int r : ROWS) v.setViewVisibility(r, View.GONE);
        }
        v.setTextViewText(R.id.w_count, total > 0 ? ctx.getString(R.string.widget_count, done, total) : "");
        v.setViewVisibility(R.id.w_empty, shown == 0 ? View.VISIBLE : View.GONE);
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "home", 1));
        v.setOnClickPendingIntent(R.id.w_add, open(ctx, "newtask", 2));
        m.updateAppWidget(id, v);
    }
}
