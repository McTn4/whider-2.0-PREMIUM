package com.whider.app;

import android.content.Context;
import android.content.res.Configuration;

import java.util.Locale;

/**
 * Idioma de la app para los textos nativos (canal de avisos, widget y mensajes breves). Lo elige la web
 * (js/core/i18n.js) y lo comunica con WhiderAndroid.setLang; así esos textos salen en el idioma de la app y no en el
 * del teléfono. Los textos están en res/values (español, el de siempre) y res/values-en (inglés).
 */
final class Lang {
    private static final String PREFS = "whider_native";
    private static final String KEY = "lang";

    private Lang() { }

    /** «es» o «en» (español si la web aún no ha dicho nada) */
    static String get(Context ctx) {
        String l = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "es");
        return "en".equals(l) ? "en" : "es";
    }

    /** Guarda el idioma; devuelve true si ha cambiado */
    static boolean set(Context ctx, String lang) {
        String l = "en".equals(lang) ? "en" : "es";
        if (l.equals(get(ctx))) return false;
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, l).apply();
        return true;
    }

    /** Un contexto cuyos recursos están en el idioma de la app */
    static Context ctx(Context base) {
        Configuration c = new Configuration(base.getResources().getConfiguration());
        c.setLocale(Locale.forLanguageTag(get(base)));
        return base.createConfigurationContext(c);
    }

    /** Un texto de res/values en el idioma de la app */
    static String str(Context base, int id, Object... args) {
        return ctx(base).getString(id, args);
    }
}
