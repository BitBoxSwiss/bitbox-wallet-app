// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { runningInQtWebEngine } from './env';

vi.mock('./env', () => ({ runningInQtWebEngine: vi.fn(() => true) }));
vi.mock('./transport-qt', () => ({ getQtChannel: vi.fn() }));

const fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts');
let callbacks: Map<number, FrameRequestCallback>;
let nextFrame: number;
let dispose: (() => void) | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.mocked(runningInQtWebEngine).mockReturnValue(true);
  callbacks = new Map();
  nextFrame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    callbacks.delete(id);
  });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  document.body.removeAttribute('style');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (fontDescriptor) {
    Object.defineProperty(document, 'fonts', fontDescriptor);
  } else {
    Reflect.deleteProperty(document, 'fonts');
  }
});

const flushFrame = () => {
  const pending = [...callbacks.values()];
  callbacks.clear();
  pending.forEach(callback => callback(performance.now()));
};

const setup = async (csd = true, previewSeparateTitlebar = false) => {
  const updateFrame = vi.fn();
  const { getQtChannel } = await import('./transport-qt');
  vi.mocked(getQtChannel).mockResolvedValue({ objects: { desktopChrome: {
    state: { csd, previewSeparateTitlebar, revision: 1, topInset: 0, leftInset: 0, rightInset: 52, cornerRadius: 12 },
    stateChanged: { connect: vi.fn() },
    updateFrame,
  } } });
  const chrome = await import('./desktop-chrome');
  await chrome.initializeDesktopChrome();
  const header = document.createElement('header');
  header.setAttribute('data-window-titlebar', '');
  header.setAttribute('data-window-frame-surface', '');
  const rect = { x: 0, y: 0, width: window.innerWidth, height: 70 };
  vi.spyOn(header, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(header, 'getBoundingClientRect').mockImplementation(() => ({ ...rect } as DOMRect));
  document.body.append(header);
  dispose = chrome.attachDesktopGeometry({ close: 'Close' });
  await Promise.resolve();
  flushFrame();
  return { ...chrome, updateFrame, header, rect };
};

// A stalled GUI thread must not make Chromium repeatedly measure frames it cannot send.
it('defers geometry reads until Qt replies, then sends the latest geometry', async () => {
  const { updateFrame, header, rect, notifyChromeLayout } = await setup();
  const measure = vi.mocked(header.getBoundingClientRect);
  const reads = measure.mock.calls.length;
  rect.height = 48;
  notifyChromeLayout();
  flushFrame();
  rect.height = 42;
  notifyChromeLayout();
  flushFrame();
  expect(updateFrame).toHaveBeenCalledTimes(1);
  expect(measure).toHaveBeenCalledTimes(reads);
  updateFrame.mock.calls[0]![1]();
  expect(updateFrame).toHaveBeenCalledTimes(2);
  expect(updateFrame.mock.calls[1]![0].layout.titlebar.height).toBe(42);
});

// Moving a panel changes hit testing without requiring native recoloring or repainting.
it('only sends the parts of a frame that changed', async () => {
  const { updateFrame, rect, notifyChromeLayout } = await setup();
  updateFrame.mock.calls[0]![1]();
  rect.height = 48;
  notifyChromeLayout();
  flushFrame();
  expect(updateFrame.mock.calls[1]![0]).toHaveProperty('layout');
  expect(updateFrame.mock.calls[1]![0]).not.toHaveProperty('appearance');
  updateFrame.mock.calls[1]![1]();
  document.body.style.color = 'rgb(255, 255, 255)';
  notifyChromeLayout();
  flushFrame();
  expect(updateFrame.mock.calls[2]![0]).not.toHaveProperty('layout');
  expect(updateFrame.mock.calls[2]![0].appearance.foreground).toBe('#ffffff');
});

// Separator/fade/activity attributes are sampler output, not reasons to measure again.
it('ignores its own scroll decoration mutations', async () => {
  const { updateFrame, header } = await setup();
  updateFrame.mock.calls[0]![1]();
  await Promise.resolve();
  flushFrame();
  await Promise.resolve();
  const measure = vi.mocked(header.getBoundingClientRect);
  measure.mockClear();
  header.toggleAttribute('data-window-scrolled', true);
  header.toggleAttribute('data-window-scroll-more', true);
  header.toggleAttribute('data-window-scroll-active', true);
  await Promise.resolve();
  flushFrame();
  expect(measure).not.toHaveBeenCalled();
});

// A DOM update burst needs one new sample and must still discover new header controls.
it('coalesces mutations into one measurement before the next paint', async () => {
  const { updateFrame, header } = await setup();
  updateFrame.mock.calls[0]![1]();
  await Promise.resolve();
  flushFrame();
  await Promise.resolve();
  const measure = vi.mocked(header.getBoundingClientRect);
  measure.mockClear();
  header.append(document.createElement('button'));
  await Promise.resolve();
  header.classList.add('updated');
  await Promise.resolve();
  expect(measure).not.toHaveBeenCalled();
  expect(callbacks.size).toBe(1);
  flushFrame();
  expect(measure).toHaveBeenCalledTimes(1);
});

// Transition hit testing still updates immediately, without waiting for the mutation batching frame.
it('publishes the first panel transition sample synchronously', async () => {
  const { updateFrame, header, rect } = await setup();
  updateFrame.mock.calls[0]![1]();
  rect.height = 48;
  header.dispatchEvent(new Event('transitionrun', { bubbles: true }));
  expect(updateFrame.mock.calls[1]![0].layout.titlebar.height).toBe(48);
});

// With no startup handshake, an unchanged frame must not force another native appearance transaction.
it('does not resend an unchanged frame', async () => {
  const { updateFrame, notifyChromeLayout } = await setup();
  updateFrame.mock.calls[0]![1]();
  notifyChromeLayout();
  flushFrame();
  expect(updateFrame).toHaveBeenCalledOnce();
});

// A late Qt reply must not restart a sampler that has already been unmounted.
it('does not publish a queued sample after disposal', async () => {
  const { updateFrame, rect, notifyChromeLayout } = await setup();
  rect.height = 48;
  notifyChromeLayout();
  flushFrame();
  dispose!();
  dispose = undefined;
  updateFrame.mock.calls[0]![1]();
  flushFrame();
  expect(updateFrame).toHaveBeenCalledOnce();
});

// Browser and mobile callers must leave the Qt bridge uninitialized.
it('does not initialize a desktop transport in browser or mobile environments', async () => {
  vi.mocked(runningInQtWebEngine).mockReturnValue(false);
  const { initializeDesktopChrome } = await import('./desktop-chrome');
  await expect(initializeDesktopChrome()).resolves.toBeUndefined();
});

// Hidden or empty controls must not carve holes in the native drag region.
it('does not report hidden or empty controls as hit-test exclusions', async () => {
  const { rectFromElement } = await import('./desktop-chrome');
  const element = document.createElement('button');
  expect(rectFromElement(element)).toBeUndefined();
  vi.spyOn(element, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 50, 100, 30));
  expect(rectFromElement(element)).toEqual({ x: 20, y: 50, width: 100, height: 30 });
});

