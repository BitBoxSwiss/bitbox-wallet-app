# Transaction List Filters — Design

Date: 2026-07-20
Status: implemented (this document describes the shipped design; see Revisions for
where it diverged from the originally approved one)

## Goal

Filter the account transaction list by date range, transaction type, and amount, in
either the account's crypto unit or the user's fiat currency. Must look good on desktop
and mobile and fit the existing design language.

## Decisions

- **Backend filtering and sorting** through query parameters on the account transactions
  endpoint. Text search remains client-side over the returned list.
- **Fiat amounts match the value at transaction time** (`amountAtTime`, or
  `deductedAmountAtTime` for sends and self-transfers), agreeing with what the list rows
  display.
- **Filters live inside the search bar.** The transaction-history header has a single
  "Search" toggle; opening it reveals the search input with a funnel icon-button at its
  right edge, which expands the filter row beneath. Search term and filters combine with
  AND.
- **Closing search clears everything** — search term, filter row, and all filter criteria.
  Collapsing only the filter row (via the funnel) clears just the filters.
- **Native date inputs** (`<input type="date">`), no date-picker dependency.
- **Type filter is a Select** (All types / Sent / Received / Sent to self).
- **Amount unit defaults to fiat**, since fiat is how most users think about value.

## UI

- Title row: "Transaction history" plus a single Search toggle (becomes "✕ Close" when
  open), disabled when there are no transactions.
- Search row: the search input with an icon-only funnel button beside it
  (`aria-label`/`aria-expanded`; background + border while active, matching the input
  field styling).
- Filter row, in order: **Type**, then **From**/**To** dates, then **Min**/**Max** with a
  **Currency** select (account coin unit, or the user's default fiat).
- Labels are secondary grey at `--size-small`, below the "Transaction history" subtitle.
- The browser's `dd.mm.yyyy` format hint is hidden while a date field is empty and
  unfocused, so empty fields show only the calendar icon.
- Both rows expand with the same collapse animation (max-height + opacity;
  `visibility: hidden` when collapsed so controls leave the tab order).
- Desktop: all six controls on one line via proportional zero-basis flex
  (type 3 : dates 6 : amounts 7). Mobile (≤768px): type full width, dates side by side,
  amounts side by side.
- Opening the search scrolls it into view on mobile; opening the filter row does not
  scroll again.
- Zero matches with active filters shows "No transactions match your filters"; a search
  term with no matches keeps its own message naming the term.
- No active-filter badge and no reset button — closing is the reset.

## Architecture

`src/routes/account/components/transaction-filters/`:

- `transaction-filters.tsx` — presentational filter row; receives state + setters as props.
- `transaction-filters.module.css` — layout, 768px breakpoint.
- `use-transaction-filters.ts` — filter state (`fromDate`, `toDate`, `type`, `amountMin`,
  `amountMax`, `amountUnit`, `sortBy`, `sortDir`), plus `clearFilters()`, `isActive`, and
  the debounced `appliedFilters`. Amount inputs are debounced 200ms; other controls apply
  immediately. `isActive` is derived from the debounced view so it never disagrees with
  the backend request.
- `use-transaction-filters.test.ts`, `transaction-filters.test.tsx` — unit tests.

`account.tsx` sends `appliedFilters` and `RatesContext.defaultCurrency` to
`GET /account/{code}/transactions`, and applies only text search to the returned list.
Transaction events trigger a refetch with the current filters. The endpoint also returns
the unfiltered `total`, which keeps account-level empty states independent from filter results.

`backend/accounts/transaction_filter.go` validates filter values and owns matching and stable
sorting. The account handler remains an adapter from query parameters to that backend type.

## Filtering semantics

- **Dates:** local time; From inclusive at 00:00:00, To inclusive through 23:59:59.999.
  Pending transactions (`time: null`) count as "now" and match ranges whose To is today
  or unset.
- **Type:** exact match on `tx.type`; "All types" skips the check.
- **Amount:** absolute values, inclusive bounds, either bound optional.
  - Coin mode: exact rational comparison in the account's display unit.
  - Fiat mode: the backend's historical conversion in `defaultCurrency`, agreeing with
    `amountAtTime`/`deductedAmountAtTime` shown in the row.
  - Missing conversion while a fiat bound is active → transaction excluded.
  - min > max applies literally (empty result); no validation UI.

## i18n

Keys under `transactions.filters` in `en/app.json`, alphabetically sorted
(`make webfix`): button label, from/to, type options, min/max, currency (`unit` key,
value "Currency"), no-match empty state.

## Testing

- Backend unit tests: parameter validation, date boundaries, null-time pending, each type,
  exact coin bounds, historical fiat matching, missing-conversion exclusion, combined
  filters, every sort mode/direction, and stable ties.
- Hook unit tests: debounce timing, applied filter state, and `isActive` consistency.
- Component tests: all controls render with labels, coin+fiat options offered, every
  control propagates its change, unit select has an accessible name.
- `make webtest`, `make weblint`, visual check desktop + mobile + dark mode.

## Revisions after the initial implementation

The first implementation followed the originally approved design; these changes came from
review of the working UI:

1. **Filter entry point moved into the search bar.** Originally a standalone "Filter"
   button sat beside "Search" in the title row, with both rows toggling independently.
   That showed the filter affordance at all times and produced two adjacent "✕ Close"
   buttons when both rows were open. Cost: filtering is less discoverable for users who
   never open search.
2. **Control order** changed to type-first (was dates-first).
3. **Amount unit default** changed from the account's coin to the user's fiat.
4. **One-row desktop layout** — the groups originally used `flex-basis: auto` and wrapped
   onto two lines.
5. **Label styling** as secondary grey text, and the currency select gained a real
   visible label (it previously used a spacer label plus `aria-label`).
6. **No scroll-into-view when opening the filter row** (search still scrolls).
7. **Shared `Select` focus style** — dropdowns showed the OS accent focus ring, which
   persisted after choosing an option; they now use the same blue focus border as `Input`.
   This applies app-wide, not only to the filter row.
8. **Filtering and sorting moved to the backend.** The frontend now sends filter query
   parameters and retains only text search locally.

## Rejected alternatives

- **Inline in account.tsx:** page component would roughly double; logic untestable in
  isolation.
- **Backend text search:** notes, addresses, and transaction IDs are already present in the
  filtered response, so the existing immediate client-side search remains appropriate.
- **Custom/third-party date picker:** new component surface or dependency; native first.
- **Segmented chips for type:** no existing chip component; Select keeps design surface small.
