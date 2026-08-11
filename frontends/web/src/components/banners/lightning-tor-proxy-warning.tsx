// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useConfig } from '@/contexts/ConfigProvider';
import { Status } from '@/components/status/status';

type TProps = {
  className?: string;
  dismissible?: boolean;
  hidden?: boolean;
};

export const LightningTorProxyWarning = ({
  className,
  dismissible = false,
  hidden = false,
}: TProps) => {
  const { t } = useTranslation();
  const { config } = useConfig();

  return (
    <Status
      className={className}
      dismissibleKey={dismissible ? 'lightning-tor-proxy-warning' : ''}
      hidden={hidden || !config?.backend.proxy.useProxy}
      type="warning">
      {t('lightning.torProxyWarning')}
    </Status>
  );
};
