/**
 * Copyright 2025 Shift Crypto AG
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
import { showMnemonic } from '@/api/bitbox02';
import { MultilineMarkup, SimpleMarkup } from '@/utils/markup';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { Main } from '@/components/layout';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button, Checkbox } from '@/components/forms';
import { PointToBitBox02 } from '@/components/icon';
import { Message } from '@/components/message/message';

const CONTENT_MIN_HEIGHT = 'min(56rem, 100vh)';

type TProps = {
  deviceID: string;
};

type TStatus = 'info' | 'progress' | 'success';

export const RecoveryWords = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<TStatus>('info');
  const [agree, setAgree] = useState<boolean>(false);

  const confirmShowWords = async () => {
    setStatus('progress');
    await showMnemonic(deviceID);
    navigate(-1);
  };

  const handleAbort = () => navigate(-1);

  if (status === 'progress') {
    return (
      <Main>
        <View
          key="progress"
          fullscreen
          minHeight={CONTENT_MIN_HEIGHT}
          verticallyCentered>
          <ViewHeader small title={t('backup.showMnemonic.title')} />
          <ViewContent>
            <Message type="warning">
              <SimpleMarkup tagName="span" markup={t('backup.showMnemonic.warning')}/>
            </Message>
            <p>
              <MultilineMarkup
                markup={t('backup.showMnemonic.description')}
                tagName="span"
                withBreaks />
            </p>
            <p>{t('bitbox02Interact.followInstructions')}</p>
            <UseDisableBackButton />
            <PointToBitBox02 />
          </ViewContent>
        </View>
      </Main>
    );
  }

  return (
    <View
      key="info"
      fullscreen
      minHeight={CONTENT_MIN_HEIGHT}
      verticallyCentered>
      <ViewHeader small title={t('backup.showMnemonic.title')} />
      <ViewContent>
        <Message type="warning">
          <SimpleMarkup tagName="span" markup={t('backup.showMnemonic.warning')}/>
        </Message>
        <p>
          <MultilineMarkup
            markup={t('backup.showMnemonic.description')}
            tagName="span"
            withBreaks />
          <br />
          <Checkbox
            checked={agree}
            id="confirmationCheckbox"
            label={t('backup.showMnemonic.checkboxLabel')}
            onChange={e => setAgree(e.target.checked)} />
        </p>
      </ViewContent>
      <ViewButtons>
        <Button disabled={!agree} primary onClick={confirmShowWords}>
          {t('button.next')}
        </Button>
        <Button secondary onClick={handleAbort}>
          {t('dialog.cancel')}
        </Button>
      </ViewButtons>
    </View>
  );
};

