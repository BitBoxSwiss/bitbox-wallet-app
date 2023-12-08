package ch.shiftcrypto.bitboxapp;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.util.concurrent.Executor;

public class BiometricAuthHelper {

    public interface AuthCallback {
        void onSuccess();
        void onFailure();
        void onCancel();
    }

    public static void showAuthenticationPrompt(FragmentActivity activity, AuthCallback callback) {
        Executor executor = ContextCompat.getMainExecutor(activity);
        BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                new Handler(Looper.getMainLooper()).post(callback::onSuccess);
            }

            @Override
            public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                new Handler(Looper.getMainLooper()).post(callback::onFailure);
            }

            @Override
            public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                if (errorCode == BiometricPrompt.ERROR_USER_CANCELED) {
                    Util.log("Authentication error: user canceled");
                    new Handler(Looper.getMainLooper()).post(callback::onCancel);
                } else {
                    Util.log("Authentication error: " + errorCode + " - " + errString);
                    new Handler(Looper.getMainLooper()).post(callback::onFailure);
                }
                super.onAuthenticationError(errorCode, errString);
            }
        });

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Authentication required")
                .setAllowedAuthenticators(BiometricManager.Authenticators.DEVICE_CREDENTIAL |
                                BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .setConfirmationRequired(false)
                .build();
        biometricPrompt.authenticate(promptInfo);
    }
}
