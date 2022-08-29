/**
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

import { FunctionComponent } from 'react';
import { IAccount } from '../../../api/account';
import { TDevices } from '../../../api/devices';
import { Receive as ReceiveBB02 } from './receive';
import { Receive as ReceiveBB01 } from './receive-bb01';

type Props = {
  accounts: IAccount[];
  code: string;
  deviceIDs: string[];
  devices: TDevices;
};

export const Receive: FunctionComponent<Props> = props => {
  const {
    devices,
    deviceIDs,
  } = props;
  const deviceID = deviceIDs[0];
  const device = deviceIDs.length ? devices[deviceID] : undefined;
  switch (device) {
  case 'bitbox':
    return (
      <ReceiveBB01
        deviceID={deviceID}
        {...props} />
    );
  case 'bitbox02':
  default: // software keystore
    return (
      <ReceiveBB02
        deviceID={deviceID}
        {...props} />
    );
  }
};
