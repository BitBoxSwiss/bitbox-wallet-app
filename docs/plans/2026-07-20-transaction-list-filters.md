# Transaction List Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible filter row (date range, transaction type, amount min/max in coin or fiat) to the account transaction list, toggled by a Filter button next to the existing search button.

**Architecture:** Client-side filtering, mirroring the existing search. A pure predicate + `useTransactionFilters` hook own the filter state; a presentational `TransactionFilters` component renders the row; `account.tsx` composes both and ANDs the predicate with the existing search filter. Design doc: `docs/plans/2026-07-20-transaction-list-filters-design.md`.

**Tech Stack:** React + TypeScript, CSS Modules, i18next, Vitest + Testing Library. Existing components: `Input`, `Select`, `Button` from `@/components/forms`.

**Conventions (from AGENTS.md):** named exports only, props types named `TProps`, kebab-case filenames, `@/` path alias, commit style `frontend: lowercase imperative summary`. All commands below run from repo root unless a `cd` is shown. Vitest one-file runs: `cd frontends/web && npx vitest run <path>`.

**Key facts an implementer needs:**
- `TTransaction` (in `frontends/web/src/api/account.ts:229`) has `type: 'send' | 'receive' | 'send_to_self'`, `time: string | null` (ISO; `null` = pending), and amounts of type `TAmountWithConversions` (`{ amount: string; conversions?: { [fiat]: string }; unit; estimated }`).
- The transaction row (`frontends/web/src/components/transactions/transaction.tsx:156`) displays `amountAtTime` for receives and `deductedAmountAtTime` (includes fee) for sends/self — the filter compares against the SAME value so results agree with what's on screen.
- Fiat conversion strings are backend-formatted with `'` thousand separators and `.` decimal (see `backend/coins/coin/conversions.go:47`), e.g. `1'234.56`. A missing historical rate yields an EMPTY string (`conversions.go:92`), and `conversions` itself is optional — both mean "unavailable".
- The user's fiat is `defaultCurrency` from `RatesContext` (`frontends/web/src/contexts/RatesContext.tsx`). The account's display unit (respects sat/BTC setting) is `balance.available.unit`.
- The search collapse animation pattern is `.searchContainer`/`.searchHidden` in `frontends/web/src/routes/account/account.module.css:183`.
- Mobile breakpoint used everywhere: `max-width: 768px`.

---

### Task 1: i18n keys

**Files:**
- Modify: `frontends/web/src/locales/en/app.json` (inside the existing `"transactions"` group)

**Step 1: Add keys**

In the `"transactions"` group (currently `errorLoadTransactions`, `placeholder`), add a `filters` subgroup. Keys inside each group must stay alphabetically sorted:

```json
"transactions": {
  "errorLoadTransactions": "Transactions could not be loaded.",
  "filters": {
    "amountMax": "Max",
    "amountMin": "Min",
    "button": "Filter",
    "from": "From",
    "noResults": "No transactions match your filters",
    "to": "To",
    "type": "Type",
    "typeAll": "All types",
    "typeReceived": "Received",
    "typeSent": "Sent",
    "typeSentToSelf": "Sent to self"
  },
  "placeholder": "..."
}
```

(Keep the existing values of `errorLoadTransactions`/`placeholder` untouched — only insert `filters` between them.)

**Step 2: Verify formatting/sorting**

Run: `make webfix && make weblint`
Expected: no i18n sorting errors, lint passes.

**Step 3: Commit**

```bash
git add frontends/web/src/locales/en/app.json
git commit -m "frontend: add transaction filter translation keys"
```

### Task 2: Filter icon

**Files:**
- Create: `frontends/web/src/components/icon/assets/icons/filter-blue.svg`
- Modify: `frontends/web/src/components/icon/icon.tsx` (import near `loupeBlueSVG` ~line 64, export near `LoupeBlue` ~line 180)

