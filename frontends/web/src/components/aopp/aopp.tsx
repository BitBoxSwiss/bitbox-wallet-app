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
import { AccountCode } from '../../api/account';
import * as aoppAPI from '../../api/aopp';
import { subscribe } from '../../decorators/subscribe';
import { translate, TranslateProps } from '../../decorators/translate';
import { equal } from '../../utils/equal';
import { Fullscreen, FullscreenHeader, FullscreenContent, FullscreenButtons } from '../fullscreen/fullscreen';
import { Message } from '../message/message';
import { Button, Field, Input, Label, Select } from '../forms';
import { CopyableInput } from '../copy/Copy';
import { ArrowDown, BitBox02Stylized, Cancel, Checked } from '../icon';
import * as styles from './aopp.css';

const Banner = ({ children }: RenderableProps<{}>) => (
    <div className={styles.banner}>{children}</div>
);

interface State {
    accountCode: AccountCode;
}

interface AoppProps {
}

interface SubscribedProps {
    aopp?: aoppAPI.Aopp;
}

type Props = SubscribedProps & AoppProps & TranslateProps;

class Aopp extends Component<Props, State> {
    public readonly state: State = {
        accountCode: '',
    };

    public componentDidMount() {
        this.setAccountCodeDefault();
    }

    public componentDidUpdate(prevProps) {
        if (!equal(this.props.aopp?.accounts, prevProps.aopp?.accounts)) {
            this.setAccountCodeDefault();
        }
    }

    private setAccountCodeDefault() {
        const { aopp } = this.props;
        if (aopp?.accounts && aopp?.accounts?.length) {
            this.setState({ accountCode: aopp.accounts[0].code });
        }
    }

    private chooseAccount = (e: Event) => {
        if (this.state.accountCode) {
            aoppAPI.chooseAccount(this.state.accountCode);
        }
        e.preventDefault();
    }

    public render(
        { t, aopp }: RenderableProps<Props>,
        { accountCode }: State,
    ) {
        if (!aopp) {
            return null;
        }
        const domain = aopp.callback ? new URL(aopp.callback).host : '';
        switch (aopp.state) {
            case 'error':
                return (
                    <Fullscreen>
                        <FullscreenHeader title={t('aopp.errorTitle')}>
                            <p>{domain}</p>
                        </FullscreenHeader>
                        <FullscreenContent>
                            <Message type="error">
                                <Cancel className={styles.smallIcon} /><br />
                                {t(`error.${aopp.errorCode}`, { host: domain })}
                            </Message>
                        </FullscreenContent>
                        <FullscreenButtons>
                            <Button danger onClick={aoppAPI.cancel}>Dismiss</Button>
                        </FullscreenButtons>
                    </Fullscreen>
                );
            case 'inactive':
                // Inactive, waiting for action.
                return null;
            case 'user-approval':
                return (
                    <Fullscreen>
                        <FullscreenHeader title={t('aopp.title')} withAppLogo />
                        <FullscreenContent>
                            <p>{t('aopp.addressRequest', { host: domain })}</p>
                        </FullscreenContent>
                        <FullscreenButtons>
                            <Button primary onClick={aoppAPI.approve}>{t('button.continue')}</Button>
                            <Button secondary onClick={aoppAPI.cancel}>{t('dialog.cancel')}</Button>
                        </FullscreenButtons>
                    </Fullscreen>
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
                        <Fullscreen>
                            <FullscreenHeader title={t('aopp.title')}>
                                <p>{domain}</p>
                            </FullscreenHeader>
                            <FullscreenContent>
                                <Select
                                    label={t('buy.info.selectLabel')}
                                    options={options}
                                    defaultValue={options[0].value}
                                    value={accountCode}
                                    onChange={e => this.setState({ accountCode: e.target.value })}
                                    id="account" />
                            </FullscreenContent>
                            <FullscreenButtons>
                                <Button primary type="submit">{t('button.next')}</Button>
                                <Button secondary onClick={aoppAPI.cancel}>{t('dialog.cancel')}</Button>
                            </FullscreenButtons>
                        </Fullscreen>
                    </form>
                );
            }
            case 'syncing':
                return (
                    <Fullscreen>
                        <FullscreenHeader title={t('aopp.title')}>
                            <p>{domain}</p>
                        </FullscreenHeader>
                        <FullscreenContent>{t('aopp.syncing')}</FullscreenContent>
                    </Fullscreen>
                );
            case 'signing':
                return (
                    <Fullscreen>
                        <FullscreenHeader title={t('aopp.title')}>
                            <p className={styles.domainName}>{domain}</p>
                        </FullscreenHeader>
                        <FullscreenContent>
                            <p>{t('aopp.signing')}</p>
                            <ArrowDown />
                            <BitBox02Stylized className={styles.device} />
                        </FullscreenContent>
                    </Fullscreen>
                );
            case 'success':
                return (
                    <Fullscreen>
                        <FullscreenHeader title={t('aopp.title')}>
                            <p className={styles.domainName}>{domain}</p>
                        </FullscreenHeader>
                        <FullscreenContent>
                            <Checked className={styles.largeIcon} />
                            <h2 className={styles.title}>{t('aopp.success.title')}</h2>
                            <p>{t('aopp.success.message', { host: domain })}</p>
                            <Field>
                                <Label>{t('aopp.labelAddress')}</Label>
                                <CopyableInput alignLeft value={aopp.address} />
                            </Field>
                            <Field>
                                <Label>{t('aopp.labelMessage')}</Label>
                                <Input readOnly value={aopp.message} />
                            </Field>
                        </FullscreenContent>
                        <FullscreenButtons>
                            <Button primary onClick={aoppAPI.cancel}>{t('button.complete')}</Button>
                            <div className={styles.buttonWithInfo}>
                                {/* TODO: show address again on the device */}
                                <Button secondary onClick={() => console.warn('TODO: show address on device again')}>
                                    {t('aopp.reverify')}
                                </Button>
                                <div className={styles.buttonInfoText}>
                                    {t('aopp.reverifyInfoText')}
                                </div>
                            </div>
                        </FullscreenButtons>
                    </Fullscreen>
                );
        }
    }
}

const subscribeHOC = subscribe<SubscribedProps, AoppProps & TranslateProps>(
    { aopp: 'aopp' },
    false,
    false,
)(Aopp);

const translateHOC = translate<AoppProps>()(subscribeHOC);
export { translateHOC as Aopp };
