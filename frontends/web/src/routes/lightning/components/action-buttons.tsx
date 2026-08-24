// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { ArrowFloorDownWhite, ArrowFloorUpWhite } from '@/components/icon';
import { AccountActionButtonLink } from '@/routes/account/components/account-action-button-link';
import { AccountActionButtons } from '@/routes/account/components/account-action-buttons';

type TProps = {
  accountDataLoaded: boolean;
  canSend?: boolean;
  canTopUp?: boolean;
};

export const ActionButtons = ({
  accountDataLoaded,
  canSend,
  canTopUp,
}: TProps) => {
  const { t } = useTranslation();
  const canClickSend = canSend && accountDataLoaded;

  return (
    <AccountActionButtons>
      <AccountActionButtonLink
        disabled={!canClickSend}
        to="/lightning/send"
      >
        <ArrowFloorUpWhite width={16} height={16} />
        <span>{t('generic.send')}</span>
      </AccountActionButtonLink>

      <AccountActionButtonLink
        disabled={!accountDataLoaded}
        to="/lightning/receive"
      >
        <ArrowFloorDownWhite width={16} height={16} />
        <span>{t('generic.receiveWithoutCoinCode')}</span>
      </AccountActionButtonLink>

      <AccountActionButtonLink
        disabled={!accountDataLoaded || !canTopUp}
        to="/lightning/topup"
      >
        <span>{t('lightning.topUp.action')}</span>
      </AccountActionButtonLink>
    </AccountActionButtons>
  );
};
