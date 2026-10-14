package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

/** Shows native actions requested by the transaction explorer link. */
final class LinkContextMenu {
    static void show(WebView webView, String url, String copy, String open, String openError) {
        if (!URLUtil.isNetworkUrl(url)) {
            return;
        }
        boolean wasLongClickable = webView.isLongClickable();
        webView.setOnCreateContextMenuListener((menu, view, menuInfo) -> {
            menu.setHeaderTitle(url);
            menu.add(copy).setOnMenuItemClickListener(item -> {
                ClipboardManager clipboard = (ClipboardManager) view.getContext()
                        .getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("", url));
                return true;
            });
            menu.add(open).setOnMenuItemClickListener(item -> {
                try {
                    Util.systemOpenExternal((Application) view.getContext().getApplicationContext(), url);
                } catch (Exception e) {
                    Util.log(e.getMessage());
                    Toast.makeText(view.getContext(), openError, Toast.LENGTH_LONG).show();
                }
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
