// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import type { Fiat } from '@/api/account';
import type { BtcUnit } from '@/api/coins';

export type TElectrumServerInfo = Readonly<{
  server: string;
  tls: boolean;
  pemCert: string;
}>;

export type TBtcCoinConfig = Readonly<{
  electrumServers: TElectrumServerInfo[];
}>;

export type TEthCoinConfig = Readonly<{
  activeERC20Tokens: string[];
} & Record<string, unknown>>;

export type TProxyConfig = Readonly<{
  useProxy: boolean;
  proxyAddress: string;
}>;

export type TBackendConfig = Readonly<{
  proxy: TProxyConfig;
  bitcoinActive: boolean;
  litecoinActive: boolean;
  ethereumActive: boolean;
  authentication: boolean;
  btc: TBtcCoinConfig;
  tbtc: TBtcCoinConfig;
  rbtc: TBtcCoinConfig;
  ltc: TBtcCoinConfig;
  tltc: TBtcCoinConfig;
  eth: TEthCoinConfig;
  teth: Record<string, never>;
  reth: Record<string, never>;
  fiatList: Fiat[];
  mainFiat: Fiat;
  userLanguage: string;
  btcUnit: BtcUnit;
  startInTestnet: boolean;
  gapLimitReceive: number;
  gapLimitChange: number;
} & Record<string, unknown>>;

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
  readonly backend: TBackendConfig;
  readonly frontend: TFrontendConfig;
};

export type TConfigUpdate = {
  backend?: (Omit<Partial<TBackendConfig>, 'userLanguage'> & { userLanguage?: string | null });
  frontend?: Partial<TFrontendConfig> & Record<string, unknown>;
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
