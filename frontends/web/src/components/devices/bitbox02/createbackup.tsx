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

interface CreateProps {
    deviceID: string;
}

type Props = CreateProps & TranslateProps;

interface State {
    creatingBackup: boolean;
}

class Create extends Component<Props, State> {
    public state = {
        creatingBackup: false,
    };

    private createBackup = () => {
        this.setState({ creatingBackup: true });
        apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
            if (!success) {
                alertUser('creating backup failed, try again');
            }
            this.setState({ creatingBackup: false });
        });
    }

    public render({ t }: RenderableProps<Props>, {creatingBackup}: State) {
        return (
            <Button
                primary
                disabled={creatingBackup}
                onClick={() => this.createBackup()}>
                {t('button.create')}
            </Button>
        );
    }
}

const HOC = translate<CreateProps>()(Create);
export { HOC as Create };
