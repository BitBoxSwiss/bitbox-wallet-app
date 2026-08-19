// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as lightningApi from '@/api/lightning';
import { BackButtonProvider } from '@/contexts/BackButtonContext';
import { RatesContext } from '@/contexts/RatesContext';
import { Receive } from './receive';

vi.mock('@/i18n/i18n');

vi.mock('@/components/status/status', () => ({
  Status: ({ children, hidden }: { children: ReactNode; hidden?: boolean }) => hidden ? null : <div role="alert">{children}</div>,
}));

vi.mock('@/components/qrcode/qrcode', () => ({
  QRCode: () => <div data-testid="invoice-qr" />,
}));

vi.mock('../hooks/use-sat-fiat-amount', () => ({
  useSatFiatAmount: () => ({
    amount: {
      amount: '250000',
      estimated: false,
      unit: 'sat',
    },
    amountSat: 250000,
    handleFiatAmountChange: vi.fn(),
    handleSatsAmountChange: vi.fn(),
    inputFiatText: '2.92',
    inputSatsText: '250000',
    resetAmountInput: vi.fn(),
  }),
}));

vi.mock('./use-receive-payment-success', () => ({
  useReceivePaymentSuccess: () => ({
    receivedPayment: undefined,
    resetReceivedPayment: vi.fn(),
  }),
}));

vi.mock('../guide', () => ({
  LightningReceiveGuide: () => null,
}));

const amount = (value: string) => ({
  amount: value,
  estimated: false,
  unit: 'sat' as const,
});

const balance: lightningApi.TLightningBalance = {
  available: amount('100000'),
  fundingLimit: {
    limitSat: 200000,
    marginSat: 100000,
  },
  hasAvailable: true,
  hasIncoming: false,
  incoming: amount('0'),
};

const LocationPath = () => {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
};

const setMobileViewport = (matches: boolean) => {
  vi.mocked(window.matchMedia).mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const renderReceive = () => render(
  <MemoryRouter initialEntries={['/lightning/receive']}>
    <BackButtonProvider>
      <RatesContext.Provider value={{
        defaultCurrency: 'EUR',
        activeCurrencies: ['EUR'],
        btcUnit: 'sat',
        rotateDefaultCurrency: vi.fn(),
        rotateBtcUnit: vi.fn(),
        addToActiveCurrencies: vi.fn(),
        updateDefaultCurrency: vi.fn(),
        removeFromActiveCurrencies: vi.fn(),
      }}>
        <Receive />
      </RatesContext.Provider>
      <LocationPath />
    </BackButtonProvider>
  </MemoryRouter>
);

const pressSystemBack = () => {
  act(() => {
    expect(window.onBackButtonPressed?.()).toBe(false);
  });
};

describe('Lightning receive funding limit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setMobileViewport(false);
    vi.spyOn(lightningApi, 'getLightningAddress').mockResolvedValue('test@bitbox.swiss');
    vi.spyOn(lightningApi, 'subscribeLightningAddress').mockReturnValue(vi.fn());
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(lightningApi, 'getReceivePayment').mockResolvedValue({ invoice: 'lnbc1invoice' });
    vi.spyOn(lightningApi, 'subscribeLightningBalance').mockReturnValue(vi.fn());
  });

  it('warns on the form and generated invoice without blocking creation', async () => {
    renderReceive();

    fireEvent.click(await screen.findByRole('button', { name: 'lightning.receive.invoice.create' }));

    const formWarning = await screen.findByText('lightning.limit.createInvoiceWarning');
    const descriptionInput = screen.getByLabelText('lightning.receive.description.label');
    expect(descriptionInput.compareDocumentPosition(formWarning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const createButton = screen.getByRole('button', { name: 'lightning.receive.invoice.create' });
    expect(createButton).toBeEnabled();

    fireEvent.click(createButton);

    const invoiceWarning = await screen.findByText('lightning.limit.invoiceWarning');
    await waitFor(() => expect(screen.getByTestId('invoice-qr')).toBeInTheDocument());
    expect(invoiceWarning.compareDocumentPosition(screen.getByTestId('invoice-qr')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lightningApi.getReceivePayment).toHaveBeenCalledWith({
      amountSat: 250000,
      description: '',
    });
  });

  it('uses the mobile header callback for the address, form, and invoice stages', async () => {
    setMobileViewport(true);
    renderReceive();

    expect(await screen.findByText('test@bitbox.swiss', { selector: 'p' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'lightning.receive.invoice.create' }));
    expect(await screen.findByLabelText('lightning.receive.description.label')).toBeInTheDocument();

    pressSystemBack();
    expect(screen.getByText('test@bitbox.swiss', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'lightning.receive.invoice.create' }));
    fireEvent.click(await screen.findByRole('button', { name: 'lightning.receive.invoice.create' }));
    expect(await screen.findByTestId('invoice-qr')).toBeInTheDocument();

    pressSystemBack();
    expect(screen.getByText('test@bitbox.swiss', { selector: 'p' })).toBeInTheDocument();

    pressSystemBack();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/lightning');
  });
});
