/**
 * Copyright 2018 Shift Devices AG
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
import { CopyableInput } from '../../../components/copy/Copy';
import { Button } from '../../../components/forms';
import { QRCode } from '../../../components/qrcode/qrcode';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet, apiPost } from '../../../utils/request';
import * as style from './info.css';

interface ProvidedProps {
    info: SigningConfigurationInterface;
    code: string;
    signingConfigIndex: number;
}

export type ScriptType = 'p2pkh' | 'p2wpkh-p2sh' | 'p2wpkh';

export interface SigningConfigurationInterface {
    scriptType: ScriptType;
    keypath: string;
    threshold: number;
    xpubs: string[];
    address: string;
}

interface State {
    canVerifyExtendedPublicKey: number[]; // holds a list of keystores which support secure verification
}

type Props = ProvidedProps & TranslateProps;

class SigningConfiguration extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = ({ canVerifyExtendedPublicKey: [] });
        this.canVerifyExtendedPublicKeys();
    }

    private canVerifyExtendedPublicKeys = () => {
        apiGet(`account/${this.props.code}/can-verify-extended-public-key`).then(canVerifyExtendedPublicKey => {
            this.setState({ canVerifyExtendedPublicKey });
        });
    }

    private verifyExtendedPublicKey = (signingConfigIndex: number, xpubIndex: number) => {
        apiPost(`account/${this.props.code}/verify-extended-public-key`, {
            signingConfigIndex, xpubIndex,
        });
    }

    private scriptTypeTitle = (scriptType: string) => {
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

    public render(
        { t,
          info,
          signingConfigIndex,
        }: RenderableProps<Props>,
        { canVerifyExtendedPublicKey }: State) {
        return (
        // TODO: add info if single or multisig, and threshold.
        <div className={style.address}>
            { info.address ?
                <div>
                    <label className="labelLarge">{t('accountInfo.address')}</label>
                    <QRCode data={info.address} />
                    <div className={style.textareaContainer}>
                        <CopyableInput flexibleHeight value={info.address} />
                    </div>
                </div>
                    :
                info.xpubs.map((xpub, xpubIndex) => {
                    return (
                        <div key={xpub}>
                            <h2>{this.scriptTypeTitle(info.scriptType)}</h2>
                            <label className="labelLarge">{t('accountInfo.extendedPublicKey')}</label>
                            {info.xpubs.length > 1 && (' #' + (xpubIndex + 1))}
                            <QRCode data={xpub} />
                            <div className={style.textareaContainer}>
                                <CopyableInput value={xpub} flexibleHeight />
                            </div>
                            <div className="buttons">
                                {
                                    canVerifyExtendedPublicKey.includes(xpubIndex) && (
                                        <Button primary onClick={() => this.verifyExtendedPublicKey(signingConfigIndex, xpubIndex)}>
                                            {t('accountInfo.verify')}
                                        </Button>
                                    )
                                }
                            </div>
                        </div>
                    );
                })
            }
        </div>
    ); }
}

const HOC = translate<ProvidedProps>()(SigningConfiguration);
export { HOC as SigningConfiguration };
