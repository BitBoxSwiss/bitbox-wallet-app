// SPDX-License-Identifier: Apache-2.0

package ch.shiftcrypto.bitboxapp;

import static org.junit.Assert.assertTrue;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.Implementation;
import org.robolectric.annotation.Implements;
import org.robolectric.shadows.ShadowApplication;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = BitBoxApplicationTest.TestApplication.class,
        shadows = BitBoxApplicationTest.ShadowBitBoxApplication.class,
        instrumentedPackages = {"ch.shiftcrypto.bitboxapp"})
public class BitBoxApplicationTest {
    @Test
    public void initializesSignalHandlerBeforeOnCreateWithoutAnActivity() {
        assertTrue(TestApplication.initializedBeforeOnCreate);
    }

    public static class TestApplication extends BitBoxApplication {
        static boolean initializedBeforeOnCreate;

        @Override
        public void onCreate() {
            initializedBeforeOnCreate = ShadowBitBoxApplication.initialized;
            super.onCreate();
        }
    }

    @Implements(value = BitBoxApplication.class, isInAndroidSdk = false)
    public static class ShadowBitBoxApplication extends ShadowApplication {
        private static boolean initialized;

        @Implementation
        protected static void __staticInitializer__() { }

        @Implementation
        protected static void initSignalHandler() {
            initialized = true;
        }

    }
}
