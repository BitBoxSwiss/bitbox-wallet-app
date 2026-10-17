// SPDX-License-Identifier: Apache-2.0

import { afterEach, expect, it, vi } from 'vitest';
import { appearanceFields, applyAppearance, readAppearance, saveAppearance } from './desktop-appearance';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.removeAttribute('style');
});

// Light and dark experiments persist independently and survive reading the settings again.
it('keeps separate light and dark appearances', () => {
  expect(saveAppearance('light', { background: '#abcdef', buttonRadius: 100 })).toBe(true);
  expect(saveAppearance('dark', { background: '#123456', buttonRadius: 0 })).toBe(true);
  expect(readAppearance()).toEqual({
    light: { background: '#abcdef', buttonRadius: 100 },
    dark: { background: '#123456', buttonRadius: 0 },
  });
});

// Stored input cannot inject CSS, overflow numeric limits, add unknown fields or crash startup.
it('rejects invalid preferences and recovers from malformed storage', () => {
  saveAppearance('light', {
    background: 'url(https://example.invalid)', buttonRadius: 101, cardRadius: 7.5,
    scrollbarIdle: -1, scrollbarWidth: 9, scrollbarFade: NaN, animationDuration: 0.5, unknown: 'red',
    logoPosition: 'before', logoGap: -1, sidebarWidth: 249, switchRadius: 101, switchThumbRadius: NaN,
  });
  expect(readAppearance().light).toEqual({ cardRadius: 7.5 });
  for (const data of ['{broken', 'null', '[]', '{"light": [1]}']) {
    localStorage.setItem('bitbox.desktop-appearance', data);
    expect(readAppearance()).toEqual({ light: {}, dark: {} });
  }
});

// Live application updates semantic aliases and validated gradients without changing window geometry.
it('applies colors, shapes and gradients and clears them when reset', () => {
  document.body.style.setProperty('--desktop-window-radius', '12px');
  applyAppearance({ accent: '#123456', buttonRadius: 100, buttonInset: 8, mainGradientStrength: 40, mainGradientColor: '#abcdef' }, 'light');
  const style = document.body.style;
  expect(style.getPropertyValue('--color-primary')).toBe('#123456');
  expect(style.getPropertyValue('--color-blue-rgb')).toBe('18, 52, 86');
  expect(style.getPropertyValue('--design-button-radius')).toBe('100px');
  expect(style.getPropertyValue('--design-button-inset-size')).toBe('8px');
  expect(style.getPropertyValue('--design-main-gradient')).toBe('linear-gradient(180deg, transparent, color-mix(in srgb, #abcdef 40%, transparent))');
  expect(style.getPropertyValue('--desktop-window-radius')).toBe('12px');
  applyAppearance({}, 'dark');
  appearanceFields.forEach(field => expect(style.getPropertyValue(field.property)).toBe(''));
  expect(style.getPropertyValue('--color-primary')).toBe('');
  expect(style.getPropertyValue('--design-main-gradient')).toBe('none');
});

// Denied storage still permits a live preview and returns a failure for the UI to explain.
it('does not crash when local storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('denied');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  expect(readAppearance()).toEqual({ light: {}, dark: {} });
  expect(saveAppearance('light', { buttonShadow: 8 })).toBe(false);
  expect(() => applyAppearance({ buttonShadow: 8 }, 'light')).not.toThrow();
});
