// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TMessageTypes } from '@/utils/types';
import { Toast } from '@/components/toast/toast-view';
import { ToastContext, TShowToast } from './toast-context';
import style from '@/components/toast/Toast.module.css';

type TToastItem = {
  id: number;
  duration: number;
  icon?: ReactNode;
  message: ReactNode;
  persistent: boolean;
  type: TMessageTypes;
};

type TToastProviderProps = {
  children: ReactNode;
};

const DEFAULT_DURATION_MS = 5000;

let nextToastID = 1;

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
