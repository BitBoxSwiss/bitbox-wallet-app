package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Process;
import android.util.Log;
import android.webkit.MimeTypeMap;

import java.util.regex.Pattern;

public class Util {
    private static final Pattern[] ALLOWED_EXTERNAL_HOSTS = new Pattern[]{
            Pattern.compile("^(.*\\.)?pocketbitcoin\\.com$"),
            Pattern.compile("^(.*\\.)?moonpay\\.com$"),
            Pattern.compile("^(.*\\.)?bitsurance\\.eu$"),
            Pattern.compile("^(.*\\.)?btcdirect\\.eu$"),
            Pattern.compile("^(.*\\.)?bitrefill\\.com$")
    };

    public static boolean isAllowedExternalHost(String host) {
        if (host == null) {
            return false;
        }
        for (Pattern pattern : ALLOWED_EXTERNAL_HOSTS) {
            if (pattern.matcher(host).matches()) {
                return true;
            }
        }
        return false;
    }

    public static void systemOpenExternal(Application application, String url) throws Exception {
        Context context = application.getApplicationContext();
        Intent intent;
        intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(url));

        Intent chooserIntent = Intent.createChooser(intent, null);
        chooserIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(chooserIntent);
        } catch (ActivityNotFoundException e) {
            throw new Exception("There are no applications available to handle " + url);
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

    public static String getMimeType(String url) {
        String type = null;
        String extension = MimeTypeMap.getFileExtensionFromUrl(url);
        if (extension != null) {
            if (extension.equals("js")) {
                type = "text/javascript";
            } else {
                type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            }
        }
        return type;
    }

    public static String getMimeTypeOrDefault(String url) {
        String type = getMimeType(url);
        return type != null ? type : "application/octet-stream";
    }
}