**Step 1: Create the SVG** — same stroke style/color as `loupe-blue.svg` (`#5E94BF`, width 2, round caps):

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M4 5H20L14 12.5V18L10 20V12.5L4 5Z" stroke="#5E94BF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

**Step 2: Export the component** in `icon.tsx`, following the existing pattern exactly:

```tsx
import filterBlueSVG from './assets/icons/filter-blue.svg';
// ...
export const FilterBlue = (props: ImgProps) => (<img src={filterBlueSVG} draggable={false} {...props} />);
```

**Step 3: Verify**

Run: `make weblint`
Expected: passes (type-check included).

**Step 4: Commit**

```bash
git add frontends/web/src/components/icon
git commit -m "frontend: add filter icon"
```

### Task 3: Filter types + pure predicate (TDD)

**Files:**
- Create: `frontends/web/src/routes/account/components/transaction-filters/use-transaction-filters.ts`
- Test: `frontends/web/src/routes/account/components/transaction-filters/use-transaction-filters.test.ts`

**Step 1: Write the failing tests** for the pure predicate `matchesFilters`. Use a tx factory; every field the predicate reads must be realistic:

```ts
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TTransaction } from '@/api/account';
import { emptyFilters, matchesFilters, TTransactionFilters } from './use-transaction-filters';

const makeTx = (overrides: Partial<TTransaction> = {}): TTransaction => ({
  addresses: ['addr1'],
  amount: { amount: '0.5', conversions: { USD: '100.00' }, unit: 'BTC', estimated: false },
  amountAtTime: { amount: '0.5', conversions: { USD: '90.00' }, unit: 'BTC', estimated: false },
  fee: { amount: '0.0001', conversions: {}, unit: 'BTC', estimated: false },
  feeRateInfo: '',
  deductedAmountAtTime: { amount: '0.5001', conversions: { USD: '90.10' }, unit: 'BTC', estimated: false },
  gas: 0,
  nonce: null,
  internalID: 'id',
  note: '',
  numConfirmations: 6,
  numConfirmationsComplete: 6,
  size: 0,
  status: 'complete',
  time: '2026-07-10T12:00:00Z',
  type: 'receive',
  txID: 'txid',
  vsize: 0,
  weight: 0,
  ...overrides,
});

const filters = (overrides: Partial<TTransactionFilters>): TTransactionFilters => ({
  ...emptyFilters,
  ...overrides,
});

describe('matchesFilters', () => {
  it('matches everything with empty filters', () => {
    expect(matchesFilters(makeTx(), emptyFilters, 'USD')).toBe(true);
  });

  describe('date range', () => {
    it('includes tx on the from-date boundary (00:00 local)', () => {
      const tx = makeTx({ time: '2026-07-10T00:00:00' });
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-10' }), 'USD')).toBe(true);
    });

    it('excludes tx before the from-date', () => {
      const tx = makeTx({ time: '2026-07-09T23:59:00' });
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-10' }), 'USD')).toBe(false);
    });

    it('includes tx late on the to-date (23:59 local)', () => {
      const tx = makeTx({ time: '2026-07-10T23:59:00' });
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD')).toBe(true);
    });

    it('excludes tx after the to-date', () => {
      const tx = makeTx({ time: '2026-07-11T00:00:01' });
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD')).toBe(false);
    });

    it('treats pending tx (time null) as now', () => {
      const tx = makeTx({ time: null });
      const now = new Date('2026-07-15T10:00:00');
      expect(matchesFilters(tx, filters({ fromDate: '2026-07-14', toDate: '2026-07-15' }), 'USD', now)).toBe(true);
      expect(matchesFilters(tx, filters({ toDate: '2026-07-10' }), 'USD', now)).toBe(false);
    });
  });

  describe('type', () => {
    it('matches exact type and rejects others', () => {
      expect(matchesFilters(makeTx({ type: 'send' }), filters({ type: 'send' }), 'USD')).toBe(true);
      expect(matchesFilters(makeTx({ type: 'receive' }), filters({ type: 'send' }), 'USD')).toBe(false);
      expect(matchesFilters(makeTx({ type: 'send_to_self' }), filters({ type: 'send_to_self' }), 'USD')).toBe(true);
    });
  });

  describe('amount in coin', () => {
    it('applies inclusive min/max bounds on the displayed amount', () => {
      const tx = makeTx(); // receive, amountAtTime 0.5
      expect(matchesFilters(tx, filters({ amountMin: '0.5' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMin: '0.6' }), 'USD')).toBe(false);
      expect(matchesFilters(tx, filters({ amountMax: '0.5' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMax: '0.4' }), 'USD')).toBe(false);
    });

    it('uses deducted amount for sends, matching what the list displays', () => {
      const tx = makeTx({ type: 'send' }); // deductedAmountAtTime 0.5001
      expect(matchesFilters(tx, filters({ amountMin: '0.5001' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountMax: '0.5' }), 'USD')).toBe(false);
    });
  });

  describe('amount in fiat', () => {
    it('compares against the historical fiat value', () => {
      const tx = makeTx(); // amountAtTime USD 90.00
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '90' }), 'USD')).toBe(true);
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '91' }), 'USD')).toBe(false);
    });

    it('parses thousand separators in conversion strings', () => {
      const tx = makeTx({
        amountAtTime: { amount: '20', conversions: { USD: "1'234.56" }, unit: 'BTC', estimated: false },
      });
      expect(matchesFilters(tx, filters({ amountUnit: 'fiat', amountMin: '1234', amountMax: '1235' }), 'USD')).toBe(true);
    });

    it('excludes tx with missing or empty conversion when fiat filter active', () => {
      const noConversions = makeTx({ amountAtTime: { amount: '0.5', unit: 'BTC', estimated: false } });
      const emptyConversion = makeTx({
        amountAtTime: { amount: '0.5', conversions: { USD: '' }, unit: 'BTC', estimated: false },
      });
      expect(matchesFilters(noConversions, filters({ amountUnit: 'fiat', amountMin: '1' }), 'USD')).toBe(false);
      expect(matchesFilters(emptyConversion, filters({ amountUnit: 'fiat', amountMin: '1' }), 'USD')).toBe(false);
      // but they still match when no amount filter is set
      expect(matchesFilters(noConversions, filters({ amountUnit: 'fiat' }), 'USD')).toBe(true);
    });
  });

  it('combines all criteria with AND', () => {
    const tx = makeTx({ type: 'send', time: '2026-07-10T12:00:00' });
    const combined = filters({ fromDate: '2026-07-01', toDate: '2026-07-31', type: 'send', amountMin: '0.5', amountMax: '0.6' });
    expect(matchesFilters(tx, combined, 'USD')).toBe(true);
    expect(matchesFilters(tx, { ...combined, type: 'receive' }, 'USD')).toBe(false);
  });
});
```

