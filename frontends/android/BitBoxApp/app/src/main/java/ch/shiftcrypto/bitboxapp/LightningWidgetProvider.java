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
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.widget.RemoteViews;

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
        Intent launch = new Intent(context, MainActivity.class)
                .setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        views.setOnClickPendingIntent(R.id.lightning_widget_root, PendingIntent.getActivity(context, 0,
                launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        manager.updateAppWidget(ids, views);
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
