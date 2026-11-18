// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.util.SizeF;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

public class LightningWidgetProvider extends AppWidgetProvider {
    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("lightning-widget", Context.MODE_PRIVATE);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refresh(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        refresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            refresh(context);
        } else {
            super.onReceive(context, intent);
        }
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, LightningWidgetProvider.class));
        if (ids.length == 0) {
            return;
        }
        SharedPreferences preferences = preferences(context);
        String address = preferences.getString("address", null);
        Bitmap qr = decodeQRCode(preferences.getString("qr", null));
        for (int id : ids) {
            manager.updateAppWidget(id, createViews(context, address, qr, manager.getAppWidgetOptions(id)));
        }
    }

    static RemoteViews createViews(Context context, String address, Bitmap qr, Bundle options) {
        boolean available = address != null && !address.isEmpty() && qr != null;
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.lightning_widget);
        views.setViewVisibility(R.id.lightning_widget_address, available ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.lightning_widget_qr, available ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.lightning_widget_empty, available ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.lightning_widget_address, available ? address : "");
        if (available) {
            views.setImageViewBitmap(R.id.lightning_widget_qr, qr);
        } else {
            views.setImageViewResource(R.id.lightning_widget_qr, 0);
        }
        views.setOnClickPendingIntent(R.id.lightning_widget_root, openAppIntent(context));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<SizeF> sizes = options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> sized = new LinkedHashMap<>();
                for (SizeF size : sizes) {
                    sized.put(size, sizedViews(context, views, size.getWidth(), size.getHeight()));
                }
                return new RemoteViews(sized);
            }
        }
        int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 160);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 200);
        int maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidth);
        int maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeight);
        RemoteViews portrait = sizedViews(context, views, minWidth, maxHeight);
        if (minWidth == maxWidth && minHeight == maxHeight) {
            return portrait;
        }
        return new RemoteViews(sizedViews(context, views, maxWidth, minHeight), portrait);
    }

    @SuppressWarnings("deprecation") // The copy constructor requires Android 9.
    private static RemoteViews sizedViews(Context context, RemoteViews base, float widthDp, float heightDp) {
        // Share the QR bitmap across sizes to keep updates within the binder limit.
        RemoteViews views = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? new RemoteViews(base) : base.clone();
        View layout = views.apply(context, new FrameLayout(context));
        TextView address = layout.findViewById(R.id.lightning_widget_address);
        if (address.getVisibility() != View.VISIBLE) {
            return views;
        }
        float density = context.getResources().getDisplayMetrics().density;
        int width = Math.max(1, Math.round(widthDp * density));
        int height = Math.max(1, Math.round(heightDp * density));
        if (!fits(layout, width, height, density)) {
            // Decorative branding gives up space before the address or QR does.
            layout.findViewById(R.id.lightning_widget_logo).setVisibility(View.GONE);
            views.setViewVisibility(R.id.lightning_widget_logo, View.GONE);
            if (!fits(layout, width, height, density)) {
                views = new RemoteViews(context.getPackageName(), R.layout.lightning_widget_resize);
                views.setOnClickPendingIntent(R.id.lightning_widget_root, openAppIntent(context));
            }
        }
        return views;
    }

    private static boolean fits(View view, int width, int height, float density) {
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
        view.layout(0, 0, width, height);
        TextView address = view.findViewById(R.id.lightning_widget_address);
        android.text.Layout text = address.getLayout();
        int lines = text.getLineCount();
        int textWidth = address.getWidth() - address.getCompoundPaddingLeft() - address.getCompoundPaddingRight();
        int textHeight = address.getHeight() - address.getCompoundPaddingTop() - address.getCompoundPaddingBottom();
        if (lines == 0 || text.getLineEnd(lines - 1) != address.length() || text.getHeight() > textHeight) {
            return false;
        }
        for (int line = 0; line < lines; line++) {
            if (text.getEllipsisCount(line) != 0 || Math.ceil(text.getLineWidth(line)) > textWidth) {
                return false;
            }
        }
        View qr = view.findViewById(R.id.lightning_widget_qr);
        // Reserve an 80dp square; text wrapping must not squeeze the QR down to a sliver.
        return Math.min(qr.getWidth(), qr.getHeight()) >= Math.ceil(80 * density);
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent launch = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        return PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Bitmap decodeQRCode(String data) {
        String prefix = "data:image/png;base64,";
        if (data == null || !data.startsWith(prefix)) {
            return null;
        }
        try {
            byte[] png = Base64.decode(data.substring(prefix.length()), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(png, 0, png.length);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
