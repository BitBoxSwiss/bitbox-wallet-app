package ch.shiftcrypto.bitboxapp;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.webkit.URLUtil;
import android.webkit.WebView;

/** Adds the native copy action when a link is held in the WebView. */
final class LinkContextMenu {
    static void install(WebView webView) {
        webView.setOnCreateContextMenuListener((menu, view, menuInfo) -> {
            WebView.HitTestResult result = webView.getHitTestResult();
            if (result == null || (result.getType() != WebView.HitTestResult.SRC_ANCHOR_TYPE
                    && result.getType() != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE)) {
                return;
            }
            String url = result.getExtra();
            if (url == null || !URLUtil.isNetworkUrl(url)) {
                return;
            }
            menu.setHeaderTitle(url);
            menu.add(android.R.string.copy).setOnMenuItemClickListener(item -> {
                ClipboardManager clipboard = (ClipboardManager) view.getContext()
                        .getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("", url));
                return true;
            });
        });
    }
}
