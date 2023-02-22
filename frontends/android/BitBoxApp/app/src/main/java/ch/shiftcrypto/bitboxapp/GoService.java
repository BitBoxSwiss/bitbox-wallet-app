package ch.shiftcrypto.bitboxapp;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import goserver.GoAPIInterface;
import goserver.GoEnvironmentInterface;
import goserver.Goserver;

public class GoService extends Service {
    // Binder given to clients
    private final IBinder binder = new GoServiceBinder();

    private Boolean started = false;

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

        Notification notification = new NotificationCompat.Builder(this, channelId)
                .setContentTitle("BitBoxApp Go backend service")
                .setContentText("Running in the background")
                .build();

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
        if (!started) {
            Goserver.serve(filePath, goEnvironment, goAPI);
            started = true;
            Util.log("server started!");
        } else {
            Util.log("server already started!");
        }
    }

    public void stopServer() {
        Util.log("GoService: Stopping server...");
        if (started) {
            Goserver.shutdown();
            Util.log("Go server shutdown");
            started = false;
        } else {
            Util.log("Server was not running");
        }
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
