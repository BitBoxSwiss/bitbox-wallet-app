// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.os.FileObserver;
import android.os.Handler;
import android.os.Looper;

public class PriceWidgetSync {
    private final FileObserver observer;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresh;

    public PriceWidgetSync(Context context) {
        Context app = context.getApplicationContext();
        refresh = () -> PriceWidgetProvider.refresh(app);
        observer = new FileObserver(app.getFilesDir().getAbsolutePath(), FileObserver.CLOSE_WRITE | FileObserver.MOVED_TO) {
            @Override
            public void onEvent(int event, String path) {
                if ("config.json".equals(path) || "accounts.json".equals(path)) {
                    handler.removeCallbacks(refresh);
                    handler.postDelayed(refresh, 300);
                }
            }
        };
        observer.startWatching();
    }

    public void stop() {
        observer.stopWatching();
        handler.removeCallbacks(refresh);
    }
}
