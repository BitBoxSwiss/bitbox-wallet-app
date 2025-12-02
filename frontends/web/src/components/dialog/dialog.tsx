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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { UseBackButton } from '@/hooks/backbutton';
import { useEsc, useFocusTrap } from '@/hooks/keyboard';
import style from './dialog.module.css';

type TProps = {
  title?: string;
  small?: boolean;
  medium?: boolean;
  large?: boolean;
  slim?: boolean;
  centered?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  open: boolean;
};

export const Dialog = ({
  title,
  small,
  medium,
  large,
  slim,
  centered,
  onClose,
  children,
  open,
}: TProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'opening' | 'open' | 'closing'>('idle');
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(contentRef, status === 'open');

  /**
   * Deactivate (close) animation handler.
   * If fireOnClose = true, it means user action triggered the close,
   * so we call onClose(). If false, it means parent controlled it, so skip.
   */
  const deactivate = useCallback((fireOnClose: boolean) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    setStatus('closing');

    closeTimerRef.current = setTimeout(() => {
      setIsVisible(false);
      setStatus('idle');

      if (fireOnClose && onClose) {
        onClose();
      }
    }, 400); // match CSS transition

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [onClose]);

  // Handle external open state changes.
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setStatus('opening');
      const id = setTimeout(() => setStatus('open'), 20);
      return () => clearTimeout(id);
    } else if (isVisible) {
      // When parent closes it (open=false), skip firing onClose again.
      deactivate(false);
    }
  }, [open, isVisible, deactivate]);

  // ESC closes dialog (fires onClose)
  useEsc(() => {
    if (open && onClose) {
      deactivate(true);
    }
  });

  // Overlay click closes dialog (fires onClose)
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownTarget.current = e.target;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      mouseDownTarget.current === e.currentTarget
      && e.target === e.currentTarget
      && open
      && onClose
    ) {
      deactivate(true);
    }
    mouseDownTarget.current = null;
  };

  // Close button handler
  const handleCloseClick = useCallback(() => {
    if (open && onClose) {
      deactivate(true);
    }
  }, [deactivate, onClose, open]);

  // Back button handler (mobile)
  const closeHandler = useCallback(() => {
    deactivate(true);
    return false;
  }, [deactivate]);

  if (!isVisible) {
    return null;
  }

  const modalClass = `
    ${style.modal || ''}
    ${small && style.small || ''}
    ${medium && style.medium || ''}
    ${large && style.large || ''}
    ${(status === 'open' || status === 'opening') && style.open || ''}
  `.trim();

  const overlayClass = `
    ${style.overlay || ''}
    ${(status === 'opening' || status === 'open') && style.activeOverlay || ''}
    ${status === 'closing' && style.closingOverlay || ''}
  `.trim();

  const headerClass = `
    ${style.header || ''}
    ${centered && !onClose && style.centered || ''}
  `.trim();

  const contentClass = `
    ${style.contentContainer || ''}
    ${slim && style.slim || ''}
  `.trim();

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={overlayClass}
    >
      <UseBackButton handler={closeHandler} />
      <div className={modalClass}>
        {title && (
          <div className={headerClass}>
            <h3 className={style.title}>{title}</h3>
            {onClose && (
              <button className={style.closeButton} onClick={handleCloseClick} data-testid="close-button">
                <CloseXDark className="show-in-lightmode" />
                <CloseXWhite className="show-in-darkmode" />
              </button>
            )}
          </div>
        )}
        <div className={contentClass} ref={contentRef}>
          <div className={style.content}>{children}</div>
        </div>
      </div>
    </div>
  );
};

type DialogButtonsProps = {
  children: React.ReactNode;
};

/**
 * ### Container to place buttons in a dialog
 *
 * Example:
 * ```jsx
 *   <Dialog title={t('title')}>
 *       <p>{t('message')}</p>
 *       <DialogButtons>
 *           <Button primary onClick={aoppAPI.approve}>
 *               {t('button.continue')}
 *           </Button>
 *           <Button secondary onClick={aoppAPI.cancel}>
 *               {t('dialog.cancel')}
 *           </Button>
 *       </DialogButtons>
 *   </Dialog>
 * ```
 */
export const DialogButtons = ({ children }: DialogButtonsProps) => {
  return (
    <div className={style.dialogButtons}>{children}</div>
  );
};
