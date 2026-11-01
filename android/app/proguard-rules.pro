# Mantener los métodos del puente JavaScript si se activa la minificación
-keepclassmembers class com.whider.app.MainActivity$WhiderBridge {
    @android.webkit.JavascriptInterface <methods>;
}
