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
export default class Backups extends Component {
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

    scrollIntoView = ({ target }) => {
        const offsetTop = target.offsetTop;
        if (offsetTop > this.scrollableContainer.scrollTop + target.parentNode.offsetHeight) {
            return;
        }
        const top = Math.max((offsetTop + target.parentNode.offsetHeight) - this.scrollableContainer.offsetHeight, 0);
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
                <div class="content">
                    <p>{t('backup.insert')}</p>
                    <div class="buttons">
                        <Button secondary onClick={this.refresh}>
                            {t('backup.insertButton')}
                        </Button>
                        {children}
                    </div>
                </div>
            );
        } else if (!sdCardInserted) {
            return null;
        }

        return (
            <div class={['innerContainer'].join(' ')}>
                <div class="content">
                    <div class={style.backupsList} ref={ref => this.scrollableContainer = ref}>
                        {
                            backupList.map(backup => (
                                <BackupsListItem
                                    key={backup.id}
                                    backup={backup}
                                    selectedBackup={selectedBackup}
                                    handleChange={this.handleBackuplistChange}
                                    onFocus={this.scrollIntoView} />
                            ))
                        }
                    </div>
                    <div class="buttons bottom">
                        {
                            showCreate && (
                                <Create onCreate={this.refresh} deviceID={deviceID} />
                            )
                        }
                        <Restore
                            selectedBackup={selectedBackup}
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
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}
