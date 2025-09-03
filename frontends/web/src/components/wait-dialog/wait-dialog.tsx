/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2025 Shift Crypto AG
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

import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UseDisableBackButton } from '@/hooks/backbutton';
import style from '@/components/dialog/dialog.module.css';

type Props = {
    includeDefault?: boolean;
    title?: string;
    children?: React.ReactNode;
}

export const WaitDialog = ({
  includeDefault,
  title,
  children,
}: Props) => {
  const { t } = useTranslation();
  const overlay = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent) => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    e.preventDefault();
    e.stopPropagation();
  };

  const activate = () => {
    if (!overlay.current || !modal.current) {
      return;
    }
    // TODO: this component should use state instead of keeping ref to modify classList
    if (style.activeOverlay) {
      overlay.current.classList.add(style.activeOverlay);
    }
    if (style.activeModal) {
      modal.current.classList.add(style.activeModal);
    }
  };

  useEffect(() => {
    document.body.addEventListener('keydown', handleKeyDown);
    activate();

    return () => {
      document.body.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const defaultContent = (
    <div>
      <p className={style.confirmationLabel}>{t('confirm.info')}</p>
    </div>
  );

  const hasChildren = React.Children.toArray(children).length > 0;

  return (
    <div
      className={style.overlay}
      ref={overlay}
      style={{ zIndex: 10001 }}>
      <UseDisableBackButton />
      <div className={[style.modal, style.open].join(' ')} ref={modal}>
        {
          title && (
            <div className={style.header}>
              <h3 className={style.title}>{title}</h3>
            </div>
          )
        }
        <div className={style.contentContainer}>
          <div className={style.content}>
            { (hasChildren && includeDefault) ? defaultContent : null }
            { hasChildren ? (
              <div className="flex flex-column flex-start">
                {children}
              </div>
            ) : defaultContent }
          </div>
        </div>
      </div>
    </div>
  );
};
