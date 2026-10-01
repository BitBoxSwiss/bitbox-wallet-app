// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

final class PriceWidgetRenderer {
    static void render(Context context, JSONObject state) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        RemoteViews base = baseViews(context, state);
        for (int id : PriceWidgetProvider.widgetIds(context)) {
            manager.updateAppWidget(id, sizedViews(context, base, manager.getAppWidgetOptions(id)));
        }
    }

    private static RemoteViews sizedViews(Context context, RemoteViews base, Bundle options) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> views = new LinkedHashMap<>();
                for (SizeF size : sizes) {
                    views.put(size, createViews(context, base, size.getWidth(), size.getHeight()));
                }
                return new RemoteViews(views);
            }
        }
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 160);
        int maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidth);
        int maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeight);
        RemoteViews portrait = createViews(context, base, minWidth, maxHeight);
        if (minWidth == maxWidth && minHeight == maxHeight) {
            return portrait;
        }
        return new RemoteViews(createViews(context, base, maxWidth, minHeight), portrait);
    }

    static RemoteViews createViews(Context context, JSONObject state, float widthDp, float heightDp) {
        return createViews(context, baseViews(context, state), widthDp, heightDp);
    }

    @SuppressWarnings("deprecation") // RemoteViews' copy constructor requires Android 9.
    private static RemoteViews createViews(Context context, RemoteViews base, float widthDp, float heightDp) {
        // Copies share the chart bitmap to keep multi-size updates within the binder limit.
        RemoteViews views = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? new RemoteViews(base) : base.clone();
        fitLayout(context, views, widthDp, heightDp);
        return views;
    }

    private static RemoteViews baseViews(Context context, JSONObject state) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.price_widget);
        String coin = state.optString("coinCode", "btc");
        String currency = state.optString("currency", "USD");
        views.setTextViewText(R.id.widget_pair, context.getString(R.string.price_widget_pair,
                coin.toUpperCase(Locale.ROOT), currency));
        views.setImageViewResource(R.id.widget_coin, coin.equals("eth") ? R.drawable.widget_eth
                : coin.equals("ltc") ? R.drawable.widget_ltc : R.drawable.widget_btc);

        NumberFormat format = NumberFormat.getNumberInstance();
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        boolean available = state.has("price") && !state.isNull("price");
        views.setViewVisibility(R.id.widget_price, available ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_unavailable, available ? View.GONE : View.VISIBLE);
        if (available) {
            String price = format.format(state.optDouble("price"));
            views.setTextViewText(R.id.widget_price, price);
        }
        double change = state.optDouble("change24h", 0);
        int color = ContextCompat.getColor(context, !available || change == 0 ? R.color.widget_secondary
                : change > 0 ? R.color.widget_positive : R.color.widget_negative);
        views.setTextColor(R.id.widget_change, color);
        views.setTextColor(R.id.widget_change_compact, color);
        String changeText = context.getString(R.string.price_widget_empty);
        if (available) {
            changeText = context.getString(R.string.price_widget_change, (change > 0 ? "+" : "") + format.format(change));
        }
        views.setTextViewText(R.id.widget_change, changeText);
        views.setTextViewText(R.id.widget_change_compact, changeText);

        JSONArray chart = state.optJSONArray("chart");
        boolean hasChart = chart != null && chart.length() >= 2;
        views.setViewVisibility(R.id.widget_chart, hasChart ? View.VISIBLE : View.INVISIBLE);
        if (hasChart) {
            views.setImageViewBitmap(R.id.widget_chart, chartBitmap(chart, color));
        }
        JSONArray coins = state.optJSONArray("coins");
        boolean showNavigation = coins != null && coins.length() > 1;
        views.setViewVisibility(R.id.widget_previous, showNavigation ? View.VISIBLE : View.INVISIBLE);
        views.setViewVisibility(R.id.widget_next, showNavigation ? View.VISIBLE : View.INVISIBLE);
        views.setOnClickPendingIntent(R.id.widget_previous, coinIntent(context, PriceWidgetProvider.PREVIOUS));
        views.setOnClickPendingIntent(R.id.widget_next, coinIntent(context, PriceWidgetProvider.NEXT));
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return views;
    }

    private static void fitLayout(Context context, RemoteViews views, float widthDp, float heightDp) {
        float density = context.getResources().getDisplayMetrics().density;
        int width = Math.max(1, (int) (widthDp * density));
        int height = Math.max(1, (int) (heightDp * density));
        View layout = views.apply(context, new FrameLayout(context));
        TextView pair = layout.findViewById(R.id.widget_pair);
        TextView inlineChange = layout.findViewById(R.id.widget_change);
        TextView compactChange = layout.findViewById(R.id.widget_change_compact);

        inlineChange.setVisibility(View.GONE);
        compactChange.setVisibility(View.VISIBLE);
        measure(layout, width, height);
        fitText(views, pair);
        fitText(views, compactChange);
        float gap = ((ViewGroup.MarginLayoutParams) inlineChange.getLayoutParams()).getMarginStart();
        boolean compact = Math.ceil(pair.getPaint().measureText(pair.getText().toString()))
                + Math.ceil(compactChange.getPaint().measureText(compactChange.getText().toString())) + gap
                > pair.getWidth() - pair.getCompoundPaddingLeft() - pair.getCompoundPaddingRight();
        inlineChange.setTextSize(TypedValue.COMPLEX_UNIT_PX, compactChange.getTextSize());
        views.setTextViewTextSize(R.id.widget_change, TypedValue.COMPLEX_UNIT_PX, compactChange.getTextSize());
        inlineChange.setVisibility(compact ? View.GONE : View.VISIBLE);
        compactChange.setVisibility(compact ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.widget_change, inlineChange.getVisibility());
        views.setViewVisibility(R.id.widget_change_compact, compactChange.getVisibility());

        measure(layout, width, height);
        TextView price = layout.findViewById(R.id.widget_price);
        fitText(views, price.getVisibility() == View.VISIBLE ? price : layout.findViewById(R.id.widget_unavailable));
    }

    private static void measure(View layout, int width, int height) {
        layout.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        layout.layout(0, 0, width, height);
    }

    // RemoteViews cannot use an AppCompat TextView; measuring here also supports Android 7.
    private static void fitText(RemoteViews views, TextView text) {
        int width = text.getWidth() - text.getCompoundPaddingLeft() - text.getCompoundPaddingRight();
        int height = text.getHeight() - text.getCompoundPaddingTop() - text.getCompoundPaddingBottom();
        float size = text.getTextSize();
        String value = text.getText().toString();
        while (true) {
            text.setTextSize(TypedValue.COMPLEX_UNIT_PX, size);
            // TextView accounts for fallback fonts and line spacing as well as glyph width.
            text.measure(View.MeasureSpec.makeMeasureSpec(text.getWidth(), View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(text.getHeight(), View.MeasureSpec.EXACTLY));
            if (size <= 1 || (Math.ceil(text.getPaint().measureText(value)) <= width
                    && text.getLayout().getHeight() <= height && text.getLayout().getLineCount() == 1)) {
                break;
            }
            size = Math.max(1, size - 0.5f);
        }
        views.setTextViewTextSize(text.getId(), TypedValue.COMPLEX_UNIT_PX, size);
    }

    private static PendingIntent coinIntent(Context context, String action) {
        Intent intent = new Intent(context, HelloWidgetProvider.class).setAction(action);
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static Bitmap chartBitmap(JSONArray points, int color) {
        // Points are normalized by the backend; only pixel coordinates are calculated here.
        Bitmap bitmap = Bitmap.createBitmap(600, 96, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(4);
        paint.setStrokeJoin(Paint.Join.ROUND);
        Path path = new Path();
        for (int i = 0; i < points.length(); i++) {
            float x = i * 600f / (points.length() - 1);
            float y = 2 + (1 - (float) points.optDouble(i, 0.5)) * 92;
            if (i == 0) {
                path.moveTo(x, y);
            } else {
                path.lineTo(x, y);
            }
        }
        canvas.drawPath(path, paint);
        return bitmap;
    }
}
