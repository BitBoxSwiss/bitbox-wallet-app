/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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
import { getStatus, getVersion, VersionInfo, verifyAttestation, TStatus } from '../../../api/bitbox02';
import { attestationCheckDone, statusChanged } from '../../../api/devicessync';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { route } from '../../../utils/route';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Main } from '../../../components/layout';
import { translate, TranslateProps } from '../../../decorators/translate';
import { Settings } from './settings';
import { UpgradeButton } from './upgradebutton';
import { Unlock } from './unlock';
import { Pairing } from './setup/pairing';
import { Wait } from './setup/wait';
import { SetupOptions } from './setup/choose';
import { CreateWallet } from './setup/wallet-create';
import { RestoreFromSDCard, RestoreFromMnemonic } from './setup/wallet-restore';
import { CreateWalletSuccess, RestoreFromMnemonicSuccess, RestoreFromSDCardSuccess } from './setup/success';

interface BitBox02Props {
    deviceID: string;
}

type Props = BitBox02Props & TranslateProps;

interface State {
    versionInfo?: VersionInfo;
    attestation: boolean | null;
    status: '' | TStatus;
    appStatus: 'createWallet' | 'restoreBackup' | 'restoreFromMnemonic' | '';
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    waitDialog?: {
        title: string;
        text?: string;
    };
}

class BitBox02 extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      attestation: null,
      status: '',
      appStatus: '',
      unlockOnly: true,
      showWizard: false,
      waitDialog: undefined,
    };
  }

  private unsubscribeList: UnsubscribeList = [];

  public componentDidMount() {
    const { deviceID } = this.props;
    getVersion(deviceID).then(versionInfo => {
      this.setState({ versionInfo });
    });
    this.updateAttestationCheck();
    this.onStatusChanged();
    this.unsubscribeList = [
      statusChanged(deviceID, this.onStatusChanged),
      attestationCheckDone(deviceID, this.updateAttestationCheck),
    ];
  }

  private updateAttestationCheck = () => {
    verifyAttestation(this.props.deviceID).then(attestation => {
      this.setState({ attestation });
    });
  };

  private handleGetStarted = () => {
    route('/account-summary', true);
  };

  private onStatusChanged = () => {
    const { showWizard, unlockOnly } = this.state;
    getStatus(this.props.deviceID).then(status => {
      if (!showWizard && ['connected', 'unpaired', 'pairingFailed', 'uninitialized', 'seeded'].includes(status)) {
        this.setState({ showWizard: true });
      }
      if (unlockOnly && ['uninitialized', 'seeded'].includes(status)) {
        this.setState({ unlockOnly: false });
      }
      if (status === 'seeded') {
        this.setState({ appStatus: 'createWallet' });
      }
      this.setState({ status });
      if (status === 'initialized' && unlockOnly && showWizard) {
        // bitbox is unlocked, now route to / and wait for incoming accounts
        route('/', true);
      }
    });
  };

  public componentWillUnmount() {
    unsubscribe(this.unsubscribeList);
  }

  public render() {
    const { t, deviceID } = this.props;
    const {
      attestation,
      versionInfo,
      status,
      appStatus,
      unlockOnly,
      showWizard,
      waitDialog,
    } = this.state;

    if (status === '') {
      return null;
    }
    if (!versionInfo) {
      return null;
    }
    if (status === 'require_firmware_upgrade') {
      return (
        <CenteredContent>
          <div className="box large">
            <p>{t('upgradeFirmware.label')}</p>
            <div className="buttons">
              <UpgradeButton
                asButton
                deviceID={deviceID}
                versionInfo={versionInfo}
              />
            </div>
          </div>
        </CenteredContent>
      );
    }
    if (status === 'require_app_upgrade') {
      return <AppUpgradeRequired/>;
    }
    if (!showWizard) {
      return <Settings deviceID={deviceID}/>;
    }
    if (waitDialog) {
      return (
        <Wait
          key="wait-view"
          title={waitDialog.title}
          text={waitDialog.text} />
      );
    }

    return (
      <Main>
        { (status === 'connected') ? (
          <Unlock
            key="unlock"
            attestation={attestation} />
        ) : null }

        { (status === 'unpaired' || status === 'pairingFailed') && (
          <Pairing
            key="pairing"
            deviceID={deviceID}
            attestation={attestation}
            pairingFailed={status === 'pairingFailed'} />
        )}

        { (!unlockOnly && appStatus === '') && (
          <SetupOptions
            key="choose-setup"
            onSelectSetup={(option) => {
              switch (option) {
              case 'create-wallet':
                this.setState({ appStatus: 'createWallet' });
                break;
              case 'restore-sdcard':
                this.setState({ appStatus: 'restoreBackup' });
                break;
              case 'restore-mnemonic':
                this.setState({ appStatus: 'restoreFromMnemonic' });
                break;
              }
            }} />
        )}

        { (!unlockOnly && appStatus === 'createWallet') && (
          <CreateWallet
            deviceID={deviceID}
            isSeeded={status === 'seeded'}
            onAbort={() => this.setState({ appStatus: '' })} />
        )}

        {/* keeping the backups mounted even restoreBackupStatus === 'restore' is not true so it catches potential errors */}
        { (!unlockOnly && appStatus === 'restoreBackup' && status !== 'initialized') && (
          <RestoreFromSDCard
            key="restore-sdcard"
            deviceID={deviceID}
            onAbort={() => this.setState({ appStatus: '' })} />
        )}

        { (!unlockOnly && appStatus === 'restoreFromMnemonic' && status !== 'initialized') && (
          <RestoreFromMnemonic
            key="restore-mnemonic"
            deviceID={deviceID}
            onAbort={() => this.setState({ appStatus: '' })} />
        )}

        { (appStatus === 'createWallet' && status === 'initialized') && (
          <CreateWalletSuccess key="success" onContinue={this.handleGetStarted} />
        )}
        { (appStatus === 'restoreBackup' && status === 'initialized') && (
          <RestoreFromSDCardSuccess key="backup-success" onContinue={this.handleGetStarted} />
        )}
        { (appStatus === 'restoreFromMnemonic' && status === 'initialized') && (
          <RestoreFromMnemonicSuccess key="backup-mnemonic-success" onContinue={this.handleGetStarted} />
        )}
      </Main>
    );
  }
}

const HOC = translate()(BitBox02);
export { HOC as BitBox02 };
