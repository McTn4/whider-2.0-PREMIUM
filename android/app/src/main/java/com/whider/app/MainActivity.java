package com.whider.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;

public class MainActivity extends AppCompatActivity {

    static final String EXTRA_OPEN_SCREEN = "open_screen";
    static volatile boolean isForeground = false;

    private static final String APP_URL = "file:///android_asset/www/index.html";
    private static final String PREFS = "whider_native";
    private static final String PREF_ASKED_NOTIF = "asked_notifications";
    private static final int REQ_NOTIFICATIONS = 4021;

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannel(this);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF05060A);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // La app tiene su propio ajuste de tamaño de texto: el tamaño de fuente del
        // sistema no debe descuadrar el diseño, que ya se adapta a la pantalla.
        settings.setTextZoom(100);

        webView.addJavascriptInterface(new WhiderBridge(), "WhiderAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternally(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        // Atrás: la web cierra hojas/presentación o vuelve a la pantalla inicial; si no, se sale
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView == null) { finish(); return; }
                webView.evaluateJavascript(
                        "(function(){try{return !!(window.Whider&&Whider.App&&Whider.App.handleBack());}catch(e){return false;}})()",
                        value -> { if (!"true".equals(value)) finish(); });
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(APP_URL);
        handleLaunchIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        isForeground = true;
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        isForeground = false;
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunchIntent(intent);
    }

    /** Abrir una pantalla concreta al pulsar una notificación */
    private void handleLaunchIntent(Intent intent) {
        if (intent == null || webView == null) return;
        String screen = intent.getStringExtra(EXTRA_OPEN_SCREEN);
        if (screen == null || !screen.matches("[a-z]+")) return;
        intent.removeExtra(EXTRA_OPEN_SCREEN);
        webView.postDelayed(() -> webView.evaluateJavascript(
                "window.Whider&&Whider.Router&&Whider.Router.go('" + screen + "');", null), 450);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("WhiderAndroid");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private boolean openExternally(Uri uri) {
        if (uri == null || "file".equals(uri.getScheme())) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Sin aplicación capaz de abrir el enlace
        }
        return true;
    }

    private String notificationPermissionState() {
        if (Notifier.canPost(this)) return "granted";
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            boolean asked = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_ASKED_NOTIF, false);
            return asked ? "denied" : "default";
        }
        return NotificationManagerCompat.from(this).areNotificationsEnabled() ? "granted" : "denied";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_NOTIFICATIONS || webView == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        webView.evaluateJavascript(
                "window.Whider&&Whider.Notify&&Whider.Notify.onNativePermissionResult(" + granted + ");", null);
    }

    private void vibratePattern(long[] pattern) {
        Vibrator v;
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            v = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (v == null || !v.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) {
            if (pattern.length == 1) v.vibrate(VibrationEffect.createOneShot(pattern[0], VibrationEffect.DEFAULT_AMPLITUDE));
            else v.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            v.vibrate(pattern, -1);
        }
    }

    /** Puente expuesto a JavaScript como window.WhiderAndroid */
    private class WhiderBridge {

        @JavascriptInterface
        public String getNotificationPermission() {
            return notificationPermissionState();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> {
                String state = notificationPermissionState();
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(state)) {
                    SharedPreferences.Editor e = getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
                    e.putBoolean(PREF_ASKED_NOTIF, true).apply();
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
                } else if (!"granted".equals(state)) {
                    // Denegado de forma permanente: abrir los ajustes de notificaciones de la app
                    Intent intent = new Intent();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.fromParts("package", getPackageName(), null));
                    }
                    try { startActivity(intent); } catch (ActivityNotFoundException ignored) { }
                } else if (webView != null) {
                    webView.evaluateJavascript(
                            "window.Whider&&Whider.Notify&&Whider.Notify.onNativePermissionResult(true);", null);
                }
            });
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String tag) {
            Notifier.show(MainActivity.this, tag, title, body, true);
        }

        /** Recordatorios programados para cuando la app está cerrada */
        @JavascriptInterface
        public void syncReminders(String json) {
            ReminderReceiver.schedule(getApplicationContext(), json);
        }

        /** Vibración nativa: patrón JSON en milisegundos, p. ej. [20,40,20] */
        @JavascriptInterface
        public void vibrate(String json) {
            try {
                JSONArray arr = new JSONArray(json);
                if (arr.length() == 0) return;
                long[] pattern;
                if (arr.length() == 1) {
                    pattern = new long[]{Math.min(1000, Math.max(1, arr.getLong(0)))};
                } else {
                    // Formato web [vibra, pausa, vibra…] → formato Android [espera, vibra, pausa…]
                    pattern = new long[arr.length() + 1];
                    pattern[0] = 0;
                    for (int i = 0; i < arr.length(); i++) pattern[i + 1] = Math.min(1000, Math.max(0, arr.getLong(i)));
                }
                runOnUiThread(() -> vibratePattern(pattern));
            } catch (Exception ignored) {
                // Patrón no válido
            }
        }
    }
}
