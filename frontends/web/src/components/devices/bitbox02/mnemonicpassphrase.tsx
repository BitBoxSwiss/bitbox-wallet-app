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
import SimpleMarkup from '../../../utils/simplemarkup';
import { alertUser } from '../../alert/Alert';
import { SettingsButton } from '../../settingsButton/settingsButton';
import WaitDialog from '../../wait-dialog/wait-dialog';

interface MnemonicPassphraseButtonProps {
    apiPrefix: string;
    getInfo: () => void;
    mnemonicPassphraseEnabled: boolean;
}

interface State {
    inProgress: boolean;
}

type Props = MnemonicPassphraseButtonProps & TranslateProps;

class MnemonicPassphraseButton  extends Component<Props, State> {
    private toggle = () => {
        const enable = !this.props.mnemonicPassphraseEnabled;
        this.setState({ inProgress: true });
        apiPost(this.props.apiPrefix + '/set-mnemonic-passphrase-enabled',
                enable).then(({ success }) => {
                    this.setState({ inProgress: false });
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
        { inProgress }: State,
    ) {
        const title = mnemonicPassphraseEnabled ? t('bitbox02Settings.mnemonicPassphrase.disable') : t('bitbox02Settings.mnemonicPassphrase.enable');
        const message = t('bitbox02Settings.mnemonicPassphrase.description');
        return (
            <div>
                <SettingsButton onClick={this.toggle}>{title}</SettingsButton>
                {
                    inProgress && (
                        <WaitDialog title={title}>
                            <div className="columnsContainer half">
                                <div className="columns">
                                    <div className="column">
                                        {
                                            !mnemonicPassphraseEnabled && message && (
                                                <p>
                                                    {
                                                        message.split('\n').map(line => (
                                                            <span>
                                                                <SimpleMarkup tagName="span" markup={line} /><br/>
                                                            </span>
                                                        ))
                                                    }
                                                </p>
                                            )
                                        }
                                        <p>{t('bitbox02Interact.followInstructions')}</p>
                                    </div>
                                </div>
                            </div>
                        </WaitDialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<MnemonicPassphraseButtonProps>()(MnemonicPassphraseButton );
export { HOC as MnemonicPassphraseButton  };
