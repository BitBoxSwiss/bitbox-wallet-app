/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../hooks/api';
import { useEsc } from '../../../hooks/keyboard';
import * as accountApi from '../../../api/account';
import { route } from '../../../utils/route';
import { getScriptName, isEthereumBased } from '../utils';
import { CopyableInput } from '../../../components/copy/Copy';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button, ButtonLink, Radio } from '../../../components/forms';
import { Message } from '../../../components/message/message';
import { ReceiveGuide } from './components/guide';
import { Header } from '../../../components/layout';
import { QRCode } from '../../../components/qrcode/qrcode';
import { ArrowCirlceLeft, ArrowCirlceLeftActive, ArrowCirlceRight, ArrowCirlceRightActive } from '../../../components/icon';
import style from './receive.module.css';

type TProps = {
  accounts: accountApi.IAccount[];
  code: accountApi.AccountCode;
};

type AddressDialog = { addressType: number } | undefined;

// For BTC/LTC: all possible address types we want to offer to the user, ordered by priority (first one is default).
// Types that are not available in the addresses delivered by the backend should be ignored.
const scriptTypes: accountApi.ScriptType[] = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh'];

// Find index in list of receive addresses that matches the given script type, or -1 if not found.
const getIndexOfMatchingScriptType = (
  receiveAddresses: accountApi.ReceiveAddressList[],
  scriptType: accountApi.ScriptType
): number => {
  if (!receiveAddresses) {
    return -1;
  }
  return receiveAddresses.findIndex(addrs => addrs.scriptType !== null && scriptType === addrs.scriptType);
};

