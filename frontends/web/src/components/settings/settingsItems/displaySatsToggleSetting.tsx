import { Toggle } from '../../toggle/toggle';
import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';
import { useTranslation } from 'react-i18next';
import { useLoad } from '../../../hooks/api';
import { getConfig } from '../../../api/backend';
import { setConfig } from '../../../utils/config';
import { updateRatesConfig } from '../../rates/rates';
import { BtcUnit, setBtcUnit } from '../../../api/coins';
import { useEffect, useState } from 'react';
import { alertUser } from '../../alert/Alert';

export const DisplaySatsToggleSetting = () => {
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig);
  const [displayAsSAT, setDisplayAsSAT] = useState<boolean>();

  useEffect(() => {
    if (fetchedConfig) {
      setDisplayAsSAT(fetchedConfig.backend.btcUnit === 'sat');
      console.log({ fetchedConfig });
    }
  }, [fetchedConfig]);

  const handleToggleSatsUnit = async () => {
    const toggleDdisplayAsSAT = !displayAsSAT;
    const unit: BtcUnit = toggleDdisplayAsSAT ? 'sat' : 'default';
    setDisplayAsSAT(toggleDdisplayAsSAT);

    await setConfig({
      backend: { btcUnit: unit }
    });

    updateRatesConfig();

    const result = await setBtcUnit(unit);

    if (!result.success) {
      alertUser(t('genericError'));
    }
  };


  return (
    <>
      <SettingsItemContainer
        settingName={t('settings.expert.useSats')}
        secondaryText="Enable or disabled Satoshis."
        extraComponent={
          <>
            {displayAsSAT !== undefined ? <Toggle
              checked={displayAsSAT}
              onChange={handleToggleSatsUnit}
            /> : null}
          </>
        }
      />
    </>
  );
};
