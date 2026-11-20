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
        @Permission(alias = "notificacions", strings = {"android.permission.POST_NOTIFICATIONS"})
})
public class SociPlugin extends Plugin {
    private static WeakReference<SociPlugin> actual = new WeakReference<>(null);
    private static boolean escoltaPendent = false;

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

    @PluginMethod
    public void intencio(PluginCall call) {
        JSObject r = new JSObject();
        r.put("escolta", escoltaPendent);
        escoltaPendent = false;
        call.resolve(r);
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
                }
            });
            rec.startListening(i);
        });
    }

    @ActivityCallback
    private void dictatCb(PluginCall call, ActivityResult res) {
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
