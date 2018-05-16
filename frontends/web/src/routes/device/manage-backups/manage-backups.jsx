import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../../utils/request';
import { Button, ButtonLink, Radio } from '../../../components/forms';
import Create from './create';
import Restore from './restore';
// import Erase from './erase';
import style from './manage-backups.css';

@translate()
export default class ManageBackups extends Component {
    state = {
        backupList: [],
        selectedBackup: null,
        sdCardInserted: null,
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
        t,
        showCreate,
        deviceID,
        children,
        requireConfirmation = true,
    }, {
        backupList,
        selectedBackup,
        sdCardInserted,
    }) {
        if (sdCardInserted === false) {
            return (
                <div class="container">
                    <div class="innerContainer">
                        <div class="header">
                            <h2>{t('backup.title')}</h2>
                        </div>
                        <div class="content">
                            <p>Please insert SD card to manage backups.</p>
                            <Button secondary onClick={this.refresh}>I have inserted the SD card</Button>
                        </div>
                    </div>
                </div>
            );
        } else if (!sdCardInserted) {
            return null;
        }

        return (
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{t('backup.title')}</h2>
                        <div>
                            <ButtonLink primary href={`/device/${deviceID}`}>Close</ButtonLink>
                        </div>
                    </div>
                </div>
                <div class="innerContainer">
                    <div class="content">
                        <div class={style.backupsList}>
                            {
                                backupList.map(backup => <BackupsListItem backup={backup} selectedBackup={selectedBackup} handleChange={this.handleBackuplistChange} />)
                            }
                        </div>
                    </div>
                    <div class="buttons">
                        {children}
                        <Restore
                            selectedBackup={selectedBackup}
                            displayError={this.displayError}
                            deviceID={deviceID}
                            requireConfirmation={requireConfirmation} />
                        {/*
                            <Erase
                                selectedBackup={selectedBackup}
                                onErase={this.refresh}
                                deviceID={deviceID}
                            />
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

function BackupsListItem({
    backup,
    selectedBackup,
    handleChange,
}) {
    return (
        <div className={['flex', 'flex-row', 'flex-items-start', style.backupsListItem].join(' ')}>
            <Radio
                checked={selectedBackup === backup}
                onChange={handleChange}
                id={backup}
                label={backup}
                value={backup}>
                <span className="text-small text-gray">2018/05/02 2:30PM</span>
            </Radio>
        </div>
    );
}
