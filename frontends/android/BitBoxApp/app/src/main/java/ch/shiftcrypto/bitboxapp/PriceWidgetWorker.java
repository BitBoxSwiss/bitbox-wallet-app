// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import mobileserver.Mobileserver;

public class PriceWidgetWorker extends Worker {
    public PriceWidgetWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        if (PriceWidgetProvider.widgetIds(context).length == 0) {
            return Result.success();
        }
        try {
            JSONObject state = new JSONObject(Mobileserver.priceWidgetState(
                    context.getFilesDir().getAbsolutePath(), PriceWidgetProvider.selectedIndex(context),
                    true, getInputData().getBoolean(PriceWidgetProvider.FORCE, false)));
            if (!isStopped()) {
                PriceWidgetProvider.renderCached(context);
            }
            return state.optBoolean("retry") ? Result.retry() : Result.success();
        } catch (Exception e) {
            Log.w("bitboxapp", "Could not refresh price widget", e);
            return Result.retry();
        }
    }
}
