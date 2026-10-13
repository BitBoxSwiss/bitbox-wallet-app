// SPDX-License-Identifier: Apache-2.0

import { act, PointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { TQRCommand } from '@/utils/native-qr';
import { useNativeQRScanner } from './native-qr-scanner';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const postMessage = vi.fn<(command: TQRCommand) => void>();
const onResult = vi.fn();
const preview = document.createElement('div');
const guide = document.createElement('div');
const previewRef = { current: preview };
const guideRef = { current: guide };
const camera = { hasFlash: true, isFlashOn: false, zoom: 1 };
const options = { enabled: true, gesturesEnabled: true, previewRef, guideRef, onResult };

const pointer = (id: number, x: number, y: number, type = 'pointerdown') => ({
  pointerId: id, clientX: x, clientY: y, type, currentTarget: preview,
}) as PointerEvent<HTMLDivElement>;

describe('useNativeQRScanner', () => {
  beforeEach(() => {
    postMessage.mockReset();
    onResult.mockReset();
    window.nativeQRScanner = { postMessage };
    const parent = document.createElement('div');
    parent.append(preview, guide);
    preview.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
    guide.getBoundingClientRect = () => new DOMRect(40, 120, 320, 320);
    preview.setPointerCapture = vi.fn();
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });
  afterEach(() => {
    delete window.nativeQRScanner;
    delete window.onNativeQRScannerEvent;
    vi.restoreAllMocks();
  });

  it('uses rendered guide bounds and restores the app when closed during startup', () => {
    const { unmount: removeRoot } = render(<div id="root" style={{ opacity: 0.8 }} />);
    const root = document.getElementById('root')!;
    const { unmount } = renderHook(() => useNativeQRScanner(options));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ action: 'start', geometry: expect.objectContaining({
      guide: { x: 0.1, y: 0.15, width: 0.8, height: 0.4 },
    }) }));
    expect(document.documentElement.dataset.nativeQr).toBe('true');
    expect(root.style.opacity).toBe('0');
    expect(root.inert).toBe(true);
    unmount();
    expect(document.documentElement.dataset.nativeQr).toBeUndefined();
    expect(root.style.opacity).toBe('0.8');
    expect(root.inert).toBe(false);
    expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'stop' }));
    removeRoot();
  });

  it('starts only when enabled and maps permission failures to translated errors', () => {
    const { result, rerender } = renderHook(({ enabled }) => useNativeQRScanner({ ...options, enabled }), { initialProps: { enabled: false } });
    expect(postMessage).not.toHaveBeenCalled();
    rerender({ enabled: true });
    const id = postMessage.mock.calls[0]![0].sessionId;
    expect(result.current.camera).toBeUndefined();
    act(() => window.onNativeQRScannerEvent!({ sessionId: id, type: 'error', code: 'permissionDenied' }));
    expect(result.current.initErrorMessage).toBe('send.scanQRErrors.permissionDenied');
  });

  it('maps taps to preview coordinates and sends pinch zoom without focusing', () => {
    const { result } = renderHook(() => useNativeQRScanner(options));
    const id = postMessage.mock.calls[0]![0].sessionId;
    act(() => window.onNativeQRScannerEvent!({ sessionId: id, type: 'ready', camera }));
    act(() => {
      result.current.gestureHandlers.onPointerDown(pointer(1, 100, 200));
      result.current.gestureHandlers.onPointerUp(pointer(1, 100, 200, 'pointerup'));
    });
    expect(postMessage).toHaveBeenLastCalledWith({ action: 'focus', sessionId: id, x: 0.25, y: 0.25 });
    postMessage.mockClear();
    act(() => {
      result.current.gestureHandlers.onPointerDown(pointer(1, 0, 0));
      result.current.gestureHandlers.onPointerDown(pointer(2, 10, 0));
      result.current.gestureHandlers.onPointerMove(pointer(2, 100, 0, 'pointermove'));
      result.current.gestureHandlers.onPointerUp(pointer(2, 100, 0, 'pointerup'));
      result.current.gestureHandlers.onPointerUp(pointer(1, 0, 0, 'pointerup'));
    });
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ action: 'zoom', sessionId: id, zoom: 10 });
  });

  it('clears a gesture interrupted by validation', () => {
    const { result, rerender } = renderHook(({ gesturesEnabled }) => useNativeQRScanner({ ...options, gesturesEnabled }), { initialProps: { gesturesEnabled: true } });
    const id = postMessage.mock.calls[0]![0].sessionId;
    act(() => window.onNativeQRScannerEvent!({ sessionId: id, type: 'ready', camera }));
    act(() => result.current.gestureHandlers.onPointerDown(pointer(1, 20, 20)));
    rerender({ gesturesEnabled: false });
    act(() => result.current.gestureHandlers.onPointerUp(pointer(1, 20, 20, 'pointerup')));
    expect(postMessage.mock.calls.some(([command]) => command.action === 'focus')).toBe(false);
  });
});
