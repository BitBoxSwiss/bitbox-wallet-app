// SPDX-License-Identifier: Apache-2.0

export type TCaptionButton = { action: string; x: number; y: number; width: number; height: number };

// Native controls only need the ink color beneath their centers. Window edges,
// panel backgrounds and the outline are painted entirely by Chromium.
export const captionButtonColors = (buttons: TCaptionButton[], foreground: string) =>
  Object.fromEntries(buttons.map(button => {
    const x = Math.max(0, Math.min(window.innerWidth - 1, button.x + button.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, button.y + button.height / 2));
    const hits = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
    const panel = hits.map(element => element.closest<HTMLElement>('[data-window-frame-panel], [data-window-logo]'))
      .find(element => element !== null);
    return [button.action, panel ? panel.dataset.windowFrameForeground || getComputedStyle(panel).color : foreground];
  }));

// Dimmed header cells belong to the dismiss overlay. Visible panel captions
// remain native drag regions, including the guide title.
export const captionDismissRects = (height: number) => {
  const overlays = [...document.querySelectorAll('[data-window-dismiss-overlay]')];
  if (!overlays.length || !height || typeof document.elementFromPoint !== 'function') {
    return [];
  }
  const boundaries = new Set([0, window.innerWidth]);
  document.querySelectorAll('[data-window-frame-panel], [data-window-dismiss-overlay]').forEach(element => {
    const rect = element.getBoundingClientRect();
    [rect.left, rect.right].forEach(value => boundaries.add(Math.max(0, Math.min(window.innerWidth, value))));
  });
  const points = [...boundaries].sort((a, b) => a - b);
  const rectangles: { x: number; y: number; width: number; height: number }[] = [];
  points.slice(0, -1).forEach((x, index) => {
    const right = points[index + 1]!;
    const hit = document.elementFromPoint((x + right) / 2, height / 2)?.closest('[data-window-dismiss-overlay]');
    if (hit && overlays.includes(hit)) {
      const last = rectangles.at(-1);
      if (last && last.x + last.width === x) {
        last.width += right - x;
      } else {
        rectangles.push({ x, y: 0, width: right - x, height });
      }
    }
  });
  return rectangles;
};
