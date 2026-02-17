package ch.shiftcrypto.bitboxapp;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProviders;

import mobileserver.Mobileserver;

public class MainActivity extends AppCompatActivity {
    static {
        System.loadLibrary("signal_handler");
    }
    public native void initsignalhandler();

    GoService goService;
    private GoViewModel goViewModel;
    private WebViewManager webViewManager;
    private UsbDeviceManager usbDeviceManager;
    // Connection to bind with GoService
    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
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

    public void setDarkTheme(boolean isDark) {
        int statusBarColor = ContextCompat.getColor(
                getApplicationContext(),
                isDark ? R.color.colorPrimaryDark : R.color.colorPrimary
        );
        // Pre-Oreo devices cannot render light nav bar icons, so fall back to dark bar to keep icons visible.
        boolean supportsLightNavIcons = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
        int navBarColor = supportsLightNavIcons
                ? statusBarColor
                : ContextCompat.getColor(getApplicationContext(), R.color.colorPrimaryDark);

        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(statusBarColor);
        window.setNavigationBarColor(navBarColor);

        View decorView = window.getDecorView();
        int flags = decorView.getSystemUiVisibility(); // get current flag
        if (isDark) {
            Util.log("Dark theme");
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;   // remove LIGHT_STATUS_BAR flag
            if (supportsLightNavIcons) {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        } else {
            Util.log("Light theme");
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;   // add LIGHT_STATUS_BAR flag
            if (supportsLightNavIcons) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        decorView.setSystemUiVisibility(flags);

        View root = findViewById(R.id.root_layout);
        WebView vw = findViewById(R.id.vw);
        if (root != null) {
            root.setBackgroundColor(statusBarColor);
        }
        if (vw != null) {
            vw.setBackgroundColor(statusBarColor);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Util.log("lifecycle: onCreate");
        initsignalhandler();
        ActionBar actionBar = getSupportActionBar();
        if (actionBar != null) {
            actionBar.hide(); // hide title bar with app name.
        }
        setContentView(R.layout.activity_main);
        final WebView vw = findViewById(R.id.vw);

        // GoModel manages the Go backend. It is in a ViewModel so it only runs once, not every time
        // onCreate is called (on a configuration change like orientation change).
        goViewModel = ViewModelProviders.of(this).get(GoViewModel.class);
        goViewModel.setFileSaveHelper(new FileSaveHelper(this));
        webViewManager = new WebViewManager(this, goViewModel);
        webViewManager.initialize(vw);
        usbDeviceManager = new UsbDeviceManager(this, goViewModel);

        // The backend is run inside GoService, to avoid (as much as possible) latency errors due to
        // the scheduling when the app is out of focus.
        Intent intent = new Intent(this, GoService.class);
        bindService(intent, connection, Context.BIND_AUTO_CREATE);

        // We call refreshConnectedDevice() here in case the app was started while the device was already connected.
        // In that case, no intent is fired with ACTION_USB_DEVICE_ATTACHED.
        usbDeviceManager.refreshConnectedDevice();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webViewManager.handleBackPressed();
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
        if (webViewManager != null) {
            webViewManager.handleRequestPermissionsResult(requestCode, grantResults);
        }
    }

    private void startServer() {
        goService.startServer(
                getApplicationContext().getFilesDir().getAbsolutePath(),
                goViewModel.getGoEnvironment(),
                goViewModel.getGoAPI()
        );

        // Trigger connectivity and mobile connection check (as the network may already be unavailable when the app starts).
        goViewModel.getNetworkHelper().checkConnectivity();
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
        goViewModel.getIsDarkTheme().observe(this, this::setDarkTheme);
        goViewModel.getNetworkHelper().registerNetworkCallback();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Util.log("lifecycle: onResume");
        Mobileserver.triggerAuth();

        usbDeviceManager.startMonitoring();

        // Trigger connectivity check (as the network may already be unavailable when the app starts).
        goViewModel.getNetworkHelper().checkConnectivity();

        Intent intent = getIntent();
        usbDeviceManager.handleUsbIntent(intent);
        handleAOPPIntent(intent);
    }

    @Override
    protected void onPause() {
        super.onPause();
        Util.log("lifecycle: onPause");
        usbDeviceManager.stopMonitoring();
    }

    @Override
    protected void onStop() {
        super.onStop();
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
        goViewModel.setFileSaveHelper(null);
        if (goService != null) {
            unbindService(connection);
        }
        super.onDestroy();
        Util.quit(MainActivity.this);
    }

    // Handle 'aopp:' URIs. This is called when the app is launched and also if it is already
    // running and brought to the foreground.
    private void handleAOPPIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
            return;
        }
        Uri uri = intent.getData();
        if (uri != null && "aopp".equals(uri.getScheme())) {
            Mobileserver.handleURI(uri.toString());
        }
    }
}
