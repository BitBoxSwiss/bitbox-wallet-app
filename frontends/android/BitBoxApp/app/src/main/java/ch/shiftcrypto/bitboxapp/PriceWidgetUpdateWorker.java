// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

// Checks offline expiry and requests fresh data at every periodic tick.
public class PriceWidgetUpdateWorker extends Worker {
    public PriceWidgetUpdateWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            PriceWidgetProvider.periodicRefresh(getApplicationContext()).get();
            return Result.success();
        } catch (Exception e) {
            Log.w("bitboxapp", "Could not schedule price widget refresh", e);
            return Result.retry();
        }
    }
}
