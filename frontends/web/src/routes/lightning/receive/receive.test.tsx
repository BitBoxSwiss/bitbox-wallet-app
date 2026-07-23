// SPDX-License-Identifier: Apache-2.0

import '../../../../__mocks__/i18n';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TBalance } from '@/api/account';
import * as lightningApi from '@/api/lightning';
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

const balance: TBalance = {
  available: amount('100000'),
  hasAvailable: true,
  hasIncoming: false,
  incoming: amount('0'),
};

const balanceLimit: lightningApi.TLightningBalanceLimit = {
  amount: amount('200000'),
  amountLabel: '200000 sat',
  remainingAmount: amount('100000'),
  remainingAmountLabel: '100000 sat',
  excessAmount: amount('150000'),
  excessAmountLabel: '150000 sat',
  limitReached: false,
  limitExceeded: false,
  amountExceedsLimit: true,
};

const renderReceive = () => render(
  <MemoryRouter>
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
  </MemoryRouter>
);

describe('Lightning receive balance limit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(lightningApi, 'getLightningAddress').mockResolvedValue('test@bitbox.swiss');
    vi.spyOn(lightningApi, 'subscribeLightningAddress').mockReturnValue(vi.fn());
    vi.spyOn(lightningApi, 'getLightningBalance').mockResolvedValue(balance);
    vi.spyOn(lightningApi, 'getLightningBalanceLimit').mockResolvedValue(balanceLimit);
    vi.spyOn(lightningApi, 'getReceivePayment').mockResolvedValue({ invoice: 'lnbc1invoice' });
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
});
