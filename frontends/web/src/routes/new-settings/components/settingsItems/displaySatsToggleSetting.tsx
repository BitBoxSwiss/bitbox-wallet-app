import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toggle } from '../../../../components/toggle/toggle';
import { SettingsItemContainer } from '../settingsItemContainer/settingsItemContainer';
import { useLoad } from '../../../../hooks/api';
import { getConfig } from '../../../../api/backend';
import { setConfig } from '../../../../utils/config';
import { updateRatesConfig } from '../../../../components/rates/rates';
import { BtcUnit, setBtcUnit } from '../../../../api/coins';
import { alertUser } from '../../../../components/alert/Alert';

export const DisplaySatsToggleSetting = () => {
  const { t } = useTranslation();
  const fetchedConfig = useLoad(getConfig);
  const [displayAsSAT, setDisplayAsSAT] = useState<boolean>();

  useEffect(() => {
    if (fetchedConfig) {
      setDisplayAsSAT(fetchedConfig.backend.btcUnit === 'sat');
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
        secondaryText="Enable or disable Satoshis."
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
