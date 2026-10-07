package ch.shiftcrypto.bitboxapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.URLUtil;
import android.webkit.WebView;

/** Shows the native copy menu requested by the transaction explorer link. */
final class LinkContextMenu {
    static void show(WebView webView, String url) {
        if (!URLUtil.isNetworkUrl(url)) {
            return;
        }
        boolean wasLongClickable = webView.isLongClickable();
        webView.setOnCreateContextMenuListener((menu, view, menuInfo) -> {
            menu.setHeaderTitle(url);
            menu.add(android.R.string.copy).setOnMenuItemClickListener(item -> {
                ClipboardManager clipboard = (ClipboardManager) view.getContext()
                        .getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("", url));
                return true;
            });
        });
        try {
            webView.showContextMenu();
        } finally {
            webView.setOnCreateContextMenuListener(null);
            webView.setLongClickable(wasLongClickable);
        }
    }
}
