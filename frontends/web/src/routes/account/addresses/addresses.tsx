// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { AccountCode, TAccount, TUsedAddress } from '@/api/account';
import { connectKeystore } from '@/api/keystores';
import { Header } from '@/components/layout';
import { BackButton } from '@/components/backbutton/backbutton';
import { Dialog } from '@/components/dialog/dialog';
import { QRCode } from '@/components/qrcode/qrcode';
import { CopyableInput } from '@/components/copy/Copy';
import { SignMessageDialog } from '../receive/components/sign-message-dialog';
import { Spinner } from '@/components/spinner/Spinner';
import style from './addresses.module.css';

type TProps = {
  code: AccountCode;
  accounts: TAccount[];
};

export const Addresses = ({ code, accounts }: TProps) => {
  const { t } = useTranslation();
  const account = accounts.find(acc => acc.code === code);

  const usedAddressesResponse = useLoad(() => accountApi.getUsedAddresses(code), [code]);

  const [verifying, setVerifying] = useState<false | 'secure' | 'insecure'>(false);
  const [verifyingAddress, setVerifyingAddress] = useState<string | null>(null);
  const [signMessageAddress, setSignMessageAddress] = useState<TUsedAddress | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  const isLoading = usedAddressesResponse === undefined;
  const usedAddresses = usedAddressesResponse?.success ? usedAddressesResponse.addresses : [];

  const handleVerify = async (address: TUsedAddress) => {
    if (!account) {
      return;
    }

    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (!connectResult.success) {
      return;
    }

    const hasSecureOutput = await accountApi.hasSecureOutput(code)();
    if (!hasSecureOutput.hasSecureOutput) {
      setVerifying('insecure');
      setVerifyingAddress(address.address);
      return;
    }

    setVerifying('secure');
    setVerifyingAddress(address.address);
    try {
      await accountApi.verifyAddress(code, address.addressID);
    } finally {
      setVerifying(false);
      setVerifyingAddress(null);
    }
  };

  const handleSignMessage = async (address: TUsedAddress) => {
    if (!account) {
      return;
    }

    const connectResult = await connectKeystore(account.keystore.rootFingerprint);
    if (!connectResult.success) {
      return;
    }

    setSignMessageAddress(address);
  };

  const getUriPrefix = (): string => {
    switch (account?.coinCode) {
    case 'btc':
    case 'tbtc':
      return 'bitcoin:';
    case 'ltc':
    case 'tltc':
      return 'litecoin:';
    default:
      return '';
    }
  };
  const uriPrefix = getUriPrefix();

  if (!account) {
    return null;
  }

  return (
    <div className="contentWithGuide">
      <div className="container">
        <div className="innerContainer scrollableContainer">
          <Header title={<h2>{t('addresses.title')}</h2>} />
          <div className="content padded">
            <p className={style.description}>
              {t('addresses.descriptionPart1')} <Link to={`/account/${code}/receive`}>{t('addresses.descriptionLink')}</Link>.
            </p>
            <div className="box large">
              {isLoading ? (
                <div className={style.loading}>
                  <Spinner text={t('loading')} />
                </div>
              ) : usedAddresses.length === 0 ? (
                <div className={style.empty}>
                  <p>{t('addresses.empty')}</p>
                </div>
              ) : (
                <div className={style.table}>
                  <div className={style.tableHeader}>
                    <div className={style.colAddress}>{t('addresses.column.address')}</div>
                    <div className={style.colCount}>{t('addresses.column.txCount')}</div>
                    <div className={style.colActions}>{t('addresses.column.actions')}</div>
                  </div>
                  {usedAddresses.map((addr) => (
                    <div key={addr.addressID} className={style.tableRow}>
                      <div className={style.colAddress}>
                        <CopyableInput
                          value={addr.address}
                          alignLeft
                          flexibleHeight
                          inputFieldClassName={style.addressInput}
                        />
                      </div>
                      <div className={style.colCount}>
                        <span className={style.mobileLabel}>{t('addresses.column.txCount')}: </span>
                        {addr.transactionCount}
                      </div>
                      <div className={style.colActions}>
                        <div
                          ref={openMenuId === addr.addressID ? menuRef : null}
                          className={style.menuContainer}
                        >
                          <button
                            className={style.menuButton}
                            onClick={() => setOpenMenuId(openMenuId === addr.addressID ? null : addr.addressID)}
                            disabled={verifying !== false}
                            aria-label={t('addresses.column.actions')}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="5" r="2" fill="currentColor"/>
                              <circle cx="12" cy="12" r="2" fill="currentColor"/>
                              <circle cx="12" cy="19" r="2" fill="currentColor"/>
                            </svg>
                          </button>
                          {openMenuId === addr.addressID && (
                            <div className={style.menuDropdown}>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleVerify(addr);
                                }}
                              >
                                {t('addresses.verify')}
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleSignMessage(addr);
                                }}
                              >
                                {t('addresses.signMessage')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="buttons">
                <BackButton>
                  {t('button.back')}
                </BackButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={!!(account && verifying)}
        title={t('receive.verifyBitBox02')}
        onClose={verifying === 'insecure' ? () => {
          setVerifying(false);
          setVerifyingAddress(null);
        } : undefined}
        medium
        centered
      >
        {verifyingAddress && (
          <div className="text-center">
            <QRCode data={uriPrefix + verifyingAddress} />
            <p>{t('receive.verifyInstruction')}</p>
            <div className="m-bottom-half">
              <CopyableInput
                value={verifyingAddress}
                flexibleHeight
              />
            </div>
          </div>
        )}
      </Dialog>

      {signMessageAddress && account && (
        <SignMessageDialog
          open={!!signMessageAddress}
          onClose={() => setSignMessageAddress(null)}
          address={{
            address: signMessageAddress.address,
            addressID: signMessageAddress.addressID,
          }}
          accountCode={code}
          scriptType={signMessageAddress.scriptType}
          coinCode={account.coinCode}
        />
      )}
    </div>
  );
};
