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

import { FunctionComponent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleMarkup } from '../../utils/markup';
import { Dialog, DialogButtons } from '../dialog/dialog';
import { Button } from '../forms';

/**
 * shows an alert when called, triggers the callback with user reply  
 */
export let confirmation: (message: string, callback: (response: boolean) => void, customButtonText?: string) => void;

interface State {
    active: boolean;
    callback?: (input: boolean) => void;
    message?: string;
    customButtonText?: string;
}

/**
 * Confirm alert that activates on confirmation module export call,
 * this should be mounted only once in the App
 */
export const Confirm: FunctionComponent = () => {
    const [state, setState] = useState<State>({ active: false })
    const { t } = useTranslation();

    confirmation = (message: string, callback: (response: boolean) => void, customButtonText?: string) => {
        setState({
            active: true,
            callback,
            message,
            customButtonText,
        });
    }

    const respond = (response: boolean) => () => {
        state.callback!(response);
        setState({
            active: false,
        });
    }

    const { message, active, customButtonText } = state;
    if (!active) {
        return null;
    }
    return <Dialog title={t('dialog.confirmTitle')} onClose={respond(false)}>
        <div className="columnsContainer half">
            <div className="columns">
                <div className="column">
                    {
                        message ? message.split('\n').map((line, i) => (
                            <p
                                key={i}
                                className={i === 0 ? 'first' : ''}>
                                <SimpleMarkup tagName="span" markup={line} />
                            </p>
                        )) : null
                    }
                </div>
            </div>
        </div>
        <DialogButtons>
            <Button primary onClick={respond(true)}>{customButtonText ? customButtonText : t('dialog.confirm')}</Button>
            <Button transparent onClick={respond(false)}>{t('dialog.cancel')}</Button>
        </DialogButtons>
    </Dialog>
}
