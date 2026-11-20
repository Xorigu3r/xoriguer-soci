package cat.xoriguer.soci;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

/** Còpies a Documents/Soci: una al dia (7 fitxers que roden, un per dia de la setmana) i les exportacions. */
final class Copies {
    private Copies() {}
    static final String CARPETA = "Documents/Soci";

    /** Fa la còpia del dia si encara no s'ha fet. */
    static void diaria(Context c) {
        String avui = LocalDate.now().toString();
        if (avui.equals(Magatzem.prefs(c).getString("darreraCopia", ""))) return;
        String text = Magatzem.llegeixText(c);
        if (text == null) return;
        try {
            escriu(c, "soci-copia-" + LocalDate.now().getDayOfWeek().getValue() + ".json", text);
            Magatzem.prefs(c).edit().putString("darreraCopia", avui).apply();
        } catch (Exception ignored) { /* ja ho provarà demà */ }
    }

    /** Escriu (o sobreescriu) un fitxer a Documents/Soci. Retorna el camí que veu l'usuari. */
    static String escriu(Context c, String nom, String text) throws Exception {
        byte[] b = text.getBytes(StandardCharsets.UTF_8);
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver cr = c.getContentResolver();
            Uri col = MediaStore.Files.getContentUri("external");
            Uri uri = null;
            try (Cursor k = cr.query(col, new String[]{MediaStore.MediaColumns._ID},
                    MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + "=?",
                    new String[]{CARPETA + "/", nom}, null)) {
                if (k != null && k.moveToFirst()) uri = Uri.withAppendedPath(col, String.valueOf(k.getLong(0)));
            }
            if (uri == null) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, nom);
                v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, CARPETA);
                uri = cr.insert(col, v);
            }
            if (uri == null) throw new Exception("MediaStore");
            try (OutputStream o = cr.openOutputStream(uri, "wt")) {
                if (o == null) throw new Exception("MediaStore");
                o.write(b);
            }
            return CARPETA + "/" + nom;
        }
        File dir = new File(c.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS), "Soci");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File f = new File(dir, nom);
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(b); }
        return f.getAbsolutePath();
    }
}
