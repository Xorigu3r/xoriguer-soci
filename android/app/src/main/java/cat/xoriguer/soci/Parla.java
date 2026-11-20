package cat.xoriguer.soci;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import org.json.JSONObject;

import java.time.LocalTime;
import java.util.Locale;

/** Veu dels avisos quan l'app és tancada (des del Receptor). Respecta el mode silenci, les trucades i el silenci de nit. */
final class Parla {
    private Parla() {}

    /** Pot parlar ara? (ajust «parla», mòbil no silenciat, sense trucada, fora del silenci de nit) */
    static boolean pot(Context c, JSONObject dades) {
        JSONObject a = dades.optJSONObject("ajustos");
        if (a != null && !a.optBoolean("parla", true)) return false;
        AudioManager am = c.getSystemService(AudioManager.class);
        if (am != null) {
            if (am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return false;
            int m = am.getMode();
            if (m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION || m == AudioManager.MODE_RINGTONE) return false;
        }
        if (a != null && a.optBoolean("silenci", true)) {
            LocalTime de = Magatzem.hora(a.optString("silenciDe", "23:00"), 23, 0);
            LocalTime fins = Magatzem.hora(a.optString("silenciA", "08:00"), 8, 0);
            LocalTime ara = LocalTime.now();
            boolean dins = de.isBefore(fins) ? (!ara.isBefore(de) && ara.isBefore(fins)) : (!ara.isBefore(de) || ara.isBefore(fins));
            if (dins) return false;
        }
        return true;
    }

    /** Diu el text i acaba el BroadcastReceiver quan ha acabat (o al cap de 9 s). */
    static void diu(Context c, JSONObject dades, String text, BroadcastReceiver.PendingResult pr) {
        Context app = c.getApplicationContext();
        Handler h = new Handler(Looper.getMainLooper());
        final TextToSpeech[] tts = new TextToSpeech[1];
        final boolean[] acabat = {false, false};
        // el receptor s'ha d'alliberar abans de 10 s; la veu pot continuar una mica més
        Runnable allibera = () -> {
            if (acabat[1]) return;
            acabat[1] = true;
            if (pr != null) try { pr.finish(); } catch (Exception ignored) {}
        };
        Runnable fi = () -> {
            allibera.run();
            if (acabat[0]) return;
            acabat[0] = true;
            h.postDelayed(() -> { if (tts[0] != null) tts[0].shutdown(); }, 500);
        };
        h.postDelayed(allibera, 9_000);
        h.postDelayed(fi, 60_000);
        // deixa sonar primer la notificació
        h.postDelayed(() -> tts[0] = new TextToSpeech(app, st -> {
            if (st != TextToSpeech.SUCCESS) { fi.run(); return; }
            TextToSpeech t = tts[0];
            Locale loc = Locale.forLanguageTag(Magatzem.llengua(dades));
            if (t.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) t.setLanguage(loc);
            JSONObject a = dades.optJSONObject("ajustos");
            t.setSpeechRate((float) (a == null ? 1.0 : a.optDouble("velocitat", 1.0)));
            t.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
            t.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String u) {}
                @Override public void onDone(String u) { h.post(fi); }
                @Override public void onError(String u) { h.post(fi); }
            });
            t.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), "soci");
        }), 1200);
    }
}
