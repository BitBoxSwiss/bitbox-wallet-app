// SPDX-License-Identifier: Apache-2.0

import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TConfigFrontend } from '@/api/config';
import { useConfig } from '@/contexts/ConfigProvider';
import { useMountedRef } from '@/hooks/mount';
import { Button } from '@/components/forms';
import { Message } from '@/components/message/message';
import { TermsLayout } from './terms-layout';

type TDisclaimerKey = Extract<keyof TConfigFrontend, `skip${string}Disclaimer`>;

export type TTermsProps = {
  readOnly?: boolean;
  onContinue?: () => void;
};

type TProps = TTermsProps & {
  children: ReactNode;
  configKey: TDisclaimerKey;
  testId?: string;
};

export const Terms = ({ children, configKey, readOnly = false, onContinue, testId }: TProps) => {
  const { t } = useTranslation();
  const { config, setConfig } = useConfig();
  const mounted = useMountedRef();
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const accept = async () => {
    if (pending.current || !config) {
      return;
    }
    pending.current = true;
    setSaving(true);
    setFailed(false);
    try {
      await setConfig({ frontend: { [configKey]: true } });
    } catch {
      if (mounted.current) {
        setFailed(true);
      }
      return;
    } finally {
      pending.current = false;
      if (mounted.current) {
        setSaving(false);
      }
    }
    if (mounted.current) {
      onContinue?.();
    }
  };

  return (
    <TermsLayout
      readOnly={readOnly}
      error={failed && <Message type="error">{t('genericError')}</Message>}
      buttons={(
        <Button primary disabled={saving || !config} data-testid={testId} onClick={accept}>
          {t('buy.info.continue')}
        </Button>
      )}>
      {children}
    </TermsLayout>
  );
};
