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

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { TranslateProps } from '../../../decorators/translate';
import { View, ViewButtons, ViewHeader } from '../../../components/view/view';
import { Button, ButtonLink } from '../../../components/forms';
import { checkSDCard } from '../../../api/bitbox02';
import { useTranslation } from 'react-i18next';

type SDCardCheckProps = {
  deviceID: string;
  children: ReactNode;
}

type TProps = SDCardCheckProps & TranslateProps;

export const SDCardCheck = ({ deviceID, children }: TProps) => {
  const { t } = useTranslation();
  const [sdCardInserted, setSdCardInserted] = useState<boolean | undefined>();
  const check = useCallback(() => checkSDCard(deviceID).then(setSdCardInserted), [deviceID]);

  useEffect(() => {
    check();
  }, [check]);

  // pending check-sdcard request
  if (sdCardInserted === undefined) {
    return null;
  }

  return sdCardInserted ? (
    children
  ) : (
    <View
      dialog
      fullscreen
      verticallyCentered>
      <ViewHeader title="Check your device">
        <p>{t('backup.insert')}</p>
      </ViewHeader>
      <ViewButtons>
        <Button
          primary
          onClick={check}>
          {t('button.ok')}
        </Button>
        <ButtonLink
          transparent
          to={`/device/${deviceID}`}>
          {t('button.back')}
        </ButtonLink>
      </ViewButtons>
    </View>
  );
};
