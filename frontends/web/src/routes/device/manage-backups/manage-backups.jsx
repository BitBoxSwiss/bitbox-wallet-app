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

    scrollIntoView = ({ target }) => {
        const top = Math.max((target.offsetTop + target.parentNode.offsetHeight) - this.scrollableContainer.offsetHeight, 0);
        this.scrollableContainer.scroll({
            top,
            behavior: 'smooth'
        });
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
                <div class="headerContainer fixed">
                    <div class="header">
                        <h2>{t('backup.title')}</h2>
                        <div>
                            <ButtonLink primary href={`/device/${deviceID}`}>Close</ButtonLink>
                        </div>
                    </div>
                </div>
                <div class="innerContainer withFixedContent">
                    <div class="content">
                        <div class={style.backupsList} ref={ref => this.scrollableContainer = ref}>
                            {
                                backupList.map(backup => <BackupsListItem backup={backup} selectedBackup={selectedBackup} handleChange={this.handleBackuplistChange} onFocus={this.scrollIntoView} />)
                            }
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
                            {' '}
                            {
                                showCreate && (
                                    <Create onCreate={this.refresh} deviceID={deviceID} />
                                )
                            }
                        </div>
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
    onFocus,
}) {
    return (
        <Radio
            checked={selectedBackup === backup}
            onChange={handleChange}
            id={backup}
            label={backup}
            value={backup}
            onFocus={onFocus}>
            <span className="text-small text-gray">2018/05/02 2:30PM</span>
        </Radio>
    );
}
