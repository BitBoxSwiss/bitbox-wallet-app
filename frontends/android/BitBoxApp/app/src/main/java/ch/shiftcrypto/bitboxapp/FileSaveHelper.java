package ch.shiftcrypto.bitboxapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Looper;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

public class FileSaveHelper {
    private static final int COPY_BUFFER_SIZE = 8192;

    private final ComponentActivity activity;
    private final ActivityResultLauncher<Intent> createDocumentLauncher;
    // Accessed only on the main thread.
    private CompletableFuture<Uri> pendingSave;

    public FileSaveHelper(ComponentActivity activity) {
        this.activity = activity;
        this.createDocumentLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                this::handleCreateDocumentResult
        );
        activity.getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onDestroy(@NonNull LifecycleOwner owner) {
                if (pendingSave != null) {
                    pendingSave.completeExceptionally(new IOException("Activity closed before saving the file"));
                }
            }
        });
    }

    // Called from a backend worker: wait for the picker and finish writing before reporting success.
    public boolean promptSave(String sourcePath, String mimeType) throws IOException {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            throw new IllegalStateException("File saving must run off the main thread");
        }
        CompletableFuture<Uri> result = new CompletableFuture<>();
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType != null ? mimeType : "application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, new File(sourcePath).getName());
        activity.runOnUiThread(() -> {
            if (activity.isDestroyed()) {
                result.completeExceptionally(new IOException("Activity closed before saving the file"));
            } else if (pendingSave != null) {
                result.completeExceptionally(new IOException("Save request already in progress"));
            } else {
                pendingSave = result;
                try {
                    createDocumentLauncher.launch(intent);
                } catch (RuntimeException e) {
                    result.completeExceptionally(e);
                }
            }
        });
        try {
            Uri uri = result.get();
            if (uri == null) {
                return false;
            }
            copyFileToUri(new File(sourcePath), uri);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("File saving interrupted", e);
        } catch (ExecutionException e) {
            throw new IOException(e.getCause().getMessage(), e.getCause());
        } finally {
            activity.runOnUiThread(() -> {
                if (pendingSave == result) {
                    pendingSave = null;
                }
            });
        }
    }

    private void copyFileToUri(File source, Uri destUri) throws IOException {
        try (InputStream in = new FileInputStream(source);
             OutputStream out = activity.getContentResolver().openOutputStream(destUri, "w")) {
            if (out == null) {
                throw new IOException("Unable to open output stream");
            }
            byte[] buffer = new byte[COPY_BUFFER_SIZE];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
        }
    }

    private void handleCreateDocumentResult(ActivityResult result) {
        Uri uri = null;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            uri = result.getData().getData();
        }
        if (pendingSave != null) {
            pendingSave.complete(uri);
        }
    }
}
