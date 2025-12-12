// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountAPI from '@/api/account';
import { Button } from '@/components/forms';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';

type TProps = {
  accountCode: accountAPI.AccountCode;
  address: string;
  addressID: string;
};

export const VerifyAddress = ({ accountCode, address, addressID }: TProps) => {
  const [verifying, setVerifying] = useState(false);
  const { t } = useTranslation();
  const verifyAddress = async () => {
    setVerifying(true);
    await accountAPI.verifyAddress(accountCode, addressID);
    setVerifying(false);
  };

  return (
    <div className="flex flex-column">
      <Button secondary onClick={verifyAddress}>
        {t('receive.verifyBitBox02')}
      </Button>
      { verifying ? (
        <WaitDialog title={t('receive.verifyBitBox02')}>
          { address }
        </WaitDialog>
      ) : null }
    </div>
  );
};
