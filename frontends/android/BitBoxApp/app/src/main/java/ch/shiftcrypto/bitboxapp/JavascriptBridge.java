package ch.shiftcrypto.bitboxapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.JavascriptInterface;

import mobileserver.Mobileserver;

public class JavascriptBridge {
    private final Context context;

    public JavascriptBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public String readFromClipboard() {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard.getPrimaryClip() != null) {
            ClipData.Item item = clipboard.getPrimaryClip().getItemAt(0);
            if (item != null) {
                return item.getText().toString();
            }
        }
        return "";
    }

    @JavascriptInterface
    public void call(int queryID, String query) {
        Mobileserver.backendCall(queryID, query);
    }
}
