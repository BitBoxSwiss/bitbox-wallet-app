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

import React, { Component, ReactNode } from 'react';
import * as accountAPI from '../../api/account';
import * as aoppAPI from '../../api/aopp';
import { translate, TranslateProps } from '../../decorators/translate';
import { equal } from '../../utils/equal';
import { SimpleMarkup } from '../../utils/markup';
import { View, ViewHeader, ViewContent, ViewButtons } from '../view/view';
import { Message } from '../message/message';
import { Button, Field, Label, Select } from '../forms';
import { CopyableInput } from '../copy/Copy';
import { Cancel, PointToBitBox02 } from '../icon';
import { VerifyAddress } from './verifyaddress';
import { Vasp } from './vasp';
import styles from './aopp.module.css';
import { TUnsubscribe } from '../../utils/transport-common';

type TProps = {
  children: ReactNode;
}

const Banner = ({ children }: TProps) => (
  <div className={styles.banner}>{children}</div>
);

type State = {
  accountCode: accountAPI.AccountCode;
  aopp?: aoppAPI.Aopp;
}

type Props = TranslateProps;

const domain = (callback: string): string => new URL(callback).host;

class Aopp extends Component<Props, State> {
  public readonly state: State = {
    accountCode: '',
    aopp: undefined,
  };
  private unsubscribe?: TUnsubscribe;

  public componentDidMount() {
    this.setAccountCodeDefault();
    this.unsubscribe = aoppAPI.subscribeAOPP(aopp => this.updateAOPP(aopp));
    aoppAPI.getAOPP().then(aopp => this.setState({ aopp }));
  }

  public componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private updateAOPP(aopp: aoppAPI.Aopp) {
    let shouldUpdateAccountCodeDefault = false;
    this.setState(currentState => {
      if (aopp?.state === 'choosing-account'
        && (
          currentState.aopp?.state !== 'choosing-account'
          || !equal(aopp.accounts, currentState.aopp?.accounts)
        )
      ) {
        shouldUpdateAccountCodeDefault = true;
      }
      return { aopp };
    }, () => { // callback when state did update
      if (shouldUpdateAccountCodeDefault) {
        this.setAccountCodeDefault();
      }
    });
  }

  private setAccountCodeDefault() {
    const { aopp } = this.state;
    if (aopp === undefined || aopp.state !== 'choosing-account') {
      return;
    }
    if (aopp.accounts.length) {
      this.setState({ accountCode: aopp.accounts[0].code });
    }
  }

  private chooseAccount = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (this.state.accountCode) {
      const { success } = await accountAPI.connectKeystore(this.state.accountCode);
      if (success) {
        aoppAPI.chooseAccount(this.state.accountCode);
      }
    }
  };

  public render() {
    const { t } = this.props;
    const { accountCode, aopp } = this.state;
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
              <Cancel className={styles.smallIcon} />
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
                <SimpleMarkup tagName="p" markup={t('aopp.addressRequest', {
                  host: `<strong>${domain(aopp.callback)}</strong>`
                })}/>
              )}
              withLogoText={t('aopp.addressRequestWithLogo')} />
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
        <form onSubmit={this.chooseAccount}>
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
                onChange={e => this.setState({ accountCode: (e.target as HTMLSelectElement)?.value })}
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
  }
}

const translateHOC = translate()(Aopp);
export { translateHOC as Aopp };
