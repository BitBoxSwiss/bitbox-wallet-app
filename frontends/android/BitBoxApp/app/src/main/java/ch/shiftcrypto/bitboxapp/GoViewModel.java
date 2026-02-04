package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Handler;

import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.MutableLiveData;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import mobileserver.GoDeviceInfoInterface;
import mobileserver.GoEnvironmentInterface;
import mobileserver.GoReadWriteCloserInterface;

public class GoViewModel extends AndroidViewModel {
    public interface SaveFileResultCallback {
        void onResult(Uri uri);
    }

    public interface SaveFileLauncher {
        void launch(String suggestedName, String mimeType, SaveFileResultCallback callback);
    }

    private class GoDeviceInfo implements GoDeviceInfoInterface {
        private final UsbDevice device;

        public GoDeviceInfo(UsbDevice device) {
            this.device = device;
        }

        @Override
        public String identifier() {
            return "androidDevice";
        }

        @Override
        public long interface_() {
            return 0;
        }

        @Override
        public GoReadWriteCloserInterface open() throws Exception {
            if (device != null) {
                UsbInterface intf = device.getInterface(0);
                UsbEndpoint endpointA = intf.getEndpoint(0);
                UsbEndpoint endpointB = intf.getEndpoint(1);
                final UsbEndpoint endpointIn, endpointOut;
                if (endpointA.getDirection() == UsbConstants.USB_DIR_OUT && endpointB.getDirection() == UsbConstants.USB_DIR_IN) {
                    endpointOut = endpointA;
                    endpointIn = endpointB;
                } else if (endpointA.getDirection() == UsbConstants.USB_DIR_IN && endpointB.getDirection() == UsbConstants.USB_DIR_OUT) {
                    endpointOut = endpointB;
                    endpointIn = endpointA;
                } else {
                    return null;
                }
                UsbManager usbManager = (UsbManager) getApplication().getSystemService(Context.USB_SERVICE);
                final UsbDeviceConnection connection = usbManager.openDevice(device);
                if (connection == null) {
                    Util.log("could not open device");
                    return null;
                }
                connection.claimInterface(intf, true);

                return new GoReadWriteCloserInterface() {
                    @Override
                    public void close() throws Exception {

                    }

                    @Override
                    public byte[] read(long n) throws Exception {
                        byte[] result = new byte[(int) n];
                        int transferred = connection.bulkTransfer(endpointIn, result, result.length, 5000000);
                        if (transferred < 0) {
                            throw new IOException("USB read failed with error code: " + transferred);
                        }
                        return result;
                    }

                    @Override
                    public long write(byte[] p0) throws Exception {
                        int transferred = connection.bulkTransfer(endpointOut, p0, p0.length, 5000000);
                        if (transferred < 0) {
                            throw new IOException("USB write failed with error code: " + transferred);
                        }
                        return transferred;
                    }
                };
            }
            throw new Exception("nope");
        }

        @Override
        public boolean isBluetooth() {
            return false;
        }

        @Override
        public String product() {
            return device.getProductName();
        }

        @Override
        public long productID() {
            return device.getProductId();
        }

        @Override
        public String serial() {
            return device.getSerialNumber();
        }

        @Override
        public long usagePage() {
            return 0xFFFF;
        }

        @Override
        public long vendorID() {
            return device.getVendorId();
        }
    }

    private class GoEnvironment implements GoEnvironmentInterface {

        private GoDeviceInfoInterface device;

        public void setDevice(GoDeviceInfo device) {
            this.device = device;
        }

        @Override
        public GoDeviceInfoInterface deviceInfo() {
            return this.device;
        }

        @Override
        public void notifyUser(String message) {
        }

        @Override
        public void systemOpen(String url) throws Exception {
            if (isLocalFile(url) && saveFileLauncher != null) {
                saveFileWithPicker(url);
                return;
            }
            Util.systemOpen(getApplication(), url);
        }

        @Override
        public void auth() {
            Util.log("Auth requested from backend");
            requestAuth();
        }

