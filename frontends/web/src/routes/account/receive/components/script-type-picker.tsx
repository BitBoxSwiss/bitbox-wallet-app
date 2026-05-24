// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { type ScriptType } from '@/api/account';
import { Radio } from '@/components/forms';
import { Message } from '@/components/message/message';
import style from './script-type-picker.module.css';

type TProps = {
  availableScriptTypes: ScriptType[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export const ScriptTypePicker = ({ availableScriptTypes, selectedIndex, onChange }: TProps) => {
  const { t } = useTranslation();

  return (
    <div className={style.scriptTypes}>
      <p className={style.navLabel}>{t('receive.changeScriptType')}</p>
      {availableScriptTypes.map((scriptType, i) => (
        <div key={scriptType}>
          <Radio
            checked={selectedIndex === i}
            id={`receive-${scriptType}`}
            name="scriptType"
            onChange={() => onChange(i)}
          >
            {t(`receive.scriptTypeName.${scriptType}`)}
            <span className={style.scriptTypeHint}>
              {t(`receive.scriptTypeHint.${scriptType}`)}
            </span>
          </Radio>
          {scriptType === 'p2tr' && selectedIndex === i && (
            <Message type="warning">
              {t('receive.taprootWarning')}
            </Message>
          )}
        </div>
      ))}
    </div>
  );
};
