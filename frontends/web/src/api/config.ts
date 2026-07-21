// SPDX-License-Identifier: Apache-2.0

import { apiGet, apiPost } from '@/utils/request';
import type { Fiat } from '@/api/account';
import type { BtcUnit } from '@/api/coins';
import type { TPortfolioPercentageType } from '@/contexts/AppContext';

type TElectrumServerInfo = Readonly<{
  server: string;
  tls: boolean;
  pemCert: string;
}>;

type TBtcCoinConfig = Readonly<{
  electrumServers: TElectrumServerInfo[];
}>;

/** BTC-based coin keys in backend config (see backend/config/config.go). */
export type TConfigBackendBtcCoinKey = 'btc' | 'tbtc' | 'ltc' | 'tltc';

// Mirrors backend/config/config.go ethCoinConfig: DeprecatedActiveERC20Tokens (JSON key
// "activeERC20Tokens"). Deprecated — ERC20 activation is per-account in accounts config; kept
// for migration / compatibility with persisted app config.
type TEthCoinConfig = Readonly<{
  activeERC20Tokens: string[];
}>;

export type TConfigBackendProxy = Readonly<{
  useProxy: boolean;
  proxyAddress: string;
}>;

/** Keys used by NewBadge to mark UI elements as seen. */
export type TConfigFrontendBadgeKey =
  | 'hasSeenMarketplaceNudge'
  | 'hasSeenSwapMarketTab'
  | 'hasSeenOtcMarketTab';

/** Dynamic frontend keys written when dismissing Status banners. */
type TConfigFrontendDismissibleDynamicKey =
  | `update-${string}`
  | `banner-backup-${string}`
  | `banner-${string}-${string}`;

/** Known static frontend keys written when dismissing Status banners. */
type TConfigFrontendDismissibleKnownKey =
  | 'walletConnectDisclaimerDismissed'
  | 'skipTestingWarning'
  | 'mobile-data-warning';

export type TConfigFrontendDismissibleKey =
  | TConfigFrontendDismissibleKnownKey
  | TConfigFrontendDismissibleDynamicKey;

export type TConfigFrontend = Readonly<{
  guideShown?: boolean;
  hideAmounts?: boolean;
  portfolioPercentageType?: TPortfolioPercentageType;
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
  [key in TConfigFrontendDismissibleDynamicKey]?: boolean;
}>;

export type TConfigBackend = Readonly<{
  proxy: TConfigBackendProxy;
  /**
   * Deprecated global coin activation flags (backend/config/config.go: DeprecatedBitcoinActive,
   * DeprecatedLitecoinActive, DeprecatedEthereumActive). Coins are configured per account now;
   * kept for migration / compatibility with persisted app config.
   */
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
  readonly backend: TConfigBackend;
  readonly frontend: TConfigFrontend;
};

/**
 * Fetch config from the backend (see handlers.getAppConfig).
 * Use setConfig from @/utils/config for partial merge-on-write updates.
 */
export const getConfig = (): Promise<TConfig> => apiGet('config');

/**
 * Post a config object to the backend.
 */
export const setConfig = (config: TConfig): Promise<void> => {
  return apiPost('config', config);
};
