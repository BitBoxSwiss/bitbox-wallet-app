/**
 * Copyright 2021-2024 Shift Crypto AG
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
import { useTranslation } from 'react-i18next';
import { checkSDCard } from '@/api/bitbox02';
import { Dialog, DialogButtons } from '@/components/dialog/dialog';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { HorizontallyCenteredSpinner } from '@/components/spinner/SpinnerAnimation';

type TProps = {
  deviceID: string;
  children: ReactNode;
}

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
      {!sdCardInserted ?
        <Dialog open={!sdCardInserted} title="Check your device" small>
          <div className="columnsContainer half">
            <div className="columns">
              <div className="column">
                <p>{t('backup.insert')}</p>
              </div>
            </div>
          </div>
          <DialogButtons>
            <Button
              primary
              onClick={check}>
              {t('button.ok')}
            </Button>
            <BackButton>
              {t('button.back')}
            </BackButton>
          </DialogButtons>
        </Dialog> : children}
    </div>
  );
};

export { SDCardCheck };
