// SPDX-License-Identifier: Apache-2.0

import { expect, type Page } from '@playwright/test';

type TStatusResponse = {
  synced: boolean;
};

type TTransactionsResponse = { success: false } | { success: true; list: unknown[] };

export const getAccountCodeFromUrl = (url: string): string => {
  const match = url.match(/#\/account\/([^/]+)/);
  if (!match?.[1]) {
    throw new Error(`Unable to extract account code from url: ${url}`);
  }
  return match[1];
};

export async function waitForAccountTransactions(
  page: Page,
  host: string,
  servewalletPort: number,
  accountCode: string,
  expectedCount: number,
  timeout: number = 20000
): Promise<void> {
  await expect.poll(async () => {
    const statusResponse = await page.request.get(
      `http://${host}:${servewalletPort}/api/account/${accountCode}/status`
    );
    if (!statusResponse.ok()) {
      return -1;
    }
    const status = (await statusResponse.json()) as TStatusResponse;
    if (!status.synced) {
      return -1;
    }

    const transactionsResponse = await page.request.get(
      `http://${host}:${servewalletPort}/api/account/${accountCode}/transactions`
    );
    if (!transactionsResponse.ok()) {
      return -1;
    }
    const transactions = (await transactionsResponse.json()) as TTransactionsResponse;
    return transactions.success ? transactions.list.length : -1;
  }, {
    timeout,
    message: `Timed out waiting for ${expectedCount} transactions on account ${accountCode}`,
  }).toBe(expectedCount);
}
