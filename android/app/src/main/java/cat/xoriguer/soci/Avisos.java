package cat.xoriguer.soci;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

/** Notificacions dels recordatoris (amb botons Fet / +10 min / +1 h / Demà) i del resum del matí. */
final class Avisos {
    private Avisos() {}
    static final String CANAL = "recordatoris";
    static final String CANAL_RESUM = "resum";
    static final String FET = "cat.xoriguer.soci.FET";
    static final String POSPOSA = "cat.xoriguer.soci.POSPOSA";
    static final String DEMA = "cat.xoriguer.soci.DEMA";

    static void canals(Context c, JSONObject dades) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CANAL, Magatzem.t(dades, "canal", "Recordatoris"), NotificationManager.IMPORTANCE_HIGH);
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
        NotificationChannel r = new NotificationChannel(CANAL_RESUM, Magatzem.t(dades, "canalResum", "Resum del matí"), NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(r);
    }

    static int idNot(String id) { return id.hashCode() & 0x7fffffff; }

    private static PendingIntent accio(Context c, String accio, String id, int minuts) {
        Intent i = new Intent(c, Receptor.class).setAction(accio).setData(Uri.parse("soci://" + accio + "/" + id + "/" + minuts));
        i.putExtra("id", id);
        i.putExtra("minuts", minuts);
        return PendingIntent.getBroadcast(c, (accio + id + minuts).hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static PendingIntent obreApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 7, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Mostra l'avís d'una entrada. previ = avís d'abans de l'hora. */
    static void mostra(Context c, JSONObject dades, JSONObject e, boolean previ) { mostra(c, dades, e, previ, null, false); }
    static void mostra(Context c, JSONObject dades, JSONObject e, boolean previ, String cosForcat) { mostra(c, dades, e, previ, cosForcat, false); }

    /** pantalla = obre Respon a pantalla completa (mòbil bloquejat): diu l'avís i escolta la resposta. */
    static void mostra(Context c, JSONObject dades, JSONObject e, boolean previ, String cosForcat, boolean pantalla) {
        canals(c, dades);
        String id = e.optString("id");
        String titol = e.optString("text", "");
        if (titol.isEmpty()) titol = e.optString("lloc", "Soci");
        String cos = cosForcat != null ? cosForcat : previ ? e.optString("frasePrevia", e.optString("frase", "")) : e.optString("frase", "");
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_stat_soci)
                .setColor(0xFFF2650F)
                .setContentTitle(titol)
                .setContentText(cos)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cos))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(obreApp(c))
                .setAutoCancel(true);
        if (!previ) {
            // Android només n'ensenya 3: la resta («+1 h», «demà»...) es diu parlant amb «Respon»
            b.addAction(0, Magatzem.t(dades, "fet", "Fet"), accio(c, FET, id, 0));
            b.addAction(0, Magatzem.t(dades, "m10", "+10 min"), accio(c, POSPOSA, id, 10));
            b.addAction(R.drawable.ic_stat_soci, "🎤 " + Magatzem.t(dades, "respon", "Respon"), Respon.pi(c, id, cos, false));
            if (pantalla) b.setFullScreenIntent(Respon.pi(c, id, cos, true), true);
        }
        try { NotificationManagerCompat.from(c).notify(previ ? idNot(id) + 1 : idNot(id), b.build()); }
        catch (SecurityException ignored) { /* sense permís de notificacions */ }
    }

    static void resum(Context c, JSONObject dades, String text) {
        canals(c, dades);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL_RESUM)
                .setSmallIcon(R.drawable.ic_stat_soci)
                .setColor(0xFFF2650F)
                .setContentTitle(Magatzem.t(dades, "canalResum", "Resum del matí"))
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(obreApp(c))
                .setAutoCancel(true);
        try { NotificationManagerCompat.from(c).notify(1, b.build()); } catch (SecurityException ignored) {}
    }

    static void treu(Context c, String id) {
        NotificationManagerCompat.from(c).cancel(idNot(id));
    }
}
