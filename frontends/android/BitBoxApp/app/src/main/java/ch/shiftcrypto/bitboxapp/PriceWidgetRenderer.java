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
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.Locale;

final class PriceWidgetRenderer {
    static void render(Context context, JSONObject state) {
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
            views.setTextViewTextSize(R.id.widget_price, TypedValue.COMPLEX_UNIT_SP, price.length() > 10 ? 24 : 30);
        }
        double change = state.optDouble("change24h", 0);
        int color = ContextCompat.getColor(context, !available || change == 0 ? R.color.widget_secondary
                : change > 0 ? R.color.widget_positive : R.color.widget_negative);
        views.setTextColor(R.id.widget_change, color);
        String changeText = context.getString(R.string.price_widget_empty);
        if (available) {
            changeText = context.getString(R.string.price_widget_change, (change > 0 ? "+" : "") + format.format(change));
        }
        views.setTextViewText(R.id.widget_change, changeText);

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
        AppWidgetManager.getInstance(context).updateAppWidget(PriceWidgetProvider.widgetIds(context), views);
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
