// SPDX-License-Identifier: Apache-2.0

export type TAppearance = Record<string, string | number>;
export type TAppearanceMode = 'light' | 'dark';
export type TAppearanceProfiles = Record<TAppearanceMode, TAppearance>;
type TField = {
  id: string;
  group: string;
  fallback?: string;
  property: string;
  defaults: [string, string] | [number, number];
} & ({ type: 'color' } | { type: 'number'; min: number; max: number; unit: string; step?: number } | { type: 'select'; options: string[] });

export const gradientTargets = ['main', 'sidebar', 'guide', 'button', 'card'] as const;
export const sidebarWidthLimits = { min: 250, max: 600 };
export const appearanceFields: TField[] = [
  { id: 'background', group: 'palette', type: 'color', property: '--background', defaults: ['#f5f5f5', '#1d1d1b'] },
  { id: 'surface', group: 'palette', type: 'color', property: '--background-secondary', defaults: ['#ffffff', '#333333'] },
  { id: 'text', group: 'palette', type: 'color', property: '--color-default', defaults: ['#1d1d1b', '#f5f5f5'] },
  { id: 'mutedText', group: 'palette', type: 'color', property: '--color-secondary', defaults: ['#777777', '#999999'] },
  { id: 'accent', group: 'palette', type: 'color', property: '--color-blue', defaults: ['#5e94bf', '#5e94bf'] },
  { id: 'accentHover', group: 'palette', type: 'color', property: '--color-lightblue', defaults: ['#73a5cd', '#73a5cd'] },
  { id: 'sidebar', group: 'sidebar', type: 'color', property: '--background-dark', defaults: ['#333333', '#333333'] },
  { id: 'sidebarText', group: 'sidebar', type: 'color', property: '--design-sidebar-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'guide', group: 'guide', fallback: 'accentHover', type: 'color', property: '--design-guide-background', defaults: ['#73a5cd', '#73a5cd'] },
  { id: 'guideHeader', group: 'guide', fallback: 'accent', type: 'color', property: '--design-guide-header', defaults: ['#5e94bf', '#5e94bf'] },
  { id: 'guideText', group: 'guide', fallback: 'buttonText', type: 'color', property: '--design-guide-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'buttonText', group: 'palette', type: 'color', property: '--design-button-text', defaults: ['#ffffff', '#ffffff'] },
  { id: 'focus', group: 'palette', type: 'color', property: '--design-focus', defaults: ['#2684ff', '#2684ff'] },
  { id: 'borderColor', group: 'effects', type: 'color', property: '--design-border-color', defaults: ['#000000', '#ffffff'] },
  { id: 'borderWidth', group: 'effects', type: 'number', property: '--design-border-width', defaults: [1, 1], min: 0, max: 4, unit: 'px' },
  { id: 'borderOpacity', group: 'effects', type: 'number', property: '--design-border-opacity', defaults: [0, 0], min: 0, max: 100, unit: '%' },
  { id: 'scrollEdgeEffect', group: 'effects', type: 'select', property: '--design-scroll-edge-effect', defaults: ['none', 'none'], options: ['none', 'inset', 'fade'] },
  { id: 'separatorOpacity', group: 'effects', type: 'number', property: '--design-separator-opacity', defaults: [5, 5], min: 0, max: 100, unit: '%' },
  { id: 'buttonRadius', group: 'button', type: 'number', property: '--design-button-radius', defaults: [7.5, 7.5], min: 0, max: 100, step: 0.5, unit: 'px' },
  { id: 'cardRadius', group: 'card', type: 'number', property: '--radius-xl', defaults: [7.5, 7.5], min: 0, max: 40, step: 0.5, unit: 'px' },
  { id: 'inputRadius', group: 'input', type: 'number', property: '--design-input-radius', defaults: [7.5, 7.5], min: 0, max: 40, step: 0.5, unit: 'px' },
  { id: 'surfaceMuted', group: 'palette', type: 'color', property: '--background-tertiary', defaults: ['#999999', '#777777'] },
  { id: 'switchColor', group: 'switch', fallback: 'accent', type: 'color', property: '--design-switch-color', defaults: ['#5e94bf', '#5e94bf'] },
  { id: 'switchOffColor', group: 'switch', fallback: 'surfaceMuted', type: 'color', property: '--design-switch-off-color', defaults: ['#999999', '#777777'] },
  { id: 'switchThumbColor', group: 'switch', fallback: 'buttonText', type: 'color', property: '--design-switch-thumb-color', defaults: ['#ffffff', '#ffffff'] },
  { id: 'switchRadius', group: 'switch', type: 'number', property: '--design-switch-radius', defaults: [2, 2], min: 0, max: 100, step: 0.5, unit: 'px' },
  { id: 'switchThumbRadius', group: 'switch', type: 'number', property: '--design-switch-thumb-radius', defaults: [2, 2], min: 0, max: 100, step: 0.5, unit: 'px' },
  { id: 'sidebarWidth', group: 'sidebar', type: 'number', property: '--design-sidebar-width', defaults: [250, 250], ...sidebarWidthLimits, unit: 'px' },
  { id: 'logoPosition', group: 'sidebar', type: 'select', property: '--design-logo-position', defaults: ['beside', 'beside'], options: ['beside', 'below', 'centered'] },
  { id: 'logoGap', group: 'sidebar', type: 'number', property: '--design-logo-gap', defaults: [32, 32], min: 0, max: 80, unit: 'px' },
  { id: 'logoScale', group: 'sidebar', type: 'number', property: '--design-logo-scale', defaults: [100, 100], min: 50, max: 100, unit: '%' },
  { id: 'buttonShadowOpacity', group: 'button', fallback: 'shadowOpacity', type: 'number', property: '--design-button-shadow-opacity', defaults: [20, 20], min: 0, max: 100, unit: '%' },
  { id: 'cardShadowOpacity', group: 'card', fallback: 'shadowOpacity', type: 'number', property: '--design-card-shadow-opacity', defaults: [20, 20], min: 0, max: 100, unit: '%' },
  { id: 'buttonShadow', group: 'button', type: 'number', property: '--design-button-shadow-size', defaults: [0, 0], min: 0, max: 32, unit: 'px' },
  { id: 'buttonInset', group: 'button', type: 'number', property: '--design-button-inset-size', defaults: [0, 0], min: 0, max: 24, unit: 'px' },
  { id: 'cardShadow', group: 'card', type: 'number', property: '--design-card-shadow-size', defaults: [0, 0], min: 0, max: 32, unit: 'px' },
  { id: 'shadowOpacity', group: 'effects', type: 'number', property: '--design-shadow-opacity', defaults: [20, 20], min: 0, max: 100, unit: '%' },
  { id: 'scrollbarColor', group: 'scrollbars', type: 'color', property: '--design-scrollbar-color', defaults: ['#777777', '#999999'] },
  { id: 'scrollbarWidth', group: 'scrollbars', type: 'number', property: '--design-scrollbar-width', defaults: [4, 4], min: 2, max: 8, unit: 'px' },
  { id: 'scrollbarPadding', group: 'scrollbars', type: 'number', property: '--design-scrollbar-padding', defaults: [0, 0], min: 0, max: 12, unit: 'px' },
  { id: 'scrollbarRadius', group: 'scrollbars', type: 'number', property: '--design-scrollbar-radius', defaults: [0, 0], min: 0, max: 20, step: 0.5, unit: 'px' },
  { id: 'scrollbarIdle', group: 'scrollbars', type: 'number', property: '--design-scrollbar-idle', defaults: [10, 10], min: 0, max: 100, unit: '%' },
  { id: 'scrollbarFade', group: 'scrollbars', type: 'number', property: '--design-scrollbar-fade', defaults: [200, 200], min: 0, max: 2000, unit: 'ms' },
  { id: 'scrollbarHighlightOpacity', group: 'scrollbars', type: 'number', property: '--design-scrollbar-highlight-opacity', defaults: [0, 0], min: 0, max: 100, unit: '%' },
  { id: 'animationDuration', group: 'motion', type: 'number', property: '--design-animation-duration', defaults: [200, 200], min: 0, max: 1000, unit: 'ms' },
  ...gradientTargets.flatMap((target): TField[] => [
    { id: `${target}GradientColor`, group: target, type: 'color', property: `--design-${target}-gradient-color`, defaults: ['#ffffff', '#000000'] },
    { id: `${target}GradientStrength`, group: target, type: 'number', property: `--design-${target}-gradient-strength`, defaults: [0, 0], min: 0, max: 100, unit: '%' },
    { id: `${target}GradientAngle`, group: target, type: 'number', property: `--design-${target}-gradient-angle`, defaults: [180, 180], min: 0, max: 360, unit: 'deg' },
  ]),
];

export const appearanceValue = (values: TAppearance, field: TField, mode: TAppearanceMode) =>
  values[field.id] ?? values[field.fallback ?? ''] ?? field.defaults[mode === 'dark' ? 1 : 0];

const storageKey = 'bitbox.desktop-appearance';
const sanitize = (value: unknown): TAppearance => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const input = value as Record<string, unknown>;
  return Object.fromEntries(appearanceFields.flatMap(field => {
    const item = input[field.id];
    const valid = (field.type === 'select' ? typeof item === 'string' && field.options.includes(item) : field.type === 'color'
      ? typeof item === 'string' && /^#[0-9a-f]{6}$/i.test(item)
      : typeof item === 'number' && Number.isFinite(item) && item >= field.min && item <= field.max &&
        Number.isInteger(item / (field.step ?? 1)));
    return valid ? [[field.id, item as string | number]] : [];
  }));
};

const appearancePart = (values: TAppearance, colors: boolean): TAppearance =>
  Object.fromEntries(appearanceFields.filter(field => (field.type === 'color') === colors && values[field.id] !== undefined)
    .map(field => [field.id, values[field.id]!]));

export const mergeAppearance = (profiles: TAppearanceProfiles, mode: TAppearanceMode, input: TAppearance) => {
  const values = sanitize(input);
  const shared = appearancePart(values, false);
  return {
    light: { ...shared, ...appearancePart(mode === 'light' ? values : profiles.light, true) },
    dark: { ...shared, ...appearancePart(mode === 'dark' ? values : profiles.dark, true) },
  };
};

export const readAppearance = (): TAppearanceProfiles => {
  try {
    const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const profiles = { light: sanitize(data?.light), dark: sanitize(data?.dark) };
    // Resolve shared values consistently, preserving choices present in only one palette.
    return mergeAppearance(profiles, 'light', { ...appearancePart(profiles.dark, false), ...profiles.light });
  } catch {
    return { light: {}, dark: {} };
  }
};

export const saveAppearanceProfiles = (profiles: TAppearanceProfiles) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
};

