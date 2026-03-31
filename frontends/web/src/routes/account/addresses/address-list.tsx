// SPDX-License-Identifier: Apache-2.0

import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TUsedAddress } from '@/api/account';
import { useIsScrollable } from '@/hooks/scrollable';
import { parseTimeShort } from '@/utils/date';
import { Spinner } from '@/components/spinner/Spinner';
import { Message } from '@/components/message/message';
import { Button, SearchInput } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { AddressRowAccordion } from './address-row';
import { AddressTypeFilter } from './address-type-filter';
import { AddressActions } from './address-actions';
import { truncateMiddle } from '@/utils/truncate';
import style from './addresses.module.css';

type TProps = {
  accountName: string;
  isLoading: boolean;
  error: string | null;
  isEmpty: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  addressTypeFilter: 'receive' | 'change';
  receivePath: string;
  onAddressTypeFilterChange: (value: 'receive' | 'change') => void;
  filteredAddresses: TUsedAddress[];
  expandedAddressID: string | null;
  onToggleExpand: (addressID: string) => void;
  onStartCopy: (address: TUsedAddress) => void;
  onRetryLoad: () => void;
  disableBackEsc?: boolean;
};

export const AddressList = ({
  accountName,
  isLoading,
  error,
  isEmpty,
  searchTerm,
  onSearchChange,
  addressTypeFilter,
  receivePath,
  onAddressTypeFilterChange,
  filteredAddresses,
  expandedAddressID,
  onToggleExpand,
  onStartCopy,
  onRetryLoad,
  disableBackEsc = false,
}: TProps) => {
  const { t, i18n } = useTranslation();
  const scrollableRef = useRef<HTMLDivElement>(null);
  const isScrollable = useIsScrollable(scrollableRef, [filteredAddresses]);

  const formatDate = (lastUsed: string | null) =>
    lastUsed ? parseTimeShort(lastUsed, i18n.language) : t('generic.unknown');

  return (
    <div>
      <p className={style.subtitle}>
        {t('addresses.listDescriptionPrefix')} <strong>{accountName}</strong>
      </p>

      {isLoading ? (
        <div className={style.loadingWrap}>
          <Spinner text={t('loading')} />
        </div>
      ) : error ? (
        <div className={style.verifyDialogError}>
          <Message type="error">{error}</Message>
          <div className={style.footerButtons}>
            <Button primary onClick={onRetryLoad}>
              {t('generic.retry')}
            </Button>
          </div>
        </div>
      ) : isEmpty ? (
        <p className={style.empty}>{t('addresses.empty')}</p>
      ) : (
        <>
          <div className={style.searchWrap}>
            <SearchInput
              id="addresses-search"
              value={searchTerm}
              onInput={event => onSearchChange(event.currentTarget.value)}
              placeholder={t('addresses.searchPlaceholder')}
            />
          </div>

          <AddressTypeFilter value={addressTypeFilter} onChange={onAddressTypeFilterChange} />
          {addressTypeFilter === 'change' && (
            <Message type="info">
              <Trans
                i18nKey="addresses.changeCopyBody"
                components={{
                  receiveLink: <Link className={style.inlineLink} to={receivePath} />,
                }}
              />
            </Message>
          )}

          {filteredAddresses.length === 0 ? (
            <p className={style.empty}>{t('addresses.emptyFiltered')}</p>
          ) : (
            <>
              <div className={style.columnHeader}>
                <span>{t('addresses.columnAddress')}</span>
                <span>{t('addresses.columnLastUsed')}</span>
              </div>
              <div className={[style.addressListWrapper, isScrollable ? style.showFade : ''].join(' ')}>
                <div ref={scrollableRef} className={style.addressList}>
                  {filteredAddresses.map(address => {
                    const isExpanded = expandedAddressID === address.addressID;
                    const truncatedAddressMobile = truncateMiddle(address.address, 10, 10);

                    return (
                      <div key={address.addressID} className={style.addressItem}>
                        <AddressRowAccordion
                          address={address.address}
                          truncatedAddress={truncatedAddressMobile}
                          formattedDate={formatDate(address.lastUsed)}
                          isExpanded={isExpanded}
                          onToggle={() => onToggleExpand(address.addressID)}
                        >
                          <AddressActions address={address} onCopy={onStartCopy} />
                        </AddressRowAccordion>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className={style.backButtonWrap}>
        <BackButton enableEsc={!disableBackEsc}>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );
};
