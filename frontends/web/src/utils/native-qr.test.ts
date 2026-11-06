// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startNativeQR, TQRCommand, TQRGeometry } from './native-qr';

const geometry: TQRGeometry = {
  preview: { x: 0, y: 0, width: 1, height: 1 },
  guide: { x: 0.1, y: 0.2, width: 0.8, height: 0.4 },
  radius: 0,
};
const postMessage = vi.fn<(command: TQRCommand) => void>();

describe('native QR bridge', () => {
  beforeEach(() => {
    postMessage.mockReset();
    window.nativeQRScanner = { postMessage };
  });
  afterEach(() => {
    delete window.nativeQRScanner;
    delete window.onNativeQRScannerEvent;
  });

  it('ignores delayed startup and results after cancellation', () => {
    const onEvent = vi.fn();
    const session = startNativeQR(geometry, onEvent);
    const { sessionId } = postMessage.mock.calls[0]![0];
    const callback = window.onNativeQRScannerEvent!;
    session.stop();
    session.stop();
    callback({ sessionId, type: 'result', text: 'late invoice' });
    session.send({ action: 'torch', enabled: true });
    expect(onEvent).not.toHaveBeenCalled();
    expect(postMessage.mock.calls.map(([command]) => command.action)).toEqual(['start', 'stop']);
    expect(window.onNativeQRScannerEvent).toBeUndefined();
  });

  it('keeps a replacement session isolated from old cleanup and results', () => {
    const old = startNativeQR(geometry, vi.fn());
    const oldId = postMessage.mock.calls[0]![0].sessionId;
    const onEvent = vi.fn();
    const current = startNativeQR(geometry, onEvent);
    const id = postMessage.mock.calls[1]![0].sessionId;
    old.stop();
    window.onNativeQRScannerEvent!({ sessionId: oldId, type: 'result', text: 'old' });
    const event = { sessionId: id, type: 'result' as const, text: 'lightning:invoice' };
    window.onNativeQRScannerEvent!(event);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
    current.stop();
  });

  it('cleans up the listener if posting the start command fails', () => {
    postMessage.mockImplementation(() => {
      throw new Error('bridge closed');
    });
    expect(() => startNativeQR(geometry, vi.fn())).toThrow('bridge closed');
    expect(window.onNativeQRScannerEvent).toBeUndefined();
  });

  it('preserves an active session when starting its replacement fails', () => {
    const onEvent = vi.fn();
    const session = startNativeQR(geometry, onEvent);
    const { sessionId } = postMessage.mock.calls[0]![0];
    const listener = window.onNativeQRScannerEvent;
    postMessage.mockImplementationOnce(() => {
      throw new Error('bridge closed');
    });
    expect(() => startNativeQR(geometry, vi.fn())).toThrow('bridge closed');
    expect(window.onNativeQRScannerEvent).toBe(listener);
    const event = { sessionId, type: 'result' as const, text: 'invoice' };
    window.onNativeQRScannerEvent!(event);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
    session.stop();
  });

  it('keeps a newer listener when posting the start command fails', () => {
    const listener = vi.fn();
    postMessage.mockImplementationOnce(() => {
      window.onNativeQRScannerEvent = listener;
      throw new Error('bridge closed');
    });
    expect(() => startNativeQR(geometry, vi.fn())).toThrow('bridge closed');
    expect(window.onNativeQRScannerEvent).toBe(listener);
  });

  it('retries a failed stop without accepting events or clearing a replacement listener', () => {
    const onEvent = vi.fn();
    const session = startNativeQR(geometry, onEvent);
    const { sessionId } = postMessage.mock.calls[0]![0];
    const listener = window.onNativeQRScannerEvent!;
    postMessage.mockImplementationOnce(() => {
      throw new Error('bridge closed');
    });
    expect(() => session.stop()).toThrow('bridge closed');
    expect(window.onNativeQRScannerEvent).toBeUndefined();
    listener({ sessionId, type: 'result', text: 'late invoice' });
    session.send({ action: 'torch', enabled: true });
    expect(onEvent).not.toHaveBeenCalled();

    const replacement = startNativeQR(geometry, vi.fn());
    const replacementListener = window.onNativeQRScannerEvent;
    session.stop();
    session.stop();
    expect(postMessage.mock.calls.map(([command]) => command.action)).toEqual(['start', 'stop', 'start', 'stop']);
    expect(postMessage).toHaveBeenLastCalledWith({ action: 'stop', sessionId });
    expect(window.onNativeQRScannerEvent).toBe(replacementListener);
    replacement.stop();
  });
});
