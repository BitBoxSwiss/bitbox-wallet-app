// SPDX-License-Identifier: Apache-2.0

import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '@/contexts/AppContext';
import * as accountApi from '@/api/account';
import { setAccountReceiveScriptType } from '@/api/backend';
import { Header, Main } from '@/components/layout';
import { View, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { Button } from '@/components/forms';
import { Message } from '@/components/message/message';
import { alertUser } from '@/components/alert/Alert';
import { findAccount, getAddressURIPrefix } from '@/routes/account/utils';
import {
  handleVerifyAddressWithDeviceResult,
  verifyAddressWithDevice,
} from '@/routes/account/components/verify-address';
import { useReceiveAddresses } from './components/use-receive-addresses';
import { AddressCard } from './components/address-card';
import { VerifyPrompt } from './components/verify-prompt';
import { MoreOptions } from './components/more-options';
import { AddressCycler } from './components/address-cycler';
import { ScriptTypePicker } from './components/script-type-picker';
import style from './receive.module.css';

type TWrapperProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

type TProps = {
  account: accountApi.TAccount;
};

type TVerifyState = 'idle' | 'connecting' | 'verifying' | 'verified' | 'error';


export const Receive = ({ accounts, code }: TWrapperProps) => {
  const account = findAccount(accounts, code);
  if (!account) {
    return null;
  }
  return <ReceiveInner account={account} />;
};

const ReceiveInner = ({ account }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isTesting } = useContext(AppContext);
  const { code, receiveScriptType } = account;

  const {
    availableScriptTypes,
    addressTypeIndex,
    setAddressTypeIndex,
    activeIndex,
    setActiveIndex,
    addresses,
    currentAddress,
    hasMultipleScriptTypes,
    hasMultipleAddresses,
  } = useReceiveAddresses(code, receiveScriptType);

  const [verifyState, setVerifyState] = useState<TVerifyState>('idle');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useEffect(() => {
    setVerifyState('idle');
  }, [code, addressTypeIndex]);

  const handleVerify = useCallback(async () => {
    if (!currentAddress) {
      return;
    }
    setVerifyState('connecting');
    const result = await verifyAddressWithDevice({
      code,
      addressID: currentAddress.addressID,
      rootFingerprint: account.keystore.rootFingerprint,
      onSecureVerificationStart: () => setVerifyState('verifying'),
    });
    handleVerifyAddressWithDeviceResult(result, {
      onUserAbort: () => setVerifyState('error'),
      onConnectFailed: () => setVerifyState('error'),
      onSkipDeviceVerification: () => setVerifyState('verified'),
      onVerified: () => setVerifyState('verified'),
      onVerifyFailed: () => setVerifyState('error'),
    });
  }, [code, currentAddress, account]);

  const handleScriptTypeChange = useCallback(async (nextIndex: number) => {
    const scriptType = availableScriptTypes[nextIndex];
    if (!scriptType || nextIndex === addressTypeIndex) {
      return;
    }
    setAddressTypeIndex(nextIndex);
    if (receiveScriptType === scriptType) {
      return;
    }
    try {
      const response = await setAccountReceiveScriptType(code, scriptType);
      if (!response.success) {
        alertUser(response.errorMessage || t('genericError'));
      }
    } catch (err) {
      console.error('Failed to persist receive script type', err);
    }
  }, [availableScriptTypes, addressTypeIndex, setAddressTypeIndex, receiveScriptType, code, t]);

  const uriPrefix = getAddressURIPrefix(account.coinCode);
  const isVerifying = verifyState === 'verifying';

  return (
    <Main>
      <Header hideSidebarToggler title={
        <>
          <h2 className="hide-on-small">{t('receive.title', { accountName: account.coinName })}</h2>
          <MobileHeader
            onClick={() => navigate(-1)}
            title={t('receive.title', { accountName: account.coinName })}
          />
        </>
      } />
      <View>
        <ViewContent>
          {currentAddress && addresses && (
            <div className={style.content}>
              <div className={style.alwaysVerify}>
                <Message type="info">
                  <p className={style.alwaysVerifyTitle}>{t('receive.alwaysVerifyTitle')}</p>
                  <p className={style.alwaysVerifyBody}>{t('receive.alwaysVerifyBody')}</p>
                </Message>
              </div>
              <AddressCard
                currentAddress={currentAddress}
                uriPrefix={uriPrefix}
                isVerifying={isVerifying}
              />

              {isVerifying ? (
                <VerifyPrompt isTesting={isTesting} />
              ) : (
                <>
                  {(hasMultipleAddresses || hasMultipleScriptTypes) && (
                    <MoreOptions
                      open={showMoreOptions}
                      onToggle={() => setShowMoreOptions(prev => !prev)}
                    >
                      {hasMultipleAddresses && (
                        <AddressCycler
                          addresses={addresses}
                          activeIndex={activeIndex}
                          onIndexChange={setActiveIndex}
                        />
                      )}
                      {hasMultipleScriptTypes && (
                        <ScriptTypePicker
                          availableScriptTypes={availableScriptTypes}
                          selectedIndex={addressTypeIndex}
                          onChange={handleScriptTypeChange}
                        />
                      )}
                    </MoreOptions>
                  )}

                  <div className={style.actions}>
                    <Button
                      secondary
                      className={style.backButton}
                      onClick={() => navigate(-1)}
                    >
                      {t('button.back')}
                    </Button>
                    <Button primary onClick={handleVerify}>
                      {t('receive.verifyBitBox02')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </ViewContent>
      </View>
    </Main>
  );
};
