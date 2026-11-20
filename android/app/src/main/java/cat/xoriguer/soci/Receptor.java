package cat.xoriguer.soci;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** Alarmes (avís, avís previ, posposat, resum), botons de les notificacions i reinicis. */
public class Receptor extends BroadcastReceiver {

    @Override
    public void onReceive(Context c, Intent intent) {
        String accio = intent.getAction();
        if (accio == null) return;
        switch (accio) {
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
            case Intent.ACTION_TIME_CHANGED:
            case Intent.ACTION_TIMEZONE_CHANGED:
            case "android.intent.action.QUICKBOOT_POWERON":
            case "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED":
                Programador.reprograma(c);
                Giny.actualitza(c);
                try { Llocs.reprograma(c); } catch (Throwable ignored) {} // les geofències no sobreviuen a un reinici
                if (Escolta.volgut(c) && !Escolta.enMarxa()) reactivaEscolta(c);
                return;
            case Programador.ALARMA:
                alarma(c, intent);
                return;
            case Avisos.FET:
            case Avisos.POSPOSA:
            case Avisos.DEMA:
                aplica(c, accio, intent.getStringExtra("id"), intent.getIntExtra("minuts", 10));
                return;
            default:
        }
    }

    private void alarma(Context c, Intent intent) {
        String tipus = intent.getStringExtra("tipus");
        String id = intent.getStringExtra("id");
        JSONObject dades = Magatzem.llegeix(c);
        String veu = null;

        if ("R".equals(tipus)) {
            veu = resum(c, dades);
        } else {
            JSONObject e = Magatzem.busca(dades, id);
            if (e == null || e.optBoolean("fet")) { Programador.reprograma(c); return; }
            boolean previ = "A".equals(tipus);
            veu = previ ? e.optString("frasePrevia", "") : e.optString("frase", "");
            // amb el mòbil bloquejat (o amb la bombolla de «hey soci»), Soci diu l'avís i escolta la resposta
            int mode = previ || !Parla.pot(c, dades) ? 0 : Respon.mode(c, dades);
            Avisos.mostra(c, dades, e, previ, null, mode == 2);
            if (mode == 1) Respon.obre(c, id, veu, true);
            if (mode != 0) veu = null;
            try {
                if ("Z".equals(tipus)) e.put("posposa", 0);
                if ("P".equals(tipus)) e.put("insistits", 0);
                if ("P".equals(tipus) && e.optJSONObject("rep") != null) {
                    // la propera vegada; la notificació d'avui queda a la persiana.
                    // «sonat» diu a la web que ja s'ha avançat (Fet no se n'ha de saltar cap)
                    Magatzem.avancaRepeticio(e, LocalDateTime.now());
                    e.put("sonat", System.currentTimeMillis());
                }
                // Insisteix: torna a avisar cada N minuts fins que es marqui Fet (màxim 12 cops)
                JSONObject aj = dades.optJSONObject("ajustos");
                boolean insisteix = e.optBoolean("insisteix") || (aj != null && aj.optBoolean("insisteix"));
                if (!previ && insisteix) {
                    int n = e.optInt("insistits", 0);
                    int min = Math.max(2, aj == null ? 10 : aj.optInt("insisteixMin", 10));
                    if (n < 12) {
                        e.put("insistits", n + 1);
                        e.put("posposa", System.currentTimeMillis() + min * 60_000L);
                    }
                }
            } catch (Exception ignored) {}
            Magatzem.desa(c, dades);
        }
        Programador.reprograma(c);
        Giny.actualitza(c);
        SociPlugin.avisaCanvi();
        if (veu != null && !veu.isEmpty() && Parla.pot(c, dades)) Parla.diu(c, dades, veu, goAsync());
    }

