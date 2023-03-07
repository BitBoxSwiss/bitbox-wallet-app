package ch.shiftcrypto.bitboxapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

import goserver.GoAPIInterface;
import goserver.GoEnvironmentInterface;
import goserver.Goserver;

public class GoService extends Service {
    // Binder given to clients
    private final IBinder binder = new GoServiceBinder();

    private boolean started = false;

    private Lock startedLock = new ReentrantLock();

    private final String channelId = "21";

    private final int notificationId = 8;

    @Override
    public void onCreate() {
        Util.log("GoService onCreate()");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "BitBoxApp",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("BitBoxApp service notification channel");
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
        // Create a PendingIntent that starts the main activity of your app
        Intent notificationIntent = new Intent(getApplicationContext(),MainActivity.class);
        notificationIntent.setAction(Intent.ACTION_MAIN);
        notificationIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        notificationIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent contentIntent = PendingIntent.getActivity(
                getApplicationContext(),
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle(getString(R.string.app_name))
                .setContentText("Running in the background to ensure connection stability")
                .setSmallIcon(R.drawable.ic_notification)
                .setWhen(System.currentTimeMillis())
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .build();
        startForeground(notificationId,notification);

        // The service goes in foreground to keep working normally even when the app is out of
        // focus. This is needed to avoid timeouts when the backend is polling the BitBox for e.g.
        // an address verification.
        startForeground(notificationId, notification);
        Util.log("GoService onCreate completed");
    }

    @Override
    public void onDestroy() {
        Util.log("GoService onDestroy()");
    }

    public void startServer(String filePath, GoEnvironmentInterface goEnvironment, GoAPIInterface goAPI) {
        Util.log("GoService: Starting server...");
        startedLock.lock();
        if (!started) {
            Goserver.serve(filePath, goEnvironment, goAPI);
            started = true;
            Util.log("server started!");
        } else {
            Util.log("server already started!");
        }
        startedLock.unlock();
    }

    public class GoServiceBinder extends Binder {
        GoService getService() {
            return GoService.this;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }
}
