// SPDX-License-Identifier: Apache-2.0

import { getQtChannel } from './transport-qt';
import { runningInQtWebEngine } from './env';
import { captionButtonColors, captionDismissRects, TCaptionButton } from './desktop-frame';

export type TDesktopChromeState = {
  csd: boolean;
  nativeDecorations: boolean;
  activeNativeDecorations: boolean;
  previewHeaderHeight?: number;
  previewLogoVisible?: boolean;
  previewButtonStyle?: string;
  revision: number;
  topInset: number;
  leftInset: number;
  rightInset: number;
  cornerRadius: number;
  captionButtons?: TCaptionButton[];
  systemDark?: boolean | null;
  systemAppearanceReady: boolean;
  maximized: boolean;
  fullScreen: boolean;
};

type TRect = { x: number; y: number; width: number; height: number };
type TChrome = {
  state: TDesktopChromeState;
  stateChanged: { connect: (callback: () => void) => void };
  updateFrame: (frame: { layout?: unknown; appearance?: unknown }, applied: () => void) => void;
  setNativeDecorations: (enabled: boolean) => void;
  setPreviewHeaderHeight: (height: number) => void;
  setPreviewLogoVisible: (visible: boolean) => void;
  setPreviewButtonStyle: (style: string) => void;
};

let chrome: TChrome | undefined;
let state: TDesktopChromeState | undefined;
let initialization: Promise<void> | undefined;
const listeners = new Set<() => void>();
let layoutSequence = 0;

export const desktopChromeState = () => state;
export const desktopModernized = () => state !== undefined;
export const desktopSystemDark = () => state?.systemDark;

export const subscribeDesktopChrome = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const initializeDesktopChrome = () => {
  if (!runningInQtWebEngine()) {
    return Promise.resolve();
  }
  if (!initialization) {
    initialization = getQtChannel().then(channel => {
      chrome = channel.objects.desktopChrome as TChrome | undefined;
      if (!chrome) {
        return;
      }
      const changed = () => {
        state = { ...chrome!.state };
        // Apply the contour before notifying React or sampling header geometry.
        // Native masks and Chromium must use the same radius from startup onward.
        document.body.setAttribute('data-desktop-modernized', '');
        document.body.toggleAttribute('data-desktop-csd', state.csd);
        document.body.toggleAttribute('data-desktop-edge-to-edge', state.maximized || state.fullScreen);
        document.documentElement.toggleAttribute('data-desktop-csd', state.csd);
        document.body.style.setProperty('--desktop-controls-left', `${state.leftInset}px`);
        document.body.style.setProperty('--desktop-controls-right', `${state.rightInset}px`);
        document.body.style.setProperty('--desktop-window-radius', `${state.cornerRadius}px`);
        if (state.previewHeaderHeight !== undefined) {
          document.body.style.setProperty('--header-height', `${state.previewHeaderHeight}px`);
        }
        document.body.toggleAttribute('data-desktop-logo-hidden', state.previewLogoVisible === false);
        listeners.forEach(listener => listener());
        window.dispatchEvent(new Event('bitbox-chrome-layout'));
      };
      chrome.stateChanged.connect(changed);
      changed();
    });
  }
  return initialization;
};

export const setNativeDecorations = (enabled: boolean) => chrome?.setNativeDecorations(enabled);
export const setPreviewHeaderHeight = (height: number) => chrome?.setPreviewHeaderHeight(height);
export const setPreviewLogoVisible = (visible: boolean) => chrome?.setPreviewLogoVisible(visible);
export const setPreviewButtonStyle = (style: string) => chrome?.setPreviewButtonStyle(style);

export const notifyChromeLayout = () => {
  if (runningInQtWebEngine()) {
    window.dispatchEvent(new Event('bitbox-chrome-layout'));
  }
};

export const rectFromElement = (element: Element): TRect | undefined => {
  const panel = element.closest('[data-window-frame-panel]');
  if (panel) {
    const style = getComputedStyle(panel);
    if (Number(style.opacity || 1) === 0 || style.visibility === 'hidden') {
      return;
    }
  }
  const rect = element.getBoundingClientRect();
  if (!element.getClientRects().length || rect.width <= 0 || rect.height <= 0) {
    return;
  }
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

const qtColor = (value: string) => {
  const channels = value.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/);
  if (!channels) {
    return value;
  }
  return '#' + channels.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
};

