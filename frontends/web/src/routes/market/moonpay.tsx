// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useParams } from 'wouter';
import { useLoad } from '@/hooks/api';
import { useAppState } from '@/contexts/app-state-context';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import type { AccountCode } from '@/api/account';
import { useConfig } from '@/contexts/ConfigProvider';
import { getMoonpayBuyInfo } from '@/api/market';
import { MarketGuide } from './guide';
import { Header } from '@/components/layout';
import { Message } from '@/components/message/message';
import { Spinner } from '@/components/spinner/Spinner';
import { findAccount } from '@/routes/account/utils';
import { isBitcoinOnly } from '@/utils/coin';
import { MoonpayTerms } from '@/components/terms/moonpay-terms';
import { useMarketIframeActive } from '@/hooks/vendor-iframe-active';
import { useVendorIframeResizeHeight } from '@/hooks/vendor-iframe-resize-height';
import { useVendorTerms } from '@/hooks/vendor-iframe-terms';
import style from './iframe.module.css';


type TRouteParams = {
  code: AccountCode;
};

export const Moonpay = () => {
  const { code = '' } = useParams<TRouteParams>();
  const { t } = useTranslation();
  const { config } = useConfig();
  const { activeAccounts } = useAppState();
  const { isDarkMode } = useDarkmode();

  const moonpay = useLoad(getMoonpayBuyInfo(code));

  const account = findAccount(activeAccounts, code);
  const { containerRef, height, iframeLoaded, onIframeLoad } = useVendorIframeResizeHeight();
  const { agreedTerms, setAgreedTerms } = useVendorTerms(config?.frontend.skipMoonpayDisclaimer ?? false);
  useMarketIframeActive(!!account && !!config && agreedTerms && moonpay?.success === true);

  if (!account || !config) {
    return null;
  }

  const hasOnlyBTCAccounts = activeAccounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  const title = t('generic.buy', { context: translationContext });

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header variant="navigation" mobileBackButton title={title} />
          </div>
          <div ref={containerRef} className={style.container}>
            { !agreedTerms ? (
              <MoonpayTerms
                account={account}
                onAgreedTerms={() => setAgreedTerms(true)}
              />
            ) : (
              <div style={{ height }}>
                <UseDisableBackButton />
                {(!moonpay || moonpay.success) && !iframeLoaded && <Spinner text={t('loading')} />}
                { moonpay?.success && (
                  <iframe
                    onLoad={() => {
                      onIframeLoad();
                    }}
                    title="Moonpay"
                    width="100%"
                    height={height}
                    frameBorder="0"
                    className={`${style.iframe || ''} ${!iframeLoaded && style.hide || ''}`}
                    allow="camera; payment"
                    src={`${moonpay.url}&colorCode=%235E94BF&theme=${isDarkMode ? 'dark' : 'light'}`}>
                  </iframe>
                )}
                { moonpay?.success === false && (
                  <Message type="error">
                    {moonpay.errorMessage || t('genericError')}
                  </Message>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketGuide vendor="moonpay" translationContext={translationContext} />
    </div>
  );
};
