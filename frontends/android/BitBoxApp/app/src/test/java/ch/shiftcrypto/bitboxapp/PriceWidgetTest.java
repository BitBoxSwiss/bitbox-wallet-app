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
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
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
import org.robolectric.shadows.ShadowNetworkCapabilities;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.util.ReflectionHelpers;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import mobileserver.PriceWidgetRequest;
import org.xmlpull.v1.XmlPullParser;

import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, application = Application.class, shadows = {PriceWidgetTest.ShadowMobileserver.class, PriceWidgetTest.ShadowRequest.class},
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
        ShadowMobileserver.coins = new String[]{"btc", "eth", "ltc"};
        ShadowMobileserver.price = null;
        ShadowRequest.calls.set(0);
        ShadowRequest.cancellations.set(0);
        ShadowRequest.entered = null;
        ShadowRequest.release = null;
        ShadowRequest.forced = false;
    }

    @Test
    public void periodicUpdateRemovesNetworkConstraintFromExistingWork() throws Exception {
        PeriodicWorkRequest old = new PeriodicWorkRequest.Builder(PriceWidgetWorker.class, 15, TimeUnit.MINUTES)
                .setInitialDelay(15, TimeUnit.MINUTES)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
        workManager.enqueueUniquePeriodicWork(PriceWidgetProvider.PERIODIC_WORK,
                ExistingPeriodicWorkPolicy.KEEP, old).getResult().get();

        PriceWidgetProvider.refresh(context, false).get();

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

    @Test
    public void nonForcedReplacementRetainsPendingForcedRefresh() throws Exception {
        ShadowMobileserver.price = 100.0;
        PriceWidgetProvider.refresh(context, true).get();
        PriceWidgetProvider.refresh(context, false).get();
        assertTrue(PriceWidgetProvider.prepareFetch(context).get().refreshToken > 0);
        assertEquals(ListenableWorker.Result.success(), fetchWorker().doWork());
        assertTrue(ShadowRequest.forced);
        assertEquals(200.0, ShadowMobileserver.price, 0);
        assertEquals(0, PriceWidgetProvider.prepareFetch(context).get().refreshToken);
        assertEquals("200.00", ((TextView) widgets.getViewFor(WIDGET_ID).findViewById(R.id.widget_price)).getText().toString());
    }

    @Test
    public void canceledFetchCompletionPublishesCurrentSelectionAndPreservesNewerRequest() throws Exception {
        ShadowMobileserver.price = 100.0;
        PriceWidgetProvider.refresh(context, true).get();
        ShadowRequest.entered = new CountDownLatch(1);
        ShadowRequest.release = new CountDownLatch(1);
        PriceWidgetWorker worker = fetchWorker();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<ListenableWorker.Result> result = executor.submit(worker::doWork);
            assertTrue(ShadowRequest.entered.await(5, TimeUnit.SECONDS));
            ReflectionHelpers.callInstanceMethod(worker, "stop",
                    ReflectionHelpers.ClassParameter.from(int.class, WorkInfo.STOP_REASON_CANCELLED_BY_APP));
            assertTrue(ShadowRequest.cancellations.get() > 0);
            // A non-forced replacement must not consume the old token, even with a warm cache.
            PriceWidgetProvider.refresh(context, false).get();
            new HelloWidgetProvider().onReceive(context, new Intent(PriceWidgetProvider.NEXT));
            PriceWidgetProvider.refresh(context, true).get();
            long newerToken = PriceWidgetProvider.prepareFetch(context).get().refreshToken;
            // Model a response that reached the cache just as cancellation was delivered.
            ShadowRequest.release.countDown();
            result.get(5, TimeUnit.SECONDS);
            assertEquals(newerToken, PriceWidgetProvider.prepareFetch(context).get().refreshToken);
            View view = widgets.getViewFor(WIDGET_ID);
            assertEquals("ETH/USD", ((TextView) view.findViewById(R.id.widget_pair)).getText().toString());
            assertEquals("200.00", ((TextView) view.findViewById(R.id.widget_price)).getText().toString());
            ShadowRequest.entered = null;
            ShadowRequest.release = null;
            fetchWorker().doWork();
            assertEquals(0, PriceWidgetProvider.prepareFetch(context).get().refreshToken);
        } finally {
            ShadowRequest.release = null;
            executor.shutdownNow();
        }
    }

    @Test
    public void oldCoinCompletionDoesNotFulfillCurrentCoinRefresh() throws Exception {
        ShadowMobileserver.price = 100.0;
        PriceWidgetProvider.refresh(context, true).get();
        PriceWidgetProvider.FetchRequest request = PriceWidgetProvider.prepareFetch(context).get();
        JSONObject oldState = ShadowMobileserver.state(request.index).put("refreshed", true);
        new HelloWidgetProvider().onReceive(context, new Intent(PriceWidgetProvider.NEXT));
        PriceWidgetProvider.completeFetch(context, request, oldState).get();
        assertEquals(request.refreshToken, PriceWidgetProvider.prepareFetch(context).get().refreshToken);
        fetchWorker().doWork();
        assertTrue(ShadowRequest.forced);
        assertEquals(0, PriceWidgetProvider.prepareFetch(context).get().refreshToken);
    }

    @Test
    public void periodicTickWithWarmCacheForcesFetchWithoutClearingPublishedQuote() throws Exception {
        ShadowMobileserver.price = 100.0;
        PriceWidgetProvider.refresh(context, false).get();
        int reads = ShadowMobileserver.cacheReads;
        ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
        NetworkCapabilities capabilities = ShadowNetworkCapabilities.newInstance();
        shadowOf(capabilities).addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        shadowOf(connectivity).setNetworkCapabilities(connectivity.getActiveNetwork(), capabilities);
        PriceWidgetUpdateWorker worker = TestWorkerBuilder.from(context, PriceWidgetUpdateWorker.class,
                new SynchronousExecutor()).build();
        assertEquals(ListenableWorker.Result.success(), worker.doWork());
        assertEquals(reads, ShadowMobileserver.cacheReads);
        assertEquals("100.00", ((TextView) widgets.getViewFor(WIDGET_ID).findViewById(R.id.widget_price)).getText().toString());
        fetchWorker().doWork();
        assertTrue(ShadowRequest.forced);
        assertEquals(200.0, ShadowMobileserver.price, 0);
    }

    @Test
    public void navigationPersistsNormalizedIndexBeforeAccountsChange() throws Exception {
        HelloWidgetProvider provider = new HelloWidgetProvider();
        for (int i = 0; i < 3; i++) {
            provider.onReceive(context, new Intent(PriceWidgetProvider.NEXT));
        }
        assertEquals(0, PriceWidgetProvider.prepareFetch(context).get().index);
        ShadowMobileserver.coins = new String[]{"btc", "eth"};
        PriceWidgetProvider.refresh(context, false).get();
        assertEquals("BTC/USD", ((TextView) widgets.getViewFor(WIDGET_ID).findViewById(R.id.widget_pair)).getText().toString());
    }

    private PriceWidgetWorker fetchWorker() {
        return TestWorkerBuilder.from(context, PriceWidgetWorker.class, new SynchronousExecutor()).build();
    }

    @Implements(className = "mobileserver.PriceWidgetRequest", isInAndroidSdk = false)
    public static class ShadowRequest {
        static final AtomicInteger calls = new AtomicInteger();
        static final AtomicInteger cancellations = new AtomicInteger();
        static volatile CountDownLatch entered;
        static volatile CountDownLatch release;
        static volatile boolean forced;

        @Implementation
        protected static void __staticInitializer__() { }

        @Implementation
        protected void __constructor__() { }

        @Implementation
        protected void cancel() {
            cancellations.incrementAndGet();
        }

        @Implementation
        protected String state(String dataDir, long index, boolean force) throws Exception {
            calls.incrementAndGet();
            forced = force;
            if (entered != null) {
                entered.countDown();
                assertTrue(release.await(5, TimeUnit.SECONDS));
            }
            boolean refreshed = force || ShadowMobileserver.price == null;
            if (refreshed) {
                ShadowMobileserver.price = 200.0;
            }
            return ShadowMobileserver.state(index).put("refreshed", refreshed).toString();
        }
    }

    @Implements(className = "mobileserver.Mobileserver", isInAndroidSdk = false)
    public static class ShadowMobileserver {
        static volatile int cacheReads;
        static volatile Double price;
        static volatile String[] coins;

        @Implementation
        protected static void __staticInitializer__() { }

        @Implementation
        protected static PriceWidgetRequest newPriceWidgetRequest() {
            return Shadow.newInstanceOf(PriceWidgetRequest.class);
        }

        static JSONObject state(long index) throws Exception {
            int selected = (int) Math.floorMod(index, coins.length);
            return new JSONObject().put("selectedIndex", selected).put("coinCode", coins[selected])
                    .put("currency", "USD").put("price", price == null ? JSONObject.NULL : price)
                    .put("updatedAt", 1791804600000L).put("chart", new org.json.JSONArray(price == null ? "[]" : "[0,1]"))
                    .put("coins", new org.json.JSONArray(coins));
        }

        @Implementation
        protected static String priceWidgetState(String dataDir, long index, boolean fetch, boolean force) throws Exception {
            assertFalse("Offline display updates must not fetch", fetch);
            cacheReads++;
            return state(index).toString();
        }
    }
}
