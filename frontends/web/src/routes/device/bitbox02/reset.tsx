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

import { ChangeEvent, Component } from 'react';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import { alertUser } from '../../../components/alert/Alert';
import { Dialog, DialogButtons } from '../../../components/dialog/dialog';
import { Button, Checkbox } from '../../../components/forms';
import { SettingsButton } from '../../../components/settingsButton/settingsButton';
import { WaitDialog } from '../../../components/wait-dialog/wait-dialog';

interface ResetProps {
    apiPrefix: string;
}

type Props = ResetProps & TranslateProps;

interface State {
    understand: boolean;
    isConfirming: boolean;
    activeDialog: boolean;
}

class Reset extends Component<Props, State> {
  public readonly state: State = {
    understand: false,
    isConfirming: false,
    activeDialog: false,
  };

  private reset = () => {
    this.setState({
      activeDialog: false,
      isConfirming: true,
    });
    apiPost(this.props.apiPrefix + '/reset').then(data => {
      this.abort();
      if (!data.success) {
        alertUser(this.props.t('reset.notReset'));
      }
    });
  };

  private handleUnderstandChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({ understand: e.target.checked });
  };

  private abort = () => {
    this.setState({
      understand: false,
      isConfirming: false,
      activeDialog: false,
    });
  };

  public render() {
    const { t } = this.props;
    const {
      understand,
      isConfirming,
      activeDialog,
    } = this.state;
    return (
      <div>
        <SettingsButton
          danger
          onClick={() => this.setState({ activeDialog: true })}>
          {t('reset.title')}
        </SettingsButton>
        {
          activeDialog && (
            <Dialog
              title={t('reset.title')}
              onClose={this.abort}
              disabledClose={isConfirming}
              small>
              <div className="columnsContainer half">
                <div className="columns">
                  <div className="column">
                    <p>{t('reset.description')}</p>
                    <div>
                      <Checkbox
                        id="reset_understand"
                        label={t('reset.understandBB02')}
                        checked={understand}
                        onChange={this.handleUnderstandChange} />
                    </div>
                  </div>
                </div>
              </div>
              <DialogButtons>
                <Button danger disabled={!understand} onClick={this.reset}>
                  {t('reset.title')}
                </Button>
              </DialogButtons>
            </Dialog>
          )
        }
        {
          isConfirming && (
            <WaitDialog
              title={t('reset.title')} >
              {t('bitbox02Interact.followInstructions')}
            </WaitDialog>
          )
        }
      </div>
    );
  }
}

const HOC = translate()(Reset);
export { HOC as Reset };
