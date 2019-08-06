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
import * as style from '../../components/bitboxbase/bitboxbase.css';
import { DetectedBase } from '../../components/bitboxbase/detectedbase';
import { Input } from '../../components/forms';
import { Header } from '../../components/layout';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';

interface BitBoxBaseConnectProps {
    bitboxBaseIDs: string[];
    detectedBases: DetectedBitBoxBases;
    bitboxBaseID?: string;
    ip?: string;
}

export interface DetectedBitBoxBases {
    [Hostname: string]: string;
}

export const bitboxBaseStore = new Store<BitBoxBaseConnectProps>({
    detectedBases: {},
    bitboxBaseIDs: [],
    bitboxBaseID: '',
    ip: '',
});

type Props = BitBoxBaseConnectProps & TranslateProps;

class BitBoxBaseConnect extends Component<Props> {

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
            if (!data.success) {
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
                            <div>
                                <h3>{t('bitboxBase.detectedBases')}</h3>
                                {
                                    Object.entries(detectedBases).map(bases => (
                                    <DetectedBase
                                        hostname={bases[0]}
                                        ip={bases[1]}
                                        connect={this.connect}/>
                                ))
                                }
                            </div>
                            <div>
                                <h3>{t('bitboxBase.manualInput')}</h3>
                                <form onSubmit={this.submit}>
                                    <Input
                                        name="ip"
                                        onInput={this.handleFormChange}
                                        value={ip}
                                        placeholder="IP address:port"
                                    />
                                    <div class="flex flex-row flex-start flex-center flex-around">
                                        <button
                                            className={[style.button, style.primary].join(' ')}
                                            disabled={ip === ''}
                                            onClick={this.submit}>
                                            {t('bitboxBase.connect')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
}

const HOC = translate<BitBoxBaseConnectProps>()(BitBoxBaseConnect);
export { HOC as BitBoxBaseConnect };
