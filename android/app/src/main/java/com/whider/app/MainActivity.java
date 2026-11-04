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
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.webkit.WebViewAssetLoader;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.Locale;

import java.util.concurrent.Executor;

public class MainActivity extends AppCompatActivity {

    static final String EXTRA_OPEN_SCREEN = "open_screen";
    static volatile boolean isForeground = false;

    /*
     * La app se sirve desde un origen HTTPS local (WebViewAssetLoader). Así funcionan
     * IndexedDB, las cuentas (Firebase) y la copia sin conexión de forma fiable.
     * Las versiones anteriores usaban file://; la primera vez se migran sus datos.
     */
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + ASSET_HOST + "/assets/www/index.html";
    private static final String LEGACY_URL = "file:///android_asset/www/index.html";
    private static final String PREFS = "whider_native";
    private static final String STORE = "whider_store";
    private static final String PREF_MIGRATED = "migrated_file_origin";
    private static final String PREF_ASKED_NOTIF = "asked_notifications";
    private static final int REQ_NOTIFICATIONS = 4021;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private CredentialManager credentialManager;
    private ValueCallback<Uri[]> pendingFileCallback;
    private ActivityResultLauncher<PickVisualMediaRequest> photoPicker;
    private ActivityResultLauncher<Intent> filePicker;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannel(this);

        // Selector de fotos del sistema (sin permisos) para la foto de perfil
        photoPicker = registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
            if (pendingFileCallback == null) return;
            pendingFileCallback.onReceiveValue(uri != null ? new Uri[]{uri} : null);
            pendingFileCallback = null;
        });
        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (pendingFileCallback == null) return;
            pendingFileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData()));
            pendingFileCallback = null;
        });

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF050505);
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

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(ASSET_HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        credentialManager = CredentialManager.create(this);

        webView.addJavascriptInterface(new WhiderBridge(), "WhiderAndroid");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternally(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                boolean images = false;
                for (String type : params.getAcceptTypes()) {
                    if (type != null && type.startsWith("image")) images = true;
                }
                try {
                    if (images) {
                        photoPicker.launch(new PickVisualMediaRequest.Builder()
                                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                                .build());
                    } else {
                        filePicker.launch(params.createIntent());
                    }
                    return true;
                } catch (Exception e) {
                    pendingFileCallback = null;
                    return false;
                }
            }
        });

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

        boolean migrated = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_MIGRATED, false);
        if (!migrated) webView.loadUrl(LEGACY_URL);          // Copia los datos de la versión anterior y vuelve
        else if (savedInstanceState != null) webView.restoreState(savedInstanceState);
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
        if (ASSET_HOST.equals(uri.getHost())) return false;
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

    private void sendGoogleResult(String idToken, String kind, String detail) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String js = "window.Whider&&Whider.Auth&&Whider.Auth.onNativeGoogle("
                    + (idToken == null ? "null" : JSONObject.quote(idToken)) + ","
                    + (kind == null ? "null" : JSONObject.quote(kind)) + ","
                    + (detail == null ? "null" : JSONObject.quote(detail)) + ");";
            webView.evaluateJavascript(js, null);
        });
    }

    /**
     * Android informa algunos errores de configuración (huella SHA-1 o paquete no registrados:
     * "[16] Account reauth failed", "[10] Developer console is not set up correctly") como si
     * el usuario hubiera cancelado. Se distinguen para poder explicarlos en la app.
     */
    private static String classifyGoogleError(GetCredentialException e) {
        String msg = String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT);
        if (e instanceof NoCredentialException) return "no-account";
        if (msg.contains("[16]") || msg.contains("reauth") || msg.contains("[10]") || msg.contains("developer")
                || msg.contains("not set up") || msg.contains("[28444]")) return "config";
        if (e instanceof GetCredentialCancellationException) return "cancelled";
        return "unavailable";
    }

    /** Inicio de sesión con Google con el selector nativo de cuentas (Credential Manager) */
    private void startGoogleSignIn(String webClientId) {
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        Executor executor = ContextCompat.getMainExecutor(this);
        credentialManager.getCredentialAsync(this, request, null, executor,
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        Credential credential = response.getCredential();
                        if (credential instanceof CustomCredential
                                && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            try {
                                GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                                sendGoogleResult(google.getIdToken(), null, null);
                            } catch (Exception e) {
                                sendGoogleResult(null, "unavailable", "Token no válido: " + e.getMessage());
                            }
                        } else {
                            sendGoogleResult(null, "unavailable", "Credencial inesperada: " + credential.getType());
                        }
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        sendGoogleResult(null, classifyGoogleError(e), e.getClass().getSimpleName() + ": " + e.getMessage());
                    }
                });
    }

    /** Puente expuesto a JavaScript como window.WhiderAndroid */
    private class WhiderBridge {

        /* ----- Almacén nativo: espejo de los datos para que nunca se pierdan ----- */
        @JavascriptInterface
        public String storeGet(String key) {
            return getSharedPreferences(STORE, Context.MODE_PRIVATE).getString(key, null);
        }

        @JavascriptInterface
        public void storeSet(String key, String value) {
            SharedPreferences.Editor e = getSharedPreferences(STORE, Context.MODE_PRIVATE).edit();
            if (value == null) e.remove(key); else e.putString(key, value);
            e.apply();
        }

        /** Varios cambios de una vez, sin bloquear (Android los escribe en disco en segundo plano) */
        @JavascriptInterface
        public void storeSetMany(String json) {
            try {
                JSONObject batch = new JSONObject(json);
                SharedPreferences.Editor e = getSharedPreferences(STORE, Context.MODE_PRIVATE).edit();
                Iterator<String> keys = batch.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    if (batch.isNull(k)) e.remove(k); else e.putString(k, batch.getString(k));
                }
                e.apply();
            } catch (Exception ignored) {
                // Lote no válido: se ignora (los datos siguen en el almacenamiento web)
            }
        }

        /* ----- Migración desde la versión anterior (origen file://) ----- */
        @JavascriptInterface
        public boolean migrationPending() {
            return !getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(PREF_MIGRATED, false);
        }

        @JavascriptInterface
        public void migrationDone() {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(PREF_MIGRATED, true).commit();
            runOnUiThread(() -> { if (webView != null) webView.loadUrl(APP_URL); });
        }

        /* ----- Cuentas: Google ----- */
        @JavascriptInterface
        public void googleSignIn(String webClientId) {
            if (webClientId == null || webClientId.trim().isEmpty()) { sendGoogleResult(null, "client", null); return; }
            runOnUiThread(() -> startGoogleSignIn(webClientId.trim()));
        }

        @JavascriptInterface
        public void googleSignOut() {
            credentialManager.clearCredentialStateAsync(new ClearCredentialStateRequest(), null,
                    ContextCompat.getMainExecutor(MainActivity.this),
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override public void onResult(Void result) { }
                        @Override public void onError(ClearCredentialException e) { }
                    });
        }

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
