// SPDX-License-Identifier: Apache-2.0

import { expect, type Page } from '@playwright/test';

type TStatusResponse = {
  synced: boolean;
};

type TTransactionsResponse = { success: false } | { success: true; list: unknown[] };
type TReceiveAddressResponse = Array<{
  scriptType: string | null;
  addresses: Array<{
    addressID: string;
    address: string;
    displayAddress: string;
  }>;
}>;

const receiveAddressScriptTypePreference = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh'];

export type TReceiveAddress = TReceiveAddressResponse[number]['addresses'][number];

export const getAccountCodeFromUrl = (url: string): string => {
  const match = url.match(/#\/account\/([^/]+)/);
  if (!match?.[1]) {
    throw new Error(`Unable to extract account code from url: ${url}`);
  }
  return match[1];
};

export async function getReceiveAddressData(
  page: Page,
  host: string,
  servewalletPort: number,
): Promise<TReceiveAddress> {
  await page.waitForURL(/#\/account\/[^/]+\/receive/);
  const accountCode = getAccountCodeFromUrl(page.url());
  const response = await page.request.get(
    `http://${host}:${servewalletPort}/api/account/${accountCode}/receive-addresses`
  );
  if (!response.ok()) {
    throw new Error(`Failed to fetch receive addresses for ${accountCode}: ${response.status()}`);
  }
  const body = (await response.json()) as TReceiveAddressResponse | null;
  if (!body || !Array.isArray(body)) {
    throw new Error(`Unexpected receive addresses response for ${accountCode}`);
  }
  for (const scriptType of receiveAddressScriptTypePreference) {
    const receiveAddress = body.find((item) => item.scriptType === scriptType)?.addresses?.[0];
    if (receiveAddress) {
      return receiveAddress;
    }
  }
  const fallback = body.find((item) => item.addresses?.[0]?.address)?.addresses[0];
  if (!fallback) {
    throw new Error(`No receive address available for ${accountCode}`);
  }
  return fallback;
}

export async function getReceiveAddress(
  page: Page,
  host: string,
  servewalletPort: number,
): Promise<string> {
  const receiveAddress = await getReceiveAddressData(page, host, servewalletPort);
  return receiveAddress.address;
}

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
