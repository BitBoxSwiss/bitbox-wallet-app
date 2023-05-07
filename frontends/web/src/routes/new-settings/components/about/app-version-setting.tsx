import { useLoad } from '../../../../hooks/api';
import { useTranslation } from 'react-i18next';
import { getUpdate, getVersion } from '../../../../api/version';
import { SettingsItem } from '../settingsItem/settingsItem';
import { Checked, RedDot } from '../../../../components/icon';
import styles from './app-version-setting.module.css';

export const AppVersion = () => {
  const { t } = useTranslation();

  const version = useLoad(getVersion);
  const update = useLoad(getUpdate);

  const secondaryText = !!update ? // app is out-dated
    (<>
      {t('settings.info.out-of-date')}
    </>) :
    (<>
      {t('settings.info.up-to-date')}
    </>);
  const icon = !!update ? <RedDot width={18} height={18} /> : <Checked />;
  const versionNumber = <p className={styles.version}>{!!version ? version : '-'}</p>;
  const versionComponent = <div className={styles.versionContainer}>{versionNumber}{icon}</div>;

  return (
    <SettingsItem settingName="App version" secondaryText={secondaryText} extraComponent={versionComponent} />
  );
};
