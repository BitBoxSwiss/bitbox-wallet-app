
import { BitBox02StylizedDark, BitBox02StylizedLight } from '@/components/icon';

import { useTranslation } from 'react-i18next';
import * as bitbox02BootloaderAPI from '@/api/bitbox02bootloader';
import { useLoad, useSync } from '@/hooks/api';
import { useDarkmode } from '@/hooks/darkmode';
import { Button } from '@/components/forms';
import styles from './styles.module.css';
import { useState } from 'react';


type TProps = {
    deviceID: string;
  }

export const FreshInstall = ({ deviceID }: TProps) => {
  const { t } = useTranslation();
  const [fadeOut, setFadeout] = useState(false);
  const [successInstall, setSuccessInstal] = useState(false);


  //   const status = {
  //     upgrading: true,
  //     errMsg: undefined,
  //     progress: 0.3,
  //     upgradeSuccessful: false
  //   };



  const status = useSync(
    () => bitbox02BootloaderAPI.getStatus(deviceID),
    bitbox02BootloaderAPI.syncStatus(deviceID),
  );

  //   useEffect(() => {
  //     if (status?.upgradeSuccessful) {
  //       //Hides div2, div3.
  //       setSuccessInstal(true);
  //       //Fly in div1 (bitbox div)


  //     }
  //   }, [status?.upgradeSuccessful]);



  const versionInfo = useLoad(() => bitbox02BootloaderAPI.getVersionInfo(deviceID));

  if (versionInfo === undefined) {
    return null;
  }

  return (
    <div className={styles.freshinstallContainer}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div className={`${styles.fadeDiv} 
        ${successInstall ? styles.gone : styles.div2}
        `}>
          <h2>Your bitcoin journey starts now</h2>
          <p>Thank you for choosing the BitBox02 hardware wallet.</p>
        </div>
        <div style={{ marginTop: 48 }}>
          {status?.upgrading ? <InProgress status={status} versionInfo={versionInfo} /> :
            <>
              <div className={
                `
          ${styles.fadeDiv} 
        ${fadeOut ? styles.gone : styles.div3}
        `}>
                <p>To get started, install the latest firmware onto your device</p>
                <Button
                  style={{ marginTop: 32 }}
                  primary
                  onClick={async () => {
                    setFadeout(true);
                    setTimeout(async() => {
                      setSuccessInstal(true);
                    }, 600);
                  }}>
                  {t('bootloader.button', { context: (versionInfo.erased ? 'install' : '') })}
                </Button>
                <div>
                  {t('bb02Bootloader.orientation')}&nbsp;
                  <Button
                    onClick={() => bitbox02BootloaderAPI.screenRotate(deviceID)}
                    style={{ height: 'auto', padding: 0, textDecoration: 'underline' }}
                    transparent>
                    {t('bb02Bootloader.flipscreen')}
                  </Button>
                </div>

              </div>
            </>}
        </div>
      </div>
      <div className={`${styles.fadeDiv} ${styles.div1} ${successInstall ? styles.flyIn : styles.bitbox02}`}>
        <BitBox />
      </div>
    </div>
  );
};

const BitBox = () => {
  const { isDarkMode } = useDarkmode();
  return (<>
    { isDarkMode
      ? (<BitBox02StylizedLight/>)
      : (<BitBox02StylizedDark />)
    }
  </>);
};

const InProgress = ({ status, versionInfo }: { status: bitbox02BootloaderAPI.TStatus, versionInfo: any }) => {
  const value = Math.round(status.progress * 100);
  const { t } = useTranslation();
  return (
    <>

      { versionInfo.additionalUpgradeFollows ? (
        <>
          <p>{t('bb02Bootloader.additionalUpgradeFollows1')}</p>
          <p>{t('bb02Bootloader.additionalUpgradeFollows2')}</p>
        </>
      ) : null }
      <progress value={value} max="100">{value}%</progress>
      <p style={{ marginBottom: 0 }}>
        {t('bootloader.progress', {
          progress: value.toString(),
          context: (versionInfo.erased ? 'install' : ''),
        })}
      </p>
    </>
  );
};