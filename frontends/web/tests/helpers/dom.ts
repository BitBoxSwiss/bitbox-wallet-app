// SPDX-License-Identifier: Apache-2.0

import { Page, Locator, expect } from '@playwright/test';

/**
 * Finds elements by attribute key/value and asserts the expected count.
 *
 * @param page - Playwright page
 * @param attrKey - The attribute key to select
 * @param attrValue - The value of the attribute to match
 * @param expectedCount - Expected number of elements
 */
export async function assertFieldsCount(
  page: Page,
  attrKey: string,
  attrValue: string,
  expectedCount: number
) {
  const locator = page.locator(`[${attrKey}="${attrValue}"]`);
  await expect(locator).toHaveCount(expectedCount);
}

/**
 * Click a button by its visible text.
 * Works for "Continue", "Create wallet", "Get started", etc.
 */
export async function clickButtonWithText(page: Page, text: string) {
  const button = page.locator('button', { hasText: text });
  await button.click();
}

/**
 * Type a string into the currently focused input.
 */
export async function typeIntoFocusedInput(page: Page, text: string) {
  await page.keyboard.type(text);
}

/**
 * Click all agreement labels (for="agreement1" … for="agreement5").
 */
export async function clickAllAgreements(page: Page, max = 5, timeout = 5000) {
  for (let i = 1; i <= max; i++) {
    const label = page.locator(`label[for="agreement${i}"]`);
    await label.waitFor({ state: 'visible', timeout }); // wait until it's visible
    await label.click();
  }
}




/**
 * Returns a locator for an <a> element with the specified href.
 * @param page - Playwright page
 * @param href - Value of the href attribute to match
 */
export function getLinkByHref(page: Page, href: string): Locator {
  return page.locator(`a[href="${href}"]`);
}


/**
 * Returns a locator for elements whose class contains a given substring.
 *
 * @param page - Playwright page
 * @param classSubstring - Substring to match in the class attribute
 * @param tag - Optional tag name to match (default: 'div')
 */
export function getElementByClassSubstring(
  page: Page,
  classSubstring: string,
  tag: string = 'div'
): Locator {
  return page.locator(`${tag}[class*="${classSubstring}"]`);
}

