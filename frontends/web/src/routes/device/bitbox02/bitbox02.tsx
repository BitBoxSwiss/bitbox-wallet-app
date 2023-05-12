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
import { Backup } from '../components/backup';
import { checkSDCard, errUserAbort, getChannelHash, getStatus, getVersion, insertSDCard, restoreFromMnemonic, setDeviceName, setPassword, VersionInfo, verifyAttestation, TStatus, verifyChannelHash, createBackup } from '../../../api/bitbox02';
import { attestationCheckDone, channelHashChanged, statusChanged } from '../../../api/devicessync';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { route } from '../../../utils/route';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button } from '../../../components/forms';
import { Column, ColumnButtons, Grid, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../components/view/view';
import { translate, TranslateProps } from '../../../decorators/translate';
import { alertUser } from '../../../components/alert/Alert';
import Status from '../../../components/status/status';
import { PasswordEntry } from './components/password-entry/password-entry';
import { Settings } from './settings';
import { UpgradeButton } from './upgradebutton';
import { Info, PointToBitBox02 } from '../../../components/icon';
import { SetPassword, SetPasswordWithBackup } from './setup/password';
import { SetDeviceName } from './setup/name';
import { RestoreFromSDCardBackup } from './setup/restore';
import { ChecklistWalletCreate } from './setup/checklist';
import { CreateWalletSuccess, RestoreFromMnemonicSuccess, RestoreFromSDCardSuccess } from './setup/success';

interface BitBox02Props {
    deviceID: string;
}

type Props = BitBox02Props & TranslateProps;

interface State {
    versionInfo?: VersionInfo;
    hash?: string;
    attestationResult: boolean | null;
    deviceVerified: boolean;
    status: '' | TStatus;
    appStatus: 'createWallet' | 'restoreBackup' | 'restoreFromMnemonic' | 'agreement' | 'complete' | '';
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup';
    restoreBackupStatus: 'intro' | 'restore' | 'setPassword';
    sdCardInserted?: boolean;
    errorText?: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    waitDialog?: {
        title: string;
        text?: string;
    };
    selectedBackup?: Backup;
}

class BitBox02 extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hash: undefined,
      attestationResult: null,
      deviceVerified: false,
      status: '',
      sdCardInserted: undefined,
      appStatus: '',
      createWalletStatus: 'intro',
      restoreBackupStatus: 'intro',
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
    this.onChannelHashChanged();
    this.onStatusChanged();
    this.unsubscribeList = [
      statusChanged(deviceID, this.onStatusChanged),
      channelHashChanged(deviceID, this.onChannelHashChanged),
      attestationCheckDone(deviceID, this.updateAttestationCheck),
    ];
  }

  private updateAttestationCheck = () => {
    verifyAttestation(this.props.deviceID).then(attestationResult => {
      this.setState({ attestationResult });
    });
  };

  private handleGetStarted = () => {
    route('/account-summary', true);
  };

  private onChannelHashChanged = () => {
    getChannelHash(this.props.deviceID).then(({ hash, deviceVerified }) => {
      this.setState({ hash, deviceVerified });
    });
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
      this.setState({
        status,
        errorText: undefined,
      });
      if (status === 'initialized' && unlockOnly && showWizard) {
        // bitbox is unlocked, now route to / and wait for incoming accounts
        route('/', true);
      }
    });
  };

  public componentWillUnmount() {
    unsubscribe(this.unsubscribeList);
  }

  private createWalletStep = () => {
    checkSDCard(this.props.deviceID).then(sdCardInserted => {
      this.setState({ sdCardInserted });
    });
    this.setState({
      appStatus: 'createWallet',
      createWalletStatus: 'intro',
    });
  };

  private restoreBackupStep = () => {
    this.insertSDCard().then(success => {
      if (success) {
        this.setState({
          appStatus: 'restoreBackup',
          restoreBackupStatus: 'restore',
        });
      }
    });
  };

  private insertSDCard = () => {
    return checkSDCard(this.props.deviceID).then(sdCardInserted => {
      this.setState({ sdCardInserted });
      if (sdCardInserted) {
        return true;
      }
      this.setState({ waitDialog: {
        title: this.props.t('bitbox02Wizard.stepInsertSD.insertSDcardTitle'),
        text: this.props.t('bitbox02Wizard.stepInsertSD.insertSDCard'),
      } });
      return insertSDCard(this.props.deviceID).then((response) => {
        this.setState({
          sdCardInserted: response.success,
          waitDialog: undefined,
        });
        if (response.success) {
          return true;
        }
        if (response.message) {
          alertUser(response.message, { asDialog: false });
        }
        return false;
      });
    });
  };

  private setPassword = () => {
    this.setState({ createWalletStatus: 'setPassword' });
    setPassword(this.props.deviceID).then((response) => {
      if (!response.success) {
        if (response.code === errUserAbort) {
          // On user abort, just go back to the first screen. This is a bit lazy, as we should show
          // a screen to ask the user to go back or try again.
          this.setState({
            appStatus: '',
            errorText: undefined,
          });
        } else {
          this.setState({
            errorText: this.props.t('bitbox02Wizard.noPasswordMatch'),
          }, () => {
            this.setPassword();
          });
        }
        // show noPasswordMatch error and do NOT continue to createBackup
        return;
      }
      this.setState({ createWalletStatus: 'createBackup' });
    });
  };

  private restoreBackup = () => {
    this.insertSDCard();
    this.setState({
      restoreBackupStatus: 'restore',
    });
  };

  private onSelectBackup = (backup: Backup) => {
    this.setState({
      restoreBackupStatus: 'setPassword',
      selectedBackup: backup,
    });
  };

  private onRestoreBackup = (success: boolean) => {
    if (!success) {
      this.restoreBackup();
    }
    this.setState({ selectedBackup: undefined });
  };

  private createBackup = () => {
    this.insertSDCard().then(success1 => {
      if (!success1) {
        alertUser(this.props.t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        return;
      }
      this.setState({
        waitDialog: {
          title: this.props.t('bitbox02Interact.confirmDate'),
          text: this.props.t('bitbox02Interact.confirmDateText'),
        }
      });
      createBackup(this.props.deviceID, 'sdcard')
        .then((result) => {
          if (!result.success) {
            if (result.code === 104) {
              alertUser(this.props.t('bitbox02Wizard.createBackupAborted'), { asDialog: false });
            } else {
              alertUser(this.props.t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
            }
          }
          this.setState({ waitDialog: undefined });
        })
        .catch(console.error);
    });
  };

  private setDeviceName = (deviceName: string) => {
    const { deviceID, t } = this.props;
    this.setState({
      waitDialog: { title: t('bitbox02Interact.confirmName') }
    }, async () => {
      try {
        const result = await setDeviceName(deviceID, deviceName);
        if (!result.success) {
          alertUser(result.message || t('genericError'), {
            asDialog: false,
            callback: () => this.setState({ waitDialog: undefined }),
          });
          return;
        }
        this.setState(
          { waitDialog: undefined },
          () => this.setPassword(),
        );
      } catch (error) {
        console.error(error);
      }
    });
  };

  private restoreFromMnemonic = async () => {
    this.setState({ waitDialog: {
      title: this.props.t('bitbox02Interact.followInstructionsMnemonicTitle'),
      text: this.props.t('bitbox02Interact.followInstructionsMnemonic'),
    } });
    try {
      const { success } = await restoreFromMnemonic(this.props.deviceID);
      if (!success) {
        alertUser(this.props.t('bitbox02Wizard.restoreFromMnemonic.failed'), { asDialog: false });
      } else {
        this.setState({ appStatus: 'restoreFromMnemonic' });
      }
      this.setState({ waitDialog: undefined });
    } catch (error) {
      console.error(error);
    }
  };

  public render() {
    const { t, deviceID } = this.props;
    const {
      attestationResult,
      versionInfo,
      hash,
      status,
      appStatus,
      createWalletStatus,
      restoreBackupStatus,
      deviceVerified,
      errorText,
      unlockOnly,
      showWizard,
      sdCardInserted,
      waitDialog,
      selectedBackup,
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
        <View
          key="wait-view"
          fullscreen
          verticallyCentered
          textCenter>
          <ViewHeader title={waitDialog.title}>
            <p>{waitDialog.text ? waitDialog.text : t('bitbox02Interact.followInstructions')}</p>
          </ViewHeader>
          <ViewContent>
            <PointToBitBox02 />
          </ViewContent>
        </View>
      );
    }

    return (
      <Main>
        { (status === 'connected') ? (
          <View
            key="connection"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="690px">
            <ViewHeader title={t('button.unlock')}>
              <p>{t('bitbox02Wizard.stepConnected.unlock')}</p>
            </ViewHeader>
            <ViewContent fullWidth>
              {attestationResult === false ? (
                <Status>
                  {t('bitbox02Wizard.attestationFailed')}
                </Status>
              ) : (
                <PasswordEntry />
              )}
            </ViewContent>
          </View>
        ) : null }

        {(status === 'unpaired' || status === 'pairingFailed') && (
          <View
            key="pairing"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="670px">
            <ViewHeader title={t('bitbox02Wizard.pairing.title')}>
              { (attestationResult === false && status !== 'pairingFailed') && (
                <Status key="attestation" type="warning">
                  {t('bitbox02Wizard.attestationFailed')}
                </Status>
              )}
              { status === 'pairingFailed' ? (
                <Status key="pairingFailed" type="warning">
                  {t('bitbox02Wizard.pairing.failed')}
                </Status>
              ) : (
                <p>
                  { deviceVerified
                    ? t('bitbox02Wizard.pairing.paired')
                    : t('bitbox02Wizard.pairing.unpaired') }
                </p>
              )}
            </ViewHeader>
            <ViewContent fullWidth>
              { status !== 'pairingFailed' && (
                <>
                  <pre>{hash}</pre>
                  { !deviceVerified && <PointToBitBox02 /> }
                </>
              )}
            </ViewContent>
            <ViewButtons>
              { (status !== 'pairingFailed' && deviceVerified) && (
                <Button
                  primary
                  onClick={() => verifyChannelHash(deviceID, true)}>
                  {t('button.continue')}
                </Button>
              )}
            </ViewButtons>
          </View>
        )}

        { (!unlockOnly && status === 'uninitialized' && appStatus === '') && (
          <View
            key="uninitialized-pairing"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="950px">
            <ViewHeader title={t('bitbox02Wizard.stepUninitialized.title')}>
              <p>
                <Info style={{ marginRight: '.5em', verticalAlign: 'text-bottom', height: '1.2em' }} />
                {t('bitbox02Wizard.initialize.tip')}
              </p>
            </ViewHeader>
            <ViewContent>
              <Grid>
                <Column asCard className="m-bottom-default">
                  <h3 className="title">{t('button.create')}</h3>
                  <p>{t('bitbox02Wizard.stepUninitialized.create')}</p>
                  <ColumnButtons>
                    <Button primary onClick={this.createWalletStep}>
                      {t('seed.create')}
                    </Button>
                  </ColumnButtons>
                </Column>
                <Column asCard className="m-bottom-default">
                  <h3 className="title">{t('button.restore')}</h3>
                  <p>{t('bitbox02Wizard.stepUninitialized.restore')}</p>
                  <ColumnButtons>
                    <Button
                      secondary
                      onClick={this.restoreBackupStep}>
                      {t('bitbox02Wizard.stepUninitialized.restoreMicroSD')}
                    </Button>
                    <Button
                      secondary
                      onClick={this.restoreFromMnemonic}>
                      {t('bitbox02Wizard.stepUninitialized.restoreMnemonic')}
                    </Button>
                  </ColumnButtons>
                </Column>
              </Grid>
            </ViewContent>
          </View>
        )}

        { (!unlockOnly && appStatus === 'createWallet' && createWalletStatus === 'intro') && (
          <SetDeviceName
            key="set-devicename"
            sdCardInserted={sdCardInserted}
            onDeviceName={this.setDeviceName}
            onBack={() => this.setState({ appStatus: '' })} />
        )}
        { (!unlockOnly && appStatus === 'createWallet' && createWalletStatus === 'setPassword') && (
          <SetPassword key="create-wallet" errorText={errorText} />
        )}
        { (!unlockOnly && appStatus === 'createWallet' && status === 'seeded' && createWalletStatus === 'createBackup') && (
          <ChecklistWalletCreate key="create-backup" onContinue={this.createBackup} />
        )}

        {/* keeping the backups mounted even restoreBackupStatus === 'restore' is not true so it catches potential errors */}
        { (!unlockOnly && appStatus === 'restoreBackup' && status !== 'initialized') && (
          <RestoreFromSDCardBackup
            key="restore-backup"
            deviceID={deviceID}
            onSelectBackup={this.onSelectBackup}
            onRestoreBackup={this.onRestoreBackup}
            onBack={() => this.setState({ appStatus: '' })} />
        )}
        { (!unlockOnly && appStatus === 'restoreBackup' && status !== 'initialized' && restoreBackupStatus === 'setPassword') && (
          <SetPasswordWithBackup
            key="set-password"
            errorText={errorText}
            forBackup={selectedBackup} />
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
