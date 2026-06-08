// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.net.Uri;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.Set;

import mobileserver.Mobileserver;

/**
 * Exposes the native mobile bridge only to the app's own origin.
 */
public class WebMessageBridge implements WebViewCompat.WebMessageListener {
    public static final String APP_SCHEME = "https";
    public static final String APP_HOST = "shiftcrypto.ch";
    public static final String APP_ORIGIN = APP_SCHEME + "://" + APP_HOST;
    public static final String BASE_URL = APP_ORIGIN + "/";

    private static final String BRIDGE_NAME = "bitboxSecureBridge";

    private final Context context;

    public WebMessageBridge(Context context) {
        this.context = context;
    }

    public static boolean isSupported() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)
                && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
    }

    @SuppressLint("RequiresFeature")
    public static void install(WebView webView, Context context) {
        Set<String> allowedOriginRules = Collections.singleton(APP_ORIGIN);
        WebViewCompat.addWebMessageListener(
                webView,
                BRIDGE_NAME,
                allowedOriginRules,
                new WebMessageBridge(context)
        );
        WebViewCompat.addDocumentStartJavaScript(
                webView,
                backendCallDocumentStartScript(),
                allowedOriginRules
        );
        WebViewCompat.addDocumentStartJavaScript(
                webView,
                clipboardDocumentStartScript(),
                allowedOriginRules
        );
    }

    @Override
    public void onPostMessage(
            @NonNull WebView view,
            @NonNull WebMessageCompat message,
            @NonNull Uri sourceOrigin,
            boolean isMainFrame,
            @NonNull JavaScriptReplyProxy replyProxy
    ) {
        if (!isTrustedMainFrame(sourceOrigin, isMainFrame)) {
            return;
        }

        String data = message.getData();
        if (data == null) {
            return;
        }

        try {
            JSONObject payload = new JSONObject(data);
            String type = payload.optString("type", "");
            if ("backendCall".equals(type)) {
                Mobileserver.backendCall(payload.getInt("queryID"), payload.getString("query"));
                return;
            }
            if ("readClipboard".equals(type)) {
                int requestId = payload.getInt("requestId");
                respondWithClipboard(replyProxy, requestId, readFromClipboard());
            }
        } catch (Exception e) {
            Util.log("Failed to handle web message: " + e.getMessage());
        }
    }

    private boolean isTrustedMainFrame(Uri sourceOrigin, boolean isMainFrame) {
        if (!isMainFrame) {
            return false;
        }
        if (!APP_SCHEME.equals(sourceOrigin.getScheme())) {
            return false;
        }
        if (!APP_HOST.equals(sourceOrigin.getHost())) {
            return false;
        }
        int port = sourceOrigin.getPort();
        return port == -1 || port == 443;
    }

    private String readFromClipboard() {
        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            return "";
        }
        ClipData primaryClip = clipboard.getPrimaryClip();
        if (primaryClip == null || primaryClip.getItemCount() == 0) {
            return "";
        }
        ClipData.Item item = primaryClip.getItemAt(0);
        if (item == null) {
            return "";
        }
        CharSequence text = item.getText();
        return text != null ? text.toString() : "";
    }

    @SuppressLint("RequiresFeature")
    private void respondWithClipboard(JavaScriptReplyProxy replyProxy, int requestId, String text)
            throws JSONException {
        JSONObject response = new JSONObject();
        response.put("type", "clipboardReadResult");
        response.put("requestId", requestId);
        response.put("success", true);
        response.put("text", text);
        replyProxy.postMessage(response.toString());
    }

    private static String backendCallDocumentStartScript() {
        return String.join("",
                "(function() {",
                "  if (window.top !== window) { return; }",
                "  var bridge = window.", BRIDGE_NAME, ";",
                "  if (!bridge) { return; }",
                "  window.android = {",
                "    call: function(queryID, query) {",
                "      bridge.postMessage(JSON.stringify({",
                "        type: 'backendCall',",
                "        queryID: queryID,",
                "        query: query",
                "      }));",
                "    }",
                "  };",
                "})();"
        );
    }

    private static String clipboardDocumentStartScript() {
        return String.join("",
                "(function() {",
                "  if (window.top !== window) { return; }",
                "  var bridge = window.", BRIDGE_NAME, ";",
                "  if (!bridge) { return; }",
                "  var clipboardRequests = {};",
                "  var nextClipboardRequestId = 0;",
                "  bridge.onmessage = function(event) {",
                "    try {",
                "      var message = JSON.parse(event.data);",
                "      if (!message || message.type !== 'clipboardReadResult') { return; }",
                "      var pending = clipboardRequests[message.requestId];",
                "      if (!pending) { return; }",
                "      delete clipboardRequests[message.requestId];",
                "      if (message.success === false) {",
                "        pending.reject(new Error(message.error || 'Clipboard read failed'));",
                "        return;",
                "      }",
                "      pending.resolve(message.text || '');",
                "    } catch (error) {}",
                "  };",
                "  var clipboard = navigator.clipboard || {};",
                "  clipboard.readText = function() {",
                "    return new Promise(function(resolve, reject) {",
                "      nextClipboardRequestId += 1;",
                "      clipboardRequests[nextClipboardRequestId] = { resolve: resolve, reject: reject };",
                "      bridge.postMessage(JSON.stringify({",
                "        type: 'readClipboard',",
                "        requestId: nextClipboardRequestId",
                "      }));",
                "    });",
                "  };",
                "  if (!navigator.clipboard) {",
                "    Object.defineProperty(navigator, 'clipboard', {",
                "      value: clipboard,",
                "      configurable: true",
                "    });",
                "  }",
                "})();"
        );
    }
}
