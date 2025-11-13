package ch.shiftcrypto.bitboxapp;

import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import mobileserver.Mobileserver;

public class NetworkHelper {
    private final ConnectivityManager connectivityManager;
    private final ConnectivityManager.NetworkCallback networkCallback;

    public NetworkHelper(ConnectivityManager connectivityManager) {
        this.connectivityManager = connectivityManager;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(@NonNull android.net.Network network, @NonNull android.net.NetworkCapabilities capabilities) {
                Util.log("onCapabilitiesChanged");
                super.onCapabilitiesChanged(network, capabilities);
                checkNetworkConnectivity(network);
            }

            @Override
            public void onLost(@NonNull Network network) {
                Util.log("onLost");
                super.onLost(network);
                // Workaround: onLost could trigger while the network is still winding down.
                // Checking immediately for connection and mobile usage could lead to wrong results.
                // see https://developer.android.com/reference/android/net/ConnectivityManager.NetworkCallback#onLost(android.net.Network)
                // Since onCapabilitiesChanged doesn't seem to be enough, this is the only solution I
                // found to make this reliable. It's not beautiful, but seems to fix the issue.
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    checkConnectivity();
                    Mobileserver.usingMobileDataChanged();
                }, 250);
            }
        };
    }

    public void registerNetworkCallback() {
        if (connectivityManager == null) {
            return;
        }

        // Register the network callback to listen for changes in network capabilities.
        // It needs to be unregistered when the app is in background to avoid resource consumption.
        // See https://developer.android.com/reference/android/net/ConnectivityManager#registerNetworkCallback(android.net.NetworkRequest,%20android.net.ConnectivityManager.NetworkCallback)
        connectivityManager.registerDefaultNetworkCallback(networkCallback);
    }

    public void unregisterNetworkCallback() {
        if (connectivityManager != null && networkCallback != null) {
            connectivityManager.unregisterNetworkCallback(networkCallback);
        }
    }

    // Fetches the active network and verifies if that provides internet access.
    public void checkConnectivity() {
        if (connectivityManager == null) {
            Mobileserver.setOnline(true);
            return;
        }
        Network activeNetwork = connectivityManager.getActiveNetwork();
        checkNetworkConnectivity(activeNetwork);
    }

    private void checkNetworkConnectivity(Network network) {
        // We force the server to fetch the mobile data status and possibly update the
        // related banner.
        Mobileserver.usingMobileDataChanged();

        if (network == null) {
            Util.log("checkConnectivity: network null");
            Mobileserver.setOnline(false);
            return;
        }

        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
        Mobileserver.setOnline(hasInternetConnectivity(capabilities));
    }

    private boolean hasInternetConnectivity(NetworkCapabilities capabilities) {
        Util.log("hasInternetConnectivity");
        if (capabilities == null) {
            Util.log("hasInternetConnectivity: null capabilities");
            return false;
        }

        // NET_CAPABILITY_INTERNET means that the network should be able to provide internet access,
        // NET_CAPABILITY_VALIDATED means that the network connectivity was successfully detected.
        // see https://developer.android.com/reference/android/net/NetworkCapabilities#NET_CAPABILITY_VALIDATED
        // Checking only VALIDATED would be probably enough, but checking for both
        // is probably better for reliability.
        boolean hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        boolean isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        Util.log("Has internet connectivity: " + (hasInternet && isValidated));
        return hasInternet && isValidated;
    }

    // if usingMobileData returns true, a banner will be displayed in the app to warn about
    // possible network data consumption.
    public boolean usingMobileData() {
        if (connectivityManager == null) {
            return false;
        }

        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(connectivityManager.getActiveNetwork());
        boolean mobileData = capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
        Util.log("Using mobile data: " + mobileData);
        return mobileData;
    }
}
