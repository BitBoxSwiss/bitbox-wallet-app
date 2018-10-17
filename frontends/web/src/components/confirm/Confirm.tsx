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

let confirmation: (message: string, callback: () => void) => void;

interface State {
    active: boolean;
    message?: string;
}

class Confirm extends Component<TranslateProp, State> {
    private callback!: (input: boolean) => void; // Set within confirmation

    constructor(props: TranslateProp) {
        super(props);
        confirmation = this.confirmation;
        this.state = {
            active: false,
        };
    }

    private confirmation = (message: string, callback: () => void) => {
        this.callback = callback;
        this.setState({
            active: true,
            message,
        });
    }

    private respond = (input: boolean) => {
        this.callback(input);
        this.setState({
            active: false,
        });
    }

    private decline = () => {
        this.respond(false);
    }

    private accept = () => {
        this.respond(true);
    }

    public render({ t }: RenderableProps<TranslateProp>, { message, active }: State) {
        return active ? (
            <Dialog
                onClose={this.decline}>
                <p class="first">{message}</p>
                <div class="buttons flex flex-row flex-between">
                    <Button secondary onClick={this.decline}>{t('dialog.cancel')}</Button>
                    <Button primary onClick={this.accept}>{t('dialog.confirm')}</Button>
                </div>
            </Dialog>
        ) : null;
    }
}

const TranslatedConfirm = translate()(Confirm);

export { confirmation };
export { TranslatedConfirm as Confirm };
