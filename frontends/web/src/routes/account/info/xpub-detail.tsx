// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Message } from '@/components/message/message';
import { useLoad } from '@/hooks/api';
import { getInfo, TAccount, AccountCode, ScriptType, TSigningConfiguration } from '@/api/account';
import { findAccount } from '@/routes/account/utils';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { isBitcoinBased } from '@/routes/account/utils';
import { BitcoinBasedAccountInfoGuide } from './guide';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { SigningConfiguration } from './signingconfiguration';
import style from './info.module.css';

type TProps = {
  accounts: TAccount[];
  code: AccountCode;
};

export const getDefaultSigningConfigurationIndex = (
  signingConfigurations: TSigningConfiguration[],
  receiveScriptType: ScriptType | undefined,
): number => {
  if (!receiveScriptType) {
    return 0;
  }
  const index = signingConfigurations.findIndex(
    cfg => cfg.bitcoinSimple?.scriptType === receiveScriptType
  );
  return index === -1 ? 0 : index;
};

export const XPubDetail = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const infoResponse = useLoad(getInfo(code));
  const info = infoResponse?.success ? infoResponse.info : undefined;
  const [viewXPub, setViewXPub] = useState<number | undefined>();

  useEffect(() => {
    setViewXPub(undefined);
  }, [code]);

  const account = findAccount(accounts, code);
  if (!account) {
    return null;
  }

  const signingConfigurations = info?.signingConfigurations ?? [];
  const numberOfXPubs = signingConfigurations.length;
  const defaultViewXPub = getDefaultSigningConfigurationIndex(
    signingConfigurations,
    account.receiveScriptType
  );
  const safeViewXPubIndex = (index: number | undefined) => (
    Math.max(0, Math.min(index ?? defaultViewXPub, numberOfXPubs - 1))
  );
  const safeViewXPub = safeViewXPubIndex(viewXPub);
  const config = signingConfigurations[safeViewXPub];
  const xpubTypes = signingConfigurations.map(cfg => cfg.bitcoinSimple?.scriptType);

  const showNextXPub = () => {
    setViewXPub(prev => (safeViewXPubIndex(prev) + 1) % numberOfXPubs);
  };

  const xpubType = xpubTypes[(safeViewXPub + 1) % numberOfXPubs];

  const showGuide = isBitcoinBased(account.coinCode);

  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <Header
            variant="navigation"
            hideSidebarToggler
            mobileBackButton
            onBack={() => navigate(-1)}
            title={t('accountInfo.accountDetails')}
          />
          <View fullscreen={false}>
            <ViewContent>
              {infoResponse && !infoResponse.success && (
                <>
                  <Message type="error">{infoResponse.errorMessage || t('genericError')}</Message>
                  <DesktopBackButton enableEsc>{t('button.back')}</DesktopBackButton>
                </>
              )}
              {config && (
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
                  <SigningConfiguration
                    key={safeViewXPub}
                    account={account}
                    code={code}
                    info={config}
                    signingConfigIndex={safeViewXPub}>
                    <DesktopBackButton enableEsc>
                      {t('button.back')}
                    </DesktopBackButton>
                  </SigningConfiguration>
                </div>
              )}
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
