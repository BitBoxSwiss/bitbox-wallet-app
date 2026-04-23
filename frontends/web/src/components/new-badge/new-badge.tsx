// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/badge/badge';
import { useLoad } from '@/hooks/api';
import { getConfig, setConfig } from '@/utils/config';

type TConfigKey = 'hasSeenMarketplaceNudge' | 'hasSeenSwapMarketTab' | 'hasSeenOtcMarketTab';

type TProps = {
  className?: string;
  configKey: TConfigKey;
  hideOnPathPrefix?: string;
  markAsSeen?: boolean;
  pathname?: string;
  testID?: string;
  type?: 'dot' | 'new';
};

export const NewBadge = ({
  className,
  configKey,
  hideOnPathPrefix,
  markAsSeen = false,
  pathname,
  testID,
  type = 'new',
}: TProps) => {
  const { t } = useTranslation();
  const config = useLoad(getConfig);
  const [showBadge, setShowBadge] = useState<boolean | undefined>(undefined);

  const persistAsSeen = useCallback(() => {
    if (showBadge === false) {
      return;
    }
    setShowBadge(false);
    setConfig({ frontend: { [configKey]: true } });
  }, [configKey, showBadge]);

  useEffect(() => {
    if (!config) {
      return;
    }
    const frontendConfig = config.frontend as Record<string, unknown> | undefined;
    const hasSeenBadge = Boolean(frontendConfig?.[configKey]);
    setShowBadge(currentShowBadge => (
      currentShowBadge === false ? false : !hasSeenBadge
    ));
  }, [config, configKey]);

  useEffect(() => {
    if (markAsSeen) {
      persistAsSeen();
    }
  }, [markAsSeen, persistAsSeen]);

  useEffect(() => {
    if (!hideOnPathPrefix || !pathname || !pathname.startsWith(hideOnPathPrefix)) {
      return;
    }
    persistAsSeen();
  }, [hideOnPathPrefix, pathname, persistAsSeen]);

  if (showBadge !== true) {
    return null;
  }

  if (type === 'dot') {
    return <span className={className} data-testid={testID} aria-hidden />;
  }

  return (
    <Badge className={className} data-testid={testID} type="info">
      {t('generic.new')}
    </Badge>
  );
};
