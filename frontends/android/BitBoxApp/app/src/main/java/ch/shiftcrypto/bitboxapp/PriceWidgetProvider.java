// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import mobileserver.Mobileserver;

public class PriceWidgetProvider extends AppWidgetProvider {
    static final String NEXT = "ch.shiftcrypto.bitboxapp.widget.NEXT";
    static final String PREVIOUS = "ch.shiftcrypto.bitboxapp.widget.PREVIOUS";
    static final String FORCE = "force";
    static final String REFRESH_WORK = "price-widget-refresh";
    static final String PERIODIC_WORK = "price-widget-periodic";
    private static final String PREFERENCES = "price-widget";
    private static final String SELECTED_INDEX = "selectedIndex";
    private static final Object RENDER_LOCK = new Object();
    private static final ExecutorService CACHE_EXECUTOR = Executors.newSingleThreadExecutor();

    static int[] widgetIds(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(
                new ComponentName(context, HelloWidgetProvider.class));
    }

    static long selectedIndex(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getLong(SELECTED_INDEX, 0);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (NEXT.equals(action) || PREVIOUS.equals(action)) {
            synchronized (RENDER_LOCK) {
                context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
                        .putLong(SELECTED_INDEX, selectedIndex(context) + (NEXT.equals(action) ? 1 : -1))
                        .apply();
            }
            refreshFromBroadcast(context, false);
        } else if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            refreshFromBroadcast(context, true);
        } else {
            super.onReceive(context, intent);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refreshFromBroadcast(context, false);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        refreshFromBroadcast(context, false);
    }

    @Override
    public void onDisabled(Context context) {
        WorkManager manager = WorkManager.getInstance(context);
        manager.cancelUniqueWork(REFRESH_WORK);
        manager.cancelUniqueWork(PERIODIC_WORK);
    }

    private void refreshFromBroadcast(Context context, boolean force) {
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        CACHE_EXECUTOR.execute(() -> {
            try {
                renderCached(app);
                schedule(app, force);
            } finally {
                result.finish();
            }
        });
    }

    public static void refresh(Context context) {
        Context app = context.getApplicationContext();
        if (widgetIds(app).length == 0) {
            return;
        }
        CACHE_EXECUTOR.execute(() -> {
            renderCached(app);
            schedule(app, true);
        });
    }

    // Read the current selection again after a fetch so an older worker cannot revert a coin switch.
    static void renderCached(Context context) {
        synchronized (RENDER_LOCK) {
            if (widgetIds(context).length == 0) {
                return;
            }
            try {
                JSONObject state = new JSONObject(Mobileserver.priceWidgetState(
                        context.getFilesDir().getAbsolutePath(), selectedIndex(context), false, false));
                PriceWidgetRenderer.render(context, state);
            } catch (Exception e) {
                Log.w("bitboxapp", "Could not read price widget data", e);
                PriceWidgetRenderer.render(context, new JSONObject());
            }
        }
    }

    static void schedule(Context context, boolean force) {
        if (widgetIds(context).length == 0) {
            return;
        }
        WorkManager manager = WorkManager.getInstance(context);
        // Cache expiry must run offline too. UPDATE applies constraints without resetting the schedule.
        manager.enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.UPDATE,
                new PeriodicWorkRequest.Builder(PriceWidgetUpdateWorker.class, 15, TimeUnit.MINUTES)
                        .setInitialDelay(15, TimeUnit.MINUTES)
                        .build());
        enqueueFetch(context, force);
    }

    static void enqueueFetch(Context context, boolean force) {
        if (widgetIds(context).length == 0) {
            return;
        }
        Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(context).enqueueUniqueWork(REFRESH_WORK, ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(PriceWidgetWorker.class)
                        .setInputData(new Data.Builder().putBoolean(FORCE, force).build())
                        .setConstraints(network)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                        .build());
    }
}
