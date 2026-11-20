package cat.xoriguer.soci;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String ESCOLTA = "cat.xoriguer.soci.ESCOLTA";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SociPlugin.class); // abans de super.onCreate
        super.onCreate(savedInstanceState);
        mira(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        mira(intent);
    }

    /** Giny, barra ràpida, drecera, assistent del mòbil o auriculars: comença a escoltar.
     *  Comparteix → Soci: apunta el text. */
    private void mira(Intent i) {
        if (i == null || i.getAction() == null) return;
        String a = i.getAction();
        if (ESCOLTA.equals(a) || Intent.ACTION_ASSIST.equals(a) || Intent.ACTION_VOICE_COMMAND.equals(a)) {
            i.setAction(Intent.ACTION_MAIN); // que no torni a escoltar en girar la pantalla
            SociPlugin.demanaEscolta();
        } else if (Escolta.HEY.equals(a)) {
            i.setAction(Intent.ACTION_MAIN);
            Escolta.engega(this); // l'app és oberta: ara Android sí que deixa engegar el micròfon
        } else if (Intent.ACTION_SEND.equals(a)) {
            CharSequence t = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
            String assumpte = i.getStringExtra(Intent.EXTRA_SUBJECT);
            String text = t == null ? "" : t.toString().trim();
            if (assumpte != null && !assumpte.trim().isEmpty() && !text.contains(assumpte.trim())) text = assumpte.trim() + ". " + text;
            i.setAction(Intent.ACTION_MAIN);
            if (!text.isEmpty()) SociPlugin.demanaText(text);
        }
    }
}
