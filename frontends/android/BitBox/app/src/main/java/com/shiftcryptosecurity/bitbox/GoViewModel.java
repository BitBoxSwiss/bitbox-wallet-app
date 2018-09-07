package com.shiftcryptosecurity.bitbox;

import goserver.GoDeviceInfoInterface;
import goserver.GoEnvironmentInterface;
import goserver.GoReadWriteCloserInterface;
import goserver.GoAPIInterface;
import goserver.Goserver;

import android.os.Message;
import android.os.Handler;
import android.app.Application;
import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.util.Log;

import androidx.lifecycle.AndroidViewModel;

import java.util.AbstractMap;
import java.util.HashMap;
import java.util.Iterator;

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
                connection.claimInterface(intf, true);

                return new GoReadWriteCloserInterface(){
                    public void close() throws Exception {

                    }
                    public byte[] read(long n) throws Exception {
                        byte[] result = new byte[(int) n];
                        long read = connection.bulkTransfer(endpointIn, result, result.length, 5000000);
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

        // Triggered by usb device attached intent and usb device detached broadcast events from
        // MainActivity.
        public void updateDeviceList() {
            this.device = null;
            UsbManager manager = (UsbManager) getApplication().getSystemService(Context.USB_SERVICE);
            HashMap<String, UsbDevice> deviceList = manager.getDeviceList();
            Iterator<UsbDevice> deviceIterator = deviceList.values().iterator();
            while (deviceIterator.hasNext()){
                UsbDevice device = deviceIterator.next();
                this.device = new GoDeviceInfo(device);
                break; // only one device supported for now
            }
        }

        public GoDeviceInfoInterface deviceInfo() {
            return this.device;
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

    private GoEnvironment goEnvironment;
    private GoAPI goAPI;

    public GoViewModel(Application app) {
        super(app);

        this.goEnvironment = new GoEnvironment();
        this.goAPI = new GoAPI();

        Goserver.serve(app.getApplicationInfo(). dataDir, this.goEnvironment, this.goAPI);
    }

    @Override
    public void onCleared() {
        super.onCleared();
        Goserver.shutdown();
    }

    public void setMessageHandlers(Handler callResponseHandler, Handler pushNotificationHandler) {
        this.goAPI.setMessageHandlers(callResponseHandler, pushNotificationHandler);
    }

    public void updateDeviceList() {
        this.goEnvironment.updateDeviceList();
    }
}