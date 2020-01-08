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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../decorators/translate';
import { bbBaseErrorMessage } from '../../utils/bbbaseError';
import { apiPost } from '../../utils/request';
import { Button } from '../forms';
import { BitBoxBaseLogo, SwissMadeOpenSource } from '../icon/logo';
import { Footer, Header } from '../layout';
import { PasswordSingleInput } from '../password';

interface UnlockBitBoxBaseProps {
    bitboxBaseID: string | null;
}

interface State {
    password?: string;
    username: string;
}

type Props = UnlockBitBoxBaseProps & TranslateProps;

class UnlockBitBoxBase extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            password: undefined,
            username: 'admin',
        };
    }

    private apiPrefix = () => {
        return 'bitboxbases/' + this.props.bitboxBaseID;
    }

    private setValidPassword = password => {
        this.setState({ password });
    }

    private handleSubmit = event => {
        event.preventDefault();
        apiPost(this.apiPrefix() + '/user-authenticate', {username: 'admin', password: this.state.password })
        .then(response => {
            if (!response.success) {
                bbBaseErrorMessage(response.code, this.props.t);
            }
        });
    }

    public render(
        {
            t,
        }: RenderableProps<Props>,
        {
            password,
        }: State,
    ) {
        return (
            <div class="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('welcome.title')}</h2>} />
                    <div className="innerContainer scrollableContainer">
                        <div className="content narrow padded isVerticallyCentered">
                            <BitBoxBaseLogo />
                            <div class="box large">
                                {
                                    <form onSubmit={this.handleSubmit}>
                                        <div>
                                            <PasswordSingleInput
                                                autoFocus
                                                id="password"
                                                type="password"
                                                label="Password"
                                                placeholder={t('bitboxBaseUnlock.placeholder')}
                                                onValidPassword={this.setValidPassword} />
                                        </div>
                                        <div className="buttons">
                                            <Button
                                                primary
                                                type="submit"
                                                disabled={!password}>
                                                {t('button.unlock')}
                                            </Button>
                                        </div>
                                    </form>
                                }
                            </div>
                        </div>
                        <Footer>
                            <SwissMadeOpenSource />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}

const HOC = translate<UnlockBitBoxBaseProps>()(UnlockBitBoxBase);
export { HOC as UnlockBitBoxBase};
