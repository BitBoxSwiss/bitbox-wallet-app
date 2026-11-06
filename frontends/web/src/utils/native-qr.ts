// SPDX-License-Identifier: Apache-2.0

type TQRRect = { x: number; y: number; width: number; height: number };
export type TQRGeometry = { preview: TQRRect; guide: TQRRect; radius: number };
export type TQRCamera = { hasFlash: boolean; isFlashOn: boolean; zoom: number };
type TQRAction =
  | { action: 'geometry'; geometry: TQRGeometry }
  | { action: 'focus'; x: number; y: number }
  | { action: 'zoom'; zoom: number }
  | { action: 'torch'; enabled: boolean };
export type TQRCommand = { sessionId: number } & (
  | TQRAction
  | { action: 'start'; geometry: TQRGeometry }
  | { action: 'stop' }
);
export type TQREvent = { sessionId: number } & (
  | { type: 'ready' | 'state'; camera: TQRCamera }
  | { type: 'result'; text: string }
  | { type: 'error'; code: 'permissionDenied' | 'noCamera' | 'cameraUnavailable' }
);

let nextSessionId = 0;

export const startNativeQR = (geometry: TQRGeometry, onEvent: (event: TQREvent) => void) => {
  const bridge = window.nativeQRScanner;
  if (!bridge) {
    throw new Error('Native QR scanner unavailable');
  }
  const sessionId = ++nextSessionId;
  let active = true;
  let stopFailed = false;
  const previousListener = window.onNativeQRScannerEvent;
  const listener = (event: TQREvent) => {
    if (active && event.sessionId === sessionId) {
      onEvent(event);
    }
  };
  window.onNativeQRScannerEvent = listener;
  const send = (command: TQRAction) => {
    if (active) {
      bridge.postMessage({ ...command, sessionId });
    }
  };
  const stop = () => {
    if (!active && !stopFailed) {
      return;
    }
    active = false;
    if (window.onNativeQRScannerEvent === listener) {
      delete window.onNativeQRScannerEvent;
    }
    try {
      bridge.postMessage({ action: 'stop', sessionId });
      stopFailed = false;
    } catch (error) {
      stopFailed = true;
      throw error;
    }
  };
  try {
    bridge.postMessage({ action: 'start', sessionId, geometry });
  } catch (error) {
    active = false;
    if (window.onNativeQRScannerEvent === listener) {
      if (previousListener) {
        window.onNativeQRScannerEvent = previousListener;
      } else {
        delete window.onNativeQRScannerEvent;
      }
    }
    throw error;
  }
  return { send, stop };
};
