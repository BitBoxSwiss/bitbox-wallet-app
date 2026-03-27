// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { RBF_PENDING_THRESHOLD_MS, shouldShowSpeedUpPopup } from './speed-up';

const now = Date.parse('2026-02-09T15:00:00Z');
const overOneHourAgo = new Date(now - RBF_PENDING_THRESHOLD_MS - 1).toISOString();
const exactlyOneHourAgo = new Date(now - RBF_PENDING_THRESHOLD_MS).toISOString();
const underOneHourAgo = new Date(now - RBF_PENDING_THRESHOLD_MS + 1).toISOString();

describe('components/transactions/speed-up', () => {
  it('shows popup for pending outgoing btc tx older than one hour', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'btc',
      numConfirmations: 0,
      status: 'pending',
      time: overOneHourAgo,
      type: 'send',
      now,
    })).toBe(true);
  });

  it('shows popup when pending duration is exactly one hour', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'tbtc',
      numConfirmations: 0,
      status: 'pending',
      time: exactlyOneHourAgo,
      type: 'send_to_self',
      now,
    })).toBe(true);
  });

  it('does not show popup before one hour', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'rbtc',
      numConfirmations: 0,
      status: 'pending',
      time: underOneHourAgo,
      type: 'send',
      now,
    })).toBe(false);
  });

  it('does not show popup for non-btc coins', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'ltc',
      numConfirmations: 0,
      status: 'pending',
      time: overOneHourAgo,
      type: 'send',
      now,
    })).toBe(false);
  });

  it('does not show popup for confirmed transactions', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'btc',
      numConfirmations: 1,
      status: 'complete',
      time: overOneHourAgo,
      type: 'send',
      now,
    })).toBe(false);
  });

  it('does not show popup when timestamp is missing or invalid', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'btc',
      numConfirmations: 0,
      status: 'pending',
      time: null,
      type: 'send',
      now,
    })).toBe(false);

    expect(shouldShowSpeedUpPopup({
      coinCode: 'btc',
      numConfirmations: 0,
      status: 'pending',
      time: 'not-a-date',
      type: 'send',
      now,
    })).toBe(false);
  });

  it('shows popup immediately in testnet mode', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'tbtc',
      isTesting: true,
      numConfirmations: 0,
      status: 'pending',
      time: underOneHourAgo,
      type: 'send',
      now,
    })).toBe(true);
  });

  it('shows popup in testnet mode even when timestamp is missing', () => {
    expect(shouldShowSpeedUpPopup({
      coinCode: 'tbtc',
      isTesting: true,
      numConfirmations: 0,
      status: 'pending',
      time: null,
      type: 'send_to_self',
      now,
    })).toBe(true);
  });
});
