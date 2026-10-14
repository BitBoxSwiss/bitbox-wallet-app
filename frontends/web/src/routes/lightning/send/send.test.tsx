// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TPaymentInputType } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { AppStateContext } from '@/contexts/app-state-context';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { Send } from './send';

vi.mock('@/i18n/i18n');

vi.mock('@/components/layout', async () => {
  const { Header } = await import('@/components/layout/header');
  return {
    Column: ({ children }: { children: ReactNode }) => <>{children}</>,
    Grid: ({ children }: { children: ReactNode }) => <>{children}</>,
    GuideWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    GuidedContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    Header,
    Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  };
});

vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => hidden ? null : <>{children}</>,
}));

vi.mock('@/api/lightning', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/lightning')>();
  return {
    ...actual,
    getParsePaymentInput: vi.fn(),
    postPreparePayment: vi.fn(),
    postSendPayment: vi.fn(),
  };
});

vi.mock('@/api/coins', () => ({
  getBtcSatAmount: vi.fn(({ amount }: { amount: string }) => Promise.resolve({
    success: true,
    amount: { amount, unit: 'sat' },
  })),
}));

vi.mock('../guide', () => ({
  LightningSendGuide: () => null,
}));

vi.mock('./components/select-payment-input-step', () => ({
  SelectPaymentInputStep: ({
    inputError,
    onSubmit,
  }: {
    inputError?: string;
    onSubmit: (input: string) => Promise<boolean>;
  }) => (
    <>
      {inputError && <span>{inputError}</span>}
      <button onClick={() => onSubmit('lnbc1invoice')}>review payment</button>
    </>
  ),
}));

vi.mock('./components/custom-payment-amount', async () => {
  const { useEffect, useState } = await import('react');
  return {
    CustomPaymentAmount: ({
      onAmountChange,
    }: {
      onAmountChange: (amountSat?: number) => void;
    }) => {
      const [amount, setAmount] = useState('');
      useEffect(() => {
        onAmountChange(amount ? Number(amount) : undefined);
      }, [amount, onAmountChange]);
      return (
        <input
          aria-label="custom amount"
          onChange={event => setAmount(event.target.value)}
          value={amount}
        />
      );
    },
    PaymentBalance: () => null,
  };
});

vi.mock('./components/success-step', () => ({
  SuccessStep: () => <span>payment sent</span>,
}));

const LocationPath = () => {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
};

const renderSend = () => render(
  <MemoryRouter initialEntries={['/lightning/send']}>
    <BackButtonProvider>
      <AppStateContext.Provider
        value={{
          accounts: [],
          activeAccounts: [],
          deviceIDs: [],
          devices: {},
          hasAccounts: true,
          hasBottomNavigation: false,
          hasDevices: false,
          lightningAccount: undefined,
          hasLightningAccount: false,
        }}
      >
        <Send />
        <LocationPath />
      </AppStateContext.Provider>
    </BackButtonProvider>
  </MemoryRouter>
);

const pressSystemBack = () => {
  act(() => {
    expect(window.onBackButtonPressed?.()).toBe(false);
  });
};

