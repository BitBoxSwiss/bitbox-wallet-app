package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Application;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Message;
import android.webkit.ConsoleMessage;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;
import org.json.JSONTokener;

public class WebChromeClient extends android.webkit.WebChromeClient {

    private final android.content.Context context;
    private final Application application;
    private final CameraPermissionDelegate cameraPermissionDelegate;
    private final ActivityResultLauncher<String> fileChooserLauncher;
    private boolean externalLinkPromptActive;
    // Pending callbacks to complete once Activity returns results
    private PermissionRequest pendingWebPermissionRequest;
    // This is for the file picker dialog invoked by file upload forms in the WebView.
    // Used by e.g. MoonPay's KYC forms.
    private ValueCallback<Uri[]> pendingFilePathCallback;

    public WebChromeClient(
            @NonNull android.content.Context context,
            @NonNull CameraPermissionDelegate cameraPermissionDelegate,
            @NonNull ActivityResultLauncher<String> fileChooserLauncher
    ) {
        this.context = context;
        this.application = (Application) context.getApplicationContext();
        this.cameraPermissionDelegate = cameraPermissionDelegate;
        this.fileChooserLauncher = fileChooserLauncher;
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
        Util.log(consoleMessage.message() + " -- From line "
                + consoleMessage.lineNumber() + " of "
                + consoleMessage.sourceId());
        return super.onConsoleMessage(consoleMessage);
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
        pendingFilePathCallback = filePathCallback;
        String[] mimeTypes = fileChooserParams.getAcceptTypes();
        String fileType = "*/*";
        if (mimeTypes.length == 1 && MimeTypeMap.getSingleton().hasMimeType(mimeTypes[0])) {
            fileType = mimeTypes[0];
        }
        fileChooserLauncher.launch(fileType);
        return true;
    }

    // This is the fileChooserLauncher result callback, set up on registration in MainActivity
    public void onFilePickerResult(Uri uri) {
        if (pendingFilePathCallback != null) {
            if (uri != null) {
                pendingFilePathCallback.onReceiveValue(new Uri[]{uri});
            } else {
                Util.log("Received null Uri in activity result");
                pendingFilePathCallback.onReceiveValue(new Uri[]{});
            }
            pendingFilePathCallback = null;
        }
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        // if there was already a pending permission request, let's deny it before proceeding
        if (pendingWebPermissionRequest != null) {
            pendingWebPermissionRequest.deny();
            pendingWebPermissionRequest = null;
        }
        // Handle webview permission request for camera when launching the QR code scanner.
        for (String resource : request.getResources()) {
            if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED) {
                    // App already has the camera permission, so we grant the permission to
                    // the webview.
                    request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    return;
                }
                // Otherwise ask Activity to request the camera and keep the request pending.
                pendingWebPermissionRequest = request;
                cameraPermissionDelegate.requestCameraPermission();
                return;
            }
        }
        request.deny();
    }

    public void onCameraPermissionResult(boolean granted) {
        if (pendingWebPermissionRequest != null) {
            if (granted) {
                pendingWebPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingWebPermissionRequest.deny();
            }
            pendingWebPermissionRequest = null;
        }
    }

    private static class ExternalLinkPrompt {
        private final String cancelLabel;
        private final String confirmLabel;
        private final String message;
        private final String title;

        private ExternalLinkPrompt(String cancelLabel, String confirmLabel, String message, String title) {
            this.cancelLabel = cancelLabel;
            this.confirmLabel = confirmLabel;
            this.message = message;
            this.title = title;
        }
    }

    private ExternalLinkPrompt fallbackExternalLinkPrompt(String url) {
        return new ExternalLinkPrompt(
                "Cancel",
                "Proceed",
                "You are about to open URL " + url + " in your system browser. Proceed?",
                "Open external link"
        );
    }

    private String translatedValue(JSONObject translations, String key, String fallback) {
        String value = translations.optString(key, "");
        return value.isEmpty() ? fallback : value;
    }

    private ExternalLinkPrompt parseExternalLinkPrompt(String result, String url) {
        ExternalLinkPrompt fallback = fallbackExternalLinkPrompt(url);
        try {
            Object serializedTranslations = new JSONTokener(result).nextValue();
            if (!(serializedTranslations instanceof String)) {
                return fallback;
            }
            JSONObject translations = new JSONObject((String) serializedTranslations);
            return new ExternalLinkPrompt(
                    translatedValue(translations, "cancelLabel", fallback.cancelLabel),
                    translatedValue(translations, "confirmLabel", fallback.confirmLabel),
                    translatedValue(translations, "message", fallback.message),
                    translatedValue(translations, "title", fallback.title)
            );
        } catch (Exception e) {
            return fallback;
        }
    }

    private void showExternalLinkPrompt(WebView view, String url) {
        if (externalLinkPromptActive) {
            return;
        }
        externalLinkPromptActive = true;

        String script = "(function() {" +
                "if (typeof window.getExternalLinkPrompt !== 'function') { return null; }" +
                "return JSON.stringify(window.getExternalLinkPrompt(" + JSONObject.quote(url) + "));" +
                "})()";
        view.evaluateJavascript(script, result -> {
            if (!(context instanceof Activity)
                    || ((Activity) context).isFinishing()
                    || ((Activity) context).isDestroyed()) {
                externalLinkPromptActive = false;
                return;
            }

            ExternalLinkPrompt prompt = parseExternalLinkPrompt(result, url);
            AlertDialog dialog = new AlertDialog.Builder(context)
                    .setTitle(prompt.title)
                    .setMessage(prompt.message)
                    .setPositiveButton(prompt.confirmLabel, (ignored, which) -> {
                        try {
                            Util.systemOpenExternal(application, url);
                        } catch (Exception e) {
                            Util.log(e.getMessage());
                        }
                    })
                    .setNegativeButton(prompt.cancelLabel, null)
                    .create();
            dialog.setOnDismissListener(ignored -> externalLinkPromptActive = false);
            try {
                dialog.show();
            } catch (RuntimeException e) {
                externalLinkPromptActive = false;
                Util.log("Failed to show external link prompt: " + e.getMessage());
            }
        });
    }

    @Override
    public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
        // Handle window.open()/target=_blank by opening allowed domains externally.
        WebView tempView = new WebView(view.getContext());
        tempView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView webView, WebResourceRequest request) {
                String url = request.getUrl().toString();
                String host = request.getUrl().getHost();
                try {
                    if (Util.isAllowedExternalHost(host)) {
                        showExternalLinkPrompt(view, url);
                        return true;
                    }
                } catch (Exception e) {
                    Util.log(e.getMessage());
                }
                Util.log("Blocked: " + url);
                return true;
            }
        });
        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(tempView);
        resultMsg.sendToTarget();
        return true;
    }

    public interface CameraPermissionDelegate {
        void requestCameraPermission(); // triggers ActivityCompat.requestPermissions(...)
    }
}
