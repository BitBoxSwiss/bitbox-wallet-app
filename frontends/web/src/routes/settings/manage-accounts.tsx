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

import { Component, h, RenderableProps } from 'preact';
import { route } from 'preact-router';
import * as accountAPI from '../../api/account';
import * as backendAPI from '../../api/backend';
import { apiGet } from '../../utils/request';
import { alertUser } from '../../components/alert/Alert';
import { Button } from '../../components/forms';
import Logo from '../../components/icon/logo';
import { Header } from '../../components/layout';
import { Toggle } from '../../components/toggle/toggle';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './manage-accounts.css';

interface ManageAccountsProps {
}

type Props = ManageAccountsProps & TranslateProps;

export type TFavorites = {
    readonly [key in string]: boolean;
}

type TShowTokens = {
    readonly [key in string]: boolean;
}

interface State {
    favorites?: TFavorites;
    accounts: accountAPI.IAccount[];
    showTokens: TShowTokens;
}

class ManageAccounts extends Component<Props, State> {
    public readonly state: State = {
        favorites: undefined,
        accounts: [],
        showTokens: {}
    };

    private fetchAccounts = () => {
        accountAPI.getAccounts().then(accounts => this.setState({ accounts }));
    }

    public componentDidMount() {
        this.fetchAccounts();

        apiGet('config')
            .then(({ frontend = {} }) => {
                this.setState({
                    favorites: frontend.favorites || {}
                });
            })
            .catch(console.error);
    }

    // TODO: keeping for next release when we enable favorite accounts
    // private toggleFavorAccount = (e) => {
    //     const { checked, id } = e.target as HTMLInputElement;
    //     this.setState(({ favorites }) => ({
    //         favorites: {
    //             ...favorites,
    //             [id]: checked,
    //         }
    //     }), () => {
    //         setConfig({
    //             frontend: {
    //                 favorites: this.state.favorites
    //             }
    //         }).catch(console.error);
    //     });
    // }

    private renderAccounts = () => {
        const { accounts, favorites, showTokens } = this.state;
        const { t } = this.props;
        if (!favorites) {
            return null;
        }
        return accounts.filter(account => !account.isToken).map(account => {
            const active = (account.code in favorites) ? favorites[account.code] : true;
            const tokensVisible = showTokens[account.code];
            return (
                <div key={account.code} className={style.setting}>
                    <div
                        className={`${style.acccountLink} ${style.accountActive}`}
                        onClick={() => route(`/account/${account.code}`)}>
                        <Logo className={`${style.coinLogo} m-right-half`} coinCode={account.coinCode} alt={account.coinUnit} />
                        <span className={style.accountName}>
                            {account.name}
                            {' '}
                            <span className="unit">({account.coinUnit})</span>
                        </span>
                    </div>
                    {/* <ButtonLink>
                        Edit
                    </ButtonLink> */}
                    {/* <Toggle
                        checked={active}
                        id={account.code}
                        onChange={this.toggleFavorAccount} /> */}
                    {active && account.coinCode === 'eth' ? (
                        <div className={style.tokenSection}>
                            <div className={`${style.tokenContainer} ${tokensVisible ? style.tokenContainerOpen : ''}`}>
                                {this.renderTokens(account.code, account.activeTokens)}
                            </div>
                            <Button
                                className={`${style.expandBtn} ${tokensVisible ? style.expandBtnOpen : ''}`}
                                onClick={() => this.toggleShowTokens(account.code)}
                                transparent>
                                {t( tokensVisible ? 'manageAccounts.settings.hideTokens' : 'manageAccounts.settings.showTokens', {
                                    activeTokenCount: `${account.activeTokens?.length || 0}`
                                })}
                            </Button>
                        </div>
                    ) : null}
                </div>
            );
        });
    }

    private toggleShowTokens = (accountCode) => {
        this.setState(({ showTokens }) => ({
            showTokens: {
                ...showTokens,
                [accountCode]: (accountCode in showTokens) ? !showTokens[accountCode] : true,
            }
        }));
    }

    private erc20TokenCodes = {
        'eth-erc20-usdt': 'Tether USD',
        'eth-erc20-usdc': 'USD Coin',
        'eth-erc20-link': 'Chainlink',
        'eth-erc20-bat': 'Basic Attention Token',
        'eth-erc20-mkr': 'Maker',
        'eth-erc20-zrx': '0x',
        'eth-erc20-wbtc': 'Wrapped Bitcoin',
        'eth-erc20-paxg': 'Pax Gold',
        'eth-erc20-sai0x89d2': 'Sai',
        'eth-erc20-dai0x6b17': 'Dai',
    };

    private renderTokens = (ethAccountCode: string, activeTokens?: string[]) => {
        const { accounts, favorites } = this.state;
        if (!favorites) {
            return null;
        }
        return Object.entries(this.erc20TokenCodes)
            .map(([tokenCode, name]) => {
                const active = activeTokens !== undefined && activeTokens.includes(tokenCode);
                const accountCode = accounts
                    .filter(account => account.coinCode === tokenCode);
                    // .filter or .find by my ETH account somehow, need ETH parent account
                if (accountCode.length > 1) {
                    console.log(accountCode);
                }
                return (
                    <div key={tokenCode}
                        className={`${style.token} ${active ? style.tokenActive : style.tokenInactive}`}>
                        <div
                            className={`${style.acccountLink} ${active ? style.accountActive : ''}`}
                            onClick={() => active && route(`/account/${tokenCode}`)}>
                            <Logo
                                active={active}
                                alt={name}
                                className={style.tokenIcon}
                                coinCode={tokenCode}
                                stacked />
                            <span className={style.tokenName}>
                                {name}
                            </span>
                        </div>
                        <Toggle
                            checked={active}
                            id={tokenCode}
                            onChange={() => this.toggleToken(ethAccountCode, tokenCode, !active)} />
                    </div>
                );
            });
    }

    private toggleToken = (ethAccountCode: string, tokenCode: string, active: boolean) => {
        backendAPI.setTokenActive(ethAccountCode, tokenCode, active).then(({ success, errorMessage }) => {
            if (success) {
                this.fetchAccounts();
                backendAPI.reinitializeAccounts();
            } else if (errorMessage) {
                alertUser(errorMessage);
            }
        });
    }

    public render(
        { t }: RenderableProps<Props>,
        { favorites }: State,
    ) {
        const accountList = this.renderAccounts();
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('manageAccounts.title')}</h2>} />
                    <div class="innerContainer scrollContainer">
                        <div class="content">
                        { favorites ? (
                            <div className="columnsContainer">
                                <div class="buttons m-bottom-large m-top-large">
                                    <Button
                                        primary
                                        onClick={() => route('/add-account', true)}>
                                        {t('addAccount.title')}
                                    </Button>
                                </div>
                                <div className="box slim divide m-bottom-large">
                                    { (accountList && accountList.length) ? accountList : 'no accounts found' }
                                </div>
                            </div>
                        ) : null }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate<ManageAccountsProps>()(ManageAccounts);
export { HOC as ManageAccounts };
