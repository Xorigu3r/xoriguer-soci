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
                return;
            case Programador.ALARMA:
                alarma(c, intent);
                return;
            case Avisos.FET:
            case Avisos.POSPOSA:
            case Avisos.DEMA:
                boto(c, accio, intent.getStringExtra("id"), intent.getIntExtra("minuts", 10));
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
            Avisos.mostra(c, dades, e, previ);
            veu = previ ? e.optString("frasePrevia", "") : e.optString("frase", "");
            try {
                if ("Z".equals(tipus)) e.put("posposa", 0);
                if ("P".equals(tipus) && e.optJSONObject("rep") != null) {
                    // la propera vegada; la notificació d'avui queda a la persiana
                    Magatzem.avancaRepeticio(e, LocalDateTime.now());
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
        String text;
        if (coses.isEmpty()) text = Magatzem.t(dades, "resumCap", "Bon dia! Avui no tens res apuntat.");
        else if (coses.size() == 1) text = Magatzem.t(dades, "resum1", "Bon dia! Avui tens una cosa:") + " " + coses.get(0) + ".";
        else text = Magatzem.t(dades, "resumN", "Bon dia! Avui tens {n} coses:").replace("{n}", String.valueOf(coses.size())) + " " + String.join("; ", coses) + ".";
        Avisos.resum(c, dades, text);
        return text.replaceAll("\\((\\d\\d):(\\d\\d)\\)", "$1:$2");
    }

    private void boto(Context c, String accio, String id, int minuts) {
        if (id == null) return;
        JSONObject dades = Magatzem.llegeix(c);
        JSONObject e = Magatzem.busca(dades, id);
        Avisos.treu(c, id);
        if (e == null) return;
        try {
            boolean rep = e.optJSONObject("rep") != null;
            long ara = System.currentTimeMillis();
            if (Avisos.FET.equals(accio)) {
                if (!rep) { e.put("fet", true); e.put("fetA", ara); }
                e.put("posposa", 0);
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
