/**
 * Copyright 2022 Shift Crypto AG
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

import React, { Component } from 'react';
import { getAccountsByKeystore, isAmbiguiousName } from '../account/utils';
import { route } from '../../utils/route';
import * as accountAPI from '../../api/account';
import * as backendAPI from '../../api/backend';
import { alertUser } from '../../components/alert/Alert';
import { Button, Input, Label } from '../../components/forms';
import Logo from '../../components/icon/logo';
import { EditActive, EyeOpenedDark, USBSuccess } from '../../components/icon';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { Toggle } from '../../components/toggle/toggle';
import { Dialog, DialogButtons } from '../../components/dialog/dialog';
import { Message } from '../../components/message/message';
import { translate, TranslateProps } from '../../decorators/translate';
import { WithSettingsTabs } from './components/tabs';
import { View, ViewContent } from '../../components/view/view';
import { MobileHeader } from '../settings/components/mobile-header';
import { Badge } from '../../components/badge/badge';
import { AccountGuide } from './manage-account-guide';
import { WatchonlySetting } from './components/manage-accounts/watchonlySetting';
import style from './manage-accounts.module.css';

interface ManageAccountsProps {
  accounts: accountAPI.IAccount[];
  deviceIDs: string[];
  hasAccounts: boolean;
}

type Props = ManageAccountsProps & TranslateProps;

type TShowTokens = {
  readonly [key in string]: boolean;
}

interface State {
  editErrorMessage?: string;
  showTokens: TShowTokens;
  currentlyEditedAccount?: accountAPI.IAccount;
}

class ManageAccounts extends Component<Props, State> {
  public readonly state: State = {
    editErrorMessage: undefined,
    showTokens: {},
    currentlyEditedAccount: undefined,
  };

  private renderAccounts = (accounts: accountAPI.IAccount[]) => {
    const { showTokens } = this.state;
    const { t } = this.props;
    return accounts.filter(account => !account.isToken).map(account => {
      const active = account.active;
      const tokensVisible = showTokens[account.code];
      return (
        <div key={account.code} className={style.setting}>
          <div
            className={`${style.acccountLink} ${active ? style.accountActive : ''}`}
            onClick={() => active && route(`/account/${account.code}`)}>
            <Logo stacked active={account.active} className={`${style.coinLogo} m-right-half`} coinCode={account.coinCode} alt={account.coinUnit} />
            <span className={!account.active ? style.accountNameInactive : ''}>
              {account.name}
              {' '}
              <span className="unit">({account.coinUnit})</span>
            </span>
          </div>
          <div className="flex flex-items-center">
            {!account.active ? <p className={`text-small ${style.disabledText}`}>{t('generic.enabled_false')}</p> : null}
            <Button
              className={style.editBtn}
              onClick={() => this.setState({ currentlyEditedAccount: account })}
              transparent>
              <EditActive />
              <span className="hide-on-small">
                {t('manageAccounts.editAccount')}
              </span>
            </Button>
          </div>
          {active && account.coinCode === 'eth' ? (
            <div className={style.tokenSection}>
              <div className={`${style.tokenContainer} ${tokensVisible ? style.tokenContainerOpen : ''}`}>
                {this.renderTokens(account.code, account.activeTokens)}
              </div>
              <Button
                className={`${style.expandBtn} ${tokensVisible ? style.expandBtnOpen : ''}`}
                onClick={() => this.toggleShowTokens(account.code)}
                transparent>
                {t(tokensVisible ? 'manageAccounts.settings.hideTokens' : 'manageAccounts.settings.showTokens', {
                  activeTokenCount: `${account.activeTokens?.length || 0}`
                })}
              </Button>
            </div>
          ) : null}
        </div>
      );
    });
  };

  private toggleAccount = (accountCode: accountAPI.AccountCode, active: boolean) => {
    return backendAPI.setAccountActive(accountCode, active).then(({ success, errorMessage }) => {
      if (!success && errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  private toggleShowTokens = (accountCode: accountAPI.AccountCode) => {
    this.setState(({ showTokens }) => ({
      showTokens: {
        ...showTokens,
        [accountCode]: (accountCode in showTokens) ? !showTokens[accountCode] : true,
      }
    }));
  };

  private erc20Tokens: accountAPI.Terc20Token[] = [
    { code: 'eth-erc20-usdt', name: 'Tether USD', unit: 'USDT' },
    { code: 'eth-erc20-usdc', name: 'USD Coin', unit: 'USDC' },
    { code: 'eth-erc20-link', name: 'Chainlink', unit: 'LINK' },
    { code: 'eth-erc20-bat', name: 'Basic Attention Token', unit: 'BAT' },
    { code: 'eth-erc20-mkr', name: 'Maker', unit: 'MKR' },
    { code: 'eth-erc20-zrx', name: '0x', unit: 'ZRX' },
    { code: 'eth-erc20-wbtc', name: 'Wrapped Bitcoin', unit: 'WBTC' },
    { code: 'eth-erc20-paxg', name: 'Pax Gold', unit: 'PAXG' },
    { code: 'eth-erc20-dai0x6b17', name: 'Dai', unit: 'DAI' },
  ];

  private renderTokens = (ethAccountCode: accountAPI.AccountCode, activeTokens?: accountAPI.IActiveToken[]) => {
    return this.erc20Tokens.map(token => {
      const activeToken = (activeTokens || []).find(t => t.tokenCode === token.code);
      const active = activeToken !== undefined;
      return (
        <div key={token.code}
          className={`${style.token} ${!active ? style.tokenInactive : ''}`}>
          <div
            className={`${style.acccountLink} ${active ? style.accountActive : ''}`}
            onClick={() => activeToken !== undefined && route(`/account/${activeToken.accountCode}`)}>
            <Logo
              active={active}
              alt={token.name}
              className={style.tokenIcon}
              coinCode={token.code}
              stacked />
            <span className={style.tokenName}>
              {token.name} ({token.unit})
            </span>
          </div>
          <Toggle
            checked={active}
            className={style.toggle}
            id={token.code}
            onChange={() => this.toggleToken(ethAccountCode, token.code, !active)} />
        </div>
      );
    });
  };

  private toggleToken = (ethAccountCode: accountAPI.AccountCode, tokenCode: string, active: boolean) => {
    backendAPI.setTokenActive(ethAccountCode, tokenCode, active).then(({ success, errorMessage }) => {
      if (!success && errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  private updateAccount = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const { accounts } = this.props;
    const { currentlyEditedAccount } = this.state;

    if (!currentlyEditedAccount) {
      return;
    }

    backendAPI.renameAccount(currentlyEditedAccount.code, currentlyEditedAccount.name)
      .then(result => {
        if (!result.success) {
          if (result.errorCode) {
            this.setState({ editErrorMessage: this.props.t(`error.${result.errorCode}`) });
          } else if (result.errorMessage) {
            this.setState({ editErrorMessage: result.errorMessage });
          }
          return;
        }
        const account = accounts.find(({ code }) => currentlyEditedAccount.code === code);
        if (currentlyEditedAccount.active !== account?.active) {
          this.toggleAccount(currentlyEditedAccount.code, currentlyEditedAccount.active);
        }
        this.setState({
          editErrorMessage: undefined,
          currentlyEditedAccount: undefined,
        });
      });
  };

  public render() {
    const { t, accounts, deviceIDs, hasAccounts } = this.props;
    const { editErrorMessage, currentlyEditedAccount } = this.state;
    const accountsByKeystore = getAccountsByKeystore(accounts);
    return (
      <GuideWrapper>
        <GuidedContent>
          <Main>
            <Header
              hideSidebarToggler
              title={
                <>
                  <h2 className="hide-on-small">{t('settings.title')}</h2>
                  <MobileHeader withGuide title={t('manageAccounts.title')} />
                </>
              } />
            <View fullscreen={false}>
              <ViewContent>
                <WithSettingsTabs deviceIDs={deviceIDs} hideMobileMenu hasAccounts={hasAccounts}>
                  <Button
                    className={style.addAccountBtn}
                    primary
                    onClick={() => route('/add-account', true)}>
                    {t('addAccount.title')}
                  </Button>
                  <Grid col="1">
                    { accountsByKeystore.map(keystore => (
                      <Column
                        key={keystore.keystore.rootFingerprint}
                        asCard>
                        <div className={style.walletHeader}>
                          <h2 className={style.walletTitle}>
                            <span className="p-right-quarter">
                              {keystore.keystore.name}
                              { isAmbiguiousName(keystore.keystore.name, accountsByKeystore) ? (
                                // Disambiguate accounts group by adding the fingerprint.
                                // The most common case where this would happen is when adding accounts from the
                                // same seed using different passphrases.
                                <small> {keystore.keystore.rootFingerprint}</small>
                              ) : null }
                            </span>
                            {keystore.keystore.connected ? (
                              <Badge
                                className="m-right-quarter"
                                icon={props => <USBSuccess {...props} />}
                                type="success">
                                {t('device.keystoreConnected')}
                              </Badge>
                            ) : null}
                          </h2>
                          <WatchonlySetting keystore={keystore.keystore} />
                        </div>
                        {this.renderAccounts(keystore.accounts)}
                      </Column>
                    )) }
                  </Grid>
                  {currentlyEditedAccount && (
                    <Dialog
                      open={!!(currentlyEditedAccount)}
                      onClose={() => this.setState({ currentlyEditedAccount: undefined })}
                      title={t('manageAccounts.editAccountNameTitle')}>
                      <form onSubmit={this.updateAccount}>
                        <Message type="error" hidden={!editErrorMessage}>
                          {editErrorMessage}
                        </Message>
                        <Input
                          onInput={e => this.setState({ currentlyEditedAccount: { ...currentlyEditedAccount, name: e.target.value } })}
                          value={currentlyEditedAccount.name}
                        />
                        <Label
                          className={style.toggleLabel}
                          htmlFor={currentlyEditedAccount.code}>
                          <span className={style.toggleLabelText}>
                            <EyeOpenedDark />
                            {t('newSettings.appearance.enableAccount.title')}
                          </span>
                          <Toggle
                            checked={currentlyEditedAccount.active}
                            className={style.toggle}
                            id={currentlyEditedAccount.code}
                            onChange={(event) => {
                              event.target.disabled = true;
                              this.setState({
                                currentlyEditedAccount: {
                                  ...currentlyEditedAccount,
                                  active: event.target.checked,
                                }
                              }, () => event.target.disabled = false);
                            }} />
                        </Label>
                        <p>{t('newSettings.appearance.enableAccount.description')}</p>
                        <DialogButtons>
                          <Button
                            disabled={!currentlyEditedAccount.name}
                            primary
                            type="submit">
                            {t('button.update')}
                          </Button>
                        </DialogButtons>
                      </form>
                    </Dialog>
                  )}
                </WithSettingsTabs>
              </ViewContent>
            </View>
          </Main>
        </GuidedContent>
        <AccountGuide />
      </GuideWrapper>
    );
  }
}

const HOC = translate()(ManageAccounts);
export { HOC as ManageAccounts };