export const saveAppearance = (mode: TAppearanceMode, values: TAppearance) =>
  saveAppearanceProfiles(mergeAppearance(readAppearance(), mode, values));

export type TAppearancePreset = { profiles: TAppearanceProfiles };
export const presetSizeLimit = 64 * 1024;

export const serializeAppearancePreset = (profiles: TAppearanceProfiles) =>
  JSON.stringify({ format: 'bitbox-design', version: 1, profiles }, null, 2);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const parseAppearancePreset = (text: string): TAppearancePreset => {
  if (text.length > presetSizeLimit) {
    throw new Error('Preset too large');
  }
  const data: unknown = JSON.parse(text);
  if (!isRecord(data) || data.format !== 'bitbox-design' || data.version !== 1 || !isRecord(data.profiles) ||
      !isRecord(data.profiles.light) || !isRecord(data.profiles.dark)) {
    throw new Error('Invalid preset');
  }
  const profiles = { light: sanitize(data.profiles.light), dark: sanitize(data.profiles.dark) };
  if (Object.keys(profiles.light).length !== Object.keys(data.profiles.light).length ||
      Object.keys(profiles.dark).length !== Object.keys(data.profiles.dark).length) {
    throw new Error('Invalid appearance values');
  }
  return {
    profiles: mergeAppearance(profiles, 'light', { ...appearancePart(profiles.dark, false), ...profiles.light }),
  };
};

