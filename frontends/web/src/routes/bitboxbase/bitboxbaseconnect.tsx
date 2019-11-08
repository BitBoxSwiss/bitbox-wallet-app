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
import { route } from 'preact-router';
import { alertUser } from '../../components/alert/Alert';
import * as style from '../../components/bitboxbase/bitboxbase.css';
import { DetectedBase } from '../../components/bitboxbase/detectedbase';
import { Dialog } from '../../components/dialog/dialog';
import * as dialogStyle from '../../components/dialog/dialog.css';
import { Input } from '../../components/forms';
import { Header } from '../../components/layout';
import { SettingsButton } from '../../components/settingsButton/settingsButton';
import { share } from '../../decorators/share';
import { Store } from '../../decorators/store';
import { translate, TranslateProps } from '../../decorators/translate';
import { apiPost } from '../../utils/request';
import { BitBoxBaseInfo } from './bitboxbase';

interface BitBoxBaseConnectProps {
    bitboxBaseIDs: string[];
    detectedBases: DetectedBitBoxBases;
}

export interface DetectedBitBoxBases {
    [Hostname: string]: string;
}

export interface ActiveBase {
    [IP: string]: BitBoxBaseInfo;
}

export interface SharedBaseProps {
    activeBases: ActiveBase[];
}

export const store = new Store<SharedBaseProps>({
    activeBases: [],
});

interface State {
    bitboxBaseIDs: string[];
    manualConnectDialog: boolean;
    ipEntry?: string;
}

type Props = BitBoxBaseConnectProps & TranslateProps & SharedBaseProps;

class BitBoxBaseConnect extends Component<Props, State> {
    constructor(props) {
        super(props);
        this.state = {
            bitboxBaseIDs: [],
            manualConnectDialog: false,
            ipEntry: undefined,
        };
    }

    private handleFormChange = event => {
        this.setState({
            ipEntry : event.target.value,
        });
    }

    private submit = (event: Event) => {
        event.preventDefault();
        apiPost('bitboxbases/connectbase', {
            ip: this.state.ipEntry,
        }).then(data => {
            const { success } = data;
            if (!success) {
                alertUser(data.errorMessage);
            } else {
                route(`/bitboxbase/${this.state.ipEntry}`, true);
            }
        });
    }

    private connect = (ip: string) => {
        apiPost('bitboxbases/connectbase', { ip })
        .then(data => {
            if (!data.success) {
                alertUser(data.errorMessage);
            } else {
                route(`/bitboxbase/${ip}`, true);
            }
        });
    }

    private openManualConnectDialog = () => {
        this.setState({ manualConnectDialog: true });
    }

    private closeManualConnectDialog = () => {
        this.setState({ manualConnectDialog: false });
    }

    public componentWillUpdate() {
        this.setState({bitboxBaseIDs : this.props.bitboxBaseIDs});
    }

    public render(
        {
            t,
            detectedBases,
            bitboxBaseIDs,
        }: RenderableProps<Props>,
        {
            manualConnectDialog,
            ipEntry,
        }: State,
    ) {
        const bases = Object.entries(detectedBases);
        return (
            <div class="contentWithGuide">
                <div class="container">
                    <Header title={<h2>{t('bitboxBase.title')}</h2>} />
                    <div class="innerContainer scrollableContainer">
                        <div class="content padded">
                            <div className="columnsContainer">
                                <div className="columns">
                                <div className="column">
                                        <div className="flex flex-row flex-between flex-items-center m-bottom-large">
                                            <label className="labelXLarge m-none">{t('bitboxBase.detectedBases')}</label>
                                            <label
                                                className="labelLarge labelLink m-none flex flex-row flex-items-center"
                                                onClick={this.openManualConnectDialog}>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    width="16" height="16"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                                </svg>
                                                {t('bitboxBase.manualInput')}
                                            </label>
                                        </div>
                                        <div className="box slim divide">
                                            {
                                                bases.length ? bases.map(base => (
                                                    <DetectedBase
                                                        hostname={base[0]}
                                                        ip={base[1]}
                                                        connect={this.connect}/>
                                                )) : (
                                                    <p className="text-center p-top-half p-bottom-half">
                                                        {t('bitboxBase.detectedBasesEmpty')}
                                                    </p>
                                                )
                                            }
                                        </div>
                                        {
                                            manualConnectDialog && (
                                                <Dialog title={t('bitboxBase.manualInput')} onClose={this.closeManualConnectDialog}>
                                                    <form onSubmit={this.submit}>
                                                        <label>{t('bitboxBase.manualInputLabel')}</label>
                                                        <Input
                                                            name="ip"
                                                            onInput={this.handleFormChange}
                                                            value={ipEntry}
                                                            placeholder="IP address:port" />
                                                        <div className={dialogStyle.actions}>
                                                            <button
                                                                className={[style.button, style.primary].join(' ')}
                                                                disabled={ipEntry === ''}
                                                                onClick={this.submit}>
                                                                {t('bitboxBase.connect')}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </Dialog>
                                            )
                                        }
                                    </div>
                                    <div className="column">
                                        <div className="flex flex-row flex-between flex-items-center m-bottom-large">
                                            <label className="labelXLarge m-none">{t('bitboxBase.connectedBases')}</label>
                                        </div>
                                        <div className="box slim divide">
                                            {
                                                bitboxBaseIDs.length ?  bitboxBaseIDs.map(baseID => {
                                                    let name: string | undefined;
                                                    Object.values(detectedBases).includes(baseID) ? name = Object.keys(detectedBases).find(key => detectedBases[key] === baseID) :
                                                        // FIXME: Resolve a hostname from IP for manual additions
                                                        name = t('bitboxBase.new');
                                                    return <SettingsButton link href={`/bitboxbase/${baseID}`} secondaryText={baseID}>{name}</SettingsButton>;
                                                }) : (
                                                    <p className="text-center p-top-half p-bottom-half">{t('bitboxBase.detectedBasesEmpty')}</p>
                                                )
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

const sharedHOC = share<SharedBaseProps, BitBoxBaseConnectProps & TranslateProps>(store)(BitBoxBaseConnect);
const translatedHOC = translate<BitBoxBaseConnectProps>()(sharedHOC);
export { translatedHOC as BitBoxBaseConnect };
