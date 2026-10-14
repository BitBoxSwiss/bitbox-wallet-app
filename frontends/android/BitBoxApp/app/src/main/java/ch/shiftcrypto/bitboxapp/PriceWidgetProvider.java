// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.annotation.SuppressLint;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.util.Log;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import mobileserver.Mobileserver;

public class PriceWidgetProvider extends AppWidgetProvider {
    static final String NEXT = "ch.shiftcrypto.bitboxapp.widget.NEXT";
    static final String PREVIOUS = "ch.shiftcrypto.bitboxapp.widget.PREVIOUS";
    static final String FORCE = "force"; // Input used by work queued before refresh tokens were introduced.
    static final String REFRESH_WORK = "price-widget-refresh";
    static final String PERIODIC_WORK = "price-widget-periodic";
    private static final String PREFERENCES = "price-widget";
    private static final String SELECTED_INDEX = "selectedIndex";
    private static final String REQUESTED_REFRESH = "requestedRefresh";
    private static final String FULFILLED_REFRESH = "fulfilledRefresh";
    // Owns selection, refresh tokens and every publication. Broadcasts never wait on rendering.
    private static final ExecutorService WIDGET_EXECUTOR = Executors.newSingleThreadExecutor();

    static int[] widgetIds(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(
                new ComponentName(context, HelloWidgetProvider.class));
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    static long selectedIndex(Context context) {
        return preferences(context).getLong(SELECTED_INDEX, 0);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (NEXT.equals(action) || PREVIOUS.equals(action)) {
            refreshFromBroadcast(context, false, NEXT.equals(action) ? 1 : -1);
        } else if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            refreshFromBroadcast(context, true, 0);
        } else {
            super.onReceive(context, intent);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refreshFromBroadcast(context, false, 0);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        refreshFromBroadcast(context, false, 0);
    }

    @Override
    public void onDisabled(Context context) {
        Context app = context.getApplicationContext();
        WIDGET_EXECUTOR.execute(() -> {
            WorkManager manager = WorkManager.getInstance(app);
            manager.cancelUniqueWork(REFRESH_WORK);
            manager.cancelUniqueWork(PERIODIC_WORK);
        });
    }

    private void refreshFromBroadcast(Context context, boolean force, int step) {
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        WIDGET_EXECUTOR.execute(() -> {
            try {
                update(app, force, step);
            } finally {
                if (result != null) {
                    result.finish();
                }
            }
        });
    }

    public static void refresh(Context context) {
        refresh(context, true);
    }

    static Future<?> refresh(Context context, boolean force) {
        Context app = context.getApplicationContext();
        return WIDGET_EXECUTOR.submit(() -> update(app, force, 0));
    }

    private static void update(Context context, boolean force, int step) {
        if (widgetIds(context).length == 0) {
            return;
        }
        renderCached(context, step);
        schedule(context, force);
    }

    // Called only on WIDGET_EXECUTOR, including after fetches and navigation.
    private static JSONObject renderCached(Context context, int step) {
        if (widgetIds(context).length == 0) {
            return null;
        }
        try {
            JSONObject state = new JSONObject(Mobileserver.priceWidgetState(
                    context.getFilesDir().getAbsolutePath(), selectedIndex(context) + step, false, false));
            // Go normalizes the selection against the active accounts before it is persisted.
            preferences(context).edit().putLong(SELECTED_INDEX, state.getLong("selectedIndex")).apply();
            PriceWidgetRenderer.render(context, state);
            return state;
        } catch (Exception e) {
            Log.w("bitboxapp", "Could not read price widget data", e);
            PriceWidgetRenderer.render(context, new JSONObject());
            return null;
        }
    }

    private static void schedule(Context context, boolean force) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.UPDATE,
                new PeriodicWorkRequest.Builder(PriceWidgetUpdateWorker.class, 15, TimeUnit.MINUTES)
                        .setInitialDelay(15, TimeUnit.MINUTES)
                        .build());
        enqueueFetch(context, force);
    }

    static Future<?> periodicRefresh(Context context) {
        return WIDGET_EXECUTOR.submit(() -> {
            if (widgetIds(context).length == 0) {
                return;
            }
            ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
            NetworkCapabilities network = connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
            // Keep the dated quote while online work is pending; still clear expired data offline.
            if (network == null || !network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
                renderCached(context, 0);
            }
            enqueueFetch(context, true);
        });
    }

    @SuppressLint("ApplySharedPref") // Persist the request before queuing work, on WIDGET_EXECUTOR.
    private static void enqueueFetch(Context context, boolean force) {
        if (force) {
            SharedPreferences prefs = preferences(context);
            prefs.edit().putLong(REQUESTED_REFRESH, prefs.getLong(REQUESTED_REFRESH, 0) + 1).commit();
        }
        Constraints network = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(context).enqueueUniqueWork(REFRESH_WORK, ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(PriceWidgetWorker.class)
                        .setConstraints(network)
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                        .build());
    }

    static final class FetchRequest {
        final long index;
        final long refreshToken;

        FetchRequest(long index, long refreshToken) {
            this.index = index;
            this.refreshToken = refreshToken;
        }
    }

    static Future<FetchRequest> prepareFetch(Context context) {
        return WIDGET_EXECUTOR.submit(() -> {
            if (widgetIds(context).length == 0) {
                return null;
            }
            SharedPreferences prefs = preferences(context);
            long requested = prefs.getLong(REQUESTED_REFRESH, 0);
            long fulfilled = prefs.getLong(FULFILLED_REFRESH, 0);
            return new FetchRequest(selectedIndex(context), requested > fulfilled ? requested : 0);
        });
    }

    @SuppressLint("ApplySharedPref") // Persist completion on WIDGET_EXECUTOR before the next request.
    static Future<?> completeFetch(Context context, FetchRequest request, JSONObject state) {
        return WIDGET_EXECUTOR.submit(() -> {
            // A successful canceled worker may have saved a quote. Publish for the current selection.
            JSONObject current = renderCached(context, 0);
            if (state != null && current != null && state.optBoolean("refreshed")
                    && state.optString("coinCode").equals(current.optString("coinCode"))
                    && state.optString("currency").equals(current.optString("currency"))) {
                SharedPreferences prefs = preferences(context);
                prefs.edit().putLong(FULFILLED_REFRESH,
                        Math.max(request.refreshToken, prefs.getLong(FULFILLED_REFRESH, 0))).commit();
            }
        });
    }
}
