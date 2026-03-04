// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { AccountCode, TAccount } from '@/api/account';
import { getConfig } from '@/utils/config';
import { getMoonpayBuyInfo } from '@/api/market';
import { MarketGuide } from './guide';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { findAccount, isBitcoinOnly } from '@/routes/account/utils';
import { MoonpayTerms } from '@/components/terms/moonpay-terms';
import { useVendorIframeShell } from '@/hooks/vendor-iframe';
import style from './iframe.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
};

export const Moonpay = ({ accounts, code }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();

  const config = useLoad(getConfig);
  const moonpay = useLoad(getMoonpayBuyInfo(code));

  const account = findAccount(accounts, code);
  const {
    agreedTerms,
    setAgreedTerms,
    iframeLoaded,
    onIframeLoad,
    containerRef,
    height,
  } = useVendorIframeShell({
    agreedByConfig: !!config?.frontend?.skipMoonpayDisclaimer,
  });

  if (!account || !config) {
    return null;
  }

  const hasOnlyBTCAccounts = accounts.every(({ coinCode }) => isBitcoinOnly(coinCode));
  const translationContext = hasOnlyBTCAccounts ? 'bitcoin' : 'crypto';

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer">
          <div className={style.header}>
            <Header title={
              <h2>
                {t('generic.buy', { context: translationContext })}
              </h2>
            } />
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
                {!iframeLoaded && <Spinner text={t('loading')} />}
                { moonpay && (
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
              </div>
            )}
          </div>
        </div>
      </div>
      <MarketGuide vendor="moonpay" translationContext={translationContext} />
    </div>
  );
};
