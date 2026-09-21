// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountAPI from '@/api/account';
import { Button } from '@/components/forms';
import { alertUser } from '@/components/alert/Alert';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { PointToBitBox02 } from '../icon';

type TProps = {
  accountCode: accountAPI.AccountCode;
  displayAddress: string;
  addressID: string;
};

export const VerifyAddress = ({ accountCode, displayAddress, addressID }: TProps) => {
  const [verifying, setVerifying] = useState(false);
  const { t } = useTranslation();
  const verifyAddress = async () => {
    setVerifying(true);
    try {
      const result = await accountAPI.verifyAddress(accountCode, addressID);
      if (!result.success) {
        alertUser(result.errorMessage || t('genericError'));
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Button secondary onClick={verifyAddress}>
        {t('receive.verifyBitBox02')}
      </Button>
      { verifying ? (
        <WaitDialog
          noSidebarOffset
          medium
          title={t('receive.verifyBitBox02')}>
          <div>
            { displayAddress }
            <br />
            <br />
            <PointToBitBox02 />
          </div>
        </WaitDialog>
      ) : null }
    </>
  );
};
