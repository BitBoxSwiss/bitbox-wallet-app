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

import React, { useCallback, useEffect, useState } from 'react';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { UseBackButton } from '@/hooks/backbutton';
import { useEsc, useKeydown } from '@/hooks/keyboard';
import style from './dialog.module.css';

type TProps = {
    title?: string;
    small?: boolean;
    medium?: boolean;
    large?: boolean;
    slim?: boolean;
    centered?: boolean;
    onClose?: (e?: Event) => void;
    children: React.ReactNode;
    open: boolean;
}

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
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [renderDialog, setRenderDialog] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false); // overlay active
  const [isOpen, setIsOpen] = useState<boolean>(false); // modal open
  const [isClosing, setIsClosing] = useState<boolean>(false); // overlay closing

  // focus handling

  const getFocusables = useCallback((): NodeListOf<HTMLElement> | null => {
    const modalContent = document.querySelector(`.${style.contentContainer}`);
    if (!modalContent) {
      return null;
    }
    return modalContent.querySelectorAll('a, button, input, textarea');
  }, []);

  const getNextIndex = useCallback((elements: NodeListOf<HTMLElement>, isNext: boolean): number => {
    const focusables = Array.from(elements);
    const arr = isNext ? focusables : focusables.reverse();
    const current = isNext ? currentTab : (arr.length - 1) - currentTab;
    let next = isNext ? currentTab + 1 : arr.length - currentTab;
    next = arr.findIndex((item, i) => (i >= next && !item.hasAttribute('disabled')));
    next = next < 0 ? arr.findIndex((item, i) => (i <= current && !item.hasAttribute('disabled'))) : next;
    return isNext ? next : (arr.length - 1) - next;
  }, [currentTab]);

  const updateIndex = useCallback((isNext: boolean) => {
    const focusables = getFocusables();
    if (!focusables) {
      return;
    }
    const target = getNextIndex(focusables, isNext);
    setCurrentTab(target);
    focusables[target].focus();
  }, [getFocusables, getNextIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!renderDialog) {
      return;
    }
    const isTab = e.keyCode === 9;
    if (isTab) {
      e.preventDefault();
      if (e.shiftKey) {
        updateIndex(false);
      } else {
        updateIndex(true);
      }
    }
  }, [updateIndex, renderDialog]);

  useKeydown(handleKeyDown);

  // dialog lifecycle

  const activate = useCallback(() => {
    setIsActive(true);
    setTimeout(() => setIsOpen(true), 10);

    // focus first element
    const focusables = getFocusables();
    if (focusables && focusables.length && focusables[0].getAttribute('autofocus') !== 'false') {
      focusables[0]?.focus();
    }
  }, [getFocusables]);

  const deactivate = useCallback((fireOnCloseProp: boolean) => {
    setIsOpen(false);
    setIsActive(false);
    setIsClosing(true);

    const finish = () => {
      setIsClosing(false);
      setRenderDialog(false);
      if (onClose && fireOnCloseProp) {
        onClose();
      }
    };

    // simulate transition duration fallback
    const timer = setTimeout(finish, 400);
    return () => clearTimeout(timer);
  }, [onClose]);

  const closeHandler = useCallback(() => {
    if (onClose !== undefined) {
      deactivate(true);
      return false;
    }
    return true;
  }, [onClose, deactivate]);

  useEsc(useCallback(() => {
    if (renderDialog && onClose !== undefined) {
      deactivate(true);
    }
  }, [renderDialog, onClose, deactivate]));

  useEffect(() => {
    if (open) {
      setRenderDialog(true);
    } else {
      deactivate(false);
    }
  }, [open, deactivate]);

  useEffect(() => {
    if (renderDialog) {
      activate();
    }
  }, [renderDialog, activate]);

  // click outside closes
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeHandler();
    }
  };

  if (!renderDialog) {
    return null;
  }

  const modalClass = `
    ${style.modal}
    ${small ? style.small : ''}
    ${medium ? style.medium : ''}
    ${large ? style.large : ''}
    ${isOpen ? style.open : ''}
  `.trim();

  const overlayClass = `
    ${style.overlay}
    ${isActive ? style.activeOverlay : ''}
    ${isClosing ? style.closingOverlay : ''}
  `.trim();

  const headerClass = `
    ${style.header}
    ${centered && !onClose ? style.centered : ''}
  `.trim();

  const contentClass = `
    ${style.contentContainer}
    ${slim ? style.slim : ''}
  `.trim();

  return (
    <div onClick={handleTap} className={overlayClass}>
      <UseBackButton handler={closeHandler} />
      <div className={modalClass}>
        {title && (
          <div className={headerClass}>
            <h3 className={style.title}>{title}</h3>
            {onClose && (
              <button className={style.closeButton} onClick={closeHandler}>
                <CloseXDark className="show-in-lightmode" />
                <CloseXWhite className="show-in-darkmode" />
              </button>
            )}
          </div>
        )}
        <div className={contentClass}>
          <div className={style.content}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
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

interface DialogButtonsProps {
    children: React.ReactNode;
}

export const DialogButtons = ({ children }: DialogButtonsProps) => {
  return (
    <div className={style.dialogButtons}>{children}</div>
  );
};
