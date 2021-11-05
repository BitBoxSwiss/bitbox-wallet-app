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
import { getDeviceInfo, setMnemonicPassphraseEnabled } from '../../../api/bitbox02';
import { translate, TranslateProps } from '../../../decorators/translate';
import { SimpleMarkup } from '../../../utils/simplemarkup';
// This is the first time we use <View> in a <Main> component
// keeping guide and header as example in the code
import { /* Header, */ Main } from '../../../components/layout';
import { Button, Checkbox } from '../../../components/forms';
import { alertUser } from '../../../components/alert/Alert';
import { Message } from '../../../components/message/message';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../components/view/view';
// keeing as example for using guides in the new main component
// import { Guide } from '../../../components/guide/guide';
// import { Entry } from '../../../components/guide/entry';

interface MnemonicPassphraseButtonProps {
    deviceID: string;
    passphrase: 'enabled' | 'disabled';
}

interface State {
    infoStep: number;
    passphraseEnabled: boolean;
    status: 'info' | 'progress' | 'success';
    understood: boolean;
}

type Props = MnemonicPassphraseButtonProps & TranslateProps;

class Passphrase extends Component<Props, State> {
    public readonly state: State = {
        // before enabling/disabling we show 1 or more pages to inform about the feature
        // each page has a continue button that jumps to the next or finally toggles passphrase
        // infoStep counts down in decreasing order
        infoStep: this.props.passphrase === 'enabled'
            ? 0 // disabling passphrase shows only 1 info dialog
            : 5, // enabling has 6 dialogs with information,
        status: 'info',
        passphraseEnabled: this.props.passphrase === 'enabled',
        understood: false,
    }

    private togglePassphrase = () => {
        const { deviceID, t } = this.props;
        const enable = !this.state.passphraseEnabled;
        this.setState({ status: 'progress' });
        setMnemonicPassphraseEnabled(deviceID, enable)
            .then(() => getDeviceInfo(deviceID))
            .then(({ mnemonicPassphraseEnabled }) => {
                this.setState({
                    passphraseEnabled: mnemonicPassphraseEnabled,
                    status: 'success',
                });
            })
            .catch((e) => {
                route(`/device/${deviceID}`);
                alertUser(t(`passphrase.error.e${e.code}`, {
                    defaultValue: e.message || t('genericError'),
                }));
            });
    }

    private stopInfo = () => route(`/device/${this.props.deviceID}`)

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
                    <View key="step-intro" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.intro.title')} />
                        <ViewContent>
                            {this.renderMultiLine(t('passphrase.intro.message'))}
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.what.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
                );
            case 4:
                return (
                    <View key="step-what" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.what.title')} />
                        <ViewContent>
                            {this.renderMultiLine(t('passphrase.what.message'))}
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.why.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
                );
            case 3:
                return (
                    <View key="step-why" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.why.title')} />
                        <ViewContent>
                            {this.renderMultiLine(t('passphrase.why.message'))}
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.considerations.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
                );
            case 2:
                return (
                    <View key="step-considerations" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.considerations.title')} />
                        <ViewContent>
                            {this.renderMultiLine(t('passphrase.considerations.message'))}
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.how.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
                );
            case 1:
                return (
                    <View key="step-how" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.how.title')} />
                        <ViewContent>
                            {this.renderMultiLine(t('passphrase.how.message'))}
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo}>
                                {t('passphrase.summary.button')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
                );
            case 0:
                return (
                    <View key="step-summary" onClose={this.stopInfo}>
                        <ViewHeader title={t('passphrase.summary.title')} />
                        <ViewContent>
                            <ul style="padding-left: var(--space-default);">
                                <SimpleMarkup key="info-1" tagName="li" markup={t('passphrase.summary.understandList.0')} />
                                <SimpleMarkup key="info-2" tagName="li" markup={t('passphrase.summary.understandList.1')} />
                                <SimpleMarkup key="info-3" tagName="li" markup={t('passphrase.summary.understandList.2')} />
                                <SimpleMarkup key="info-4" tagName="li" markup={t('passphrase.summary.understandList.3')} />
                            </ul>
                            <Message type="message">
                                <Checkbox
                                    onChange={e => this.setState({ understood: (e.target as HTMLInputElement)?.checked })}
                                    id="understood"
                                    checked={understood}
                                    label={t('passphrase.summary.understand')} />
                            </Message>
                        </ViewContent>
                        <ViewButtons>
                            <Button primary onClick={this.continueInfo} disabled={!understood}>
                                {t('passphrase.enable')}
                            </Button>
                            <Button transparent onClick={this.stopInfo}>
                                {t('button.back')}
                            </Button>
                        </ViewButtons>
                    </View>
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
            <View key="step-disable-info1" onClose={this.stopInfo}>
                <ViewHeader title={t('passphrase.disable')} />
                <ViewContent>
                    {this.renderMultiLine(t('passphrase.disableInfo.message'))}
                </ViewContent>
                <ViewButtons>
                    <Button primary onClick={this.continueInfo}>
                        {t('passphrase.disableInfo.button')}
                    </Button>
                    <Button transparent onClick={this.stopInfo}>
                        {t('button.back')}
                    </Button>
                </ViewButtons>
            </View>
        );
    }

    public render(
        { t }: RenderableProps<Props>,
        { passphraseEnabled, status }: State,
    ) {
        return (
            <Main>
                {/* <Header /> */}
                {status === 'info' && (
                    passphraseEnabled
                        ? this.renderDisableInfo()
                        : this.renderEnableInfo()
                )}
                {status === 'progress' && (
                    <View key="progress" position="fullscreen">
                        <ViewHeader
                            title={t(passphraseEnabled
                                ? 'passphrase.progressDisable.title'
                                : 'passphrase.progressEnable.title')}>
                            {t(passphraseEnabled
                                ? 'passphrase.progressDisable.message'
                                : 'passphrase.progressEnable.message')}
                        </ViewHeader>
                        <ViewContent />
                    </View>
                )}
                {status === 'success' && (
                    <View key="progress" position="fullscreen">
                        <ViewHeader
                            title={t(passphraseEnabled
                                ? 'passphrase.successDisabled.title'
                                : 'passphrase.successEnabled.title')} >
                        </ViewHeader>
                        <ViewContent>
                            {this.renderMultiLine(
                                t(passphraseEnabled
                                    ? 'passphrase.successDisabled.message'
                                    : 'passphrase.successEnabled.message')
                            )}
                            {passphraseEnabled && (
                                <ul style="padding-left: var(--space-default);">
                                    <SimpleMarkup key="tip-1" tagName="li" markup={t('passphrase.successEnabled.tipsList.0')} />
                                    <SimpleMarkup key="tip-2" tagName="li" markup={t('passphrase.successEnabled.tipsList.1')} />
                                </ul>
                            )}
                            <SimpleMarkup tagName="p" markup={t('passphrase.successEnabled.messageEnd')} />

                        </ViewContent>
                    </View>
                )}
                {/* <Guide>
                    <Entry key="whatisapassphrase" entry={t('guide.passphrase.whatisapassphrase')} />
                </Guide> */}
            </Main>
        );
    }
}

const HOC = translate<MnemonicPassphraseButtonProps>()(Passphrase);
export { HOC as Passphrase };
