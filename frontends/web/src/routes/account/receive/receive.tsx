// SPDX-License-Identifier: Apache-2.0

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoad } from '@/hooks/api';
import { UseBackButton } from '@/hooks/backbutton';
import * as accountApi from '@/api/account';
import { getScriptName, isEthereumBased } from '@/routes/account/utils';
import { CopyableInput } from '@/components/copy/Copy';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button, Radio } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Message } from '@/components/message/message';
import { ReceiveGuide } from './components/guide';
import { SignMessageDialog } from './components/sign-message-dialog';
import { Header } from '@/components/layout';
import { QRCode } from '@/components/qrcode/qrcode';
import { ArrowCirlceLeft, ArrowCirlceLeftActive, ArrowCirlceRight, ArrowCirlceRightActive } from '@/components/icon';
import { connectKeystore } from '@/api/keystores';
import style from './receive.module.css';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

type TAddressTypeDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  preselectedAddressType: number;
  availableScriptTypes?: accountApi.ScriptType[];
  insured: boolean;
  handleAddressTypeChosen: (addressType: number) => void;
};

const AddressTypeDialog = ({
  open,
  setOpen,
  preselectedAddressType,
  availableScriptTypes,
  insured,
  handleAddressTypeChosen,
}: TAddressTypeDialogProps) => {
  const { t } = useTranslation();
  const [addressType, setAddressType] = useState<number>(preselectedAddressType);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} medium title={t('receive.changeScriptType')} >
      <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleAddressTypeChosen(addressType);
      }}>
        {availableScriptTypes && availableScriptTypes.map((scriptType, i) => (
          <div key={scriptType}>
            <Radio
              checked={addressType === i}
              id={scriptType}
              name="scriptType"
              onChange={() => setAddressType(i)}
              title={getScriptName(scriptType)}>
              {t(`receive.scriptType.${scriptType}`)}
            </Radio>
            {scriptType === 'p2tr' && addressType === i && (
              <Message type="warning" className={style.messageContainer}>
                {t('receive.taprootWarning')}
              </Message>
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
      </form>
    </Dialog>
  );
};

// For BTC/LTC: all possible address types we want to offer to the user, ordered by priority (first one is default).
// Types that are not available in the addresses delivered by the backend should be ignored.
const scriptTypes: accountApi.ScriptType[] = ['p2wpkh', 'p2tr', 'p2wpkh-p2sh'];

// Find index in list of receive addresses that matches the given script type, or -1 if not found.
const getIndexOfMatchingScriptType = (
  receiveAddresses: accountApi.TReceiveAddressList[],
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
  const [addressTypeDialog, setAddressTypeDialog] = useState<boolean>(false);
  const [currentAddresses, setCurrentAddresses] = useState<accountApi.TReceiveAddress[]>();
  const [currentAddressIndex, setCurrentAddressIndex] = useState<number>(0);
  const [signMessageDialog, setSignMessageDialog] = useState<boolean>(false);

  const account = accounts.find(({ code: accountCode }) => accountCode === code);
  const insured = account?.bitsuranceStatus === 'active';

  // first array index: address types. second array index: unused addresses of that address type.
  const receiveAddresses = useLoad(accountApi.getReceiveAddressList(code));

  const availableScriptTypes = useRef<accountApi.ScriptType[]>();

  const hasManyScriptTypes = availableScriptTypes.current && availableScriptTypes.current.length > 1;

  useEffect(() => {
    if (receiveAddresses) {
      // All script types that are present in the addresses delivered by the backend. Will be empty for if there are no such addresses, e.g. in Ethereum.
      availableScriptTypes.current = scriptTypes.filter(sc => getIndexOfMatchingScriptType(receiveAddresses, sc) >= 0);
    }
  }, [receiveAddresses]);

  useEffect(() => {
    if (receiveAddresses && availableScriptTypes.current) {
      const scriptType = availableScriptTypes.current[addressType] as accountApi.ScriptType;
      let addressIndex = availableScriptTypes.current.length > 0 ? getIndexOfMatchingScriptType(receiveAddresses, scriptType) : 0;
      if (addressIndex === -1) {
        addressIndex = 0;
      }
      setCurrentAddressIndex(addressIndex);
      setCurrentAddresses(receiveAddresses[addressIndex]?.addresses);
    }
  }, [addressType, availableScriptTypes, receiveAddresses]);

  const handleAddressTypeChosen = (addressType: number) => {
    setActiveIndex(0);
    setAddressType(addressType);
    setAddressTypeDialog(false);
  };

  const verifyAddress = async (addressesIndex: number) => {
    if (!receiveAddresses || account === undefined) {
      return;
    }
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
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
      const addressesAtIndex = receiveAddresses[addressesIndex] as accountApi.TReceiveAddressList;
      const address = addressesAtIndex.addresses[activeIndex] as accountApi.TReceiveAddress;
      await accountApi.verifyAddress(code, address.addressID);
    } finally {
      setVerifying(false);
    }
  };

  const openSignMessage = async () => {
    if (account === undefined) {
      return;
    }
    // First connect the keystore before showing the sign message dialog
    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (!connectResult.success) {
      return;
    }
    setSignMessageDialog(true);
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
    address = (currentAddresses[activeIndex] as accountApi.TReceiveAddress).address;
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
                          <ArrowCirlceLeft />
                        ) : (
                          <ArrowCirlceLeftActive title={t('button.previous')} />
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
                          <ArrowCirlceRight />
                        ) : (
                          <ArrowCirlceRightActive title={t('button.next')} />
                        )}
                      </button>
                    )}
                  </div>
                  <CopyableInput disabled={true} value={address} flexibleHeight />
                  { (hasManyScriptTypes || insured) && (
                    <button
                      className={style.changeType}
                      onClick={() => setAddressTypeDialog(true)}>
                      {t('receive.changeScriptType')}
                    </button>
                  )}

                  <AddressTypeDialog
                    open={addressTypeDialog}
                    setOpen={setAddressTypeDialog}
                    preselectedAddressType={addressType}
                    availableScriptTypes={availableScriptTypes.current}
                    insured={insured}
                    handleAddressTypeChosen={handleAddressTypeChosen}
                  />

                  <div className="buttons">
                    <Button
                      disabled={verifying !== false}
                      onClick={() => verifyAddress(currentAddressIndex)}
                      primary>
                      {t('receive.verifyBitBox02')}
                    </Button>
                    <Button
                      disabled={verifying !== false}
                      onClick={openSignMessage}
                      secondary>
                      {t('receive.signMessage.button')}
                    </Button>
                    <BackButton enableEsc={!addressTypeDialog && !verifying && !signMessageDialog}>
                      {t('button.back')}
                    </BackButton>
                  </div>
                  { verifying && (
                    <div className={style.hide}></div>
                  )}
                  <Dialog
                    open={!!(account && verifying)}
                    title={t('receive.verifyBitBox02')}
                    // disable exit/escape for secure outputs like the BitBox02, where the dialog is
                    // dimissed by tapping the device
                    onClose={verifying === 'insecure' ? () => {
                      setVerifying(false);
                    } : undefined}
                    medium centered>
                    {account && (
                      <>
                        {verifying && (
                          <UseBackButton handler={() => {
                            if (verifying === 'insecure') {
                              setVerifying(false);
                            }
                            return false;
                          }} />
                        )}
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
                          <CopyableInput
                            value={address}
                            dataTestId="receive-address"
                            flexibleHeight
                          />
                        </div>
                      </>
                    )}
                  </Dialog>
                  {account && currentAddresses && currentAddresses[activeIndex] && (
                    <SignMessageDialog
                      open={signMessageDialog}
                      onClose={() => setSignMessageDialog(false)}
                      address={currentAddresses[activeIndex]}
                      accountCode={code}
                    />
                  )}
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
