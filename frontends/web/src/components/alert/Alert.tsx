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
import { View, ViewButtons, ViewHeader } from '../view/view';
import { Button } from '../forms';

/**
 * Function to activate global alert component with a message
 * @deprecated better is to show an inline error instead of using this global component
 * @param message the string to show
 * @param callback callback function called after user confirm
 * @param asDialog option to opt-out of rendinging as dialog
 */
let alertUser: (message: string, options?: AlertUserOptions) => void;

type AlertUserOptions = {
    callback?: () => void,
    asDialog?: boolean,
};

interface State {
    active: boolean;
    asDialog: boolean;
    message?: string;
}

class Alert extends Component<WithTranslation, State> {
    private callback?: () => void; // Assigned when alertUser is called / Called before close.

    constructor(props: WithTranslation) {
        super(props);
        alertUser = this.alertUser;
        this.state = {
            active: false,
            asDialog: true,
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

    private alertUser = (
        message: string,
        options: AlertUserOptions = {},
    ) => {
        const {
            callback,
            asDialog = true,
        } = options;
        this.callback = callback;
        this.setState({
            active: true,
            asDialog,
            message,
        });
    }

    public render() {
        const { t } = this.props;
        const { active, asDialog, message } = this.state;
        return (active && message) ? (
            <form onSubmit={this.handleClose}>
                <View
                    key="alert-overlay"
                    dialog={asDialog}
                    textCenter={!asDialog}
                    fullscreen>
                    <ViewHeader title={multilineMarkup({
                        tagName: 'span',
                        markup: message,
                    })} />
                    <ViewButtons>
                        <Button
                            autoFocus
                            primary
                            onClick={this.handleClose}>
                            {t('button.ok')}
                        </Button>
                    </ViewButtons>
                </View>
            </form>
        ) : null;
    }
}

const TranslatedAlert = withTranslation()(Alert);

export { alertUser };
export { TranslatedAlert as Alert };
