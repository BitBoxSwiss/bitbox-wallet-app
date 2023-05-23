package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

public class Util {
    public static void systemOpen(Application application, String url) throws Exception {
        // https://developer.android.com/guide/components/intents-common.html#java
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (intent.resolveActivity(application.getPackageManager()) != null) {
            application.startActivity(intent);
        }
    }

    public static void log(String msg) {
        Log.d("bitboxapp", msg);
    }
}
