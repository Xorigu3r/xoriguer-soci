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

    /** Giny, barra ràpida o drecera «Apunta»: comença a escoltar. */
    private void mira(Intent i) {
        if (i != null && ESCOLTA.equals(i.getAction())) {
            i.setAction(Intent.ACTION_MAIN); // que no torni a escoltar en girar la pantalla
            SociPlugin.demanaEscolta();
        }
    }
}
