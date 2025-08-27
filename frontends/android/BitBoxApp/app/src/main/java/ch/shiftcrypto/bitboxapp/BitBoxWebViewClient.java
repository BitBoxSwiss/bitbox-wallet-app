package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.res.AssetManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class BitBoxWebViewClient extends WebViewClient {
    private final String baseUrl;
    private final AssetManager assets;
    private final Application appContext;

    public BitBoxWebViewClient(String baseUrl, AssetManager assets, Application appContext) {
        this.assets = assets;
        this.appContext = appContext;
        this.baseUrl = baseUrl;
    }
    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        // override the default readText method, that doesn't work
        // because of read permission denied.
        view.evaluateJavascript(
                "navigator.clipboard.readText = () => {" +
                        "    return android.readFromClipboard();" +
                        "};", null);
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(final WebView view, WebResourceRequest request) {
        if (request != null && request.getUrl() != null) {
            String url = request.getUrl().toString();
            if (url.startsWith(baseUrl)) {
                // Intercept local requests and serve the response from the Android assets folder.
                try {
                    InputStream inputStream = assets.open(url.replace(baseUrl, "web/"));
                    String mimeType = Util.getMimeType(url);
                    if (mimeType != null) {
                        return new WebResourceResponse(mimeType, "UTF-8", inputStream);
                    }
                    Util.log("Unknown MimeType: " + url);
                } catch (IOException e) {
                    Util.log("Internal resource not found: " + url);
                }
            } else {
                // external request
                // Unlike the Qt app, we don't allow requests based on which URL we are in
                // currently within the React app, as it's very hard to figure what the
                // current app URL is without having the frontend itself inform us.
                return super.shouldInterceptRequest(view, request);
            }
        } else {
            Util.log("Null request!");
        }
        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes()));
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest
            request) {
        // Block navigating to any external site inside the app.
        // This is only called if the whole page is about to change. Changes inside an iframe proceed normally.
        String url = request.getUrl().toString();

        try {
            // Allow opening in external browser instead, for listed domains.
            List<Pattern> patterns = new ArrayList<>();
            patterns.add(Pattern.compile("^(.*\\.)?pocketbitcoin\\.com$"));
            patterns.add(Pattern.compile("^(.*\\.)?moonpay\\.com$"));
            patterns.add(Pattern.compile("^(.*\\.)?bitsurance\\.eu$"));
            patterns.add(Pattern.compile("^(.*\\.)?btcdirect\\.eu$"));

            for (Pattern pattern : patterns) {
                String host = request.getUrl().getHost();
                if (host != null && pattern.matcher(host).matches()) {
                    Util.systemOpen(appContext, url);
                    return true;
                }
            }
        } catch (Exception e) {
            Util.log(e.getMessage());
        }
        Util.log("Blocked: " + url);
        return true;
    }

}
