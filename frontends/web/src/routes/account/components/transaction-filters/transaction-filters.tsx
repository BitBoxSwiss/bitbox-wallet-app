// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/components/forms';
import type { TAmountUnitFilter, TTransactionFilters, TTransactionTypeFilter } from './use-transaction-filters';
import styles from './transaction-filters.module.css';

type TProps = {
  filters: TTransactionFilters;
  onFiltersChange: (filters: TTransactionFilters) => void;
  coinUnit: string;
  fiatUnit: string;
};

export const TransactionFilters = ({
  filters,
  onFiltersChange,
  coinUnit,
  fiatUnit,
}: TProps) => {
  const { t } = useTranslation();
  const update = (patch: Partial<TTransactionFilters>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className={styles.filterRow}>
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
      <div className={styles.amountGroup}>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          id="tx-filter-amount-min"
          label={t('transactions.filters.amountMin')}
          value={filters.amountMin}
          onChange={e => update({ amountMin: e.currentTarget.value })}
        />
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          id="tx-filter-amount-max"
          label={t('transactions.filters.amountMax')}
          value={filters.amountMax}
          onChange={e => update({ amountMax: e.currentTarget.value })}
        />
        <Select
          id="tx-filter-amount-unit"
          label={'\u00a0'}
          aria-label={t('transactions.filters.unit')}
          options={[
            { value: 'coin', text: coinUnit },
            { value: 'fiat', text: fiatUnit },
          ]}
          value={filters.amountUnit}
          onChange={e => update({ amountUnit: e.currentTarget.value as TAmountUnitFilter })}
        />
      </div>
    </div>
  );
};
