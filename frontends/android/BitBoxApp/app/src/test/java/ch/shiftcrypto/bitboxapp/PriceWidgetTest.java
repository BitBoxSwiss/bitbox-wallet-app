// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.res.XmlResourceParser;
import android.util.TypedValue;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.TextView;

import androidx.work.Configuration;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ListenableWorker;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkInfo;
import androidx.work.WorkManager;
import androidx.work.testing.SynchronousExecutor;
import androidx.work.testing.TestWorkerBuilder;
import androidx.work.testing.WorkManagerTestInitHelper;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.shadows.ShadowAppWidgetManager;
import org.xmlpull.v1.XmlPullParser;

import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, application = Application.class, shadows = PriceWidgetTest.ShadowMobileserver.class,
        instrumentedPackages = {"mobileserver"})
public class PriceWidgetTest {
    private Context context;
    private WorkManager workManager;
    private ShadowAppWidgetManager widgets;
    private static final int WIDGET_ID = 7;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        WorkManagerTestInitHelper.initializeTestWorkManager(context, new Configuration.Builder()
                .setExecutor(new SynchronousExecutor()).build());
        workManager = WorkManager.getInstance(context);
        widgets = shadowOf(AppWidgetManager.getInstance(context));
        AppWidgetProviderInfo info = new AppWidgetProviderInfo();
        info.provider = new ComponentName(context, HelloWidgetProvider.class);
        info.initialLayout = R.layout.price_widget;
        widgets.addBoundWidget(WIDGET_ID, info);
        ShadowMobileserver.cacheReads = 0;
    }

    @Test
    public void periodicUpdateRemovesNetworkConstraintFromExistingWork() throws Exception {
        PeriodicWorkRequest old = new PeriodicWorkRequest.Builder(PriceWidgetWorker.class, 15, TimeUnit.MINUTES)
                .setInitialDelay(15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        workManager.enqueueUniquePeriodicWork(PriceWidgetProvider.PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.KEEP, old).getResult().get();

        PriceWidgetProvider.schedule(context, false);

        WorkInfo periodic = workManager.getWorkInfosForUniqueWork(PriceWidgetProvider.PERIODIC_WORK).get().get(0);
        assertEquals(old.getId(), periodic.getId());
        assertEquals(NetworkType.NOT_REQUIRED, periodic.getConstraints().getRequiredNetworkType());
        assertTrue(periodic.getTags().contains(PriceWidgetUpdateWorker.class.getName()));
        WorkInfo fetch = workManager.getWorkInfosForUniqueWork(PriceWidgetProvider.REFRESH_WORK).get().get(0);
        assertEquals(NetworkType.CONNECTED, fetch.getConstraints().getRequiredNetworkType());
    }

    @Test
    public void offlineUpdateClearsExpiredPriceBeforeWaitingForNetwork() throws Exception {
        PriceWidgetRenderer.render(context, new JSONObject("{\"coinCode\":\"btc\",\"currency\":\"USD\","
                + "\"price\":120,\"change24h\":20,\"chart\":[0,1],\"coins\":[\"btc\",\"eth\",\"ltc\"]}"));
        assertEquals(View.VISIBLE, widgets.getViewFor(WIDGET_ID).findViewById(R.id.widget_price).getVisibility());

        PriceWidgetUpdateWorker worker = TestWorkerBuilder.from(context, PriceWidgetUpdateWorker.class,
                new SynchronousExecutor()).build();
        assertEquals(ListenableWorker.Result.success(), worker.doWork());

        assertEquals(1, ShadowMobileserver.cacheReads);
        View view = widgets.getViewFor(WIDGET_ID);
        assertEquals(View.GONE, view.findViewById(R.id.widget_price).getVisibility());
        assertEquals(View.VISIBLE, view.findViewById(R.id.widget_unavailable).getVisibility());
        assertEquals(View.INVISIBLE, view.findViewById(R.id.widget_chart).getVisibility());
        WorkInfo fetch = workManager.getWorkInfosForUniqueWork(PriceWidgetProvider.REFRESH_WORK).get().get(0);
        assertEquals(WorkInfo.State.ENQUEUED, fetch.getState());
        assertEquals(NetworkType.CONNECTED, fetch.getConstraints().getRequiredNetworkType());
    }

    @Test
    public void minimumSizeLeavesRoomForPriceAndUnavailableText() throws Exception {
        try (XmlResourceParser xml = context.getResources().getXml(R.xml.price_widget_info)) {
            while (xml.next() != XmlPullParser.START_TAG) { }
            String namespace = "http://schemas.android.com/apk/res/android";
            int width = dimension(xml.getAttributeValue(namespace, "minWidth"));
            int height = dimension(xml.getAttributeValue(namespace, "minHeight"));
            assertEquals(height, dimension(xml.getAttributeValue(namespace, "minResizeHeight")));
            View view = LayoutInflater.from(context).inflate(R.layout.price_widget, null);
            TextView price = view.findViewById(R.id.widget_price);
            price.setText("1,810,178.95");
            view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, width, height);
            assertTrue("Price height " + price.getHeight() + ", line height " + price.getLineHeight()
                    + ", widget height " + height, price.getHeight() >= price.getLineHeight());
            assertTrue(price.getHeight() > 0);

            price.setVisibility(View.GONE);
            TextView unavailable = view.findViewById(R.id.widget_unavailable);
            unavailable.setVisibility(View.VISIBLE);
            view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY));
            view.layout(0, 0, width, height);
            assertTrue(unavailable.getHeight() >= unavailable.getLineHeight());
        }
    }

    private int dimension(String value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP,
                Float.parseFloat(value.replace("dip", "").replace("dp", "")),
                context.getResources().getDisplayMetrics()));
    }

    @Implements(className = "mobileserver.Mobileserver", isInAndroidSdk = false)
    public static class ShadowMobileserver {
        static int cacheReads;

        @Implementation
        protected static void __staticInitializer__() { }

        @Implementation
        protected static String priceWidgetState(String dataDir, long index, boolean fetch, boolean force) {
            assertFalse("Offline display updates must not fetch", fetch);
            cacheReads++;
            return "{\"coinCode\":\"btc\",\"currency\":\"USD\",\"price\":null,\"chart\":[],\"coins\":[\"btc\",\"eth\",\"ltc\"]}";
        }
    }
}
