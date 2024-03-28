package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.Intent;
import android.net.Uri;
import android.os.Process;
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

    public static void quit(MainActivity activity) {
        // Move to background to avoid possible auto-restart after app exit.
        // When in foreground, the system may assume the process quit
        // unexpectedly and can try restarting it: Android can't tell
        // whether the app exited on purpose, suddenly crashed or terminated
        // by the system to reclaim resources.
        activity.moveTaskToBack(true);
        // Send SIGKILL signal to the app's process and let the system shut it down.
        Process.killProcess(Process.myPid());
        // If the above killProcess didn't work and we're still here,
        // simply terminate the JVM as the last resort.
        System.exit(0);
    }
}