export const applyAppearance = (input: TAppearance, mode: TAppearanceMode) => {
  const values = sanitize(input);
  const style = document.body.style;
  appearanceFields.forEach(field => {
    const value = values[field.id];
    if (value === undefined) {
      style.removeProperty(field.property);
    } else {
      style.setProperty(field.property, `${value}${field.type === 'number' ? field.unit : ''}`);
    }
  });
  // Semantic aliases are inherited as computed values; update them alongside the accent.
  ['--color-primary', '--background-blue', '--color-blue-rgb'].forEach(property => style.removeProperty(property));
  const accent = values.accent;
  if (typeof accent === 'string') {
    style.setProperty('--color-primary', accent);
    style.setProperty('--background-blue', accent);
    style.setProperty('--color-blue-rgb', [1, 3, 5].map(index => parseInt(accent.slice(index, index + 2), 16)).join(', '));
  }
  gradientTargets.forEach(target => {
    const color = values[`${target}GradientColor`] ?? (mode === 'dark' ? '#000000' : '#ffffff');
    const strength = values[`${target}GradientStrength`] ?? 0;
    const angle = values[`${target}GradientAngle`] ?? 180;
    style.setProperty(`--design-${target}-gradient`, Number(strength) > 0
      ? `linear-gradient(${angle}deg, transparent, color-mix(in srgb, ${color} ${strength}%, transparent))` : 'none');
  });
  document.body.dataset.desktopScrollEdgeEffect = String(values.scrollEdgeEffect ?? 'none');
  document.body.dataset.desktopLogoPosition = String(values.logoPosition ?? 'beside');
  window.dispatchEvent(new Event('bitbox-chrome-layout'));
};
