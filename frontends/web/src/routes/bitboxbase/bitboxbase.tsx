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
import { alertUser } from '../../components/alert/Alert';
import { ConnectedBase } from '../../components/bitboxbase/connectbase';
import { Button, Input } from '../../components/forms';
import { Header } from '../../components/layout';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';

export interface BitBoxBaseProps {
    bitboxBaseIDs: string[];
    bitboxBaseID?: string;
    ip?: string;
}

export const bitboxBaseStore = new Store<BitBoxBaseProps>({
    bitboxBaseIDs: [],
    bitboxBaseID: '',
    ip: '',
});

type Props = BitBoxBaseProps & TranslateProps;

class BitBoxBase extends Component<Props> {

    constructor(props) {
        super(props);
        this.state = {};
    }

    private handleFormChange = event => {
        bitboxBaseStore.setState({
            ip : event.target.value,
        });
    }

    private connect = (event: Event) => {
        event.preventDefault();
        apiPost('bitboxbases/connectbase', {
            ip: bitboxBaseStore.state.ip,
        }).then(data => {
            const { success } = data;
            if (!success) {
                alertUser(data.errorMessage);
            }
        });
    }

    public componentWillUpdate() {
        bitboxBaseStore.setState({bitboxBaseIDs : this.props.bitboxBaseIDs});
    }

    public render(
        {
            t,
            ip,
            bitboxBaseIDs,
        }: RenderableProps<Props>,
        ) {
            return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={t('bitboxBase.title')} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div class="row">
                                <span>
                                    <form onSubmit={this.connect}>
                                        <Input
                                            name="ip"
                                            onInput={this.handleFormChange}
                                            value={ip}
                                            placeholder="host:port"
                                        />
                                        <Button primary disabled={ip === ''} onClick={this.connect}>
                                            "Connect"
                                        </Button>
                                    </form>
                                </span>
                            </div>
                            {bitboxBaseIDs.map( bitboxBaseID => (
                                <ConnectedBase
                                    bitboxBaseID={bitboxBaseID}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            );
        }
}

const HOC = translate<BitBoxBaseProps>()(BitBoxBase);
export { HOC as BitBoxBase };
