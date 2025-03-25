/**
 * Copyright 2021 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
      {verifying ? (
        <WaitDialog title={t('receive.verifyBitBox02')}>{address}</WaitDialog>
      ) : null}
    </div>
  );
};
