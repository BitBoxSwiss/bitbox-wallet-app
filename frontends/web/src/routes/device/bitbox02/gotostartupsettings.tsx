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
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

interface GotoStartupSettingsProps {
    apiPrefix: string;
}

type Props = GotoStartupSettingsProps & TranslateProps;

interface State {
    isConfirming: boolean;
}

class GotoStartupSettings extends Component<Props, State> {
  public readonly state: State = {
    isConfirming: false,
  };

  private gotoStartupSettings = (): void => {
    this.setState({ isConfirming: true });
    apiPost(this.props.apiPrefix + '/goto-startup-settings').then(() => {
      this.setState({ isConfirming: false });
    });
  };

  public render() {
    const { t } = this.props;
    const { isConfirming } = this.state;
    return (
      <div>
        <SettingsButton
          onClick={this.gotoStartupSettings}>
          {t('bitbox02Settings.gotoStartupSettings.title')}
        </SettingsButton>
        {
          isConfirming && (
            <WaitDialog
              title={t('bitbox02Settings.gotoStartupSettings.title')} >
              {t('bitbox02Settings.gotoStartupSettings.description')}
            </WaitDialog>
          )
        }
      </div>
    );
  }
}

const HOC = translate()(GotoStartupSettings);
export { HOC as GotoStartupSettings };
