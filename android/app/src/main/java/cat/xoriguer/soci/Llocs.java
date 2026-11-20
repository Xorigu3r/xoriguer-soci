package cat.xoriguer.soci;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.location.CurrentLocationRequest;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Avisos en arribar a un lloc o en sortir-ne: llocs desats (dades.llocs) → geofències del sistema.
 *  Una geofència per lloc desat que tingui alguna cosa pendent (avís «quan arribi / surti» o una llista oberta). */
final class Llocs {
    private Llocs() {}
    static final String ACCIO = "cat.xoriguer.soci.LLOC";

    static boolean permis(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean permisSempre(Context c) {
        if (Build.VERSION.SDK_INT < 29) return permis(c);
        return permis(c) && ContextCompat.checkSelfPermission(c, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean google(Context c) {
        try { return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(c) == ConnectionResult.SUCCESS; }
        catch (Throwable t) { return false; }
    }

    private static PendingIntent pi(Context c) {
        Intent i = new Intent(c, LlocReceptor.class).setAction(ACCIO);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        return PendingIntent.getBroadcast(c, 31, i, f);
    }

    /** Què cal vigilar a cada lloc: bit 1 = arribar, bit 2 = sortir. */
    static int vigila(JSONObject dades, String clau) {
        JSONArray a = dades.optJSONArray("entrades");
        JSONObject aj = dades.optJSONObject("ajustos");
        boolean llistes = aj == null || aj.optBoolean("avisLlocs", true);
        int r = 0;
        if (a != null) for (int i = 0; i < a.length(); i++) {
            JSONObject e = a.optJSONObject(i);
            if (e == null || e.optBoolean("fet") || !clau.equals(e.optString("llocClau"))) continue;
            JSONObject on = e.optJSONObject("on");
            if (on != null) r |= "sortir".equals(on.optString("t")) ? 2 : 1;
            else if (llistes && e.optBoolean("llistaOberta")) r |= 1;
        }
        return r;
    }

    /** Torna a posar totes les geofències (en desar, en reiniciar el mòbil...). */
    @SuppressLint("MissingPermission")
    static void reprograma(Context c) {
        if (!permisSempre(c) || !google(c)) return;
        GeofencingClient gc = LocationServices.getGeofencingClient(c);
        JSONObject dades = Magatzem.llegeix(c);
        JSONArray ll = dades.optJSONArray("llocs");
        List<Geofence> gs = new ArrayList<>();
        if (ll != null) for (int i = 0; i < ll.length() && gs.size() < 90; i++) {
            JSONObject l = ll.optJSONObject(i);
            if (l == null || !l.has("lat")) continue;
            int v = vigila(dades, l.optString("clau"));
            if (v == 0) continue;
            int tipus = ((v & 1) != 0 ? Geofence.GEOFENCE_TRANSITION_ENTER : 0) | ((v & 2) != 0 ? Geofence.GEOFENCE_TRANSITION_EXIT : 0);
            gs.add(new Geofence.Builder()
                    .setRequestId(l.optString("id", "l" + i))
                    .setCircularRegion(l.optDouble("lat"), l.optDouble("lon"), (float) Math.max(100, l.optDouble("radi", 150)))
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(tipus)
                    .setLoiteringDelay(60_000)
                    .build());
        }
        PendingIntent p = pi(c);
        gc.removeGeofences(p).addOnCompleteListener(t -> {
            if (gs.isEmpty()) return;
            GeofencingRequest req = new GeofencingRequest.Builder()
                    .setInitialTrigger(0) // no avisis pel lloc on ja ets ara
                    .addGeofences(gs).build();
            try { gc.addGeofences(req, p); } catch (Exception ignored) {}
        });
    }

    /** On sóc ara (per desar un lloc o on he aparcat). */
    @SuppressLint("MissingPermission")
    static void posicio(Context c, Consumer<Location> fi) {
        if (!permis(c)) { fi.accept(null); return; }
        if (google(c)) {
            CurrentLocationRequest r = new CurrentLocationRequest.Builder()
                    .setPriority(Priority.PRIORITY_HIGH_ACCURACY).setMaxUpdateAgeMillis(60_000).setDurationMillis(20_000).build();
            LocationServices.getFusedLocationProviderClient(c).getCurrentLocation(r, null)
                    .addOnSuccessListener(l -> fi.accept(l != null ? l : darrera(c)))
                    .addOnFailureListener(e -> fi.accept(darrera(c)));
            return;
        }
        fi.accept(darrera(c));
    }

    @SuppressLint("MissingPermission")
    private static Location darrera(Context c) {
        LocationManager lm = c.getSystemService(LocationManager.class);
        if (lm == null) return null;
        Location millor = null;
        for (String p : lm.getProviders(true)) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (millor == null || l.getTime() > millor.getTime())) millor = l;
            } catch (Exception ignored) {}
        }
        return millor;
    }
}
