// SPDX-License-Identifier: Apache-2.0

import '../../../__mocks__/i18n';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocation } from 'wouter';
import { MemoryRouter } from '@/utils/test-helpers';
import { TPaymentInputType } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { TLightningErrorCode, TSdkError } from '@/api/lightning-errors';
import { AppContext } from '@/contexts/AppContext';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { useLightning } from '@/hooks/lightning';
import { isLightningFeatureAvailable } from '@/utils/env';
import { LightningPaymentRequest } from './lightning-payment-request';

const mocks = vi.hoisted(() => ({ pageUnmounted: vi.fn(), setHideTestnetBanner: vi.fn() }));
let onURI: (request: lightningApi.TLightningURI) => void;

vi.mock('@/i18n/i18n');
vi.mock('@/utils/env', async importOriginal => ({
  ...await importOriginal<typeof import('@/utils/env')>(),
  isLightningFeatureAvailable: vi.fn(),
}));
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
    getLightningURI: vi.fn(),
    subscribeLightningURI: vi.fn(),
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

vi.mock('@/routes/lightning/send/components/custom-payment-amount', async () => {
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

vi.mock('@/routes/lightning/send/components/payment-input-details', () => ({
  BitcoinAddressRecipientDetails: () => null,
  Bolt11PaymentDetails: () => null,
  LNURLPayRecipientDetails: () => null,
  PaymentAmountDetails: () => null,
  PaymentFeeDetails: () => null,
  PaymentNoteDetails: () => null,
}));

const UnderlyingPage = () => {
  const [pathname, navigate] = useLocation();
  const [draft, setDraft] = useState('');
  useEffect(() => () => {
    mocks.pageUnmounted();
  }, []);
  return (
    <>
      <span data-testid="location">{pathname}</span>
      <input aria-label="unsaved draft" value={draft} onChange={event => setDraft(event.target.value)} />
      <button onClick={() => navigate('/lightning')}>leave transaction</button>
    </>
  );
};

const TestApp = ({ testing = false }: { testing?: boolean | undefined }) => {
  const app = useContext(AppContext);
  const [accepted, setAccepted] = useState(false);
  return (
    <AppContext.Provider value={{
      ...app,
      isTesting: testing,
      setHideTestnetBanner: mocks.setHideTestnetBanner,
      sessionConfig: { lightningTestnetWarningAccepted: accepted },
      updateSessionConfig: () => setAccepted(true),
    }}>
      <BackButtonProvider>
        <LightningPaymentRequest />
        <UnderlyingPage />
      </BackButtonProvider>
    </AppContext.Provider>
  );
};

const renderApp = (pathname = '/account-summary', testing = false) => render(
  <MemoryRouter initialEntries={[pathname]}><TestApp testing={testing} /></MemoryRouter>
);

const deliver = (revision: number, input: string | null) => act(() => onURI({ revision, input }));
const back = () => act(() => {
  expect(window.onBackButtonPressed?.()).toBe(false);
});
const review = async () => {
  const button = await screen.findByRole('button', { name: 'generic.send' });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
};
const invoice = (value: string): lightningApi.TPaymentInput => ({
  type: TPaymentInputType.BOLT11,
  invoice: { invoice: value, amountSat: 100 },
});

describe('Lightning payment request overlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isLightningFeatureAvailable).mockReturnValue(true);
    vi.mocked(useLightning).mockReturnValue({
      isLightningReady: true,
      lightningAccount: { code: 'lightning', coinCode: 'lightning', num: 0, rootFingerprint: '12345678' },
      lightningSDKStatus: 'ready',
    });
    vi.mocked(window.matchMedia).mockImplementation(query => ({
      matches: true, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
      removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    vi.mocked(lightningApi.getLightningURI).mockResolvedValue({ revision: 0, input: null });
    vi.mocked(lightningApi.subscribeLightningURI).mockImplementation(callback => {
      onURI = callback;
      return vi.fn();
    });
    vi.mocked(lightningApi.postClearLightningURI).mockResolvedValue({ success: true, data: null });
    vi.mocked(lightningApi.getParsePaymentInput).mockReset().mockImplementation(async ({ s }) => invoice(s));
    vi.mocked(lightningApi.postPreparePayment).mockReset().mockResolvedValue({
      amountSat: 100, feeSat: 1, totalDebitSat: 101,
    });
    vi.mocked(lightningApi.postSendPayment).mockReset();
  });

  // A retained launch request opens above the current page, preserving its URL and unsaved input.
  it('reviews and dismisses a startup link without navigating or unmounting the page', async () => {
    vi.mocked(lightningApi.getLightningURI).mockResolvedValue({ revision: 1, input: 'first' });
    renderApp();
    fireEvent.change(screen.getByRole('textbox', { name: 'unsaved draft' }), { target: { value: 'keep me' } });
    const historyLength = window.history.length;
    await review();
    expect(lightningApi.postSendPayment).not.toHaveBeenCalled();
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledExactlyOnceWith(1);
    deliver(2, null);
    back();
    expect(screen.queryByRole('button', { name: 'generic.send' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/account-summary');
    expect(window.history.length).toBe(historyLength);
    expect(screen.getByRole('textbox', { name: 'unsaved draft' })).toHaveValue('keep me');
    expect(mocks.pageUnmounted).not.toHaveBeenCalled();
  });

  // Activation stays a separate user action; external requests cannot initiate or resume setup.
  it('only shows an activation-required message when Lightning is inactive', async () => {
    vi.mocked(useLightning).mockReturnValue({
      isLightningReady: false, lightningAccount: null, lightningSDKStatus: 'inactive',
    });
    renderApp();
    deliver(1, 'first');
    expect(await screen.findByText('lightning.send.activationRequired')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    expect(lightningApi.postActivate).not.toHaveBeenCalled();
    expect(screen.queryByText('lightning.activate.title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'dialog.cancel' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/account-summary');
    expect(screen.queryByText('lightning.send.activationRequired')).not.toBeInTheDocument();
  });

  // Account loading and SDK startup defer parsing; the request is consumed once readiness arrives.
  it('waits for SDK startup before parsing', async () => {
    const ready = vi.mocked(useLightning)();
    vi.mocked(useLightning).mockReturnValue({ ...ready, isLightningReady: false, lightningSDKStatus: 'initializing' });
    const { rerender } = renderApp();
    deliver(1, 'first');
    expect(screen.getByText('lightning.initializing')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    vi.mocked(useLightning).mockReturnValue(ready);
    rerender(<MemoryRouter><TestApp /></MemoryRouter>);
    await review();
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: 'first' });
  });

  // Failed SDK initialization remains dismissible without starting a payment.
  it('shows initialization failure', () => {
    vi.mocked(useLightning).mockReturnValue({ ...vi.mocked(useLightning)(), isLightningReady: false, lightningSDKStatus: 'failed' });
    renderApp();
    deliver(1, 'first');
    expect(screen.getByText('lightning.initializationFailed')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    back();
    expect(screen.queryByText('lightning.initializationFailed')).not.toBeInTheDocument();
  });

  // Even an empty URI must be validated, with errors confined to the dismissible overlay.
  it.each(['invalid', ''])('shows validation errors for %j', async input => {
    vi.mocked(lightningApi.getParsePaymentInput).mockRejectedValue(new Error('invalid invoice'));
    renderApp();
    deliver(1, input);
    expect(await screen.findByText('Error: invalid invoice')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: input });
    back();
    expect(screen.queryByText('Error: invalid invoice')).not.toBeInTheDocument();
  });

  // Cancelling a slow parse must prevent its response from changing the next request's review.
  it('ignores a cancelled parse while opening only the latest pending link', async () => {
    let resolveFirst: (value: lightningApi.TPaymentInput) => void = () => {};
    vi.mocked(lightningApi.getParsePaymentInput).mockReturnValueOnce(new Promise(resolve => {
      resolveFirst = resolve;
    }));
    renderApp();
    deliver(1, 'first');
    deliver(2, 'second');
    deliver(3, 'latest');
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: 'first' });
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledExactlyOnceWith(1);
    back();
    await review();
    await act(async () => resolveFirst(invoice('first')));
    expect(lightningApi.postPreparePayment).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ paymentInput: 'latest' }));
    expect(lightningApi.postClearLightningURI).toHaveBeenLastCalledWith(3);
  });

  // A newer event wins over an older GET, and a delayed acknowledgement cannot reopen a dismissed request.
  it('does not replay stale backend state', async () => {
    let resolveLoad: (value: lightningApi.TLightningURI) => void = () => {};
    vi.mocked(lightningApi.getLightningURI).mockReturnValue(new Promise(resolve => {
      resolveLoad = resolve;
    }));
    renderApp();
    deliver(2, 'new');
    await review();
    back();
    await act(async () => resolveLoad({ revision: 1, input: 'old' }));
    expect(screen.queryByRole('button', { name: 'generic.send' })).not.toBeInTheDocument();
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledExactlyOnceWith(2);
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: 'new' });
  });

  // Reopening an amountless link must not reset the amount in the review already on screen.
  it('preserves the active amount when the same link arrives again', async () => {
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValue({ type: TPaymentInputType.BOLT11, invoice: { invoice: 'amountless' } });
    renderApp();
    deliver(1, 'amountless');
    fireEvent.change(await screen.findByRole('textbox', { name: 'custom amount' }), { target: { value: '100' } });
    await review();
    deliver(2, 'amountless');
    expect(screen.getByRole('textbox', { name: 'custom amount' })).toHaveValue('100');
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledTimes(1);
    back();
    expect(await screen.findByRole('textbox', { name: 'custom amount' })).toHaveValue('');
  });

  // Sending disables dismissal; later links wait until the user dismisses the shared success view.
  it('keeps the send and its result visible before opening another request', async () => {
    let resolveSend: () => void = () => {};
    vi.mocked(lightningApi.postSendPayment).mockReturnValue(new Promise(resolve => {
      resolveSend = resolve;
    }));
    renderApp();
    deliver(1, 'first');
    fireEvent.click(await review());
    await screen.findByText('lightning.send.sending.connecting');
    deliver(2, 'next');
    back();
    expect(screen.getByText('lightning.send.sending.connecting')).toBeInTheDocument();
    await act(async () => resolveSend());
    expect(screen.getByText('lightning.send.success.message')).toBeInTheDocument();
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
    await review();
    expect(lightningApi.getParsePaymentInput).toHaveBeenLastCalledWith({ s: 'next' });
    expect(lightningApi.postSendPayment).toHaveBeenCalledTimes(1);
  });

  // A terminal send error unmounts the review and must release its dismissal lock.
  it('allows dismissal after the backend rejects an already-used invoice', async () => {
    vi.mocked(lightningApi.postSendPayment).mockRejectedValue(
      new TSdkError('already paid', TLightningErrorCode.INVOICE_ALREADY_USED),
    );
    renderApp();
    deliver(1, 'first');
    fireEvent.click(await review());
    await screen.findByText('error.lightningInvoiceAlreadyUsed');
    back();
    expect(screen.queryByText('error.lightningInvoiceAlreadyUsed')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/account-summary');
  });

  // Ambiguous send errors retain the same payment and idempotency key, even with a newer URI waiting.
  it.each<lightningApi.TPaymentInput>([
    { type: TPaymentInputType.LNURL_PAY, lnurlPay: { input: 'alice@example.com', domain: 'example.com', minAmountSat: 1, maxAmountSat: 1000 } },
    { type: TPaymentInputType.BITCOIN_ADDRESS, bitcoinAddress: { address: 'bc1qrecipient', amountSat: 100 } },
  ])('preserves $type retries while another request is pending', async paymentInput => {
    vi.mocked(lightningApi.getParsePaymentInput).mockResolvedValueOnce(paymentInput);
    vi.mocked(lightningApi.postPreparePayment).mockResolvedValue({ amountSat: 100, feeSat: 1, totalDebitSat: 101, idempotencyKey: 'original-key' });
    vi.mocked(lightningApi.postSendPayment).mockRejectedValue(new Error('response lost'));
    renderApp();
    deliver(1, 'first');
    if (paymentInput.type === TPaymentInputType.LNURL_PAY) {
      fireEvent.change(await screen.findByRole('textbox', { name: 'custom amount' }), { target: { value: '100' } });
    }
    fireEvent.click(await review());
    await screen.findByText('Error: response lost');
    deliver(2, 'second');
    fireEvent.click(await review());
    await waitFor(() => expect(lightningApi.postSendPayment).toHaveBeenCalledTimes(2));
    expect(lightningApi.postSendPayment).toHaveBeenNthCalledWith(2, vi.mocked(lightningApi.postSendPayment).mock.calls[0]?.[0]);
    expect(lightningApi.postSendPayment).toHaveBeenLastCalledWith(expect.objectContaining({ idempotencyKey: 'original-key' }));
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledTimes(1);
    expect(lightningApi.postClearLightningURI).toHaveBeenCalledExactlyOnceWith(1);
  });

  // Payment links must wait until transaction and setup flows, including top-up results, are dismissed.
  it.each(['/lightning/send', '/lightning/send/', '/lightning/activate', '/lightning/topup', '/lightning/topup/', '/lightning/close-withdraw-funds', '/lightning/claim-top-up', '/lightning/deactivate', '/account/btc/send', '/market/swap'])(
    'waits until leaving %s', async pathname => {
      renderApp(pathname);
      deliver(1, 'first');
      expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
      expect(lightningApi.postClearLightningURI).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'leave transaction' }));
      await review();
      expect(screen.getByTestId('location')).toHaveTextContent('/lightning');
    });

  // The overlay hides the testnet banner; cancellation restores it without navigating or replaying the request.
  it('requires testnet acknowledgement and allows cancellation without changing the page', async () => {
    renderApp('/account-summary', true);
    deliver(1, 'first');
    expect(await screen.findByText('lightning.testnetWarning.title')).toBeInTheDocument();
    expect(mocks.setHideTestnetBanner).toHaveBeenLastCalledWith(true);
    expect(lightningApi.getParsePaymentInput).not.toHaveBeenCalled();
    back();
    await waitFor(() => expect(screen.queryByText('lightning.testnetWarning.title')).not.toBeInTheDocument());
    expect(mocks.setHideTestnetBanner).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId('location')).toHaveTextContent('/account-summary');
    deliver(3, 'second');
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'button.done' }));
    await review();
    expect(lightningApi.getParsePaymentInput).toHaveBeenCalledExactlyOnceWith({ s: 'second' });
  });

  // Desktop production builds must not subscribe to or display unsupported Lightning requests.
  it('does not subscribe when Lightning is unavailable', () => {
    vi.mocked(isLightningFeatureAvailable).mockReturnValue(false);
    renderApp();
    expect(lightningApi.getLightningURI).not.toHaveBeenCalled();
    expect(lightningApi.subscribeLightningURI).not.toHaveBeenCalled();
  });
});
