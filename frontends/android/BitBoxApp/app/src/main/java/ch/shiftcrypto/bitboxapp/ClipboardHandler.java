package ch.shiftcrypto.bitboxapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.JavascriptInterface;

public class ClipboardHandler {
    private final Context context;

    public ClipboardHandler(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public String readFromClipboard() {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard.hasPrimaryClip()) {
            ClipData.Item item = clipboard.getPrimaryClip().getItemAt(0);
            if (item != null) {
                return item.getText().toString();
            }
        }
        return "";
    }
}
