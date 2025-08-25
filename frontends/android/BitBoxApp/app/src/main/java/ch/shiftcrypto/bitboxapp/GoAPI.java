package ch.shiftcrypto.bitboxapp;

import android.os.Handler;
import android.os.Message;

import mobileserver.GoAPIInterface;

public class GoAPI implements GoAPIInterface {
    public static class Response {
        public long queryID;
        public String response;
    }
    private Handler callResponseHandler;
    private Handler pushNotificationHandler;

    public void setMessageHandlers(Handler callResponseHandler, Handler pushNotificationHandler) {
        this.callResponseHandler = callResponseHandler;
        this.pushNotificationHandler = pushNotificationHandler;
    }

    public void respond(long queryID, String response) {
        Message msg = Message.obtain();
        Response resp = new Response();
        resp.queryID = queryID;
        resp.response = response;
        msg.obj = resp;
        callResponseHandler.sendMessage(msg);
    }

    public void pushNotify(String msg) {
        Message m = Message.obtain();
        m.obj = msg;
        pushNotificationHandler.sendMessage(m);
    }
}
