// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import type { TKeystore } from '@/api/account';
import { isAmbiguousName, TAccountsByKeystore } from '@/routes/account/utils';
import { Badge } from '@/components/badge/badge';
import { USBSuccess } from '@/components/icon';
import style from './connected-keystore.module.css';

type Props = {
  accountsByKeystore: TAccountsByKeystore[];
  className?: string;
  connectedIconOnly?: boolean;
  keystore: TKeystore;
};

export const ConnectedKeystore = ({
  accountsByKeystore,
  className,
  connectedIconOnly,
  keystore,
}: Props) => {
  const { t } = useTranslation();
  const classNames = className ? `${style.keystore || ''} ${className}` : style.keystore;

  return (
    <span className={classNames}>
      <span className={style.keystoreName}>{keystore.name}</span>
      {isAmbiguousName(keystore.name, accountsByKeystore) ? (
        // Disambiguate accounts group by adding the fingerprint.
        // The most common case where this would happen is when adding accounts from the
        // same seed using different passphrases.
        <>
          {' '}
          <small>({keystore.rootFingerprint})</small>
        </>
      ) : null}
      {' '}
      <Badge
        className={`${keystore.connected ? style.connected || '' : style.disconnected || ''}`}
        icon={props => (
          <USBSuccess style={{
            width: 'min(0.9rem, 12px)',
            height: 'min(0.9rem, 12px)',
          }} {...props} />
        )}
        title={t('device.keystoreConnected')}
        type="success">
        {connectedIconOnly ? undefined : t('device.keystoreConnected')}
      </Badge>
    </span>
  );
};
