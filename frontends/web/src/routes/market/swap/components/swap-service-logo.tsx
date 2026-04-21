// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { getSwapProviderMetadata, normalizeProviderName } from './swap-provider-metadata';

type TProps = {
  className?: string;
  name: string;
};

export const SwapServiceLogo = ({
  className,
  name,
}: TProps) => {
  const { t } = useTranslation();
  const normalizedName = normalizeProviderName(name);
  const { logo } = getSwapProviderMetadata(name);
  if (logo) {
    return (
      <img alt={t('logo.label', { name: normalizedName })} className={className} src={logo} style={{ width: 19, height: 19 }} />
    );
  }
  return (
    <span
      aria-label={t('logo.placeholderLabel', { name: normalizedName || t('generic.unknown') })}
      className={className}
      style={{
        alignItems: 'center',
        border: '1px solid currentColor',
        borderRadius: 999,
        display: 'inline-flex',
        fontSize: 12,
        height: 19,
        justifyContent: 'center',
        width: 19,
      }}>
      ?
    </span>
  );
};
