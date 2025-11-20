package ch.shiftcrypto.bitboxapp;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;

import androidx.core.content.ContextCompat;

import java.util.HashMap;

/**
 * Encapsulates USB device tracking and permission handling for BitBox devices.
 */
public class UsbDeviceManager {
    private static final String ACTION_USB_PERMISSION = "ch.shiftcrypto.bitboxapp.USB_PERMISSION";
    private static final int BITBOX_VENDOR_ID = 1003;
    private static final int BITBOX_PRODUCT_ID = 9219;

    private final MainActivity activity;
    private final GoViewModel goViewModel;
    private final BroadcastReceiver usbStateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            handleUsbIntent(intent);
        }
    };
    private boolean receiverRegistered;

    public UsbDeviceManager(MainActivity activity, GoViewModel goViewModel) {
        this.activity = activity;
        this.goViewModel = goViewModel;
    }

    public void startMonitoring() {
        if (receiverRegistered) {
            return;
        }
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
                activity,
                usbStateReceiver,
                filter,
                ContextCompat.RECEIVER_NOT_EXPORTED
        );
        receiverRegistered = true;
    }

    public void stopMonitoring() {
        if (!receiverRegistered) {
            return;
        }
        activity.unregisterReceiver(usbStateReceiver);
        receiverRegistered = false;
    }

    public void handleUsbIntent(Intent intent) {
        if (intent == null) {
            return;
        }
        String action = intent.getAction();
        if (ACTION_USB_PERMISSION.equals(action)) {
            handlePermissionIntent(intent);
            return;
        }
        if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action)) {
            Util.log("usb: attached");
            refreshConnectedDevice();
        } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
            Util.log("usb: detached");
            refreshConnectedDevice();
        }
    }

    private void handlePermissionIntent(Intent intent) {
        // See https://developer.android.com/guide/topics/connectivity/usb/host#permission-d
        synchronized (this) {
            UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
            if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                if (device != null) {
                    Util.log("usb: permission granted");
                    goViewModel.setDevice(device);
                }
            } else {
                Util.log("usb: permission denied");
            }
        }
    }

    public void refreshConnectedDevice() {
        // Triggered by usb device attached intent and usb device detached broadcast events.
        goViewModel.setDevice(null);
        UsbManager manager = (UsbManager) activity.getApplication().getSystemService(Context.USB_SERVICE);
        if (manager == null) {
            return;
        }
        HashMap<String, UsbDevice> deviceList = manager.getDeviceList();
        for (UsbDevice device : deviceList.values()) {
            // One other instance where we filter vendor/product IDs is in
            // @xml/device_filter resource, which is used for USB_DEVICE_ATTACHED
            // intent to launch the app when a device is plugged and the app is still
            // closed. This filter, on the other hand, makes sure we feed only valid
            // devices to the Go backend once the app is launched or opened.
            //
            // BitBox02 Vendor ID: 0x03eb, Product ID: 0x2403.
            if (device.getVendorId() == BITBOX_VENDOR_ID && device.getProductId() == BITBOX_PRODUCT_ID) {
                if (manager.hasPermission(device)) {
                    goViewModel.setDevice(device);
                } else {
                    manager.requestPermission(device, PendingIntent.getBroadcast(
                            activity,
                            0,
                            new Intent(ACTION_USB_PERMISSION),
                            PendingIntent.FLAG_IMMUTABLE
                    ));
                }
                break; // only one device supported for now
            }
        }
    }
}
