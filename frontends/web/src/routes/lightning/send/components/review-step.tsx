// SPDX-License-Identifier: Apache-2.0

import { TPaymentInputType, type TPaymentInput } from '@/api/lightning';
import { BitcoinAddressReviewStep } from './bitcoin-address-review-step';
import { Bolt11ReviewStep } from './bolt11-review-step';
import { LNURLPayReviewStep } from './lnurl-pay-review-step';

type TProps = {
  paymentInput: TPaymentInput;
  backToPaymentInput: (nextInputError?: string) => void;
  onSuccess: () => void;
};

export const ReviewStep = ({
  paymentInput,
  backToPaymentInput,
  onSuccess,
}: TProps) => {
  switch (paymentInput.type) {
  case TPaymentInputType.BITCOIN_ADDRESS:
    return (
      <BitcoinAddressReviewStep
        bitcoinAddress={paymentInput.bitcoinAddress}
        backToPaymentInput={backToPaymentInput}
        onSuccess={onSuccess}
      />
    );
  case TPaymentInputType.BOLT11:
    return (
      <Bolt11ReviewStep
        invoice={paymentInput.invoice}
        backToPaymentInput={backToPaymentInput}
        onSuccess={onSuccess}
      />
    );
  case TPaymentInputType.LNURL_PAY:
    return (
      <LNURLPayReviewStep
        lnurlPay={paymentInput.lnurlPay}
        backToPaymentInput={backToPaymentInput}
        onSuccess={onSuccess}
      />
    );
  }
};