describe('Lightning Send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue({
      type: TPaymentInputType.BOLT11,
      invoice: {
        amountSat: 100,
        description: 'Invoice note',
        invoice: 'lnbc1invoice',
      },
    });
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 100,
      feeSat: 1,
      totalDebitSat: 101,
    });
  });

  it.each([false, true])('keeps an unaffordable fixed invoice on review (fee quote: %s)', async (hasFees) => {
    vi.mocked(lightningApi.postPreparePayment).mockRejectedValue(new TSdkError(
      'insufficient funds',
      TLightningErrorCode.INSUFFICIENT_FUNDS,
      hasFees ? { amountSat: 100, feeSat: 1, totalDebitSat: 101 } : undefined,
    ));
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));

    expect(await screen.findByText('error.lightningInsufficientFunds')).toBeInTheDocument();
    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('Invoice note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'generic.send' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'review payment' })).not.toBeInTheDocument();
    if (hasFees) {
      expect(screen.getByText('send.fee.label')).toBeInTheDocument();
      expect(screen.getByText('101')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('send.fee.label')).not.toBeInTheDocument();
    }
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();

    pressSystemBack();
    expect(screen.getByRole('button', { name: 'review payment' })).toBeInTheDocument();
  });

  it('returns to payment entry for an already-used fixed invoice', async () => {
    vi.mocked(lightningApi.postPreparePayment).mockRejectedValue(new TSdkError(
      'invoice already used',
      TLightningErrorCode.INVOICE_ALREADY_USED,
    ));
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));

    expect(await screen.findByText('error.lightningInvoiceAlreadyUsed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'review payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'generic.send' })).not.toBeInTheDocument();
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
  });

  it('keeps an unaffordable fixed Bitcoin amount on review', async () => {
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue({
      type: TPaymentInputType.BITCOIN_ADDRESS,
      bitcoinAddress: { address: 'bc1qrecipient', amountSat: 100 },
    });
    vi.mocked(lightningApi.postPreparePayment).mockRejectedValue(new TSdkError(
      'insufficient funds',
      TLightningErrorCode.INSUFFICIENT_FUNDS,
    ));
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));

    expect(await screen.findByText('error.lightningInsufficientFunds')).toBeInTheDocument();
    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('bc1qrecipient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'generic.send' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'review payment' })).not.toBeInTheDocument();
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
  });

  it.each([TPaymentInputType.BOLT11, TPaymentInputType.LNURL_PAY])(
    'allows correcting an unaffordable custom amount for %s', async (type) => {
      vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue(type === TPaymentInputType.BOLT11 ? {
        type: TPaymentInputType.BOLT11,
        invoice: { invoice: 'lnbc1invoice' },
      } : {
        type: TPaymentInputType.LNURL_PAY,
        lnurlPay: { input: 'alice@example.com', domain: 'example.com', minAmountSat: 1, maxAmountSat: 1_000 },
      });
      vi.mocked(lightningApi.postPreparePayment).mockRejectedValueOnce(new TSdkError(
        'insufficient funds',
        TLightningErrorCode.INSUFFICIENT_FUNDS,
      ));
      renderSend();

      fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
      const amountInput = await screen.findByRole('textbox', { name: 'custom amount' });
      fireEvent.change(amountInput, { target: { value: '200' } });

      expect(await screen.findByText('error.lightningInsufficientFunds')).toBeInTheDocument();
      expect(amountInput).toHaveValue('200');
      expect(screen.getByRole('button', { name: 'generic.send' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'review payment' })).not.toBeInTheDocument();

      fireEvent.change(amountInput, { target: { value: '100' } });

      await waitFor(() => expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled());
      expect(screen.queryByText('error.lightningInsufficientFunds')).not.toBeInTheDocument();
      expect(lightningApi.postPreparePayment).toHaveBeenLastCalledWith(expect.objectContaining({ amountSat: 100 }));
      expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
    },
  );

  it('allows back from review but blocks it while sending', async () => {
    let resolvePayment: () => void = () => {};
    vi.mocked(lightningApi.postSendPayment).mockReturnValue(new Promise<void>(resolve => {
      resolvePayment = resolve;
    }));
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'button.back' })).toBeInTheDocument();

    pressSystemBack();
    expect(screen.getByRole('button', { name: 'review payment' })).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/send');

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    const sendButton = await screen.findByRole('button', { name: 'generic.send' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.click(sendButton);

    expect(await screen.findByText('lightning.send.sending.connecting')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'button.back' })).not.toBeInTheDocument());
    pressSystemBack();

    expect(screen.getByText('lightning.send.sending.connecting')).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/send');

    await act(async () => {
      resolvePayment();
    });
    expect(await screen.findByText('payment sent')).toBeInTheDocument();
  });

  it('keeps LNURL payment review mounted after a send error', async () => {
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue({
      type: TPaymentInputType.LNURL_PAY,
      lnurlPay: {
        input: 'alice@example.com',
        domain: 'example.com',
        minAmountSat: 1,
        maxAmountSat: 1_000,
      },
    });
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 100,
      feeSat: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      totalDebitSat: 101,
    });
    let rejectPayment: (reason?: unknown) => void = () => {};
    vi.mocked(lightningApi.postSendPayment).mockReturnValue(new Promise<void>((_, reject) => {
      rejectPayment = reject;
    }));
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    const amountInput = await screen.findByRole('textbox', { name: 'custom amount' });
    fireEvent.change(amountInput, { target: { value: '100' } });
    const sendButton = await screen.findByRole('button', { name: 'generic.send' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.click(sendButton);

    expect(await screen.findByText('lightning.send.sending.connecting')).toBeInTheDocument();
    await act(async () => rejectPayment(new Error('response lost')));

    expect(await screen.findByRole('textbox', { name: 'custom amount' })).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled();
    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);
  });
});
