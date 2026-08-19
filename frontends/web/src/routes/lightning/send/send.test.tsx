// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TPaymentInputType } from '@/api/lightning';
import * as lightningApi from '@/api/lightning';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { Send } from './send';

vi.mock('@/i18n/i18n');

vi.mock('@/components/layout', () => ({
  Column: ({ children }: { children: ReactNode }) => <>{children}</>,
  Grid: ({ children }: { children: ReactNode }) => <>{children}</>,
  GuideWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
  GuidedContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  Header: ({ title }: { title: ReactNode }) => <header>{title}</header>,
  Main: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

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

vi.mock('../guide', () => ({
  LightningSendGuide: () => null,
}));

vi.mock('./components/select-payment-input-step', () => ({
  SelectPaymentInputStep: ({
    onSubmit,
  }: {
    onSubmit: (input: string) => Promise<boolean>;
  }) => <button onClick={() => onSubmit('lnbc1invoice')}>review payment</button>,
}));

vi.mock('./components/custom-payment-amount', () => ({
  CustomPaymentAmount: () => null,
  PaymentBalance: () => null,
}));

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

const renderSend = () => render(
  <MemoryRouter initialEntries={['/lightning/send']}>
    <BackButtonProvider>
      <Send activeAccounts={[]} />
      <LocationPath />
    </BackButtonProvider>
  </MemoryRouter>
);

const pressSystemBack = () => {
  act(() => {
    expect(window.onBackButtonPressed?.()).toBe(false);
  });
};

describe('Lightning Send back navigation', () => {
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
    renderSend();

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'generic.send' })).toBeEnabled());

    pressSystemBack();
    expect(screen.getByRole('button', { name: 'review payment' })).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/send');

    fireEvent.click(screen.getByRole('button', { name: 'review payment' }));
    const sendButton = await screen.findByRole('button', { name: 'generic.send' });
    await waitFor(() => expect(sendButton).toBeEnabled());
    fireEvent.click(sendButton);

    expect(await screen.findByText('lightning.send.sending.connecting')).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector('header button')).not.toBeInTheDocument());
    pressSystemBack();

    expect(screen.getByText('lightning.send.sending.connecting')).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning/send');

    await act(async () => {
      resolvePayment();
    });
    expect(await screen.findByText('payment sent')).toBeInTheDocument();
  });
});
