// SPDX-License-Identifier: Apache-2.0

import { Component } from 'react';
import { AppUpgradeRequired } from '../../../components/appupgraderequired';
import { apiGet } from '../../../utils/request';
import { apiWebsocket } from '../../../utils/websocket';
import Unlock from './unlock';
import Bootloader from './upgrade/bootloader';
import RequireUpgrade from './upgrade/require_upgrade';
import Goal from './setup/goal';
import { SecurityInformation } from './setup/security-information';
import SeedCreateNew from './setup/seed-create-new';
import SeedRestore from './setup/seed-restore';
import { Initialize } from './setup/initialize';
import Success from './setup/success';
import Settings from './settings/settings';
import { withTranslation } from 'react-i18next';
import { AppContext } from '../../../contexts/AppContext';

const DeviceStatus = Object.freeze({
  BOOTLOADER: 'bootloader',
  INITIALIZED: 'initialized',
  UNINITIALIZED: 'uninitialized',
  LOGGED_IN: 'logged_in',
  SEEDED: 'seeded',
  REQUIRE_FIRMWARE_UPGRADE: 'require_firmware_upgrade',
  REQUIRE_APP_UPGRADE: 'require_app_upgrade'
});

const GOAL = Object.freeze({
  CREATE: 'create',
  RESTORE: 'restore'
});

class Device extends Component {
  static contextType = AppContext;

  state = {
    firmwareVersion: null,
    deviceStatus: '',
    goal: '',
    success: null,
  };

  componentDidMount() {
    this.onDeviceStatusChanged();
    this.unsubscribe = apiWebsocket(({ type, data, deviceID }) => {
      if (type === 'device' && data === 'statusChanged' && deviceID === this.getDeviceID()) {
        this.onDeviceStatusChanged();
      }
    });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  onDeviceStatusChanged = () => {
    apiGet('devices/' + this.props.deviceID + '/status').then(deviceStatus => {
      this.setState({ deviceStatus });
    });
  };

  getDeviceID() {
    return this.props.deviceID || null;
  }

  handleCreate = () => {
    this.setState({ goal: GOAL.CREATE });
  };

  handleRestore = () => {
    this.setState({ goal: GOAL.RESTORE });
  };

  handleBack = () => {
    this.setState({ goal: null });
  };

  handleSuccess = () => {
    this.setState({ success: true });
  };

  render() {
    const {
      deviceID,
    } = this.props;
    const {
      deviceStatus,
      goal,
      success,
    } = this.state;
    if (!deviceStatus) {
      return null;
    }
    if (success) {
      return <Success goal={goal} handleHideSuccess={() => this.setState({ success: null })} />;
    }
    switch (deviceStatus) {
    case DeviceStatus.BOOTLOADER:
      return <Bootloader deviceID={deviceID} />;
    case DeviceStatus.REQUIRE_FIRMWARE_UPGRADE:
      return <RequireUpgrade deviceID={deviceID} />;
    case DeviceStatus.REQUIRE_APP_UPGRADE:
      return <AppUpgradeRequired />;
    case DeviceStatus.INITIALIZED:
      return <Unlock deviceID={deviceID} />;
    case DeviceStatus.UNINITIALIZED:
      if (!goal) {
        return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} />;
      }
      return (
        <SecurityInformation goal={goal} goBack={this.handleBack}>
          <Initialize goBack={this.handleBack} deviceID={deviceID} />
        </SecurityInformation>
      );
    case DeviceStatus.LOGGED_IN:
      switch (goal) {
      case GOAL.CREATE:
        return (
          <SeedCreateNew
            goBack={this.handleBack}
            onSuccess={this.handleSuccess}
            deviceID={deviceID}
          />
        );
      case GOAL.RESTORE:
        return (
          <SeedRestore
            goBack={this.handleBack}
            onSuccess={this.handleSuccess}
            deviceID={deviceID}
          />
        );
      default:
        return <Goal onCreate={this.handleCreate} onRestore={this.handleRestore} />;
      }
    case DeviceStatus.SEEDED:
      return <Settings deviceID={deviceID} />;
    default:
      return null;
    }
  }
}

export default withTranslation()(Device);