    /** Resum del matí: notificació i frase amb el que toca avui. */
    private String resum(Context c, JSONObject dades) {
        JSONArray a = dades.optJSONArray("entrades");
        LocalDate avui = LocalDate.now();
        List<String> coses = new ArrayList<>();
        if (a != null) for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e == null || e.optBoolean("fet")) continue;
            LocalDateTime q = Magatzem.data(e.optString("quan", null));
            if (q == null || !q.toLocalDate().equals(avui)) continue;
            String f = e.optString("frase", e.optString("text", ""));
            // «Recorda: comprar patates al Macro.» → «comprar patates al Macro, a les 9»
            int dp = f.indexOf(':');
            String x = dp >= 0 ? f.substring(dp + 1).trim() : f;
            if (x.endsWith(".")) x = x.substring(0, x.length() - 1);
            coses.add(String.format("%s (%02d:%02d)", x, q.getHour(), q.getMinute()));
        }
        // + el calendari del mòbil, si s'ha activat a Ajustos
        JSONObject aj = dades.optJSONObject("ajustos");
        if (aj != null && aj.optBoolean("calendari")) {
            long de = Magatzem.ms(avui.atStartOfDay());
            for (Calendari.Esdeveniment ev : Calendari.entre(c, de, de + 86_400_000L - 1)) {
                LocalDateTime q = Magatzem.deMs(ev.inici);
                if (!q.toLocalDate().equals(avui)) continue;
                coses.add(ev.totDia ? ev.titol : String.format("%s (%02d:%02d)", ev.titol, q.getHour(), q.getMinute()));
            }
        }
        String text;
        if (coses.isEmpty()) text = Magatzem.t(dades, "resumCap", "Bon dia! Avui no tens res apuntat.");
        else if (coses.size() == 1) text = Magatzem.t(dades, "resum1", "Bon dia! Avui tens una cosa:") + " " + coses.get(0) + ".";
        else text = Magatzem.t(dades, "resumN", "Bon dia! Avui tens {n} coses:").replace("{n}", String.valueOf(coses.size())) + " " + String.join("; ", coses) + ".";
        Avisos.resum(c, dades, text);
        return text.replaceAll("\\((\\d\\d):(\\d\\d)\\)", "$1:$2");
    }

    /** Android 14+ no deixa engegar el micròfon en arrencar: una notificació per tornar-lo a activar amb un toc. */
    private static void reactivaEscolta(Context c) {
        JSONObject dades = Magatzem.llegeix(c);
        Escolta.canal(c, dades);
        android.app.PendingIntent p = android.app.PendingIntent.getActivity(c, 78,
                new Intent(c, MainActivity.class).setAction(Escolta.HEY).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
        androidx.core.app.NotificationCompat.Builder b = new androidx.core.app.NotificationCompat.Builder(c, Escolta.CANAL)
                .setSmallIcon(R.drawable.ic_stat_soci).setColor(0xFFF2650F)
                .setContentTitle(Magatzem.t(dades, "reactiva", "Toca per tornar a activar «hey soci»"))
                .setContentIntent(p).setAutoCancel(true);
        try { androidx.core.app.NotificationManagerCompat.from(c).notify(4244, b.build()); } catch (SecurityException ignored) {}
    }

    /** Fet / Posposa / Demà: des dels botons de la notificació o des de Respon (per veu). */
    static void aplica(Context c, String accio, String id, int minuts) {
        if (id == null) return;
        JSONObject dades = Magatzem.llegeix(c);
        JSONObject e = Magatzem.busca(dades, id);
        Avisos.treu(c, id);
        if (e == null) return;
        try {
            boolean rep = e.optJSONObject("rep") != null;
            long ara = System.currentTimeMillis();
            e.put("insistits", 0);
            if (Avisos.FET.equals(accio)) {
                if (!rep) { e.put("fet", true); e.put("fetA", ara); }
                e.put("posposa", 0);
                e.put("sonat", 0);
            } else {
                long quan;
                if (Avisos.DEMA.equals(accio)) {
                    LocalDateTime q = Magatzem.data(e.optString("quan", null));
                    LocalDateTime dema = LocalDateTime.of(LocalDate.now().plusDays(1), q != null ? q.toLocalTime() : java.time.LocalTime.of(9, 0));
                    quan = Magatzem.ms(dema);
                } else quan = ara + minuts * 60_000L;
                if (rep) e.put("posposa", quan);       // la repetició segueix igual
                else { e.put("quan", Magatzem.text(Magatzem.deMs(quan))); e.put("avis", true); e.put("posposa", 0); }
            }
        } catch (Exception ignored) {}
        Magatzem.desa(c, dades);
        Programador.reprograma(c);
        Giny.actualitza(c);
        SociPlugin.avisaCanvi();
    }
}
