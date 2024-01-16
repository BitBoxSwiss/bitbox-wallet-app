/**
 * Copyright 2024 Shift Crypto AG
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

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AccountCode, connectKeystore } from '../api/account';
import { KeystoreContext } from './KeystoreContext';
import { cancelConnectKeystore, subscribeKeystores } from '../api/keystores';

type TProps = {
  children: ReactNode;
}

type TKeystoreWait = {
  accountCode: AccountCode;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export const KeystoreProvider = ({ children }: TProps) => {
  const [keystoreWait, setKeystoreWait] = useState<TKeystoreWait>();

  const requestKeystore = async (accountCode: AccountCode, onSuccess?: () => void, onCancel?: () => void) => {
    if (!accountCode) {
      return;
    }
    connect(accountCode, onSuccess, onCancel);
  };

  const cancelRequest = () => {
    cancelConnectKeystore();
    keystoreWait?.onCancel && keystoreWait.onCancel();
    setKeystoreWait(undefined);
  };

  const connect = useCallback(async (accountCode: AccountCode, onSuccess?: () => void, onCancel?: () => void) => {
    // If there is no connected keystore, `connectKeystore` waits until a keystore is connected.
    // If there is a connected keystore, it returns immediately, with success if it is
    // the expected one, or with a 'wrongKeystore' error otherwise.
    // In the last case, we setup a keystoreWait, that will cause a subscription to the
    // keystore event, and a new call to `connect` when there is a change in the keystores.
    // If a `cancelConnectKeystore` is invoked, `connectKeystore` will return with success = false
    // and without errorCode.
    const connectResult = await connectKeystore(accountCode);
    if (!connectResult.success) {
      if (connectResult?.errorCode === 'wrongKeystore') {
        if (keystoreWait?.accountCode !== accountCode) {
          setKeystoreWait({ accountCode, onSuccess, onCancel });
        }
      }
      if (connectResult?.errorCode === 'userAbort' && onCancel) {
        onCancel();
      }
    } else {
      if (onSuccess) {
        onSuccess();
      }
      setKeystoreWait(undefined);
    }
  }, [keystoreWait]);

  useEffect(() => {
    if (!keystoreWait) {
      return;
    }
    return subscribeKeystores((keystores) => {
      // If the keystores list is empty, we call a new connect to check
      // the next keystore that will be connected.
      if (!keystores.length) {
        connect(keystoreWait.accountCode, keystoreWait.onSuccess);
      }
    });
  }, [keystoreWait, connect]);

  return (
    <KeystoreContext.Provider
      value={{
        requestKeystore,
        cancelRequest,
      }}
    >
      {children}
    </KeystoreContext.Provider>
  );
};
