package cat.xoriguer.soci;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Has arribat a un lloc desat (o n'has sortit): avisa de les coses d'aquell lloc, amb notificació i veu. */
public class LlocReceptor extends BroadcastReceiver {
    private static final long REPOS = 30 * 60_000L; // no tornis a avisar de la mateixa cosa abans de 30 min

    @Override
    public void onReceive(Context c, Intent intent) {
        GeofencingEvent ev = GeofencingEvent.fromIntent(intent);
        if (ev == null || ev.hasError() || ev.getTriggeringGeofences() == null) return;
        int tr = ev.getGeofenceTransition();
        boolean arriba = tr == Geofence.GEOFENCE_TRANSITION_ENTER || tr == Geofence.GEOFENCE_TRANSITION_DWELL;
        JSONObject dades = Magatzem.llegeix(c);
        JSONArray ll = dades.optJSONArray("llocs");
        JSONArray a = dades.optJSONArray("entrades");
        JSONObject aj = dades.optJSONObject("ajustos");
        boolean llistes = aj == null || aj.optBoolean("avisLlocs", true);
        if (ll == null || a == null) return;
        long ara = System.currentTimeMillis();
        List<String> frases = new ArrayList<>();
        String darrerId = null;
        for (Geofence g : ev.getTriggeringGeofences()) {
            String clau = null;
            for (int i = 0; i < ll.length(); i++) {
                JSONObject l = ll.optJSONObject(i);
                if (l != null && g.getRequestId().equals(l.optString("id"))) { clau = l.optString("clau"); break; }
            }
            if (clau == null) continue;
            for (int i = 0; i < a.length(); i++) {
                JSONObject e = a.optJSONObject(i);
                if (e == null || e.optBoolean("fet") || !clau.equals(e.optString("llocClau"))) continue;
                JSONObject on = e.optJSONObject("on");
                boolean toca = on != null ? ("sortir".equals(on.optString("t")) != arriba) : (arriba && llistes && e.optBoolean("llistaOberta"));
                if (!toca || ara - e.optLong("avisatLloc", 0) < REPOS) continue;
                String f = e.optString("fraseLloc", "");
                if (f.isEmpty()) continue;
                try { e.put("avisatLloc", ara); } catch (Exception ignored) {}
                Avisos.mostra(c, dades, e, false, f);
                frases.add(f);
                darrerId = e.optString("id");
            }
        }
        if (frases.isEmpty()) return;
        Magatzem.desa(c, dades);
        SociPlugin.avisaCanvi();
        String veu = String.join(" ", frases);
        if (Parla.pot(c, dades)) {
            if (frases.size() == 1 && Respon.potEscoltar(c, dades)) Respon.obre(c, darrerId, veu, true);
            else Parla.diu(c, dades, veu, goAsync());
        }
    }
}
