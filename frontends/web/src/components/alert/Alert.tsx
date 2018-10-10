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
import { translate } from 'react-i18next';
import Dialog from '../dialog/dialog';
import { Button } from '../forms';

let alertUser: (message: string) => void;

interface Props {
    t: () => void;
}

interface State {
    active: boolean;
    message?: string;
}

@translate()
class Alert extends Component<Props, State> {
    private button!: Component;

    constructor(props) {
        super(props);
        alertUser = this.alerted;
        this.state = {
            active: false,
        };
    }

    public componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    private setButtonRef = element => {
        this.button = element;
    }

    private handleClose = e => {
        this.setState({
            active: false,
            message: undefined,
        });
    }

    private handleKeyDown = e => {
        if (e.keyCode === 13 && this.state.active) {
            this.setState({ active: false });
        }
    }

    private alerted = message => {
        this.setState({
            message,
            active: true,
        }, () => {
            this.button.base!.focus();
        });
    }

    public render({ t }, { message, active }) {
        return active ? (
            <Dialog
                onClose={this.handleClose}
                disableEscape>
                {
                    message.split('\n').map((line, i) => (
                        <p
                            key={i}
                            class={ i === 0 ? 'first' : '' }>
                            {line}
                        </p>
                    ))
                }
                <div class="buttons flex flex-row flex-end">
                    <Button
                        primary
                        ref={this.setButtonRef}
                        onClick={this.handleClose}>
                        {t('button.ok')}
                    </Button>
                </div>
            </Dialog>
        ) : null;
    }
}

export { alertUser };
export default Alert;
