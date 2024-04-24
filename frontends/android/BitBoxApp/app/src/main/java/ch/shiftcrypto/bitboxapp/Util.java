package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Process;
import android.util.Log;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import java.io.File;

public class Util {
    public static void systemOpen(Application application, String url) throws Exception {
        Context context = application.getApplicationContext();
        Intent intent;
        if (url.startsWith("/")) {
            // local file
            intent = new Intent(Intent.ACTION_SEND);
            Uri uri = FileProvider.getUriForFile(context,
                    context.getPackageName() + ".provider",
                    new File(url));
            intent.setDataAndType(uri, getMimeType(url));
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            // external link
            intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(url));
        }

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
            switch (extension) {
                case "js":
                    type = "text/javascript";
                    break;
                default:
                    type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    break;
            }
        }
        return type;
    }
}
