/**
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
import * as accountAPI from '../../api/account';
import { translate, TranslateProps } from '../../decorators/translate';
import { Button } from '../forms';
import { WaitDialog } from '../wait-dialog/wait-dialog';

interface State {
    verifying: boolean;
}

interface VerifyAddressProps {
    accountCode: string;
    address: string;
    addressID: string;
}

type Props = VerifyAddressProps & TranslateProps;

class VerifyAddress extends Component<Props, State> {
  public readonly state: State = {
    verifying: false,
  };

  private verifyAddress = () => {
    this.setState({ verifying: true });
    accountAPI.verifyAddress(this.props.accountCode, this.props.addressID).then(() => {
      this.setState({ verifying: false });
    });
  };

  public render() {
    const { t, address } = this.props;
    const { verifying } = this.state;
    return (
      <div className="flex flex-column">
        <Button secondary onClick={this.verifyAddress}>
          {t('receive.verifyBitBox02')}
        </Button>
        { verifying ? (
          <WaitDialog title={t('receive.verifyBitBox02')}>
            { address }
          </WaitDialog>
        ) : null }
      </div>
    );
  }
}

const translateHOC = translate()(VerifyAddress);
export { translateHOC as VerifyAddress };
