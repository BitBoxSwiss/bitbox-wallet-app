// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { UseBackButton } from '@/hooks/backbutton';
import { useEsc, useFocusTrap } from '@/hooks/keyboard';
import { useMediaQuery } from '@/hooks/mediaquery';
import { MobileDialog } from './mobile-dialog';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMobile = useMediaQuery('(max-width: 768px)');

  useFocusTrap(modalRef, status === 'open');

  // create a stable ref so deactivate() doesn't recreate
  // on every parent re-render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

      if (fireOnClose && onCloseRef.current) {
        onCloseRef.current();
      }
    }, 400); // match CSS transition

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

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
  const handleBackButton = useCallback(() => {
    deactivate(true);
    return false;
  }, [deactivate]);

  // Drag close handler (mobile bottom sheet)
  const handleDragClose = useCallback(() => {
    deactivate(true);
  }, [deactivate]);

  if (!isVisible) {
    return null;
  }

  const modalClass = `
    ${style.modal || ''}
    ${small && style.small || ''}
    ${medium && style.medium || ''}
    ${large && style.large || ''}
    ${status === 'open' && style.open || ''}
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

  const dialogContent = (
    <>
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
      <div className={contentClass} ref={contentContainerRef}>
        <div className={style.content}>{children}</div>
      </div>
    </>
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={overlayClass}
    >
      <UseBackButton handler={handleBackButton} />
      {isMobile ? (
        <MobileDialog
          status={status}
          canClose={!!onClose}
          onDragClose={handleDragClose}
          modalClass={modalClass}
          modalRef={modalRef}
          contentContainerRef={contentContainerRef}
        >
          {dialogContent}
        </MobileDialog>
      ) : (
        <div className={modalClass} ref={modalRef}>
          {dialogContent}
        </div>
      )}
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
