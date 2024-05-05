package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Message;
import android.os.Process;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.Observer;
import androidx.lifecycle.ViewModelProviders;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Pattern;

import mobileserver.Mobileserver;

public class MainActivity extends AppCompatActivity {
    private final int PERMISSIONS_REQUEST_CAMERA_QRCODE = 0;
    private static final String ACTION_USB_PERMISSION = "ch.shiftcrypto.bitboxapp.USB_PERMISSION";
    // The WebView is configured with this as the base URL. The purpose is so that requests made
    // from the app include shiftcrypto.ch in the Origin header to allow Moonpay to load in the
    // iframe. Moonpay compares the origin against a list of origins configured in the Moonpay admin.
    // This is a security feature relevant for websites running in browsers, but in the case of the
    // BitBoxApp, it is useless, as any app can do this.
    //
    // Unfortunately there seems to be no simple way to include this header only in requests to Moonpay.
    private static final String BASE_URL = "https://shiftcrypto.ch/";

    // stores the request from onPermissionRequest until the user has granted or denied the permission.
    private PermissionRequest webViewpermissionRequest;

    GoService goService;

    private String location = "";

    private int currentZoom;

    // This is for the file picker dialog invoked by file upload forms in the WebView.
    // Used by e.g. MoonPay's KYC forms.
    private ValueCallback<Uri[]> filePathCallback;

