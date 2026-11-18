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
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.util.Base64;
import android.view.View;
import android.widget.ImageView;
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

import java.io.ByteArrayOutputStream;

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

    // At minimum size, a maximum-length address stays readable without clipping the QR or domain.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void longAddressFitsAboveQRCode() {
        String address = new String(new char[64]).replace('\0', 'a') + "@bitbox.cash";
        preferences.edit().putString("address", address).putString("qr", png).apply();
        LightningWidgetProvider.refresh(context);
        View view = widgets.getViewFor(WIDGET_ID);
        view.measure(View.MeasureSpec.makeMeasureSpec(480, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(600, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, 480, 600);
        TextView label = view.findViewById(R.id.lightning_widget_address);
        int lastLine = label.getLayout().getLineCount() - 1;
        assertEquals(0, label.getLayout().getEllipsisCount(lastLine));
        assertEquals(address.length(), label.getLayout().getLineEnd(lastLine));
        assertTrue(view.findViewById(R.id.lightning_widget_qr).getHeight() >= 210);
    }
}
