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

import { Component} from 'react';
import { translate, TranslateProps } from '../../decorators/translate';
import { SimpleMarkup } from '../../utils/markup';
import { Dialog, DialogButtons } from '../dialog/dialog';
import { Button } from '../forms';

let confirmation: (message: string, callback: (response: boolean) => void, customButtonText?: string) => void;

interface State {
    active: boolean;
    message?: string;
    customButtonText?: string;
}

class Confirm extends Component<TranslateProps, State> {
    private callback!: (input: boolean) => void; // Set within confirmation

    constructor(props: TranslateProps) {
        super(props);
        confirmation = this.confirmation;
        this.state = {
            active: false,
        };
    }

    private confirmation = (message: string, callback: (response: boolean) => void, customButtonText?: string) => {
        this.callback = callback;
        this.setState({
            active: true,
            message,
            customButtonText,
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

    public render() {
        const { t } = this.props;
        const { message, active, customButtonText } = this.state;
        return active ? (
            <Dialog title={t('dialog.confirmTitle')} onClose={this.decline}>
                <div className="columnsContainer half">
                    <div className="columns">
                        <div className="column">
                            {
                                message ? message.split('\n').map((line, i) => (
                                    <p
                                        key={i}
                                        className={ i === 0 ? 'first' : '' }>
                                        <SimpleMarkup tagName="span" markup={line} />
                                    </p>
                                )) : null
                            }
                        </div>
                    </div>
                </div>
                <DialogButtons>
                    <Button primary onClick={this.accept}>{customButtonText ? customButtonText : t('dialog.confirm')}</Button>
                    <Button transparent onClick={this.decline}>{t('dialog.cancel')}</Button>
                </DialogButtons>
            </Dialog>
        ) : null;
    }
}

const TranslatedConfirm = translate()(Confirm);

export { confirmation };
export { TranslatedConfirm as Confirm };
