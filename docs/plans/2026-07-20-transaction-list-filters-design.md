# Transaction List Filters — Design

Date: 2026-07-20
Status: approved

## Goal

Add a filter option to the account transaction list. A new Filter button sits next to the
existing search button at the top of the list. Clicking it reveals a row of filter controls:

- Start and end date
- Transaction type
- Amount min & max, in either the account's crypto unit or the user's default fiat

Must look good on desktop and mobile and fit the existing design language.

## Decisions

- **Client-side filtering** over the already-loaded transaction list, like the existing search.
  No backend changes.
- **Fiat amounts match the value at transaction time** (`amountAtTime`), agreeing with what the
  list rows display.
- **Search and filters are independent toggles** that can be open simultaneously; criteria
  combine with AND. Closing a row clears its criteria (matches existing search behavior).
- **Native date inputs** (`<input type="date">`), no date-picker dependency. Revisit if the
  native look is unacceptable in the shells.
- **Type filter is a Select** (All types / Sent / Received / Sent to self) using the existing
  forms `Select`.

## UI

- Filter button in the existing `titleRow`, left of the search button, same transparent style:
  new `filter-blue.svg` funnel icon (same stroke style as `LoupeBlue`) + label; becomes
  "✕ Close" when open. Disabled when there are no transactions.
- Filter row expands with the same collapse animation as the search container
  (max-height + opacity).
- Controls: From/To date inputs, Type select, Amount min/max inputs + unit select
  (coin unit e.g. BTC, or default fiat e.g. USD).
- Desktop: single flex row with wrap, grouped [dates] [type] [min max unit].
  Mobile (≤768px): dates 50/50 on one row, type full width, min/max/unit on one row.
- Zero matches with active filters shows a "no transactions match your filters" empty state.
- No active-filter badge and no reset button in v1 — closing the row is the reset.

## Architecture

New files under `src/routes/account/components/transaction-filters/`:

- `transaction-filters.tsx` — presentational filter row; receives state + setters as props.
- `transaction-filters.module.css` — layout, 768px breakpoint.
- `use-transaction-filters.ts` — hook owning filter state: `fromDate`, `toDate`,
  `type` (`'all' | TTransactionType`), `amountMin`, `amountMax`, `amountUnit`
  (`'coin' | 'fiat'`). Returns state, setters, `clearFilters()`, `isActive`, and
  `matches(tx: TTransaction): boolean`.
- `use-transaction-filters.test.ts` — predicate unit tests.

Wiring in `account.tsx`: the existing `filteredTransactions` `useMemo` becomes
`list.filter(tx => matchesSearch(tx) && filters.matches(tx))`. Toggle mirrors search;
closing calls `clearFilters()`. Amount inputs debounced via `useDebounce` (200ms);
date/type apply immediately. Inputs: coin unit from `balance.available.unit`, fiat from
`RatesContext.defaultCurrency`. `TransactionList` gains a `hasActiveFilters`-style prop to
pick the right empty-state message.

## Filtering semantics

- **Dates:** local time; From inclusive at 00:00:00, To inclusive through 23:59:59.999.
  Pending transactions (`time: null`) are treated as "now" and match ranges whose To is
  today or unset.
- **Type:** exact match on `tx.type`; "All types" skips the check.
- **Amount:** absolute values, inclusive bounds, either bound optional.
  - Coin mode: `parseFloat(tx.amount.amount)`.
  - Fiat mode: `tx.amountAtTime.conversions[defaultCurrency]`; conversion strings are
    backend-formatted and may contain thousand separators — parse with a small helper
    (reuse an existing util if one exists; verify against real backend output).
  - Missing conversion while a fiat filter is active → transaction excluded.
  - min > max applies literally (empty result); no validation UI in v1.

## i18n

New keys grouped in `en/app.json`, alphabetically sorted (`make webfix`): button label,
from/to labels, type options, min/max placeholders, no-match empty state.

## Testing

- Hook unit tests: date boundaries, null-time pending, each type, coin bounds,
  fiat-at-time matching, missing-conversion exclusion, combined filters.
- Component test: open → inputs visible; close → filters cleared.
- `make webtest`, `make weblint`, visual check desktop + mobile widths.

## Rejected alternatives

- **Inline in account.tsx:** page component would roughly double; logic untestable in isolation.
- **Backend filtering:** round-trips and Go work for no functional gain at these list sizes.
- **Custom/third-party date picker:** new component surface or dependency; native first.
- **Segmented chips for type:** no existing chip component; Select keeps design surface small.
