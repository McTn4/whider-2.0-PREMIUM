package com.whider.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends AppCompatActivity {

    private static final String APP_URL = "file:///android_asset/www/index.html";
    private static final String CHANNEL_ID = "whider_warnings";
    private static final String PREFS = "whider_native";
    private static final String PREF_ASKED_NOTIF = "asked_notifications";
    private static final int REQ_NOTIFICATIONS = 4021;

    private WebView webView;
    private ValueCallback<Uri[]> pendingFileCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        createNotificationChannel();

        // Selector de archivos para <input type="file"> (Importar JSON)
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (pendingFileCallback == null) return;
                    Uri[] uris = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
                    pendingFileCallback.onReceiveValue(uris);
                    pendingFileCallback = null;
                });

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF05070D);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new WhiderBridge(), "WhiderAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternally(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = filePathCallback;
                Intent intent;
                try {
                    intent = fileChooserParams.createIntent();
                } catch (Exception e) {
                    intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                }
                try {
                    fileChooserLauncher.launch(intent);
                } catch (ActivityNotFoundException e) {
                    pendingFileCallback.onReceiveValue(null);
                    pendingFileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // Botón atrás: la web cierra modales/menú o vuelve a Inicio; si no gestiona nada, se sale
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(
                        "(function(){try{return !!(window.Whider&&Whider.App&&Whider.App.handleBack());}catch(e){return false;}})()",
                        value -> {
                            if (!"true".equals(value)) finish();
                        });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL);
        }
        handleLaunchIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunchIntent(intent);
    }

    // Al abrir la app desde una notificación de aviso, mostrar la pantalla de avisos
    private void handleLaunchIntent(Intent intent) {
        if (intent == null || webView == null || !intent.getBooleanExtra("open_warnings", false)) return;
        intent.removeExtra("open_warnings");
        webView.postDelayed(() -> webView.evaluateJavascript(
                "window.Whider&&Whider.Router&&Whider.Router.navigate('warnings');", null), 400);
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
        if (uri == null) return false;
        String scheme = uri.getScheme();
        // Los archivos de la propia app se cargan dentro del WebView
        if ("file".equals(scheme)) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            // Sin aplicación para abrir el enlace
        }
        return true;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, getString(R.string.channel_warnings), NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(getString(R.string.channel_warnings_desc));
        channel.enableVibration(true);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private String notificationPermissionState() {
        if (!NotificationManagerCompat.from(this).areNotificationsEnabled()) {
            if (Build.VERSION.SDK_INT >= 33) {
                boolean granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED;
                if (!granted) {
                    boolean asked = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_ASKED_NOTIF, false);
                    return asked ? "denied" : "default";
                }
            }
            return "denied";
        }
        return "granted";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_NOTIFICATIONS || webView == null) return;
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        webView.evaluateJavascript(
                "window.Whider&&Whider.Notifications&&Whider.Notifications.onNativePermissionResult(" + granted + ");", null);
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
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(notificationPermissionState())) {
                    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(PREF_ASKED_NOTIF, true).apply();
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFICATIONS);
                } else if (!"granted".equals(notificationPermissionState())) {
                    // Permiso denegado de forma permanente: abrir los ajustes de notificaciones de la app
                    Intent intent = new Intent();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                        intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                    } else {
                        intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.fromParts("package", getPackageName(), null));
                    }
                    try {
                        startActivity(intent);
                    } catch (ActivityNotFoundException ignored) {
                    }
                } else if (webView != null) {
                    webView.evaluateJavascript(
                            "window.Whider&&Whider.Notifications&&Whider.Notifications.onNativePermissionResult(true);", null);
                }
            });
        }

        @JavascriptInterface
        public void showNotification(String title, String body, String tag) {
            if (!"granted".equals(notificationPermissionState())) return;
            Intent open = new Intent(MainActivity.this, MainActivity.class);
            open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            open.putExtra("open_warnings", true);
            PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(MainActivity.this, CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_whider)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setAutoCancel(true)
                    .setContentIntent(pi);
            if (Build.VERSION.SDK_INT >= 33 && ActivityCompat.checkSelfPermission(MainActivity.this,
                    Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            try {
                NotificationManagerCompat.from(MainActivity.this)
                        .notify(tag != null ? tag : "whider", 1, builder.build());
            } catch (SecurityException ignored) {
                // Permiso retirado mientras la app estaba abierta
            }
        }

        /** Guarda un archivo de texto (copia de seguridad JSON) en la carpeta Descargas. */
        @JavascriptInterface
        public boolean saveFile(String fileName, String content) {
            String safeName = fileName == null ? "whider-backup.json" : fileName.replaceAll("[^A-Za-z0-9._-]", "_");
            byte[] data = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) return false;
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out == null) return false;
                        out.write(data);
                    }
                    return true;
                } else {
                    // Android 7–9: carpeta Descargas privada de la app (no requiere permisos)
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    if (!dir.exists() && !dir.mkdirs()) return false;
                    try (FileOutputStream out = new FileOutputStream(new File(dir, safeName))) {
                        out.write(data);
                    }
                    return true;
                }
            } catch (Exception e) {
                return false;
            }
        }
    }
}
