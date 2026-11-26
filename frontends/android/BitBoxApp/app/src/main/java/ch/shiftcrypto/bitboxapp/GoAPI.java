package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;

import mobileserver.GoAPIInterface;

public class GoAPI implements GoAPIInterface {
    public static class Response {
        public long queryID;
        public String response;
    }
    private Handler callResponseHandler;
    private Handler pushNotificationHandler;
    private final Handler widgetHandler = new Handler(Looper.getMainLooper());
    private final LightningWidgetSync lightningWidgetSync;
    private boolean backendStarted;

    public GoAPI(Context context) {
        lightningWidgetSync = new LightningWidgetSync(context.getApplicationContext());
    }

    public void startLightningWidgetSync() {
        widgetHandler.post(() -> {
            backendStarted = true;
            lightningWidgetSync.sync();
        });
    }

    public void syncLightningWidget() {
        widgetHandler.post(() -> {
            if (backendStarted) {
                lightningWidgetSync.sync();
            }
        });
    }

    public void setMessageHandlers(Handler callResponseHandler, Handler pushNotificationHandler) {
        this.callResponseHandler = callResponseHandler;
        this.pushNotificationHandler = pushNotificationHandler;
    }

    public void respond(long queryID, String response) {
        // Native widget requests use negative IDs; web requests start at 1.
        if (queryID < 0) {
            widgetHandler.post(() -> lightningWidgetSync.handleResponse(queryID, response));
            return;
        }
        Message msg = Message.obtain();
        Response resp = new Response();
        resp.queryID = queryID;
        resp.response = response;
        msg.obj = resp;
        callResponseHandler.sendMessage(msg);
    }

    public void pushNotify(String msg) {
        widgetHandler.post(() -> lightningWidgetSync.handleEvent(msg));
        Message m = Message.obtain();
        m.obj = msg;
        pushNotificationHandler.sendMessage(m);
    }
}
