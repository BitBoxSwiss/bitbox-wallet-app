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
import { Dialog } from '../dialog/dialog';
import { Button, Input } from '../forms';
import { SettingsButton } from '../settingsButton/settingsButton';

interface ChangeBaseHostnameProps {
    apiPrefix: string;
    currentHostname: string;
    getBaseInfo: () => void;
}

interface State {
    active: boolean;
    inProgress: boolean;
    newHostname: string;
    validHostname: boolean;
}

const hostnamePattern = '^[a-z][a-z0-9-]{0,22}[a-z0-9]$';

type Props = ChangeBaseHostnameProps & TranslateProps;

class ChangeBaseHostname extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            active: false,
            inProgress: false,
            newHostname: '',
            validHostname: false,
        };
    }

    private setHostname = () => {
        this.setState({inProgress: true});
        apiPost(this.props.apiPrefix + '/set-hostname', {hostname: this.state.newHostname})
        .then(response => {
            if (response.success) {
                this.props.getBaseInfo(); // FIXME: there should be a notification from the middleware when BaseInfo changes instead of having to call it manually
                this.setState({ active: false, inProgress: false, newHostname: '' });
            } else {
                this.setState({ active: false, inProgress: false, newHostname: '' });
                bbBaseErrorMessage(response.code, this.props.t);
            }
        });
    }

    private showDialog = () => {
        this.setState({
            active: true,
            newHostname: '',
        });
    }

    private handleNameInput = (event: Event) => {
        const target = (event.target as HTMLInputElement);
        const newHostname: string = target.value;
        if (newHostname.match(hostnamePattern) !== null) {
            this.setState({ newHostname, validHostname: true });
        } else {
            this.setState({ newHostname, validHostname: false });
        }
    }

    private abort = () => {
        this.setState({
            active: false,
        });
    }

    public render(
        {
            t,
            currentHostname,
        }: RenderableProps<Props>,
        {
            active,
            inProgress,
            validHostname,
            newHostname,
        }: State,
    ) {
        return (
            <div>
                <SettingsButton onClick={this.showDialog} optionalText={currentHostname}>
                    {t('bitboxBase.settings.node.changeName')}
                </SettingsButton>
                {
                    active ? (
                        <Dialog onClose={this.abort} title={t('bitboxBase.settings.node.changeNameTitle')} small>
                            <div className="columnsContainer half">
                                <div className="columns half">
                                    <div className="column">
                                        <h2 className="flex flex-row flex-center m-bottom-half m-top-quarter">{currentHostname}</h2>
                                    </div>
                                    <div className="column">
                                        <Input
                                            pattern={hostnamePattern}
                                            label={t('bitboxBase.settings.node.newName')}
                                            placeholder={t('bitboxBaseWizard.hostname.placeholder')}
                                            type="text"
                                            title={t('bitboxBaseWizard.hostname.tooltip')}
                                            value={newHostname}
                                            onInput={this.handleNameInput} />
                                    </div>
                                </div>
                            </div>
                            <div className="buttons text-center m-top-none">
                                <Button
                                    primary
                                    onClick={this.setHostname}
                                    disabled={!validHostname || inProgress}>
                                    {t('button.continue')}
                                </Button>
                            </div>
                        </Dialog>
                    ) : null
                }
            </div>
        );
    }
}

const HOC = translate<ChangeBaseHostnameProps>()(ChangeBaseHostname);
export { HOC as ChangeBaseHostname};
