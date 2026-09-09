// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkSDCard } from '@/api/bitbox02';
import { Button } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { DesktopBackButton } from '@/components/backbutton/backbutton';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';

type TProps = {
  deviceID: string;
  children: ReactNode;
};

export const SDCardCheck = ({ deviceID, children }: TProps) => {
  const { t } = useTranslation();
  const [sdCardInserted, setSdCardInserted] = useState<boolean | undefined>();
  const check = useCallback(() => checkSDCard(deviceID).then(setSdCardInserted), [deviceID]);

  useEffect(() => {
    check();
  }, [check]);

  // pending check-sdcard request
  if (sdCardInserted === undefined) {
    return <HorizontallyCenteredSpinner />;
  }

  return (
    !sdCardInserted
      ? (
        <View fitContent textCenter>
          <ViewHeader title={t('bitbox02Wizard.stepInsertSD.insertSDcardTitle')}>
            {t('bitbox02Wizard.stepInsertSD.insertSDCardToSeeBackups')}
          </ViewHeader>
          <ViewContent minHeight="280px">
            <PointToBitBox02 />
          </ViewContent>
          <ViewButtons>
            <Button
              primary
              onClick={check}>
              {t('button.ok')}
            </Button>
            <DesktopBackButton enableEsc>
              {t('button.back')}
            </DesktopBackButton>
          </ViewButtons>
        </View>
      )
      : children
  );
};
