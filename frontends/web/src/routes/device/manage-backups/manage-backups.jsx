import { Component } from 'preact';

import { apiGet } from '../../../utils/request';
import { Button } from '../../../components/forms';
import Create from './create';
import Restore from './restore';
import Erase from './erase';
import style from './manage-backups.css';

export default class ManageBackups extends Component {
    constructor(props) {
        super(props);
        this.state = {
            backupList: [],
            selectedBackup: null,
            sdCardInserted: false
        };
    }

    componentDidMount() {
        this.refresh();
    }

    refresh = () => {
        apiGet('devices/' + this.props.deviceID + '/backups/list').then(({ sdCardInserted, backupList }) => {
            this.setState({
                selectedBackup: null,
                sdCardInserted,
                backupList
            });
        });
    }

    handleBackuplistChange = event => {
        this.setState({ selectedBackup: this.state.backupList[event.target.selectedIndex] });
    }

    displayError = (errorMessage) => {
        this.props.displayError(errorMessage);
    }

    render({ showCreate, deviceID }, { backupList, selectedBackup, sdCardInserted }) {
        if (!sdCardInserted) {
            return (
                <div>
                    <p>Please insert SD card to manage backups.</p>
                    <Button
                        secondary={true}
                        onclick={this.refresh}
                    >I have inserted the SD card</Button>
                </div>
            );
        }

        return (
            <div>
                <h1>Manage Backups</h1>
                <div>
                    <div>
                        <select
                            id="backupList"
                            size="6"
                            className={style.backupList}
                            onChange={this.handleBackuplistChange}
                        >{ backupList.map(renderOption) }
                        </select>
                    </div>
                    <Restore
                        selectedBackup={selectedBackup}
                        displayError={this.displayError}
                        deviceID={deviceID} />
                    &nbsp;
                    <Erase
                        selectedBackup={selectedBackup}
                        onErase={this.refresh}
                        deviceID={deviceID}
                    />
                    {showCreate && <span>&nbsp;<Create onCreate={this.refresh} deviceID={deviceID} /></span>}
                </div>
            </div>
        );
    }
}

function renderOption(filename) {
    return <option className="mdc-list-item">{ filename }</option>;
}
