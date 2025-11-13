package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProviders;

import java.util.HashMap;

import mobileserver.Mobileserver;

public class MainActivity extends AppCompatActivity {
    static {
        System.loadLibrary("signal_handler");
    }
    public native void initsignalhandler();
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

    GoService goService;

    private BitBoxWebChromeClient webChrome;

    // Connection to bind with GoService
    private final ServiceConnection connection = new ServiceConnection() {

        @Override
        public void onServiceConnected(ComponentName className,
                                       IBinder service) {
            GoService.GoServiceBinder binder = (GoService.GoServiceBinder) service;
            goService = binder.getService();
            goService.setViewModelStoreOwner(MainActivity.this);
            Util.log("Bind connection completed!");
            startServer();
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            goService = null;
            Util.log("Bind connection unexpectedly closed!");
        }
    };

    private final BroadcastReceiver usbStateReceiver = new BroadcastReceiver() {
        public void onReceive(Context context, Intent intent) {
            handleIntent(intent);
        }
    };

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
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
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Util.log("lifecycle: onCreate");

        initsignalhandler();

        ActionBar actionBar = getSupportActionBar();
        if (actionBar != null) {
            actionBar.hide(); // hide title bar with app name.
        }
        onConfigurationChanged(getResources().getConfiguration());
        setContentView(R.layout.activity_main);
        final WebView vw = findViewById(R.id.vw);
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
                new Handler(Looper.getMainLooper(), msg -> {
                        final GoAPI.Response response = (GoAPI.Response) msg.obj;
                        vw.evaluateJavascript(
                                "if (window.onMobileCallResponse) {" +
                                        "window.onMobileCallResponse(" + response.queryID + ", " + response.response + ")};",
                                null);
                        return true;
                    }),
                new Handler(Looper.getMainLooper(), msg -> {
                        vw.evaluateJavascript(
                                "if (window.onMobilePushNotification) {" +
                                        "window.onMobilePushNotification(" + msg.obj + ")};",
                                null);
                        return true;
                }));
        vw.clearCache(true);
        vw.clearHistory();
        vw.getSettings().setJavaScriptEnabled(true);
        vw.getSettings().setAllowUniversalAccessFromFileURLs(true);
        vw.getSettings().setAllowFileAccess(true);

        // For Moonpay widget: DOM storage and WebRTC camera access required.
        vw.getSettings().setDomStorageEnabled(true);
        vw.getSettings().setMediaPlaybackRequiresUserGesture(false);

        // vw.setWebContentsDebuggingEnabled(true); // enable remote debugging in chrome://inspect/#devices

        vw.setWebViewClient(new BitBoxWebViewClient(BASE_URL, getAssets(), getApplication()));

        ActivityResultLauncher<String> fileChooser = registerForActivityResult(new ActivityResultContracts.GetContent(), uri -> webChrome.onFilePickerResult(uri));
        BitBoxWebChromeClient.CameraPermissionDelegate cameraPermissionDelegate = () -> ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.CAMERA},
                PERMISSIONS_REQUEST_CAMERA_QRCODE
        );

        webChrome = new BitBoxWebChromeClient(this,
                cameraPermissionDelegate,
                fileChooser
        );
        vw.setWebChromeClient(webChrome);

        vw.addJavascriptInterface(new JavascriptBridge(this), "android");
        vw.loadUrl(BASE_URL + "index.html");

        // We call updateDevice() here in case the app was started while the device was already connected.
        // In that case, handleIntent() is not called with ACTION_USB_DEVICE_ATTACHED.
        this.updateDevice();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                backPressedHandler();
            }
        });

        goViewModel.getAuthRequested().observe(this, authRequested -> {
            if (!authRequested) {
                return;
            }

            BiometricAuthHelper.showAuthenticationPrompt(MainActivity.this, new BiometricAuthHelper.AuthCallback() {
                @Override
                public void onSuccess() {
                    // Authenticated successfully
                    Util.log("Auth success");
                    goViewModel.closeAuth();
                    Mobileserver.authResult(Mobileserver.AuthResultOk);
                }

                @Override
                public void onFailure() {
                    // Failed
                    Util.log("Auth failed");
                    goViewModel.closeAuth();
                    Mobileserver.authResult(Mobileserver.AuthResultErr);
                }

                @Override
                public void onCancel() {
                    // Canceled
                    Util.log("Auth canceled");
                    goViewModel.closeAuth();
                    Mobileserver.authResult(Mobileserver.AuthResultCancel);
                }

                @Override
                public void noAuthConfigured() {
                    // No Auth configured
                    Util.log("Auth not configured");
                    goViewModel.closeAuth();
                    Mobileserver.authResult(Mobileserver.AuthResultMissing);
                }
            });
        });

        goViewModel.getAuthSetting().observe(this, enabled -> runOnUiThread(() -> {
            if (enabled) {
                // Treat the content of the window as secure, preventing it from appearing in
                // screenshots, the app switcher, or from being viewed on non-secure displays. We
                // are really only interested in hiding the app contents from the app switcher -
                // screenshots unfortunately also get disabled.
                getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        }));

    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSIONS_REQUEST_CAMERA_QRCODE) {
            webChrome.onCameraPermissionResult(grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED);
        }
    }

    private void startServer() {
        final GoViewModel gVM = ViewModelProviders.of(this).get(GoViewModel.class);
        goService.startServer(getApplicationContext().getFilesDir().getAbsolutePath(), gVM.getGoEnvironment(), gVM.getGoAPI());

        // Trigger connectivity and mobile connection check (as the network may already be unavailable when the app starts).
        gVM.getNetworkHelper().checkConnectivity();
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
        goViewModel.getIsDarkTheme().observe(this, this::setDarkTheme);
        goViewModel.getNetworkHelper().registerNetworkCallback();
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
        ContextCompat.registerReceiver(
                this,
                usbStateReceiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED
        );

        // Trigger connectivity check (as the network may already be unavailable when the app starts).
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.getNetworkHelper().checkConnectivity();

        Intent intent = getIntent();
        handleIntent(intent);
    }

    @Override
    protected void onPause() {
        super.onPause();
        Util.log("lifecycle: onPause");
        unregisterReceiver(this.usbStateReceiver);
    }

    private void handleIntent(Intent intent) {
        if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
            // See https://developer.android.com/guide/topics/connectivity/usb/host#permission-d
            synchronized (this) {
                UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
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
        if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(intent.getAction())) {
            Util.log("usb: attached");
            this.updateDevice();
        }
        if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(intent.getAction())) {
            Util.log("usb: detached");
            this.updateDevice();
        }
        // Handle 'aopp:' URIs. This is called when the app is launched and also if it is already
        // running and brought to the foreground.
        if (Intent.ACTION_VIEW.equals(intent.getAction())) {
            Uri uri = intent.getData();
            if (uri != null) {
                if ("aopp".equals(uri.getScheme())) {
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
        for (UsbDevice device : deviceList.values()) {
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
        final GoViewModel goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.getNetworkHelper().unregisterNetworkCallback();
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
    private void backPressedHandler() {
        runOnUiThread(new Runnable() {
            final WebView vw = findViewById(R.id.vw);
            @Override
            public void run() {
                vw.evaluateJavascript("window.onBackButtonPressed();", value -> {
                    boolean doDefault = Boolean.parseBoolean(value);
                    if (doDefault) {
                        // Default behavior: go back in history if we can, otherwise prompt user
                        // if they want to quit the app.
                        if (vw.canGoBack()) {
                            vw.goBack();
                            return;
                        }
                        new AlertDialog.Builder(MainActivity.this)
                                .setTitle("Close BitBoxApp")
                                .setMessage("Do you really want to exit?")
                                .setPositiveButton(android.R.string.yes, (dialog, which) -> Util.quit(MainActivity.this))
                                .setNegativeButton(android.R.string.no, (dialog, which) -> dialog.dismiss())
                                .setIcon(android.R.drawable.ic_dialog_alert)
                                .show();
                    }
                });
            }
        });
    }
}
