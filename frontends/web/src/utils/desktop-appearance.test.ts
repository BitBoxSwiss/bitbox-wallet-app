// SPDX-License-Identifier: Apache-2.0

import { afterEach, expect, it, vi } from 'vitest';
import { appearanceFields, appearanceValue, applyAppearance, parseAppearancePreset, presetSizeLimit, readAppearance, saveAppearance, saveAppearanceProfiles, serializeAppearancePreset } from './desktop-appearance';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.body.removeAttribute('style');
  document.body.removeAttribute('data-desktop-scroll-edge-effect');
});

// Colors stay theme-specific, while saving shared geometry in either theme updates both persisted profiles.
it('shares design settings while keeping separate light and dark palettes', () => {
  expect(saveAppearance('light', { background: '#abcdef', buttonRadius: 100 })).toBe(true);
  expect(saveAppearance('dark', { background: '#123456', buttonRadius: 0 })).toBe(true);
  expect(readAppearance()).toEqual({
    light: { background: '#abcdef', buttonRadius: 0 },
    dark: { background: '#123456', buttonRadius: 0 },
  });
});

// Existing conflicting profiles resolve consistently, retaining both palettes and settings present in only one theme.
it('normalizes previously separate layout preferences without losing either color palette', () => {
  localStorage.setItem('bitbox.desktop-appearance', JSON.stringify({
    light: { background: '#ffffff', switchRadius: 12, logoPosition: 'centered' },
    dark: { background: '#222222', switchRadius: 24, sidebarWidth: 400 },
  }));
  const profiles = readAppearance();
  expect(profiles.light).toEqual({ background: '#ffffff', switchRadius: 12, logoPosition: 'centered', sidebarWidth: 400 });
  expect(profiles.dark).toEqual({ ...profiles.light, background: '#222222' });
  saveAppearance('dark', { ...profiles.dark, scrollbarHighlightOpacity: 35 });
  expect(readAppearance().light.scrollbarHighlightOpacity).toBe(35);
  expect(readAppearance().dark.scrollbarHighlightOpacity).toBe(35);
});

// Stored input cannot inject CSS, overflow numeric limits, add unknown fields or crash startup.
it('rejects invalid preferences and recovers from malformed storage', () => {
  saveAppearance('light', {
    background: 'url(https://example.invalid)', buttonRadius: 101, cardRadius: 7.5,
    scrollbarIdle: -1, scrollbarWidth: 9, scrollbarFade: NaN, animationDuration: 0.5, unknown: 'red',
    logoPosition: 'before', logoGap: -1, sidebarWidth: 249, switchRadius: 101, switchThumbRadius: NaN,
    scrollbarHighlightOpacity: 101, scrollbarPadding: -1, scrollbarRadius: 20.5, scrollEdgeEffect: 'blur',
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

// Presets contain both palettes and shared geometry only, and use the same normalization as persisted preferences.
it('round-trips design presets and normalizes shared values', () => {
  const profiles = { light: { accent: '#abcdef', buttonRadius: 12 }, dark: { accent: '#123456', cardShadow: 8 } };
  const preset = parseAppearancePreset(serializeAppearancePreset(profiles));
  expect(preset.profiles).toEqual({
    light: { accent: '#abcdef', buttonRadius: 12, cardShadow: 8 },
    dark: { accent: '#123456', buttonRadius: 12, cardShadow: 8 },
  });
  expect(saveAppearanceProfiles(preset.profiles)).toBe(true);
  expect(readAppearance()).toEqual(preset.profiles);
});

// Invalid files are rejected as a whole instead of silently discarding fields or executing arbitrary CSS.
it('rejects malformed, unsupported, oversized and invalid design presets', () => {
  for (const text of ['{broken', 'null', '[]', '{}', ' '.repeat(presetSizeLimit + 1),
    JSON.stringify({ format: 'bitbox-design', version: 2, profiles: { light: {}, dark: {} } }),
    JSON.stringify({ format: 'bitbox-design', version: 1, profiles: { light: [], dark: {} } }),
    ...[{ accent: 'url(bad)' }, { cardShadowOpacity: 101 }, { unknown: 1 }, { switchColor: '#abc' }]
      .map(light => JSON.stringify({ format: 'bitbox-design', version: 1, profiles: { light, dark: {} } })),
  ]) {
    expect(() => parseAppearancePreset(text)).toThrow();
  }
  expect(localStorage.length).toBe(0);
});

// Effective control values use shared palette/strength choices unless an explicit component override exists.
it('resolves optional color and shadow overrides through shared values', () => {
  const switchColor = appearanceFields.find(field => field.id === 'switchColor')!;
  const strength = appearanceFields.find(field => field.id === 'cardShadowOpacity')!;
  expect(appearanceValue({ accent: '#abcdef' }, switchColor, 'light')).toBe('#abcdef');
  expect(appearanceValue({ accent: '#abcdef', switchColor: '#123456' }, switchColor, 'light')).toBe('#123456');
  expect(appearanceValue({ shadowOpacity: 65 }, strength, 'dark')).toBe(65);
});
