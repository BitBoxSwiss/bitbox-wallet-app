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
import { Dialog } from '../../dialog/dialog';
import * as dialogStyle from '../../dialog/dialog.css';
import { Button, Checkbox } from '../../forms';
import { SettingsButton } from '../../settingsButton/settingsButton';
import WaitDialog from '../../wait-dialog/wait-dialog';

interface ResetProps {
    apiPrefix: string;
}

type Props = ResetProps & TranslateProps;

interface State {
    understand: boolean;
    isConfirming: boolean;
    activeDialog: boolean;
}

class Reset extends Component<Props, State> {
    public state = {
        understand: false,
        isConfirming: false,
        activeDialog: false,
    };

    private handleKeyDown = e => {
        if (e.keyCode === 27 && !this.state.isConfirming) {
            this.abort();
        }
    }

    public componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private reset = () => {
        this.setState({
            activeDialog: false,
            isConfirming: true,
        });
        apiPost(this.props.apiPrefix + '/reset').then(data => {
            this.abort();
            if (!data.success) {
                alertUser(this.props.t('reset.notReset'));
            }
        });
    }

    private handleUnderstandChange = e => {
        this.setState({ understand: e.target.checked });
    }

    private abort = () => {
        this.setState({
            understand: false,
            isConfirming: false,
            activeDialog: false,
        });
    }

    public render(
        { t }: RenderableProps<Props>,
        { understand,
          isConfirming,
          activeDialog,
        }: State) {
        return (
            <div>
                <SettingsButton
                    danger
                    onClick={() => this.setState({ activeDialog: true })}>
                    {t('reset.button')}
                </SettingsButton>
                {
                    activeDialog && (
                        <Dialog
                            title={t('reset.title')}
                            onClose={this.abort}
                            disabledClose={isConfirming}
                            small>
                            <div className="columnsContainer half">
                                <div className="columns">
                                    <div className="column">
                                        <p>{t('reset.description')}</p>
                                        <div>
                                            <Checkbox
                                                id="reset_understand"
                                                label={t('reset.understand')}
                                                checked={understand}
                                                onChange={this.handleUnderstandChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={dialogStyle.actions}>
                                <Button danger disabled={!understand} onClick={this.reset}>
                                    {t('reset.button')}
                                </Button>
                            </div>
                        </Dialog>
                    )
                }
                {
                    isConfirming && (
                        <WaitDialog
                            active={isConfirming}
                            title={t('reset.title')} >
                            {t('bitbox02Interact.followInstructions')}
                        </WaitDialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<ResetProps>()(Reset);
export { HOC as Reset };