// Visible controls stay clickable, offscreen captions are ignored, and remounts keep increasing sequence numbers.
it('uses the shared header row while excluding controls and offscreen sidebars', async () => {
  const { updateFrame, header, rect, notifyChromeLayout, attachDesktopGeometry } = await setup();
  updateFrame.mock.calls[0]![1]();
  rect.x = 250;
  rect.width = 600;
  const element = (attribute: string, x: number, y: number, width: number, height: number) => {
    const node = document.createElement('div');
    node.setAttribute(attribute, '');
    vi.spyOn(node, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height));
    return node;
  };
  header.append(element('data-window-no-drag', 740, 10, 100, 50));
  document.body.append(
    element('data-window-titlebar', -250, 0, 250, 300),
    element('data-window-no-drag-overlay', 250, 70, 600, 94),
  );
  notifyChromeLayout();
  flushFrame();
  const layout = updateFrame.mock.calls[1]![0].layout;
  expect(layout.titlebar).toEqual({ x: 0, y: 0, width: window.innerWidth, height: 70 });
  expect(layout.exclusions).toEqual([{ x: 740, y: 10, width: 100, height: 50 }]);
  dispose!();
  dispose = attachDesktopGeometry({ close: 'Close' });
  flushFrame();
  expect(updateFrame.mock.calls[2]![0].layout.sequence).toBeGreaterThan(layout.sequence);
});

