// SPDX-License-Identifier: Apache-2.0

import React, { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as accountAPI from '@/api/account';
import * as aoppAPI from '@/api/aopp';
import { equal } from '@/utils/equal';
import { SimpleMarkup } from '@/utils/markup';
import { View, ViewHeader, ViewContent, ViewButtons } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { Button, Field, Label, Select } from '@/components/forms';
import { CopyableInput } from '@/components/copy/Copy';
import { PointToBitBox02 } from '@/components/icon';
import { VerifyAddress } from './verifyaddress';
import { Vasp } from './vasp';
import styles from './aopp.module.css';

type TProps = {
  children: ReactNode;
};

const Banner = ({ children }: TProps) => (
  <div className={styles.banner}>{children}</div>
);

const domain = (callback: string): string => new URL(callback).host;

export const Aopp = () => {
  const { t } = useTranslation();

  const [accountCode, setAccountCode] = useState<accountAPI.AccountCode>('');
  const [aopp, setAopp] = useState<aoppAPI.Aopp>();

  const [prevAopp, setPrevAopp] = useState(aopp);

  useEffect(() => {
    aoppAPI.getAOPP().then(setAopp);
    return aoppAPI.subscribeAOPP(setAopp);
  }, []);

  useEffect(() => {
    if (aopp !== prevAopp) {
      setPrevAopp(aopp);
      if (aopp?.state === 'choosing-account'
      && aopp.accounts.length
      && (prevAopp?.state !== 'choosing-account' || !equal(aopp.accounts, prevAopp?.accounts))) {
        setAccountCode(aopp.accounts[0].code);
      }
    }
  }, [aopp, prevAopp]);

  const chooseAccount = (e: React.SyntheticEvent) => {
    if (accountCode) {
      aoppAPI.chooseAccount(accountCode);
    }
    e.preventDefault();
  };

  if (!aopp) {
    return null;
  }
  switch (aopp.state) {
  case 'error':
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        width="580px">
        <ViewHeader title={t('aopp.errorTitle')}>
          <p>{domain(aopp.callback)}</p>
        </ViewHeader>
        <ViewContent>
          <Message type="error">
            {t(`error.${aopp.errorCode}`, { host: domain(aopp.callback) })}
          </Message>
        </ViewContent>
        <ViewButtons>
          <Button danger onClick={aoppAPI.cancel}>{t('button.dismiss')}</Button>
        </ViewButtons>
      </View>
    );
  case 'inactive':
    // Inactive, waiting for action.
    return null;
  case 'user-approval':
    const host = domain(aopp.callback);
    const addressRequestMsg = aopp.xpubRequired ? 'aopp.addressRequestWithXPub' : 'aopp.addressRequest';
    const addressRequestWithLogoMsg = aopp.xpubRequired ? 'aopp.addressRequestWithLogoAndXPub' : 'aopp.addressRequestWithLogo';
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        width="580px">
        <ViewHeader title={t('aopp.title')} withAppLogo />
        <ViewContent>
          <Vasp prominent
            hostname={domain(aopp.callback)}
            fallback={(
              <SimpleMarkup tagName="p" markup={t(addressRequestMsg, {
                host: `<strong>${host}</strong>`
              })} />
            )}
            withLogoText={t(addressRequestWithLogoMsg)} />
          {
            aopp.xpubRequired ?
              (
                <Message type="info"> {t('aopp.xpubRequested', { host: `${host}` })} </Message>
              ) : ''
          }
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={aoppAPI.approve}>{t('button.continue')}</Button>
          <Button secondary onClick={aoppAPI.cancel}>{t('dialog.cancel')}</Button>
        </ViewButtons>
      </View>
    );
  case 'awaiting-keystore':
    return (
      <Banner>{t('aopp.banner')}</Banner>
    );
  case 'choosing-account': {
    const options = aopp.accounts.map(account => {
      return {
        text: account.name,
        value: account.code,
      };
    });
    return (
      <form onSubmit={chooseAccount}>
        <View
          fullscreen
          textCenter
          verticallyCentered
          width="580px">
          <ViewHeader title={t('aopp.title')}>
            <Vasp hostname={domain(aopp.callback)} />
          </ViewHeader>
          <ViewContent>
            <Select
              label={t('buy.info.selectLabel')}
              options={options}
              value={accountCode}
              onChange={e => setAccountCode((e.target as HTMLSelectElement)?.value)}
              id="account" />
          </ViewContent>
          <ViewButtons>
            <Button primary type="submit">{t('button.next')}</Button>
            <Button secondary onClick={aoppAPI.cancel}>{t('dialog.cancel')}</Button>
          </ViewButtons>
        </View>
      </form>
    );
  }
  case 'syncing':
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        width="580px">
        <ViewHeader title={t('aopp.title')}>
          <Vasp hostname={domain(aopp.callback)} />
        </ViewHeader>
        <ViewContent>
          <p>{t('aopp.syncing')}</p>
        </ViewContent>
        <ViewButtons>
          <Button secondary onClick={aoppAPI.cancel}>{t('dialog.cancel')}</Button>
        </ViewButtons>
      </View>
    );
  case 'signing':
    return (
      <View
        fullscreen
        textCenter
        verticallyCentered
        width="580px">
        <ViewHeader small title={t('aopp.title')}>
          <Vasp hostname={domain(aopp.callback)} />
        </ViewHeader>
        <ViewContent>
          <p>{t('aopp.signing')}</p>
          <Field>
            <Label>{t('aopp.labelAddress')}</Label>
            <CopyableInput alignLeft flexibleHeight value={aopp.address} />
          </Field>
          <Field>
            <Label>{t('aopp.labelMessage')}</Label>
            <div className={styles.message}>
              {aopp.message}
            </div>
          </Field>
          <PointToBitBox02 />
        </ViewContent>
      </View>
    );
  case 'success':
    return (
      <View
        fitContent
        fullscreen
        textCenter
        verticallyCentered
        width="580px">
        <ViewContent withIcon="success">
          <p className={styles.successText}>{t('aopp.success.title')}</p>
          <p className={styles.proceed}>
            {t('aopp.success.message', { host: domain(aopp.callback) })}
          </p>
          <Field>
            <Label>{t('aopp.labelAddress')}</Label>
            <CopyableInput alignLeft flexibleHeight value={aopp.address} />
          </Field>
          <Field style={{ marginBottom: 0 }}>
            <Label>{t('aopp.labelMessage')}</Label>
            <div className={styles.message}>
              {aopp.message}
            </div>
          </Field>
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={aoppAPI.cancel}>{t('button.done')}</Button>
          <VerifyAddress
            accountCode={aopp.accountCode}
            address={aopp.address}
            addressID={aopp.addressID} />
        </ViewButtons>
      </View>
    );
  }
};

