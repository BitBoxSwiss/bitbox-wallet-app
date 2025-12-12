// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkSDCard } from '@/api/bitbox02';
import { Button } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { BackButton } from '@/components/backbutton/backbutton';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';

type TProps = {
  deviceID: string;
  children: ReactNode;
};

const SDCardCheck = ({ deviceID, children }: TProps) => {
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
    <div>
      {!sdCardInserted ? (
        <View textCenter>
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
            <BackButton enableEsc>
              {t('button.back')}
            </BackButton>
          </ViewButtons>
        </View>
      ) : children}
    </div>
  );
};

export { SDCardCheck };
