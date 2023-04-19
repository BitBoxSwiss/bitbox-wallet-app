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

import React, { Component, FormEvent } from 'react';
import { checkSDCard, errUserAbort, getChannelHash, getStatus, getVersion, insertSDCard, restoreFromMnemonic, setDeviceName, setPassword, VersionInfo, verifyAttestation, TStatus, verifyChannelHash, createBackup } from '../../../api/bitbox02';
import { FailResponse, SuccessResponse } from '../../../api/response';
import { MultilineMarkup } from '../../../utils/markup';
import { convertDateToLocaleString } from '../../../utils/date';
import { route } from '../../../utils/route';
import { Backup } from '../components/backup';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button, Checkbox, Input } from '../../../components/forms';
import { Toggle } from '../../../components/toggle/toggle';
import { Column, ColumnButtons, Grid, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../components/view/view';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiWebsocket } from '../../../utils/websocket';
import { alertUser } from '../../../components/alert/Alert';
import { store as panelStore } from '../../../components/guide/guide';
import { setSidebarStatus } from '../../../components/sidebar/sidebar';
import Status from '../../../components/status/status';
import { PasswordEntry } from './components/password-entry/password-entry';
import { BackupsV2 } from './backups';
import { Settings } from './settings';
import { UpgradeButton } from './upgradebutton';
import { Info, PointToBitBox02 } from '../../../components/icon';
import style from './bitbox02.module.css';

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
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup' | 'createWords';
    restoreBackupStatus: 'intro' | 'restore' | 'setPassword';
    settingPassword: boolean;
    creatingBackup: boolean;
    sdCardInserted?: boolean;
    errorText?: string;
    deviceName: string;
    // if true, we just pair and unlock, so we can hide some steps.
    unlockOnly: boolean;
    showWizard: boolean;
    agreement1: boolean;
    agreement2: boolean;
    agreement3: boolean;
    agreement4: boolean;
    agreement5: boolean;
    waitDialog?: {
        title: string;
        text?: string;
    };
    selectedBackup?: Backup;
    backupType: 'sdcard' | 'recovery-words'
}

