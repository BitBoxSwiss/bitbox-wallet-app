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
import { getCanVerifyXPub, ISigningConfiguration, ScriptType, verifyXPub } from '../../../api/account';
import { CopyableInput } from '../../../components/copy/Copy';
import { Button } from '../../../components/forms';
import { QRCode } from '../../../components/qrcode/qrcode';
import { translate, TranslateProps } from '../../../decorators/translate';
import * as style from './info.css';

interface ProvidedProps {
    info: ISigningConfiguration;
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

    public render(
        { t,
          info,
          signingConfigIndex,
        }: RenderableProps<Props>,
        { canVerifyExtendedPublicKey }: State) {
        if (info.bitcoinSimple === undefined) {
            return null;
        }
        return (
            <div className={style.address}>
                <div key={info.bitcoinSimple.keyInfo.xpub}>
                    <h2>{this.scriptTypeTitle(info.bitcoinSimple.scriptType)}</h2>
                    <label className="labelLarge">{t('accountInfo.extendedPublicKey')}</label>
                    <QRCode data={info.bitcoinSimple.keyInfo.xpub} />
                    <div className={style.textareaContainer}>
                        <CopyableInput value={info.bitcoinSimple.keyInfo.xpub} flexibleHeight />
                    </div>
                    <div className="buttons">
                        { canVerifyExtendedPublicKey ? (
                            <Button primary onClick={() => this.verifyExtendedPublicKey(signingConfigIndex)}>
                                {t('accountInfo.verify')}
                            </Button>
                        ) : null }
                    </div>
                </div>
        </div>
    ); }
}

const HOC = translate<ProvidedProps>()(SigningConfiguration);
export { HOC as SigningConfiguration };
