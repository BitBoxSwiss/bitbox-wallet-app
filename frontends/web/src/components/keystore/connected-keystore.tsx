/**
 * Copyright 2025 Shift Crypto AG
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
      {keystore.connected && (
        <>
          {' '}
          <Badge
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
        </>
      )}
    </span>
  );
};
