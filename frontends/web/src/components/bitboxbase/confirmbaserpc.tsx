/**
 * Copyright 2019 Shift Devices AG
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

 /**
  * This is a generic modal dialog for the BitBoxBase for RPC calls whose result the user should be informed about
  * e.g. create backup, or toggle ssh access.
  * It prompts the user to confirm the action, has a pending state while the RPC is being executed and displays
  * the result.
  * It should be provided via the props with the text for all the states relevant to the action being executed
  * as well as one of pre-defined API endpoints to call.
  * If it is a POST request which requires arguments, provide them in 'args' on the props
  */

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';
import { confirmation } from '../confirm/Confirm';
import { Dialog } from '../dialog/dialog';
import { Button  } from '../forms';

// Endpoints whose functionality is supported by the format of this component
type ConfirmBaseRPCEndpoint = '/backup-sysconfig' | '/enable-ssh-password-login';

interface ConfirmBaseRPCProps {
    apiPrefix: string;
    apiEndpoint: ConfirmBaseRPCEndpoint;
    confirmText: string;
    inProgressText: string;
    successText: string;
    dialogTitle: string;
    customButtonText?: string;
    args?: any;
    toggleDialog: () => void;
    onSuccess?: () => void;
}

interface State {
    confirmed: boolean;
    inProgress: boolean;
    success?: boolean;
    failureMessage?: string;
}

type Props = ConfirmBaseRPCProps & TranslateProps;

class ConfirmBaseRPC extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            confirmed: false,
            inProgress: false,
            success: undefined,
        };
    }

    public componentDidMount() {
        confirmation(this.props.confirmText, confirmed => {
            if (confirmed) {
                this.setState({ confirmed: true });
                this.apiCall();
            } else {
                this.abort();
            }
        }, this.props.customButtonText);
    }

    private apiCall = () => {
        this.setState({ inProgress: true });
        apiPost(this.props.apiPrefix + this.props.apiEndpoint, this.props.args)
        .then(response => {
            if (response.success) {
                // tslint:disable-next-line: no-unused-expression
                this.props.onSuccess && this.props.onSuccess();
                this.setState({ success: true });
            } else {
                this.setState({ success: false, failureMessage: response.message });
            }
            this.setState({ inProgress: false });
        });
    }

    private abort = () => {
        this.props.toggleDialog();
        this.setState({
            confirmed: false,
            inProgress: false,
            success: undefined,
        });
    }

    public render(
        {
            inProgressText,
            successText,
            dialogTitle,
            t,
        }: RenderableProps<Props>,
        {
            confirmed,
            inProgress,
            success,
            failureMessage,
        }: State,
    ) {
        return (
            confirmed && <Dialog title={dialogTitle} onClose={this.abort}>
                <div className="columnsContainer half">
                    <div className="columns">
                        <div className="column">
                            {
                                success && <p>{successText}</p>
                            }
                            {
                                inProgress && !success && <p>{inProgressText}</p>
                            }
                            {
                                // TODO: Look up user facing message from locales file based on error code
                                failureMessage && <p>{failureMessage}</p>
                            }
                            <div className="buttons">
                                <Button
                                    primary
                                    disabled={inProgress}
                                    onClick={this.abort}>
                                    {t('button.continue')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Dialog>
        );
    }
}

const HOC = translate<ConfirmBaseRPCProps>()(ConfirmBaseRPC);
export { HOC as ConfirmBaseRPC };
