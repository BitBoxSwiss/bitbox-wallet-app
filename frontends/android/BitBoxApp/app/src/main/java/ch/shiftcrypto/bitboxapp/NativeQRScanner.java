// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.GradientDrawable;
import android.util.Size;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.FocusMeteringAction;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.TorchState;
import androidx.camera.core.ZoomState;
import androidx.camera.core.resolutionselector.AspectRatioStrategy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.core.resolutionselector.ResolutionStrategy;
import androidx.camera.mlkit.vision.MlKitAnalyzer;
import androidx.camera.view.CameraController;
import androidx.camera.view.LifecycleCameraController;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;
import androidx.webkit.JavaScriptReplyProxy;

import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.barcode.common.Barcode;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** Owns a single camera session. All session and view access stays on the UI thread. */
public final class NativeQRScanner implements DefaultLifecycleObserver {
    private final MainActivity activity;
    private final ActivityResultLauncher<String> permission;
    private boolean permissionPending;
    private WebView webView;
    private Session session;
    private int backgroundColor = Color.WHITE;

    private static final class Session {
        final int id;
        final JavaScriptReplyProxy reply;
        final PreviewView preview;
        final LifecycleCameraController controller;
        final BarcodeScanner decoder;
        JSONObject geometry;
        boolean initialized;
        boolean initializing;
        CameraInfo observedCamera;
        boolean ready;
        String lastText;
        long lastResultTime;

