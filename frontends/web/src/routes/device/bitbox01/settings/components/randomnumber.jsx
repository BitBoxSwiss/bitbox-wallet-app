/**
 * Copyright 2018 Shift Devices AG
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
import { withTranslation } from 'react-i18next';
import { Button } from '../../../../../components/forms';
import { apiPost } from '../../../../../utils/request';
import {
  DialogLegacy,
  DialogButtons,
} from '../../../../../components/dialog/dialog-legacy';
import { CopyableInput } from '../../../../../components/copy/Copy';
import { SettingsButton } from '../../../../../components/settingsButton/settingsButton';

class RandomNumber extends Component {
  constructor(props) {
    super(props);
    this.state = {
      active: false,
      number: '',
    };
  }

  getRandomNumber = () => {
    apiPost(this.props.apiPrefix + '/random-number').then((number) => {
      this.setState({
        active: true,
        number,
      });
    });
  };

  abort = () => {
    this.setState({
      active: false,
      number: undefined,
    });
  };

  render() {
    const { t } = this.props;
    const { number, active } = this.state;
    return (
      <div>
        <SettingsButton onClick={this.getRandomNumber}>
          {t('random.button')}
        </SettingsButton>
        {
          // @ts-ignore Object is possibly 'undefined'.
          active && number ? (
            <DialogLegacy title="Generate Random Number" onClose={this.abort}>
              <div className="columnsContainer half">
                <div className="columns">
                  <div className="column">
                    <p>
                      {t('random.description', {
                        // @ts-ignore
                        bits: number.length * 4,
                      })}
                    </p>
                    <CopyableInput value={number} flexibleHeight />
                  </div>
                </div>
              </div>
              <DialogButtons>
                <Button primary onClick={this.abort}>
                  {t('button.ok')}
                </Button>
              </DialogButtons>
            </DialogLegacy>
          ) : null
        }
      </div>
    );
  }
}

export default withTranslation()(RandomNumber);
