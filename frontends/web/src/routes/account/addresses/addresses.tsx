// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { AccountCode, TAccount, TUsedAddress } from '@/api/account';
import { Header } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { Message } from '@/components/message/message';
import { Dialog } from '@/components/dialog/dialog';
import { Button, Input } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import {
  CaretDown,
  Copy,
  Loupe,
  WarningOutlined,
} from '@/components/icon';
import { findAccount, getAddressURIPrefix } from '@/routes/account/utils';
import { VerifyAddressDialogContent } from '../components/verify-address-dialog-content';
import { useAddressVerification } from '../components/use-address-verification';
import style from './addresses.module.css';

type TProps = {
  code: AccountCode;
  accounts: TAccount[];
};

type TView = 'list' | 'verify';

const formatListDate = (lastUsed: string | null, fallback: string): string => {
  if (!lastUsed) {
    return fallback;
  }
  const date = new Date(lastUsed);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
};

const truncateAddressMiddle = (
  address: string,
  prefixLength: number,
  suffixLength: number,
): string => {
  const middleDots = '......';
  if (address.length <= prefixLength + suffixLength) {
    return address;
  }
  return `${address.slice(0, prefixLength)}${middleDots}${address.slice(-suffixLength)}`;
};

export const Addresses = ({ code, accounts }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { addressID } = useParams<{ addressID?: string }>();
  const [usedAddressesLoadAttempt, setUsedAddressesLoadAttempt] = useState(0);

  const account = findAccount(accounts, code);
  const accountRootFingerprint = account?.keystore.rootFingerprint;
  const usedAddressesResponse = useLoad(() => accountApi.getUsedAddresses(code), [code, usedAddressesLoadAttempt]);

  const [searchTerm, setSearchTerm] = useState('');
  const [addressTypeFilter, setAddressTypeFilter] = useState<'receive' | 'change'>('receive');
  const [expandedAddressID, setExpandedAddressID] = useState<string | null>(addressID || null);

  const isVerifyView = !!addressID && location.pathname.endsWith('/verify');
  const view: TView = isVerifyView ? 'verify' : 'list';

  const isLoading = usedAddressesResponse === undefined;
  const usedAddressesError = useMemo(() => {
    if (usedAddressesResponse === undefined || usedAddressesResponse.success) {
      return null;
    }
    switch (usedAddressesResponse.errorCode) {
    case 'syncInProgress':
      return t('addresses.loadSyncInProgress');
    case 'notSupported':
      return t('addresses.loadNotSupported');
    default:
      return t('addresses.loadFailed');
    }
  }, [t, usedAddressesResponse]);
  const usedAddresses = useMemo(
    () => (usedAddressesResponse?.success ? usedAddressesResponse.addresses : []),
    [usedAddressesResponse],
  );

  const selectedAddress = useMemo(() => {
    if (!addressID) {
      return null;
    }
    return usedAddresses.find(address => address.addressID === addressID) || null;
  }, [addressID, usedAddresses]);

  const listPath = `/account/${code}/addresses`;

  const returnToList = useCallback((expandedID?: string) => {
    if (expandedID) {
      setExpandedAddressID(expandedID);
    }
    navigate(listPath);
  }, [listPath, navigate]);

  const filteredAddresses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return usedAddresses
      .filter(address => address.addressType === addressTypeFilter)
      .filter(address => normalizedSearch.length === 0 || address.address.toLowerCase().includes(normalizedSearch));
  }, [addressTypeFilter, searchTerm, usedAddresses]);

  useEffect(() => {
    if (view !== 'list') {
      return;
    }
    if (addressID) {
      setExpandedAddressID(addressID);
    }
  }, [addressID, view]);

  const verification = useAddressVerification({
    code,
    rootFingerprint: accountRootFingerprint,
    selectedAddress,
    isVerifyView,
    returnToList,
  });

  const renderHeaderTitle = () => <h2>{t('addresses.title')}</h2>;

  const renderAddressNotFound = () => (
    <div className={style.pageSection}>
      <Message type="warning">{t('addresses.notFound')}</Message>
      <div className={style.footerButtons}>
        <BackButton to={listPath} replace={true}>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );

  const renderInlineActions = (address: TUsedAddress) => (
    <div className={style.inlineActions}>
      {address.addressType !== 'change' && (
        <Button transparent inline className={style.linkAction} onClick={() => verification.startVerifyFlow(address.addressID)}>
          <span className={style.linkActionLabel}>
            <Copy className={style.linkActionIcon} />
            {t('button.copy')} {t('addresses.detail.address')}
          </span>
        </Button>
      )}

    </div>
  );

  const renderList = (forcedExpandedAddressID: string | null = null) => {
    const currentExpandedAddressID = forcedExpandedAddressID || expandedAddressID;

    return (
      <div className={style.pageSection}>
        <p className={style.subtitle}>
          {t('addresses.listDescriptionPrefix')} <strong>{account?.name}</strong>
        </p>

        {isLoading ? (
          <div className={style.loadingWrap}>
            <Spinner text={t('loading')} />
          </div>
        ) : usedAddressesError ? (
          <div className={style.verifyDialogError}>
            <Message type="error">{usedAddressesError}</Message>
            <div className={style.footerButtons}>
              <Button primary onClick={() => setUsedAddressesLoadAttempt(prev => prev + 1)}>
                {t('generic.retry')}
              </Button>
            </div>
          </div>
        ) : usedAddresses.length === 0 ? (
          <p className={style.empty}>{t('addresses.empty')}</p>
        ) : (
          <>
            <div className={style.searchWrap}>
              <Input
                id="addresses-search"
                value={searchTerm}
                onInput={event => setSearchTerm(event.currentTarget.value)}
                placeholder={t('addresses.searchPlaceholder')}
                className={style.searchInput}
              >
                <Loupe className={style.searchIcon} />
              </Input>
            </div>

            <div className={style.segmentWrap}>
              <button
                type="button"
                className={[style.segmentButton, addressTypeFilter === 'receive' ? style.segmentButtonActive : ''].join(' ')}
                onClick={() => setAddressTypeFilter('receive')}
              >
                {t('addresses.filter.receiveAddresses')}
              </button>
              <button
                type="button"
                className={[style.segmentButton, addressTypeFilter === 'change' ? style.segmentButtonActive : ''].join(' ')}
                onClick={() => setAddressTypeFilter('change')}
              >
                {t('addresses.filter.changeAddresses')}
              </button>
            </div>

            {filteredAddresses.length === 0 ? (
              <p className={style.empty}>{t('addresses.emptyFiltered')}</p>
            ) : (
              <div className={style.addressList}>
                {filteredAddresses.map(address => {
                  const isExpanded = currentExpandedAddressID === address.addressID;
                  const truncatedAddressDesktop = truncateAddressMiddle(address.address, 15, 15);
                  const truncatedAddressMobile = truncateAddressMiddle(address.address, 10, 10);

                  return (
                    <div key={address.addressID} className={style.addressItem}>
                      <button
                        type="button"
                        className={style.addressRow}
                        aria-expanded={isExpanded}
                        onClick={() => {
                          setExpandedAddressID(prev => prev === address.addressID ? null : address.addressID);
                        }}
                      >
                        <span className={style.rowAddress} title={address.address}>
                          <span className={style.rowAddressDesktop}>{truncatedAddressDesktop}</span>
                          <span className={style.rowAddressMobile}>{truncatedAddressMobile}</span>
                        </span>
                        <span className={style.rowDate}>{formatListDate(address.lastUsed, t('addresses.unknown'))}</span>
                        <CaretDown className={style.rowChevron} />
                      </button>
                      {isExpanded && renderInlineActions(address)}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className={style.listFade} />

        <div className={[style.footerButtons, style.listFooterButtons].join(' ')}>
          <BackButton to={`/account/${code}/info`} replace={true}>
            {t('button.back')}
          </BackButton>
        </div>
      </div>
    );
  };

  const renderVerifySkipSheet = () => {
    const isSkipWarningStep = verification.verifyState === 'skipWarning' || verification.hasSkipDeviceVerificationQuery;
    const isSkippedStep = verification.verifyState === 'skipped';

    if (!isSkipWarningStep && !isSkippedStep) {
      return null;
    }

    if (isSkippedStep) {
      if (isLoading) {
        return (
          <Dialog open title={t('receive.verifyBitBox02')} medium centered>
            <div className={style.verifyDialogContent}>
              <Spinner text={t('loading')} />
            </div>
          </Dialog>
        );
      }

      if (!selectedAddress) {
        return renderAddressNotFound();
      }

      return (
        <Dialog
          open
          title={t('addresses.detail.address')}
          medium
          centered
          onClose={() => returnToList(selectedAddress?.addressID)}
        >
          <div className={style.verifyDialogContent}>
            <VerifyAddressDialogContent
              address={selectedAddress.address}
              uriPrefix={getAddressURIPrefix(account?.coinCode)}
              instructionClassName={style.verifyDialogInstruction}
              qrWrapClassName={style.qrWrap}
              qrSize={180}
            />

            <div className={style.skipFinalWarning}>
              <p className={style.skipFinalWarningText}>
                {t('addresses.skipVerifyWarning')}. {t('addresses.unverifiedAddressWarning')}
              </p>
            </div>
          </div>
        </Dialog>
      );
    }

    return (
      <Dialog open title={t('addresses.skipVerifyTitle')} medium>
        <div className={[style.verifyDialogContent, style.verifySkipDialogContent].join(' ')}>
          <div className={style.warningRow}>
            <WarningOutlined className={style.warningIcon} />
            <span>{t('addresses.skipVerifyWarning')}</span>
          </div>

          <p className={style.sheetBody}>{t('addresses.skipVerifyBody')}</p>
          <p className={style.sheetBody}>{t('addresses.skipVerifyQuestion')}</p>

          <div className={style.verifyDialogActions}>
            <Button secondary className={style.skipVerifyConfirmButton} onClick={verification.skipVerify}>
              {t('addresses.skipVerifyConfirm')}
            </Button>
            <Button
              secondary
              onClick={() => {
                returnToList(selectedAddress?.addressID);
              }}
            >
              {t('dialog.cancel')}
            </Button>
          </div>
        </div>
      </Dialog>
    );
  };

  const renderVerifyOnDeviceSheet = () => {
    if (isLoading) {
      return (
        <Dialog open title={t('receive.verifyBitBox02')} medium centered>
          <div className={style.verifyDialogContent}>
            <Spinner text={t('loading')} />
          </div>
        </Dialog>
      );
    }

    if (!selectedAddress) {
      return renderAddressNotFound();
    }

    const isError = verification.verifyState === 'error';

    return (
      <Dialog
        open
        title={t('receive.verifyBitBox02')}
        medium
        centered
        onClose={isError ? () => returnToList(selectedAddress?.addressID) : undefined}
      >
        <div className={style.verifyDialogContent}>
          <VerifyAddressDialogContent
            address={selectedAddress.address}
            uriPrefix={getAddressURIPrefix(account?.coinCode)}
            instruction={t('receive.verifyInstruction')}
            instructionClassName={style.verifyDialogInstruction}
            qrWrapClassName={style.qrWrap}
            qrSize={180}
          />

          {isError && (
            <div className={style.verifyDialogError}>
              <Message type="error">{verification.verifyError || t('addresses.verifyFailed')}</Message>
              <div className={style.footerButtons}>
                <Button
                  secondary
                  onClick={verification.retryVerify}
                >
                  {t('generic.retry')}
                </Button>
                <BackButton onBack={() => returnToList(selectedAddress?.addressID)}>
                  {t('button.back')}
                </BackButton>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    );
  };

  const renderVerifyConnectFailedSheet = () => {
    if (verification.verifyState !== 'connectFailed') {
      return null;
    }
    return (
      <Dialog
        open
        title={t('receive.verifyBitBox02')}
        medium
        centered
        onClose={() => returnToList(selectedAddress?.addressID)}
      >
        <div className={style.verifyDialogContent}>
          <Message type="error">{verification.verifyError || t('addresses.verifyConnectFailed')}</Message>
          <div className={style.footerButtons}>
            <Button
              primary
              onClick={verification.retryVerify}
            >
              {t('generic.retry')}
            </Button>
            <BackButton onBack={() => returnToList(selectedAddress?.addressID)}>
              {t('button.back')}
            </BackButton>
          </div>
        </div>
      </Dialog>
    );
  };

  if (!account) {
    return null;
  }

  return (
    <div className={['container', style.noDragRegion].join(' ')}>
      <div className={['innerContainer', 'scrollableContainer', style.noDragRegion].join(' ')}>
        <Header hideSidebarToggler centerTitle title={renderHeaderTitle()} />
        <div className={['content', 'padded', style.noDragRegion].join(' ')}>
          {view === 'list' && renderList()}
          {view === 'verify' && (
            <>
              {renderList(selectedAddress?.addressID || null)}
              {(verification.verifyState === 'skipWarning' || verification.hasSkipDeviceVerificationQuery || verification.verifyState === 'skipped') && renderVerifySkipSheet()}
              {verification.verifyState === 'connectFailed' && renderVerifyConnectFailedSheet()}
              {(verification.verifyState === 'verifying' || verification.verifyState === 'error') && renderVerifyOnDeviceSheet()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
