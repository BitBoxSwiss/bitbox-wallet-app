package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.webkit.ConsoleMessage;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

public class BitBoxWebChromeClient extends WebChromeClient {

    private final android.content.Context context;
    private final CameraPermissionDelegate cameraPermissionDelegate;
    private final ActivityResultLauncher<String> fileChooserLauncher;
    // Pending callbacks to complete once Activity returns results
    private PermissionRequest pendingWebPermissionRequest;
    // This is for the file picker dialog invoked by file upload forms in the WebView.
    // Used by e.g. MoonPay's KYC forms.
    private ValueCallback<Uri[]> pendingFilePathCallback;

    public BitBoxWebChromeClient(
            @NonNull android.content.Context context,
            @NonNull CameraPermissionDelegate cameraPermissionDelegate,
            @NonNull ActivityResultLauncher<String> fileChooserLauncher
    ) {
        this.context = context.getApplicationContext();
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

    public interface CameraPermissionDelegate {
        void requestCameraPermission(); // triggers ActivityCompat.requestPermissions(...)
    }
}
