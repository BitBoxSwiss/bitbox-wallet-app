// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { FeeTargetCode, TAccount, TTxProposalResult } from '@/api/account';
import { ConfirmSend } from '@/routes/account/send/components/confirm/confirm';

type TProps = {
  customFee: string;
  feeTarget?: FeeTargetCode;
  note: string;
  proposal?: TTxProposalResult;
  sourceAccount?: TAccount;
};

export const TopUpConfirm = ({
  customFee,
  feeTarget,
  note,
  proposal,
  sourceAccount,
}: TProps) => {
  const { t } = useTranslation();

  if (!proposal?.success || !sourceAccount) {
    return null;
  }

  return (
    <ConfirmSend
      note={note}
      hasSelectedUTXOs={false}
      isConfirming
      selectedUTXOs={{}}
      coinCode={sourceAccount.coinCode}
      transactionDetails={{
        customFee,
        feeTarget,
        proposedAmount: proposal.amount,
        proposedFee: proposal.fee,
        proposedTotal: proposal.total,
        recipientDisplayAddress: proposal.recipientDisplayAddress,
        selectedReceiverAccountName: t('lightning.accountLabel'),
      }}
    />
  );
};
