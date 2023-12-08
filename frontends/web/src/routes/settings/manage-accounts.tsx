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
import { getAccountsByKeystore } from '../account/utils';
import { route } from '../../utils/route';
import * as accountAPI from '../../api/account';
import * as backendAPI from '../../api/backend';
import { alertUser } from '../../components/alert/Alert';
import { Button, Input } from '../../components/forms';
import Logo from '../../components/icon/logo';
import { EyeOpenedDark } from '../../components/icon';
import { GuideWrapper, GuidedContent, Header, Main } from '../../components/layout';
import { Toggle } from '../../components/toggle/toggle';
import { Dialog, DialogButtons } from '../../components/dialog/dialog';
import { Message } from '../../components/message/message';
import { translate, TranslateProps } from '../../decorators/translate';
import { WithSettingsTabs } from './components/tabs';
import { View, ViewContent } from '../../components/view/view';
import { getConfig } from '../../utils/config';
import { MobileHeader } from '../settings/components/mobile-header';
import Guide from './manage-account-guide';
import style from './manage-accounts.module.css';

interface ManageAccountsProps {
  deviceIDs: string[];
  hasAccounts: boolean;
}

type Props = ManageAccountsProps & TranslateProps;

type TShowTokens = {
  readonly [key in string]: boolean;
}

interface State {
  editErrorMessage?: string;
  accounts: accountAPI.IAccount[];
  showTokens: TShowTokens;
  watchonly?: boolean;
  currentlyEditedAccount?: accountAPI.IAccount
}

class ManageAccounts extends Component<Props, State> {
  public readonly state: State = {
    editErrorMessage: undefined,
    accounts: [],
    showTokens: {},
    watchonly: undefined,
    currentlyEditedAccount: undefined
  };

  private fetchAccounts = () => {
    return accountAPI.getAccounts().then(accounts => this.setState({ accounts }));
  };

  public componentDidMount() {
    this.fetchAccounts();
    getConfig().then(config => this.setState({ watchonly: config!.backend!.watchonly }));
  }

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
            <Logo className={`${style.coinLogo} m-right-half`} coinCode={account.coinCode} alt={account.coinUnit} />
            <span>
              {account.name}
              {' '}
              <span className="unit">({account.coinUnit})</span>
            </span>
          </div>
          <button
            className={style.editBtn}
            onClick={() => this.setState({ currentlyEditedAccount: account })}
          >
            {t('manageAccounts.editAccount')}
          </button>
          <Toggle
            checked={active}
            className={style.toggle}
            id={account.code}
            onChange={(event) => {
              event.target.disabled = true;
              this.toggleAccount(account.code, !active)
                .then(() => event.target.disabled = false);
            }} />
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

  private renderWatchOnlyToggle = () => {
    const { t } = this.props;
    const { currentlyEditedAccount } = this.state;
    if (!currentlyEditedAccount) {
      return;
    }

    return (
      <div className="flex flex-column">
        <div className={style.watchOnlyContainer}>
          <div className="flex">
            <EyeOpenedDark width={18} height={18} />
            <p className={style.watchOnlyTitle}>{t('manageAccounts.watchAccount')}</p>
          </div>
          <Toggle
            checked={currentlyEditedAccount.watch}
            className={style.toggle}
            id={currentlyEditedAccount.code}
            onChange={async (event) => {
              event.target.disabled = true;
              await this.setWatch(currentlyEditedAccount.code, !currentlyEditedAccount.watch);
              this.setState({ currentlyEditedAccount: { ...currentlyEditedAccount, watch: !currentlyEditedAccount.watch } });
              event.target.disabled = false;
            }}
          />
        </div>
        <p className={style.watchOnlyNote}>{t('manageAccounts.watchAccountDescription')}</p>
        {
          !currentlyEditedAccount.watch && <div className={style.watchOnlyAccountHidden}>
            <p>{t('manageAccounts.accountHidden')}</p>
          </div>
        }
      </div>);
  };

  private toggleAccount = (accountCode: string, active: boolean) => {
    return backendAPI.setAccountActive(accountCode, active).then(({ success, errorMessage }) => {
      if (success) {
        return this.fetchAccounts();
      } else if (errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  private setWatch = async (accountCode: string, watch: boolean) => {
    const result = await backendAPI.accountSetWatch(accountCode, watch);
    if (result.success) {
      await this.fetchAccounts();
    } else if (result.errorMessage) {
      alertUser(result.errorMessage);
    }
  };

  private toggleShowTokens = (accountCode: string) => {
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

  private renderTokens = (ethAccountCode: string, activeTokens?: accountAPI.IActiveToken[]) => {
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

  private toggleToken = (ethAccountCode: string, tokenCode: string, active: boolean) => {
    backendAPI.setTokenActive(ethAccountCode, tokenCode, active).then(({ success, errorMessage }) => {
      if (success) {
        this.fetchAccounts();
      } else if (errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  private updateAccountName = (event: React.SyntheticEvent) => {
    event.preventDefault();
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
        this.fetchAccounts();
        this.setState({
          editErrorMessage: undefined,
          currentlyEditedAccount: undefined,
        });
      });
  };

  public render() {
    const { t, deviceIDs, hasAccounts } = this.props;
    const { accounts, editErrorMessage, currentlyEditedAccount, watchonly } = this.state;
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
                  {
                    accountsByKeystore.map(keystore => (
                      <React.Fragment key={keystore.keystore.rootFingerprint}>
                        <p>{keystore.keystore.name}</p>
                        <div className="box slim divide m-bottom-large">
                          {this.renderAccounts(keystore.accounts)}
                        </div>
                      </React.Fragment>
                    ))
                  }
                  {currentlyEditedAccount && (
                    <Dialog
                      open={!!(currentlyEditedAccount)}
                      onClose={() => this.setState({ currentlyEditedAccount: undefined })}
                      title={t('manageAccounts.editAccountNameTitle')}>
                      <form onSubmit={this.updateAccountName}>
                        <Message type="error" hidden={!editErrorMessage}>
                          {editErrorMessage}
                        </Message>
                        <Input
                          onInput={e => this.setState({ currentlyEditedAccount: { ...currentlyEditedAccount, name: e.target.value } })}
                          value={currentlyEditedAccount.name}
                        />
                        {watchonly && this.renderWatchOnlyToggle()}
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
        <Guide />
      </GuideWrapper>

    );
  }
}

const HOC = translate()(ManageAccounts);
export { HOC as ManageAccounts };
