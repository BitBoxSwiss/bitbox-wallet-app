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
import { Button } from '../../components/forms';
import { apiSubscribe } from '../../utils/event';
import { apiPost } from '../../utils/request';

export interface ConnectedBaseProps {
    bitboxBaseID: string;
}

interface State {
    blockInfo: string;
    bitboxBaseID: string;
}

type Props = ConnectedBaseProps;

export class ConnectedBase extends Component<Props, State> {

    constructor(props) {
        super(props);
        this.state = {
            blockInfo : '',
            bitboxBaseID: '',
        };
    }

    public componentDidMount() {
        // Only create a new websocket if the bitboxBaseID changed.
        if (this.props.bitboxBaseID !== this.state.bitboxBaseID) {
            this.setState({ bitboxBaseID : this.props.bitboxBaseID});
            apiSubscribe('/bitboxbases/' + this.props.bitboxBaseID + '/blockinfo', ({ object }) => {
                this.setState({ blockInfo: object });
            });
        }
    }

    private connectElectrum = () => {
        apiPost('bitboxbases/' + this.props.bitboxBaseID + '/connect-electrum', {
            bitboxBaseID : this.props.bitboxBaseID,
        }).then(({success}) => {
            if (!success) {
                alertUser(success.errorMessage);
            }
        });
    }

    public render(
        {
            bitboxBaseID,
        }: RenderableProps<Props>,
        {
            blockInfo,
        }: State,
    ) {
        if (!blockInfo) {
            return null;
        }
        const blockInfoObj = JSON.parse(blockInfo);

        return (
                <div class="row">
                    <div class="flex flex-1 flex-row flex-between flex-items-center spaced">
                        <ul>
                            <li>Block Number: {blockInfoObj.blocks}</li>
                            <li>Difficulty: {blockInfoObj.difficulty}</li>
                            <li>Device ID: {bitboxBaseID}</li>
                            <li>Lightning Alias: {blockInfoObj.lightningAlias}</li>
                        </ul>
                    </div>
                    <div class="row">
                        <div class="buttons flex flex-row flex-end">
                            <Button onClick={this.connectElectrum}>Connect Electrum</Button>
                        </div>
                    </div>
                </div>
            );
    }
}
