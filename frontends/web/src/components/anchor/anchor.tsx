/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { ReactNode, SyntheticEvent } from 'react';
import { open } from '../../api/system';
import style from './anchor.module.css';
import useConfirm from '../../hooks/confirm';
import { useTranslation } from 'react-i18next';

type TProps = {
  children: ReactNode;
  className?: string;
  href: string;
  icon?: ReactNode;
  title?: string;
}

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

type TUseConfirm = [
    (title: string, message: string) => Promise<boolean>,
    React.FunctionComponent
];

export const A = ({
  href,
  icon,
  className,
  children,
  ...props
}: TProps) => {
  const { t } = useTranslation();
  const [ getConfirmation, Confirmation ]: TUseConfirm = useConfirm();

  const onReject = async (reason: string) => {
    if (reason.indexOf('Blocked') === -1) {
      return;
    }

    const status = await getConfirmation(t('blockedOpen.title'), t('blockedOpen.message'));
    if (status) {
      window.open(href, '_blank');
    }
  };

  return (
    <>
      <span
        className={`${style.link} ${className || ''}`}
        title={props.title || href}
        onClick={(e: SyntheticEvent) => {
          e.preventDefault();
          open(href).catch(onReject);
        }}
        tabIndex={0}
        {...props}>
        {icon ? icon : null}
        {children}
      </span>
      <Confirmation/>
    </>
  );
};
