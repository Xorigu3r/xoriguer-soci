package cat.xoriguer.soci;

import android.Manifest;
import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Després d'avisar, Soci escolta la resposta: «fet», «d'aquí 10 minuts», «demà», «repeteix».
 *  S'obre des del botó «Respon» de la notificació, a pantalla completa amb el mòbil bloquejat,
 *  o directament si «hey soci» és actiu (la bombolla permet obrir-la). */
public class Respon extends Activity {
    private static final int FET = 1, POSPOSA = 2, DEMA = 3, REPETEIX = 4;

    private String id, frase;
    private JSONObject dades;
    private TextToSpeech tts;
    private boolean ttsLlest;
    private Runnable despresTts;
    private SpeechRecognizer rec;
    private int intents = 0;
    private TextView estat;
    private final Handler h = new Handler(Looper.getMainLooper());

    // ---------------------------------------------------------------- des de fora
    static PendingIntent pi(Context c, String id, String frase, boolean parla) {
        Intent i = new Intent(c, Respon.class)
                .setData(Uri.parse("soci://respon/" + id + "/" + parla))
                .putExtra("id", id).putExtra("frase", frase).putExtra("parla", parla)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_HISTORY | Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS);
        return PendingIntent.getActivity(c, ("respon" + id + parla).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Ajust «Respon per veu» activat i permís del micròfon. */
    static boolean potEscoltar(Context c, JSONObject dades) {
        JSONObject a = dades.optJSONObject("ajustos");
        if (a != null && !a.optBoolean("responVeu", true)) return false;
        return ContextCompat.checkSelfPermission(c, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                && SpeechRecognizer.isRecognitionAvailable(c);
    }

    static boolean pantallaApagada(Context c) {
        PowerManager pm = c.getSystemService(PowerManager.class);
        KeyguardManager km = c.getSystemService(KeyguardManager.class);
        return (pm != null && !pm.isInteractive()) || (km != null && km.isKeyguardLocked());
    }

    static boolean potPantallaCompleta(Context c) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        return nm != null && nm.canUseFullScreenIntent();
    }

    /** Com s'avisa: 0 = només veu (la notificació té el botó Respon), 1 = obre Respon ara, 2 = notificació a pantalla completa. */
    static int mode(Context c, JSONObject dades) {
        if (!potEscoltar(c, dades)) return 0;
        if (Escolta.bombollaVisible()) return 1;
        if (pantallaApagada(c) && potPantallaCompleta(c)) return 2;
        return 0;
    }

    /** Obre Respon directament (només quan Android ho permet: bombolla de «hey soci» visible). */
    static void obre(Context c, String id, String frase, boolean parla) {
        try { pi(c, id, frase, parla).send(); } catch (Exception ignored) {}
    }

    // ---------------------------------------------------------------- pantalla
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.respon);
        dades = Magatzem.llegeix(this);
        id = getIntent().getStringExtra("id");
        frase = getIntent().getStringExtra("frase");
        if (frase == null) frase = "";
        ((TextView) findViewById(R.id.respon_frase)).setText(frase);
        estat = findViewById(R.id.respon_estat);
        ((TextView) findViewById(R.id.respon_ajuda)).setText(Magatzem.t(dades, "responAjuda", "Digues «fet», «d'aquí 10 minuts» o «demà»."));
        boto(R.id.respon_fet, "fet", "Fet", () -> aplica(FET, 0));
        boto(R.id.respon_10, "m10", "+10 min", () -> aplica(POSPOSA, 10));
        boto(R.id.respon_dema, "dema", "Demà", () -> aplica(DEMA, 0));
        boto(R.id.respon_tanca, "tanca", "Tanca", this::finish);
        Escolta.pausa(this);
        tts = new TextToSpeech(this, st -> {
            ttsLlest = st == TextToSpeech.SUCCESS;
            if (ttsLlest) {
                Locale loc = Locale.forLanguageTag(Magatzem.llengua(dades));
                if (tts.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(loc);
                JSONObject a = dades.optJSONObject("ajustos");
                tts.setSpeechRate((float) (a == null ? 1.0 : a.optDouble("velocitat", 1.0)));
                tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String u) {}
                    @Override public void onDone(String u) { h.post(() -> { Runnable r = despresTts; despresTts = null; if (r != null) r.run(); }); }
                    @Override public void onError(String u) { onDone(u); }
                });
            }
            if (getIntent().getBooleanExtra("parla", false)) diu(frase, this::escolta);
            else escolta();
        });
        h.postDelayed(this::finish, 60_000); // que no quedi oberta
    }

    private void boto(int vid, String clau, String def, Runnable r) {
        Button b = findViewById(vid);
        b.setText(Magatzem.t(dades, clau, def));
        b.setOnClickListener(v -> { aturaRec(); r.run(); });
    }

    private void diu(String text, Runnable despres) {
        if (!ttsLlest || text == null || text.isEmpty()) { if (despres != null) despres.run(); return; }
        despresTts = despres;
        Bundle p = new Bundle();
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, p, "respon");
    }

    // ---------------------------------------------------------------- escoltar
    private void escolta() {
        if (isFinishing()) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED
                || !SpeechRecognizer.isRecognitionAvailable(this)) { estat.setText(""); return; }
        aturaRec();
        estat.setText(Magatzem.t(dades, "escoltant", "T'escolto…"));
        String llengua = Magatzem.llengua(dades);
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, llengua)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        JSONObject a = dades.optJSONObject("ajustos");
        if (a != null && a.optBoolean("senseXarxa")) i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        rec = SpeechRecognizer.createSpeechRecognizer(this);
        rec.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float v) {}
            @Override public void onBufferReceived(byte[] b) {}
            @Override public void onEndOfSpeech() { estat.setText("…"); }
            @Override public void onPartialResults(Bundle b) {}
            @Override public void onEvent(int t, Bundle b) {}
            @Override public void onError(int e) { noEntes(); }
            @Override public void onResults(Bundle b) {
                ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (r == null) { noEntes(); return; }
                for (String s : r) {
                    int[] x = interpreta(s);
                    if (x[0] == REPETEIX) { diu(frase, Respon.this::escolta); return; }
                    if (x[0] != 0) { aplica(x[0], x[1]); return; }
                }
                noEntes();
            }
        });
        rec.startListening(i);
    }

    private void noEntes() {
        aturaRec();
        if (++intents >= 2) { estat.setText(""); return; } // els botons queden a la vista
        diu(Magatzem.t(dades, "noEntesResp", "No t'he entès. Digues «fet», «d'aquí 10 minuts» o «demà»."), this::escolta);
    }

    private void aturaRec() {
        if (rec != null) { try { rec.destroy(); } catch (Exception ignored) {} rec = null; }
    }

    /** Fa l'acció (com els botons de la notificació), ho confirma en veu i tanca. */
    private void aplica(int tipus, int minuts) {
        if (id == null) { finish(); return; }
        String msg;
        if (tipus == FET) { Receptor.aplica(this, Avisos.FET, id, 0); msg = Magatzem.t(dades, "respFet", "Fet!"); }
        else if (tipus == DEMA) { Receptor.aplica(this, Avisos.DEMA, id, 0); msg = Magatzem.t(dades, "respDema", "D'acord, t'ho recordo demà."); }
        else { Receptor.aplica(this, Avisos.POSPOSA, id, minuts); msg = Magatzem.t(dades, "respPosposa", "D'acord, d'aquí {n} minuts.").replace("{n}", String.valueOf(minuts)); }
        estat.setText(msg);
        diu(msg, this::finish);
        h.postDelayed(this::finish, 6_000);
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        aturaRec();
        if (tts != null) tts.shutdown();
        Escolta.repren(this);
        super.onDestroy();
    }

    // ---------------------------------------------------------------- què ha dit (4 idiomes)
    private static final Pattern P_FET = Pattern.compile("\\b(fet|feta|fets|ja esta|ja ho tinc|hecho|hecha|listo|lista|ya esta|fait|c'est fait|termine|done|finished|completed|did it)\\b");
    private static final Pattern P_DEMA = Pattern.compile("\\b(dema|manana|demain|tomorrow)\\b");
    private static final Pattern P_MITJA = Pattern.compile("\\b(mitja hora|media hora|demi heure|demi-heure|half an hour)\\b");
    private static final Pattern P_TEMPS = Pattern.compile("\\b(\\d+|un|una|uno|une|a|an|one|dos|dues|deux|two|tres|trois|three|quatre|cuatro|four|cinc|cinco|cinq|five|deu|diez|dix|ten|quinze|quince|fifteen|vint|veinte|vingt|twenty|trenta|treinta|trente|thirty)\\s+(minuts?|minutos?|minutes?|mins?|hores?|horas?|hora|heures?|hours?)\\b");
    private static final Pattern P_POSPOSA = Pattern.compile("\\b(posposa|posposar|mes tard|despres|luego|mas tarde|despues|pospon|plus tard|apres|later|snooze|retarda)\\b");
    private static final Pattern P_REPETEIX = Pattern.compile("\\b(repeteix|repetir|repite|repete|repeat|com dius|que has dit|como|pardon|what)\\b");

    static int[] interpreta(String s) {
        String t = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "").replace('’', '\'');
        Matcher m;
        if (P_DEMA.matcher(t).find()) return new int[]{DEMA, 0};
        if (P_MITJA.matcher(t).find()) return new int[]{POSPOSA, 30};
        if ((m = P_TEMPS.matcher(t)).find()) {
            int n = numero(m.group(1));
            boolean hores = m.group(2).startsWith("h");
            return new int[]{POSPOSA, Math.max(1, Math.min(n * (hores ? 60 : 1), 24 * 60))};
        }
        if (P_FET.matcher(t).find()) return new int[]{FET, 0};
        if (P_POSPOSA.matcher(t).find()) return new int[]{POSPOSA, 10};
        if (P_REPETEIX.matcher(t).find()) return new int[]{REPETEIX, 0};
        return new int[]{0, 0};
    }

    private static int numero(String s) {
        try { return Integer.parseInt(s); } catch (NumberFormatException ignored) {}
        switch (s) {
            case "dos": case "dues": case "deux": case "two": return 2;
            case "tres": case "trois": case "three": return 3;
            case "quatre": case "cuatro": case "four": return 4;
            case "cinc": case "cinco": case "cinq": case "five": return 5;
            case "deu": case "diez": case "dix": case "ten": return 10;
            case "quinze": case "quince": case "fifteen": return 15;
            case "vint": case "veinte": case "vingt": case "twenty": return 20;
            case "trenta": case "treinta": case "trente": case "thirty": return 30;
            default: return 1;
        }
    }
}
