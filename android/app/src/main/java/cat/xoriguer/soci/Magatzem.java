package cat.xoriguer.soci;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Dades de l'app: un sol JSON {entrades:[...], ajustos:{...}} que escriu la web (app.js) i que Android llegeix i retoca
 *  (Fet, Posposa, repeticions). Dates en hora local «YYYY-MM-DDTHH:MM». */
final class Magatzem {
    private Magatzem() {}
    static final Object PANY = new Object();
    private static final DateTimeFormatter ISO = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm");

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("soci", Context.MODE_PRIVATE); }

    static String llegeixText(Context c) { return prefs(c).getString("dades", null); }

    static JSONObject llegeix(Context c) {
        synchronized (PANY) {
            try {
                String s = llegeixText(c);
                JSONObject o = s == null ? new JSONObject() : new JSONObject(s);
                if (!o.has("entrades")) o.put("entrades", new JSONArray());
                if (!o.has("ajustos")) o.put("ajustos", new JSONObject());
                return o;
            } catch (Exception e) {
                return buit();
            }
        }
    }

    private static JSONObject buit() {
        JSONObject o = new JSONObject();
        try { o.put("entrades", new JSONArray()); o.put("ajustos", new JSONObject()); } catch (Exception ignored) {}
        return o;
    }

    static void desa(Context c, String text) {
        synchronized (PANY) { prefs(c).edit().putString("dades", text).apply(); }
    }

    static void desa(Context c, JSONObject o) { desa(c, o.toString()); }

    static JSONObject busca(JSONObject dades, String id) {
        JSONArray a = dades.optJSONArray("entrades");
        if (a == null || id == null) return null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e != null && id.equals(e.optString("id"))) return e;
        }
        return null;
    }

    // ---------------------------------------------------------------- dates
    static LocalDateTime data(String s) {
        if (s == null || s.length() < 16 || "null".equals(s)) return null;
        try { return LocalDateTime.parse(s.substring(0, 16), ISO); } catch (Exception e) { return null; }
    }
    static String text(LocalDateTime d) { return d.format(ISO); }
    static long ms(LocalDateTime d) { return d.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(); }
    static LocalDateTime deMs(long ms) { return LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(ms), ZoneId.systemDefault()); }

    static LocalTime hora(String s, int hDef, int mDef) {
        try { String[] p = s.split(":"); return LocalTime.of(Integer.parseInt(p[0]), Integer.parseInt(p[1])); }
        catch (Exception e) { return LocalTime.of(hDef, mDef); }
    }

    /** Pròxima data estrictament després de d segons la regla (= Interpret.seguent d'interpret.js). */
    static LocalDateTime seguent(JSONObject rep, LocalDateTime d) {
        if (rep == null || d == null) return null;
        String t = rep.optString("t");
        int n = Math.max(1, rep.optInt("n", 1));
        switch (t) {
            case "dia": return d.plusDays(n);
            case "setmana": {
                if (n > 1) return d.plusWeeks(n); // «cada 2 setmanes»: el mateix dia
                JSONArray dies = rep.optJSONArray("dies");
                if (dies == null || dies.length() == 0) return d.plusWeeks(1);
                for (int i = 1; i <= 7; i++) {
                    LocalDateTime y = d.plusDays(i);
                    int dw = y.getDayOfWeek().getValue(); // 1 = dilluns
                    for (int k = 0; k < dies.length(); k++) if (dies.optInt(k) == dw) return y;
                }
                return d.plusWeeks(1);
            }
            case "mes": {
                int nth = rep.optInt("nth", 0);
                if (nth != 0) {
                    // «el primer dilluns de cada mes» (nth = -1: l'últim)
                    int dsem = rep.optInt("dsem", 1);
                    LocalDate m = d.toLocalDate().withDayOfMonth(1);
                    for (int i = 0; i < 24; i++) {
                        m = m.plusMonths(1);
                        LocalDate y = nthDia(m, nth, dsem);
                        if (y != null) return LocalDateTime.of(y, d.toLocalTime());
                    }
                    return null;
                }
                int dia = rep.optInt("dia", d.getDayOfMonth());
                LocalDate m = d.toLocalDate().withDayOfMonth(1).plusMonths(n);
                return LocalDateTime.of(m.withDayOfMonth(Math.min(dia, m.lengthOfMonth())), d.toLocalTime());
            }
            case "any": return d.plusYears(n);
            default: return null;
        }
    }

    /** El n-è dia de la setmana dsem (1 = dilluns) del mes de m; n = -1 és l'últim; null si no n'hi ha. */
    static LocalDate nthDia(LocalDate m, int n, int dsem) {
        LocalDate p = m.withDayOfMonth(1);
        if (n > 0) {
            int d = 1 + ((dsem - p.getDayOfWeek().getValue() + 7) % 7) + 7 * (n - 1);
            return d > p.lengthOfMonth() ? null : p.withDayOfMonth(d);
        }
        LocalDate u = p.withDayOfMonth(p.lengthOfMonth());
        return u.minusDays((u.getDayOfWeek().getValue() - dsem + 7) % 7);
    }

    /** Avança una repetició fins que sigui al futur. Retorna true si ha canviat. */
    static boolean avancaRepeticio(JSONObject e, LocalDateTime ara) {
        JSONObject rep = e.optJSONObject("rep");
        LocalDateTime q = data(e.optString("quan", null));
        if (rep == null || q == null || q.isAfter(ara)) return false;
        for (int i = 0; i < 2000 && !q.isAfter(ara); i++) {
            LocalDateTime n = seguent(rep, q);
            if (n == null) return false;
            q = n;
        }
        try { e.put("quan", text(q)); } catch (Exception ignored) {}
        return true;
    }

    /** Text de la web (ajustos.textos) en l'idioma triat, amb recurs en català. */
    static String t(JSONObject dades, String clau, String defecte) {
        JSONObject a = dades.optJSONObject("ajustos");
        JSONObject t = a == null ? null : a.optJSONObject("textos");
        String s = t == null ? null : t.optString(clau, null);
        return s == null || s.isEmpty() ? defecte : s;
    }

    static String llengua(JSONObject dades) {
        JSONObject a = dades.optJSONObject("ajustos");
        String l = a == null ? "ca" : a.optString("llengua", "ca");
        switch (l) {
            case "es": return "es-ES";
            case "fr": return "fr-FR";
            case "en": return "en-GB";
            default: return "ca-ES";
        }
    }
}
