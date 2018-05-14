import { Component } from 'preact';
import { apiGet } from '../../../utils/request';
import { Button, ButtonLink, } from '../../../components/forms';
import Create from './create';
import Restore from './restore';
import Erase from './erase';
import style from './manage-backups.css';

export default class ManageBackups extends Component {
    state = {
        backupList: [],
        selectedBackup: null,
        sdCardInserted: false,
    }

    componentDidMount() {
        this.refresh();
    }

    refresh = () => {
        apiGet('devices/' + this.props.deviceID + '/backups/list').then(({ sdCardInserted, backupList, }) => {
            this.setState({
                selectedBackup: null,
                sdCardInserted,
                backupList,
            });
        });
    }

    handleBackuplistChange = event => {
        this.setState({ selectedBackup: event.target.value });
    }

    displayError = errorMessage => {
        this.props.displayError(errorMessage);
    }

    render({
        showCreate,
        deviceID,
        children,
    }, {
        backupList,
        selectedBackup,
        sdCardInserted,
    }) {
        if (!sdCardInserted) {
            return (
                <div class="container">
                    <div class="innerContainer">
                        <div class="header">
                            <h2>Manage Backups</h2>
                        </div>
                        <div class="content">
                            <p>Please insert SD card to manage backups.</p>
                            <Button secondary onClick={this.refresh}>I have inserted the SD card</Button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div class="container">
                <div class="innerContainer">
                    <div class="header">
                        <h2>Manage Backups</h2>
                        <div>
                            <ButtonLink primary href={`/device/${deviceID}`}>Close</ButtonLink>
                        </div>
                    </div>
                    <div class="content">
                        <div class={style.backupsList}>
                            {
                                backupList.map(backup => <BackupsListItem backup={backup} selectedBackup= {selectedBackup} handleChange={this.handleBackuplistChange} />)
                            }
                        </div>
                    </div>
                    <div class={['buttons', 'flex', 'flex-row', 'flex-end'].join(' ')}>
                        {children}
                        <Restore
                            selectedBackup={selectedBackup}
                            displayError={this.displayError}
                            deviceID={deviceID} />
                        {/*
                            showCreate && (
                                <Erase
                                    selectedBackup={selectedBackup}
                                    onErase={this.refresh}
                                    deviceID={deviceID}
                                />
                            )
                        */}
                        {
                            showCreate && (
                                <span>&nbsp;<Create onCreate={this.refresh} deviceID={deviceID} /></span>
                            )
                        }
                    </div>
                </div>
            </div>
        );
    }
}

class BackupsListItem extends Component {
    handleSelection = e => {
        this.checkbox.click();
    }

    render({
        backup,
        selectedBackup,
        handleChange,
    }, {}) {
        return (
            <div class={['flex', 'flex-row', 'flex-center', 'flex-items-start', style.backupsListItem].join(' ')}>
                <div class={style.checkbox}>
                    <input
                        type="checkbox"
                        checked={selectedBackup === backup}
                        onChange={handleChange}
                        value={backup}
                        ref={checkbox => this.checkbox = checkbox}
                    />
                </div>
                <div class={['flex-1', 'flex-column', 'flex-start', style.itemInfo].join(' ')} onClick={this.handleSelection}>
                    <div class="text-bold">{backup}</div>
                    <div class="text-small text-gray">2018/05/02 2:30PM</div>
                </div>
            </div>
        );
    }
}
