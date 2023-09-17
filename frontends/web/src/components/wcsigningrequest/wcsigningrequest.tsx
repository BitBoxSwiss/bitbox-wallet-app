/**
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

//STILL TODO...

import { useContext, useEffect } from 'react';
import { WCWeb3WalletContext } from '../../contexts/WCWeb3WalletContext';

export const WCSigningRequest = () => {
  const { web3wallet, isWalletInitialized } = useContext(WCWeb3WalletContext);

  useEffect(() => {
    if (isWalletInitialized) {
      web3wallet?.on('session_request', () => {
        console.log('Siging request...');
      });

      return () => {
        web3wallet?.off('session_request', () => {});
      };
    }
  }, [web3wallet, isWalletInitialized]);
  return (
    <></> // TODO: Dialog that pops up, trigerred by an incoming signing request.
  );
};
