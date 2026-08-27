// SPDX-License-Identifier: Apache-2.0

import i18n from '../../../../../__mocks__/i18n';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransactionFilters } from './transaction-filters';
import { emptyFilters } from './use-transaction-filters';

describe('TransactionFilters', () => {
  const defaultProps = {
    coinName: 'Bitcoin',
    filters: emptyFilters,
    onFiltersChange: vi.fn(),
  };

  it('renders all filter controls', () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByLabelText('transactions.filters.from')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.to')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.type')).toBeInTheDocument();
    expect(screen.getByLabelText('transactions.filters.sortBy')).toBeInTheDocument();
  });

  it('names the amount sort option after the account cryptocurrency', () => {
    i18n.addResource('en', 'translation', 'transactions.filters.sortAmount', 'Amount ({{coinName}})');
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Amount (Bitcoin)' })).toBeInTheDocument();
  });

  it('propagates sort field and direction changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.sortBy'), { target: { value: 'amount' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, sortBy: 'amount' });
    // default direction is descending; the toggle switches to ascending
    fireEvent.click(screen.getByRole('button', { name: 'transactions.filters.sortDescending' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, sortDir: 'asc' });
  });

  it('labels the direction toggle with the current direction', () => {
    render(<TransactionFilters {...defaultProps} filters={{ ...emptyFilters, sortDir: 'asc' }} />);
    expect(screen.getByRole('button', { name: 'transactions.filters.sortAscending' })).toBeInTheDocument();
  });

  it('propagates changes via onFiltersChange', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.type'), { target: { value: 'send' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, type: 'send' });
  });

  it('propagates date changes', () => {
    const onFiltersChange = vi.fn();
    render(<TransactionFilters {...defaultProps} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByLabelText('transactions.filters.from'), { target: { value: '2026-07-01' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, fromDate: '2026-07-01' });
    fireEvent.change(screen.getByLabelText('transactions.filters.to'), { target: { value: '2026-07-31' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...emptyFilters, toDate: '2026-07-31' });
  });
});