        Session(int id, JavaScriptReplyProxy reply, MainActivity activity, JSONObject geometry) {
            this.id = id;
            this.reply = reply;
            this.geometry = geometry;
            preview = new PreviewView(activity);
            preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
            preview.setScaleType(PreviewView.ScaleType.FILL_CENTER);
            preview.setClipToOutline(true);
            controller = new LifecycleCameraController(activity);
            controller.setEnabledUseCases(CameraController.IMAGE_ANALYSIS);
            controller.setImageAnalysisBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST);
            controller.setImageAnalysisResolutionSelector(new ResolutionSelector.Builder()
                    .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                    .setResolutionStrategy(new ResolutionStrategy(new Size(1280, 720),
                            ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER)).build());
            decoder = BarcodeScanning.getClient(new BarcodeScannerOptions.Builder()
                    .setBarcodeFormats(Barcode.FORMAT_QR_CODE).build());
            preview.setController(controller);
        }
    }

    public NativeQRScanner(MainActivity activity) {
        this.activity = activity;
        permission = activity.registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
            permissionPending = false;
            Session current = session;
            if (current != null) {
                if (granted) {
                    initialize(current);
                } else {
                    fail(current, "permissionDenied");
                }
            }
        });
        activity.getLifecycle().addObserver(this);
    }

    public void attach(WebView webView) {
        this.webView = webView;
    }

    public void setBackgroundColor(int color) {
        backgroundColor = color;
        webView.setBackgroundColor(session == null ? color : Color.TRANSPARENT);
    }

    public void handle(JSONObject command, JavaScriptReplyProxy reply) {
        try {
            int id = command.getInt("sessionId");
            String action = command.getString("action");
            if ("start".equals(action)) {
                stop();
                Session current = new Session(id, reply, activity, command.getJSONObject("geometry"));
                session = current;
                ViewGroup parent = (ViewGroup) webView.getParent();
                parent.addView(current.preview, parent.indexOfChild(webView), new ViewGroup.LayoutParams(1, 1));
                webView.setBackgroundColor(Color.TRANSPARENT);
                updateGeometry(current);
                if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    initialize(current);
                } else if (!permissionPending) {
                    permissionPending = true;
                    permission.launch(Manifest.permission.CAMERA);
                }
                return;
            }
            Session current = session;
            if (current == null || current.id != id) {
                return;
            }
            switch (action) {
                case "stop":
                    stop();
                    break;
                case "geometry":
                    current.geometry = command.getJSONObject("geometry");
                    updateGeometry(current);
                    break;
                case "torch":
                    if (current.ready && current.controller.getCameraInfo().hasFlashUnit()) {
                        current.controller.enableTorch(command.getBoolean("enabled"));
                    }
                    break;
                case "zoom":
                    ZoomState zoom = current.controller.getZoomState().getValue();
                    float requested = (float) command.getDouble("zoom");
                    if (current.ready && zoom != null && Float.isFinite(requested)) {
                        current.controller.setZoomRatio(Math.max(zoom.getMinZoomRatio(), Math.min(zoom.getMaxZoomRatio(), requested)));
                    }
                    break;
                case "focus":
                    float x = (float) command.getDouble("x");
                    float y = (float) command.getDouble("y");
                    if (current.ready && Float.isFinite(x) && Float.isFinite(y)) {
                        FocusMeteringAction focus = new FocusMeteringAction.Builder(current.preview.getMeteringPointFactory()
                                .createPoint(Math.max(0, Math.min(1, x)) * current.preview.getWidth(),
                                        Math.max(0, Math.min(1, y)) * current.preview.getHeight()))
                                .setAutoCancelDuration(3, TimeUnit.SECONDS).build();
                        current.controller.getCameraControl().startFocusAndMetering(focus);
                    }
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            if (session != null) {
                fail(session, "cameraUnavailable");
            } else {
                try {
                    reply.postMessage(new JSONObject().put("type", "qrScannerEvent").put("event", new JSONObject()
                            .put("sessionId", command.getInt("sessionId")).put("type", "error")
                            .put("code", "cameraUnavailable")).toString());
                } catch (JSONException ignored) {
                }
            }
        }
    }

    private void initialize(Session current) {
        if (current.initializing) {
            return;
        }
        current.initializing = true;
        current.controller.getInitializationFuture().addListener(() -> {
            if (session != current) {
                return;
            }
            try {
                current.controller.getInitializationFuture().get();
                CameraSelector selector = CameraSelector.DEFAULT_BACK_CAMERA;
                if (!current.controller.hasCamera(selector)) {
                    selector = CameraSelector.DEFAULT_FRONT_CAMERA;
                    if (!current.controller.hasCamera(selector)) {
                        fail(current, "noCamera");
                        return;
                    }
                }
                current.controller.setCameraSelector(selector);
                current.controller.setImageAnalysisAnalyzer(ContextCompat.getMainExecutor(activity), new MlKitAnalyzer(
                        Collections.singletonList(current.decoder), ImageAnalysis.COORDINATE_SYSTEM_VIEW_REFERENCED,
                        ContextCompat.getMainExecutor(activity), result -> {
                            if (session != current || !current.ready || !resumed()) {
                                return;
                            }
                            if (result.getThrowable(current.decoder) != null) {
                                fail(current, "cameraUnavailable");
                                return;
                            }
                            List<Barcode> codes = result.getValue(current.decoder);
                            if (codes != null) {
                                decoded(current, codes);
                            }
                        }));
                current.preview.getPreviewStreamState().observe(activity, state -> {
                    if (session == current && state == PreviewView.StreamState.STREAMING && resumed()) {
                        current.ready = true;
                        sendCamera(current, "ready");
                    }
                });
                current.controller.getTorchState().observe(activity, state -> sendCamera(current, "state"));
                current.controller.getZoomState().observe(activity, state -> sendCamera(current, "state"));
                current.initialized = true;
                bind(current);
            } catch (Exception e) {
                fail(current, "cameraUnavailable");
            }
        }, ContextCompat.getMainExecutor(activity));
    }

    private boolean resumed() {
        return activity.getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED);
    }

    private void bind(Session current) {
        if (current.initialized && resumed()) {
            try {
                current.controller.bindToLifecycle(activity);
                if (current.observedCamera != null) {
                    current.observedCamera.getCameraState().removeObservers(activity);
                }
                current.observedCamera = current.controller.getCameraInfo();
                if (current.observedCamera != null) {
                    current.observedCamera.getCameraState().observe(activity, state -> {
                        if (session == current && resumed() && state.getError() != null) {
                            fail(current, "cameraUnavailable");
                        }
                    });
                }
            } catch (Exception e) {
                fail(current, "cameraUnavailable");
            }
        }
    }

    private void updateGeometry(Session current) throws JSONException {
        JSONObject p = current.geometry.getJSONObject("preview");
        int width = Math.max(1, (int) (p.getDouble("width") * webView.getWidth()));
        int height = Math.max(1, (int) (p.getDouble("height") * webView.getHeight()));
        ViewGroup.LayoutParams params = current.preview.getLayoutParams();
        if (params.width != width || params.height != height) {
            params.width = width;
            params.height = height;
            current.preview.setLayoutParams(params);
        }
        current.preview.setTranslationX(webView.getX() + (float) p.getDouble("x") * webView.getWidth());
        current.preview.setTranslationY(webView.getY() + (float) p.getDouble("y") * webView.getHeight());
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.BLACK);
        background.setCornerRadius((float) current.geometry.getDouble("radius") * width);
        current.preview.setBackground(background);
    }

    private void decoded(Session current, List<Barcode> codes) {
        try {
            JSONObject g = current.geometry.getJSONObject("guide");
            float width = current.preview.getWidth();
            float height = current.preview.getHeight();
            RectF guide = new RectF((float) g.getDouble("x") * width, (float) g.getDouble("y") * height,
                    (float) (g.getDouble("x") + g.getDouble("width")) * width,
                    (float) (g.getDouble("y") + g.getDouble("height")) * height);
            Barcode closest = null;
            double bestDistance = Double.MAX_VALUE;
            for (Barcode code : codes) {
                Rect bounds = code.getBoundingBox();
                if (bounds == null || code.getRawValue() == null || !guide.contains(bounds.exactCenterX(), bounds.exactCenterY())) {
                    continue;
                }
                double distance = Math.hypot(bounds.exactCenterX() - guide.centerX(), bounds.exactCenterY() - guide.centerY());
                if (distance < bestDistance) {
                    closest = code;
                    bestDistance = distance;
                }
            }
            if (closest != null) {
                String text = closest.getRawValue();
                long now = android.os.SystemClock.elapsedRealtime();
                if (!text.equals(current.lastText) || now - current.lastResultTime >= 500) {
                    current.lastText = text;
                    current.lastResultTime = now;
                    send(current, new JSONObject().put("type", "result").put("text", text));
                }
            }
        } catch (JSONException e) {
            fail(current, "cameraUnavailable");
        }
    }

    private void sendCamera(Session current, String type) {
        if (session != current || !current.ready || !resumed()) {
            return;
        }
        ZoomState zoom = current.controller.getZoomState().getValue();
        if (zoom == null) {
            return;
        }
        try {
            JSONObject camera = new JSONObject()
                    .put("hasFlash", current.controller.getCameraInfo().hasFlashUnit())
                    .put("isFlashOn", Integer.valueOf(TorchState.ON).equals(current.controller.getTorchState().getValue()))
                    .put("zoom", zoom.getZoomRatio());
            send(current, new JSONObject().put("type", type).put("camera", camera));
        } catch (JSONException e) {
            fail(current, "cameraUnavailable");
        }
    }

    @android.annotation.SuppressLint("RequiresFeature")
    private void send(Session current, JSONObject event) throws JSONException {
        if (session == current) {
            event.put("sessionId", current.id);
            current.reply.postMessage(new JSONObject().put("type", "qrScannerEvent").put("event", event).toString());
        }
    }

    private void fail(Session current, String code) {
        if (session != current) {
            return;
        }
        try {
            send(current, new JSONObject().put("type", "error").put("code", code));
        } catch (JSONException ignored) {
        }
        stop();
    }

    public void stop() {
        Session current = session;
        session = null;
        if (current != null) {
            if (current.observedCamera != null) {
                current.observedCamera.getCameraState().removeObservers(activity);
            }
            current.controller.getTorchState().removeObservers(activity);
            current.controller.getZoomState().removeObservers(activity);
            current.preview.getPreviewStreamState().removeObservers(activity);
            current.controller.clearImageAnalysisAnalyzer();
            current.controller.unbind();
            current.decoder.close();
            current.preview.setController(null);
            ViewGroup parent = (ViewGroup) current.preview.getParent();
            if (parent != null) {
                parent.removeView(current.preview);
            }
            webView.setBackgroundColor(backgroundColor);
        }
    }

    @Override
    public void onPause(@NonNull LifecycleOwner owner) {
        if (session != null) {
            session.ready = false;
            session.controller.enableTorch(false);
            session.controller.unbind();
        }
    }

    @Override
    public void onResume(@NonNull LifecycleOwner owner) {
        if (session != null) {
            bind(session);
        }
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        stop();
    }
}
