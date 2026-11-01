package com.whider.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Recordatorios con la app cerrada: programa alarmas del sistema para cada aviso
 * que calcula la web (window.WhiderAndroid.syncReminders) y las restaura tras reiniciar.
 */
public class ReminderReceiver extends BroadcastReceiver {

    static final String ACTION_FIRE = "com.whider.app.REMINDER";
    private static final String PREFS = "whider_reminders";
    private static final String KEY_LIST = "list";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            String saved = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_LIST, "[]");
            schedule(ctx, saved);
            return;
        }
        if (!ACTION_FIRE.equals(action)) return;
        // Con la app en primer plano, el motor web ya muestra el aviso dentro de la app
        if (MainActivity.isForeground) return;
        String key = intent.getStringExtra("key");
        Notifier.show(ctx, "whider-" + key, intent.getStringExtra("title"), intent.getStringExtra("body"), true);
    }

    private static PendingIntent pending(Context ctx, String key, String title, String body, boolean create) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_FIRE);
        i.putExtra("key", key);
        if (title != null) i.putExtra("title", title);
        if (body != null) i.putExtra("body", body);
        int flags = PendingIntent.FLAG_IMMUTABLE | (create ? PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_NO_CREATE);
        return PendingIntent.getBroadcast(ctx, key.hashCode(), i, flags);
    }

    /** Sustituye todas las alarmas programadas por la lista JSON [{key, at, title, body}] */
    static synchronized void schedule(Context ctx, String json) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        // 1. Cancelar las anteriores
        try {
            JSONArray old = new JSONArray(prefs.getString(KEY_LIST, "[]"));
            for (int i = 0; i < old.length(); i++) {
                PendingIntent pi = pending(ctx, old.getJSONObject(i).optString("key"), null, null, false);
                if (pi != null) { am.cancel(pi); pi.cancel(); }
            }
        } catch (Exception ignored) {
            // Lista guardada corrupta: se sobrescribe
        }

        // 2. Programar las nuevas (solo las futuras)
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        try {
            JSONArray list = new JSONArray(json == null ? "[]" : json);
            for (int i = 0; i < list.length() && i < 200; i++) {
                JSONObject o = list.getJSONObject(i);
                long at = o.optLong("at", 0);
                String key = o.optString("key", "");
                if (at <= now || key.isEmpty()) continue;
                PendingIntent pi = pending(ctx, key, o.optString("title"), o.optString("body"), true);
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                kept.put(o);
            }
        } catch (Exception ignored) {
            // JSON no válido: no se programa nada
        }
        prefs.edit().putString(KEY_LIST, kept.toString()).apply();
    }
}
