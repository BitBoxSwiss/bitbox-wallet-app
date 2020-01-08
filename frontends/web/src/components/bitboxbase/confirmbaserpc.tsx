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
    args?: any;
    toggleDialog: () => void;
    onSuccess?: () => void;
}

interface State {
    inProgress: boolean;
    success?: boolean;
    failureMessage?: string;
}

type Props = ConfirmBaseRPCProps & TranslateProps;

class ConfirmBaseRPC extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            inProgress: false,
            success: undefined,
        };
    }

    private apiCall = (event: Event) => {
        event.preventDefault();
        this.setState({ inProgress: true });
        apiPost(this.props.apiPrefix + this.props.apiEndpoint, this.props.args)
        .then(response => {
            if (response.success) {
                // tslint:disable-next-line: no-unused-expression
                this.props.onSuccess && this.props.onSuccess();
                this.setState({ success: true });
            } else {
                this.setState({ success: false, failureMessage: this.props.t(`bitboxBase.errors.${response.code}`, this.props.t('bitboxBase.errors.UNEXPECTED_ERROR')) });
            }
            this.setState({ inProgress: false });
        });
    }

    private abort = () => {
        this.props.toggleDialog();
        this.setState({
            inProgress: false,
            success: undefined,
        });
    }

    public render(
        {
            confirmText,
            inProgressText,
            successText,
            dialogTitle,
            t,
        }: RenderableProps<Props>,
        {
            inProgress,
            success,
            failureMessage,
        }: State,
    ) {
        return (
            <div>
                <Dialog onClose={this.abort} title={dialogTitle} small>
                    <div class="box medium p-top-none">
                        <form onSubmit={success ? this.abort : this.apiCall}>
                            <div>
                                {
                                    !success && !inProgress && !failureMessage &&
                                    <p>{confirmText}</p>
                                }
                                {
                                    success && <p>{successText}</p>
                                }
                                {
                                    inProgress && !success && <p>{inProgressText}</p>
                                }
                                {
                                    failureMessage && !inProgress && !success &&
                                    <p>{failureMessage}</p>
                                }
                            </div>
                            <div className="buttons">
                                <Button
                                    primary
                                    disabled={inProgress}
                                    type="submit">
                                    {t('button.ok')}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Dialog>
            </div>
        );
    }
}

const HOC = translate<ConfirmBaseRPCProps>()(ConfirmBaseRPC);
export { HOC as ConfirmBaseRPC};