class BitBox02 extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hash: undefined,
      attestationResult: null,
      deviceVerified: false,
      status: '',
      settingPassword: false,
      creatingBackup: false,
      sdCardInserted: undefined,
      appStatus: '',
      createWalletStatus: 'intro',
      restoreBackupStatus: 'intro',
      deviceName: '',
      unlockOnly: true,
      showWizard: false,
      agreement1: false,
      agreement2: false,
      agreement3: false,
      agreement4: false,
      agreement5: false,
      waitDialog: undefined,
      backupType: 'sdcard',
    };
  }

  private unsubscribe!: () => void;

  public componentDidMount() {
    getVersion(this.props.deviceID).then(versionInfo => {
      this.setState({ versionInfo });
    });
    this.updateAttestationCheck();
    this.checkSDCard().then(sdCardInserted => {
      this.setState({ sdCardInserted });
    });
    this.onChannelHashChanged();
    this.onStatusChanged();
    this.unsubscribe = apiWebsocket((payload) => {
      if ('type' in payload) {
        const { type, data, deviceID } = payload;
        switch (type) {
        case 'device':
          if (deviceID !== this.props.deviceID) {
            return;
          }
          switch (data) {
          case 'channelHashChanged':
            this.onChannelHashChanged();
            break;
          case 'statusChanged':
            this.onStatusChanged();
            break;
          case 'attestationCheckDone':
            this.updateAttestationCheck();
            break;
          }
          break;
        }
      }
    });
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
    const { showWizard, unlockOnly, appStatus } = this.state;
    const { sidebarStatus } = panelStore.state;
    getStatus(this.props.deviceID).then(status => {
      const restoreSidebar = status === 'initialized' && !['createWallet', 'restoreBackup'].includes(appStatus) && sidebarStatus !== '';
      if (restoreSidebar) {
        setSidebarStatus('');
      } else if (status !== 'initialized' && ['', 'forceCollapsed'].includes(sidebarStatus)) {
        setSidebarStatus('forceHidden');
      }
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
    const { sidebarStatus } = panelStore.state;
    if (['forceHidden', 'forceCollapsed'].includes(sidebarStatus)) {
      setSidebarStatus('');
    }
    this.unsubscribe();
  }

  private uninitializedStep = () => {
    this.setState({ appStatus: '' });
  };

  private createWalletStep = () => {
    if (this.state.backupType === 'sdcard') {
      this.checkSDCard().then(sdCardInserted => {
        this.setState({ sdCardInserted });
      });
    }
    this.setState({
      appStatus: 'createWallet',
      createWalletStatus: 'intro',
      deviceName: '',
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

  private checkSDCard = () => {
    return checkSDCard(this.props.deviceID);
  };

  private insertSDCard = () => {
    return this.checkSDCard().then(sdCardInserted => {
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
    this.setState({
      settingPassword: true,
      createWalletStatus: 'setPassword',
    });
    setPassword(this.props.deviceID).then((response) => {
      if (!response.success) {
        if (response.code === errUserAbort) {
          // On user abort, just go back to the first screen. This is a bit lazy, as we should show
          // a screen to ask the user to go back or try again.
          this.setState({
            appStatus: '',
            errorText: undefined,
            settingPassword: false,
            backupType: 'sdcard',
          });
        } else {
          this.setState({
            errorText: this.props.t('bitbox02Wizard.noPasswordMatch'),
            settingPassword: false,
          }, () => {
            this.setPassword();
          });
        }
        // show noPasswordMatch error and do NOT continue to createBackup
        return;
      }
      const withSDCard = this.state.backupType === 'sdcard';
      this.setState({
        settingPassword: false,
        createWalletStatus: withSDCard ? 'createBackup' : 'createWords',
      }, () => {
        // sdcard backup shows warnings first, recovery words goes directly to createBackup
        if (!withSDCard) {
          this.createBackup();
        }
      });
    });
  };

  private restoreBackup = () => {
    this.insertSDCard();
    this.setState({
      restoreBackupStatus: 'restore',
    });
  };

  private backupOnBeforeRestore = (backup: Backup) => {
    this.setState({
      restoreBackupStatus: 'setPassword',
      selectedBackup: backup,
    });
  };

  private backupOnAfterRestore = (success: boolean) => {
    if (!success) {
      this.restoreBackup();
    }
    this.setState({ selectedBackup: undefined });
  };

  private createBackup = () => {
    const { deviceID, t } = this.props;
    switch (this.state.backupType) {
    case 'recovery-words':
      this.setState({
        creatingBackup: true,
        waitDialog: {
          title: t('backup.create.title'),
          text: t('bitbox02Wizard.stepBackup.createBackup_withoutSdcard'),
        }
      });
      createBackup(deviceID, 'recovery-words')
        .then(this.createBackupDone)
        .catch(console.error);
      break;
    case 'sdcard':
      this.insertSDCard().then(success => {
        if (!success) {
          alertUser(t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
          return;
        }
        this.setState({
          creatingBackup: true,
          waitDialog: {
            title: t('bitbox02Interact.confirmDate'),
            text: t('bitbox02Interact.confirmDateText'),
          }
        });
        createBackup(deviceID, 'sdcard')
          .then(this.createBackupDone)
          .catch(console.error);
      });
      break;
    }
  };

  private createBackupDone = (result: SuccessResponse | FailResponse) => {
    if (!result.success) {
      if (result.code === 104) {
        alertUser(this.props.t('bitbox02Wizard.createBackupAborted'), { asDialog: false });
      } else {
        alertUser(this.props.t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
      }
      this.setState({ appStatus: '', creatingBackup: false, waitDialog: undefined });
      return;
    }
    this.setState({ creatingBackup: false, waitDialog: undefined });
  };

  private handleDeviceNameInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    const value: string = target.value;
    this.setState({ deviceName: value });
  };

  private setDeviceName = (event: FormEvent) => {
    const { deviceID, t } = this.props;
    event.preventDefault();
    this.setState({
      waitDialog: { title: t('bitbox02Interact.confirmName') }
    }, async () => {
      try {
        const result = await setDeviceName(deviceID, this.state.deviceName);
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

  private handleDisclaimerCheck = (event: React.SyntheticEvent) => {
        type TAgreements = 'agreement1' | 'agreement2' | 'agreement3' | 'agreement4' | 'agreement5';
        const target = event.target as HTMLInputElement;
        const key = target.id;
        this.setState({
          [key as TAgreements]: target.checked
        } as unknown as Pick<State, keyof State>);
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
      settingPassword,
      creatingBackup,
      deviceVerified,
      errorText,
      unlockOnly,
      showWizard,
      sdCardInserted,
      deviceName,
      agreement1,
      agreement2,
      agreement3,
      agreement4,
      agreement5,
      waitDialog,
      selectedBackup,
      backupType,
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

    const readDisclaimers = agreement1 && agreement2 && agreement3 && agreement4 && agreement5;
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

        { (!unlockOnly && appStatus === '') && (
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
                    <Button
                      primary
                      onClick={this.createWalletStep}
                      disabled={settingPassword}>
                      {t('seed.create')}
                    </Button>
                  </ColumnButtons>
                  {/* <Button transparent onClick={() => this.setState({ backupType: 'recovery-words' })}>
                    <small>
                      Advanced settings
                    </small>
                  </Button> */}
                  <div className="m-top-quarter">
                    <small>Use words</small>
                    {' '}
                    <Toggle
                      checked={this.state.backupType === 'recovery-words'}
                      id="togggle-show-firmware-hash"
                      onChange={() => this.setState(({ backupType }) => ({
                        backupType: backupType === 'sdcard' ? 'recovery-words' : 'sdcard'
                      }))}
                      className="text-medium" />
                  </div>
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
          <form
            key="intro-pairing"
            onSubmit={this.setDeviceName}>
            <View
              fullscreen
              textCenter
              withBottomBar
              verticallyCentered
              width="600px">
              <ViewHeader title={t('bitbox02Wizard.stepCreate.title')}>
                <p>
                  { backupType === 'sdcard'
                    ? t('bitbox02Wizard.stepCreate.description')
                    : t('bitbox02Wizard.stepCreate.description_withoutSdcard')
                  }
                </p>
                {backupType === 'sdcard' && !sdCardInserted && (
                  <Status type="warning" className="m-bottom-half">
                    <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
                  </Status>
                )}
              </ViewHeader>
              <ViewContent>
                <Input
                  autoFocus
                  className={style.wizardLabel}
                  label={t('bitbox02Wizard.stepCreate.nameLabel')}
                  pattern="^.{0,63}$"
                  onInput={this.handleDeviceNameInput}
                  placeholder={t('bitbox02Wizard.stepCreate.namePlaceholder')}
                  value={deviceName}
                  id="deviceName" />
              </ViewContent>
              <ViewButtons>
                <Button
                  disabled={!deviceName}
                  primary
                  type="submit">
                  {t('button.continue')}
                </Button>
                <Button
                  onClick={() => this.setState({ appStatus: '' })}
                  transparent
                  type="button">
                  {t('button.back')}
                </Button>
              </ViewButtons>
            </View>
          </form>
        )}

        { (!unlockOnly && appStatus === 'createWallet' && createWalletStatus === 'setPassword') && (
          <View
            key="create-wallet"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="600px">
            <ViewHeader title={t('bitbox02Wizard.stepPassword.title')}>
              {errorText && (
                <Status type="warning">
                  <span>{errorText}</span>
                </Status>
              )}
              <p>{t('bitbox02Wizard.stepPassword.useControls')}</p>
            </ViewHeader>
            <ViewContent>
              <PasswordEntry />
            </ViewContent>
          </View>
        )}

        { (!unlockOnly && appStatus === 'createWallet' && status === 'seeded' && createWalletStatus === 'createBackup') && (
          <form>
            <View
              key="create-backup"
              fullscreen
              textCenter
              verticallyCentered
              withBottomBar
              width="700px">
              <ViewHeader title={t('backup.create.title')}>
                <p>{t('bitbox02Wizard.stepBackup.createBackup')}</p>
              </ViewHeader>
              <ViewContent textAlign="left">
                <p>{t('bitbox02Wizard.stepBackup.beforeProceed')}</p>
                <Checkbox
                  onChange={this.handleDisclaimerCheck}
                  className={style.wizardCheckbox}
                  id="agreement1"
                  checked={agreement1}
                  label={t('bitbox02Wizard.backup.userConfirmation1')} />
                <Checkbox
                  onChange={this.handleDisclaimerCheck}
                  className={style.wizardCheckbox}
                  id="agreement2"
                  checked={agreement2}
                  label={t('bitbox02Wizard.backup.userConfirmation2')} />
                <Checkbox
                  onChange={this.handleDisclaimerCheck}
                  className={style.wizardCheckbox}
                  id="agreement3"
                  checked={agreement3}
                  label={t('bitbox02Wizard.backup.userConfirmation3')} />
                <Checkbox
                  onChange={this.handleDisclaimerCheck}
                  className={style.wizardCheckbox}
                  id="agreement4"
                  checked={agreement4}
                  label={t('bitbox02Wizard.backup.userConfirmation4')} />
                <Checkbox
                  onChange={this.handleDisclaimerCheck}
                  className={style.wizardCheckbox}
                  id="agreement5"
                  checked={agreement5}
                  label={t('bitbox02Wizard.backup.userConfirmation5')} />
              </ViewContent>
              <ViewButtons>
                <Button
                  primary
                  onClick={this.createBackup}
                  disabled={creatingBackup || !readDisclaimers}>
                  {t('button.continue')}
                </Button>
              </ViewButtons>
            </View>
          </form>
        )}

        {/* keeping the backups mounted even restoreBackupStatus === 'restore' is not true so it catches potential errors */}
        { (!unlockOnly && appStatus === 'restoreBackup' && status !== 'initialized') && (
          <View
            key="restore"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="700px">
            <ViewHeader title={t('backup.restore.confirmTitle')}>
            </ViewHeader>
            <ViewContent>
              <BackupsV2
                deviceID={deviceID}
                showRestore={true}
                showRadio={true}
                backupOnBeforeRestore={this.backupOnBeforeRestore}
                backupOnAfterRestore={this.backupOnAfterRestore}>
                <Button
                  transparent
                  onClick={this.uninitializedStep}
                  disabled={settingPassword}>
                  {t('button.back')}
                </Button>
              </BackupsV2>
            </ViewContent>
          </View>
        )}

        { (!unlockOnly && appStatus === 'restoreBackup' && status !== 'initialized' && restoreBackupStatus === 'setPassword') && (
          <View
            key="set-password"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="700px">
            <ViewHeader title={t('backup.restore.confirmTitle')}>
              {errorText ? (
                <Status type="warning">
                  <span>{errorText}</span>
                </Status>
              ) : (
                selectedBackup ? (
                  <div>
                    <MultilineMarkup tagName="div" markup={t('backup.restore.selectedBackup', {
                      backupName: selectedBackup.name,
                      createdDateTime: convertDateToLocaleString(selectedBackup.date, this.props.i18n.language),
                    })}/>
                    <p className="text-small text-ellipsis">
                      ID:&nbsp;{selectedBackup.id}
                    </p>
                  </div>
                ) : null
              )}
            </ViewHeader>
            <ViewContent>
              <p>{t('bitbox02Wizard.stepPassword.useControls')}</p>
              <PasswordEntry />
            </ViewContent>
          </View>
        )}

        { (appStatus === 'createWallet' && status === 'initialized') && (
          <View
            key="success"
            fitContent
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar>
            <ViewHeader title={t('bitbox02Wizard.success.title')}>
              <p>{t('bitbox02Wizard.stepCreateSuccess.success')}</p>
            </ViewHeader>
            <ViewContent withIcon="success">
              <p>
                { backupType === 'sdcard'
                  ? t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')
                  : t('bitbox02Wizard.stepCreateSuccess.secureLocation')
                }
              </p>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={this.handleGetStarted}>
                {t('success.getstarted')}
              </Button>
            </ViewButtons>
          </View>
        )}

        { (appStatus === 'restoreBackup' && status === 'initialized') && (
          <View
            key="backup-success"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="700px">
            <ViewHeader title={t('bitbox02Wizard.stepBackupSuccess.title')} />
            <ViewContent textAlign="left">
              <p>{t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}</p>
              <p className="m-bottom-default">{t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}</p>
              <ul>
                <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation2')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
              </ul>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={this.handleGetStarted}>
                {t('success.getstarted')}
              </Button>
            </ViewButtons>
          </View>
        )}

        { (appStatus === 'restoreFromMnemonic' && status === 'initialized') && (
          <View
            key="backup-mnemonic-success"
            fullscreen
            textCenter
            verticallyCentered
            withBottomBar
            width="700px">
            <ViewHeader title={t('bitbox02Wizard.stepBackupSuccess.title')} />
            <ViewContent textAlign="left">
              <p className="m-bottom-default">{t('bitbox02Wizard.stepBackupSuccess.fundsSafe')}</p>
              <ul>
                <li>{t('bitbox02Wizard.backup.userConfirmation1')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation3')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation4')}</li>
                <li>{t('bitbox02Wizard.backup.userConfirmation5')}</li>
              </ul>
            </ViewContent>
            <ViewButtons>
              <Button primary onClick={this.handleGetStarted}>
                {t('success.getstarted')}
              </Button>
            </ViewButtons>
          </View>
        )}

      </Main>
    );
  }
}

const HOC = translate()(BitBox02);
export { HOC as BitBox02 };