**Step 2: Run to verify failure**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/use-transaction-filters.test.ts`
Expected: FAIL — cannot resolve `./use-transaction-filters`.

**Step 3: Implement the types and pure predicate** in `use-transaction-filters.ts` (hook itself comes in Task 4):

```ts
// SPDX-License-Identifier: Apache-2.0

import type { Fiat, TTransaction, TTransactionType } from '@/api/account';

export type TTransactionTypeFilter = 'all' | TTransactionType;
export type TAmountUnitFilter = 'coin' | 'fiat';

export type TTransactionFilters = {
  fromDate: string; // 'YYYY-MM-DD' or '' when unset
  toDate: string;
  type: TTransactionTypeFilter;
  amountMin: string;
  amountMax: string;
  amountUnit: TAmountUnitFilter;
};

export const emptyFilters: TTransactionFilters = {
  fromDate: '',
  toDate: '',
  type: 'all',
  amountMin: '',
  amountMax: '',
  amountUnit: 'coin',
};

const parseBound = (input: string): number | null => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
};

// Conversion strings are backend-formatted with ' as thousand separator,
// e.g. "1'234.56". Empty string means the rate was unavailable.
const parseConversion = (conversion: string | undefined): number | null => {
  if (!conversion) {
    return null;
  }
  const parsed = parseFloat(conversion.replace(/'/g, ''));
  return Number.isNaN(parsed) ? null : parsed;
};

export const matchesFilters = (
  tx: TTransaction,
  filters: TTransactionFilters,
  fiat: Fiat,
  now: Date = new Date(),
): boolean => {
  if (filters.fromDate || filters.toDate) {
    // Pending transactions have no timestamp yet and count as "now".
    const txTime = tx.time ? new Date(tx.time).getTime() : now.getTime();
    if (filters.fromDate && txTime < new Date(`${filters.fromDate}T00:00:00`).getTime()) {
      return false;
    }
    if (filters.toDate && txTime > new Date(`${filters.toDate}T23:59:59.999`).getTime()) {
      return false;
    }
  }

  if (filters.type !== 'all' && tx.type !== filters.type) {
    return false;
  }

  const min = parseBound(filters.amountMin);
  const max = parseBound(filters.amountMax);
  if (min === null && max === null) {
    return true;
  }
  // Compare against the same value the transaction row displays.
  const displayAmount = tx.type === 'receive' ? tx.amountAtTime : tx.deductedAmountAtTime;
  const value = filters.amountUnit === 'coin'
    ? parseBound(displayAmount.amount)
    : parseConversion(displayAmount.conversions?.[fiat]);
  if (value === null) {
    return false;
  }
  const absValue = Math.abs(value);
  return (min === null || absValue >= min) && (max === null || absValue <= max);
};
```

**Step 4: Run tests**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/use-transaction-filters.test.ts`
Expected: PASS (all).

**Step 5: Commit**

```bash
git add frontends/web/src/routes/account/components/transaction-filters
git commit -m "frontend: add transaction filter predicate"
```

### Task 4: useTransactionFilters hook (TDD)

**Files:**
- Modify: `frontends/web/src/routes/account/components/transaction-filters/use-transaction-filters.ts`
- Modify (append): `.../use-transaction-filters.test.ts`

**Step 1: Append failing hook tests.** The hook reads `RatesContext`; the default context value is `{}`, so `defaultCurrency` is undefined — wrap with a provider-like stub via `RatesContext.Provider`:

```tsx
// add imports at top of test file:
import { act } from 'react';
import { renderHook } from '@testing-library/react';
import { createElement, ReactNode } from 'react';
import { RatesContext } from '@/contexts/RatesContext';
import { useTransactionFilters } from './use-transaction-filters';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(RatesContext.Provider, { value: { defaultCurrency: 'USD' } as any }, children);

describe('useTransactionFilters', () => {
  it('starts inactive and becomes active when a filter is set', () => {
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    expect(result.current.isActive).toBe(false);
    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));
    expect(result.current.isActive).toBe(true);
  });

  it('clearFilters resets to empty', () => {
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    act(() => result.current.setFilters({ ...result.current.filters, fromDate: '2026-07-01', amountMin: '1' }));
    act(() => result.current.clearFilters());
    expect(result.current.isActive).toBe(false);
    expect(result.current.filters.fromDate).toBe('');
    expect(result.current.filters.amountMin).toBe('');
  });

  it('matches uses debounced amounts', () => {
    // sanity: matches() delegates to matchesFilters with the current fiat
    const { result } = renderHook(() => useTransactionFilters(), { wrapper });
    expect(result.current.matches(makeTx())).toBe(true);
    act(() => result.current.setFilters({ ...result.current.filters, type: 'send' }));
    expect(result.current.matches(makeTx())).toBe(false); // makeTx is receive
  });
});
```

**Step 2: Run to verify failure**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/use-transaction-filters.test.ts`
Expected: FAIL — `useTransactionFilters` not exported.

**Step 3: Implement the hook** (append to `use-transaction-filters.ts`):

```ts
// add to imports at top:
import { useCallback, useContext, useMemo, useState } from 'react';
import { RatesContext } from '@/contexts/RatesContext';
import { useDebounce } from '@/hooks/debounce';

export const useTransactionFilters = () => {
  const { defaultCurrency } = useContext(RatesContext);
  const [filters, setFilters] = useState<TTransactionFilters>(emptyFilters);
  // Debounce free-text amount inputs so typing doesn't re-filter per keystroke.
  const debouncedAmountMin = useDebounce(filters.amountMin, 200);
  const debouncedAmountMax = useDebounce(filters.amountMax, 200);

  const appliedFilters = useMemo(() => ({
    ...filters,
    amountMin: debouncedAmountMin,
    amountMax: debouncedAmountMax,
  }), [filters, debouncedAmountMin, debouncedAmountMax]);

  const matches = useCallback(
    (tx: TTransaction) => matchesFilters(tx, appliedFilters, defaultCurrency),
    [appliedFilters, defaultCurrency],
  );

  const clearFilters = useCallback(() => setFilters(emptyFilters), []);

  const isActive = filters.fromDate !== ''
    || filters.toDate !== ''
    || filters.type !== 'all'
    || filters.amountMin.trim() !== ''
    || filters.amountMax.trim() !== '';

  return { filters, setFilters, clearFilters, isActive, matches };
};
```

**Step 4: Run tests**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/use-transaction-filters.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontends/web/src/routes/account/components/transaction-filters
git commit -m "frontend: add transaction filters hook"
```

### Task 5: TransactionFilters component (TDD)

**Files:**
- Create: `frontends/web/src/routes/account/components/transaction-filters/transaction-filters.tsx`
- Create: `frontends/web/src/routes/account/components/transaction-filters/transaction-filters.module.css`
- Test: `frontends/web/src/routes/account/components/transaction-filters/transaction-filters.test.tsx`

**Step 1: Write the failing component test:**

```tsx
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionFilters } from './transaction-filters';
import { emptyFilters } from './use-transaction-filters';

describe('TransactionFilters', () => {
  const defaultProps = {
    filters: emptyFilters,
    onFiltersChange: vi.fn(),
    coinUnit: 'BTC',
    fiatUnit: 'USD',
  };

  it('renders all filter controls', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByLabelText('transactions.filters.from')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.to')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.type')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.amountMin')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.amountMax')).toBeInTheDocument();
  });

  it('offers coin and fiat units', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'BTC' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'USD' })).toBeInTheDocument();
  });

  it('propagates changes via onFiltersChange', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.type'), { target: { value: 'send' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, type: 'send' });
    fireEvent.change(screen.getByLabelText('transactions.filters.amountMin'), { target: { value: '10' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, amountMin: '10' });
  });
});
```

Note: existing tests render translation KEYS (the test i18n setup returns keys verbatim — check `frontends/web/src/i18n` test config; `button.test.tsx` follows this pattern). If `t()` in tests resolves actual English strings instead, assert on those.

**Step 2: Run to verify failure**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/transaction-filters.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement the component:**

```tsx
// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { Input, Select } from '@/components/forms';
import type { TTransactionFilters, TAmountUnitFilter, TTransactionTypeFilter } from './use-transaction-filters';
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
      <div className={styles.dateGroup}>
        <Input
          type="date"
          id="tx-filter-from"
          label={t('transactions.filters.from')}
          value={filters.fromDate}
          max={filters.toDate || undefined}
          onChange={e => update({ fromDate: e.currentTarget.value })}
        />
        <Input
          type="date"
          id="tx-filter-to"
          label={t('transactions.filters.to')}
          value={filters.toDate}
          min={filters.fromDate || undefined}
          onChange={e => update({ toDate: e.currentTarget.value })}
        />
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
      <div className={styles.amountGroup}>
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          id="tx-filter-amount-min"
          label={t('transactions.filters.amountMin')}
          value={filters.amountMin}
          onChange={e => update({ amountMin: e.currentTarget.value })}
        />
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          id="tx-filter-amount-max"
          label={t('transactions.filters.amountMax')}
          value={filters.amountMax}
          onChange={e => update({ amountMax: e.currentTarget.value })}
        />
        <Select
          id="tx-filter-amount-unit"
          label="&nbsp;"
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
```

Note on the unit `Select` label: `Select` only renders a `<label>` when `label` is truthy; `" "` keeps vertical alignment with the labelled min/max inputs. If it looks off during visual verification, align with CSS instead (`.amountGroup > :last-child { align-self: flex-end; }`) and drop the label prop.

`transaction-filters.module.css`:

```css
.filterRow {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-quarter) var(--space-half);
    padding-bottom: var(--space-quarter);
    width: 100%;
}

.dateGroup,
.typeGroup,
.amountGroup {
    display: flex;
    flex: 1 1 auto;
    gap: var(--space-quarter);
    min-width: 0;
}

.dateGroup > div,
.typeGroup > div,
.amountGroup > div {
    flex: 1 1 0;
    min-width: 0;
}

@media (max-width: 768px) {
    .filterRow {
        flex-direction: column;
    }

    .dateGroup,
    .amountGroup {
        flex-direction: row;
    }
}
```

(The `> div` selectors target the wrapper divs rendered by `Input`/`Select`. Verify against actual DOM during visual check; adjust if the forms components change structure.)

**Step 4: Run tests**

Run: `cd frontends/web && npx vitest run src/routes/account/components/transaction-filters/transaction-filters.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontends/web/src/routes/account/components/transaction-filters
git commit -m "frontend: add transaction filters component"
```

### Task 6: TransactionList empty state

**Files:**
- Modify: `frontends/web/src/routes/account/components/transaction-list.tsx`

**Step 1: Add `hasActiveFilters` prop and empty-state branch.** In the props type add `hasActiveFilters: boolean;`. In the component, after the `hasSearchTerm` branch (line ~45), insert:

```tsx
if (hasActiveFilters) {
  return (
    <p className={style.emptyTransactions}>
      {t('transactions.filters.noResults')}
    </p>
  );
}
```

(Order: search-term message wins when both are active, since it names the term.) Destructure the new prop alongside the others.

**Step 2: Verify**

Run: `make weblint`
Expected: type error in `account.tsx` (prop not passed yet) is acceptable ONLY if you do Task 7 in the same commit — otherwise pass `hasActiveFilters={false}` temporarily in `account.tsx` and remove it in Task 7. Prefer folding this step's commit into Task 7's commit if simpler.

**Step 3: Commit** (may be combined with Task 7)

```bash
git add frontends/web/src/routes/account/components/transaction-list.tsx
git commit -m "frontend: show filter no-results message in transaction list"
```

### Task 7: Wire everything into account.tsx

**Files:**
- Modify: `frontends/web/src/routes/account/account.tsx`
- Modify: `frontends/web/src/routes/account/account.module.css`

**Step 1: Imports and state.** In `account.tsx`:

- Import: `FilterBlue` (add to the existing `@/components/icon` import), `TransactionFilters` from `./components/transaction-filters/transaction-filters`, `useTransactionFilters` from `./components/transaction-filters/use-transaction-filters`.
- Inside `RemountAccount`, next to the search state (~line 86):

```tsx
const [showFilters, setShowFilters] = useState<boolean>(false);
const { filters, setFilters, clearFilters, isActive: hasActiveFilters, matches } = useTransactionFilters();
```

**Step 2: Extend the filtering `useMemo`** (~line 100). Keep the search logic, add the predicate, and add `matches` to the dependency array:

```tsx
const filteredTransactions = useMemo(() => {
  if (!transactions?.success) {
    return [];
  }
  const searchLower = debouncedSearchTerm.toLowerCase().trim();
  return transactions.list.filter(tx => {
    if (searchLower) {
      const noteMatch = tx.note?.toLowerCase().includes(searchLower);
      const addressMatch = tx.addresses?.some(address => address.toLowerCase().includes(searchLower));
      const txIdMatch = tx.txID?.toLowerCase().includes(searchLower);
      if (!(noteMatch || addressMatch || txIdMatch)) {
        return false;
      }
    }
    return matches(tx);
  });
}, [transactions, debouncedSearchTerm, matches]);
```

**Step 3: Add the Filter button** in the `titleRow`, BEFORE the search button (~line 286), mirroring its structure:

```tsx
<div className={style.titleRowButtons}>
  <Button
    className={style.searchButton}
    transparent
    disabled={!hasTransactions}
    onClick={() => {
      if (showFilters) {
        setShowFilters(false);
        clearFilters();
      } else {
        setShowFilters(true);
      }
    }}
  >
    {showFilters ? (
      <>✕ {t('generic.close')}</>
    ) : (
      <>
        <FilterBlue className={style.loupe} />
        {t('transactions.filters.button')}
      </>
    )}
  </Button>
  {/* existing search Button moves inside this div, unchanged */}
</div>
```

Add to `account.module.css`:

```css
.titleRowButtons {
    align-items: center;
    display: flex;
    gap: var(--space-half);
}
```

**Step 4: Render the filter row** after the search container div (~line 320), reusing the same collapse classes:

```tsx
<div className={`
  ${style.searchContainer || ''}
  ${!showFilters && style.searchHidden || ''}
`}>
  {balance && (
    <TransactionFilters
      filters={filters}
      onFiltersChange={setFilters}
      coinUnit={balance.available.unit}
      fiatUnit={defaultCurrency}
    />
  )}
</div>
```

`defaultCurrency` comes from the existing `useContext(RatesContext)` destructuring (~line 76) — extend it: `const { btcUnit, defaultCurrency } = useContext(RatesContext);`.

**Step 5: Pass the new prop to TransactionList** (~line 327):

```tsx
<TransactionList
  transactionSuccess={transactions?.success ?? false}
  filteredTransactions={filteredTransactions}
  debouncedSearchTerm={debouncedSearchTerm}
  hasActiveFilters={hasActiveFilters}
  onShowDetail={setDetailID}
/>
```

**Step 6: Verify**

Run: `make weblint && make webtest`
Expected: lint + type-check pass, full test suite passes.

**Step 7: Commit**

```bash
git add frontends/web/src/routes/account
git commit -m "frontend: add transaction list filters"
```

### Task 8: Visual verification (desktop + mobile)

**Step 1: Start dev servers.** Backend: `make servewallet` (testnet; note dev state gotcha — run from repo root so `./appfolder.dev` is found). Frontend via the preview tool with `make webdev` (port 8080). Use `localhost`, not `127.0.0.1`.

**Step 2: Desktop check (1280px):** open an account with transactions →
- Filter button appears left of Search, funnel icon, disabled state when no transactions.
- Click: row expands with the same animation as search; From/To/Type/Min/Max/unit laid out in one row.
- Set each filter; list narrows; combined with an open search term (AND).
- Zero matches shows "No transactions match your filters".
- Close (✕): row collapses AND full list returns (filters cleared).
- Native date picker opens on click; unit select shows the coin unit (respects sat setting) and default fiat.

**Step 3: Mobile check (375px width via preview resize):** controls stack per the CSS (dates side by side, type full width, amounts row); title row with two buttons doesn't overflow; tap targets usable.

**Step 4: Dark mode check** (preview color scheme toggle): inputs/selects inherit theme correctly (they should — shared components).

**Step 5: Fix anything found** (source edits, not DOM hacks), re-check, then screenshot desktop + mobile as proof.

**Step 6: Final gate**

Run: `make webtest && make weblint`
Expected: all pass. Then commit any fixes:

```bash
git add -A frontends/web
git commit -m "frontend: polish transaction filter layout"
```

---

## Out of scope (YAGNI, per design)

- Backend filtering, URL/persisted filter state, active-filter badge, reset button, custom date picker, validation UI for min > max, filtering on other fiat currencies than the default.
