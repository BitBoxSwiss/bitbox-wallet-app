// SPDX-License-Identifier: Apache-2.0

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './toast';

const TestToastTrigger = () => {
  const { clearToasts, showToast } = useToast();
  return (
    <>
      <button onClick={() => showToast({ duration: 2000, message: 'Toast message', type: 'warning' })}>
        Trigger toast
      </button>
      <button onClick={() => showToast({ message: 'Persistent toast', persistent: true, type: 'warning' })}>
        Trigger persistent toast
      </button>
      <button onClick={clearToasts}>
        Clear toasts
      </button>
    </>
  );
};

describe('components/toast/toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows and auto-dismisses a toast', () => {
    render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger toast' }));

    expect(screen.getByText('Toast message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.queryByText('Toast message')).not.toBeInTheDocument();
  });

  it('clears all visible toasts', () => {
    render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger toast' }));

    expect(screen.getByText('Toast message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear toasts' }));

    expect(screen.queryByText('Toast message')).not.toBeInTheDocument();
  });

  it('keeps a persistent toast visible until dismissed', () => {
    render(
      <ToastProvider>
        <TestToastTrigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Trigger persistent toast' }));

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText('Persistent toast')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close toast' }));

    expect(screen.queryByText('Persistent toast')).not.toBeInTheDocument();
  });
});
