// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import type { FailResponse, SuccessResponse, TSuccess } from './response';
import type { AccountCode } from './account';

export const getNativeLocale = (): Promise<string> => {
  return apiGet('native-locale');
};

export type TNumberFormat = {
  decimal: string;
  group: string;
} | null;

export const getNumberFormat = (): Promise<TNumberFormat> => {
  return apiGet('number-format');
};

type TNotifyUserResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

type TOpenResponse = {
  success: true;
} | {
  success: false;
  errorMessage: string;
};

export const notifyUser = (text: string): Promise<TNotifyUserResponse> => {
  return apiPost('notify-user', { text });
};

export const open = (href: string): Promise<TOpenResponse> => {
  return apiPost('open', href);
};

export const exportLogs = (): Promise<TSuccess> => {
  return apiPost('export-log');
};

export const clearCache = (): Promise<TSuccess> => {
  return apiPost('clear-cache');
};

type TExportNotesResponse = (FailResponse & {
  aborted: boolean;
}) | SuccessResponse;

export const exportNotes = (): Promise<TExportNotesResponse> => {
  return apiPost('notes/export');
};

type TImportNotes = {
  accountCount: number;
  transactionCount: number;
};

export const importNotes = (
  fileContents: ArrayBuffer,
): Promise<FailResponse | (SuccessResponse & { data: TImportNotes })> => {
  const hexString = Array.from(new Uint8Array(fileContents))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  return apiPost('notes/import', hexString);
};

export type TExportBalanceStatementResponse = (FailResponse & {
  aborted: boolean;
  errorCode?: string;
}) | SuccessResponse;

export const exportBalanceStatement = (
  accountCodes: AccountCode[],
  snapshotDate: string,
  numberFormat: NonNullable<TNumberFormat>,
): Promise<TExportBalanceStatementResponse> => {
  return apiPost('accounts/balance-statement/export', { accountCodes, snapshotDate, numberFormat });
};
