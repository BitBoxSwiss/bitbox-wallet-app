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

import { useTranslation } from 'react-i18next';
import { View, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Column, ColumnButtons, Grid } from '../../../../components/layout';
import { Button } from '../../../../components/forms';
import { Info } from '../../../../components/icon';

type Props = {
  onSelectSetup: (option: 'create-wallet' | 'restore-sdcard' | 'restore-mnemonic') => void;
}

export const SetupOptions = ({ onSelectSetup }: Props) => {
  const { t } = useTranslation();
  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="950px">
      <ViewHeader title={t('bitbox02Wizard.stepUninitialized.title')}>
        <p>
          <Info style={{ marginRight: '.5em', verticalAlign: 'text-bottom', height: '1.2em' }} />
          {t('bitbox02Wizard.initialize.tip')}
        </p>
      </ViewHeader>
      <ViewContent>
        <Grid>
          <Column asCard className="m-bottom-default">
            <h3 className="title">
              {t('button.create')}
            </h3>
            <p>
              {t('bitbox02Wizard.stepUninitialized.create')}
            </p>
            <ColumnButtons>
              <Button primary onClick={() => onSelectSetup('create-wallet')}>
                {t('seed.create')}
              </Button>
            </ColumnButtons>
          </Column>
          <Column asCard className="m-bottom-default">
            <h3 className="title">
              {t('button.restore')}
            </h3>
            <p>
              {t('bitbox02Wizard.stepUninitialized.restore')}
            </p>
            <ColumnButtons>
              <Button secondary onClick={() => onSelectSetup('restore-sdcard')}>
                {t('bitbox02Wizard.stepUninitialized.restoreMicroSD')}
              </Button>
              <Button secondary onClick={() => onSelectSetup('restore-mnemonic')}>
                {t('bitbox02Wizard.stepUninitialized.restoreMnemonic')}
              </Button>
            </ColumnButtons>
          </Column>
        </Grid>
      </ViewContent>
    </View>
  );
};
