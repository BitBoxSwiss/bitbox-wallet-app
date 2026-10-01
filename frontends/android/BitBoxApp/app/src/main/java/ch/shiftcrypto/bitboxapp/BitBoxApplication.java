// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.app.Application;
import android.content.Context;

public class BitBoxApplication extends Application {
    static {
        System.loadLibrary("signal_handler");
    }

    private static native void initSignalHandler();

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        // Go can load from a widget or WorkManager before any activity is created.
        // Install the SIGSYS workaround before content providers and other components start.
        initSignalHandler();
    }
}