export const Receive = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const [verifying, setVerifying] = useState<false | 'secure' | 'insecure'>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  // index into `availableScriptTypes`, or 0 if none are available.
  const [addressType, setAddressType] = useState<number>(0);
  const [addressDialog, setAddressDialog] = useState<AddressDialog>();
  const [currentAddresses, setCurrentAddresses] = useState<accountApi.IReceiveAddress[]>();
  const [currentAddressIndex, setCurrentAddressIndex] = useState<number>(0);

  const account = accounts.find(({ code: accountCode }) => accountCode === code);
  const insured = account?.bitsuranceStatus === 'active';

  // first array index: address types. second array index: unused addresses of that address type.
  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code));

  const availableScriptTypes = useRef<accountApi.ScriptType[]>();

  const hasManyScriptTypes = availableScriptTypes.current && availableScriptTypes.current.length > 1;
  const scriptTypeDialogOpened = !!(addressDialog && (hasManyScriptTypes || insured));

  useEsc(() => !scriptTypeDialogOpened && !verifying && route(`/account/${code}`));

  useEffect(() => {
    if (receiveAddresses) {
      // All script types that are present in the addresses delivered by the backend. Will be empty for if there are no such addresses, e.g. in Ethereum.
      availableScriptTypes.current = scriptTypes.filter(sc => getIndexOfMatchingScriptType(receiveAddresses, sc) >= 0);
    }
  }, [receiveAddresses]);

  useEffect(() => {
    if (receiveAddresses && availableScriptTypes.current) {
      let addressIndex = availableScriptTypes.current.length > 0 ? getIndexOfMatchingScriptType(receiveAddresses, availableScriptTypes.current[addressType]) : 0;
      if (addressIndex === -1) {
        addressIndex = 0;
      }
      setCurrentAddressIndex(addressIndex);
      setCurrentAddresses(receiveAddresses[addressIndex].addresses);
    }
  }, [addressType, availableScriptTypes, receiveAddresses]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (addressDialog) {
      e.preventDefault();
      setActiveIndex(0);
      setAddressType(addressDialog.addressType);
      setAddressDialog(undefined);
    }
  };

  const verifyAddress = async (addressesIndex: number) => {
    if (!receiveAddresses || code === undefined) {
      return;
    }
    const connectResult = await accountApi.connectKeystore(code);
    if (!connectResult.success) {
      return;
    }

    const hasSecureOutput = await accountApi.hasSecureOutput(code)();
    if (!hasSecureOutput.hasSecureOutput) {
      setVerifying('insecure');
      // For the software keystore, the dialog is dismissed manually.
      return;
    }

    // For devices with a display, the dialog is dismissed by tapping the device.
    setVerifying('secure');
    try {
      await accountApi.verifyAddress(code, receiveAddresses[addressesIndex].addresses[activeIndex].addressID);
    } finally {
      setVerifying(false);
    }
  };

  const previous = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!verifying && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const next = (e: React.SyntheticEvent, numAddresses: number) => {
    e.preventDefault();
    if (!verifying && activeIndex < numAddresses - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  let uriPrefix = '';
  if (account) {
    if (account.coinCode === 'btc' || account.coinCode === 'tbtc') {
      uriPrefix = 'bitcoin:';
    } else if (account.coinCode === 'ltc' || account.coinCode === 'tltc') {
      uriPrefix = 'litecoin:';
    }
  }

  let address = '';
  if (currentAddresses) {
    address = currentAddresses[activeIndex].address;
    if (!verifying) {
      address = address.substring(0, 8) + '...';
    }
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('receive.title', { accountName: account?.coinName })}</h2>} />
          <div className="content narrow isVerticallyCentered">
            <div className="box large text-center">
              { currentAddresses && (
                <div style={{ position: 'relative' }}>
                  <div className={style.qrCodeContainer}>
                    <QRCode data={undefined} />
                  </div>
                  <div className={style.labels}>
                    { currentAddresses.length > 1 && (
                      <button
                        className={style.previous}
                        onClick={previous}>
                        {(verifying || activeIndex === 0) ? (
                          <ArrowCirlceLeft height="24" width="24" />
                        ) : (
                          <ArrowCirlceLeftActive height="24" width="24" title={t('button.previous')} />
                        )}
                      </button>
                    )}
                    <p className={style.label}>
                      {t('receive.label')} {currentAddresses.length > 1 ? `(${activeIndex + 1}/${currentAddresses.length})` : ''}
                    </p>
                    { currentAddresses.length > 1 && (
                      <button
                        className={style.next}
                        onClick={e => next(e, currentAddresses.length)}>
                        {(verifying || activeIndex >= currentAddresses.length - 1) ? (
                          <ArrowCirlceRight height="24" width="24" />
                        ) : (
                          <ArrowCirlceRightActive height="24" width="24" title={t('button.next')} />
                        )}
                      </button>
                    )}
                  </div>
                  <CopyableInput disabled={true} value={address} flexibleHeight />
                  { (hasManyScriptTypes || insured) && (
                    <button
                      className={style.changeType}
                      onClick={() => setAddressDialog(!addressDialog ? { addressType } : undefined)}>
                      {t('receive.changeScriptType')}
                    </button>
                  )}
                  <form onSubmit={handleSubmit}>
                    <Dialog open={scriptTypeDialogOpened} onClose={() => setAddressDialog(undefined)} medium title={t('receive.changeScriptType')} >
                      {availableScriptTypes.current && availableScriptTypes.current.map((scriptType, i) => (
                        <div key={scriptType}>
                          {addressDialog && (
                            <>
                              <Radio
                                checked={addressDialog.addressType === i}
                                id={scriptType}
                                name="scriptType"
                                onChange={() => setAddressDialog({ addressType: i })}
                                title={getScriptName(scriptType)}>
                                {t(`receive.scriptType.${scriptType}`)}
                              </Radio>
                              {scriptType === 'p2tr' && addressDialog.addressType === i && (
                                <Message type="warning">
                                  {t('receive.taprootWarning')}
                                </Message>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      {insured && (
                        <Message type="warning">
                          {t('receive.bitsuranceWarning')}
                        </Message>
                      )}
                      <DialogButtons>
                        <Button primary type="submit">
                          {t('button.done')}
                        </Button>
                      </DialogButtons>
                    </Dialog>
                  </form>
                  <div className="buttons">
                    <Button
                      disabled={verifying !== false}
                      onClick={() => verifyAddress(currentAddressIndex)}
                      primary>
                      {t('receive.verifyBitBox02')}
                    </Button>
                    <ButtonLink
                      secondary
                      to={`/account/${code}`}>
                      {t('button.back')}
                    </ButtonLink>
                  </div>
                  { verifying && (
                    <div className={style.hide}></div>
                  )}
                  <Dialog
                    open={!!(account && verifying)}
                    title={t('receive.verifyBitBox02')}
                    // disable escape for secure outputs like the BitBox02, where the dialog is
                    // dimissed by tapping the device
                    disableEscape={verifying === 'secure'}
                    onClose={verifying === 'insecure' ? () => {
                      setVerifying(false);
                    } : undefined}
                    medium centered>
                    {account && <>
                      <div className="text-center">
                        { isEthereumBased(account.coinCode) && (
                          <p>
                            <strong>
                              {t('receive.onlyThisCoin.warning', {
                                coinName: account.coinName,
                              })}
                            </strong><br />
                            {t('receive.onlyThisCoin.description')}
                          </p>
                        )}
                        <QRCode data={uriPrefix + address} />
                        <p>{t('receive.verifyInstruction')}</p>
                      </div>
                      <div className="m-bottom-half">
                        <CopyableInput value={address} flexibleHeight />
                      </div>
                    </>}
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ReceiveGuide
        hasMultipleAddresses={currentAddresses ? currentAddresses.length > 1 : false}
        hasDifferentFormats={receiveAddresses ? receiveAddresses.length > 1 : false}
      />
    </div>
  );
};
