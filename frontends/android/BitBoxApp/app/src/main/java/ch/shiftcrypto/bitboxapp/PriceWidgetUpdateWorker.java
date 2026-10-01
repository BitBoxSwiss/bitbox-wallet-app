// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

// Updates cached display state even offline, then queues a fetch for when connected.
public class PriceWidgetUpdateWorker extends Worker {
    public PriceWidgetUpdateWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        PriceWidgetProvider.renderCached(context);
        PriceWidgetProvider.enqueueFetch(context, false);
        return Result.success();
    }
}
