// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TPaymentInputType } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { useLightning } from '@/hooks/lightning';
import { LightningActivate } from '../activate';
import { Send } from './send';

vi.mock('@/i18n/i18n');
vi.mock('@/hooks/lightning', () => ({ useLightning: vi.fn() }));

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
    postActivate: vi.fn(),
    getParsePaymentInput: vi.fn(),
    postPreparePayment: vi.fn(),
    postSendPayment: vi.fn(),
    postClearLightningURI: vi.fn().mockResolvedValue({ success: true, data: null }),
  };
});

vi.mock('@/api/keystores', () => ({
  getKeystores: vi.fn().mockResolvedValue([{ type: 'hardware' }]),
  subscribeKeystores: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('../guide', () => ({
  LightningSendGuide: () => null,
}));

vi.mock('./components/select-payment-input-step', () => ({
  SelectPaymentInputStep: ({
    onSubmit,
    inputError,
    initialValue,
  }: {
    onSubmit: (input: string) => Promise<boolean>;
    inputError?: string;
    initialValue?: string;
  }) => (
    <>
      <span>{inputError}</span>
      <input aria-label="payment input" value={initialValue ?? ''} readOnly />
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

vi.mock('./components/payment-input-details', () => ({
  BitcoinAddressRecipientDetails: () => null,
  Bolt11PaymentDetails: () => null,
  LNURLPayRecipientDetails: () => null,
  PaymentAmountDetails: () => null,
  PaymentFeeDetails: () => null,
  PaymentNoteDetails: () => null,
}));

vi.mock('./components/success-step', () => ({
  SuccessStep: () => <span>payment sent</span>,
}));

const LocationPath = () => {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
};

const SendTest = ({ uriRequest, initialPath = '/lightning/send' }: {
  uriRequest?: lightningApi.TLightningURI;
  initialPath?: string;
}) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <BackButtonProvider>
      <Routes>
        <Route path="/lightning/send" element={<Send activeAccounts={[]} uriRequest={uriRequest} />} />
        <Route path="/lightning/activate" element={(
          <LightningActivate hasPendingPayment={uriRequest !== undefined && uriRequest.input !== null} />
        )} />
        <Route path="/lightning" element={<span>Lightning overview</span>} />
        <Route path="/" element={<span>Home</span>} />
      </Routes>
      <LocationPath />
    </BackButtonProvider>
  </MemoryRouter>
);

const startActivation = () => {
  fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'button.next' }));
  fireEvent.click(screen.getByRole('button', { name: 'lightning.disclaimer.continue' }));
};

const pressSystemBack = () => {
  act(() => {
    expect(window.onBackButtonPressed?.()).toBe(false);
  });
};

describe('Lightning Send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLightning).mockReturnValue({
      isLightningReady: true,
      lightningAccount: { code: 'lightning', num: 0, rootFingerprint: '12345678' },
      lightningSDKStatus: 'ready',
    });
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
        invoice: 'lnbc1invoice',
      },
    });
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 100,
      feeSat: 1,
      totalDebitSat: 101,
    });
  });

  it('allows back from review but blocks it while sending', async () => {
    let resolvePayment: () => void = () => {};
    vi.mocked(lightningApi.postSendPayment).mockReturnValue(new Promise<void>(resolve => {
      resolvePayment = resolve;
    }));
    render(<SendTest />);

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

  it.each<lightningApi.TPaymentInput>([
    {
      type: TPaymentInputType.LNURL_PAY,
      lnurlPay: {
        input: 'alice@example.com',
        domain: 'example.com',
        minAmountSat: 1,
        maxAmountSat: 1_000,
      },
    },
    {
      type: TPaymentInputType.BITCOIN_ADDRESS,
      bitcoinAddress: { address: 'bc1qrecipient', amountSat: 100 },
    },
  ])('keeps $type retry identity when links arrive during and after a failed send', async paymentInput => {
    const idempotencyKey = '00000000-0000-4000-8000-000000000001';
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValueOnce(paymentInput);
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({
      amountSat: 100,
      feeSat: 1,
      idempotencyKey,
      totalDebitSat: 101,
    });
    let rejectPayment: (reason?: unknown) => void = () => {};
    vi.mocked(lightningApi.postSendPayment)
      .mockReset()
      .mockImplementation(() => new Promise<void>((_, reject) => {
        rejectPayment = reject;
      }));
    const { rerender } = render(<SendTest />);

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    if (paymentInput.type === TPaymentInputType.LNURL_PAY) {
      const amountInput = await screen.findByRole('textbox', { name: 'custom amount' });
      fireEvent.change(amountInput, { target: { value: '100' } });
    }
    const sendButton = await screen.findByRole('button', { name: 'generic.send' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.click(sendButton);

    expect(await screen.findByText('lightning.send.sending.connecting')).toBeInTheDocument();
    rerender(<SendTest uriRequest={{ revision: 1, input: 'queued' }} />);
    await act(async () => rejectPayment(new Error('response lost')));

    expect(await screen.findByText('Error: response lost')).toBeInTheDocument();
    rerender(<SendTest uriRequest={{ revision: 2, input: 'latest' }} />);
    expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled();
    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledTimes(1);
    expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'generic.send' }));
    await act(async () => rejectPayment(new Error('retry response lost')));
    expect(await screen.findByText('Error: retry response lost')).toBeInTheDocument();
    expect(lightningApi.postSendPayment).toHaveBeenCalledTimes(2);
    expect(lightningApi.postSendPayment).toHaveBeenNthCalledWith(1, expect.objectContaining({
      amountSat: 100,
      idempotencyKey,
    }));
    expect(lightningApi.postSendPayment).toHaveBeenNthCalledWith(2, vi.mocked(lightningApi.postSendPayment).mock.calls[0]?.[0]);
    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);

    pressSystemBack();
    await waitFor(() => expect(lightningApi.postClearLightningURI).toHaveBeenCalledWith(2));
    expect(lightningApi.getParsePaymentInput).toHaveBeenLastCalledWith({ s: 'latest' });
  });

  it('waits for SDK startup, then reviews a link without sending it', async () => {
    const request = { revision: 1, input: 'lnbc1invoice' };
    const ready = vi.mocked(useLightning)();
    vi.mocked(useLightning).mockReturnValue({ ...ready, isLightningReady: false, lightningSDKStatus: 'initializing' });
    const { rerender } = render(<SendTest uriRequest={request} />);

    expect(screen.getByText('lightning.initializing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'dialog.cancel' })).toBeEnabled();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();

    vi.mocked(useLightning).mockReturnValue(ready);
    rerender(<SendTest uriRequest={request} />);
    await screen.findByRole('button', { name: 'generic.send' });
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledWith({ s: request.input });
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledWith(request.revision);
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
  });

  it.each(['invalid', ''])('passes invalid link input %j to manual entry', async input => {
    vi.mocked(lightningApi.getParsePaymentInput).mockRejectedValue(new Error('invalid invoice'));
    render(<SendTest uriRequest={{ revision: 1, input }} />);
    expect(await screen.findByText('Error: invalid invoice')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'payment input' })).toHaveValue(input);
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledWith({ s: input });
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledWith(1);
  });

  it('ignores a stale parse response after a newer link arrives', async () => {
    let resolveFirst: (value: lightningApi.TPaymentInput) => void = () => {};
    vi.mocked(lightningApi.getParsePaymentInput).mockReturnValueOnce(new Promise(resolve => {
      resolveFirst = resolve;
    }));
    const { rerender } = render(<SendTest uriRequest={{ revision: 1, input: 'first' }} />);
    rerender(<SendTest uriRequest={{ revision: 2, input: 'second' }} />);
    await screen.findByRole('button', { name: 'generic.send' });
    await act(async () => resolveFirst({
      type: TPaymentInputType.BOLT11,
      invoice: { invoice: 'first', amountSat: 999 },
    }));
    expect(lightningApi.postPreparePayment).toHaveBeenCalledTimes(1);
    expect(lightningApi.postPreparePayment).toHaveBeenCalledWith(expect.objectContaining({ paymentInput: 'lnbc1invoice' }));
  });

  it('defers a new link while sending', async () => {
    let resolvePayment: () => void = () => {};
    vi.mocked(lightningApi.postSendPayment).mockReturnValue(new Promise(resolve => {
      resolvePayment = resolve;
    }));
    const { rerender } = render(<SendTest />);
    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    const sendButton = await screen.findByRole('button', { name: 'generic.send' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.click(sendButton);
    await screen.findByText('lightning.send.sending.connecting');
    rerender(<SendTest uriRequest={{ revision: 1, input: 'next' }} />);
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledTimes(1);
    expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();

    await act(async () => resolvePayment());
    await waitFor(() => expect(lightningApi.getParsePaymentInput).toHaveBeenCalledWith({ s: 'next' }));
    expect(lightningApi.postSendPayment).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh review when the same amountless link is clicked again', async () => {
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue({
      type: TPaymentInputType.BOLT11,
      invoice: { invoice: 'lnbc1amountless' },
    });
    const input = 'lnbc1amountless';
    const { rerender } = render(<SendTest uriRequest={{ revision: 1, input }} />);
    const amount = await screen.findByRole('textbox', { name: 'custom amount' });
    fireEvent.change(amount, { target: { value: '100' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled());

    rerender(<SendTest uriRequest={{ revision: 3, input }} />);
    expect(await screen.findByRole('textbox', { name: 'custom amount' })).toHaveValue('');
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
    pressSystemBack();
    expect(screen.getByRole('textbox', { name: 'payment input' })).toHaveValue(input);
  });

  it('retains a payment through failed activation and opens it after retry', async () => {
    const request = { revision: 1, input: 'lnbc1invoice' };
    const ready = vi.mocked(useLightning)();
    vi.mocked(useLightning).mockReturnValue({
      isLightningReady: false, lightningSDKStatus: 'inactive', lightningAccount: null,
    });
    let resolveActivation: () => void = () => {};
    const activation = new Promise<void>(resolve => {
      resolveActivation = resolve;
    });
    vi.mocked(lightningApi.postActivate)
      .mockRejectedValueOnce(new Error('activation failed'))
      .mockReturnValueOnce(activation);
    const { rerender } = render(<SendTest uriRequest={request} />);

    fireEvent.click(screen.getByRole('button', { name: 'lightning.activate.title' }));
    expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();
    await screen.findByText('lightning.activate.intro.content');
    startActivation();
    expect(await screen.findByText('Error: activation failed')).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/activate');
    expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'lightning.disclaimer.continue' }));
    await waitFor(() => expect(lightningApi.postActivate).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/activate');
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();

    vi.mocked(useLightning).mockReturnValue({ ...ready, isLightningReady: false, lightningSDKStatus: 'initializing' });
    rerender(<SendTest uriRequest={request} />);
    await act(async () => resolveActivation());
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/send');
    expect(screen.getByText('lightning.initializing')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();

    vi.mocked(useLightning).mockReturnValue(ready);
    rerender(<SendTest uriRequest={request} />);
    await screen.findByRole('button', { name: 'generic.send' });
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: request.input });
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledWith(request.revision);
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
  });

  it('keeps the normal activation success screen when no payment is pending', async () => {
    vi.mocked(lightningApi.postActivate).mockResolvedValueOnce(undefined);
    render(<SendTest initialPath="/lightning/activate" />);
    await screen.findByText('lightning.activate.intro.content');
    startActivation();

    expect(await screen.findByText('lightning.activate.success.message')).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/activate');
    fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
    expect(screen.getByText('Lightning overview')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
  });

  it.each([
    ['initializing', 'lightning.initializing'],
    ['inactive', 'lightning.send.activationRequired'],
    ['failed', 'lightning.initializationFailed'],
  ] as const)('shows feedback and allows cancellation when the SDK is %s', (status, message) => {
    vi.mocked(useLightning).mockReturnValue({
      ...vi.mocked(useLightning)(),
      isLightningReady: false,
      lightningSDKStatus: status,
      ...(status === 'inactive' ? { lightningAccount: null } : {}),
    });
    render(<SendTest uriRequest={{ revision: 1, input: 'invoice' }} />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }));
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('location-path').textContent).toBe(status === 'inactive' ? '/' : '/lightning');
  });
});
