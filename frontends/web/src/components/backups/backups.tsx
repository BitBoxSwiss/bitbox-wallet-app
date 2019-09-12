/**
 * Copyright 2018 Shift Devices AG
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
import { apiGet } from '../../utils/request';
import SimpleMarkup from '../../utils/simplemarkup';
import { alertUser } from '../alert/Alert';
import { Button } from '../forms';
import { Backup, BackupsListItem } from './backup';
import * as style from './backups.css';
import Check from './check';
import Create from './create';
import { Restore } from './restore';

interface BackupsProps {
    deviceID: string;
    showCreate?: boolean;
    showRestore?: boolean;
    requireConfirmation?: boolean;
    fillSpace?: boolean;
    displayError?: () => void;
    onRestore?: () => void;
}

type Props = BackupsProps & TranslateProps;

interface State {
    backupList: Backup[];
    selectedBackup?: string;
    sdCardInserted: boolean | null;
}

class Backups extends Component<Props, State> {
    private scrollableContainer!: HTMLElement;

    constructor(props) {
        super(props);
        this.state = {
            backupList: [],
            sdCardInserted: null,
        };
    }

    public componentDidMount() {
        this.refresh();
    }

    private refresh = () => {
        apiGet('devices/' + this.props.deviceID + '/backups/list').then(({ sdCardInserted, backupList, success, errorMessage }) => {
            if (success) {
                this.setState({
                    sdCardInserted,
                    backupList,
                });
            } else if (errorMessage) {
                alertUser(errorMessage);
            }
        });
    }

    private handleBackuplistChange = (backupID: string) => {
        this.setState({ selectedBackup: backupID });
    }

    private scrollIntoView = ({ target }: { target: HTMLElement }) => {
        const offsetTop = target.offsetTop;
        const offsetHeight = (target.parentNode as HTMLElement).offsetHeight;
        if (offsetTop > this.scrollableContainer.scrollTop + offsetHeight) {
            return;
        }
        const top = Math.max((offsetTop + offsetHeight) - this.scrollableContainer.offsetHeight, 0);
        this.scrollableContainer.scroll({ top, behavior: 'smooth' });
    }

    private setScrollableContainerRef = (ref: HTMLElement) => {
        this.scrollableContainer = ref;
    }

    public render(
        {
            t,
            children,
            showCreate = false,
            showRestore = true,
            deviceID,
            requireConfirmation = true,
            onRestore,
        }: RenderableProps<Props>,
        { backupList, selectedBackup, sdCardInserted }: State,
    ) {
        if (sdCardInserted === false) {
            return (
                <div class={['content', !requireConfirmation ? 'noSpace' : ''].join(' ')}>
                    <p class="first">{t('backup.insert')}</p>
                    <div class="buttons">
                        {children}
                        <Button secondary onClick={this.refresh}>
                            {t('backup.insertButton')}
                        </Button>
                    </div>
                </div>
            );
        } else if (!sdCardInserted) {
            return null;
        }

        return (
            <div className="box large">
                <SimpleMarkup tagName="p" markup={t('backup.description')} />
                <div class={style.backupsList} ref={this.setScrollableContainerRef}>
                    {
                        backupList.length ? backupList.map(backup => (
                            <BackupsListItem
                                key={backup.id}
                                backup={backup}
                                selectedBackup={selectedBackup}
                                handleChange={this.handleBackuplistChange}
                                onFocus={this.scrollIntoView}
                                radio={true} />
                        )) : (
                            <p class={style.emptyText}>
                                {t('backup.noBackups')}
                            </p>
                        )
                    }
                </div>
                <div class="buttons">
                    {
                        showCreate && (
                            <Check
                                selectedBackup={selectedBackup}
                                deviceID={deviceID} />
                        )
                    }
                    {
                        showCreate && (
                            <Create
                                onCreate={this.refresh}
                                deviceID={deviceID} />
                        )
                    }
                    {
                        showRestore && onRestore && (
                            <Restore
                                selectedBackup={selectedBackup}
                                deviceID={deviceID}
                                onRestore={onRestore}
                                requireConfirmation={requireConfirmation} />
                        )
                    }
                    {/*
                      <Erase
                      selectedBackup={selectedBackup}
                      onErase={this.refresh}
                      deviceID={deviceID}
                    />
                    */}
                    {children}
                </div>
            </div>
        );
    }
}

const TranslatedBackups = translate<BackupsProps>()(Backups);
export { TranslatedBackups as Backups };
