// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { PointToBitBox02 } from '@/components/icon';
import { Message } from '@/components/message/message';
import style from './verify-prompt.module.css';

type TProps = {
  isTesting: boolean;
};

export const VerifyPrompt = ({ isTesting }: TProps) => {
  const { t } = useTranslation();

  return (
    <div className={style.bb02}>
      <p className={style.continueText}>{t('receive.continueOnBitBox')}</p>
      {isTesting && (
        <Message type="warning">
          {t('receive.verifyTestnetWarning')}
        </Message>
      )}
      <PointToBitBox02 className={style.bb02Illustration} />
    </div>
  );
};
