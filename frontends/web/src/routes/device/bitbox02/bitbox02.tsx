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
import { getStatus, TStatus } from '../../../api/bitbox02';
import { statusChanged } from '../../../api/devicessync';
import { UnsubscribeList, unsubscribe } from '../../../utils/subscriptions';
import { BB02Settings } from '../../settings/bb02-settings';

type Props = {
  deviceID: string;
  deviceIDs: string[];
  hasAccounts: boolean;
}

type State = {
  status: '' | TStatus;
}

export class BitBox02 extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      status: '',
    };
  }

  private unsubscribeList: UnsubscribeList = [];

  public componentDidMount() {
    const { deviceID } = this.props;
    this.onStatusChanged();
    this.unsubscribeList = [
      statusChanged(deviceID, this.onStatusChanged),
    ];
  }

  private onStatusChanged = () => {
    getStatus(this.props.deviceID).then(status => {
      this.setState({ status });
    });
  };

  public componentWillUnmount() {
    unsubscribe(this.unsubscribeList);
  }

  public render() {
    const { deviceID, hasAccounts, deviceIDs } = this.props;
    const {
      status,
    } = this.state;

    if (status !== 'initialized') {
      return null;
    }
    return <BB02Settings deviceID={deviceID} deviceIDs={deviceIDs} hasAccounts={hasAccounts} />;
  }
}
