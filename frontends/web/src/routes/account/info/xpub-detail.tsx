// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { getInfo, TAccount, AccountCode } from '@/api/account';
import { findAccount } from '@/routes/account/utils';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { isBitcoinBased } from '@/routes/account/utils';
import { BitcoinBasedAccountInfoGuide } from './guide';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { BackButton } from '@/components/backbutton/backbutton';
import { SigningConfiguration } from './signingconfiguration';
import { Message } from '@/components/message/message';
import style from './info.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
};

export const XPubDetail = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const info = useLoad(getInfo(code));
  const [viewXPub, setViewXPub] = useState<number>(0);

  const account = findAccount(accounts, code);
  if (!account || !info) {
    return null;
  }

  const numberOfXPubs = info.signingConfigurations.length;
  if (numberOfXPubs === 0) {
    return null;
  }
  const safeViewXPub = Math.max(0, Math.min(viewXPub, numberOfXPubs - 1));
  const config = info.signingConfigurations[safeViewXPub];
  if (!config) {
    return null;
  }
  const xpubTypes = info.signingConfigurations.map(cfg => cfg.bitcoinSimple?.scriptType);

  const showNextXPub = () => {
    setViewXPub(prev => (prev + 1) % numberOfXPubs);
  };

  const xpubType = xpubTypes[(safeViewXPub + 1) % numberOfXPubs];

  const showGuide = isBitcoinBased(account.coinCode);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header hideSidebarToggler title={
            <>
              <h2 className="hide-on-small">{t('accountInfo.accountDetails')}</h2>
              <MobileHeader onClick={() => navigate(-1)} title={t('accountInfo.accountDetails')} />
            </>
          } />
          <View fullscreen={false}>
            <ViewContent>
              <div className={style.detailCard}>
                {(config?.bitcoinSimple !== undefined && numberOfXPubs > 1) && (
                  <p>
                    {t('accountInfo.xpubTypeInfo', {
                      current: `${safeViewXPub + 1}`,
                      numberOfXPubs: numberOfXPubs.toString(),
                      scriptType: config.bitcoinSimple.scriptType.toUpperCase(),
                    })}
                    <br />
                    {xpubType && (
                      <button className={style.nextButton} onClick={showNextXPub}>
                        {t(`accountInfo.xpubTypeChangeBtn.${xpubType}`)}
                      </button>
                    )}
                  </p>
                )}
                {(config?.bitcoinSimple?.scriptType === 'p2tr') ? (
                  <>
                    <Message type="info">
                      {t('accountInfo.taproot')}
                    </Message>
                    <div className="buttons hide-on-small">
                      <BackButton enableEsc>
                        {t('button.back')}
                      </BackButton>
                    </div>
                  </>
                ) : (
                  <SigningConfiguration
                    key={safeViewXPub}
                    account={account}
                    code={code}
                    info={config}
                    signingConfigIndex={safeViewXPub}>
                    <span className="hide-on-small">
                      <BackButton enableEsc>
                        {t('button.back')}
                      </BackButton>
                    </span>
                  </SigningConfiguration>
                )}
              </div>
            </ViewContent>
          </View>
        </Main>
      </GuidedContent>
      {showGuide && (
        <BitcoinBasedAccountInfoGuide coinName={account.coinName} />
      )}
    </GuideWrapper>
  );
};
