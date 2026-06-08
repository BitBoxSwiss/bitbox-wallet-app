// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TAccount } from '@/api/account';
import { BitsuranceGuide } from './guide';
import { GroupedAccountSelector } from '@/components/groupedaccountselector/groupedaccountselector';
import { GuidedContent, GuideWrapper, Header, Main } from '@/components/layout';
import { Spinner } from '@/components/spinner/Spinner';
import { View, ViewContent } from '@/components/view/view';
import { bitsuranceLookup } from '@/api/bitsurance';
import { alertUser } from '@/components/alert/Alert';
import { connectKeystore } from '@/api/keystores';

type TProps = {
  accounts: TAccount[];
  code: string;
};

export const BitsuranceAccount = ({ code, accounts }: TProps) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>(code);
  const [disabled, setDisabled] = useState<boolean>(false);
  const [btcAccounts, setBtcAccounts] = useState<TAccount[]>();

  const { t } = useTranslation();

  const handleChangeAccount = (selected: string) => {
    setSelected(selected);
  };

  const detect = useCallback(async () => {
    const response = await bitsuranceLookup();
    if (!response.success) {
      alertUser(response.errorMessage);
      return;
    }
    // btc accounts that have never been insured, or with a canceled
    // insurance contract, can be used to make a new contract.
    const insurableAccounts = accounts.filter(
      account => account.coinCode === 'btc'
      && (
        !account.bitsuranceStatus
        || account.bitsuranceStatus === 'canceled'
        || account.bitsuranceStatus === 'refused'
      )
    );
    setBtcAccounts(insurableAccounts);
  }, [accounts]);

  // check supported accounts
  useEffect(() => {
    detect();
  }, [detect]);

  // if there is only one account available let's automatically redirect to the widget
  useEffect(() => {
    if (btcAccounts !== undefined && btcAccounts.length === 1) {
      const account = btcAccounts[0] as TAccount;
      connectKeystore(account.keystore.rootFingerprint).then(connectResult => {
        if (!connectResult.success) {
          return;
        }
        // replace current history item when redirecting so that the user can go back
        navigate(`/bitsurance/widget/${account.code}`, { replace: true });
      });
    }
  }, [btcAccounts, navigate]);

  const handleProceed = async () => {
    setDisabled(true);
    try {
      const account = btcAccounts?.find(acc => acc.code === selected);
      if (account === undefined) {
        return;
      }
      const connectResult = await connectKeystore(account.keystore.rootFingerprint);
      if (!connectResult.success) {
        return;
      }
    } finally {
      setDisabled(false);
    }
    navigate(`/bitsurance/widget/${selected}`);
  };

  if (btcAccounts === undefined) {
    return <Spinner text={t('loading')} />;
  }

  return (
    <Main>
      <GuideWrapper>
        <GuidedContent>
          <Header title={<h2>{t('bitsuranceAccount.title')}</h2>} />
          <View width="550px" verticallyCentered fullscreen={false}>
            <ViewContent>
              { btcAccounts.length === 0 ? (
                <div>{t('bitsuranceAccount.noAccount')}</div>
              ) : (
                <GroupedAccountSelector
                  title={t('bitsuranceAccount.select')}
                  disabled={disabled}
                  accounts={btcAccounts}
                  selected={selected}
                  onChange={handleChangeAccount}
                  onProceed={handleProceed}
                />
              )}
            </ViewContent>
          </View>
        </GuidedContent>
        <BitsuranceGuide/>
      </GuideWrapper>
    </Main>
  );
};
