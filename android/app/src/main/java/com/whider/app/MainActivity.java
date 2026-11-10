package com.whider.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
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
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.widget.Toast;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
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
import androidx.core.content.FileProvider;
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

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Iterator;
import java.util.Locale;

import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

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
    private static final int REQ_CAMERA = 4022;
    /** Petición de cámara de la web (escáner de QR) esperando el permiso de Android */
    private PermissionRequest pendingCamera;
    /** Enlace de invitación que llegó al abrir la app (se entrega cuando la web está lista) */
    private String pendingLink;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private CredentialManager credentialManager;
    private ValueCallback<Uri[]> pendingFileCallback;
    private ActivityResultLauncher<PickVisualMediaRequest> photoPicker;
    private ActivityResultLauncher<PickVisualMediaRequest> photosPicker;
    private ActivityResultLauncher<Intent> filePicker;
    /** Guardar un adjunto donde elija el usuario (Android 9 o anterior, sin Descargas compartidas) */
    private ActivityResultLauncher<String> saveDocument;
    private byte[] pendingSave;
    private String pendingSaveMime = "application/octet-stream";
    /** Escribir archivos fuera del hilo de la interfaz y del de JavaScript */
    private final ExecutorService io = Executors.newSingleThreadExecutor();

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
        // Varias fotos a la vez para adjuntarlas en el Cuaderno
        photosPicker = registerForActivityResult(new ActivityResultContracts.PickMultipleVisualMedia(20), uris -> {
            if (pendingFileCallback == null) return;
            pendingFileCallback.onReceiveValue(uris != null && !uris.isEmpty() ? uris.toArray(new Uri[0]) : null);
            pendingFileCallback = null;
        });
        filePicker = registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
            if (pendingFileCallback == null) return;
            // Con varios archivos elegidos llegan en ClipData (parseResult solo lee el primero)
            Uri[] picked = null;
            Intent data = result.getData();
            if (result.getResultCode() == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    picked = new Uri[clip.getItemCount()];
                    for (int i = 0; i < clip.getItemCount(); i++) picked[i] = clip.getItemAt(i).getUri();
                } else if (data.getData() != null) {
                    picked = new Uri[]{data.getData()};
                }
            }
            pendingFileCallback.onReceiveValue(picked);
            pendingFileCallback = null;
        });
        saveDocument = registerForActivityResult(new ActivityResultContracts.CreateDocument("application/octet-stream") {
            @NonNull
            @Override
            public Intent createIntent(@NonNull Context context, @NonNull String input) {
                Intent i = super.createIntent(context, input);
                i.setType(pendingSaveMime);
                return i;
            }
        }, uri -> {
            final byte[] data = pendingSave;
            pendingSave = null;
            if (uri == null || data == null) return;
            io.execute(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("sin destino");
                    out.write(data);
                    runOnUiThread(() -> toast("Archivo guardado"));
                } catch (Exception e) {
                    runOnUiThread(() -> toast("No se pudo guardar el archivo"));
                }
            });
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
            /** Cámara para el escáner de códigos QR (solo para la propia app) */
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean video = false;
                    for (String r : request.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) video = true;
                    Uri origin = request.getOrigin();
                    if (!video || origin == null || !ASSET_HOST.equals(origin.getHost())) { request.deny(); return; }
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (pendingCamera != null) pendingCamera.deny();
                        pendingCamera = request;
                        ActivityCompat.requestPermissions(MainActivity.this, new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileCallback != null) pendingFileCallback.onReceiveValue(null);
                pendingFileCallback = callback;
                boolean images = false;
                for (String type : params.getAcceptTypes()) {
                    if (type != null && type.startsWith("image")) images = true;
                }
                boolean multiple = params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
                try {
                    if (images) {
                        PickVisualMediaRequest req = new PickVisualMediaRequest.Builder()
                                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                                .build();
                        if (multiple) photosPicker.launch(req); else photoPicker.launch(req);
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

    /** Abrir una pantalla concreta al pulsar una notificación, o una invitación (whider:// o enlace web) */
    private void handleLaunchIntent(Intent intent) {
        if (intent == null || webView == null) return;
        Uri data = intent.getData();
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && data != null) {
            String scheme = data.getScheme(), host = data.getHost(), path = data.getPath();
            boolean ours = "whider".equals(scheme) || ("https".equals(scheme) && "whider-red.vercel.app".equals(host) && path != null && path.startsWith("/i"));
            if (ours) { pendingLink = data.toString(); intent.setData(null); deliverPendingLink(0); }
        }
        String screen = intent.getStringExtra(EXTRA_OPEN_SCREEN);
        if (screen == null || !screen.matches("[a-z]+")) return;
        intent.removeExtra(EXTRA_OPEN_SCREEN);
        webView.postDelayed(() -> webView.evaluateJavascript(
                "window.Whider&&Whider.Router&&Whider.Router.go('" + screen + "');", null), 450);
    }

    /** Entrega la invitación a la web; si aún está cargando, lo vuelve a intentar */
    private void deliverPendingLink(int attempt) {
        if (pendingLink == null || webView == null || attempt > 20) return;
        final String link = pendingLink;
        webView.postDelayed(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("(function(){if(window.WhiderOpenLink&&window.Whider&&Whider.App){WhiderOpenLink(" + JSONObject.quote(link) + ");return true;}return false;})()",
                    value -> { if ("true".equals(value)) { if (link.equals(pendingLink)) pendingLink = null; } else deliverPendingLink(attempt + 1); });
        }, attempt == 0 ? 700 : 600);
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

    /* ----- Adjuntos del Cuaderno ----- */
    /** Nombre válido en cualquier sistema de archivos (sin rutas) */
    static String safeFileName(String name) {
        String n = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", " ").replaceAll("\\s+", " ").trim();
        if (n.isEmpty() || n.matches("\\.+")) n = "archivo";
        if (n.length() > 120) {
            int dot = n.lastIndexOf('.');
            String ext = dot > 0 && n.length() - dot <= 9 ? n.substring(dot) : "";
            n = n.substring(0, 120 - ext.length()).trim() + ext;
        }
        return n;
    }

    static String safeMime(String mime) {
        String m = mime == null ? "" : mime.toLowerCase(Locale.ROOT).trim();
        return m.matches("[a-z0-9.+-]+/[a-z0-9.+-]+") ? m : "application/octet-stream";
    }

    /** Las copias para abrir con otra app se borran pasado un día */
    private static void pruneAttachmentCache(File dir) {
        File[] old = dir.listFiles();
        if (old == null) return;
        long limit = System.currentTimeMillis() - 24L * 3600 * 1000;
        for (File f : old) if (f.isFile() && f.lastModified() < limit) //noinspection ResultOfMethodCallIgnored
            f.delete();
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
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
        if (requestCode == REQ_CAMERA) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingCamera != null) {
                if (ok) pendingCamera.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else pendingCamera.deny();
                pendingCamera = null;
            }
            return;
        }
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

        /** Compartir un texto (enlace de invitación) con el menú de Android */
        @JavascriptInterface
        public void shareText(String text) {
            if (text == null) return;
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, text);
                try { startActivity(Intent.createChooser(send, "Compartir invitación")); } catch (ActivityNotFoundException ignored) { }
            });
        }

        /** Abrir un enlace web en el navegador del sistema (p. ej. la página de pago de Stripe) */
        @JavascriptInterface
        public void openUrl(String url) {
            if (url == null) return;
            final Uri uri = Uri.parse(url);
            final String scheme = uri.getScheme();
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
            runOnUiThread(() -> openExternally(uri));
        }

        /** Abrir un adjunto del Cuaderno con otra aplicación (visor de PDF, Word, Excel…) */
        @JavascriptInterface
        public void openFile(String name, String mime, String base64) {
            if (base64 == null) return;
            final String fileName = safeFileName(name), type = safeMime(mime);
            io.execute(() -> {
                try {
                    File dir = new File(getCacheDir(), "adjuntos");
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("sin carpeta");
                    pruneAttachmentCache(dir);
                    File file = new File(dir, fileName);
                    try (FileOutputStream out = new FileOutputStream(file)) { out.write(Base64.decode(base64, Base64.DEFAULT)); }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", file);
                    runOnUiThread(() -> {
                        Intent view = new Intent(Intent.ACTION_VIEW);
                        view.setDataAndType(uri, type);
                        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        try { startActivity(Intent.createChooser(view, "Abrir «" + fileName + "» con")); }
                        catch (ActivityNotFoundException e) { toast("No hay ninguna aplicación para abrir este archivo"); }
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> toast("No se pudo abrir el archivo"));
                }
            });
        }

        /** Guardar un adjunto: en Descargas/WHIDER (Android 10 o posterior) o donde elijas (versiones anteriores) */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            if (base64 == null) return;
            final String fileName = safeFileName(name), type = safeMime(mime);
            if (Build.VERSION.SDK_INT < 29) {
                io.execute(() -> {
                    byte[] data;
                    try { data = Base64.decode(base64, Base64.DEFAULT); } catch (Exception e) { runOnUiThread(() -> toast("No se pudo guardar el archivo")); return; }
                    runOnUiThread(() -> {
                        pendingSave = data;
                        pendingSaveMime = type;
                        try { saveDocument.launch(fileName); } catch (Exception e) { pendingSave = null; toast("No se pudo guardar el archivo"); }
                    });
                });
                return;
            }
            io.execute(() -> {
                ContentResolver cr = getContentResolver();
                Uri item = null;
                try {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, type);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/WHIDER");
                    v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    item = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (item == null) throw new IllegalStateException("sin destino");
                    try (OutputStream out = cr.openOutputStream(item)) {
                        if (out == null) throw new IllegalStateException("sin destino");
                        out.write(Base64.decode(base64, Base64.DEFAULT));
                    }
                    v.clear();
                    v.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    cr.update(item, v, null, null);
                    runOnUiThread(() -> toast("Guardado en Descargas › WHIDER"));
                } catch (Exception e) {
                    if (item != null) { try { cr.delete(item, null, null); } catch (Exception ignored) { } }
                    runOnUiThread(() -> toast("No se pudo guardar el archivo"));
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