        @Override
        public String getSaveFilename(String fileName) {
            File folder = getApplication().getApplicationContext().getExternalFilesDir(null);
            return new File(folder, fileName).getAbsolutePath();
        }

        @Override
        public void onAuthSettingChanged(boolean enabled) {
            authSetting.postValue(enabled);
        }

        @Override
        public void bluetoothConnect(String identifier) {
        }

        @Override
        public boolean usingMobileData() {
            return networkHelper != null && networkHelper.usingMobileData();
        }

        @Override
        public String nativeLocale() {
            Context ctx = getApplication().getApplicationContext();
            Locale locale;
            locale = ctx.getResources().getConfiguration().getLocales().get(0);
            return locale.toString();
        }

        @Override
        public void setDarkTheme(boolean isDark) {
            Util.log("Set Dark Theme GoViewModel - isdark: " + isDark);
            GoViewModel.this.isDarkTheme.postValue(isDark);
        }

        @Override
        public boolean detectDarkTheme() {
            // nothing to do here: Dark theme is detected in the frontend using media queries.
            return false;
        }
    }

    private final MutableLiveData<Boolean> isDarkTheme = new MutableLiveData<>();
    private final MutableLiveData<Boolean> authRequested = new MutableLiveData<>(false);
    // The value of the backend config's Authentication setting.
    private final MutableLiveData<Boolean> authSetting = new MutableLiveData<>(false);
    private final GoEnvironment goEnvironment;
    private final GoAPI goAPI;
    private NetworkHelper networkHelper;
    private SaveFileLauncher saveFileLauncher;

    public NetworkHelper getNetworkHelper() {
        return networkHelper;
    }

    public GoViewModel(Application app) {
        super(app);
        this.goEnvironment = new GoEnvironment();
        this.goAPI = new GoAPI();
        this.networkHelper = new NetworkHelper((ConnectivityManager) app.getSystemService(Context.CONNECTIVITY_SERVICE));

    }

    public MutableLiveData<Boolean> getIsDarkTheme() {
        return isDarkTheme;
    }

    public MutableLiveData<Boolean> getAuthRequested() {
        return authRequested;
    }

    public MutableLiveData<Boolean> getAuthSetting() {
        return authSetting;
    }

    public GoEnvironmentInterface getGoEnvironment() {
        return goEnvironment;
    }

    public GoAPI getGoAPI() {
        return goAPI;
    }

    public void requestAuth() {
        this.authRequested.postValue(true);
    }

    public void closeAuth() {
        this.authRequested.postValue(false);
    }

    public void setMessageHandlers(Handler callResponseHandler, Handler pushNotificationHandler) {
        this.goAPI.setMessageHandlers(callResponseHandler, pushNotificationHandler);
    }

    public void setDevice(UsbDevice device) {
        if (device == null) {
            this.goEnvironment.setDevice(null);
            return;
        }
        this.goEnvironment.setDevice(new GoDeviceInfo(device));
    }

    public void setSaveFileLauncher(SaveFileLauncher launcher) {
        this.saveFileLauncher = launcher;
    }

    private boolean isLocalFile(String url) {
        if (url == null || !url.startsWith("/")) {
            return false;
        }
        return true;
    }

    private void saveFileWithPicker(String path) throws Exception {
        File sourceFile = new File(path);
        if (!sourceFile.exists()) {
            throw new IOException("File does not exist: " + path);
        }
        String mimeType = Util.getMimeType(path);
        if (mimeType == null) {
            mimeType = "text/plain";
        }
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<Uri> targetUri = new AtomicReference<>(null);
        saveFileLauncher.launch(sourceFile.getName(), mimeType, uri -> {
            targetUri.set(uri);
            latch.countDown();
        });
        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        Uri uri = targetUri.get();
        if (uri == null) {
            return;
        }
        try (InputStream in = new FileInputStream(sourceFile);
             OutputStream out = getApplication().getContentResolver().openOutputStream(uri)) {
            if (out == null) {
                throw new IOException("Unable to open output stream for file export");
            }
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
    }
}
