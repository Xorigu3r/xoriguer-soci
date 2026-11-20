package cat.xoriguer.soci;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.List;
import java.util.TimeZone;

/** Llegeix (només llegeix) els esdeveniments del calendari del mòbil: Google Calendar, Samsung, Outlook sincronitzat... */
final class Calendari {
    private Calendari() {}

    static final class Esdeveniment {
        final String titol;
        final long inici;
        final boolean totDia;
        Esdeveniment(String titol, long inici, boolean totDia) { this.titol = titol; this.inici = inici; this.totDia = totDia; }
    }

    static boolean permis(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED;
    }

    /** Esdeveniments visibles (no rebutjats) que comencen o duren entre de i a (ms). */
    static List<Esdeveniment> entre(Context c, long de, long a) {
        List<Esdeveniment> l = new ArrayList<>();
        if (!permis(c)) return l;
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(b, de);
        ContentUris.appendId(b, a);
        String[] cols = {CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.ALL_DAY,
                CalendarContract.Instances.SELF_ATTENDEE_STATUS};
        String sel = CalendarContract.Instances.VISIBLE + "=1";
        try (Cursor cur = c.getContentResolver().query(b.build(), cols, sel, null, CalendarContract.Instances.BEGIN + " ASC")) {
            if (cur == null) return l;
            int offset = TimeZone.getDefault().getOffset(System.currentTimeMillis());
            while (cur.moveToNext() && l.size() < 50) {
                if (cur.getInt(3) == CalendarContract.Attendees.ATTENDEE_STATUS_DECLINED) continue;
                String t = cur.getString(0);
                if (t == null || t.trim().isEmpty()) continue;
                boolean totDia = cur.getInt(2) == 1;
                long inici = cur.getLong(1);
                // els de tot el dia són a mitjanit UTC: passa'ls a mitjanit local
                if (totDia) inici -= offset;
                l.add(new Esdeveniment(t.trim(), inici, totDia));
            }
        } catch (Exception ignored) {}
        return l;
    }
}
