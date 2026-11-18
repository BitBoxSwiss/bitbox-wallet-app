// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.RemoteViews;
import android.widget.TextView;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.shadows.ShadowAppWidgetManager;
import org.robolectric.shadows.ShadowLog;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, application = Application.class)
public class LightningWidgetTest {
    private Context context;
    private SharedPreferences preferences;
    private LightningWidgetSync sync;
    private ShadowAppWidgetManager widgets;
    private long requestID;
    private String query;
    private String png;
    private int refreshes;
    private static final int WIDGET_ID = 8;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        preferences = LightningWidgetProvider.preferences(context);
        preferences.edit().clear().commit();
        widgets = shadowOf(AppWidgetManager.getInstance(context));
        AppWidgetProviderInfo info = new AppWidgetProviderInfo();
        info.provider = new ComponentName(context, LightningWidgetProvider.class);
        info.initialLayout = R.layout.lightning_widget;
        widgets.addBoundWidget(WIDGET_ID, info);
        sync = new LightningWidgetSync(preferences, (id, request) -> {
            requestID = id;
            query = request;
        }, () -> {
            refreshes++;
            LightningWidgetProvider.refresh(context);
        });
        // A PNG fixture isolates cache/render behavior from the backend's QR encoder.
        Bitmap bitmap = Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888);
        bitmap.eraseColor(Color.BLACK);
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes);
        png = "data:image/png;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP);
    }

    private void respond(String response) {
        sync.handleResponse(requestID, response);
    }

    private void loadAddress() throws Exception {
        sync.sync();
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":true,\"data\":\"alice@bitbox.cash\"}");
        respond(new JSONObject().put("success", true).put("data", png).toString());
    }

    // Publishing the address and PNG together survives widget recreation without starting Go.
    @Test
    public void cachesPublicAddressAndRendersWithoutBackend() throws Exception {
        SharedPreferences prices = context.getSharedPreferences("price-widget", Context.MODE_PRIVATE);
        prices.edit().putLong("selectedIndex", 2).apply();
        loadAddress();
        assertTrue(requestID < 0);
        assertEquals("qr?data=alice%40bitbox.cash", new JSONObject(query).getString("endpoint"));
        assertEquals("alice@bitbox.cash", preferences.getString("address", null));
        assertEquals(png, preferences.getString("qr", null));
        assertEquals(2, prices.getLong("selectedIndex", 0));

        new LightningWidgetProvider().onUpdate(context, AppWidgetManager.getInstance(context), new int[]{WIDGET_ID});
        View view = widgets.getViewFor(WIDGET_ID);
        assertEquals("alice@bitbox.cash", ((TextView) view.findViewById(R.id.lightning_widget_address)).getText().toString());
        assertEquals(View.GONE, view.findViewById(R.id.lightning_widget_empty).getVisibility());
        assertNotNull(((ImageView) view.findViewById(R.id.lightning_widget_qr)).getDrawable());
    }

    // A replacement clears the old QR immediately, even when the subsequent lookup fails.
    @Test
    public void addressReplacementClearsCacheBeforeFailedLookup() throws Exception {
        loadAddress();
        sync.handleEvent("{\"subject\":\"lightning/address\",\"action\":\"replace\",\"object\":\"bob@bitbox.cash\"}");
        assertFalse(preferences.contains("address"));
        assertFalse(preferences.contains("qr"));
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":false}");
        assertFalse(preferences.contains("address"));
        assertEquals(View.VISIBLE, widgets.getViewFor(WIDGET_ID).findViewById(R.id.lightning_widget_empty).getVisibility());
        assertNull(((ImageView) widgets.getViewFor(WIDGET_ID).findViewById(R.id.lightning_widget_qr)).getDrawable());
    }

    // A QR response for a removed wallet cannot repopulate its address after invalidation.
    @Test
    public void accountRemovalIgnoresOutstandingQRCode() throws Exception {
        sync.sync();
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":true,\"data\":\"alice@bitbox.cash\"}");
        long oldID = requestID;
        sync.handleEvent("{\"subject\":\"lightning/account\"}");
        respond("null");
        sync.handleResponse(oldID, new JSONObject().put("success", true).put("data", png).toString());
        assertFalse(preferences.contains("account"));
        assertFalse(preferences.contains("address"));
        assertFalse(preferences.contains("qr"));
    }

    // A different account found on launch must not inherit an offline QR from another wallet.
    @Test
    public void accountReplacementClearsCacheWhenAddressUnavailable() throws Exception {
        loadAddress();
        sync.sync();
        respond("{\"code\":\"wallet-b\"}");
        respond("{\"success\":false}");
        assertFalse(preferences.contains("address"));
        assertEquals("wallet-b", preferences.getString("account", null));
    }

    // SDK failures keep a usable offline QR; an authoritative missing address clears it.
    @Test
    public void sdkFailurePreservesCacheUntilSuccessfulNullResponse() throws Exception {
        loadAddress();
        sync.handleEvent("{\"subject\":\"lightning/sdk-status\"}");
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":false}");
        assertEquals(png, preferences.getString("qr", null));
        sync.sync();
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":true,\"data\":null}");
        assertFalse(preferences.contains("address"));
    }

    // Repeated foreground syncs skip QR generation and widget updates for an unchanged address.
    @Test
    public void unchangedAddressDoesNotRegenerateQRCode() throws Exception {
        loadAddress();
        int count = refreshes;
        sync.sync();
        respond("{\"code\":\"wallet-a\"}");
        respond("{\"success\":true,\"data\":\"alice@bitbox.cash\"}");
        assertEquals("lightning/address", new JSONObject(query).getString("endpoint"));
        assertEquals(count, refreshes);
    }

    // A renamed address cannot be paired with the old QR when image generation fails.
    @Test
    public void invalidImageDoesNotPublishReplacementAddress() throws Exception {
        loadAddress();
        sync.sync();
        respond("{\"code\":\"wallet-a\"}");
        String address = "bob+test@bitbox.cash";
        respond(new JSONObject().put("success", true).put("data", address).toString());
        assertEquals("qr?data=" + Uri.encode(address), new JSONObject(query).getString("endpoint"));
        respond("{\"success\":true,\"data\":\"data:image/png;base64,aGVsbG8=\"}");
        assertFalse(preferences.contains("address"));
        assertFalse(preferences.contains("qr"));
    }

    // Malformed responses identify each sync stage without leaking payloads through messages or exceptions.
    @Test
    public void malformedResponsesLogOnlyRequestAndErrorTypes() {
        for (String request : new String[]{"ACCOUNT", "ADDRESS", "QR"}) {
            sync.sync();
            if (!request.equals("ACCOUNT")) {
                respond("{\"code\":\"private-wallet\"}");
            }
            if (request.equals("QR")) {
                respond("{\"success\":true,\"data\":\"private-address@bitbox.cash\"}");
            }
            ShadowLog.clear();
            respond("{\"data\":\"private-wallet-data");
            assertParseWarning(request, "JSONException");
        }
    }

    // Unexpected account types preserve the cache and never attach the offending value to the log.
    @Test
    public void unexpectedAccountTypeLogsSafelyAndPreservesCache() throws Exception {
        loadAddress();
        sync.sync();
        ShadowLog.clear();
        respond("[\"private-wallet-data\"]");
        assertParseWarning("ACCOUNT", "ClassCastException");
        assertEquals("alice@bitbox.cash", preferences.getString("address", null));
        assertEquals(png, preferences.getString("qr", null));
    }

    private static void assertParseWarning(String request, String errorType) {
        List<ShadowLog.LogItem> logs = ShadowLog.getLogsForTag("LightningWidgetSync");
        assertEquals(1, logs.size());
        ShadowLog.LogItem log = logs.get(0);
        assertEquals(Log.WARN, log.type);
        assertEquals(request + " response parsing failed: " + errorType, log.msg);
        assertNull(log.throwable);
    }

    // Maximum-length narrow and wide addresses fit at minimum size without sacrificing the QR.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void longAddressFitsAboveQRCode() {
        for (char letter : new char[]{'a', 'w'}) {
            String address = longAddress(letter);
            preferences.edit().putString("address", address).putString("qr", png).apply();
            LightningWidgetProvider.refresh(context);
            View view = widgets.getViewFor(WIDGET_ID);
            measure(view, context, 160, 200);
            assertAddressAndQRFit(view, context, address);
        }
    }

    // Large fonts show an honest resize prompt until the full address and usable QR fit together.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void largeFontsRequireResizeUntilAddressAndQRCodeFit() {
        Context scaled = fontContext(2);
        for (char letter : new char[]{'a', 'w'}) {
            String address = longAddress(letter);
            View compact = render(scaled, address, 160, 200);
            assertTrue(compact instanceof TextView);
            assertEquals(scaled.getString(R.string.lightning_widget_resize), ((TextView) compact).getText().toString());
            assertTextFits((TextView) compact);

            View expanded = render(scaled, address, 300, 300);
            assertAddressAndQRFit(expanded, scaled, address);
            assertEquals(View.VISIBLE, expanded.findViewById(R.id.lightning_widget_logo).getVisibility());
        }
    }

    // Intermediate sizes and accessibility fonts must never silently clip text or shrink the QR.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void layoutsEitherFitOrAskForMoreSpace() {
        for (float scale : new float[]{1, 1.3f, 2}) {
            Context scaled = fontContext(scale);
            for (char letter : new char[]{'a', 'w'}) {
                for (int width : new int[]{160, 220, 300}) {
                    for (int height : new int[]{200, 280}) {
                        String address = longAddress(letter);
                        View view = render(scaled, address, width, height);
                        if (view instanceof TextView) {
                            assertEquals(scaled.getString(R.string.lightning_widget_resize), ((TextView) view).getText().toString());
                            assertTextFits((TextView) view);
                        } else {
                            assertAddressAndQRFit(view, scaled, address);
                        }
                    }
                }
            }
        }
    }

    // Each widget uses its own launcher sizes, and enlarging a compact widget restores its QR.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void widgetSizesAreIndependentAndResizeRestoresQRCode() {
        Context scaled = fontContext(2);
        AppWidgetManager manager = AppWidgetManager.getInstance(scaled);
        ShadowAppWidgetManager widgets = shadowOf(manager);
        AppWidgetProviderInfo info = new AppWidgetProviderInfo();
        info.provider = new ComponentName(context, LightningWidgetProvider.class);
        info.initialLayout = R.layout.lightning_widget;
        widgets.addBoundWidget(WIDGET_ID, info);
        widgets.addBoundWidget(9, info);
        manager.updateAppWidgetOptions(WIDGET_ID, options(160, 200));
        Bundle expanded = options(160, 200);
        expanded.putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES,
                new ArrayList<>(Collections.singletonList(new SizeF(300, 300))));
        manager.updateAppWidgetOptions(9, expanded);
        preferences.edit().putString("address", longAddress('w')).putString("qr", png).apply();
        LightningWidgetProvider.refresh(scaled);
        assertTrue(widgets.getViewFor(WIDGET_ID) instanceof TextView);
        assertNotNull(widgets.getViewFor(9).findViewById(R.id.lightning_widget_qr));

        manager.updateAppWidgetOptions(WIDGET_ID, expanded);
        new LightningWidgetProvider().onAppWidgetOptionsChanged(scaled, manager, WIDGET_ID, expanded);
        assertNotNull(widgets.getViewFor(WIDGET_ID).findViewById(R.id.lightning_widget_qr));
    }

    // Android 7 launchers can apply both orientations without newer RemoteViews APIs.
    @Test
    @Config(sdk = 24)
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    public void legacyLaunchersSupportBothOrientations() {
        Bundle sizes = options(160, 200);
        sizes.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 320);
        sizes.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 300);
        RemoteViews views = LightningWidgetProvider.createViews(context, "alice@bitbox.cash",
                LightningWidgetProvider.decodeQRCode(png), sizes);
        for (int orientation : new int[]{Configuration.ORIENTATION_PORTRAIT, Configuration.ORIENTATION_LANDSCAPE}) {
            Configuration config = new Configuration(context.getResources().getConfiguration());
            config.orientation = orientation;
            Context oriented = context.createConfigurationContext(config);
            View view = views.apply(oriented, new FrameLayout(oriented));
            assertEquals("alice@bitbox.cash", ((TextView) view.findViewById(R.id.lightning_widget_address)).getText().toString());
        }
    }

    private static String longAddress(char letter) {
        return new String(new char[64]).replace('\0', letter) + "@bitbox.cash";
    }

    private Context fontContext(float scale) {
        Configuration config = new Configuration(context.getResources().getConfiguration());
        config.fontScale = scale;
        return context.createConfigurationContext(config);
    }

    private static Bundle options(int width, int height) {
        Bundle options = new Bundle();
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width);
        options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, height);
        return options;
    }

    private View render(Context context, String address, int width, int height) {
        View view = LightningWidgetProvider.createViews(context, address,
                LightningWidgetProvider.decodeQRCode(png), options(width, height))
                .apply(context, new FrameLayout(context));
        measure(view, context, width, height);
        return view;
    }

    private static void measure(View view, Context context, int widthDp, int heightDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int width = Math.round(widthDp * density);
        int height = Math.round(heightDp * density);
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, width, height);
    }

    private static void assertAddressAndQRFit(View view, Context context, String address) {
        TextView label = view.findViewById(R.id.lightning_widget_address);
        assertNotNull(label);
        assertEquals(address, label.getText().toString());
        assertTextFits(label);
        ImageView qr = view.findViewById(R.id.lightning_widget_qr);
        assertEquals(View.VISIBLE, qr.getVisibility());
        assertNotNull(qr.getDrawable());
        assertTrue(Math.min(qr.getWidth(), qr.getHeight()) >= Math.ceil(80 * context.getResources().getDisplayMetrics().density));
        assertTrue(qr.getBottom() <= view.getHeight());
    }

    private static void assertTextFits(TextView text) {
        android.text.Layout layout = text.getLayout();
        assertEquals(text.length(), layout.getLineEnd(layout.getLineCount() - 1));
        assertTrue(layout.getHeight() <= text.getHeight() - text.getCompoundPaddingTop() - text.getCompoundPaddingBottom());
        for (int line = 0; line < layout.getLineCount(); line++) {
            assertEquals(0, layout.getEllipsisCount(line));
            assertTrue("Text: " + text.getText() + ", line " + line + ", width " + layout.getLineMax(line) + ", available " + (text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight()),
                    Math.ceil(layout.getLineMax(line)) <= text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight());
        }
    }
}
