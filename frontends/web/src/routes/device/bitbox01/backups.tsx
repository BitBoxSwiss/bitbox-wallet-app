/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2022 Shift Crypto AG
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

import React, { Component, createRef, ReactNode } from 'react';
import { getDeviceInfo } from '../../../api/bitbox01';
import { Backup } from '../../../api/backup';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiGet } from '../../../utils/request';
import { SimpleMarkup } from '../../../utils/markup';
import { alertUser } from '../../../components/alert/Alert';
import { Button } from '../../../components/forms';
import { BackupsListItem } from '../components/backup';
import style from '../components/backups.module.css';
import Check from './check';
import { Create } from './create';
import { Restore } from './restore';

type BackupsProps = {
  deviceID: string;
  showCreate?: boolean;
  showRestore?: boolean;
  requireConfirmation?: boolean;
  onRestore?: () => void;
  children: ReactNode;
};

type Props = BackupsProps & TranslateProps;

type State = {
  backupList: Backup[];
  selectedBackup?: string;
  sdCardInserted: boolean | null;
  lock?: boolean;
};

class Backups extends Component<Props, State> {
  private scrollableContainer = createRef<HTMLDivElement>();

  constructor(props: Props) {
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
    getDeviceInfo(this.props.deviceID)
      .then(deviceInfo => {
        if (deviceInfo) {
          this.setState({ lock: deviceInfo.lock });
        }
      });
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
  };

  private handleBackuplistChange = (backupID: string) => {
    this.setState({ selectedBackup: backupID });
  };

  private scrollIntoView = (event: React.SyntheticEvent) => {
    if (!this.scrollableContainer.current) {
      return;
    }
    const target = event.target as HTMLInputElement;
    const offsetTop = target.offsetTop;
    const offsetHeight = (target.parentNode as HTMLElement).offsetHeight;
    if (offsetTop > this.scrollableContainer.current.scrollTop + offsetHeight) {
      return;
    }
    const top = Math.max((offsetTop + offsetHeight) - this.scrollableContainer.current.offsetHeight, 0);
    this.scrollableContainer.current.scroll({ top, behavior: 'smooth' });
  };

  public render() {
    const {
      t,
      children,
      showCreate = false,
      showRestore = true,
      deviceID,
      requireConfirmation = true,
      onRestore,
    } = this.props;
    const { backupList, selectedBackup, sdCardInserted, lock } = this.state;
    if (lock === undefined) {
      return null;
    }
    if (sdCardInserted === false) {
      return (
        <div className="box m-top-default">
          <p className="first">{t('backup.insert')}</p>
          <div className="buttons">
            <Button primary onClick={this.refresh}>
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
      <div className="box large m-top-default">
        <SimpleMarkup tagName="p" markup={t('backup.description')} />
        <div className={style.backupsList} ref={this.scrollableContainer}>
          <div className={style.listContainer}>
            {
              backupList.length ? backupList.map(backup => (
                <div key={backup.id} className={style.item}>
                  <BackupsListItem
                    backup={backup}
                    selectedBackup={selectedBackup}
                    handleChange={this.handleBackuplistChange}
                    onFocus={this.scrollIntoView}
                    radio={true} />
                </div>
              )) : (
                <p className={style.emptyText}>
                  {t('backup.noBackups')}
                </p>
              )
            }
          </div>
        </div>
        <div className="buttons">
          {
            showCreate && !lock && (
              <Create
                onCreate={this.refresh}
                deviceID={deviceID} />
            )
          }
          {
            showCreate && (
              <Check
                selectedBackup={selectedBackup}
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

const TranslatedBackups = translate()(Backups);
export { TranslatedBackups as Backups };
