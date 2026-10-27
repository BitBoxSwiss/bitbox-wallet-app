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
import android.util.TypedValue;
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

import java.text.DateFormat;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.Locale;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PriceWidgetLayoutTest {
    // At the compact minimum, a single timestamp row preserves the chart and full quote on dense screens.
    @Test
    @Config(qualifiers = "xxhdpi")
    public void compactMinimumKeepsChartPriceDateAndTimeVisible() throws Exception {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.US);
            JSONObject state = quote("USD", 123456.00);
            View view = render(context(Locale.US, 1), state, 110, 160);
            assertFits(view.findViewById(R.id.widget_price));
            assertEquals(View.VISIBLE, view.findViewById(R.id.widget_chart).getVisibility());
            TextView timestamp = view.findViewById(R.id.widget_updated_at);
            assertFits(timestamp);
            Date updated = new Date(state.getLong("updatedAt"));
            assertTrue(timestamp.getText().toString().contains(DateFormat.getDateInstance(DateFormat.SHORT).format(updated)));
            assertTrue(timestamp.getText().toString().contains(DateFormat.getTimeInstance(DateFormat.SHORT).format(updated)));
            assertEquals(1, timestamp.getLayout().getLineCount());
        } finally {
            Locale.setDefault(original);
        }
    }

    // When one timestamp row is too wide, date and time remain readable on separate rows.
    @Test
    public void timestampUsesTwoRowsWhenNeeded() throws Exception {
        Locale original = Locale.getDefault();
        try {
            Locale.setDefault(Locale.US);
            View view = render(context(Locale.US, 1.3f), quote("USD", 100.00), 110, 160);
            assertFits(view.findViewById(R.id.widget_price));
            assertFits(view.findViewById(R.id.widget_updated_at));
            assertFits(view.findViewById(R.id.widget_updated_time));
        } finally {
            Locale.setDefault(original);
        }
    }

    // Wide widgets retain full quotes, dates and percentage changes across locales and accessibility sizes.
    @Test
    public void fullPricesAndCurrenciesFitAtSupportedWidthsAndFontScales() throws Exception {
        Locale original = Locale.getDefault();
        try {
            for (Locale locale : new Locale[]{Locale.US, Locale.GERMANY, Locale.FRANCE, Locale.forLanguageTag("ar")}) {
                Locale.setDefault(locale);
                for (float fontScale : new float[]{1, 1.3f, 2}) {
                    Context context = context(locale, fontScale);
                    for (int width : new int[]{250, 280, 320, 400}) {
                        for (String currency : new String[]{"USD", "CZK", "VND"}) {
                            JSONObject state = quote(currency, currency.equals("VND") ? 3123456789.12 : 123456.00);
                            View view = render(context, state, width);
                            TextView pair = view.findViewById(R.id.widget_pair);
                            assertNotNull(locale + " scale=" + fontScale + " width=" + width + " currency=" + currency, pair);
                            assertEquals("BTC/" + currency, pair.getText().toString());
                            assertFits(pair);
                            assertFits(view.findViewById(R.id.widget_price));
                            assertFits(view.findViewById(R.id.widget_updated_at));
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

    // Compact widgets keep full prices and dates; long prices and large fonts can require more room.
    @Test
    public void compactWidgetsKeepFullPricesAndDatesReadable() throws Exception {
        Locale original = Locale.getDefault();
        try {
            for (Locale locale : new Locale[]{Locale.US, Locale.GERMANY, Locale.FRANCE, Locale.forLanguageTag("ar")}) {
                Locale.setDefault(locale);
                for (float fontScale : new float[]{1, 1.3f, 2}) {
                    Context context = context(locale, fontScale);
                    for (String currency : new String[]{"USD", "VND"}) {
                        int width = currency.equals("USD") ? (fontScale == 1 ? 110 : fontScale == 1.3f ? 140 : 220)
                                : (fontScale == 1 ? 180 : fontScale == 1.3f ? 220 : 320);
                        double price = currency.equals("USD") ? 123456.00 : 3123456789.12;
                        JSONObject state = quote(currency, price);
                        View view = render(context, state, width, fontScale == 2 ? 220 : 160);
                        String scenario = locale + " scale=" + fontScale + " width=" + width + " currency=" + currency;
                        TextView value = view.findViewById(R.id.widget_price);
                        assertNotNull(scenario, value);
                        NumberFormat format = NumberFormat.getNumberInstance();
                        format.setMinimumFractionDigits(2);
                        format.setMaximumFractionDigits(2);
                        assertEquals(scenario, format.format(price), value.getText().toString());
                        assertFits(value);
                        TextView pair = view.findViewById(R.id.widget_pair);
                        assertEquals("BTC/" + currency, pair.getText().toString());
                        assertFits(pair);
                        TextView date = view.findViewById(R.id.widget_updated_at);
                        assertTrue(scenario, date.getText().toString().contains(
                                DateFormat.getDateInstance(DateFormat.SHORT).format(new Date(state.getLong("updatedAt")))));
                        assertFits(date);
                        TextView time = view.findViewById(R.id.widget_updated_time);
                        if (time.getVisibility() == View.VISIBLE) {
                            assertFits(time);
                        }
                        assertEquals(View.VISIBLE, view.findViewById(R.id.widget_previous).getVisibility());
                        assertEquals(View.VISIBLE, view.findViewById(R.id.widget_next).getVisibility());
                    }
                }
            }
        } finally {
            Locale.setDefault(original);
        }
    }

    // A very short widget cannot fit tall Arabic glyphs at double font scale even without optional rows.
    @Test
    public void increasingHeightRestoresPriceAndDateForLargeArabicFonts() throws Exception {
        Locale original = Locale.getDefault();
        try {
            Locale locale = Locale.forLanguageTag("ar");
            Locale.setDefault(locale);
            Context context = context(locale, 2);
            JSONObject state = quote("USD", 123456.00);
            View small = render(context, state, 220, 110);
            assertTrue(small.findViewById(R.id.widget_root) instanceof TextView);
            View taller = render(context, state, 220, 220);
            assertFits(taller.findViewById(R.id.widget_price));
            assertFits(taller.findViewById(R.id.widget_updated_at));
        } finally {
            Locale.setDefault(original);
        }
    }

    // An unusually wide percentage is optional and must not replace a readable price/date with a resize prompt.
    @Test
    public void oversizedPercentageDoesNotPreventShowingThePriceAndDate() throws Exception {
        JSONObject state = quote("USD", 123456.00).put("change24h", 12345678901234.00);
        View view = render(context(Locale.US, 1), state, 110, 160);
        assertFits(view.findViewById(R.id.widget_price));
        assertFits(view.findViewById(R.id.widget_updated_at));
        assertEquals(View.GONE, view.findViewById(R.id.widget_change).getVisibility());
        assertEquals(View.GONE, view.findViewById(R.id.widget_change_compact).getVisibility());
    }

    // Optional information must yield to the price and date before the widget asks to be resized.
    @Test
    public void compactWidgetsHideOptionalRowsBeforeRequestingMoreRoom() throws Exception {
        View view = render(context(Locale.US, 2), quote("USD", 123456.00), 220, 160);
        assertFits(view.findViewById(R.id.widget_price));
        assertFits(view.findViewById(R.id.widget_updated_at));
        assertEquals(View.GONE, view.findViewById(R.id.widget_chart).getVisibility());
        assertEquals(View.GONE, view.findViewById(R.id.widget_change_compact).getVisibility());
        assertEquals(View.GONE, view.findViewById(R.id.widget_updated_time).getVisibility());
    }

    // A full price that cannot fit at 14sp still needs a resize prompt rather than clipping or tiny text.
    @Test
    public void smallExistingWidgetsAskForMoreRoomWithoutShrinkingBelowReadableSize() throws Exception {
        Context context = context(Locale.US, 2);
        View small = render(context, quote("USD", 1810178.95), 110);
        TextView prompt = small.findViewById(R.id.widget_root);
        assertEquals(context.getString(R.string.price_widget_resize), prompt.getText().toString());
        assertFits(prompt);
    }

    // Android 7 must still support explicit sizing without framework text autosizing.
    @Test
    @Config(sdk = 24)
    @GraphicsMode(GraphicsMode.Mode.LEGACY)
    public void androidSevenRendersWithExplicitTextSizes() throws Exception {
        View view = render(context(Locale.US, 1), quote("USD", 123456.00), 250);
        // Legacy graphics cannot measure real glyph bounds; verify both supported RemoteViews layouts.
        TextView text = view.findViewById(R.id.widget_price);
        if (text == null) {
            text = view.findViewById(R.id.widget_root);
        }
        assertEquals(View.VISIBLE, text.getVisibility());
        assertTrue(text.length() > 0);
        assertTrue(text.getTextSize() >= TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,
                11, text.getResources().getDisplayMetrics()));
    }

    // Loading and failure states remain readable without inventing a date for an unavailable quote.
    @Test
    public void loadingAndUnavailableTextFitWithLargeFonts() throws Exception {
        Context context = context(Locale.US, 2);
        for (boolean loading : new boolean[]{false, true}) {
            JSONObject state = new JSONObject("{\"coinCode\":\"btc\",\"currency\":\"USD\"}").put("loading", loading);
            View view = render(context, state, 250);
            assertFits(view.findViewById(R.id.widget_pair));
            TextView message = view.findViewById(R.id.widget_unavailable);
            assertFits(message);
            assertEquals(context.getString(loading ? R.string.price_widget_loading : R.string.price_widget_unavailable),
                    message.getText().toString());
            assertEquals(View.GONE, view.findViewById(R.id.widget_updated_at).getVisibility());
            assertEquals(View.GONE, view.findViewById(R.id.widget_updated_time).getVisibility());
        }
    }

    // Each widget adapts independently, and growing a widget restores optional content.
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
        narrow.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 80);
        narrow.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 220);
        manager.updateAppWidgetOptions(7, narrow);
        Bundle wide = new Bundle(narrow);
        wide.putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES,
                new ArrayList<>(Collections.singletonList(new SizeF(400, 220))));
        manager.updateAppWidgetOptions(8, wide);

        PriceWidgetRenderer.render(context, quote("USD", 123456.00));
        assertTrue(widgets.getViewFor(7).findViewById(R.id.widget_root) instanceof TextView);
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
                .put("updatedAt", 1791804600000L)
                .put("change24h", 2.34).put("chart", new JSONArray("[0,0.5,0.25,1]"))
                .put("coins", new JSONArray("[\"btc\",\"eth\",\"ltc\"]"));
    }

    private View render(Context context, JSONObject state, int widthDp) {
        return render(context, state, widthDp, 220);
    }

    private View render(Context context, JSONObject state, int widthDp, int heightDp) {
        View view = PriceWidgetRenderer.createViews(context, state, widthDp, heightDp).apply(context, new FrameLayout(context));
        float density = context.getResources().getDisplayMetrics().density;
        int width = (int) (widthDp * density);
        int height = (int) (heightDp * density);
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
        float minimum = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP,
                text.getId() == R.id.widget_price ? 14 : 11, text.getResources().getDisplayMetrics());
        assertTrue(message, text.getTextSize() >= minimum);
        for (int line = 0; line < text.getLayout().getLineCount(); line++) {
            assertTrue(message, text.getLayout().getLineWidth(line) <= width);
            assertEquals(message, 0, text.getLayout().getEllipsisCount(line));
        }
        assertTrue(message, text.getLayout().getHeight() <= height);
        assertEquals(message, text.length(), text.getLayout().getLineEnd(text.getLayout().getLineCount() - 1));
    }
}
