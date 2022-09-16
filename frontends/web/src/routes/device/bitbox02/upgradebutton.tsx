/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import { Component } from 'react';
import { VersionInfo } from '../../../api/bitbox02';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button } from '../../../components/forms';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';

interface UpgradeButtonProps {
    apiPrefix: string;
    versionInfo?: VersionInfo;
    asButton?: boolean;
}

type Props = UpgradeButtonProps & TranslateProps;

interface State {
    activeDialog: boolean;
    confirming: boolean;
}

class UpgradeButton extends Component<Props, State> {
  public readonly state: State = {
    activeDialog: false,
    confirming: false,
  };

  private upgradeFirmware = () => {
    this.setState({ confirming: true });
    apiPost(this.props.apiPrefix + '/upgrade-firmware').then(() => {
      this.setState({ confirming: false });
      this.abort();
    });
  };

  private abort = () => {
    this.setState({ activeDialog: false });
  };

  public render() {
    const {
      t,
      versionInfo,
      asButton,
    } = this.props;
    const {
      activeDialog,
      confirming,
    } = this.state;
    if (!versionInfo || !versionInfo.canUpgrade) {
      return null;
    }
    return (
      <div>
        {
          asButton ? (
            <Button primary onClick={() => this.setState({ activeDialog: true })}>
              {t('button.upgrade')}
            </Button>
          ) : (
            <SettingsButton optionalText={versionInfo.newVersion} onClick={() => this.setState({ activeDialog: true })}>
              {t('button.upgrade')}
            </SettingsButton>
          )
        }
        {
          activeDialog && (
            <Dialog title={t('upgradeFirmware.title')}>
              {confirming ? t('confirmOnDevice') : (
                <p>{t('upgradeFirmware.description', {
                  currentVersion: versionInfo.currentVersion,
                  newVersion: versionInfo.newVersion,
                })}</p>
              )}
              { !confirming && (
                <DialogButtons>
                  <Button
                    primary
                    onClick={this.upgradeFirmware}>
                    {t('button.upgrade')}
                  </Button>
                  <Button transparent onClick={this.abort}>
                    {t('button.back')}
                  </Button>
                </DialogButtons>
              )}
            </Dialog>
          )
        }
      </div>
    );
  }
}

const HOC = translate()(UpgradeButton);
export { HOC as UpgradeButton };
