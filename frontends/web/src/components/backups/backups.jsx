import { Component } from 'preact';
import { translate } from 'react-i18next';
import { apiGet } from '../../utils/request';
import { Button } from '../forms';
import Restore from './restore';
import Create from './create';
import BackupsListItem from './backup';
// import Erase from './erase';
import style from './backups.css';

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

    scrollIntoView = ({ target }) => {
        const top = Math.max((target.offsetTop + target.parentNode.offsetHeight) - this.scrollableContainer.offsetHeight, 0);
        this.scrollableContainer.scroll({
            top,
            behavior: 'smooth'
        });
    }

    render({
        t,
        showCreate = false,
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
                <div class="innerContainer">
                    <div class="content">
                        <p>Please insert SD card to manage backups.</p>
                        <div class="buttons">
                            <Button secondary onClick={this.refresh}>
                                I have inserted the SD card
                            </Button>
                        </div>
                    </div>
                </div>
            );
        } else if (!sdCardInserted) {
            return null;
        }

        return (
            <div class="innerContainer withFixedContent">
                <div class="content">
                    <div class={style.backupsList} ref={ref => this.scrollableContainer = ref}>
                        {
                            backupList.map(backup => {
                                return (
                                    <BackupsListItem
                                        backup={backup}
                                        selectedBackup={selectedBackup}
                                        handleChange={this.handleBackuplistChange}
                                        onFocus={this.scrollIntoView}
                                    />
                                );
                            })
                        }
                    </div>
                </div>
                <div class="buttons flex flex-row flex-end">
                    <Restore
                        selectedBackup={selectedBackup}
                        displayError={this.displayError}
                        deviceID={deviceID}
                        requireConfirmation={requireConfirmation}
                    />
                    {/*
                        <Erase
                            selectedBackup={selectedBackup}
                            onErase={this.refresh}
                            deviceID={deviceID}
                        />
                    */}
                    {
                        showCreate && (
                            <Create onCreate={this.refresh} deviceID={deviceID} />
                        )
                    }
                    {children}
                </div>
            </div>
        );
    }
}
