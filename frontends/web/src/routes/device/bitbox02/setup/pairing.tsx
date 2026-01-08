// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { channelHashChanged, getChannelHash, verifyChannelHash } from '@/api/bitbox02';
import { View, ViewButtons, ViewContent, ViewHeader } from '@/components/view/view';
import { Message } from '@/components/message/message';
import { PointToBitBox02 } from '@/components/icon';
import { Button } from '@/components/forms';
import style from './pairing.module.css';

type Props = {
  attestation: boolean | null | undefined;
  deviceID: string;
  pairingFailed: boolean;
};

export const Pairing = ({
  attestation,
  deviceID,
  pairingFailed,
}: Props) => {
  const { t } = useTranslation();
  const [hash, setHash] = useState('');
  const [deviceVerified, setDeviceVerified] = useState(false);

  const onChannelHashChanged = useCallback(() => {
    getChannelHash(deviceID).then(({ hash, deviceVerified }) => {
      setHash(hash);
      setDeviceVerified(deviceVerified);
    });
  }, [deviceID]);

  useEffect(onChannelHashChanged, [deviceID, onChannelHashChanged]);

  // subscribe to channeHashChanged, this needs to call onChannelHashChanged
  // as it is only a notification and does not actually pass the data from the backend
  useEffect(() => {
    // returns unsubscribe callback to unmount this component
    return channelHashChanged(deviceID, onChannelHashChanged);
  }, [deviceID, onChannelHashChanged]);

  return (
    <View
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="670px">
      <ViewHeader
        small
        title={t('bitbox02Wizard.pairing.title')}
      >
        { pairingFailed ? (
          <Message key="pairingFailed" type="warning">
            {t('bitbox02Wizard.pairing.failed')}
          </Message>
        ) : (
          <p>
            { deviceVerified
              ? t('bitbox02Wizard.pairing.paired')
              : t('bitbox02Wizard.pairing.unpaired') }
          </p>
        )}
      </ViewHeader>
      <ViewContent fullWidth>
        { (attestation === false && !pairingFailed) && (
          <Message type="warning" className="m-bottom-half">
            {t('bitbox02Wizard.attestationFailed')}
          </Message>
        )}
        { !pairingFailed && (
          <>
            <pre className={style.hash}>{hash}</pre>
            { !deviceVerified && <PointToBitBox02 /> }
          </>
        )}
      </ViewContent>
      <ViewButtons>
        { (!pairingFailed && deviceVerified) && (
          <Button
            primary
            onClick={() => verifyChannelHash(deviceID, true)}>
            {t('button.continue')}
          </Button>
        )}
      </ViewButtons>
    </View>
  );
};
