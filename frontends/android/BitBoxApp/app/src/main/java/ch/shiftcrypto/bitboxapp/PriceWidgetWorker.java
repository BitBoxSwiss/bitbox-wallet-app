// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import mobileserver.Mobileserver;
import mobileserver.PriceWidgetRequest;

public class PriceWidgetWorker extends Worker {
    private PriceWidgetRequest request;

    public PriceWidgetWorker(@NonNull Context context, @NonNull WorkerParameters parameters) {
        super(context, parameters);
    }

    @Override
    public synchronized void onStopped() {
        if (request != null) {
            request.cancel();
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        PriceWidgetProvider.FetchRequest selection = null;
        JSONObject state = null;
        try {
            selection = PriceWidgetProvider.prepareFetch(context).get();
            if (selection == null) {
                return Result.success();
            }
            synchronized (this) {
                if (isStopped()) {
                    return Result.success();
                }
                request = Mobileserver.newPriceWidgetRequest();
            }
            state = new JSONObject(request.state(context.getFilesDir().getAbsolutePath(), selection.index,
                    selection.refreshToken > 0 || getInputData().getBoolean(PriceWidgetProvider.FORCE, false)));
            return state.optBoolean("retry") || (selection.refreshToken > 0 && !state.optBoolean("refreshed"))
                    ? Result.retry() : Result.success();
        } catch (Exception e) {
            Log.w("bitboxapp", "Could not refresh price widget", e);
            return Result.retry();
        } finally {
            synchronized (this) {
                if (request != null) {
                    request.cancel();
                }
            }
            if (selection != null && (state != null || !isStopped())) {
                try {
                    PriceWidgetProvider.completeFetch(context, selection, state).get();
                } catch (Exception e) {
                    Log.w("bitboxapp", "Could not publish price widget", e);
                }
            }
        }
    }
}
