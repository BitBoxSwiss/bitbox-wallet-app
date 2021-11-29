/**
 * Copyright 2018 Shift Devices AG
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
import { getCanVerifyXPub, IAccount, TBitcoinSimple, TEthereumSimple, TSigningConfiguration, verifyXPub } from '../../../api/account';
import { getScriptName, isBitcoinBased } from '../utils';
import { CopyableInput } from '../../../components/copy/Copy';
import { Button } from '../../../components/forms';
import { QRCode } from '../../../components/qrcode/qrcode';
import { translate, TranslateProps } from '../../../decorators/translate';
import * as style from './info.module.css';

interface ProvidedProps {
    account: IAccount;
    info: TSigningConfiguration;
    code: string;
    signingConfigIndex: number;
}

interface State {
    canVerifyExtendedPublicKey: boolean;
}

type Props = ProvidedProps & TranslateProps;

class SigningConfiguration extends Component<Props, State> {

    public readonly state: State = {
        canVerifyExtendedPublicKey: false,
    }

    public componentDidMount() {
        this.canVerifyExtendedPublicKeys();
    }

    private canVerifyExtendedPublicKeys = () => {
        getCanVerifyXPub(this.props.code).then(canVerifyExtendedPublicKey => {
            this.setState({ canVerifyExtendedPublicKey });
        });
    }

    private verifyExtendedPublicKey = (signingConfigIndex: number) => {
        verifyXPub(this.props.code, signingConfigIndex);
    }

    private getSimpleInfo(): TBitcoinSimple | TEthereumSimple {
        const { info } = this.props;
        if (info.bitcoinSimple !== undefined) {
            return info.bitcoinSimple;
        }
        return info.ethereumSimple;
    }

    public render(
        { children,
          account,
          code,
          t,
          signingConfigIndex,
        }: RenderableProps<Props>,
        { canVerifyExtendedPublicKey }: State
    ) {
        const config = this.getSimpleInfo();
        const bitcoinBased = isBitcoinBased(account.coinCode);
        return (
            <div className={style.address}>
                <div className={style.qrCode}>
                    { bitcoinBased ? (
                        <QRCode
                            data={config.keyInfo.xpub} />
                    ) : null }
                </div>
                <div className={style.details}>
                    <div className="labelLarge">
                        { account.isToken ? null : (
                            <p key="accountname" className={style.entry}>
                                {/* borrowing translation from accountSummary */}
                                <strong>{t('accountSummary.name')}:</strong>
                                <span>{account.name}</span>
                            </p>
                        )}
                        <p key="keypath" className={style.entry}>
                            <strong>Keypath:</strong>
                            <code>{config.keyInfo.keypath}</code>
                        </p>
                        { ('scriptType' in config) ? (
                            <p key="scriptName" className={style.entry}>
                                <strong>Type:</strong>
                                <span>{getScriptName(config.scriptType)}</span>
                            </p>
                        ) : null}
                        { ('scriptType' in config) ? (
                            <p key="scriptType" className={style.entry}>
                                <strong>Script Type:</strong>
                                <span>{config.scriptType.toUpperCase()}</span>
                            </p>
                        ) : null}
                        <p key="coinName" className={style.entry}>
                            <strong>{account.isToken ? 'Token' : 'Coin'}:</strong>
                            <span>{account.coinName} ({account.coinUnit})</span>
                        </p>
                        { bitcoinBased ? (
                            <p key="xpub" className={`${style.entry} ${style.largeEntry}`}>
                                <strong className="m-right-half">
                                    {t('accountInfo.extendedPublicKey')}:
                                </strong>
                                <CopyableInput
                                    className="flex-grow"
                                    alignLeft
                                    flexibleHeight
                                    value={config.keyInfo.xpub} />
                            </p>
                        ) : null }
                    </div>
                </div>
                <div className={style.buttons}>
                    { canVerifyExtendedPublicKey ? (
                        <Button className={style.verifyButton} primary onClick={() => this.verifyExtendedPublicKey(signingConfigIndex)}>
                            {t('accountInfo.verify')}
                        </Button>
                    ) : bitcoinBased ? null : (
                        <Button className={style.verifyButton} primary onClick={() => route(`/account/${code}/receive`)}>
                            {t('receive.verify')}
                        </Button>
                    ) }
                    {children}
                </div>
            </div>
        );
    }
}

const HOC = translate<ProvidedProps>()(SigningConfiguration);
export { HOC as SigningConfiguration };
