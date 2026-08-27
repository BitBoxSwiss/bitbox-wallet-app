// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/components/forms';
import { ArrowDown } from '@/components/icon';
import type { TSortByFilter, TTransactionFilters, TTransactionTypeFilter } from './use-transaction-filters';
import styles from './transaction-filters.module.css';

type TProps = {
  coinName: string;
  filters: TTransactionFilters;
  onFiltersChange: (filters: TTransactionFilters) => void;
};

export const TransactionFilters = ({
  coinName,
  filters,
  onFiltersChange,
}: TProps) => {
  const { t } = useTranslation();
  const update = (patch: Partial<TTransactionFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const sortAscending = filters.sortDir === 'asc';
  const sortDirLabel = sortAscending
    ? t('transactions.filters.sortAscending')
    : t('transactions.filters.sortDescending');

  return (
    <div className={styles.filterRow}>
      <div className={styles.sortGroup}>
        <Select
          id="tx-filter-sort"
          label={t('transactions.filters.sortBy')}
          options={[
            { value: 'date', text: t('transactions.filters.sortDate') },
            { value: 'amount', text: t('transactions.filters.sortAmount', { coinName }) },
            { value: 'type', text: t('transactions.filters.sortType') },
          ]}
          value={filters.sortBy}
          onChange={e => update({ sortBy: e.currentTarget.value as TSortByFilter })}
        />
        <button
          type="button"
          className={styles.sortDirButton}
          aria-label={sortDirLabel}
          title={sortDirLabel}
          onClick={() => update({ sortDir: sortAscending ? 'desc' : 'asc' })}
        >
          <ArrowDown
            alt=""
            className={sortAscending ? styles.sortDirIconAsc : undefined}
          />
        </button>
      </div>
      <div className={styles.typeGroup}>
        <Select
          id="tx-filter-type"
          label={t('transactions.filters.type')}
          options={[
            { value: 'all', text: t('transactions.filters.typeAll') },
            { value: 'send', text: t('transactions.filters.typeSent') },
            { value: 'receive', text: t('transactions.filters.typeReceived') },
            { value: 'send_to_self', text: t('transactions.filters.typeSentToSelf') },
          ]}
          value={filters.type}
          onChange={e => update({ type: e.currentTarget.value as TTransactionTypeFilter })}
        />
      </div>
      <div className={styles.dateGroup}>
        <Input
          type="date"
          id="tx-filter-from"
          label={t('transactions.filters.from')}
          value={filters.fromDate}
          max={filters.toDate || undefined}
          data-empty={filters.fromDate === '' || undefined}
          onChange={e => update({ fromDate: e.currentTarget.value })}
        />
        <Input
          type="date"
          id="tx-filter-to"
          label={t('transactions.filters.to')}
          value={filters.toDate}
          min={filters.fromDate || undefined}
          data-empty={filters.toDate === '' || undefined}
          onChange={e => update({ toDate: e.currentTarget.value })}
        />
      </div>
    </div>
  );
};
