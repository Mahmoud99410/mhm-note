package com.mhm.note;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/** Creates the notification channel used for reminders, with the tone the user picked. */
@CapacitorPlugin(name = "MhmTone")
public class MhmTonePlugin extends Plugin {

    @PluginMethod
    public void createChannel(PluginCall call) {
        String id = call.getString("id");
        String name = call.getString("name", "Reminders");
        String raw = call.getString("raw");   // bundled tone in res/raw
        String path = call.getString("path"); // user-picked file in app files/tones
        if (id == null) {
            call.reject("id missing");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        try {
            Context ctx = getContext();
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            for (NotificationChannel c : nm.getNotificationChannels()) {
                if (c.getId().startsWith("mhm-tone-") && !c.getId().equals(id)) nm.deleteNotificationChannel(c.getId());
            }
            NotificationChannel ch = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[] { 0, 300, 200, 300 });
            AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            Uri uri = null;
            if (raw != null && !raw.isEmpty()) {
                uri = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/" + raw);
            } else if (path != null && !path.isEmpty()) {
                File f = new File(path.replaceFirst("^file://", ""));
                uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
                ctx.grantUriPermission("com.android.systemui", uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            if (uri != null) ch.setSound(uri, aa);
            nm.createNotificationChannel(ch);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
