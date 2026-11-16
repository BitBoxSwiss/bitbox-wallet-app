// SPDX-License-Identifier: Apache-2.0

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import QrScanner from 'qr-scanner';
import { TQRCommand } from '@/utils/native-qr';
import { ScanQR } from './scan-qr';

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});
vi.mock('@/hooks/backbutton', () => ({ useBackButton: vi.fn() }));
vi.mock('@/utils/transport-mobile', () => ({ triggerHapticFeedback: vi.fn(), triggerLongHapticFeedback: vi.fn() }));
vi.mock('qr-scanner', () => ({
  default: vi.fn(function() {
    return { start: vi.fn(), hasFlash: vi.fn(), pause: vi.fn(), stop: vi.fn(), destroy: vi.fn() };
  }),
}));

describe('ScanQR', () => {
  const postMessage = vi.fn<(command: TQRCommand) => void>();
  let frames: FrameRequestCallback[];
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    frames = [];
    window.nativeQRScanner = { postMessage };
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 800));
  });
  afterEach(() => {
    delete window.nativeQRScanner;
    delete window.onNativeQRScannerEvent;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('preserves rejected-input retry and stops immediately when closed', async () => {
    const onResult = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(
      <div id="root">
        <p>Send Lightning</p>
        <ScanQR instruction="Scan" onResult={onResult} onClose={onClose}>
          {(requestClose, resetLastResult) => (
            <>
              <button onClick={() => requestClose()}>Cancel scan</button>
              <button onClick={resetLastResult}>Retry</button>
            </>
          )}
        </ScanQR>
      </div>
    );
    act(() => frames.shift()!(0));
    const root = document.getElementById('root')!;
    expect(root.contains(screen.getByText('Send Lightning'))).toBe(true);
    expect(root.contains(screen.getByRole('button', { name: 'Cancel scan' }))).toBe(false);
    expect(QrScanner).not.toHaveBeenCalled();
    const sessionId = postMessage.mock.calls[0]![0].sessionId;
    const event = { sessionId, type: 'result' as const, text: ' invoice ' };
    await act(async () => window.onNativeQRScannerEvent!(event));
    await act(async () => window.onNativeQRScannerEvent!(event));
    expect(onResult).toHaveBeenCalledExactlyOnceWith('invoice');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => window.onNativeQRScannerEvent!(event));
    expect(onResult).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' }));
    expect(postMessage).toHaveBeenLastCalledWith({ action: 'stop', sessionId });
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses the browser scanner when no native bridge is available', async () => {
    delete window.nativeQRScanner;
    render(<ScanQR instruction="Scan" onResult={vi.fn()} onClose={vi.fn()} />);
    expect(QrScanner).toHaveBeenCalledExactlyOnceWith(expect.any(HTMLVideoElement), expect.any(Function), expect.any(Object));
    expect(postMessage).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(300));
  });

  it('closes and retries during cleanup when the initial stop post fails', () => {
    const error = new Error('Bridge unavailable');
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = vi.fn();
    render(
      <div id="root" style={{ opacity: 0.8 }}>
        <ScanQR instruction="Scan" onResult={vi.fn()} onClose={onClose}>
          {requestClose => <button onClick={() => requestClose()}>Cancel scan</button>}
        </ScanQR>
      </div>
    );
    act(() => frames.shift()!(0));
    const root = document.getElementById('root')!;
    const sessionId = postMessage.mock.calls[0]![0].sessionId;
    postMessage.mockClear();
    postMessage.mockImplementationOnce(() => {
      throw error;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel scan' }));
    expect(logError).toHaveBeenCalledWith(error);
    expect(postMessage.mock.calls).toEqual([
      [{ action: 'stop', sessionId }],
      [{ action: 'stop', sessionId }],
    ]);
    expect(document.documentElement.dataset.nativeQr).toBeUndefined();
    expect(root.style.opacity).toBe('0.8');
    expect(root.inert).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
