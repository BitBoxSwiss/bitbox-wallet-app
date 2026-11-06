// SPDX-License-Identifier: Apache-2.0

import { RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export const useQRScanRegion = (
  videoRef: RefObject<HTMLVideoElement>,
  scanRegionRef: RefObject<HTMLDivElement>,
) => {
  // qr-scanner caches this object. Update it in place when the preview changes size.
  // Zero dimensions would make the decoder fall back to scanning the entire frame.
  const scanRegion = useRef({ x: 0, y: 0, width: 1, height: 1 });
  const updateScanRegion = useCallback(() => {
    const video = videoRef.current;
    const focus = scanRegionRef.current;
    if (!video || !focus) {
      return scanRegion.current;
    }
    const preview = video.getBoundingClientRect();
    const guide = focus.getBoundingClientRect();
    if (!video.videoWidth || !video.videoHeight || !preview.width || !preview.height) {
      return scanRegion.current;
    }
    // The preview uses object-fit: cover and object-position: center. Undo both the
    // scaling and the cropped margins to map the visible guide to camera pixels.
    const scale = Math.max(preview.width / video.videoWidth, preview.height / video.videoHeight);
    const croppedX = (video.videoWidth * scale - preview.width) / 2;
    const croppedY = (video.videoHeight * scale - preview.height) / 2;
    const left = Math.max(0, guide.left - preview.left);
    const top = Math.max(0, guide.top - preview.top);
    const right = Math.min(preview.width, guide.right - preview.left);
    const bottom = Math.min(preview.height, guide.bottom - preview.top);
    const mirrored = video.style.transform.includes('scaleX(-1)');
    Object.assign(scanRegion.current, {
      x: (croppedX + (mirrored ? preview.width - right : left)) / scale,
      y: (croppedY + top) / scale,
      width: Math.max(1, (right - left) / scale),
      height: Math.max(1, (bottom - top) / scale),
    });
    return scanRegion.current;
  }, [videoRef, scanRegionRef]);

  // Layout changes can move the guide without resizing it (for example, fullscreen).
  useLayoutEffect(() => {
    updateScanRegion();
  });

  useEffect(() => {
    const video = videoRef.current;
    const focus = scanRegionRef.current;
    if (!video || !focus) {
      return;
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updateScanRegion);
    observer?.observe(video);
    observer?.observe(focus);
    window.addEventListener('resize', updateScanRegion);
    video.addEventListener('resize', updateScanRegion);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScanRegion);
      video.removeEventListener('resize', updateScanRegion);
    };
  }, [videoRef, scanRegionRef, updateScanRegion]);

  return updateScanRegion;
};
