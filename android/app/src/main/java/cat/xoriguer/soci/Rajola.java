package cat.xoriguer.soci;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** Botó de la barra ràpida (Configuració ràpida): obre Soci escoltant. */
public class Rajola extends TileService {

    @Override
    public void onStartListening() {
        Tile t = getQsTile();
        if (t == null) return;
        t.setIcon(Icon.createWithResource(this, R.drawable.ic_stat_soci));
        t.setLabel(getString(R.string.rajola));
        t.setState(Tile.STATE_INACTIVE);
        t.updateTile();
    }

    @Override
    public void onClick() {
        if (isLocked()) unlockAndRun(this::obre);
        else obre();
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    private void obre() {
        Intent i = new Intent(this, MainActivity.class).setAction(MainActivity.ESCOLTA)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 12, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        } else {
            startActivityAndCollapse(i);
        }
    }
}
