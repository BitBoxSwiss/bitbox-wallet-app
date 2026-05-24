// SPDX-License-Identifier: Apache-2.0

import { type TReceiveAddress } from '@/api/account';
import { CopyAddressButton } from '@/components/copy/copy-address-button';
import { QRCode } from '@/components/qrcode/qrcode';
import { truncateDisplayAddress } from '@/utils/address';
import { useMediaQuery } from '@/hooks/mediaquery';
import style from './address-card.module.css';

type TProps = {
  currentAddress: TReceiveAddress;
  uriPrefix: string;
  isVerifying: boolean;
};

export const AddressCard = ({
  currentAddress,
  uriPrefix,
  isVerifying,
}: TProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={style.card}>
      <div className={`${style.qrWrap || ''} ${!isVerifying ? (style.blurred || '') : ''}`}>
        <QRCode data={uriPrefix + currentAddress.address} size={isMobile ? 128 : 240} tapToCopy={false} />
      </div>
      <div className={style.right}>
        <p className={style.address} data-testid="receive-address">
          {isVerifying ? currentAddress.displayAddress : truncateDisplayAddress(currentAddress.displayAddress)}
        </p>
        {isVerifying && <CopyAddressButton mode="copy" value={currentAddress.address} />}
      </div>
    </div>
  );
};
