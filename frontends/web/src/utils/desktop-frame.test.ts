// SPDX-License-Identifier: Apache-2.0
import { afterEach, expect, it, vi } from 'vitest';
import { captionDismissRects } from './desktop-frame';

const hitDescriptors = ['elementsFromPoint', 'elementFromPoint'].map(name => Object.getOwnPropertyDescriptor(document, name));
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  ['elementsFromPoint', 'elementFromPoint'].forEach((name, index) => {
    const descriptor = hitDescriptors[index];
    if (descriptor) {
      Object.defineProperty(document, name, descriptor);
    } else {
      Reflect.deleteProperty(document, name);
    }
  });
});
const surface = (background: string, x: number, y: number, width: number, height: number) => {
  const element = document.createElement('div');
  element.setAttribute('data-window-frame-surface', '');
  element.style.backgroundColor = background;
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height));
  document.body.append(element);
  return element;
};

it('keeps the guide caption draggable while the dimmed caption dismisses overlays', () => {
  const width = window.innerWidth, height = window.innerHeight;
  const overlay = surface('rgba(0,0,0,.3)', 0, 0, width, height);
  overlay.setAttribute('data-window-dismiss-overlay', '');
  const sidebar = surface('#333', -200, 0, 250, height);
  sidebar.setAttribute('data-window-frame-panel', '');
  const guide = surface('#6699bb', width - 200, 0, 460, height);
  guide.setAttribute('data-window-frame-panel', '');
  const guideCaption = document.createElement('h2');
  guide.append(guideCaption);
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number) =>
    x < 50 ? sidebar : x >= width - 200 ? guideCaption : overlay });
  expect(captionDismissRects(70)).toEqual([{ x: 50, y: 0, width: width - 250, height: 70 }]);
});
