// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachDesktopGeometry, initializeDesktopChrome, rectFromElement } from './desktop-chrome';
import { getQtChannel } from './transport-qt';
import * as env from './env';

vi.mock('./transport-qt', () => ({ getQtChannel: vi.fn() }));
const fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (fontDescriptor) {
    Object.defineProperty(document, 'fonts', fontDescriptor);
  } else {
    Reflect.deleteProperty(document, 'fonts');
  }
});

describe('desktop chrome', () => {
  it('does not initialize a desktop transport in browser or mobile environments', async () => {
    const qt = window.qt;
    delete window.qt;
    await expect(initializeDesktopChrome()).resolves.toBeUndefined();
    window.qt = qt;
  });

  it('does not report hidden or empty controls as hit-test exclusions', () => {
    const element = document.createElement('button');
    expect(rectFromElement(element)).toBeUndefined();
    vi.spyOn(element, 'getClientRects').mockReturnValue([{ width: 100, height: 30 }] as unknown as DOMRectList);
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 50, width: 100, height: 30 } as DOMRect);
    expect(rectFromElement(element)).toEqual({ x: 20, y: 50, width: 100, height: 30 });
  });

  it('uses the shared header row while excluding controls and offscreen sidebars', async () => {
    const updateFrame = vi.fn();
    vi.spyOn(env, 'runningInQtWebEngine').mockReturnValue(true);
    vi.mocked(getQtChannel).mockResolvedValue({ objects: { desktopChrome: {
      state: { csd: true, document: 1, viewport: 1, topInset: 0, leftInset: 0, rightInset: 52, cornerRadius: 12 },
      stateChanged: { connect: vi.fn() },
      updateFrame,
    } } });
    await initializeDesktopChrome();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('MutationObserver', class {
      observe() {}
      disconnect() {}
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    const element = (attribute: string, x: number, y: number, width: number, height: number) => {
      const node = document.createElement('div');
      node.setAttribute(attribute, '');
      vi.spyOn(node, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({ x, y, width, height } as DOMRect);
      return node;
    };
    const hiddenSidebar = element('data-window-titlebar', -250, 0, 250, 300);
    const header = element('data-window-titlebar', 250, 0, 600, 70);
    const banner = element('data-window-no-drag-overlay', 250, 70, 600, 94);
    const control = element('data-window-no-drag', 740, 10, 100, 50);
    header.append(control);
    document.body.append(hiddenSidebar, header, banner);
    const dispose = attachDesktopGeometry({});
    expect(frames).toHaveLength(1);
    frames[0]!(0);
    expect(updateFrame).toHaveBeenCalledWith(expect.objectContaining({ layout: expect.objectContaining({
      titlebar: { x: 0, y: 0, width: window.innerWidth, height: 70 },
      exclusions: [
        { x: 740, y: 10, width: 100, height: 50 },
      ],
    }) }));
    dispose();
    const firstSequence = updateFrame.mock.calls[0]![0].layout.sequence;
    const disposeAgain = attachDesktopGeometry({ close: 'Close' });
    frames[1]!(0);
    expect(updateFrame.mock.calls[1]![0].layout.sequence).toBeGreaterThan(firstSequence);
    disposeAgain();
    hiddenSidebar.remove();
    header.remove();
    banner.remove();
  });
});
