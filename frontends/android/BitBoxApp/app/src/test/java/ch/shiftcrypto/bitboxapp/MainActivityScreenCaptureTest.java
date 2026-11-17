// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.app.Application;
import android.view.WindowManager;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(application = Application.class)
public class MainActivityScreenCaptureTest {
    // The oldest supported API and the last API without Recents control must stay secure
    // through auth changes and must never call the unavailable Android 13 API.
    @Test
    @Config(sdk = {24, 32})
    public void olderAndroidKeepsSecureFlagWhenAuthIsDisabled() {
        TestActivity activity = Robolectric.buildActivity(TestActivity.class).get();

        activity.updateScreenCaptureProtection(false);
        assertTrue(isSecure(activity));
        activity.updateScreenCaptureProtection(true);
        assertTrue(isSecure(activity));
        activity.updateScreenCaptureProtection(false);
        assertTrue(isSecure(activity));
        assertEquals(0, activity.recentsScreenshotCalls);
    }

    // On Android 13 and later, capture protection follows auth changes without updating
    // the independent Recents policy established in onCreate.
    @Test
    @Config(sdk = {33, 35})
    public void newerAndroidUpdatesSecureFlagWithoutChangingRecents() {
        TestActivity activity = Robolectric.buildActivity(TestActivity.class).get();

        activity.updateScreenCaptureProtection(false);
        assertFalse(isSecure(activity));
        activity.updateScreenCaptureProtection(true);
        assertTrue(isSecure(activity));
        activity.updateScreenCaptureProtection(false);
        assertFalse(isSecure(activity));
        assertEquals(0, activity.recentsScreenshotCalls);
    }

    private static boolean isSecure(MainActivity activity) {
        return (activity.getWindow().getAttributes().flags
                & WindowManager.LayoutParams.FLAG_SECURE) != 0;
    }

    public static class TestActivity extends MainActivity {
        int recentsScreenshotCalls;

        @Override
        public void setRecentsScreenshotEnabled(boolean enabled) {
            recentsScreenshotCalls++;
        }
    }
}
