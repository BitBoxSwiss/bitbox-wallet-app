/**
 * Copyright 2019 Shift Devices AG
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
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';
import { alertUser } from '../alert/Alert';
import { confirmation } from '../confirm/Confirm';
import { Dialog } from '../dialog/dialog';
import { Button  } from '../forms';
import { PasswordRepeatInput } from '../password';
import { SettingsButton } from '../settingsButton/settingsButton';

interface SetBaseSystemPasswordProps {
    apiPrefix: string;
}

interface State {
    active: boolean;
    inProgress: boolean;
    password?: string;
}

type Props = SetBaseSystemPasswordProps & TranslateProps;

class SetBaseSystemPassword extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            inProgress: false,
        };
    }

    private submitPassword = (event: Event) => {
        event.preventDefault();
        this.setState({ inProgress: true });
        if (!this.validate()) {
            return;
        }
        apiPost(this.props.apiPrefix + '/set-login-password', { password: this.state.password })
            .then(response => {
                if (response.success) {
                    alertUser(this.props.t('bitboxBase.settings.advanced.systemPasswordSuccess'));
                } else {
                    alertUser(response.message);
                }
                this.setState({ inProgress: false, active: false, password: undefined });
            });
    }

    private validate = () => {
        return this.state.password !== '';
    }

    private setValidPassword = (password: string) => {
        this.setState({ password });
    }

    private showDialog = () => {
        this.setState({
            active: true,
        });
    }

    private abort = () => {
        this.setState({
            active: false,
            password: undefined,
        });
    }

    public render(
        {
            t,
        }: RenderableProps<Props>,
        {
            active,
            inProgress,
            password,
        }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={() => {
                    confirmation(t('bitboxBase.settings.advanced.confirmSystemPassword'), confirmed => {
                        // tslint:disable-next-line: no-unused-expression
                        confirmed && this.showDialog();
                    });
                }}>
                    {t('bitboxBase.settings.advanced.systemPassword')}
                </SettingsButton>
                {
                    active &&
                    <Dialog onClose={this.abort} title={t('bitboxBase.settings.advanced.systemPassword')} medium>
                        <div className="box medium">
                            <form onSubmit={this.submitPassword}>
                                <PasswordRepeatInput
                                    label={t('changePin.newTitle')}
                                    repeatLabel={t('initialize.input.labelRepeat')}
                                    showLabel=" "
                                    onValidPassword={this.setValidPassword} />
                                <div className={'buttons text-center'}>
                                    <Button
                                        disabled={!password || inProgress}
                                        primary
                                        type="submit">
                                        {t('bitboxBase.settings.advanced.systemPassword')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Dialog>
                }
            </div>
        );
    }
}

const HOC = translate<SetBaseSystemPasswordProps>()(SetBaseSystemPassword);
export { HOC as SetBaseSystemPassword };
