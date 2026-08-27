# Transaction List Filters — Design

Date: 2026-07-20
Status: implemented (this document describes the shipped design; see Revisions for
where it diverged from the originally approved one)

## Goal

Filter the account transaction list by date range and transaction type, and sort it by
date, crypto amount, or type. Must look good on desktop and mobile and fit the existing
design language.

## Decisions

- **Backend search, filtering, and sorting** through query parameters on the account
  transactions endpoint.
- **Filters live inside the search bar.** The transaction-history header has a single
  "Search" toggle; opening it reveals the search input with a funnel icon-button at its
  right edge, which expands the filter row beneath. Search term and filters combine with
  AND.
- **Closing search clears everything** — search term, filter row, and all filter criteria.
  Collapsing only the filter row (via the funnel) clears just the filters.
- **Native date inputs** (`<input type="date">`), no date-picker dependency.
- **Type filter is a Select** (All types / Sent / Received / Sent to self).
- **Sort controls** select date, account cryptocurrency amount, or type and ascending or
  descending order. The amount option names the current account's cryptocurrency.

## UI

- Title row: "Transaction history" plus a single Search toggle (becomes "✕ Close" when
  open), disabled when there are no transactions.
- Search row: the search input with an icon-only funnel button beside it
  (`aria-label`/`aria-expanded`; background + border while active, matching the input
  field styling).
- Filter row, in order: **Sort by** with a direction button, **Type**, then **From**/**To**
  dates.
- Labels are secondary grey at `--size-small`, below the "Transaction history" subtitle.
- The browser's `dd.mm.yyyy` format hint is hidden while a date field is empty and
  unfocused, so empty fields show only the calendar icon.
- Both rows expand with the same collapse animation (max-height + opacity;
  `visibility: hidden` when collapsed so controls leave the tab order).
- Desktop: all controls on one line via proportional zero-basis flex. Mobile (≤768px):
  sort and type share the first line, with the dates side by side below.
- Opening the search scrolls it into view on mobile; opening the filter row does not
  scroll again.
- Zero matches with active filters shows "No transactions match your filters"; a search
  term with no matches keeps its own message naming the term.
- No active-filter badge and no reset button — closing is the reset.

## Architecture

`src/routes/account/components/transaction-filters/`:

- `transaction-filters.tsx` — presentational filter row; receives state + setters as props.
- `transaction-filters.module.css` — layout, 768px breakpoint.
- `use-transaction-filters.ts` — filter state (`fromDate`, `toDate`, `type`, `sortBy`,
  `sortDir`), plus `clearFilters()` and `isActive`.
- `use-transaction-filters.test.ts`, `transaction-filters.test.tsx` — unit tests.

`account.tsx` sends the debounced search term and filter state to
`GET /account/{code}/transactions`. Transaction events trigger a refetch with the current
query. The endpoint also returns the unfiltered `total`, which keeps account-level empty
states independent from search and filter results.

`backend/accounts/transaction_filter.go` validates filter values and owns matching and stable
sorting. The account handler remains an adapter from query parameters to that backend type.

## Filtering semantics

- **Dates:** local time; From inclusive at 00:00:00, To inclusive through 23:59:59.999.
  Pending transactions (`time: null`) count as "now" and match ranges whose To is today
  or unset.
- **Type:** exact match on `tx.type`; "All types" skips the check.
- **Search:** case-insensitive substring match over transaction notes, addresses, and
  transaction IDs; surrounding whitespace is ignored.
## i18n

Keys under `transactions.filters` in `en/app.json`, alphabetically sorted
(`make webfix`): button label, from/to, type and sort options (including the interpolated
account cryptocurrency name), direction labels, and the no-match empty state.

## Testing

- Backend unit tests: search across notes/addresses/transaction IDs, parameter validation,
  date boundaries, null-time pending, each type, every sort mode/direction, and stable ties.
- Hook unit tests: filter state, clearing, and `isActive` consistency.
- Component tests: all controls render with labels and every control propagates its change.
- `make webtest`, `make weblint`, visual check desktop + mobile + dark mode.

## Revisions after the initial implementation

The first implementation followed the originally approved design; these changes came from
review of the working UI:

1. **Filter entry point moved into the search bar.** Originally a standalone "Filter"
   button sat beside "Search" in the title row, with both rows toggling independently.
   That showed the filter affordance at all times and produced two adjacent "✕ Close"
   buttons when both rows were open. Cost: filtering is less discoverable for users who
   never open search.
2. **Control order** changed to put type before the dates; the sort controls were later
   added ahead of type.
3. **Amount bounds removed.** Min, max, and currency controls and their backend query
   parameters were removed to simplify the filter surface; amount remains available as a
   sort field.
4. **One-row desktop layout** — the groups originally used `flex-basis: auto` and wrapped
   onto two lines.
5. **Label styling** as secondary grey text.
6. **No scroll-into-view when opening the filter row** (search still scrolls).
7. **Shared `Select` focus style** — dropdowns showed the OS accent focus ring, which
   persisted after choosing an option; they now use the same blue focus border as `Input`.
   This applies app-wide, not only to the filter row.
8. **Filtering and sorting moved to the backend.** The frontend now sends filter query
   parameters while initially retaining text search locally.
9. **Text search moved to the backend.** The frontend now includes its debounced search term
   in the transaction-list query alongside the structured filters.

## Rejected alternatives

- **Inline in account.tsx:** page component would roughly double; logic untestable in
  isolation.
- **Client-side text search:** superseded by the backend-search revision above so all
  transaction list matching is owned by the backend.
- **Custom/third-party date picker:** new component surface or dependency; native first.
- **Segmented chips for type:** no existing chip component; Select keeps design surface small.
