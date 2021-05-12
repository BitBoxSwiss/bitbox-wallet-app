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
import { apiGet } from '../../utils/request';
import { setConfig } from '../../utils/config';
import { Button } from '../../components/forms';
import Logo from '../../components/icon/logo';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { Header } from '../../components/layout';
import { Toggle } from '../../components/toggle/toggle';
import { translate, TranslateProps } from '../../decorators/translate';
import * as style from './settings.css';

interface ManageAccountsProps {
    accounts: accountAPI.IAccount[];
}

type Props = ManageAccountsProps & TranslateProps;

export type TFavorites = {
    readonly [key in string]: boolean;
}

interface State {
    favorites?: TFavorites;
}

class ManageAccounts extends Component<Props, State> {
    public readonly state: State = {
        favorites: undefined,
    };

    public componentDidMount() {
        apiGet('config')
            .then(({ frontend = {} }) => {
                this.setState({
                    favorites: frontend.favorites || {}
                });
            })
            .catch(console.error);
    }

    private toggleFavorAccount = (e) => {
        const { checked, id } = e.target as HTMLInputElement;
        this.setState(({ favorites }) => ({
            favorites: {
                ...favorites,
                [id]: checked,
            }
        }), () => {
            setConfig({
                frontend: {
                    favorites: this.state.favorites
                }
            }).catch(console.error);
        });
    }

    private renderAccounts = () => {
        const { accounts } = this.props;
        const { favorites } = this.state;
        if (!favorites) {
            return null;
        }
        return accounts.map(account => {
            return (
                <div key={account.code} className={style.setting}>
                    <Logo className="m-right-half" coinCode={account.coinCode} alt={account.coinUnit} />
                    <span className="flex-1">
                        {account.name}
                        {' '}
                        <span className="unit">({account.coinUnit})</span>
                    </span>
                    {/* <ButtonLink>
                        Edit
                    </ButtonLink> */}
                    <Toggle
                        checked={(account.code in favorites) ? favorites[account.code] : true}
                        id={account.code}
                        onChange={this.toggleFavorAccount} />
                </div>
            );
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
                    <div class="innerContainer scrollableContainer">
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
                <Guide>
                    <Entry key="guide.settings.whyMultipleAccounts" entry={t('guide.settings.whyMultipleAccounts')} />
                </Guide>
            </div>
        );
    }
}

const HOC = translate<ManageAccountsProps>()(ManageAccounts);
export { HOC as ManageAccounts };
