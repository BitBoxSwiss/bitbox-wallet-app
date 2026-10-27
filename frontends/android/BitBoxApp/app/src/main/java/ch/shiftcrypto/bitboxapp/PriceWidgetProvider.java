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
import org.json.JSONException;

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
    private static final String FETCH_GENERATION = "fetchGeneration";
    private static final String PUBLISHED_STATE = "publishedState";
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
    @SuppressLint("ApplySharedPref") // Persist cleanup on WIDGET_EXECUTOR before finishing the broadcast.
    public void onDisabled(Context context) {
        PendingResult result = goAsync();
        Context app = context.getApplicationContext();
        WIDGET_EXECUTOR.execute(() -> {
            try {
                WorkManager manager = WorkManager.getInstance(app);
                Future<?> periodic = manager.cancelUniqueWork(PERIODIC_WORK).getResult();
                Future<?> refresh = manager.cancelUniqueWork(REFRESH_WORK).getResult();
                periodic.get();
                refresh.get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Log.w("bitboxapp", "Price widget cleanup interrupted", e);
            } catch (Exception e) {
                Log.w("bitboxapp", "Could not clean up price widget", e);
            } finally {
                try {
                    if (!preferences(app).edit().remove(PUBLISHED_STATE).commit()) {
                        Log.w("bitboxapp", "Could not clear price widget state");
                    }
                } catch (Exception e) {
                    Log.w("bitboxapp", "Could not clear price widget state", e);
                } finally {
                    if (result != null) {
                        result.finish();
                    }
                }
            }
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
        renderCached(context, step, true);
        schedule(context, force);
    }

    // Called only on WIDGET_EXECUTOR, including after fetches and navigation.
    private static JSONObject renderCached(Context context, int step, boolean pending) {
        if (widgetIds(context).length == 0) {
            return null;
        }
        try {
            JSONObject state = new JSONObject(Mobileserver.priceWidgetState(
                    context.getFilesDir().getAbsolutePath(), selectedIndex(context) + step, false, false));
            // Go normalizes the selection against the active accounts before it is persisted.
            preferences(context).edit().putLong(SELECTED_INDEX, state.getLong("selectedIndex")).apply();
            JSONObject display = pending && isOnline(context) ? pendingDisplay(context, state) : state;
            PriceWidgetRenderer.render(context, display);
            // Retain only the last published view, including its original update time.
            // This is never used as the backend's price cache or to fulfil refresh requests.
            preferences(context).edit().putString(PUBLISHED_STATE, display.toString()).apply();
            return state;
        } catch (Exception e) {
            Log.w("bitboxapp", "Could not read price widget data", e);
            PriceWidgetRenderer.render(context, new JSONObject());
            preferences(context).edit().remove(PUBLISHED_STATE).apply();
            return null;
        }
    }

    private static JSONObject pendingDisplay(Context context, JSONObject state) throws JSONException {
        if (hasPrice(state)) {
            return state;
        }
        JSONObject previous;
        try {
            previous = new JSONObject(preferences(context).getString(PUBLISHED_STATE, "{}"));
        } catch (JSONException e) {
            previous = new JSONObject();
        }
        JSONObject display = new JSONObject(state.toString());
        if (samePair(previous, state) && hasPrice(previous)) {
            for (String key : new String[]{"price", "change24h", "chart", "updatedAt"}) {
                display.put(key, previous.opt(key));
            }
        } else {
            display.put("loading", true);
        }
        return display;
    }

    private static boolean hasPrice(JSONObject state) {
        return state.has("price") && !state.isNull("price");
    }

    private static boolean samePair(JSONObject left, JSONObject right) {
        return left.optString("coinCode").equals(right.optString("coinCode"))
                && left.optString("currency").equals(right.optString("currency"));
    }

    private static boolean isOnline(Context context) {
        ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
        NetworkCapabilities network = connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
        return network != null && network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
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
            renderCached(context, 0, true);
            enqueueFetch(context, true);
        });
    }

    @SuppressLint("ApplySharedPref") // Persist the request before queuing work, on WIDGET_EXECUTOR.
    private static void enqueueFetch(Context context, boolean force) {
        SharedPreferences prefs = preferences(context);
        SharedPreferences.Editor edit = prefs.edit()
                .putLong(FETCH_GENERATION, prefs.getLong(FETCH_GENERATION, 0) + 1);
        if (force) {
            edit.putLong(REQUESTED_REFRESH, prefs.getLong(REQUESTED_REFRESH, 0) + 1);
        }
        edit.commit();
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
        final long generation;

        FetchRequest(long index, long refreshToken, long generation) {
            this.index = index;
            this.refreshToken = refreshToken;
            this.generation = generation;
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
            return new FetchRequest(selectedIndex(context), requested > fulfilled ? requested : 0,
                    prefs.getLong(FETCH_GENERATION, 0));
        });
    }

    @SuppressLint("ApplySharedPref") // Persist completion on WIDGET_EXECUTOR before the next request.
    static Future<?> completeFetch(Context context, FetchRequest request, JSONObject state) {
        return WIDGET_EXECUTOR.submit(() -> {
            // A successful canceled worker may have saved a quote. Publish for the current selection.
            // An older completion must not end the loading display of a replacement request.
            boolean pending = request.generation != preferences(context).getLong(FETCH_GENERATION, 0);
            JSONObject current = renderCached(context, 0, pending);
            if (state != null && current != null && state.optBoolean("refreshed")
                    && samePair(state, current)) {
                SharedPreferences prefs = preferences(context);
                prefs.edit().putLong(FULFILLED_REFRESH,
                        Math.max(request.refreshToken, prefs.getLong(FULFILLED_REFRESH, 0))).commit();
            }
        });
    }
}
