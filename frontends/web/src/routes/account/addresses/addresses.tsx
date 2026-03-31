// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { AccountCode, TAccount } from '@/api/account';
import { TDevices } from '@/api/devices';
import { Header, Main } from '@/components/layout';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { View, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { findAccount } from '@/routes/account/utils';
import { useAddressVerification } from '../components/use-address-verification';
import { AddressList } from './address-list';
import { ChangeCopyWarningDialog } from './dialog/change-copy-warning-dialog';
import { VerifyAddressDialog } from './verify-address-dialog';

type TProps = {
  code: AccountCode;
  accounts: TAccount[];
  devices: TDevices;
};

type TView = 'list' | 'verify';

export const Addresses = ({ code, accounts, devices }: TProps) => {
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
  const [changeCopyWarningAddress, setChangeCopyWarningAddress] = useState<accountApi.TUsedAddress | null>(null);

  const isVerifyView = !!addressID && location.pathname.endsWith('/verify');
  const view: TView = isVerifyView ? 'verify' : 'list';
  const receivePath = `/account/${code}/receive`;

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
    navigate(listPath, { replace: true });
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
  const { startCopyOnlyFlow, startVerifyFlow } = verification;

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedAddressID(prev => prev === id ? null : id);
  }, []);

  const handleStartCopy = useCallback((address: accountApi.TUsedAddress) => {
    if (address.addressType === 'change') {
      setChangeCopyWarningAddress(address);
      return;
    }
    startVerifyFlow(address.addressID);
  }, [startVerifyFlow]);

  const handleCloseChangeCopyWarning = useCallback(() => {
    setChangeCopyWarningAddress(null);
  }, []);

  const handleConfirmChangeCopy = useCallback(() => {
    if (!changeCopyWarningAddress) {
      return;
    }
    startCopyOnlyFlow(changeCopyWarningAddress.addressID);
    setChangeCopyWarningAddress(null);
  }, [changeCopyWarningAddress, startCopyOnlyFlow]);

  if (!account) {
    return null;
  }

  const currentExpandedAddressID = view === 'verify'
    ? (selectedAddress?.addressID || null)
    : expandedAddressID;

  return (
    <Main>
      <ContentWrapper>
        <GlobalBanners devices={devices} />
      </ContentWrapper>
      <Header
        hideSidebarToggler
        title={
          <>
            <h2 className="hide-on-small">{t('addresses.title')}</h2>
            <MobileHeader onClick={() => navigate(-1)} title={t('addresses.title')} />
          </>
        }
      />
      <View fullscreen={false}>
        <ViewContent>
          <AddressList
            accountName={account.name}
            isLoading={isLoading}
            error={usedAddressesError}
            isEmpty={usedAddresses.length === 0}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            addressTypeFilter={addressTypeFilter}
            receivePath={receivePath}
            onAddressTypeFilterChange={setAddressTypeFilter}
            filteredAddresses={filteredAddresses}
            expandedAddressID={currentExpandedAddressID}
            onToggleExpand={handleToggleExpand}
            onStartCopy={handleStartCopy}
            disableBackEsc={view === 'verify'}
            onRetryLoad={() => setUsedAddressesLoadAttempt(prev => prev + 1)}
          />
          {changeCopyWarningAddress && (
            <ChangeCopyWarningDialog
              code={code}
              selectedAddress={changeCopyWarningAddress}
              onContinue={handleConfirmChangeCopy}
              onClose={handleCloseChangeCopyWarning}
            />
          )}
          {view === 'verify' && (
            <VerifyAddressDialog
              verification={verification}
              selectedAddress={selectedAddress}
              isLoading={isLoading}
              coinCode={account.coinCode}
              onClose={returnToList}
            />
          )}
        </ViewContent>
      </View>
    </Main>
  );
};
