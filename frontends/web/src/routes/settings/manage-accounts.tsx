// SPDX-License-Identifier: Apache-2.0

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getAccountsByKeystore } from '@/routes/account/utils';
import * as accountAPI from '@/api/account';
import * as backendAPI from '@/api/backend';
import { alertUser } from '@/components/alert/Alert';
import { Button, Input, Label } from '@/components/forms';
import { Logo } from '@/components/icon/logo';
import { EditActive, EyeOpenedDark, Plus } from '@/components/icon';
import { Column, Grid, GuideWrapper, GuidedContent, Header, Main } from '@/components/layout';
import { Toggle } from '@/components/toggle/toggle';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Message } from '@/components/message/message';
import { WithSettingsTabs } from './components/tabs';
import { TPagePropsWithSettingsTabs } from './types';
import { View, ViewContent } from '@/components/view/view';
import { MobileHeader } from '@/routes/settings/components/mobile-header';
import { AccountGuide } from './manage-account-guide';
import { WatchonlySetting } from './components/manage-accounts/watchonlySetting';
import { ContentWrapper } from '@/components/contentwrapper/contentwrapper';
import { GlobalBanners } from '@/components/banners';
import { ConnectedKeystore } from '@/components/keystore/connected-keystore';
import style from './manage-accounts.module.css';

type ManageAccountsProps = {
  accounts: accountAPI.TAccount[];
};

type Props = ManageAccountsProps & TPagePropsWithSettingsTabs;

type TShowTokens = {
  readonly [key in string]: boolean;
};

