package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.hardware.usb.UsbManager;
import android.os.Process;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProviders;

import android.os.Handler;
import android.os.Message;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.util.Log;

import java.io.InputStream;
import java.util.regex.Pattern;

import goserver.Goserver;

public class MainActivity extends AppCompatActivity {
    private final int PERMISSIONS_REQUEST_CAMERA_QRCODE = 0;
    // stores the request from onPermissionRequest until the user has granted or denied the permission.
    private PermissionRequest webViewpermissionRequest;

    private class JavascriptBridge {
        private Context context;

        JavascriptBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void call(int queryID, String query) {
            Goserver.backendCall(queryID, query);
        }
    }

    private final BroadcastReceiver broadcastReceiver = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            handleIntent(intent);
        }
    };

    private static String getMimeType(String url) {
        String type = null;
        String extension = MimeTypeMap.getFileExtensionFromUrl(url);
        if (extension != null) {
            switch (extension) {
                case "js":
                    type = "text/javascript";
                    break;
                default:
                    type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                    break;
            }
        }

        return type;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig){
        super.onConfigurationChanged(newConfig);
    }

    @SuppressLint("HandlerLeak")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        log("lifecycle: onCreate");

        getSupportActionBar().hide(); // hide title bar with app name.
        setContentView(R.layout.activity_main);
        final WebView vw = (WebView)findViewById(R.id.vw);

        // GoModel invokes the Go backend. It is in a ViewModel so it only runs once, not every time
        // onCreate is called (on a configuration change like orientation change)
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.setMessageHandlers(
                new Handler() {
                    @Override
                    public void handleMessage(final Message msg) {
                        final GoViewModel.Response response = (GoViewModel.Response) msg.obj;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                vw.evaluateJavascript("window.onAndroidCallResponse(" + String.valueOf(response.queryID) + ", " + response.response + ");", null);
                            }
                        });
                    }
                },
                new Handler() {
                    @Override
                    public void handleMessage(final Message msg) {
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                vw.evaluateJavascript("window.onAndroidPushNotification(" + (String)(msg.obj) + ");", null);
                            }
                        });
                    }
                }
        );
        vw.clearCache(true);
        vw.clearHistory();
        vw.getSettings().setJavaScriptEnabled(true);
        vw.getSettings().setAllowUniversalAccessFromFileURLs(true);

        vw.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(final WebView view, WebResourceRequest request) {
                // Intercept file:/// urls and serve it from the Android assets folder.
                try {
                    String url = request.getUrl().toString();
                    InputStream inputStream = getAssets().open(url.replace("file:///", "web/"));
                    String mimeType = getMimeType(url);
                    if (mimeType != null) {
                        return new WebResourceResponse(mimeType, "UTF-8", inputStream);
                    }
                    log("Unknown MimeType: " + url);
                } catch(Exception e) {
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Block navigating to any external site inside the app.
                // This is only called if the whole page is about to change. Changes inside an iframe proceed normally.
                try {
                    // Allow opening in external browser instead, for links clicked in the buy page (e.g. links inside the Safello widget).
                    Pattern pattern = Pattern.compile("^file:///account/[^/]+/buy$");
                    if (pattern.matcher(view.getUrl()).matches()) {
                        Util.systemOpen(getApplication(), url);
                        return true;
                    }
                } catch(Exception e) {
                }
                log("Blocked: " + url);
                return true;
            }
        });

        // WebView.setWebContentsDebuggingEnabled(true); // enable remote debugging in chrome://inspect/#devices
        vw.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                log(consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return super.onConsoleMessage(consoleMessage);
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Handle webview permission request for camera when launching the QR code scanner.
                for (String resource : request.getResources()) {
                    if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED) {
                            // App already has the camera permission, so we grant the permission to
                            // the webview.
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            return;
                        }
                        // Otherwise we ask the user for permission.
                        MainActivity.this.webViewpermissionRequest = request;
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                PERMISSIONS_REQUEST_CAMERA_QRCODE);
                        // Permission will be granted or denied in onRequestPermissionsResult()
                        return;
                    }
                }
                request.deny();
            }
        });
        final String javascriptVariableName = "android";
        vw.addJavascriptInterface(new JavascriptBridge(this), javascriptVariableName);
        vw.loadUrl("file:///android_asset/web/index.html");
    }

    private void log(String msg) {
        Log.d("ch.shiftcrypto.bitboxapp", "XYZ: " + msg);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // This is only called reliably when USB is attached with android:launchMode="singleTop"
        super.onNewIntent(intent);
        setIntent(intent); // make sure onResume will have access to this intent
    }

    @Override
    protected void onStart() {
        super.onStart();
        log("lifecycle: onStart");
    }

    @Override
    protected void onResume() {
        super.onResume();
        log("lifecycle: onResume");
        // This is only called reliably when USB is attached with android:launchMode="singleTop"

        // Usb device list is updated on ATTACHED / DETACHED intents.
        // ATTACHED intent is an activity intent in AndroidManifest.xml so the app is launched when
        // a device is attached. On launch or when it is already running, onIntent() is called
        // followed by onResume(), where the intent is handled.
        // DETACHED intent is a broadcast intent which we register here.
        IntentFilter filter = new IntentFilter();
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        registerReceiver(this.broadcastReceiver, filter);

        // We call updateDeviceList() here in case the app was started while the device was already connected.
        // In that case, handleIntent() is not called with ACTION_USB_DEVICE_ATTACHED.
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.updateDeviceList();

    }

    @Override
    protected void onPause() {
        super.onPause();
        log("lifecycle: onPause");
        unregisterReceiver(this.broadcastReceiver);
    }

    private void handleIntent(Intent intent) {
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_ATTACHED)) {
            log("usb: attached");
            goViewModel.updateDeviceList();
        }
        if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_DETACHED)) {
            log("usb: detached");
            goViewModel.updateDeviceList();
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        log("lifecycle: onStop");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        log("lifecycle: onDestroy");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        switch (requestCode) {
            case PERMISSIONS_REQUEST_CAMERA_QRCODE:
                if (this.webViewpermissionRequest != null) {
                    if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                        this.webViewpermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        this.webViewpermissionRequest.deny();
                    }
                    this.webViewpermissionRequest = null;
                }
                break;
        }
    }

    // The app cannot currently handle the back button action to allow users
    // to move between screens back and forth. What happens is the app is "moved"
    // to background as if "home" button were pressed.
    // To avoid unexpected behaviour, we prompt users and force the app process
    // to exit which helps with preserving phone's resources by shutting down
    // all goroutines.
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
    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(MainActivity.this)
            .setTitle("Close BitBoxApp")
            .setMessage("Do you really want to exit?")
            .setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int which) {
                    // Move to background to avoid possible auto-restart after app exit.
                    // When in foreground, the system may assume the process quit
                    // unexpectedly and can try restarting it: Android can't tell
                    // whether the app exited on purpose, suddenly crashed or terminated
                    // by the system to reclaim resources.
                    moveTaskToBack(true);
                    // Send SIGKILL signal to the app's process and let the system shut it down.
                    Process.killProcess(Process.myPid());
                    // If the above killProcess didn't work and we're still here,
                    // simply terminate the JVM as the last resort.
                    System.exit(0);
                }
            })
            .setNegativeButton(android.R.string.no, new DialogInterface.OnClickListener() {
                public void onClick(DialogInterface dialog, int which) {
                    dialog.dismiss();
                }
            })
            .setIcon(android.R.drawable.ic_dialog_alert)
            .show();
    }
}
