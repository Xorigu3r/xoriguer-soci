package cat.xoriguer.soci;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.Locale;

/** Giny de la pantalla d'inici: botó de micròfon (dicta) i la pròxima cosa apuntada. */
public class Giny extends AppWidgetProvider {

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) { pinta(c, m, ids); }

    static void actualitza(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, Giny.class));
        if (ids != null && ids.length > 0) pinta(c, m, ids);
    }

    static PendingIntent escolta(Context c) {
        Intent i = new Intent(c, MainActivity.class).setAction(MainActivity.ESCOLTA)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 11, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void pinta(Context c, AppWidgetManager m, int[] ids) {
        JSONObject dades = Magatzem.llegeix(c);
        String[] seg = proper(dades);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.giny);
            v.setTextViewText(R.id.giny_titol, seg[0]);
            v.setTextViewText(R.id.giny_text, seg[1]);
            v.setOnClickPendingIntent(R.id.giny_mic, escolta(c));
            v.setOnClickPendingIntent(R.id.giny_cos, Avisos.obreApp(c));
            m.updateAppWidget(id, v);
        }
    }

    /** [quan, què] de la pròxima entrada pendent amb data. */
    private static String[] proper(JSONObject dades) {
        JSONArray a = dades.optJSONArray("entrades");
        LocalDateTime ara = LocalDateTime.now().minusMinutes(1);
        JSONObject millor = null;
        LocalDateTime mq = null;
        if (a != null) for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e == null || e.optBoolean("fet")) continue;
            LocalDateTime q = Magatzem.data(e.optString("quan", null));
            if (q == null || q.isBefore(ara)) continue;
            if (mq == null || q.isBefore(mq)) { mq = q; millor = e; }
        }
        String apunta = Magatzem.t(dades, "apunta", "Apunta");
        if (millor == null) return new String[]{apunta, Magatzem.t(dades, "res", "Res pendent")};
        Locale loc = Locale.forLanguageTag(Magatzem.llengua(dades));
        LocalDate d = mq.toLocalDate(), avui = LocalDate.now();
        String dia;
        if (d.equals(avui)) dia = "";
        else if (d.equals(avui.plusDays(1))) dia = Magatzem.t(dades, "dema", "Demà") + " ";
        else if (d.isBefore(avui.plusDays(7))) dia = d.getDayOfWeek().getDisplayName(TextStyle.SHORT, loc) + " ";
        else dia = d.format(DateTimeFormatter.ofPattern("d MMM", loc)) + " ";
        String text = millor.optString("text", "");
        String lloc = millor.optString("lloc", "");
        if (!lloc.isEmpty() && !text.toLowerCase(loc).contains(lloc.toLowerCase(loc))) text += " · " + lloc;
        return new String[]{dia + String.format(loc, "%02d:%02d", mq.getHour(), mq.getMinute()), text};
    }
}
