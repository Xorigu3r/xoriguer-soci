package cat.xoriguer.soci;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Locale;

/** Pont amb www/app.js: dades, veu (escoltar i parlar), permisos, còpies i giny. */
@CapacitorPlugin(name = "Soci", permissions = {
        @Permission(alias = "microfon", strings = {Manifest.permission.RECORD_AUDIO}),
        @Permission(alias = "notificacions", strings = {"android.permission.POST_NOTIFICATIONS"}),
        @Permission(alias = "calendari", strings = {Manifest.permission.READ_CALENDAR}),
        @Permission(alias = "ubicacio", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
        @Permission(alias = "ubicacioSempre", strings = {"android.permission.ACCESS_BACKGROUND_LOCATION"})
})
public class SociPlugin extends Plugin {
    private static WeakReference<SociPlugin> actual = new WeakReference<>(null);
    private static boolean escoltaPendent = false;
    private static String textPendent = null;
    private static volatile boolean primerPla = false;

    /** L'app és a la vista (per a «hey soci»: n'hi ha prou d'avisar la web). */
    static boolean enPrimerPla() { return primerPla && actual.get() != null; }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        primerPla = true;
        // si «hey soci» s'havia d'engegar (p. ex. després de reiniciar), ara que l'app és oberta, sí que es pot
        if (Escolta.volgut(getContext()) && !Escolta.enMarxa()) Escolta.engega(getContext());
    }

    @Override
    protected void handleOnPause() {
        primerPla = false;
        super.handleOnPause();
    }

    private SpeechRecognizer rec;
    private PluginCall cridaEscolta;
    private TextToSpeech tts;
    private boolean ttsLlest = false;
    private final ArrayList<Runnable> ttsCua = new ArrayList<>();

    @Override
    public void load() { actual = new WeakReference<>(this); }

    @Override
    protected void handleOnDestroy() {
        destrueixRec();
        if (tts != null) tts.shutdown();
    }

    // ---------------------------------------------------------------- crides des de fora
    /** El Receptor ha canviat les dades (Fet, Posposa...): la web les torna a llegir. */
    static void avisaCanvi() {
        SociPlugin p = actual.get();
        if (p != null) new Handler(Looper.getMainLooper()).post(() -> p.notifyListeners("canvi", new JSObject()));
    }

    /** Giny, barra ràpida o drecera: obre escoltant. */
    static void demanaEscolta() {
        SociPlugin p = actual.get();
        if (p != null && p.hasListeners("escolta")) {
            escoltaPendent = false;
            new Handler(Looper.getMainLooper()).postDelayed(() -> p.notifyListeners("escolta", new JSObject()), 250);
        } else escoltaPendent = true;
    }

    /** Comparteix → Soci: el text arriba a la web (ara o quan carregui). */
    static void demanaText(String text) {
        SociPlugin p = actual.get();
        if (p != null && p.hasListeners("text")) {
            textPendent = null;
            JSObject o = new JSObject();
            o.put("text", text);
            new Handler(Looper.getMainLooper()).postDelayed(() -> p.notifyListeners("text", o), 250);
        } else textPendent = text;
    }

    @PluginMethod
    public void intencio(PluginCall call) {
        JSObject r = new JSObject();
        r.put("escolta", escoltaPendent);
        if (textPendent != null) r.put("text", textPendent);
        escoltaPendent = false;
        textPendent = null;
        call.resolve(r);
    }

    // ---------------------------------------------------------------- calendari, compartir, assistent (1.1)
    @PluginMethod
    public void calendari(PluginCall call) {
        JSObject r = new JSObject();
        long de = call.getLong("de", System.currentTimeMillis());
        long a = call.getLong("a", de + 86_400_000L);
        com.getcapacitor.JSArray l = new com.getcapacitor.JSArray();
        for (Calendari.Esdeveniment e : Calendari.entre(getContext(), de, a)) {
            JSObject o = new JSObject();
            o.put("titol", e.titol);
            o.put("inici", e.inici);
            o.put("totDia", e.totDia);
            l.put(o);
        }
        r.put("events", l);
        r.put("permis", Calendari.permis(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void comparteix(PluginCall call) {
        Intent s = new Intent(Intent.ACTION_SEND).setType("text/plain");
        s.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        String t = call.getString("titol", null);
        if (t != null) s.putExtra(Intent.EXTRA_SUBJECT, t);
        Intent ch = Intent.createChooser(s, t);
        if (obre(ch)) call.resolve(); else call.reject("no");
    }

    /** Obre la pantalla on es tria l'assistent digital (Android no deixa que una app s'hi posi sola). */
    @PluginMethod
    public void obreAssistent(PluginCall call) {
        if (obre(new Intent("android.settings.MANAGE_DEFAULT_APPS_SETTINGS"))
                || obre(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS))) call.resolve();
        else call.reject("no");
    }

    private boolean esAssistent() {
        if (Build.VERSION.SDK_INT >= 29) {
            android.app.role.RoleManager rm = getContext().getSystemService(android.app.role.RoleManager.class);
            return rm != null && rm.isRoleAvailable(android.app.role.RoleManager.ROLE_ASSISTANT) && rm.isRoleHeld(android.app.role.RoleManager.ROLE_ASSISTANT);
        }
        String s = Settings.Secure.getString(getContext().getContentResolver(), "assistant");
        return s != null && s.startsWith(getContext().getPackageName() + "/");
    }

    // ---------------------------------------------------------------- dades
    @PluginMethod
    public void carrega(PluginCall call) {
        JSObject r = new JSObject();
        r.put("dades", Magatzem.llegeixText(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void desa(PluginCall call) {
        String d = call.getString("dades");
        if (d == null) { call.reject("sense dades"); return; }
        Context c = getContext();
        Magatzem.desa(c, d);
        try { Avisos.canals(c, Magatzem.llegeix(c)); } catch (Exception ignored) {}
        Programador.reprograma(c);
        Giny.actualitza(c);
        Copies.diaria(c);
        try { Llocs.reprograma(c); } catch (Throwable ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void exporta(PluginCall call) {
        try {
            String cami = Copies.escriu(getContext(), call.getString("nom", "soci.json"), call.getString("text", ""));
            JSObject r = new JSObject();
            r.put("cami", cami);
            call.resolve(r);
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    // ---------------------------------------------------------------- escoltar
    @PluginMethod
    public void escolta(PluginCall call) {
        if (getPermissionState("microfon") != PermissionState.GRANTED) {
            requestPermissionForAlias("microfon", call, "microfonCb");
            return;
        }
        comenca(call);
    }

    @PermissionCallback
    private void microfonCb(PluginCall call) {
        if (getPermissionState("microfon") == PermissionState.GRANTED) comenca(call);
        else call.reject("permis");
    }

    private void comenca(PluginCall call) {
        Escolta.pausa(getContext()); // «hey soci» deixa el micròfon mentre dictes
        String llengua = call.getString("llengua", "ca-ES");
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, llengua);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, llengua);
        i.putExtra("android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES", new String[]{llengua});
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        if (Boolean.TRUE.equals(call.getBoolean("offline", false))) i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);

        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            // sense servei de reconeixement en segon pla: el diàleg de Google
            try { startActivityForResult(call, i, "dictatCb"); }
            catch (Exception e) { call.reject("no-reconeixement"); }
            return;
        }
        getActivity().runOnUiThread(() -> {
            destrueixRec();
            if (cridaEscolta != null) cridaEscolta.reject("cancel");
            cridaEscolta = call;
            rec = SpeechRecognizer.createSpeechRecognizer(getContext());
            rec.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { estat("llest"); }
                @Override public void onBeginningOfSpeech() { estat("parla"); }
                @Override public void onRmsChanged(float v) {}
                @Override public void onBufferReceived(byte[] b) {}
                @Override public void onEndOfSpeech() { estat("pensa"); }
                @Override public void onEvent(int t, Bundle b) {}
                @Override public void onPartialResults(Bundle b) {
                    ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (r != null && !r.isEmpty()) { JSObject o = new JSObject(); o.put("text", r.get(0)); notifyListeners("parcial", o); }
                }
                @Override public void onResults(Bundle b) {
                    ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    PluginCall pc = cridaEscolta; cridaEscolta = null;
                    if (pc == null) return;
                    if (r == null || r.isEmpty()) { pc.reject("no-match"); return; }
                    JSObject o = new JSObject();
                    o.put("text", r.get(0));
                    o.put("alternatives", new com.getcapacitor.JSArray(r));
                    pc.resolve(o);
                    destrueixRec();
                    Escolta.repren(getContext());
                }
                @Override public void onError(int err) {
                    PluginCall pc = cridaEscolta; cridaEscolta = null;
                    if (pc != null) {
                        String m = (err == SpeechRecognizer.ERROR_NO_MATCH || err == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) ? "no-match"
                                : err == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "permis"
                                : err == SpeechRecognizer.ERROR_NETWORK || err == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? "xarxa"
                                : err == 12 || err == 13 ? "idioma" // LANGUAGE_NOT_SUPPORTED / UNAVAILABLE
                                : "error " + err;
                        pc.reject(m);
                    }
                    destrueixRec();
                    Escolta.repren(getContext());
                }
            });
            rec.startListening(i);
        });
    }

    @ActivityCallback
    private void dictatCb(PluginCall call, ActivityResult res) {
        Escolta.repren(getContext());
        if (call == null) return;
        Intent d = res.getData();
        ArrayList<String> r = d == null ? null : d.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (r == null || r.isEmpty()) { call.reject("cancel"); return; }
        JSObject o = new JSObject();
        o.put("text", r.get(0));
        call.resolve(o);
    }

    private void estat(String e) { JSObject o = new JSObject(); o.put("estat", e); notifyListeners("estat", o); }

    @PluginMethod
    public void atura(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (rec != null) rec.stopListening();
            Escolta.repren(getContext());
            call.resolve();
        });
    }

    private void destrueixRec() {
        if (rec != null) { try { rec.destroy(); } catch (Exception ignored) {} rec = null; }
    }

    // ---------------------------------------------------------------- parlar
    @PluginMethod
    public void parla(PluginCall call) {
        String text = call.getString("text", "");
        String llengua = call.getString("llengua", "ca-ES");
        float vel = call.getFloat("velocitat", 1f);
        Runnable fes = () -> {
            Locale loc = Locale.forLanguageTag(llengua);
            if (tts.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(loc);
            tts.setSpeechRate(vel);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "app");
        };
        if (tts == null) {
            tts = new TextToSpeech(getContext(), st -> {
                ttsLlest = st == TextToSpeech.SUCCESS;
                if (ttsLlest) for (Runnable r : ttsCua) r.run();
                ttsCua.clear();
            });
        }
        if (ttsLlest) fes.run(); else ttsCua.add(fes);
        call.resolve();
    }

    @PluginMethod
    public void calla(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    // ---------------------------------------------------------------- permisos
    @PluginMethod
    public void permisos(PluginCall call) { call.resolve(estatPermisos()); }

    private JSObject estatPermisos() {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("microfon", ContextCompat.checkSelfPermission(c, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED);
        r.put("notificacions", NotificationManagerCompat.from(c).areNotificationsEnabled());
        r.put("alarmes", Programador.exactes(c));
        PowerManager pm = c.getSystemService(PowerManager.class);
        r.put("bateria", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        r.put("reconeixement", SpeechRecognizer.isRecognitionAvailable(c));
        r.put("calendari", Calendari.permis(c));
        boolean as = false;
        try { as = esAssistent(); } catch (Exception ignored) {}
        r.put("assistent", as);
        r.put("ubicacio", Llocs.permis(c));
        r.put("ubicacioSempre", Llocs.permisSempre(c));
        r.put("google", Llocs.google(c));
        r.put("superposar", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        r.put("pantalla", Respon.potPantallaCompleta(c));
        r.put("heySoci", Escolta.volgut(c));
        r.put("heySociEnMarxa", Escolta.enMarxa());
        return r;
    }

    @PluginMethod
    public void demanaPermis(PluginCall call) {
        String q = call.getString("quin", "");
        Context c = getContext();
        Uri pkg = Uri.parse("package:" + c.getPackageName());
        switch (q) {
            case "microfon":
                if (getPermissionState("microfon") == PermissionState.GRANTED) { call.resolve(estatPermisos()); return; }
                requestPermissionForAlias("microfon", call, "permisCb");
                return;
            case "notificacions":
                if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notificacions") != PermissionState.GRANTED) {
                    requestPermissionForAlias("notificacions", call, "permisCb");
                    return;
                }
                if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) {
                    obre(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, c.getPackageName()));
                }
                break;
            case "calendari":
                if (getPermissionState("calendari") == PermissionState.GRANTED) { call.resolve(estatPermisos()); return; }
                requestPermissionForAlias("calendari", call, "permisCb");
                return;
            case "ubicacio":
                if (getPermissionState("ubicacio") == PermissionState.GRANTED) { call.resolve(estatPermisos()); return; }
                requestPermissionForAlias("ubicacio", call, "permisCb");
                return;
            case "ubicacioSempre":
                // Android 11+: porta a la pantalla on es tria «Permet sempre»
                if (Build.VERSION.SDK_INT < 29 || Llocs.permisSempre(c)) { call.resolve(estatPermisos()); return; }
                if (getPermissionState("ubicacio") != PermissionState.GRANTED) { requestPermissionForAlias("ubicacio", call, "permisCb"); return; }
                requestPermissionForAlias("ubicacioSempre", call, "permisCb");
                return;
            case "superposar":
                if (Build.VERSION.SDK_INT >= 23) obre(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg));
                break;
            case "pantalla":
                if (Build.VERSION.SDK_INT >= 34) obre(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg));
                break;
            case "alarmes":
                if (Build.VERSION.SDK_INT >= 31) obre(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg));
                break;
            case "bateria":
                if (!obre(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)))
                    obre(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                break;
            default:
        }
        call.resolve(estatPermisos());
    }

    @PermissionCallback
    private void permisCb(PluginCall call) { call.resolve(estatPermisos()); }

    private boolean obre(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { getContext().startActivity(i); return true; } catch (Exception e) { return false; }
    }

    /** Botó «Busca actualitzacions» d'Ajustos. */
    @PluginMethod
    public void actualitza(PluginCall call) {
        getActivity().runOnUiThread(() -> XoriguerObliga.busca(getActivity(), "soci"));
        call.resolve();
    }

    // ---------------------------------------------------------------- llocs i «hey soci» (1.2)
    /** On sóc ara: {lat, lon, precisio}. */
    @PluginMethod
    public void posicio(PluginCall call) {
        if (!Llocs.permis(getContext())) { call.reject("permis"); return; }
        Llocs.posicio(getContext(), l -> {
            if (l == null) { call.reject("sense-posicio"); return; }
            JSObject o = new JSObject();
            o.put("lat", l.getLatitude());
            o.put("lon", l.getLongitude());
            o.put("precisio", l.getAccuracy());
            call.resolve(o);
        });
    }

    /** Obre l'app de mapes (Google Maps, OsmAnd...) per anar-hi. */
    @PluginMethod
    public void obreMapa(PluginCall call) {
        double lat = call.getDouble("lat", 0.0), lon = call.getDouble("lon", 0.0);
        String nom = Uri.encode(call.getString("nom", "Soci"));
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:" + lat + "," + lon + "?q=" + lat + "," + lon + "(" + nom + ")"));
        if (obre(i)) call.resolve(); else call.reject("no");
    }

    @PluginMethod
    public void heySoci(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        if (on) {
            if (getPermissionState("microfon") != PermissionState.GRANTED) { requestPermissionForAlias("microfon", call, "heySociCb"); return; }
            Escolta.engega(getContext());
        } else Escolta.para(getContext());
        call.resolve(estatPermisos());
    }

    @PermissionCallback
    private void heySociCb(PluginCall call) {
        if (getPermissionState("microfon") == PermissionState.GRANTED) Escolta.engega(getContext());
        call.resolve(estatPermisos());
    }

    // ---------------------------------------------------------------- giny
    @PluginMethod
    public void afegeixGiny(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        if (m.isRequestPinAppWidgetSupported()) {
            m.requestPinAppWidget(new ComponentName(getContext(), Giny.class), null, null);
            call.resolve();
        } else call.reject("no");
    }
}
