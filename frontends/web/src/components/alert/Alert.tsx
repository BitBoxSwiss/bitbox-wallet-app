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

import { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { multilineMarkup } from '../../utils/markup';
import { View, ViewHeader, ViewButtons } from '../view/view';
import { Button } from '../forms';

let alertUser: (message: string, callback?: () => void) => void;

interface State {
    active: boolean;
    message?: string;
}

class Alert extends Component<WithTranslation, State> {
    private callback?: () => void; // Assigned when alertUser is called / Called before close.

    constructor(props: WithTranslation) {
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

    public render() {
        const { t } = this.props;
        const { message, active } = this.state;
        return (active && message) ? (
            <View
                key="alert-overlay"
                fullscreen
                textCenter>
                <ViewHeader title={
                    multilineMarkup({
                        tagName: 'div',
                        markup: message,
                    })
                }>
                </ViewHeader>
                <ViewButtons>
                    <Button
                        primary
                        onClick={this.handleClose}>
                        {t('button.ok')}
                    </Button>
                </ViewButtons>
            </View>
        ) : null;
    }
}

const TranslatedAlert = withTranslation()(Alert);

export { alertUser };
export { TranslatedAlert as Alert };
