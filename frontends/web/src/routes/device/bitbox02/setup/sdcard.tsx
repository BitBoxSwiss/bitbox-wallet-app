// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkSDCard, insertSDCard, errUserAbort } from '@/api/bitbox02';
import { View, ViewHeader } from '@/components/view/view';
import { alertUser } from '@/components/alert/Alert';
import { Wait } from './wait';

type Props = {
  children: JSX.Element;
  deviceID: string;
  onAbort: () => void;
};

export const WithSDCard = ({
  children,
  deviceID,
  onAbort
}: Props) => {
  const { t } = useTranslation();
  const [hasSDCard, setSDCard] = useState<boolean>();
  const hasCheckedSDCard = useRef(false);

  const ensureSDCard = useCallback(async () => {
    if (hasCheckedSDCard.current) {
      return;
    }
    hasCheckedSDCard.current = true;
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

      // User pressed “Abort” on the device
      if (result.code === errUserAbort) {
        alertUser(t('backup.restore.error.e104'), { asDialog: false, callback: onAbort });
      } else if (result.message) {
        // Other errors:
        alertUser(result.message, { asDialog: false, callback: onAbort });
      }
    } catch (error) {
      console.error(error);
    }
  }, [deviceID, onAbort, t]);

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
