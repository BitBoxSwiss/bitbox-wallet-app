// SPDX-License-Identifier: Apache-2.0

export const debug = import.meta.env.DEV;

/**
 * Returns whether the code is running in QtWebEngine.
 */
export const runningInQtWebEngine = () => {
  return typeof window.qt !== 'undefined';
};

/**
 * Returns whether the code is running in Android.
 */
export const runningInAndroid = () => {
  return typeof window.android !== 'undefined';
};

export function runningInIOS() {
  return typeof window.runningOnIOS !== 'undefined';
}

/**
 * Returns whether the code is running on mobile.
 */
export const runningOnMobile = () => {
  return runningInAndroid() || runningInIOS();
};
