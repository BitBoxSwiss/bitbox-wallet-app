package ch.shiftcrypto.bitboxapp;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class LightningEncryptionHelper {
    public static final String ERR_KEY_MISSING = "lightning-key-missing";

    private static final String PREFS_NAME = "lightning-encryption";
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int GCM_IV_LENGTH_BYTES = 12;

    private static String getKeyAlias(String accountCode) {
        return "bitboxapp.lightning.seed." + accountCode + ".v1";
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static SecretKey getOrCreateWrappingKey(String accountCode) throws Exception {
        String alias = getKeyAlias(accountCode);
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        if (keyStore.containsAlias(alias)) {
            KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) keyStore.getEntry(alias, null);
            return entry.getSecretKey();
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        keyGenerator.init(new KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setKeySize(256)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build());
        return keyGenerator.generateKey();
    }

    public static void storeKey(Context context, String accountCode, String encryptionKey) throws Exception {
        SecretKey wrappingKey = getOrCreateWrappingKey(accountCode);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, wrappingKey);

        byte[] plaintextKey = Base64.decode(encryptionKey, Base64.DEFAULT);
        byte[] ciphertext = cipher.doFinal(plaintextKey);
        byte[] iv = cipher.getIV();
        if (iv.length != GCM_IV_LENGTH_BYTES) {
            throw new Exception("unexpected GCM IV length");
        }
        byte[] wrappedKey = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, wrappedKey, 0, iv.length);
        System.arraycopy(ciphertext, 0, wrappedKey, iv.length, ciphertext.length);

        boolean success = preferences(context).edit()
            .putString(getKeyAlias(accountCode), Base64.encodeToString(wrappedKey, Base64.NO_WRAP))
            .commit();
        if (!success) {
            throw new Exception("failed to persist lightning encryption key");
        }
    }

    public static String loadKey(Context context, String accountCode) throws Exception {
        String wrappedKeyBase64 = preferences(context).getString(getKeyAlias(accountCode), null);
        if (wrappedKeyBase64 == null) {
            throw new Exception(ERR_KEY_MISSING);
        }

        SecretKey wrappingKey = getOrCreateWrappingKey(accountCode);
        byte[] wrappedKey = Base64.decode(wrappedKeyBase64, Base64.DEFAULT);
        if (wrappedKey.length < GCM_IV_LENGTH_BYTES) {
            throw new Exception("wrapped key too short");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
        System.arraycopy(wrappedKey, 0, iv, 0, iv.length);
        byte[] ciphertext = new byte[wrappedKey.length - iv.length];
        System.arraycopy(wrappedKey, iv.length, ciphertext, 0, ciphertext.length);
        cipher.init(Cipher.DECRYPT_MODE, wrappingKey, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
        byte[] plaintextKey = cipher.doFinal(ciphertext);
        return Base64.encodeToString(plaintextKey, Base64.NO_WRAP);
    }

    public static void deleteKey(Context context, String accountCode) throws Exception {
        boolean success = preferences(context).edit()
            .remove(getKeyAlias(accountCode))
            .commit();
        if (!success) {
            throw new Exception("failed to delete lightning encryption key");
        }
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        if (keyStore.containsAlias(getKeyAlias(accountCode))) {
            keyStore.deleteEntry(getKeyAlias(accountCode));
        }
    }
}
