package cat.xoriguer.soci;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

/** Programa les alarmes de tots els avisos. Tipus: P = a l'hora, A = avís previ, Z = posposat, R = resum del matí. */
final class Programador {
    private Programador() {}
    static final String ALARMA = "cat.xoriguer.soci.ALARMA";

    static boolean exactes(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = c.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    private static PendingIntent pi(Context c, String clau, int flags) {
        Intent i = new Intent(c, Receptor.class).setAction(ALARMA).setData(Uri.parse("soci://alarma/" + clau));
        int sep = clau.indexOf('/');
        i.putExtra("tipus", clau.substring(0, sep));
        i.putExtra("id", clau.substring(sep + 1));
        return PendingIntent.getBroadcast(c, clau.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | flags);
    }

    /** Torna a calcular totes les alarmes a partir de les dades. Avança les repeticions que han quedat enrere. */
    static void reprograma(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (am == null) return;
        // 1. cancel·la les d'abans
        Set<String> velles = Magatzem.prefs(c).getStringSet("programades", new HashSet<>());
        for (String k : velles) {
            PendingIntent p = pi(c, k, PendingIntent.FLAG_NO_CREATE);
            if (p != null) { am.cancel(p); p.cancel(); }
        }
        // 2. calcula les noves
        Set<String> noves = new HashSet<>();
        JSONObject dades = Magatzem.llegeix(c);
        JSONArray a = dades.optJSONArray("entrades");
        LocalDateTime ara = LocalDateTime.now();
        long araMs = System.currentTimeMillis();
        boolean canvi = false;
        if (a != null) for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e == null || e.optBoolean("fet")) continue;
            String id = e.optString("id");
            if (Magatzem.avancaRepeticio(e, ara)) canvi = true;
            long posposa = e.optLong("posposa", 0);
            if (posposa > araMs) { posa(c, am, "Z/" + id, posposa); noves.add("Z/" + id); }
            if (!e.optBoolean("avis")) continue;
            LocalDateTime q = Magatzem.data(e.optString("quan", null));
            if (q == null) continue;
            long qms = Magatzem.ms(q);
            if (qms > araMs) { posa(c, am, "P/" + id, qms); noves.add("P/" + id); }
            int abans = e.optInt("abans", 0);
            if (abans > 0) {
                long pms = qms - abans * 60_000L;
                if (pms > araMs) { posa(c, am, "A/" + id, pms); noves.add("A/" + id); }
            }
        }
        // 3. resum del matí
        JSONObject aj = dades.optJSONObject("ajustos");
        if (aj != null && aj.optBoolean("resum")) {
            LocalTime h = Magatzem.hora(aj.optString("resumHora", "08:30"), 8, 30);
            LocalDateTime r = LocalDateTime.of(LocalDate.now(), h);
            if (!r.isAfter(ara)) r = r.plusDays(1);
            posa(c, am, "R/resum", Magatzem.ms(r));
            noves.add("R/resum");
        }
        if (canvi) Magatzem.desa(c, dades);
        Magatzem.prefs(c).edit().putStringSet("programades", noves).apply();
    }

    private static void posa(Context c, AlarmManager am, String clau, long quan) {
        PendingIntent p = pi(c, clau, PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            if (exactes(c)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quan, p);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quan, p);
        } catch (SecurityException se) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quan, p);
        }
    }
}
