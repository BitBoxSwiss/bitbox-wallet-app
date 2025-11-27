package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.app.ActivityCompat;

/**
 * Encapsulates WebView configuration and interactions so that MainActivity can stay lean.
 */
public class WebViewManager {
    // The WebView is configured with this as the base URL. The purpose is so that requests made
    // from the app include shiftcrypto.ch in the Origin header to allow Moonpay to load in the
    // iframe. Moonpay compares the origin against a list of origins configured in the Moonpay admin.
    // This is a security feature relevant for websites running in browsers, but in the case of the
    // BitBoxApp, it is useless, as any app can do this.
    //
    // Unfortunately there seems to be no simple way to include this header only in requests to Moonpay.
    private static final String BASE_URL = "https://shiftcrypto.ch/";
    private static final int CAMERA_PERMISSION_REQUEST = 0;

    private final MainActivity activity;
    private final GoViewModel goViewModel;

    private WebChromeClient webChromeClient;
    private WebView webView;

    public WebViewManager(MainActivity activity, GoViewModel goViewModel) {
        this.activity = activity;
        this.goViewModel = goViewModel;
        ActivityResultLauncher<String> fileChooserLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.GetContent(),
                uri -> {
                    if (webChromeClient != null) {
                        webChromeClient.onFilePickerResult(uri);
                    }
                }
        );
        WebChromeClient.CameraPermissionDelegate cameraPermissionDelegate = () -> ActivityCompat.requestPermissions(
                activity,
                new String[]{Manifest.permission.CAMERA},
                CAMERA_PERMISSION_REQUEST
        );
        this.webChromeClient = new WebChromeClient(
                activity,
                cameraPermissionDelegate,
                fileChooserLauncher
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    public void initialize(WebView webView) {
        this.webView = webView;
        // For onramp iframe'd widgets like MoonPay.
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        goViewModel.setMessageHandlers(
                new Handler(Looper.getMainLooper(), msg -> {
                    final GoAPI.Response response = (GoAPI.Response) msg.obj;
                    webView.evaluateJavascript(
                            "if (window.onMobileCallResponse) {" +
                                    "window.onMobileCallResponse(" + response.queryID + ", " + response.response + ")};",
                            null
                    );
                    return true;
                }),
                new Handler(Looper.getMainLooper(), msg -> {
                    webView.evaluateJavascript(
                            "if (window.onMobilePushNotification) {" +
                                    "window.onMobilePushNotification(" + msg.obj + ")};",
                            null
                    );
                    return true;
                })
        );

        webView.clearCache(true);
        webView.clearHistory();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setAllowFileAccess(true);
        // Allow widgets to open external links via window.open (handled in BitBoxWebChromeClient).
        settings.setSupportMultipleWindows(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // webView.setWebContentsDebuggingEnabled(true); // enable remote debugging in chrome://inspect/#devices
        // Retrieve the current text zoom setting to adjust the base font size in the WebView.
        int initialZoom = webView.getSettings().getTextZoom();
        webView.setWebViewClient(new WebViewClient(BASE_URL, activity.getAssets(), activity.getApplication(), initialZoom));
        webView.setWebChromeClient(webChromeClient);
        webView.addJavascriptInterface(new JavascriptBridge(activity), "android");
        webView.loadUrl(BASE_URL + "index.html");
    }

    public void handleRequestPermissionsResult(int requestCode, int[] grantResults) {
        if (requestCode != CAMERA_PERMISSION_REQUEST || webChromeClient == null) {
            return;
        }
        boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        webChromeClient.onCameraPermissionResult(granted);
    }

    // Handle Android back button behavior:
    //
    // By default, if the webview can go back in browser history, we do that.
    // If there is no more history, we prompt the user to quit the app. If
    // confirmed, the app will be force quit.
    //
    // The default behavior can be modified by the frontend via the
    // window.onBackButtonPressed() function. See the `useBackButton` React
    // hook. It will be called first, and if it returns false, the default
    // behavior is prevented, otherwise we proceed with the above default
    // behavior.
    //
    // Without forced app process exit, some goroutines may remain active even after
    // the app resumption at which point new copies of goroutines are spun up.
    // Note that this is different from users tapping on "home" button or switching
    // to another app and then back, in which case no extra goroutines are created.
    //
    // A proper fix is to make the backend process run in a separate system thread.
    // Until such solution is implemented, forced app exit seems most appropriate.
    //
    // See the following for details about task and activity stacks:
    // https://developer.android.com/guide/components/activities/tasks-and-back-stack
    public void handleBackPressed() {
        if (webView == null) {
            return;
        }
        activity.runOnUiThread(() -> webView.evaluateJavascript("window.onBackButtonPressed();", value -> {
            boolean doDefault = Boolean.parseBoolean(value);
            if (!doDefault) {
                return;
            }
            // Default behavior: go back in history if we can, otherwise prompt user
            // if they want to quit the app.
            if (webView.canGoBack()) {
                webView.goBack();
                return;
            }
            new AlertDialog.Builder(activity)
                    .setTitle("Close BitBoxApp")
                    .setMessage("Do you really want to exit?")
                    .setPositiveButton(android.R.string.yes, (dialog, which) -> Util.quit(activity))
                    .setNegativeButton(android.R.string.no, (dialog, which) -> dialog.dismiss())
                    .setIcon(android.R.drawable.ic_dialog_alert)
                    .show();
        }));
    }
}