export const attachDesktopGeometry = (labels: Record<string, string>) => {
  if (!chrome || !state) {
    return () => {};
  }
  let frame: number | undefined;
  let previousLayout = '';
  let previousAppearance = '';
  let disposed = false;
  let inFlight = false;
  let resample = false;
  let transitions = 0;
  let animateUntil = 0;
  const resizeObserver = new ResizeObserver(() => schedule());
  const observed = new Set<Element>();
  const idleScrollbars = new Map<HTMLElement, number>();
  // Keep hit-test exclusions current as panel transitions start. Visible window
  // edges are part of the same Chromium composition as the panel content.
  const mutations = new MutationObserver(records => {
    // These attributes only paint scroll decorations; observing our own output
    // would measure the same layout again after every scroll/activity update.
    if (records.some(record => !['data-window-scrolled', 'data-window-scroll-more', 'data-window-scroll-active']
      .includes(record.attributeName || ''))) {
      schedule();
    }
  });

  const updateScroll = (scroll: HTMLElement) => {
    scroll.parentElement?.querySelector('[data-window-titlebar]')?.toggleAttribute('data-window-scrolled', scroll.scrollTop > 0);
    scroll.parentElement?.toggleAttribute('data-window-scroll-more', scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop > 1);
  };

  const publish = () => {
    frame = undefined;
    if (!chrome || !state) {
      return;
    }
    // Wait for the GUI thread before measuring another frame, then sample the
    // latest DOM once instead of computing snapshots that cannot be sent.
    if (inFlight) {
      resample = true;
      return;
    }
    const titlebars = [...document.querySelectorAll('[data-window-titlebar]')];
    const overlays = [...document.querySelectorAll('[data-window-no-drag-overlay]')];
    const surfaces = [...document.querySelectorAll('[data-window-frame-surface]')];
    const scrolls = [...document.querySelectorAll<HTMLElement>('[data-window-scroll]')];
    let observationChanged = false;
    [...titlebars, ...overlays, ...surfaces, ...scrolls].forEach(element => {
      if (observed.has(element)) {
        return;
      }
      observed.add(element);
      resizeObserver.observe(element);
      observationChanged = true;
    });
    observed.forEach(element => {
      if (element.isConnected) {
        return;
      }
      resizeObserver.unobserve(element);
      observed.delete(element);
      observationChanged = true;
    });
    if (observationChanged) {
      mutations.disconnect();
      mutations.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      observed.forEach(element => mutations.observe(element, { attributes: true, childList: true, subtree: true }));
    }
    let height = state.topInset;
    const exclusions: TRect[] = [];
    titlebars.forEach(element => {
      const rect = rectFromElement(element);
      if (!rect || rect.y < 0 || rect.y >= 256 || rect.x + rect.width <= 0 || rect.x >= window.innerWidth) {
        return;
      }
      height = Math.max(height, Math.min(256, rect.y + rect.height));
      const header = element as HTMLElement;
      const slots = {
        '--desktop-caption-controls-left': `${Math.max(0, state!.leftInset - Math.max(0, rect.x))}px`,
        '--desktop-caption-controls-right': `${Math.max(0, state!.rightInset - Math.max(0, window.innerWidth - rect.x - rect.width))}px`,
      };
      Object.entries(slots).forEach(([name, value]) => {
        if (header.style.getPropertyValue(name) !== value) {
          header.style.setProperty(name, value);
        }
      });
      element.querySelectorAll('button, input, select, textarea, a, [role="button"], [data-window-no-drag]').forEach(control => {
        if (control.matches('a') && element.hasAttribute('data-window-logo')) {
          return;
        }
        const exclusion = rectFromElement(control);
        if (exclusion) {
          exclusions.push(exclusion);
        }
      });
    });
    overlays.forEach(element => {
      const rect = rectFromElement(element);
      if (rect && rect.y < height && rect.y + rect.height > 0) {
        exclusions.push(rect);
      }
    });
    exclusions.push(...captionDismissRects(height));
    scrolls.forEach(updateScroll);
    const layout = {
      revision: state.revision,
      size: { width: window.innerWidth, height: window.innerHeight },
      titlebar: { x: 0, y: 0, width: window.innerWidth, height },
      // Too many exclusions disables extended dragging rather than dropping controls.
      exclusions,
    };
    const layoutKey = JSON.stringify(layout);
    const layoutChanged = state.csd && layoutKey !== previousLayout;
    const sidebar = document.querySelector('[data-window-sidebar]');
    const sidebarRect = sidebar && rectFromElement(sidebar);
    document.body.toggleAttribute('data-desktop-sidebar', Boolean(sidebarRect && sidebarRect.x + sidebarRect.width > 0));
    const bodyStyle = getComputedStyle(document.body);
    const appStyle = getComputedStyle(document.querySelector('.app') || document.body);
    const rootStyle = getComputedStyle(document.documentElement);
    const radiusToken = rootStyle.getPropertyValue('--radius-xl').trim();
    const buttonRadius = parseFloat(radiusToken) * (radiusToken.endsWith('rem') ? parseFloat(rootStyle.fontSize) : 1);
    const appearance = {
      background: qtColor(appStyle.backgroundColor),
      foreground: qtColor(bodyStyle.color),
      captionColors: Object.fromEntries(Object.entries(captionButtonColors(state.captionButtons || [], bodyStyle.color))
        .map(([action, color]) => [action, qtColor(color)])),
      buttonRadius,
      labels,
    };
    const appearanceKey = JSON.stringify(appearance);
    const appearanceChanged = appearanceKey !== previousAppearance;
    if (layoutChanged || appearanceChanged) {
      inFlight = true;
      previousLayout = layoutKey;
      previousAppearance = appearanceKey;
      chrome.updateFrame({
        ...(layoutChanged ? { layout: { ...layout, sequence: ++layoutSequence } } : {}),
        ...(appearanceChanged ? { appearance } : {}),
      }, () => {
        inFlight = false;
        if (resample && !disposed) {
          resample = false;
          publishImmediately();
        }
      });
    }
    if (transitions && performance.now() < animateUntil) {
      schedule();
    }
  };
  const transition = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element) || !(target.hasAttribute('data-window-frame-surface') || target.hasAttribute('data-window-no-drag-overlay'))) {
      return;
    }
    transitions = Math.max(0, transitions + (event.type === 'transitionrun' ? 1 : -1));
    if (event.type === 'transitionrun') {
      animateUntil = performance.now() + 1000;
    }
    publishImmediately();
  };
  const transitionEvents = ['transitionrun', 'transitionend', 'transitioncancel'];
  transitionEvents.forEach(event => window.addEventListener(event, transition, true));
  const schedule = () => {
    if (disposed) {
      return;
    }
    if (frame === undefined) {
      frame = requestAnimationFrame(publish);
    }
  };
  const publishImmediately = () => {
    if (disposed) {
      return;
    }
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    publish();
  };
  const events = ['bitbox-chrome-layout', 'resize', 'load', 'click', 'keyup'];
  events.forEach(event => window.addEventListener(event, schedule, true));
  const scrollActivity = (event: Event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const scroll = event.target.closest<HTMLElement>('[data-window-scroll]');
    if (!scroll) {
      return;
    }
    updateScroll(scroll);
    if (scroll.scrollHeight <= scroll.clientHeight) {
      return;
    }
    window.clearTimeout(idleScrollbars.get(scroll));
    scroll.toggleAttribute('data-window-scroll-active', true);
    idleScrollbars.set(scroll, window.setTimeout(() => {
      scroll.removeAttribute('data-window-scroll-active');
      idleScrollbars.delete(scroll);
    }, 1000));
  };
  const activityEvents = ['scroll', 'wheel'];
  activityEvents.forEach(event => window.addEventListener(event, scrollActivity, { capture: true, passive: true }));
  mutations.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.fonts.ready.then(schedule);
  schedule();
  return () => {
    disposed = true;
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
    resizeObserver.disconnect();
    mutations.disconnect();
    idleScrollbars.forEach((timeout, scroll) => {
      window.clearTimeout(timeout);
      scroll.removeAttribute('data-window-scroll-active');
    });
    idleScrollbars.clear();
    activityEvents.forEach(event => window.removeEventListener(event, scrollActivity, true));
    events.forEach(event => window.removeEventListener(event, schedule, true));
    transitionEvents.forEach(event => window.removeEventListener(event, transition, true));
  };
};
