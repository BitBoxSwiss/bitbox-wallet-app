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
import { translate, TranslateProp } from '../../decorators/translate';
import { Dialog } from '../dialog/dialog';
import { Button } from '../forms';

let alertUser: (message: string, callback?: () => void) => void;

interface State {
    active: boolean;
    message?: string;
}

class Alert extends Component<TranslateProp, State> {
    private button!: JSX.ElementClass; // Initialized after render().
    private callback?: () => void; // Assigned when alertUser is called / Called before close.

    constructor(props: TranslateProp) {
        super(props);
        alertUser = this.alertUser;
        this.state = {
            active: false,
        };
    }

    private setButtonRef = (element: JSX.ElementClass) => {
        this.button = element;
    }

    private handleClose = () => {
        if (this.callback) {
            this.callback();
        }
        this.setState({
            active: false,
        });
    }

    private alertUser = (message: string, callback?: () => void) => {
        this.callback = callback;
        this.setState({
            active: true,
            message,
        }, () => {
            this.button.base!.focus();
        });
    }

    public render({ t }: RenderableProps<TranslateProp>, { message, active }: State) {
        return active ? (
            <Dialog
                onClose={this.handleClose}
                disableEscape>
                {
                    message ? message.split('\n').map((line, i) => (
                        <p
                            key={i}
                            class={ i === 0 ? 'first' : '' }>
                            {line}
                        </p>
                    )) : null
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

const TranslatedAlert = translate()(Alert);

export { alertUser };
export { TranslatedAlert as Alert };
