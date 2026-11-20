// SPDX-License-Identifier: Apache-2.0

import { runningInIOS } from '@/utils/env';

type THapticFeedbackStyle = 'medium' | 'heavy';

const triggerHapticFeedbackWithStyle = (style: THapticFeedbackStyle) => {
  if (runningInIOS() && window.webkit?.messageHandlers.hapticFeedback) {
    window.webkit.messageHandlers.hapticFeedback.postMessage({ style });
  }
};

/**
 * triggers haptic feedback on iOS devices.
 * noop on other platforms.
 */
export const triggerHapticFeedback = () => triggerHapticFeedbackWithStyle('medium');

export const triggerLongHapticFeedback = () => {
  if (!runningInIOS() || !window.webkit?.messageHandlers.hapticFeedback) {
    return;
  }
  const PULSES = 3;
  const GAP_MS = 80;
  for (let i = 0; i < PULSES; i++) {
    setTimeout(triggerHapticFeedback, i * GAP_MS);
  }
};

/**
 * triggers stronger haptic feedback on iOS devices.
 * noop on other platforms.
 */
export const triggerStrongHapticFeedback = () => triggerHapticFeedbackWithStyle('heavy');
