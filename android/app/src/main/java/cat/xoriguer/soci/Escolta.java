package cat.xoriguer.soci;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** «Hey soci» sempre escoltant, sense connexió (Vosk, model català dins l'APK).
 *  Servei en primer pla de tipus micròfon amb una notificació fixa; quan sent el nom, obre Soci escoltant.
 *  Si hi ha permís «Mostra sobre altres apps», deixa una bombolla petita: Android permet obrir Soci des d'aquí. */
public class Escolta extends Service implements RecognitionListener {
    static final String CANAL = "escolta";
    static final String ATURA = "cat.xoriguer.soci.ATURA_ESCOLTA";
    static final String HEY = "cat.xoriguer.soci.HEY";
    private static final int NOTIF = 4242;
    private static final int NOTIF_CRIDA = 4243;

    private static volatile Escolta actual;
    private static volatile boolean bombolla;
    private static volatile boolean carregat;

    private Model model;
    private SpeechService ss;
    private boolean pausat;
    private View vistaBombolla;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable represa = this::reprenAra;
    private Set<String> noms = new HashSet<>();

    // ---------------------------------------------------------------- control des de fora
    static boolean volgut(Context c) { return Magatzem.prefs(c).getBoolean("heySoci", false); }
    static boolean enMarxa() { return actual != null; }
    static boolean llest() { return actual != null && carregat; }
    static boolean bombollaVisible() { return actual != null && bombolla; }

    /** Engega (només des de l'app oberta: Android no deixa engegar el micròfon des de fons). */
    static boolean engega(Context c) {
        Magatzem.prefs(c).edit().putBoolean("heySoci", true).apply();
        try { ContextCompat.startForegroundService(c, new Intent(c, Escolta.class)); return true; }
        catch (Exception e) { return false; }
    }

    static void para(Context c) {
        Magatzem.prefs(c).edit().putBoolean("heySoci", false).apply();
        c.stopService(new Intent(c, Escolta.class));
    }

    /** Deixa el micròfon lliure (Soci dicta o Respon escolta). */
    static void pausa(Context c) {
        Escolta e = actual;
        if (e != null) e.h.post(() -> e.posaPausa(true));
    }

    /** Torna a escoltar «hey soci» (una mica després, que l'altre micròfon s'hagi tancat). */
    static void repren(Context c) {
        Escolta e = actual;
        if (e != null) { e.h.removeCallbacks(e.represa); e.h.postDelayed(e.represa, 800); }
    }

    // ---------------------------------------------------------------- servei
    @Override
    public void onCreate() {
        super.onCreate();
        actual = this;
        int tipus = Build.VERSION.SDK_INT >= 30 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0;
        try { ServiceCompat.startForeground(this, NOTIF, notificacio(), tipus); }
        catch (Exception e) { stopSelf(); return; }
        llegeixNoms();
        StorageService.unpack(this, "model-ca", "model",
                m -> { model = m; carregat = true; comenca(); },
                ex -> stopSelf());
        mostraBombolla();
    }

    @Override
    public int onStartCommand(Intent i, int flags, int startId) {
        if (i != null && ATURA.equals(i.getAction())) { para(this); return START_NOT_STICKY; }
        llegeixNoms();
        return START_STICKY;
    }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public void onDestroy() {
        h.removeCallbacksAndMessages(null);
        aturaReconeixement();
        treuBombolla();
        if (model != null) { try { model.close(); } catch (Exception ignored) {} }
        carregat = false;
        if (actual == this) actual = null;
        super.onDestroy();
    }

    /** El nom amb què el crides: «soci» i el que hagis posat a Ajustos. */
    private void llegeixNoms() {
        Set<String> n = new HashSet<>();
        n.add("soci"); n.add("socio"); n.add("socia");
        JSONObject a = Magatzem.llegeix(this).optJSONObject("ajustos");
        if (a != null) for (String p : pla(a.optString("nom", "soci")).split("\\s+")) if (p.length() >= 3) n.add(p);
        noms = n;
    }

    private static String pla(String s) {
        return Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "").trim();
    }

    private void comenca() {
        if (model == null || pausat) return;
        aturaReconeixement();
        try {
            Recognizer r = new Recognizer(model, 16000.0f);
            ss = new SpeechService(r, 16000.0f);
            ss.startListening(this);
        } catch (Exception e) {
            h.postDelayed(this::comenca, 5_000);
        }
    }

    private void aturaReconeixement() {
        if (ss != null) { try { ss.stop(); ss.shutdown(); } catch (Exception ignored) {} ss = null; }
    }

    private void posaPausa(boolean p) {
        pausat = p;
        if (p) {
            aturaReconeixement(); // allibera el micròfon del tot
            h.removeCallbacks(represa);
            h.postDelayed(represa, 45_000); // per si ningú no avisa que ha acabat
        }
    }

    private void reprenAra() {
        pausat = false;
        if (ss == null) comenca();
    }

    // ---------------------------------------------------------------- Vosk
    @Override public void onPartialResult(String hyp) { mira(hyp, "partial"); }
    @Override public void onResult(String hyp) { mira(hyp, "text"); }
    @Override public void onFinalResult(String hyp) { mira(hyp, "text"); }
    @Override public void onError(Exception e) { aturaReconeixement(); h.postDelayed(this::comenca, 3_000); }
    @Override public void onTimeout() { comenca(); }

    private void mira(String json, String camp) {
        if (pausat || json == null) return;
        String text;
        try { text = new JSONObject(json).optString(camp, ""); } catch (Exception e) { return; }
        if (text.isEmpty()) return;
        for (String p : pla(text).split("\\s+")) {
            if (noms.contains(p)) { h.post(this::cridat); return; }
        }
    }

    /** M'han cridat: vibra, deixa el micròfon i obre Soci escoltant. */
    private void cridat() {
        if (pausat) return;
        posaPausa(true);
        Vibrator v = getSystemService(Vibrator.class);
        if (v != null && Build.VERSION.SDK_INT >= 26) try { v.vibrate(VibrationEffect.createOneShot(60, VibrationEffect.DEFAULT_AMPLITUDE)); } catch (Exception ignored) {}
        if (SociPlugin.enPrimerPla()) { SociPlugin.demanaEscolta(); return; }
        Intent i = new Intent(this, MainActivity.class).setAction(MainActivity.ESCOLTA)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { startActivity(i); } catch (Exception ignored) {}
        if (!bombolla) avisCrida(i); // sense bombolla, Android pot no deixar obrir l'app: avís per tocar
    }

    /** Notificació «M'has cridat? Toca per parlar» (a pantalla completa si el mòbil és bloquejat). */
    private void avisCrida(Intent obre) {
        JSONObject dades = Magatzem.llegeix(this);
        canal(this, dades);
        PendingIntent p = PendingIntent.getActivity(this, 77, obre, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, Avisos.CANAL)
                .setSmallIcon(R.drawable.ic_stat_soci).setColor(0xFFF2650F)
                .setContentTitle(Magatzem.t(dades, "crida", "M'has cridat? Toca per parlar"))
                .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_CALL)
                .setContentIntent(p).setAutoCancel(true).setTimeoutAfter(20_000)
                .setFullScreenIntent(p, true);
        try { NotificationManagerCompat.from(this).notify(NOTIF_CRIDA, b.build()); } catch (SecurityException ignored) {}
    }

    // ---------------------------------------------------------------- notificació fixa
    static void canal(Context c, JSONObject dades) {
        Avisos.canals(c, dades);
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel ch = new NotificationChannel(CANAL, Magatzem.t(dades, "canalEscolta", "Escolta «hey soci»"), NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }

    private Notification notificacio() {
        JSONObject dades = Magatzem.llegeix(this);
        canal(this, dades);
        PendingIntent atura = PendingIntent.getService(this, 1, new Intent(this, Escolta.class).setAction(ATURA), PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CANAL)
                .setSmallIcon(R.drawable.ic_stat_soci).setColor(0xFFF2650F)
                .setContentTitle(Magatzem.t(dades, "escoltaNot", "Soci t'escolta: digues «hey soci»"))
                .setContentText(Magatzem.t(dades, "escoltaNot2", "Sense connexió: res no surt del mòbil."))
                .setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(Avisos.obreApp(this))
                .addAction(0, Magatzem.t(dades, "atura", "Atura"), atura)
                .build();
    }

    // ---------------------------------------------------------------- bombolla
    @SuppressLint("ClickableViewAccessibility")
    private void mostraBombolla() {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) return;
        try {
            WindowManager wm = getSystemService(WindowManager.class);
            float d = getResources().getDisplayMetrics().density;
            FrameLayout f = new FrameLayout(this);
            f.setBackgroundResource(R.drawable.giny_cercle);
            f.setAlpha(0.85f);
            ImageView im = new ImageView(this);
            im.setImageResource(R.drawable.giny_mic_icona);
            int m = (int) (10 * d);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
            lp.setMargins(m, m, m, m);
            f.addView(im, lp);
            WindowManager.LayoutParams p = new WindowManager.LayoutParams((int) (44 * d), (int) (44 * d),
                    Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
            p.gravity = Gravity.END | Gravity.TOP;
            p.x = (int) (4 * d);
            p.y = Magatzem.prefs(this).getInt("bombollaY", (int) (220 * d));
            // toca = parla; arrossega amunt i avall per canviar-la de lloc
            final float[] ini = new float[2];
            final boolean[] mogut = {false};
            f.setOnTouchListener((v, e) -> {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: ini[0] = e.getRawY(); ini[1] = p.y; mogut[0] = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dy = e.getRawY() - ini[0];
                        if (Math.abs(dy) > 10 * d) mogut[0] = true;
                        if (mogut[0]) { p.y = (int) Math.max(0, ini[1] + dy); wm.updateViewLayout(f, p); }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (mogut[0]) Magatzem.prefs(this).edit().putInt("bombollaY", p.y).apply();
                        else { posaPausa(true); startActivity(new Intent(this, MainActivity.class).setAction(MainActivity.ESCOLTA).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                        return true;
                    default: return false;
                }
            });
            wm.addView(f, p);
            vistaBombolla = f;
            bombolla = true;
        } catch (Exception e) { bombolla = false; }
    }

    private void treuBombolla() {
        if (vistaBombolla != null) {
            try { getSystemService(WindowManager.class).removeView(vistaBombolla); } catch (Exception ignored) {}
            vistaBombolla = null;
        }
        bombolla = false;
    }
}
