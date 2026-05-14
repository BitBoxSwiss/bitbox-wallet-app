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

/** BTC-based coin keys in backend config (see backend/config/config.go). */
export type TBtcCoinConfigKey = 'btc' | 'tbtc' | 'ltc' | 'tltc';

export type TEthCoinConfig = Readonly<{
  activeERC20Tokens: string[];
}>;

export type TProxyConfig = Readonly<{
  useProxy: boolean;
  proxyAddress: string;
}>;

/** Keys used by NewBadge to mark UI elements as seen. */
export type TFrontendBadgeConfigKey =
  | 'hasSeenMarketplaceNudge'
  | 'hasSeenSwapMarketTab'
  | 'hasSeenOtcMarketTab';

/** Dynamic frontend keys written when dismissing Status banners. */
export type TDynamicDismissibleFrontendKey =
  | `update-${string}`
  | `banner-backup-${string}`
  | `banner-${string}-${string}`;

/** Known static frontend keys written when dismissing Status banners. */
export type TKnownDismissibleFrontendConfigKey =
  | 'walletConnectDisclaimerDismissed'
  | 'skipTestingWarning'
  | 'mobile-data-warning';

export type TDismissibleFrontendConfigKey =
  | TKnownDismissibleFrontendConfigKey
  | TDynamicDismissibleFrontendKey;

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

  hasSeenMarketplaceNudge?: boolean;
  hasSeenSwapMarketTab?: boolean;
  hasSeenOtcMarketTab?: boolean;

  skipBitrefillWidgetDisclaimer?: boolean;
  skipBTCDirectWidgetDisclaimer?: boolean;
  skipBTCDirectOTCDisclaimer?: boolean;
  skipMoonpayDisclaimer?: boolean;
  skipPocketDisclaimer?: boolean;
  skipPocketOTCDisclaimer?: boolean;
  skipBitsuranceDisclaimer?: boolean;
  skipSwapkitDisclaimer?: boolean;

  walletConnectDisclaimerDismissed?: boolean;
  skipTestingWarning?: boolean;
  'mobile-data-warning'?: boolean;
}> & Readonly<{
  [key in TDynamicDismissibleFrontendKey]?: boolean;
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
}>;

export type TConfig = {
  readonly backend: TBackendConfig;
  readonly frontend: TFrontendConfig;
};

/** Partial backend config for updates; null clears userLanguage (see i18n.ts). */
export type TBackendConfigUpdate =
  Omit<Partial<TBackendConfig>, 'userLanguage'> & {
    userLanguage?: string | null;
  };

export type TFrontendConfigUpdate = Partial<TFrontendConfig>;

export type TConfigUpdate = {
  backend?: TBackendConfigUpdate;
  frontend?: TFrontendConfigUpdate;
};

/**
 * Fetch raw config from the backend. Keys may be missing; use getConfig from
 * @/utils/config for a normalized TConfig.
 */
export const getConfig = (): Promise<Partial<TConfig>> => {
  return apiGet('config');
};

/**
 * Post a config object to the backend.
 */
export const setConfig = (config: TConfig): Promise<void> => {
  return apiPost('config', config);
};
