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

import { Component, h } from 'preact';
import { Button } from '../forms';
import { apiPost } from '../../utils/request';
import { Dialog } from '../dialog/dialog';


export default class Erase extends Component {
    state = {
        activeDialog: false,
    }

    abort = () => {
        this.setState({
            activeDialog: false,
        });
    }

    erase = () => {
        const filename = this.props.selectedBackup;
        if (!filename) return;
        apiPost('devices/' + this.props.deviceID + '/backups/erase', { filename }).then(() => {
            this.setState({ activeDialog: false });
            this.props.onErase();
        });
    }

    render({
        selectedBackup,
    }, {
        activeDialog,
    }) {
        return (
            <span>
                <Button
                    danger
                    disabled={selectedBackup === null}
                    onClick={() => this.setState({ activeDialog: true })}>
                    Erase
                </Button>
                {
                    activeDialog && (
                        <Dialog
                            title={`Erase ${selectedBackup}`}
                            onClose={this.abort}>
                            <p>Do you really want to erase {selectedBackup}?</p>
                            <div className={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                                <Button secondary onClick={this.abort}>Abort</Button>
                                <Button danger onClick={this.erase}>Erase</Button>
                            </div>
                        </Dialog>
                    )
                }
            </span>
        );
    }
}
