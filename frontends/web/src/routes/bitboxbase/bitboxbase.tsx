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
import { DetectedBase } from '../../components/bitboxbase/detectedbase';
import { Button, Input } from '../../components/forms';
import { Header } from '../../components/layout';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';

interface BitBoxBaseProps {
    bitboxBaseIDs: string[];
    detectedBases: DetectedBitBoxBases;
    bitboxBaseID?: string;
    ip?: string;
}

export interface DetectedBitBoxBases {
    [Hostname: string]: string;
}

export const bitboxBaseStore = new Store<BitBoxBaseProps>({
    detectedBases: {},
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

    private submit = (event: Event) => {
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

    private connect = (ip: string) => {
        apiPost('bitboxbases/connectbase', { ip })
        .then(data => {
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
            detectedBases,
        }: RenderableProps<Props>,
        ) {
            return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('bitboxBase.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            {
                                detectedBases ?
                                (
                                    <div>
                                        <h3>{t('bitboxBase.detectedBases')}</h3>
                                        {
                                            Object.keys(detectedBases).map(hostname => (
                                            <DetectedBase
                                                hostname={hostname}
                                                ip={detectedBases[hostname]}
                                                connect={this.connect}/>
                                        ))
                                        }
                                    </div>
                                ) :
                            <div class="row">
                                <span>
                                    <form onSubmit={this.submit}>
                                        <Input
                                            name="ip"
                                            onInput={this.handleFormChange}
                                            value={ip}
                                            placeholder="host:port"
                                        />
                                        <Button primary disabled={ip === ''} onClick={this.submit}>
                                            {t('bitboxBase.connect')}
                                        </Button>
                                    </form>
                                </span>
                            </div>
                            }
                        </div>
                    </div>
                </div>
            </div>
            );
        }
}

const HOC = translate<BitBoxBaseProps>()(BitBoxBase);
export { HOC as BitBoxBase };
