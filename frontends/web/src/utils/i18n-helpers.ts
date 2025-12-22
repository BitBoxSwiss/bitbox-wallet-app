import { TEntryProp } from '@/components/guide/entry';
type TFunction = ReturnType<typeof import('react-i18next').useTranslation>['t'];

/**
 * Type guard to verify that an object matches the TEntryProp structure.
 * This performs runtime validation to ensure type safety.
 *
 * @param obj - The object to validate
 * @returns True if the object is a valid TEntryProp
 */
function isTEntryProp(obj: unknown): obj is TEntryProp {
  // Must be an object (not null, not undefined, not primitive)
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  // Must have 'title' property that is a string
  if (!('title' in obj) || typeof (obj as Record<string, unknown>).title !== 'string') {
    return false;
  }

  // Must have 'text' property that is a string
  if (!('text' in obj) || typeof (obj as Record<string, unknown>).text !== 'string') {
    return false;
  }

  // If 'link' exists, it must be an object with 'text' (string) and optionally 'url' (string)
  if ('link' in obj && (obj as Record<string, unknown>).link !== undefined) {
    const link = (obj as Record<string, unknown>).link;
    if (typeof link !== 'object' || link === null) {
      return false;
    }

    if (!('text' in link) || typeof (link as Record<string, unknown>).text !== 'string') {
      return false;
    }

    if ('url' in link) {
      if ((link as Record<string, unknown>).url !== undefined && typeof (link as Record<string, unknown>).url !== 'string') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Helper function to get guide entries from i18next with proper typing.
 * This fixes type compatibility issues with i18next@25.x which returns
 * $SpecialObject instead of the expected TEntryProp type.
 *
 * @param t - The translation function from useTranslation hook
 * @param key - The i18next translation key
 * @param options - Optional translation options (e.g., interpolation values)
 * @returns The translated entry object with TEntryProp type
 */
export const getGuideEntry = (t: TFunction, key: string, options?: Record<string, unknown>): TEntryProp => {
  const result = t(key, { ...options, returnObjects: true });

  if (!isTEntryProp(result)) {
    throw new Error(
      `Invalid guide entry structure for key "${key}". ` +
      `Expected object with 'title' and 'text' properties, but got: ${JSON.stringify(result)}`
    );
  }

  return result;
};
