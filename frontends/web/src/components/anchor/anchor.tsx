// SPDX-License-Identifier: Apache-2.0

import { ReactNode, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@/api/system';
import { alertUser } from '@/components/alert/Alert';
import { runningInIOS } from '@/utils/env';
import style from './anchor.module.css';

type TProps = {
  children: ReactNode;
  className?: string;
  href: string;
  icon?: ReactNode;
  title?: string;
};

/**
 * Renders a link to an external URL or file, which will open in the native browser or application.
 * Use Link or ButtonLink component for internal links.
 *
 * @typedef {Object} LinkProps
 * @property {string} href - The link to the external URL or file path on the local file system.
 * @property {string} [icon] - (Optional) An icon associated with the link.
 * @property {string} [className] - (Optional) Additional CSS class names for styling the link.
 * @property {string} [title] - (Optional) A title used as tooltip for the link.
 *
 * @param {LinkProps} props - The props object containing properties for the Link component.
 */
export const A = ({
  href,
  icon,
  className,
  children,
  ...props
}: TProps) => {
  const { t } = useTranslation();

  return (
    <span
      className={`
        ${(runningInIOS() ? style.linkIos : style.link) || ''}
        ${className || ''}
      `}
      title={props.title || href}
      onClick={(e: SyntheticEvent) => {
        e.preventDefault();
        open(href)
          .then(response => {
            if (!response.success) {
              alertUser(response.errorMessage
                ? t('unknownError', { errorMessage: response.errorMessage })
                : t('genericError'));
            }
          })
          .catch(console.error);
      }}
      tabIndex={0}
      {...props}>
      {icon ? icon : null}
      {children}
    </span>
  );
};
