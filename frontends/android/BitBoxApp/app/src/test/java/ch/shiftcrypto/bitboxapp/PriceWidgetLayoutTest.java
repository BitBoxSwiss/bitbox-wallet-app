// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.shadows.ShadowAppWidgetManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PriceWidgetLayoutTest {
    @Test
    public void fullPricesAndCurrenciesFitAtSupportedWidthsAndFontScales() throws Exception {
        Locale original = Locale.getDefault();
        try {
            for (Locale locale : new Locale[]{Locale.US, Locale.GERMANY, Locale.FRANCE, Locale.forLanguageTag("ar")}) {
                Locale.setDefault(locale);
                for (float fontScale : new float[]{1, 1.3f, 2}) {
                    Context context = context(locale, fontScale);
                    for (int width : new int[]{110, 130, 180, 260}) {
                        for (String currency : new String[]{"USD", "CZK", "VND"}) {
                            JSONObject state = quote(currency, currency.equals("VND") ? 3123456789.12 : 123456.00);
                            View view = render(context, state, width);
                            TextView pair = view.findViewById(R.id.widget_pair);
                            assertEquals("BTC/" + currency, pair.getText().toString());
                            assertFits(pair);
                            assertFits(view.findViewById(R.id.widget_price));
                            TextView inline = view.findViewById(R.id.widget_change);
                            assertFits(inline.getVisibility() == View.VISIBLE ? inline : view.findViewById(R.id.widget_change_compact));
                        }
                    }
                }
            }
        } finally {
            Locale.setDefault(original);
        }
    }

    @Test
    public void narrowHeaderStacksChangeAndWideHeaderKeepsItInline() throws Exception {
        Context context = context(Locale.US, 1);
        View narrow = render(context, quote("USD", 1810178.95), 110);
        assertEquals(View.GONE, narrow.findViewById(R.id.widget_change).getVisibility());
        assertEquals(View.VISIBLE, narrow.findViewById(R.id.widget_change_compact).getVisibility());
        View wide = render(context, quote("USD", 1810178.95), 260);
        assertEquals(View.VISIBLE, wide.findViewById(R.id.widget_change).getVisibility());
        assertEquals(View.GONE, wide.findViewById(R.id.widget_change_compact).getVisibility());
    }

    @Test
    @Config(sdk = 24)
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    public void androidSevenRendersWithExplicitTextSizes() throws Exception {
        View view = render(context(Locale.US, 1), quote("USD", 123456.00), 110);
        TextView price = view.findViewById(R.id.widget_price);
        assertEquals(View.VISIBLE, price.getVisibility());
        assertTrue(price.length() > 0);
        assertTrue(price.getTextSize() > 0);
    }

    @Test
    public void unavailableTextFitsWithLargeFonts() throws Exception {
        View view = render(context(Locale.US, 2), new JSONObject("{\"coinCode\":\"btc\",\"currency\":\"USD\"}"), 110);
        assertFits(view.findViewById(R.id.widget_pair));
        assertFits(view.findViewById(R.id.widget_unavailable));
    }

    @Test
    public void renderingUsesEachWidgetsDimensionsAndUpdatesAfterResize() throws Exception {
        Context context = context(Locale.US, 1);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ShadowAppWidgetManager widgets = shadowOf(manager);
        AppWidgetProviderInfo info = new AppWidgetProviderInfo();
        info.provider = new ComponentName(context, HelloWidgetProvider.class);
        info.initialLayout = R.layout.price_widget;
        widgets.addBoundWidget(7, info);
        widgets.addBoundWidget(8, info);
        Bundle narrow = new Bundle();
        narrow.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110);
        narrow.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 160);
        manager.updateAppWidgetOptions(7, narrow);
        Bundle wide = new Bundle(narrow);
        wide.putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES,
                new ArrayList<>(Collections.singletonList(new SizeF(260, 160))));
        manager.updateAppWidgetOptions(8, wide);

        PriceWidgetRenderer.render(context, quote("USD", 123456.00));
        assertEquals(View.VISIBLE, widgets.getViewFor(7).findViewById(R.id.widget_change_compact).getVisibility());
        assertEquals(View.GONE, widgets.getViewFor(8).findViewById(R.id.widget_change_compact).getVisibility());

        manager.updateAppWidgetOptions(7, wide);
        PriceWidgetRenderer.render(context, quote("USD", 123456.00));
        assertEquals(View.GONE, widgets.getViewFor(7).findViewById(R.id.widget_change_compact).getVisibility());
    }

    private Context context(Locale locale, float fontScale) {
        Context app = RuntimeEnvironment.getApplication();
        Configuration configuration = new Configuration(app.getResources().getConfiguration());
        configuration.setLocale(locale);
        configuration.fontScale = fontScale;
        return app.createConfigurationContext(configuration);
    }

    private JSONObject quote(String currency, double price) throws Exception {
        return new JSONObject().put("coinCode", "btc").put("currency", currency).put("price", price)
                .put("change24h", 2.34).put("chart", new JSONArray("[0,0.5,0.25,1]"))
                .put("coins", new JSONArray("[\"btc\",\"eth\",\"ltc\"]"));
    }

    private View render(Context context, JSONObject state, int widthDp) {
        View view = PriceWidgetRenderer.createViews(context, state, widthDp, 160).apply(context, new FrameLayout(context));
        float density = context.getResources().getDisplayMetrics().density;
        int width = (int) (widthDp * density);
        int height = (int) (160 * density);
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, width, height);
        return view;
    }

    private void assertFits(TextView text) {
        String message = text.getText() + " at " + text.getTextSize() + "px in " + text.getWidth() + "x" + text.getHeight();
        assertEquals(message, View.VISIBLE, text.getVisibility());
        assertNotNull(message, text.getLayout());
        // The measured fitting path is also used on Android 7, which lacks framework autosizing.
        assertEquals(TextView.AUTO_SIZE_TEXT_TYPE_NONE, text.getAutoSizeTextType());
        int width = text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight();
        int height = text.getHeight() - text.getCompoundPaddingTop() - text.getCompoundPaddingBottom();
        assertTrue(message, text.getPaint().measureText(text.getText().toString()) <= width);
        assertTrue(message, text.getLayout().getHeight() <= height);
        assertEquals(message, text.length(), text.getLayout().getLineEnd(0));
        assertEquals(message, 0, text.getLayout().getEllipsisCount(0));
    }
}
