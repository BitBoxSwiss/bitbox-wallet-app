// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';

export type TFrontendConfig = Readonly<{
  guideShown?: boolean;
  hideAmounts?: boolean;
  darkmode?: boolean;
  expertFee?: boolean;
  coinControl?: boolean;
  selectedExchangeRegion?: string;
  hideEnableRememberWalletDialog?: boolean;
  hasUsedWalletConnect?: boolean;
  bitsuranceNotifyCancellation?: string[];

  skipBitrefillWidgetDisclaimer?: boolean;
  skipBTCDirectWidgetDisclaimer?: boolean;
  skipBTCDirectOTCDisclaimer?: boolean;
  skipMoonpayDisclaimer?: boolean;
  skipPocketDisclaimer?: boolean;
  skipBitsuranceDisclaimer?: boolean;
} & Record<string, unknown>>;

export type TConfig = {
  readonly backend: Readonly<Record<string, unknown>>;
  readonly frontend: TFrontendConfig;
};

/**
 * Fetch current config from the backend.
 */
export const getConfig = (): Promise<Partial<TConfig>> => {
  return apiGet('config');
};

/**
 * Post a config object to the backend.
 */
export const setConfig = (config: Partial<TConfig>): Promise<void> => {
  return apiPost('config', config);
};
