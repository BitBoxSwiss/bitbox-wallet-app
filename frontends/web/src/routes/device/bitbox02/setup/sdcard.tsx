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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkSDCard, insertSDCard } from '../../../../api/bitbox02';
import { View, ViewHeader } from '../../../../components/view/view';
import { alertUser } from '../../../../components/alert/Alert';
import { Wait } from './wait';

type Props = {
  children: JSX.Element;
  deviceID: string;
};

export const WithSDCard = ({
  children,
  deviceID,
}: Props) => {
  const { t } = useTranslation();
  const [hasSDCard, setSDCard] = useState<boolean>();

  const ensureSDCard = useCallback(async () => {
    try {
      const sdCardInserted = await checkSDCard(deviceID);
      setSDCard(sdCardInserted);
      if (sdCardInserted) {
        return;
      }
      const result = await insertSDCard(deviceID);
      setSDCard(result.success);
      if (result.success) {
        return;
      }
      if (result.message) {
        alertUser(result.message, { asDialog: false });
      }
    } catch (error) {
      console.error(error);
    }
  }, [deviceID]);

  useEffect(() => {
    ensureSDCard();
  }, [ensureSDCard]);

  if (hasSDCard) {
    return children;
  }
  if (hasSDCard === undefined) {
    return (
      <View fullscreen textCenter verticallyCentered>
        <ViewHeader title="Checking microSD card" />
      </View>
    );
  }
  return (
    <Wait
      title={t('bitbox02Wizard.stepInsertSD.insertSDcardTitle')}
      text={t('bitbox02Wizard.stepInsertSD.insertSDCard')} />
  );
};
