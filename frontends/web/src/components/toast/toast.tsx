// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CloseXDark, CloseXWhite } from '@/components/icon';
import { Message } from '@/components/message/message';
import { useDarkmode } from '@/hooks/darkmode';
import { TMessageTypes } from '@/utils/types';
import style from './Toast.module.css';

type TToastProps = {
  type?: TMessageTypes;
  // Deprecated prop kept for compatibility with the existing callsites.
  theme?: TMessageTypes;
  icon?: ReactNode;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
};

type TToastItem = {
  id: number;
  duration: number;
  icon?: ReactNode;
  message: ReactNode;
  persistent: boolean;
  type: TMessageTypes;
};

type TShowToast = {
  duration?: number;
  icon?: ReactNode;
  message: ReactNode;
  persistent?: boolean;
  type?: TMessageTypes;
};

type TToastContext = {
  clearToasts: () => void;
  hideToast: (id: number) => void;
  showToast: (toast: TShowToast) => number;
};

type TToastProviderProps = {
  children: ReactNode;
};

const DEFAULT_DURATION_MS = 5000;
const ToastContext = createContext<TToastContext | undefined>(undefined);

let nextToastID = 1;

export const Toast = ({ type, theme, icon, className = '', onClose, children }: TToastProps) => {
  const resolvedType = type || theme || 'info';
  const { isDarkMode } = useDarkmode();
  const iconWithSpacing = icon ? <span className={style.icon}>{icon}</span> : undefined;
  return (
    <Message icon={iconWithSpacing} type={resolvedType} className={`${style.toast || ''} ${className || ''}`.trim()}>
      <div className={style.container}>
        <div className={style.content}>{children}</div>
        <button
          aria-label="Close toast"
          className={style.closeButton}
          hidden={!onClose}
          onClick={onClose}
          type="button">
          {isDarkMode ? <CloseXWhite /> : <CloseXDark />}
        </button>
      </div>
    </Message>
  );
};

export const ToastProvider = ({ children }: TToastProviderProps) => {
  const [toasts, setToasts] = useState<TToastItem[]>([]);
  const timeoutIDs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const hideToast = useCallback((id: number) => {
    const timeoutID = timeoutIDs.current[id];
    if (timeoutID) {
      clearTimeout(timeoutID);
      delete timeoutIDs.current[id];
    }
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    Object.values(timeoutIDs.current).forEach(clearTimeout);
    timeoutIDs.current = {};
    setToasts([]);
  }, []);

  const showToast = useCallback((toast: TShowToast) => {
    const id = nextToastID;
    nextToastID += 1;
    const persistent = toast.persistent === true;

    const nextToast: TToastItem = {
      duration: persistent ? 0 : (toast.duration ?? DEFAULT_DURATION_MS),
      id,
      icon: toast.icon,
      message: toast.message,
      persistent,
      type: toast.type ?? 'info',
    };

    setToasts(prevToasts => [...prevToasts, nextToast]);

    if (nextToast.duration > 0) {
      timeoutIDs.current[id] = setTimeout(() => {
        hideToast(id);
      }, nextToast.duration);
    }
    return id;
  }, [hideToast]);

  useEffect(() => {
    return () => {
      Object.values(timeoutIDs.current).forEach(clearTimeout);
    };
  }, []);

  const value = useMemo(() => ({
    clearToasts,
    hideToast,
    showToast,
  }), [clearToasts, hideToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className={style.viewport} aria-live="polite" role="status">
          {toasts.map(({ id, icon, message, persistent, type }) => (
            <Toast
              key={id}
              className={style.toastItem}
              icon={icon}
              onClose={persistent ? () => hideToast(id) : undefined}
              type={type}>
              {message}
            </Toast>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
};
