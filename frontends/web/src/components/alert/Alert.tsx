/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import SimpleMarkup from '../../utils/simplemarkup';
import { Dialog } from '../dialog/dialog';
import * as style from '../dialog/dialog.css';
import { Button } from '../forms';

let alertUser: (message: string, callback?: () => void) => void;

interface State {
    active: boolean;
    message?: string;
}

class Alert extends Component<TranslateProps, State> {
    private callback?: () => void; // Assigned when alertUser is called / Called before close.

    constructor(props: TranslateProps) {
        super(props);
        alertUser = this.alertUser;
        this.state = {
            active: false,
        };
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
        });
    }

    public render({ t }: RenderableProps<TranslateProps>, { message, active }: State) {
        return active ? (
            <Dialog
                onClose={this.handleClose}
                disableEscape>
                {
                    message ? message.split('\n').map((line, i) => (
                        <p
                            key={i}
                            className={ i === 0 ? 'first' : '' }>
                            <SimpleMarkup tagName="span" markup={line} />
                        </p>
                    )) : null
                }
                <div class={style.actions}>
                    <Button
                        primary
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
