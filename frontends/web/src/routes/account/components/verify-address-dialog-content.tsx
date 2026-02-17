// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { CopyableInput } from '@/components/copy/Copy';
import { QRCode } from '@/components/qrcode/qrcode';

type TProps = {
  address: string;
  uriPrefix: string;
  instruction?: string;
  qrSize?: number;
  instructionClassName?: string;
  qrWrapClassName?: string;
  showOnlyThisCoinWarning?: boolean;
  coinName?: string;
  warningClassName?: string;
};

export const VerifyAddressDialogContent = ({
  address,
  uriPrefix,
  instruction,
  qrSize,
  instructionClassName,
  qrWrapClassName,
  showOnlyThisCoinWarning,
  coinName,
  warningClassName,
}: TProps) => {
  const { t } = useTranslation();

  return (
    <>
      {showOnlyThisCoinWarning && coinName && (
        <p className={warningClassName}>
          <strong>
            {t('receive.onlyThisCoin.warning', { coinName })}
          </strong><br />
          {t('receive.onlyThisCoin.description')}
        </p>
      )}
      {instruction && <p className={instructionClassName}>{instruction}</p>}
      <div className={qrWrapClassName}>
        <QRCode size={qrSize} data={uriPrefix + address} />
      </div>
      <div className="m-bottom-half">
        <CopyableInput
          value={address}
          dataTestId="receive-address"
          flexibleHeight
        />
      </div>
    </>
  );
};
