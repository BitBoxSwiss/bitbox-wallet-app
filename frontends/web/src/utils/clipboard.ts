// SPDX-License-Identifier: Apache-2.0

import { runningInQtWebEngine } from './env';

export const canReadClipboard = () => (
  !runningInQtWebEngine() && typeof navigator.clipboard?.readText === 'function'
);
