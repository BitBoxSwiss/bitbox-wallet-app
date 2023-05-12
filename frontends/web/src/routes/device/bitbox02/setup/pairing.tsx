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

import { useTranslation } from 'react-i18next';
import { verifyChannelHash } from '../../../../api/bitbox02';
import { View, ViewButtons, ViewContent, ViewHeader } from '../../../../components/view/view';
import Status from '../../../../components/status/status';
import { PointToBitBox02 } from '../../../../components/icon';
import { Button } from '../../../../components/forms';

type Props = {
  attestation: boolean | null;
  deviceID: string;
  pairingFailed: boolean;
  hash: string | undefined;
  deviceVerified: boolean;
}

export const Pairing = ({
  attestation,
  deviceID,
  pairingFailed,
  hash,
  deviceVerified,
}: Props) => {
  const { t } = useTranslation();
  return (
    <View
      key="pairing"
      fullscreen
      textCenter
      verticallyCentered
      withBottomBar
      width="670px">
      <ViewHeader title={t('bitbox02Wizard.pairing.title')}>
        { (attestation === false && !pairingFailed) && (
          <Status key="attestation" type="warning">
            {t('bitbox02Wizard.attestationFailed')}
          </Status>
        )}
        { pairingFailed ? (
          <Status key="pairingFailed" type="warning">
            {t('bitbox02Wizard.pairing.failed')}
          </Status>
        ) : (
          <p>
            { deviceVerified
              ? t('bitbox02Wizard.pairing.paired')
              : t('bitbox02Wizard.pairing.unpaired') }
          </p>
        )}
      </ViewHeader>
      <ViewContent fullWidth>
        { !pairingFailed && (
          <>
            <pre>{hash}</pre>
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
