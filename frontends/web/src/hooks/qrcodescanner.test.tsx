// SPDX-License-Identifier: Apache-2.0

import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type QrScanner from 'qr-scanner';
import { useQRScanner } from './qrcodescanner';

type TScannerOptions = {
  calculateScanRegion: () => QrScanner.ScanRegion;
  onDecodeError: (error: string) => void;
};

type TScanner = {
  region: QrScanner.ScanRegion;
  onResult: (result: QrScanner.ScanResult) => void;
  options: TScannerOptions;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  hasFlash: ReturnType<typeof vi.fn>;
  toggleFlash: ReturnType<typeof vi.fn>;
  isFlashOn: ReturnType<typeof vi.fn>;
};

const { scanners, t } = vi.hoisted(() => ({ scanners: [] as TScanner[], t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('qr-scanner', () => ({
  default: class {
    region: QrScanner.ScanRegion;
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    pause = vi.fn().mockResolvedValue(true);
    destroy = vi.fn();
    hasFlash = vi.fn().mockResolvedValue(true);
    toggleFlash = vi.fn().mockResolvedValue(undefined);
    isFlashOn = vi.fn().mockReturnValue(false);

    constructor(
      _video: HTMLVideoElement,
      public onResult: (result: QrScanner.ScanResult) => void,
      public options: TScannerOptions,
    ) {
      this.region = options.calculateScanRegion();
      scanners.push(this);
    }
  },
}));

let resize: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  scanners.length = 0;
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) {
      resize = callback;
    }
    observe = vi.fn();
    disconnect = disconnect;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const setup = ({
  camera = [1920, 1080],
  preview = new DOMRect(0, 0, 400, 800),
  guide = new DOMRect(40, 120, 320, 320),
  mirrored = false,
  strict = false,
} = {}) => {
  const video = document.createElement('video');
  const focus = document.createElement('div');
  Object.defineProperties(video, {
    videoWidth: { configurable: true, value: camera[0] },
    videoHeight: { configurable: true, value: camera[1] },
  });
  video.style.transform = mirrored ? 'scaleX(-1)' : '';
  const previewRect = vi.spyOn(video, 'getBoundingClientRect').mockReturnValue(preview);
  const guideRect = vi.spyOn(focus, 'getBoundingClientRect').mockReturnValue(guide);
  const videoRef = { current: video };
  const scanRegionRef = { current: focus };
  const onStart = vi.fn();
  const onResult = vi.fn();
  const onError = vi.fn();
  const hook = renderHook(() => useQRScanner(videoRef, {
    scanRegionRef, onStart, onResult, onError, stopOnResult: false,
  }), { wrapper: strict ? StrictMode : undefined });
  return { ...hook, video, previewRect, guideRect, onStart, onResult, onError, scanner: scanners.at(-1)! };
};

describe('useQRScanner', () => {
  // A portrait preview crops the camera horizontally; the guide at 35% must select the same pixels.
  it('maps a fullscreen guide through a landscape camera preview', () => {
    const { scanner } = setup();
    expect(scanner.region).toEqual({ x: 744, y: 162, width: 432, height: 432 });
  });

  // A wide preview crops a portrait camera vertically, which must also shift the source Y coordinate.
  it('accounts for vertically cropped camera frames and modal offsets', () => {
    const { scanner } = setup({
      camera: [1200, 1600],
      preview: new DOMRect(100, 75, 600, 400),
      guide: new DOMRect(290, 105, 220, 220),
    });
    expect(scanner.region).toEqual({ x: 380, y: 460, width: 440, height: 440 });
  });

  // Front cameras mirror the preview but the decoder reads the unmirrored source image.
  it('maps a guide back through a mirrored preview', () => {
    const { scanner } = setup({
      camera: [800, 600],
      preview: new DOMRect(0, 0, 400, 300),
      guide: new DOMRect(40, 50, 100, 100),
      mirrored: true,
    });
    expect(scanner.region).toEqual({ x: 520, y: 100, width: 200, height: 200 });
  });

  // qr-scanner retains the original region object; resizing must update that object without restarting the camera.
  it('updates the cached region when the preview and guide resize', async () => {
    const { scanner, previewRect, guideRect } = setup();
    const cachedRegion = scanner.region;
    await act(() => vi.advanceTimersByTimeAsync(300));
    previewRect.mockReturnValue(new DOMRect(0, 0, 800, 400));
    guideRect.mockReturnValue(new DOMRect(240, 40, 320, 320));
    act(() => resize());
    expect(cachedRegion.x).toBeCloseTo(576);
    expect(cachedRegion.y).toBeCloseTo(156);
    expect(cachedRegion.width).toBeCloseTo(768);
    expect(cachedRegion.height).toBeCloseTo(768);
    expect(scanners).toHaveLength(1);
    expect(scanner.start).toHaveBeenCalledTimes(1);
  });

  // Camera orientation/resolution can change without changing the size of the video element.
  it('recalculates on the video resize event', () => {
    const { video, scanner } = setup();
    Object.defineProperties(video, {
      videoWidth: { value: 1080 },
      videoHeight: { value: 1920 },
    });
    act(() => video.dispatchEvent(new Event('resize')));
    expect(scanner.region).toEqual({ x: 156, y: 288, width: 768, height: 768 });
  });

  // Switching layout can move the guide without changing either element's dimensions.
  it('updates the crop after a render moves the guide', () => {
    const { scanner, guideRect, rerender } = setup();
    guideRect.mockReturnValue(new DOMRect(40, 240, 320, 320));
    rerender();
    expect(scanner.region).toEqual({ x: 744, y: 324, width: 432, height: 432 });
    expect(scanners).toHaveLength(1);
  });

  // Short windows can clip the guide; decoding must exclude the invisible part of the camera frame.
  it('limits decoding to the visible portion of a clipped guide', () => {
    const { scanner } = setup({
      camera: [800, 600],
      preview: new DOMRect(0, 0, 400, 300),
      guide: new DOMRect(40, -50, 320, 320),
    });
    expect(scanner.region).toEqual({ x: 80, y: 0, width: 640, height: 540 });
  });

  // Zero scan dimensions mean full-frame decoding to qr-scanner, so initialization must use a finite nonzero crop.
  it('handles metadata that has not loaded yet', () => {
    const { scanner } = setup({ camera: [0, 0] });
    expect(scanner.region).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  // Closing during the startup delay must never open a camera after the scanner is gone.
  it('cancels startup when unmounted during the delay', async () => {
    const { unmount, scanner, onStart } = setup();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(scanner.start).not.toHaveBeenCalled();
    expect(scanner.destroy).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });

  // Closing while camera permission is pending must destroy immediately and suppress late results and callbacks.
  it('cancels an in-flight start and ignores late decode results', async () => {
    const { scanner, unmount, onStart, onResult, onError } = setup();
    let finishStart = () => {};
    scanner.start.mockReturnValue(new Promise<void>(resolve => {
      finishStart = resolve;
    }));
    await act(() => vi.advanceTimersByTimeAsync(300));
    unmount();
    expect(scanner.pause).toHaveBeenCalledWith(true);
    expect(scanner.destroy).toHaveBeenCalledOnce();
    await act(async () => finishStart());
    scanner.onResult({ data: 'late result', cornerPoints: [] });
    scanner.options.onDecodeError('late error');
    expect(scanner.hasFlash).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  // React's setup/cleanup/setup cycle must start only the surviving scanner instance.
  it('keeps startup isolated across StrictMode effect restarts', async () => {
    setup({ strict: true });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(scanners).toHaveLength(2);
    expect(scanners[0]!.start).not.toHaveBeenCalled();
    expect(scanners[0]!.destroy).toHaveBeenCalledOnce();
    expect(scanners[1]!.start).toHaveBeenCalledOnce();
    expect(scanners[1]!.destroy).not.toHaveBeenCalled();
  });

  // The library owns torch state and its stream-restart workaround for cameras that cannot disable torch via constraints.
  it('toggles flash through the scanner and reflects its resulting state', async () => {
    const { scanner, result } = setup();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(result.current.hasFlash).toBe(true);
    scanner.isFlashOn.mockReturnValue(true);
    await act(() => result.current.toggleFlash());
    expect(result.current.isFlashOn).toBe(true);
    scanner.isFlashOn.mockReturnValue(false);
    await act(() => result.current.toggleFlash());
    expect(result.current.isFlashOn).toBe(false);
    expect(scanner.toggleFlash).toHaveBeenCalledTimes(2);
  });
});
