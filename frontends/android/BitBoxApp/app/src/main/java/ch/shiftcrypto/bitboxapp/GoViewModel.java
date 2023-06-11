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
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;
import android.os.Handler;
import android.os.Message;

import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.MutableLiveData;

import java.util.Locale;

import goserver.GoAPIInterface;
import goserver.GoDeviceInfoInterface;
import goserver.GoEnvironmentInterface;
import goserver.GoReadWriteCloserInterface;

public class GoViewModel extends AndroidViewModel {

      private class GoDeviceInfo implements GoDeviceInfoInterface {
        private UsbDevice device;
        public GoDeviceInfo(UsbDevice device) {
            this.device = device;
        }
        public String identifier(){
            return "androidDevice";
        }
        public long interface_() {
            return 0;
        }
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

                return new GoReadWriteCloserInterface(){
                    public void close() throws Exception {

                    }
                    public byte[] read(long n) throws Exception {
                        byte[] result = new byte[(int) n];
                        connection.bulkTransfer(endpointIn, result, result.length, 5000000);
                        return result;
                    }
                    public long write(byte[] p0) throws Exception{
                        return connection.bulkTransfer(endpointOut, p0, p0.length, 5000000);
                    }
                };
            }
            throw new Exception("nope");


        }
        public String product() {
            return device.getProductName();
        }
        public String manufacturer() {
            return device.getManufacturerName();
        }
        public long productID() {
            return device.getProductId();
        }
        public String serial() {
            return device.getSerialNumber();
        }
        public long usagePage() {
            return 0xFFFF;
        }
        public long vendorID() {
            return device.getVendorId();
        }
    }

    private class GoEnvironment implements GoEnvironmentInterface {
        public GoEnvironment() {
        }

        public void notifyUser(String message) {

        }

        private GoDeviceInfoInterface device;

        public void setDevice(GoDeviceInfo device) {
            this.device = device;
        }

        public GoDeviceInfoInterface deviceInfo() {
            return this.device;
        }

        public void systemOpen(String url) throws Exception {
            Util.systemOpen(getApplication(), url);
        }

        public boolean usingMobileData() {
            // Adapted from https://stackoverflow.com/a/53243938

            ConnectivityManager cm = (ConnectivityManager)getApplication().getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) {
                return false;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                NetworkCapabilities capabilities = cm.getNetworkCapabilities(cm.getActiveNetwork());
                return capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
            }

            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            return activeNetwork != null && activeNetwork.getType() == ConnectivityManager.TYPE_MOBILE;
        }

        public String nativeLocale() {
            Context ctx = getApplication().getApplicationContext();
            Locale locale;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                locale = ctx.getResources().getConfiguration().getLocales().get(0);
            } else {
                // Deprecated since API level 24.
                // https://developer.android.com/reference/android/content/res/Configuration#locale.
                locale = ctx.getResources().getConfiguration().locale;
            }
            return locale.toString();
        }

        public void setDarkTheme(boolean isDark) {
            Util.log("Set Dark Theme GoViewModel - isdark: " + isDark);
            GoViewModel.this.isDarkTheme.postValue(isDark);
        }

        public boolean detectDarkTheme() {
            // nothing to do here: Dark theme is detected in the frontend using media queries.
            return false;
        }
    }

    public class Response {
        public long queryID;
        public String response;
    }
    private class GoAPI implements GoAPIInterface {
        Handler callResponseHandler;
        Handler pushNotificationHandler;
        public void setMessageHandlers(Handler callResponseHandler, Handler pushNotificationHandler) {
            this.callResponseHandler = callResponseHandler;
            this.pushNotificationHandler = pushNotificationHandler;
        }
        public void respond(long queryID, String response) {
            Message msg = Message.obtain();
            Response resp = new Response();
            resp.queryID = queryID;
            resp.response = response;
            msg.obj = resp;
            callResponseHandler.sendMessage(msg);
        }
        public void pushNotify(String msg) {
            Message m = Message.obtain();
            m.obj = msg;
            pushNotificationHandler.sendMessage(m);
        }
    }

     private MutableLiveData<Boolean> isDarkTheme = new MutableLiveData<>();

     public MutableLiveData<Boolean> getIsDarkTheme() {
         return isDarkTheme;
     }

     public void setIsDarkTheme(Boolean isDark) {
         this.isDarkTheme.postValue(isDark);
    }
    private GoEnvironment goEnvironment;
    private GoAPI goAPI;

    public GoEnvironment getGoEnvironment() {
        return goEnvironment;
    }

    public GoAPI getGoAPI() {
        return goAPI;
    }

    public GoViewModel(Application app) {
        super(app);

        this.goEnvironment = new GoEnvironment();
        this.goAPI = new GoAPI();
    }

    @Override
    public void onCleared() {
        super.onCleared();
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
}
