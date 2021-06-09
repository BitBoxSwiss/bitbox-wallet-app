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
import { getCanVerifyXPub, IAccount, ScriptType, TBitcoinSimple, TEthereumSimple, TSigningConfiguration, verifyXPub } from '../../../api/account';
import { CopyableInput } from '../../../components/copy/Copy';
import { Button } from '../../../components/forms';
import { QRCode } from '../../../components/qrcode/qrcode';
import { translate, TranslateProps } from '../../../decorators/translate';
import * as style from './info.css';

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

    private scriptTypeTitle = (scriptType: ScriptType) => {
        switch (scriptType) {
            case 'p2pkh':
                return 'Legacy';
            case 'p2wpkh-p2sh':
                return 'Segwit';
            case 'p2wpkh':
                return 'Native segwit (bech32)';
            default:
                return scriptType;
        }
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
        const isEthereumBased = 'ethereumSimple' in this.props.info;
        return (
            <div className={style.address}>
                <div className={style.qrCode}>
                    { isEthereumBased ? null : (
                        <QRCode
                            data={config.keyInfo.xpub} />
                    ) }
                </div>
                <div className={style.details}>
                    <div className="labelLarge">
                        { account.isToken ? null : (
                            <p key="accountname" className={style.entry}>
                                <strong>Account name:</strong>
                                <span>{account.name}</span>
                            </p>
                        )}
                        <p key="keypath" className={style.entry}>
                            <strong>Keypath:</strong>
                            <code>{config.keyInfo.keypath}</code>
                        </p>
                        { ('scriptType' in config) ? (
                            <p key="accountType" className={style.entry}>
                                <strong>Type:</strong>
                                <span>{this.scriptTypeTitle(config.scriptType)}</span>
                            </p>
                        ) : null}
                        <p key="coinName" className={style.entry}>
                            <strong>{account.isToken ? 'Token' : 'Coin'}:</strong>
                            <span>{account.coinName}</span>
                        </p>
                        <p key="coinUnit" className={style.entry}>
                            <strong>Unit:</strong>
                            <span>{account.coinUnit}</span>
                        </p>
                        { isEthereumBased ? null : (
                            <p key="xpub" className={`${style.entry} ${style.largeEntry}`}>
                                <strong className="m-right-half">xPub:</strong>
                                <CopyableInput
                                    className="flex-grow"
                                    alignLeft
                                    flexibleHeight
                                    value={config.keyInfo.xpub} />
                            </p>
                        ) }
                    </div>
                </div>
                <div className={style.buttons}>
                    { canVerifyExtendedPublicKey ? (
                        <Button className={style.verifyButton} primary onClick={() => this.verifyExtendedPublicKey(signingConfigIndex)}>
                            {t('accountInfo.verify')}
                        </Button>
                    ) : isEthereumBased ? (
                        <Button className={style.verifyButton} primary onClick={() => route(`/account/${code}/receive`)}>
                            {t('receive.verify')}
                        </Button>
                    ) : null }
                    {children}
                </div>
            </div>
        );
    }
}

const HOC = translate<ProvidedProps>()(SigningConfiguration);
export { HOC as SigningConfiguration };
