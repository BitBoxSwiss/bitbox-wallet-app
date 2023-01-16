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

import React, { Component, FormEvent } from 'react';
import { Backup } from '../components/backup';
import { checkSDCard, errUserAbort, getChannelHash, getStatus, getVersion, insertSDCard, setDeviceName, setPassword, VersionInfo, verifyAttestation, TStatus, verifyChannelHash } from '../../../api/bitbox02';
import { MultilineMarkup } from '../../../utils/markup';
import { convertDateToLocaleString } from '../../../utils/date';
import { route } from '../../../utils/route';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { CenteredContent } from '../../../components/centeredcontent/centeredcontent';
import { Button, Checkbox, Input } from '../../../components/forms';
import { Column, ColumnButtons, Grid, Main } from '../../../components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../components/view/view';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
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
    createWalletStatus: 'intro' | 'setPassword' | 'createBackup';
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
    };
  }

  private unsubscribe!: () => void;

  public UNSAFE_componentWillMount() {
    const { sidebarStatus } = panelStore.state;
    if (['', 'forceCollapsed'].includes(sidebarStatus)) {
      setSidebarStatus('forceHidden');
    }
  }

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
    this.checkSDCard().then(sdCardInserted => {
      this.setState({ sdCardInserted });
    });
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
      this.setState({ settingPassword: false, createWalletStatus: 'createBackup' });
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
    this.insertSDCard().then(success1 => {
      if (!success1) {
        alertUser(this.props.t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        return;
      }

      this.setState({ creatingBackup: true, waitDialog: {
        title: this.props.t('bitbox02Interact.confirmDate'),
        text: this.props.t('bitbox02Interact.confirmDateText'),
      } });
      apiPost('devices/bitbox02/' + this.props.deviceID + '/backups/create').then(({ success }) => {
        if (!success) {
          alertUser(this.props.t('bitbox02Wizard.createBackupFailed'), { asDialog: false });
        }
        this.setState({ creatingBackup: false, waitDialog: undefined });
      });
    });
  };

  private handleDeviceNameInput = (event: Event) => {
    const target = (event.target as HTMLInputElement);
    const value: string = target.value;
    this.setState({ deviceName: value });
  };

  private setDeviceName = (event: FormEvent) => {
    event.preventDefault();
    this.setState({
      waitDialog: { title: this.props.t('bitbox02Interact.confirmName') }
    }, () => {
      setDeviceName(this.props.deviceID, this.state.deviceName)
        .then(() => {
          this.setState(
            { waitDialog: undefined },
            () => this.setPassword(),
          );
        })
        .catch(result => {
          if (result.message) {
            alertUser(result.message, {
              asDialog: false,
              callback: () => this.setState({ waitDialog: undefined }),
            });
          }
        });
    });
  };

  private restoreFromMnemonic = () => {
    this.setState({ waitDialog: {
      title: this.props.t('bitbox02Interact.followInstructionsMnemonicTitle'),
      text: this.props.t('bitbox02Interact.followInstructionsMnemonic'),
    } });
    apiPost('devices/bitbox02/' + this.props.deviceID + '/restore-from-mnemonic').then(({ success }) => {
      if (!success) {
        alertUser(this.props.t('bitbox02Wizard.restoreFromMnemonic.failed'), { asDialog: false });
      } else {
        this.setState({
          appStatus: 'restoreFromMnemonic',
        });
      }
      this.setState({
        waitDialog: undefined,
      });
    });
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
            withBottomBar
            width="600px">
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
            withBottomBar
            width="670px">
            <ViewHeader title={t('bitbox02Wizard.pairing.title')}>
              { status === 'pairingFailed' ? (
                <Status type="warning">
                  {t('bitbox02Wizard.pairing.failed')}
                </Status>
              ) : (
                <p>{t('bitbox02Wizard.stepUnpaired.verify')}</p>
              )}
              { (attestationResult === false && status !== 'pairingFailed') && (
                <Status type="warning">
                  {t('bitbox02Wizard.attestationFailed')}
                </Status>
              )}
            </ViewHeader>
            <ViewContent fullWidth>
              { status !== 'pairingFailed' && (
                <pre>{hash}</pre>
              )}
            </ViewContent>
            <ViewButtons>
              {status !== 'pairingFailed' ? (
                deviceVerified ? (
                  <Button
                    primary
                    onClick={() => verifyChannelHash(deviceID, true)}>
                    {t('button.continue')}
                  </Button>
                ) : (
                  <PointToBitBox02 />
                )
              ) : null}
            </ViewButtons>
          </View>
        )}

        { (!unlockOnly && status === 'uninitialized' && appStatus === '') && (
          <View
            key="uninitialized-pairing"
            fullscreen
            textCenter
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
                <Column asCard>
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
                </Column>
                <Column asCard>
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
              width="600px">
              <ViewHeader title={t('bitbox02Wizard.stepCreate.title')}>
                {!sdCardInserted && (
                  <Status type="warning">
                    <span>{t('bitbox02Wizard.stepCreate.toastMicroSD')}</span>
                  </Status>
                )}
                <p>{t('bitbox02Wizard.stepCreate.description')}</p>
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
                  {t('bitbox02Wizard.stepCreate.buttonBack')}
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
            withBottomBar>
            <ViewHeader title={t('bitbox02Wizard.success.title')}>
              <p>{t('bitbox02Wizard.stepCreateSuccess.success')}</p>
            </ViewHeader>
            <ViewContent withIcon="success">
              <p>{t('bitbox02Wizard.stepCreateSuccess.removeMicroSD')}</p>
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
