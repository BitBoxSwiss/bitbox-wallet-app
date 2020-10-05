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
import { ConfirmBaseRPC } from '../../components/bitboxbase/confirmbaserpc';
import { translate, TranslateProps } from '../../decorators/translate';
import { SettingsButton } from '../settingsButton/settingsButton';

interface EnableSSHLoginProps {
    apiPrefix: string;
    enabled: boolean;
    onSuccess: () => void; // GetBaseInfo() onSuccess to reflect the successful change
}

interface State {
    active: boolean;
    enabled: boolean;
}

type Props = EnableSSHLoginProps & TranslateProps;

class EnableSSHLogin extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            // the props update after a successful call, but we want to show the user
            // text based on the previous value
            enabled: this.props.enabled,
        };
    }

    public componentDidUpdate() {
        if (!this.state.active && this.props.enabled !== this.state.enabled) {
            this.setState({ enabled: this.props.enabled });
        }
    }

    private toggleDialog = () => {
        this.setState({
            active: !this.state.active,
        });
    }

    public render(
        {
            apiPrefix,
            enabled,
            onSuccess,
            t,
        }: RenderableProps<Props>,
        {
            active,
        }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={this.toggleDialog} optionalText={t('generic.enabled', { context: enabled.toString() })}>
                    {t('bitboxBase.settings.advanced.sshAccess.button')}
                </SettingsButton>
                {
                    active &&
                    <ConfirmBaseRPC
                        apiPrefix={apiPrefix}
                        apiEndpoint="/enable-ssh-password-login"
                        confirmText={t('bitboxBase.settings.advanced.sshAccess.confirm')}
                        inProgressText={t('bitboxBase.settings.advanced.sshAccess.inProgress')}
                        successText={t('bitboxBase.settings.advanced.sshAccess.success', { enabled: (t('generic.enabled', { context: (!this.state.enabled).toString() })).toLowerCase() })}
                        dialogTitle={t('bitboxBase.settings.advanced.sshAccess.title')}
                        args={!enabled}
                        toggleDialog={this.toggleDialog}
                        customButtonText={(t('generic.enable', { context: (!enabled).toString() }))}
                        onSuccess={onSuccess} />
                }
            </div>
        );
    }
}

const HOC = translate<EnableSSHLoginProps>()(EnableSSHLogin);
export { HOC as EnableSSHLogin };
