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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Button, Checkbox } from '@/components/forms';
import style from './checklist.module.css';

type Props = {
  onContinue: () => void;
}

export const ChecklistWalletCreate = ({ onContinue, }: Props) => {
  const { t } = useTranslation();
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [agree4, setAgree4] = useState(false);
  const [agree5, setAgree5] = useState(false);

  const handleContinue = () => {
    setAgree1(false);
    setAgree2(false);
    setAgree3(false);
    setAgree4(false);
    setAgree5(false);
    onContinue();
  };

  return (
    <form>
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar
        width="700px">
        <ViewHeader title={t('backup.create.title')}>
          <p>{t('bitbox02Wizard.stepBackup.createBackup')}</p>
        </ViewHeader>
        <ViewContent textAlign="left">
          <p>{t('bitbox02Wizard.stepBackup.beforeProceed')}</p>
          <Checkbox
            onChange={() => setAgree1(!agree1)}
            className={style.wizardCheckbox}
            id="agreement1"
            checked={agree1}
            label={t('bitbox02Wizard.backup.userConfirmation1')} />
          <Checkbox
            onChange={() => setAgree2(!agree2)}
            className={style.wizardCheckbox}
            id="agreement2"
            checked={agree2}
            label={t('bitbox02Wizard.backup.userConfirmation2')} />
          <Checkbox
            onChange={() => setAgree3(!agree3)}
            className={style.wizardCheckbox}
            id="agreement3"
            checked={agree3}
            label={t('bitbox02Wizard.backup.userConfirmation3')} />
          <Checkbox
            onChange={() => setAgree4(!agree4)}
            className={style.wizardCheckbox}
            id="agreement4"
            checked={agree4}
            label={t('bitbox02Wizard.backup.userConfirmation4')} />
          <Checkbox
            onChange={() => setAgree5(!agree5)}
            className={style.wizardCheckbox}
            id="agreement5"
            checked={agree5}
            label={t('bitbox02Wizard.backup.userConfirmation5')} />
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={handleContinue}
            disabled={!(agree1 && agree2 && agree3 && agree4 && agree5)}>
            {t('button.continue')}
          </Button>
        </ViewButtons>
      </View>
    </form>
  );
};

export const ChecklistWalletCreateMnemonic = ({ onContinue, }: Props) => {
  const { t } = useTranslation();
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agree3, setAgree3] = useState(false);
  const [agree4, setAgree4] = useState(false);
  const [agree5, setAgree5] = useState(false);

  const handleContinue = () => {
    setAgree1(false);
    setAgree2(false);
    setAgree3(false);
    setAgree4(false);
    setAgree5(false);
    onContinue();
  };

  return (
    <form>
      <View
        fullscreen
        textCenter
        verticallyCentered
        withBottomBar
        width="700px">
        <ViewHeader title={t('backup.create.title')}>
          <p>{t('bitbox02Wizard.stepBackup.createBackupMnemonic')}</p>
        </ViewHeader>
        <ViewContent textAlign="left">
          <p>{t('bitbox02Wizard.stepBackup.beforeProceed')}</p>
          <Checkbox
            onChange={() => setAgree1(!agree1)}
            className={style.wizardCheckbox}
            id="agreement1"
            checked={agree1}
            label={t('bitbox02Wizard.backup.userConfirmation1')} />
          <Checkbox
            onChange={() => setAgree2(!agree2)}
            className={style.wizardCheckbox}
            id="agreement2"
            checked={agree2}
            label={t('bitbox02Wizard.backup.userConfirmation2')} />
          <Checkbox
            onChange={() => setAgree3(!agree3)}
            className={style.wizardCheckbox}
            id="agreement3"
            checked={agree3}
            label={t('bitbox02Wizard.backup.userConfirmation3')} />
          <Checkbox
            onChange={() => setAgree4(!agree4)}
            className={style.wizardCheckbox}
            id="agreement4"
            checked={agree4}
            label={t('bitbox02Wizard.backup.userConfirmation4')} />
          <Checkbox
            onChange={() => setAgree5(!agree5)}
            className={style.wizardCheckbox}
            id="agreement5"
            checked={agree5}
            label={t('bitbox02Wizard.backup.userConfirmation5mnemonic')} />
        </ViewContent>
        <ViewButtons>
          <Button
            primary
            onClick={handleContinue}
            disabled={!(agree1 && agree2 && agree3 && agree4 && agree5)}>
            {t('button.continue')}
          </Button>
        </ViewButtons>
      </View>
    </form>
  );
};
