import { Component } from 'preact';

import Button from 'preact-material-components/Button';
import 'preact-material-components/Button/style.css';

import { apiGet } from '../../../utils/request';

import Create from './create';
import Restore from './restore';
import Erase from './erase';

import style from './style';

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
        apiGet('device/backups/list').then(({ sdCardInserted, backupList }) => {
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
        this.props.displayError(errorMessage)
    }

    render({ showCreate }, { backupList, selectedBackup, sdCardInserted }) {
        if (!sdCardInserted) {
            return (
                <div>
                    <p>Please insert SD card to manage backups.</p>
                    <Button
                        primary={true}
                        raised={true}
                        onclick={() => { this.refresh(); }}
                    >I have inserted the SD card</Button>
                </div>
            );
        }
        const selectClasses = ['mdc-multi-select', 'mdc-list', style.backupList].join(' ');
        const option = filename => <option className="mdc-list-item">{ filename }</option>;
        return (
            <div>
                <h1>Manage Backups</h1>
                <div>
                    <select
                        id="backupList"
                        size="6"
                        className={selectClasses}
                        onChange={this.handleBackuplistChange}
                    >{ backupList.map(option) }
                    </select>
                    <Restore selectedBackup={selectedBackup} displayError={this.displayError} />
                    &nbsp;
                    <Erase
                        selectedBackup={selectedBackup}
                        onErase={this.refresh}
                    />
                    {showCreate && <span>&nbsp;<Create onCreate={this.refresh} /></span>}
                </div>
            </div>
        );
    }
}
