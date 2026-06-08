package ch.shiftcrypto.bitboxapp;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class FileSaveHelper {
    private static final int COPY_BUFFER_SIZE = 8192;

    private final ComponentActivity activity;
    private final ActivityResultLauncher<Intent> createDocumentLauncher;
    private String pendingPath;

    public FileSaveHelper(ComponentActivity activity) {
        this.activity = activity;
        this.createDocumentLauncher = activity.registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                this::handleCreateDocumentResult
        );
    }

    public void promptSave(String sourcePath, String mimeType) {
        if (pendingPath != null) {
            Util.log("Save request already in progress; dropping new request");
            return;
        }
        pendingPath = sourcePath;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType != null ? mimeType : "application/octet-stream");
        intent.putExtra(Intent.EXTRA_TITLE, new File(sourcePath).getName());
        activity.runOnUiThread(() -> createDocumentLauncher.launch(intent));
    }

    private void copyFileToUri(File source, Uri destUri) {
        if (!source.exists()) {
            Util.log("File does not exist: " + source.getAbsolutePath());
            Toast.makeText(activity, "Save failed: file not found", Toast.LENGTH_LONG).show();
            return;
        }
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
        } catch (IOException e) {
            Util.log("Save failed: " + e.getMessage());
            Toast.makeText(activity, "Save failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void handleCreateDocumentResult(ActivityResult result) {
        Uri uri = null;
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            uri = result.getData().getData();
        }
        if (uri != null && pendingPath != null) {
            copyFileToUri(new File(pendingPath), uri);
        }
        pendingPath = null;
    }
}
