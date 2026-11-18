// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.util.Objects;
import java.util.function.BiConsumer;

import mobileserver.Mobileserver;

// GoAPI serializes these calls on the main thread. The widget only caches public receiving data.
final class LightningWidgetSync {
    private enum Request { ACCOUNT, ADDRESS, QR }

    private final SharedPreferences preferences;
    private final BiConsumer<Long, String> backendCall;
    private final Runnable refresh;
    private long nextQueryID;
    private long pendingID;
    private Request pending;
    private String requestedAddress;

    LightningWidgetSync(Context context) {
        this(LightningWidgetProvider.preferences(context), Mobileserver::backendCall,
                () -> LightningWidgetProvider.refresh(context));
    }

    LightningWidgetSync(SharedPreferences preferences, BiConsumer<Long, String> backendCall, Runnable refresh) {
        this.preferences = preferences;
        this.backendCall = backendCall;
        this.refresh = refresh;
    }

    void sync() {
        request(Request.ACCOUNT, "lightning/account");
    }

    void handleEvent(String message) {
        try {
            switch (new JSONObject(message).optString("subject")) {
                case "lightning/account":
                case "lightning/address":
                    clearAddress();
                    sync();
                    break;
                case "lightning/sdk-status":
                    sync();
                    break;
                default:
                    break;
            }
        } catch (JSONException ignored) {
            // Non-event messages do not change the receiving address.
        }
    }

    void handleResponse(long queryID, String response) {
        // A new event invalidates in-flight reads, including QR images for superseded addresses.
        if (pending == null || queryID != pendingID) {
            return;
        }
        Request request = pending;
        pending = null;
        try {
            if (request == Request.ACCOUNT) {
                Object result = new JSONTokener(response).nextValue();
                String account = result == JSONObject.NULL ? null : ((JSONObject) result).getString("code");
                if (!Objects.equals(account, preferences.getString("account", null))) {
                    clearAddress();
                }
                preferences.edit().putString("account", account).apply();
                if (account == null) {
                    clearAddress();
                } else {
                    request(Request.ADDRESS, "lightning/address");
                }
                return;
            }
            JSONObject result = new JSONObject(response);
            if (!result.optBoolean("success")) {
                return;
            }
            String data = result.isNull("data") ? null : result.getString("data");
            if (request == Request.ADDRESS) {
                if (Objects.equals(data, preferences.getString("address", null))
                        && preferences.contains("qr")) {
                    return;
                }
                clearAddress();
                if (data != null && !data.isEmpty()) {
                    requestedAddress = data;
                    request(Request.QR, "qr?data=" + Uri.encode(data));
                }
            } else if (LightningWidgetProvider.decodeQRCode(data) != null) {
                // Publish the address and its QR together, so they cannot disagree.
                preferences.edit().putString("address", requestedAddress).putString("qr", data).apply();
                refresh.run();
            }
        } catch (JSONException | ClassCastException ignored) {
            // Temporary backend failures preserve an existing address unless an event replaced it.
        }
    }

    private void request(Request request, String endpoint) {
        pending = request;
        pendingID = --nextQueryID;
        backendCall.accept(pendingID, "{\"method\":\"GET\",\"endpoint\":\"" + endpoint + "\"}");
    }

    private void clearAddress() {
        if (preferences.contains("address") || preferences.contains("qr")) {
            preferences.edit().remove("address").remove("qr").apply();
            refresh.run();
        }
    }
}
