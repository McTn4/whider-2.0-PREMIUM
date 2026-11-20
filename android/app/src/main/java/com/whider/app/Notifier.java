package com.whider.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/** Canal y publicación de notificaciones de WHIDER (compartido por la actividad y los recordatorios). */
final class Notifier {

    static final String CHANNEL_ID = "whider_warnings";

    private Notifier() { }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        String name = Lang.str(ctx, R.string.channel_warnings), desc = Lang.str(ctx, R.string.channel_warnings_desc);
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) {
            // Ya creado: solo se le cambian el nombre y la descripción si cambió el idioma de la app
            if (!name.contentEquals(existing.getName()) || !desc.equals(existing.getDescription())) {
                existing.setName(name);
                existing.setDescription(desc);
                nm.createNotificationChannel(existing);
            }
            return;
        }
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(desc);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 70, 60, 70, 60, 140});
        nm.createNotificationChannel(channel);
    }

    static boolean canPost(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    static void show(Context ctx, String tag, String title, String body, boolean openAlerts) {
        ensureChannel(ctx);
        if (!canPost(ctx)) return;
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (openAlerts) open.putExtra(MainActivity.EXTRA_OPEN_SCREEN, "home");
        PendingIntent pi = PendingIntent.getActivity(ctx, tag == null ? 0 : tag.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_whider)
                .setColor(0xFFFFFFFF)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            NotificationManagerCompat.from(ctx).notify(tag != null ? tag : "whider", 1, builder.build());
        } catch (SecurityException ignored) {
            // Permiso retirado en este instante
        }
    }
}