    // Connection to bind with GoService
    private ServiceConnection connection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            GoService.GoServiceBinder binder = (GoService.GoServiceBinder) service;
            goService = binder.getService();
            Util.log("Bind connection completed!");
            startServer();
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            goService = null;
            Util.log("Bind connection unexpectedly closed!");
        }
    };

    private class JavascriptBridge {
        private Context context;

        JavascriptBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void call(int queryID, String query) {
            Mobileserver.backendCall(queryID, query);
        }
    }

    private final BroadcastReceiver usbStateReceiver = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            handleIntent(intent);
        }
    };

    private BroadcastReceiver networkStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Mobileserver.usingMobileDataChanged();
         }
    };



    @Override
    public void onConfigurationChanged(Configuration newConfig){
        int currentNightMode = newConfig.uiMode & Configuration.UI_MODE_NIGHT_MASK;
        switch (currentNightMode) {
            case Configuration.UI_MODE_NIGHT_NO:
                // Night mode is not active, we're using the light theme
                setDarkTheme(false);
                break;
            case Configuration.UI_MODE_NIGHT_YES:
                // Night mode is active, we're using dark theme
                setDarkTheme(true);
                break;
        }
        super.onConfigurationChanged(newConfig);
    }

    public void setDarkTheme(boolean isDark) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int flags = getWindow().getDecorView().getSystemUiVisibility(); // get current flag
            if (isDark) {
                Util.log("Dark theme");
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                getWindow().setStatusBarColor(ContextCompat.getColor(getApplicationContext(), R.color.colorPrimaryDark));
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;   // remove LIGHT_STATUS_BAR to flag
                getWindow().getDecorView().setSystemUiVisibility(flags);
            } else {
                Util.log("Light theme");
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                getWindow().setStatusBarColor(ContextCompat.getColor(getApplicationContext(), R.color.colorPrimary));
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;   // add LIGHT_STATUS_BAR to flag
                getWindow().getDecorView().setSystemUiVisibility(flags);
            }
        } else {
            Util.log("Status bar theme not updated");
        }
    }

    @SuppressLint("HandlerLeak")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Util.log("lifecycle: onCreate");

        getSupportActionBar().hide(); // hide title bar with app name.
        onConfigurationChanged(getResources().getConfiguration());
        setContentView(R.layout.activity_main);
        final WebView vw = (WebView)findViewById(R.id.vw);
        // For onramp iframe'd widgets like MoonPay.
        CookieManager.getInstance().setAcceptThirdPartyCookies(vw, true);

        // GoModel manages the Go backend. It is in a ViewModel so it only runs once, not every time
        // onCreate is called (on a configuration change like orientation change).
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);

        // The backend is run inside GoService, to avoid (as much as possible) latency errors due to
        // the scheduling when the app is out of focus.
        Intent intent = new Intent(this, GoService.class);
        bindService(intent, connection, Context.BIND_AUTO_CREATE);

        goViewModel.setMessageHandlers(
                new Handler() {
                    @Override
                    public void handleMessage(final Message msg) {
                        final GoViewModel.Response response = (GoViewModel.Response) msg.obj;
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() {
                                vw.evaluateJavascript("window.onMobileCallResponse(" + String.valueOf(response.queryID) + ", " + response.response + ");", null);
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
                                vw.evaluateJavascript("window.onMobilePushNotification(" + (String)(msg.obj) + ");", null);
                            }
                        });
                    }
                }
        );
        vw.clearCache(true);
        vw.clearHistory();
        vw.getSettings().setJavaScriptEnabled(true);
        vw.getSettings().setAllowUniversalAccessFromFileURLs(true);
        vw.getSettings().setAllowFileAccess(true);
        // For MoonPay WebRTC camera access.
        vw.getSettings().setMediaPlaybackRequiresUserGesture(false);

        // Retrieve the current text zoom setting to adjust the base font size in the WebView.
        currentZoom = vw.getSettings().getTextZoom();

        vw.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // The url is not correctly updated when navigating to a new page. This allows to
                // know the current location and to block external requests on that base.
                view.evaluateJavascript("window.location.pathname", path -> location = path);

                // Calculate the base font size for html as a percentage.
                // This percentage dynamically adjusts to ensure 1rem = 10px, scaled according to the current zoom level.
                double baseFontSizePercentage = 62.5 * (currentZoom / 100.0);

                // The default body font size in rem, which is independent of the zoom level.
                // This size does not scale dynamically with zoom adjustments and is fixed at 1.6rem.
                double defaultFontSizeREM = 1.6;

                // Set the base font-size on the html element dynamically and apply a fixed font size to the body.
                // Also, set a custom data attribute 'data-test' to the calculated base font size percentage for potential debugging.
                String cssSetup = "document.documentElement.style.fontSize = '" + baseFontSizePercentage + "%';" +
                                    "document.body.style.fontSize = '" + defaultFontSizeREM + "rem';" +
                                    "document.body.setAttribute('data-test', '" + baseFontSizePercentage + "%');";

                // Reset the WebView's text zoom to 100% to ensure that the scaling is controlled via CSS
                // and not by the WebView's default scaling behavior.
                view.getSettings().setTextZoom(100);

                // Execute the CSS setup in the WebView.
                view.evaluateJavascript(cssSetup, null);

            }
            @Override
            public WebResourceResponse shouldInterceptRequest(final WebView view, WebResourceRequest request) {
                if (request != null && request.getUrl() != null) {
                    String url = request.getUrl().toString();
                    if (url != null && url.startsWith(BASE_URL)) {
                        // Intercept local requests and serve the response from the Android assets folder.
                        try {
                            InputStream inputStream = getAssets().open(url.replace(BASE_URL, "web/"));
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
                        // allow if location is listed
                        List<Pattern> patterns = new ArrayList<>();
                        patterns.add(Pattern.compile("^\"/buy/pocket/.*\"$"));
                        patterns.add(Pattern.compile("^\"/buy/moonpay/.*\"$"));
                        patterns.add(Pattern.compile("^\"/bitsurance/.*\"$"));
                        patterns.add(Pattern.compile("^\"/account/[^\\/]+/wallet-connect/.*\"$"));
                        for (Pattern pattern : patterns) {
                            if (pattern.matcher(location).matches()) {
                                return super.shouldInterceptRequest(view, request);
                            }
                        }

                        String domain = request.getUrl().getHost();
                        if (domain != null) {
                            // allow if domain is listed
                            patterns = new ArrayList<>();
                            patterns.add(Pattern.compile("^verify\\.walletconnect\\.com$"));
                            for (Pattern pattern : patterns) {
                                if (pattern.matcher(domain).matches()) {
                                    return super.shouldInterceptRequest(view, request);
                                }
                            }
                        }
                        Util.log("Blocked: " + url);
                    }
                } else {
                    Util.log("Null request!");
                }
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes()));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view,  WebResourceRequest request) {
                // Block navigating to any external site inside the app.
                // This is only called if the whole page is about to change. Changes inside an iframe proceed normally.
                String url = request.getUrl().toString();

                try {
                    // Allow opening in external browser instead, for listed domains.
                    List<Pattern> patterns = new ArrayList<>();
                    patterns.add(Pattern.compile("^(.*\\.)?pocketbitcoin\\.com$"));
                    patterns.add(Pattern.compile("^(.*\\.)?moonpay\\.com$"));
                    patterns.add(Pattern.compile("^(.*\\.)?bitsurance\\.eu$"));

                    for (Pattern pattern : patterns) {
                        if (pattern.matcher(request.getUrl().getHost()).matches()) {
                            Util.systemOpen(getApplication(), url);
                            return true;
                        }
                    }
                } catch(Exception e) {
                    Util.log(e.getMessage());
                }
                Util.log("Blocked: " + url);
                return true;
            }
        });

        // WebView.setWebContentsDebuggingEnabled(true); // enable remote debugging in chrome://inspect/#devices
        vw.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Util.log(consoleMessage.message() + " -- From line "
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

            // file picker result handler.
            ActivityResultLauncher<String> mGetContent = registerForActivityResult(new ActivityResultContracts.GetContent(),
                    new ActivityResultCallback<Uri>() {
                        @Override
                        public void onActivityResult(Uri uri) {
                            if (filePathCallback != null) {
                                if (uri != null) {
                                    filePathCallback.onReceiveValue(new Uri[]{uri});
                                } else {
                                    Util.log("Received null Uri in activity result");
                                    filePathCallback.onReceiveValue(new Uri[]{});
                                }
                                filePathCallback = null;
                            }
                        }
                    });
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                MainActivity.this.filePathCallback = filePathCallback;
                mGetContent.launch("*/*");
                return true;
            }
        });

        final String javascriptVariableName = "android";
        vw.addJavascriptInterface(new JavascriptBridge(this), javascriptVariableName);

        try {
            String data = readRawText(getAssets().open("web/index.html"));
            vw.loadDataWithBaseURL(BASE_URL, data, null, null, null);
        } catch (IOException e) {
            e.printStackTrace();
        }

        // We call updateDevice() here in case the app was started while the device was already connected.
        // In that case, handleIntent() is not called with ACTION_USB_DEVICE_ATTACHED.
        this.updateDevice();
    }

    private void startServer() {
        final GoViewModel gVM = ViewModelProviders.of(this).get(GoViewModel.class);
        goService.startServer(getApplicationContext().getFilesDir().getAbsolutePath(), gVM.getGoEnvironment(), gVM.getGoAPI());
    }

    private static String readRawText(InputStream inputStream) throws IOException {
        if (inputStream == null) {
            return null;
        }

        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(inputStream));
        StringBuilder fileContent = new StringBuilder();
        String currentLine = bufferedReader.readLine();
        while (currentLine != null) {
            fileContent.append(currentLine);
            fileContent.append("\n");
            currentLine = bufferedReader.readLine();
        }
        return fileContent.toString();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // This is only called reliably when intents are received (e.g. USB is attached or when
        // handling 'aopp:' URIs through the android.intent.action.VIEW intent) with
        // android:launchMode="singleTop"
        super.onNewIntent(intent);
        setIntent(intent); // make sure onResume will have access to this intent
    }

    @Override
    protected void onStart() {
        super.onStart();
        Util.log("lifecycle: onStart");
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.getIsDarkTheme().observe(this, new Observer<Boolean>() {
            @Override
            public void onChanged(Boolean isDarkTheme) {
                setDarkTheme(isDarkTheme);
            }
        });

        goViewModel.getAuthenticator().observe(this, new Observer<Boolean>() {
            @Override
            public void onChanged(Boolean requestAuth) {
                if (!requestAuth) {
                    return;
                }

                BiometricAuthHelper.showAuthenticationPrompt(MainActivity.this, new BiometricAuthHelper.AuthCallback() {
                    @Override
                    public void onSuccess() {
                        // Authenticated successfully
                        Util.log("Auth success");
                        goViewModel.closeAuth();
                        Mobileserver.authResult(true);
                    }

                    @Override
                    public void onFailure() {
                        // Failed
                        Util.log("Auth failed");
                        goViewModel.closeAuth();
                        Mobileserver.authResult(false);
                    }

                    @Override
                    public void onCancel() {
                        // Canceled
                        Util.log("Auth canceled");
                        goViewModel.closeAuth();
                        Mobileserver.cancelAuth();
                    }
                });
            }
        });

        goViewModel.getAuthSetting().observe(this, new Observer<Boolean>() {
            @Override
            public void onChanged(Boolean enabled) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (enabled) {
                            // Treat the content of the window as secure, preventing it from appearing in
                            // screenshots, the app switcher, or from being viewed on non-secure displays. We
                            // are really only interested in hiding the app contents from the app switcher -
                            // screenshots unfortunately also get disabled.
                            getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                        } else {
                            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        }
                    }
                });
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        Util.log("lifecycle: onResume");
        Mobileserver.triggerAuth();

        // This is only called reliably when USB is attached with android:launchMode="singleTop"

        // Usb device list is updated on ATTACHED / DETACHED intents.
        // ATTACHED intent is an activity intent in AndroidManifest.xml so the app is launched when
        // a device is attached. On launch or when it is already running, onIntent() is called
        // followed by onResume(), where the intent is handled.
        // DETACHED intent is a broadcast intent which we register here.
        IntentFilter filter = new IntentFilter();
        filter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);
        filter.addAction(ACTION_USB_PERMISSION);
        registerReceiver(this.usbStateReceiver, filter);

        // Listen on changes in the network connection. We are interested in if the user is connected to a mobile data connection.
        registerReceiver(this.networkStateReceiver, new IntentFilter(android.net.ConnectivityManager.CONNECTIVITY_ACTION));

        Intent intent = getIntent();
        handleIntent(intent);
    }

    @Override
    protected void onPause() {
        super.onPause();
        Util.log("lifecycle: onPause");
        unregisterReceiver(this.usbStateReceiver);
        unregisterReceiver(this.networkStateReceiver);
    }

    private void handleIntent(Intent intent) {
        if (intent.getAction().equals(ACTION_USB_PERMISSION)) {
            // See https://developer.android.com/guide/topics/connectivity/usb/host#permission-d
            synchronized (this) {
                UsbDevice device = (UsbDevice) intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
                if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                    if (device != null) {
                        Util.log("usb: permission granted");
                        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
                        goViewModel.setDevice(device);
                    }
                } else {
                    Util.log("usb: permission denied");
                }
            }
        }
        if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_ATTACHED)) {
            Util.log("usb: attached");
            this.updateDevice();
        }
        if (intent.getAction().equals(UsbManager.ACTION_USB_DEVICE_DETACHED)) {
            Util.log("usb: detached");
            this.updateDevice();
        }
        // Handle 'aopp:' URIs. This is called when the app is launched and also if it is already
        // running and brought to the foreground.
        if (intent.getAction().equals(Intent.ACTION_VIEW)) {
            Uri uri = intent.getData();
            if (uri != null) {
                if (uri.getScheme().equals("aopp")) {
                    Mobileserver.handleURI(uri.toString());
                }
            }
        }
    }

    private void updateDevice() {
        // Triggered by usb device attached intent and usb device detached broadcast events.
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.setDevice(null);
        UsbManager manager = (UsbManager) getApplication().getSystemService(Context.USB_SERVICE);
        HashMap<String, UsbDevice> deviceList = manager.getDeviceList();
        Iterator<UsbDevice> deviceIterator = deviceList.values().iterator();
        while (deviceIterator.hasNext()){
            UsbDevice device = deviceIterator.next();
            // One other instance where we filter vendor/product IDs is in
            // @xml/device_filter resource, which is used for USB_DEVICE_ATTACHED
            // intent to launch the app when a device is plugged and the app is still
            // closed. This filter, on the other hand, makes sure we feed only valid
            // devices to the Go backend once the app is launched or opened.
            //
            // BitBox02 Vendor ID: 0x03eb, Product ID: 0x2403.
            if (device.getVendorId() == 1003 && device.getProductId() == 9219) {
                if (manager.hasPermission(device)) {
                    goViewModel.setDevice(device);
                } else {
                    PendingIntent permissionIntent = PendingIntent.getBroadcast(this, 0, new Intent(ACTION_USB_PERMISSION), PendingIntent.FLAG_IMMUTABLE);
                    manager.requestPermission(device, permissionIntent);
                }
                break; // only one device supported for now
            }
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        Util.log("lifecycle: onStop");
    }

    @Override
    protected void onRestart() {
        // This is here so that if the GoService gets killed while the app is in background it
        // will be started again.
        if (goService == null) {
            Intent intent = new Intent(this, GoService.class);
            bindService(intent, connection, Context.BIND_AUTO_CREATE);
        }
        super.onRestart();
    }

    @Override
    protected void onDestroy() {
        Util.log("lifecycle: onDestroy");
        if (goService != null) {
            unbindService(connection);
        }
        super.onDestroy();
        Util.quit(MainActivity.this);
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
                    Util.quit(MainActivity.this);
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
