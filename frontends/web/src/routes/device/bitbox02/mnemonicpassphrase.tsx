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
import { getDeviceInfo, setMnemonicPassphraseEnabled } from '../../../api/bitbox02';
import { translate, TranslateProps } from '../../../decorators/translate';
import { SimpleMarkup } from '../../../utils/simplemarkup';
import { Button, Checkbox } from '../../../components/forms';
import { alertUser } from '../../../components/alert/Alert';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';
import { Message } from '../../../components/message/message';

interface MnemonicPassphraseButtonProps {
    deviceID: string;
    passphraseEnabled: boolean;
}

interface State {
    infoStep: number;
    passphraseEnabled: boolean;
    status: 'idle' | 'info' | 'progress' | 'success';
    understood: boolean;
}

type Props = MnemonicPassphraseButtonProps & TranslateProps;

class MnemonicPassphraseButton extends Component<Props, State> {
    public readonly state: State = {
        infoStep: 5,
        status: 'idle',
        passphraseEnabled: this.props.passphraseEnabled,
        understood: false,
    }

    private togglePassphrase = () => {
        const { t } = this.props;
        const enable = !this.state.passphraseEnabled;
        this.setState({ status: 'progress' });
        setMnemonicPassphraseEnabled(this.props.deviceID, enable)
            .then(() => getDeviceInfo(this.props.deviceID))
            .then(({ mnemonicPassphraseEnabled }) => {
                this.setState({
                    passphraseEnabled: mnemonicPassphraseEnabled,
                    status: 'success',
                });
            })
            .catch((e) => {
                this.setState({ status: 'idle' });
                alertUser(t(`passphrase.error.e${e.code}`, {
                    defaultValue: e.message || t('genericError'),
                }));
            });
    }

    private startInfo = () => {
        const { passphraseEnabled } = this.state;
        this.setState({
            // before enabling/disabling we show 1 or more pages to inform about the feature
            // each page has a continue button that jumps to the next or finally toggles passphrase
            // infoStep counts down in decreasing order
            infoStep: passphraseEnabled
                ? 0 // disabling passphrase shows only 1 info dialog
                : 5, // enabling has 6 dialogs with information
            status: 'info',
            understood: false,
        });
    }

    private stopInfo = () => this.setState({ status: 'idle' })

    private continueInfo = () => {
        if (this.state.infoStep === 0) {
            this.togglePassphrase();
            return;
        }
        this.setState(({ infoStep }) => ({ infoStep: infoStep - 1 }));
    }

    private renderEnableInfo = () => {
        const { infoStep, understood } = this.state;
        const { t } = this.props;
        switch (infoStep) {
            case 5:
                return (
                    <Dialog key="step-intro" medium title={t('passphrase.intro.title')} onClose={this.stopInfo}>
                        {this.renderMultiLine(t('passphrase.intro.message'))}
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.what.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            case 4:
                return (
                    <Dialog key="step-what" medium title={t('passphrase.what.title')} onClose={this.stopInfo}>
                        {this.renderMultiLine(t('passphrase.what.message'))}
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.why.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            case 3:
                return (
                    <Dialog key="step-why" medium title={t('passphrase.why.title')} onClose={this.stopInfo}>
                        {this.renderMultiLine(t('passphrase.why.message'))}
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.considerations.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            case 2:
                return (
                    <Dialog key="step-considerations" medium title={t('passphrase.considerations.title')} onClose={this.stopInfo}>
                        {this.renderMultiLine(t('passphrase.considerations.message'))}
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.how.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            case 1:
                return (
                    <Dialog key="step-how" medium title={t('passphrase.how.title')} onClose={this.stopInfo}>
                        {this.renderMultiLine(t('passphrase.how.message'))}
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.summary.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            case 0:
                return (
                    <Dialog key="step-summary" medium title={t('passphrase.summary.title')} onClose={this.stopInfo}>
                        <ul style="padding-left: var(--space-default);">
                            <SimpleMarkup key="info-1" tagName="li" markup={t('passphrase.summary.understandList.0')} />
                            <SimpleMarkup key="info-2" tagName="li" markup={t('passphrase.summary.understandList.1')} />
                            <SimpleMarkup key="info-3" tagName="li" markup={t('passphrase.summary.understandList.2')} />
                        </ul>
                        <Message type="message">
                            <Checkbox
                                onChange={e => this.setState({ understood: (e.target as HTMLInputElement)?.checked })}
                                id="understood"
                                checked={understood}
                                label={t('passphrase.summary.understand')} />
                        </Message>
                        <DialogButtons>
                            <Button primary onClick={this.continueInfo} disabled={!understood}>
                                {t('passphrase.enable')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </DialogButtons>
                    </Dialog>
                );
            default:
                console.error(`invalid infoStep ${infoStep}`);
                return;
        }
    }

    private renderMultiLine = text => text.split('\n').map((line: string, i: number) => (
        <SimpleMarkup key={`${line}-${i}`} tagName="p" markup={line} />
    ))

    private renderDisableInfo = () => {
        const { t } = this.props;
        return (
            <Dialog key="step-disable-info1" medium title={t('passphrase.disable')} onClose={this.stopInfo}>
                {this.renderMultiLine(t('passphrase.disableInfo.message'))}
                <DialogButtons>
                    <Button primary onClick={this.continueInfo}>
                        {t('passphrase.disableInfo.button')}
                    </Button>
                    <Button transparent onClick={this.stopInfo}>
                        {t('button.back')}
                    </Button>
                </DialogButtons>
            </Dialog>
        );
    }

    public render(
        { t }: RenderableProps<Props>,
        { passphraseEnabled, status }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={this.startInfo}>
                    {passphraseEnabled
                        ? t('passphrase.disable')
                        : t('passphrase.enable')}
                </SettingsButton>
                {status === 'info' && (
                    passphraseEnabled
                        ? this.renderDisableInfo()
                        : this.renderEnableInfo()
                )}
                {status === 'progress' && (
                    <WaitDialog
                        title={t(passphraseEnabled
                            ? 'passphrase.progressDisable.title'
                            : 'passphrase.progressEnable.title')}>
                        {t(passphraseEnabled
                            ? 'passphrase.progressDisable.message'
                            : 'passphrase.progressEnable.message')}
                    </WaitDialog>
                )}
                {status === 'success' && (
                    <WaitDialog
                        title={t(passphraseEnabled
                            ? 'passphrase.successDisabled.title'
                            : 'passphrase.successEnabled.title')} >
                        {this.renderMultiLine(
                            t(passphraseEnabled
                                ? 'passphrase.successDisabled.message'
                                : 'passphrase.successEnabled.message')
                        )}
                    </WaitDialog>
                )}
            </div>
        );
    }
}

const HOC = translate<MnemonicPassphraseButtonProps>()(MnemonicPassphraseButton );
export { HOC as MnemonicPassphraseButton  };
