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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button, Checkbox } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon';
import { invokeBIP85 } from '@/api/bitbox02';
import { SimpleMarkup } from '@/utils/markup';
import { A } from '@/components/anchor/anchor';
import { Column, Grid } from '@/components/layout';
import { useDarkmode } from '@/hooks/darkmode';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { BackButton } from '@/components/backbutton/backbutton';
import bip85Graphic from './assets/bip85-graphic.svg';
import bip85GraphicLight from './assets/bip85-graphic-light.svg';

type Status = 'info-what' | 'info-how' | 'info-recover' | 'info-security' | 'progress';

type TProps = {
  deviceID: string;
};

export const Bip85 = ({
  deviceID,
}: TProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDarkMode } = useDarkmode();
  const [status, setStatus] = useState<Status>('info-what');
  const [disclaimer, setDisclaimer] = useState(false);

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
                style={{ height: 'auto', width: '100%' }}
                width="320"
                height="147"
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
          <BackButton>
            {t('button.back')}
          </BackButton>
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
              navigate(-1);
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
        <UseDisableBackButton />
        <ViewHeader title={t('deviceSettings.expert.bip85.title')} />
        <ViewContent minHeight="280px">
          <PointToBitBox02 />
        </ViewContent>
        <ViewButtons>
          {/* Empty ViewButtons to avoid layout shift when changing between 'info' and 'progress' steps */}
        </ViewButtons>
      </View>
    );
  }
};
