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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsItem } from '../settingsItem/settingsItem';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../../components/view/view';
import { Button, Checkbox } from '../../../../components/forms';
import { ChevronRightDark, PointToBitBox02, Warning } from '../../../../components/icon';
import { invokeBIP85 } from '../../../../api/bitbox02';
import { SimpleMarkup } from '../../../../utils/markup';
import { A } from '../../../../components/anchor/anchor';
import { Column, Grid } from '../../../../components/layout';
import { useDarkmode } from '../../../../hooks/darkmode';
import bip85Graphic from './assets/bip85-graphic.svg';
import bip85GraphicLight from './assets/bip85-graphic-light.svg';

type TProps = {
  deviceID: string;
  canBIP85: boolean;
}

type Status = 'idle' | 'info-what' | 'info-how' | 'info-recover' | 'info-security' | 'progress';

export const Bip85Setting = ({ deviceID, canBIP85 }: TProps) => {
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [status, setStatus] = useState<Status>('idle');
  const [disclaimer, setDisclaimer] = useState(false);

  if (!canBIP85) {
    return (
      <SettingsItem
        settingName={t('deviceSettings.expert.bip85.title')}
        secondaryText={t('deviceSettings.expert.bip85.description')}
        extraComponent={<Warning width={20} height={20} />}
        displayedValue={t('bitbox02Wizard.advanced.outOfDate')}
      />
    );
  }

  switch (status) {
  case 'info-what':
    return (
      <View
        key="bip85-info-what"
        fullscreen
        verticallyCentered>
        <ViewHeader title={t('deviceSettings.expert.bip85.what.title')} />
        <ViewContent minHeight="280px">
          <Grid>
            <Column>
              <p>
                {t('deviceSettings.expert.bip85.what.description')}
                <br />
                <A href="https://github.com/bitcoin/bips/blob/master/bip-0085.mediawiki">
                  {t('deviceSettings.expert.bip85.what.link')}
                </A>
                <br />
                <br />
              </p>
            </Column>
            <Column textCenter>
              <img
                src={isDarkMode ? bip85GraphicLight : bip85Graphic}
                style={{ maxWidth: '100%' }}
              />
            </Column>
          </Grid>
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={() => setStatus('info-how')}>
            {t('button.continue')}
          </Button>
          <Button
            secondary
            onClick={() => setStatus('idle')}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'info-how':
    return (
      <View
        key="bip85-info-how"
        fullscreen
        verticallyCentered>
        <ViewHeader title={t('deviceSettings.expert.bip85.how.title')} />
        <ViewContent minHeight="280px">
          <SimpleMarkup
            tagName="p"
            markup={t('deviceSettings.expert.bip85.how.description')} />
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={() => setStatus('info-recover')}>
            {t('button.continue')}
          </Button>
          <Button
            secondary
            onClick={() => setStatus('info-what')}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'info-recover':
    return (
      <View
        key="bip85-info-recover"
        fullscreen
        verticallyCentered>
        <ViewHeader title={t('deviceSettings.expert.bip85.recover.title')} />
        <ViewContent minHeight="280px">
          <SimpleMarkup
            tagName="p"
            markup={t('deviceSettings.expert.bip85.recover.description')} />
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={() => {
              setDisclaimer(false);
              setStatus('info-security');
            }}>
            {t('button.continue')}
          </Button>
          <Button
            secondary
            onClick={() => setStatus('info-how')}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'info-security':
    return (
      <View
        key="bip85-info-security"
        fullscreen
        verticallyCentered>
        <ViewHeader title={t('deviceSettings.expert.bip85.security.title')} />
        <ViewContent minHeight="280px">
          <p>
            {t('deviceSettings.expert.bip85.security.description')}
          </p>
          <Checkbox
            id="understood"
            onClick={(e) => setDisclaimer((e.target as HTMLInputElement).checked)}
          >
            {t('deviceSettings.expert.bip85.disclaimer')}
          </Checkbox>
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            disabled={!disclaimer}
            onClick={async () => {
              setStatus('progress');
              await invokeBIP85(deviceID);
              setStatus('idle');
            }}>
            {t('button.proceedOnBitBox')}
          </Button>
          <Button
            secondary
            onClick={() => setStatus('info-recover')}>
            {t('button.back')}
          </Button>
        </ViewButtons>
      </View>
    );
  case 'progress':
    return (
      <View
        key="bip85-progress"
        fullscreen
        textCenter
        verticallyCentered>
        <ViewHeader title={t('deviceSettings.expert.bip85.title')} />
        <ViewContent minHeight="280px">
          <PointToBitBox02 />
        </ViewContent>
        <ViewButtons>
          {/* Empty ViewButtons to avoid layout shift when changing between 'info' and 'progress' steps */}
        </ViewButtons>
      </View>
    );
  case 'idle':
    return (
      <SettingsItem
        onClick={() => setStatus('info-what')}
        settingName={t('deviceSettings.expert.bip85.title')}
        secondaryText={t('deviceSettings.expert.bip85.description')}
        extraComponent={<ChevronRightDark />}
      />
    );
  }
};
