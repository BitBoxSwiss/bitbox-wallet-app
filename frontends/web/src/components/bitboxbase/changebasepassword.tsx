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
import { bbBaseErrorMessage } from '../../utils/bbbaseError';
import { apiPost } from '../../utils/request';
import { alertUser } from '../alert/Alert';
import { Dialog } from '../dialog/dialog';
import { Button  } from '../forms';
import { PasswordRepeatInput, PasswordSingleInput } from '../password';
import { SettingsButton } from '../settingsButton/settingsButton';

interface ChangeBasePasswordProps {
    apiPrefix: string;
}

interface State {
    active: boolean;
    inProgress: boolean;
    authenticated: boolean;
    oldPassword?: string;
    newPassword?: string;
    username: string;
}

type PasswordKind = 'oldPassword' | 'newPassword';

type Props = ChangeBasePasswordProps & TranslateProps;

class ChangeBasePassword extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            inProgress: false,
            authenticated: false,
            username: 'admin',
        };
    }

    private submitOldPassword = (event: Event) => {
        event.preventDefault();
        this.setState({ inProgress: true });
        if (!this.validate('oldPassword')) {
            return;
        }
        apiPost(this.props.apiPrefix + '/user-authenticate', {username: this.state.username, password: this.state.oldPassword })
        .then(response => {
            if (response.success) {
                this.setState({ authenticated: true });
            } else {
                bbBaseErrorMessage(response.code, this.props.t);
            }
            this.setState({ inProgress: false });
        });
    }

    private submitChangePassword = (event: Event) => {
        event.preventDefault();
        this.setState({ inProgress: true });
        if (!this.validate('newPassword')) {
            return;
        }
        apiPost(this.props.apiPrefix + '/user-change-password', {username: 'admin', password: this.state.oldPassword, newPassword: this.state.newPassword})
        .then(response => {
            if (response.success) {
                alertUser(this.props.t('bitboxBase.settings.node.passwordChangeSuccess'));
            } else {
                bbBaseErrorMessage(response.code, this.props.t);
            }
            this.setState({ authenticated: false, active: false, inProgress: false });
        });
        this.setState({ oldPassword: '', newPassword: '' });
    }

    private validate = (passwordKind: PasswordKind) => {
        return this.state[passwordKind] !== '';
    }

    private setValidOldPassword = (oldPassword: string) => {
        this.setState({ oldPassword });
    }

    private setValidNewPassword = (newPassword: string) => {
        this.setState({ newPassword });
    }

    private showDialog = () => {
        this.setState({
            active: true,
        });
    }

    private abort = () => {
        this.setState({
            active: false,
            authenticated: false,
            oldPassword: '',
        });
    }

    public render(
        {
            t,
        }: RenderableProps<Props>,
        {
            active,
            inProgress,
            authenticated,
            newPassword,
        }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={this.showDialog}>
                    {t('bitboxBase.settings.node.password')}
                </SettingsButton>
                {
                    active && !authenticated &&
                    <Dialog onClose={this.abort} title={t('bitboxBase.settings.node.password')} medium>
                        <div class="box medium">
                            <form onSubmit={this.submitOldPassword}>
                                <div>
                                    <PasswordSingleInput
                                        id="password"
                                        type="password"
                                        label={t('changePin.oldLabel')}
                                        showLabel= " "
                                        onValidPassword={this.setValidOldPassword} />
                                </div>
                                <div className="buttons">
                                    <Button
                                        primary
                                        disabled={inProgress}
                                        type="submit">
                                        {t('button.continue')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Dialog>
                }
                {
                    active && authenticated &&
                    <Dialog onClose={this.abort} title={t('bitboxBase.settings.node.password')} medium>
                        <div class="box medium">
                            <form onSubmit={this.submitChangePassword}>
                                <PasswordRepeatInput
                                    label={t('changePin.newTitle')}
                                    repeatLabel={t('initialize.input.labelRepeat')}
                                    showLabel=" "
                                    onValidPassword={this.setValidNewPassword} />
                                <div className={'buttons text-center'}>
                                    <Button
                                        disabled={!newPassword || inProgress}
                                        primary
                                        type="submit">
                                        {t('bitboxBase.settings.node.password')}
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

const HOC = translate<ChangeBasePasswordProps>()(ChangeBasePassword);
export { HOC as ChangeBasePassword};
