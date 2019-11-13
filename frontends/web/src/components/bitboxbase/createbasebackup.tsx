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

interface CreateBaseBackupProps {
    apiPrefix: string;
}

interface State {
    active: boolean;
}

type Props = CreateBaseBackupProps & TranslateProps;

class CreateBaseBackup extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
        };
    }

    private toggleDialog = () => {
        this.setState({
            active: !this.state.active,
        });
    }

    public render(
        {
            apiPrefix,
            t,
        }: RenderableProps<Props>,
        {
            active,
        }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={this.toggleDialog}>
                    {t('bitboxBase.settings.backups.create')}
                </SettingsButton>
                {
                    active &&
                    <ConfirmBaseRPC
                        apiPrefix={apiPrefix}
                        apiEndpoint="/backup-sysconfig"
                        confirmText={t('bitboxBase.settings.backups.confirmBackup')}
                        inProgressText={t('bitboxBase.settings.backups.creating')}
                        successText={t('bitboxBase.settings.backups.created')}
                        dialogTitle={t('bitboxBase.settings.backups.create')}
                        toggleDialog={this.toggleDialog} />
                }
            </div>
        );
    }
}

const HOC = translate<CreateBaseBackupProps>()(CreateBaseBackup);
export { HOC as CreateBaseBackup};