// Native borders keep the modernized UI and scrollbar activity, without publishing drag regions.
it('keeps the modernized design when CSD is disabled', async () => {
  const { updateFrame, desktopModernized } = await setup(false);
  expect(desktopModernized()).toBe(true);
  expect(document.body).toHaveAttribute('data-desktop-modernized');
  expect(document.body).not.toHaveAttribute('data-desktop-csd');
  expect(document.documentElement).not.toHaveAttribute('data-desktop-csd');
  expect(updateFrame.mock.calls[0]![0]).not.toHaveProperty('layout');
  const scroll = document.createElement('div');
  scroll.setAttribute('data-window-scroll', '');
  Object.defineProperties(scroll, { scrollHeight: { value: 200 }, clientHeight: { value: 100 } });
  document.body.append(scroll);
  scroll.dispatchEvent(new Event('wheel', { bubbles: true }));
  expect(scroll).toHaveAttribute('data-window-scroll-active');
});

// Fixed captions keep their geometry while their content scrolls; only the web separator and fade should update.
it('updates scroll decorations without remeasuring native drag regions', async () => {
  const { updateFrame, header, notifyChromeLayout } = await setup();
  const scroll = document.createElement('div');
  scroll.setAttribute('data-window-scroll', '');
  Object.defineProperties(scroll, {
    scrollHeight: { value: 300 }, clientHeight: { value: 100 }, scrollTop: { value: 0, writable: true },
  });
  header.after(scroll);
  updateFrame.mock.calls[0]![1]();
  notifyChromeLayout();
  await Promise.resolve();
  flushFrame();
  const measure = vi.mocked(header.getBoundingClientRect);
  measure.mockClear();
  scroll.scrollTop = 20;
  scroll.dispatchEvent(new Event('scroll', { bubbles: true }));
  await Promise.resolve();
  flushFrame();
  expect(header).toHaveAttribute('data-window-scrolled');
  expect(scroll.parentElement).toHaveAttribute('data-window-scroll-more');
  expect(measure).not.toHaveBeenCalled();
});

// Concurrent panel transitions must keep sampling until the last transition ends.
it('keeps sampling overlapping transitions until both finish', async () => {
  const { updateFrame, header } = await setup();
  updateFrame.mock.calls[0]![1]();
  const transition = (type: string, propertyName: string) => header.dispatchEvent(
    Object.assign(new Event(type, { bubbles: true }), { propertyName })
  );
  transition('transitionrun', 'transform');
  transition('transitionrun', 'margin-left');
  transition('transitionend', 'transform');
  flushFrame();
  expect(callbacks.size).toBe(1);
  transition('transitionend', 'margin-left');
  expect(callbacks.size).toBe(0);
});

// Only separate CSD rows square off the web surface's upper corners; system borders retain their own contour.
it('limits the separate titlebar contour to active CSD', async () => {
  await setup(true, true);
  expect(document.body).toHaveAttribute('data-desktop-separate-titlebar');
  dispose?.();
  vi.resetModules();
  await setup(false, true);
  expect(document.body).not.toHaveAttribute('data-desktop-separate-titlebar');
});