export const ManageAccounts = ({ accounts, devices, hasAccounts }: Props) => {

  const navigate = useNavigate();

  const { t } = useTranslation();
  const [editErrorMessage, setEditErrorMessage] = useState<string | undefined>(undefined);
  const [showTokens, setShowTokens] = useState<TShowTokens>({});
  const [currentlyEditedAccount, setCurrentlyEditedAccount] = useState<accountAPI.TAccount | undefined>(undefined);

  const erc20Tokens: Readonly<accountAPI.Terc20Token[]> = [
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

  const renderTokens = (
    ethAccountCode: accountAPI.AccountCode,
    activeTokens?: accountAPI.TActiveToken[],
  ) => {
    return erc20Tokens.map(token => {
      const activeToken = (activeTokens || []).find(t => t.tokenCode === token.code);
      const active = activeToken !== undefined;
      return (
        <div key={token.code}
          className={`
            ${style.token || ''}
            ${!active && style.tokenInactive || ''}
          `}>
          <div
            className={`
              ${style.acccountLink || ''}
              ${active && style.accountActive || ''}
            `}
            onClick={() => activeToken !== undefined && navigate(`/account/${activeToken.accountCode}`)}>
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
            onChange={() => toggleToken(ethAccountCode, token.code, !active)} />
        </div>
      );
    });
  };

  const toggleToken = (
    ethAccountCode: accountAPI.AccountCode,
    tokenCode: accountAPI.ERC20CoinCode,
    active: boolean,
  ) => {
    backendAPI.setTokenActive(ethAccountCode, tokenCode, active).then(({ success, errorMessage }) => {
      if (!success && errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  const toggleAccount = (accountCode: accountAPI.AccountCode, active: boolean) => {
    return backendAPI.setAccountActive(accountCode, active).then(({ success, errorMessage }) => {
      if (!success && errorMessage) {
        alertUser(errorMessage);
      }
    });
  };

  const toggleShowTokens = (accountCode: accountAPI.AccountCode) => {
    setShowTokens(prevShowTokens => ({
      ...prevShowTokens,
      [accountCode]: (accountCode in prevShowTokens) ? !prevShowTokens[accountCode] : true,
    }));
  };

  const updateAccount = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!currentlyEditedAccount) {
      return;
    }

    backendAPI.renameAccount(currentlyEditedAccount.code, currentlyEditedAccount.name)
      .then(result => {
        if (!result.success) {
          if (result.errorCode) {
            setEditErrorMessage(t(`error.${result.errorCode}`));
          } else if (result.errorMessage) {
            setEditErrorMessage(result.errorMessage);
          }
          return;
        }
        const account = accounts.find(({ code }) => currentlyEditedAccount.code === code);
        if (currentlyEditedAccount.active !== account?.active) {
          toggleAccount(currentlyEditedAccount.code, currentlyEditedAccount.active);
        }
        setEditErrorMessage(undefined);
        setCurrentlyEditedAccount(undefined);
      });
  };

  const renderAccounts = (accounts: accountAPI.TAccount[]) => {
    return accounts.filter(account => !account.isToken).map(account => {
      const active = account.active;
      const tokensVisible = showTokens[account.code];
      return (
        <div key={account.code} className={style.setting}>
          <div
            className={`
              ${style.acccountLink || ''}
              ${active && style.accountActive || ''}
            `}
            onClick={() => active && navigate(`/account/${account.code}`)}>
            <Logo
              stacked
              active={account.active}
              className={`${style.coinLogo || ''} m-right-half`}
              coinCode={account.coinCode}
              alt={account.coinUnit}
            />
            <span className={!account.active ? style.accountNameInactive : ''}>
              {account.name}
              {' '}
              <span className="unit">({account.coinUnit})</span>
            </span>
          </div>
          <div className={style.editAccount}>
            {!account.active ? (
              <p className={style.disabledText}>
                {t('generic.enabled_false')}
              </p>
            ) : null}
            <Button
              className={style.editBtn}
              onClick={() => setCurrentlyEditedAccount(account)}
              transparent>
              <EditActive />
              <span className="hide-on-small">
                {t('manageAccounts.editAccount')}
              </span>
            </Button>
          </div>
          {active && account.coinCode === 'eth' ? (
            <div className={style.tokenSection}>
              <div className={`
                ${style.tokenContainer || ''}
                ${tokensVisible && style.tokenContainerOpen || ''}
              `}>
                {renderTokens(account.code, account.activeTokens)}
              </div>
              <Button
                className={`
                  ${style.expandBtn || ''}
                  ${tokensVisible && style.expandBtnOpen || ''}
                `}
                onClick={() => toggleShowTokens(account.code)}
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

  const accountsByKeystore = getAccountsByKeystore(accounts);
  return (
    <GuideWrapper>
      <GuidedContent>
        <Main>
          <ContentWrapper>
            <GlobalBanners devices={devices} />
          </ContentWrapper>
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
              <WithSettingsTabs devices={devices} hideMobileMenu hasAccounts={hasAccounts}>
                <Button
                  className={style.addAccountBtn}
                  primary
                  onClick={() => navigate('/add-account')}>
                  <Plus className="m-right-quarter" width="12" height="12" />
                  {t('addAccount.title')}
                </Button>
                <Grid col="1">
                  { accountsByKeystore.map(keystore => (
                    <Column
                      key={keystore.keystore.rootFingerprint}
                      asCard>
                      <div className={style.walletHeader}>
                        <ConnectedKeystore
                          accountsByKeystore={accountsByKeystore}
                          keystore={keystore.keystore}
                          className={style.connectedKeystore} />
                        <WatchonlySetting keystore={keystore.keystore} />
                      </div>
                      {renderAccounts(keystore.accounts)}
                    </Column>
                  )) }
                </Grid>
                {currentlyEditedAccount && (
                  <Dialog
                    open={!!(currentlyEditedAccount)}
                    onClose={() => setCurrentlyEditedAccount(undefined)}
                    title={t('manageAccounts.editAccountNameTitle')}>
                    <form onSubmit={updateAccount}>
                      <Message type="error" hidden={!editErrorMessage}>
                        {editErrorMessage}
                      </Message>
                      <Input
                        onInput={e => setCurrentlyEditedAccount({ ...currentlyEditedAccount, name: e.target.value })}
                        value={currentlyEditedAccount.name}
                      />
                      <Label
                        className={style.toggleLabel}
                        htmlFor={currentlyEditedAccount.code}>
                        <span className={style.toggleLabelText}>
                          <EyeOpenedDark />
                          <span>
                            {t('newSettings.appearance.enableAccount.title')}
                          </span>
                        </span>
                        <Toggle
                          checked={currentlyEditedAccount.active}
                          className={style.toggle}
                          id={currentlyEditedAccount.code}
                          onChange={(event) => {
                            event.target.disabled = true;
                            setCurrentlyEditedAccount({
                              ...currentlyEditedAccount,
                              active: event.target.checked,
                            });
                            event.target.disabled = false;
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
      <AccountGuide accounts={accounts}/>
    </GuideWrapper>
  );
};