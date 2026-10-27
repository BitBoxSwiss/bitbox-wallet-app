// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.Application;
import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver.PendingResult;
import android.content.Context;
import android.content.Intent;

import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;
import androidx.work.Configuration;
import androidx.work.Operation;
import androidx.work.impl.WorkManagerImpl;
import androidx.work.testing.SynchronousExecutor;
import androidx.work.testing.WorkManagerTestInitHelper;

import com.google.common.util.concurrent.ForwardingListenableFuture;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.SettableFuture;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.util.ReflectionHelpers;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = Application.class, shadows = PriceWidgetCleanupTest.ShadowWorkManager.class)
public class PriceWidgetCleanupTest {
    private Context context;
    private Future<PendingResult> finished;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        WorkManagerTestInitHelper.initializeTestWorkManager(context, new Configuration.Builder()
                .setExecutor(new SynchronousExecutor()).build());
        ShadowWorkManager.periodic = new PendingCancellation();
        ShadowWorkManager.refresh = new PendingCancellation();
        context.getSharedPreferences("price-widget", Context.MODE_PRIVATE).edit()
                .putString("publishedState", "saved").commit();
    }

    @After
    public void tearDown() throws Exception {
        ShadowWorkManager.periodic.result.set(Operation.SUCCESS);
        ShadowWorkManager.refresh.result.set(Operation.SUCCESS);
        if (finished != null) {
            finished.get(5, TimeUnit.SECONDS);
        }
    }

    // Removing the last widget must keep the broadcast alive until both cancellations and cleanup finish.
    @Test
    public void waitsForBothCancellationsBeforeFinishingBroadcast() throws Exception {
        disableWidget();
        assertTrue(ShadowWorkManager.periodic.awaiting.await(5, TimeUnit.SECONDS));
        assertFalse(finished.isDone());

        ShadowWorkManager.periodic.result.set(Operation.SUCCESS);
        assertTrue(ShadowWorkManager.refresh.awaiting.await(5, TimeUnit.SECONDS));
        assertFalse(finished.isDone());
        assertTrue(context.getSharedPreferences("price-widget", Context.MODE_PRIVATE).contains("publishedState"));

        ShadowWorkManager.refresh.result.set(Operation.SUCCESS);
        finished.get(5, TimeUnit.SECONDS);
        assertFalse(context.getSharedPreferences("price-widget", Context.MODE_PRIVATE).contains("publishedState"));
    }

    // A failed periodic cancellation must still clear the saved display and release the pending broadcast.
    @Test
    public void clearsStateAndFinishesBroadcastWhenPeriodicCancellationFails() throws Exception {
        disableWidget();
        assertTrue(ShadowWorkManager.periodic.awaiting.await(5, TimeUnit.SECONDS));
        ShadowWorkManager.periodic.result.setException(new IllegalStateException("failed"));
        finished.get(5, TimeUnit.SECONDS);
        assertFalse(context.getSharedPreferences("price-widget", Context.MODE_PRIVATE).contains("publishedState"));
    }

    // A failed refresh cancellation must not skip display cleanup after periodic cancellation succeeds.
    @Test
    public void clearsStateAndFinishesBroadcastWhenRefreshCancellationFails() throws Exception {
        disableWidget();
        ShadowWorkManager.periodic.result.set(Operation.SUCCESS);
        assertTrue(ShadowWorkManager.refresh.awaiting.await(5, TimeUnit.SECONDS));
        ShadowWorkManager.refresh.result.setException(new IllegalStateException("failed"));
        finished.get(5, TimeUnit.SECONDS);
        assertFalse(context.getSharedPreferences("price-widget", Context.MODE_PRIVATE).contains("publishedState"));
    }

    private void disableWidget() {
        HelloWidgetProvider provider = new HelloWidgetProvider();
        PendingResult pending = Shadow.newInstanceOf(PendingResult.class);
        ReflectionHelpers.setField(provider, "mPendingResult", pending);
        finished = shadowOf(pending).getFuture();
        provider.onReceive(context, new Intent(AppWidgetManager.ACTION_APPWIDGET_DISABLED));
        assertTrue(shadowOf(provider).wentAsync());
    }

    private static class PendingCancellation implements Operation {
        final CountDownLatch awaiting = new CountDownLatch(1);
        final SettableFuture<Operation.State.SUCCESS> result = SettableFuture.create();

        @Override
        public LiveData<Operation.State> getState() {
            return new MutableLiveData<>(Operation.IN_PROGRESS);
        }

        @Override
        public ListenableFuture<Operation.State.SUCCESS> getResult() {
            return new ForwardingListenableFuture.SimpleForwardingListenableFuture<Operation.State.SUCCESS>(result) {
                @Override
                public Operation.State.SUCCESS get() throws InterruptedException, ExecutionException {
                    awaiting.countDown();
                    return super.get();
                }
            };
        }
    }

    @Implements(value = WorkManagerImpl.class, isInAndroidSdk = false)
    public static class ShadowWorkManager {
        static PendingCancellation periodic;
        static PendingCancellation refresh;

        @Implementation
        protected Operation cancelUniqueWork(String name) {
            if (PriceWidgetProvider.PERIODIC_WORK.equals(name)) {
                return periodic;
            }
            if (PriceWidgetProvider.REFRESH_WORK.equals(name)) {
                return refresh;
            }
            throw new AssertionError("Unexpected work: " + name);
        }
    }
}
