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
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { alertUser } from '../../alert/Alert';
import { Button } from '../../forms';

interface MnemonicPassphraseButtonProps {
    apiPrefix: string;
    getInfo: () => void;
    mnemonicPassphraseEnabled: boolean;
}

type Props = MnemonicPassphraseButtonProps & TranslateProps;

class MnemonicPassphraseButton  extends Component<Props, {}> {
    private toggle = () => {
        const enable = !this.props.mnemonicPassphraseEnabled;
        apiPost(this.props.apiPrefix + '/set-mnemonic-passphrase-enabled',
                enable).then(({ success }) => {
                    if (success) {
                        if (enable) {
                            alertUser(this.props.t('bitbox02Settings.mnemonicPassphrase.successEnable'));
                        } else {
                            alertUser(this.props.t('bitbox02Settings.mnemonicPassphrase.successDisable'));
                        }
                        this.props.getInfo();
                    }
        });
    }

    public render(
        { t,
          mnemonicPassphraseEnabled,
        }: RenderableProps<Props>,
        { }: { },
    ) {
        return (
            <div>
                <Button primary onClick={this.toggle}>
                    {mnemonicPassphraseEnabled ? t('bitbox02Settings.mnemonicPassphrase.disable') : t('bitbox02Settings.mnemonicPassphrase.enable')}
                </Button>
            </div>
        );
    }
}

const HOC = translate<MnemonicPassphraseButtonProps>()(MnemonicPassphraseButton );
export { HOC as MnemonicPassphraseButton  };
