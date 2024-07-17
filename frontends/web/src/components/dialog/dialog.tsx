/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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
import { useEsc, useKeydown } from '@/hooks/keyboard';
import style from './dialog.module.css';

type TProps = {
    title?: string;
    small?: boolean;
    medium?: boolean;
    large?: boolean;
    slim?: boolean;
    centered?: boolean;
    disableEscape?: boolean;
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
  disableEscape,
  onClose,
  children,
  open,
}: TProps) => {
  const [currentTab, setCurrentTab] = useState<number>(0);
  const [renderDialog, setRenderDialog] = useState<boolean>(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getFocusables = useCallback((): (NodeListOf<HTMLElement> | null) => {
    if (!modalContentRef.current) {
      return null;
    }
    return modalContentRef.current.querySelectorAll('a, button, input, textarea');
  }, [modalContentRef]);

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
  }, [getFocusables, getNextIndex, setCurrentTab]);

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

  const activate = useCallback(() => {
    if (!modalRef.current || !overlayRef.current || !modalContentRef.current) {
      return;
    }
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
    }
    overlayRef.current.classList.add(style.activeOverlay);
    // Minor delay
    timerIdRef.current = setTimeout(() => modalRef.current?.classList.add(style.open), 10);

    // Focus first
    const focusables = getFocusables();
    if (focusables && focusables.length && focusables[0].getAttribute('autofocus') !== 'false') {
      focusables[0].focus();
    }
  }, [getFocusables, modalRef, overlayRef, timerIdRef]);

  const deactivateModal = useCallback((fireOnCloseProp: boolean) => {
    if (!modalRef.current || !overlayRef.current) {
      return;
    }
    overlayRef.current.classList.remove(style.closingOverlay);
    setRenderDialog(false);
    if (onClose && fireOnCloseProp) {
      onClose();
    }
  }, [modalRef, overlayRef, setRenderDialog, onClose]);

  const deactivate = useCallback((fireOnCloseProp: boolean) => {
    if (!modalRef.current || !overlayRef.current) {
      return;
    }

    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
    }

    overlayRef.current.classList.remove(style.activeOverlay);
    overlayRef.current.classList.add(style.closingOverlay);
    modalRef.current?.classList.remove(style.open);

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === modalRef.current) {
        deactivateModal(fireOnCloseProp);
        modalRef.current?.removeEventListener('transitionend', onTransitionEnd);
      }
    };

    const hasTransition = parseFloat(window.getComputedStyle(modalRef.current).transitionDuration) > 0;

    if (hasTransition) {
      modalRef.current.addEventListener('transitionend', onTransitionEnd);
      // fallback in-case the 'transitionend' event didn't fire
      timerIdRef.current = setTimeout(() => deactivateModal(fireOnCloseProp), 400);
    } else {
      deactivateModal(fireOnCloseProp);
    }
  }, [deactivateModal]);


  useEsc(useCallback(() => {
    if (!renderDialog) {
      return;
    }
    if (!disableEscape) {
      deactivate(true);
    }
  }, [renderDialog, disableEscape, deactivate]));

  useEffect(() => {
    if (open) {
      setRenderDialog(true);
    } else {
      deactivate(false);
    }
  }, [setRenderDialog, open, deactivate]);

  useEffect(() => {
    if (renderDialog) {
      activate();
    }
  }, [activate, renderDialog]);

  if (!renderDialog) {
    return null;
  }

  const isSmall = small ? style.small : '';
  const isMedium = medium ? style.medium : '';
  const isLarge = large ? style.large : '';
  const isSlim = slim ? style.slim : '';
  const isCentered = centered && !onClose ? style.centered : '';

  return (
    <div className={style.overlay} ref={overlayRef}>
      <div
        className={[style.modal, isSmall, isMedium, isLarge].join(' ')}
        ref={modalRef}>
        {
          title && (
            <div className={[style.header, isCentered].join(' ')}>
              <h3 className={style.title}>{title}</h3>
              { onClose ? (
                <button className={style.closeButton} onClick={() => {
                  deactivate(true);
                }}>
                  <CloseXDark className="show-in-lightmode" />
                  <CloseXWhite className="show-in-darkmode" />
                </button>
              ) : null }
            </div>
          )
        }
        <div
          className={[style.contentContainer, isSlim].join(' ')}
          ref={modalContentRef}>
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
