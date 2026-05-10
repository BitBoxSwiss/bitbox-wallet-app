// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { Checked, Copy } from '@/components/icon/icon';
import style from './copy-address-button.module.css';

type TProps =
  | { mode: 'copy'; value: string; onClick?: never; className?: string }
  | { mode: 'action'; onClick: () => void; value?: never; className?: string };

export const CopyAddressButton = (props: TProps) => {
  const { mode, className } = props;
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleClick = () => {
    if (mode === 'action') {
      props.onClick();
      return;
    }
    navigator.clipboard.writeText(props.value);
    setCopied(true);
  };

  return (
    <Button
      transparent
      inline
      className={`${style.copyBtn || ''} ${className || ''}`.trim()}
      onClick={handleClick}
    >
      <span className={style.label}>
        {copied ? <Checked className={style.icon} /> : <Copy className={style.icon} />}
        {t('button.copyAddress')}
      </span>
    </Button>
  );
};
