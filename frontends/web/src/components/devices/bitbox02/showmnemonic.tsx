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

import { Component, h, RenderableProps } from 'preact';
import { translate, TranslateProps } from '../../../decorators/translate';
import { apiPost } from '../../../utils/request';
import SimpleMarkup from '../../../utils/simplemarkup';
import { confirmation } from '../../confirm/Confirm';
import { SettingsButton } from '../../settingsButton/settingsButton';
import WaitDialog from '../../wait-dialog/wait-dialog';

interface ShowMnemonicProps {
    apiPrefix: string;
}

type Props = ShowMnemonicProps & TranslateProps;

interface State {
    inProgress: boolean;
}

class ShowMnemonic extends Component<Props, State> {
    public state = {
        inProgress: false,
    };

    private showMnemonic = () => {
        this.setState({ inProgress: true });
        apiPost(this.props.apiPrefix + '/show-mnemonic').then(() => {
            this.setState({ inProgress: false });
        });
    }

    private askShowMnemonic = () => {
        confirmation(this.props.t('backup.showMnemonic.description'), result => {
            if (result) {
                this.showMnemonic();
            }
        });

    }

    public render(
        { t }: RenderableProps<Props>,
        { inProgress,
        }: State) {
        return (
            <div>
                <SettingsButton
                    onClick={this.askShowMnemonic}>
                    {t('backup.showMnemonic.title')}
                </SettingsButton>
                { inProgress && (
                      <WaitDialog
                          title={t('backup.showMnemonic.title')}
                      >
                          <p>{
                              t('backup.showMnemonic.description').split('\n').map(line => (
                                  <span>
                                      <SimpleMarkup tagName="span" markup={line} /><br/>
                                  </span>
                              ))}
                          </p>
                          <p>{t('bitbox02Interact.followInstructions')}</p>
                      </WaitDialog>
                )}
            </div>
        );
    }
}

const HOC = translate<ShowMnemonicProps>()(ShowMnemonic);
export { HOC as ShowMnemonic };
