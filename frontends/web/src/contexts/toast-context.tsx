// SPDX-License-Identifier: Apache-2.0

import { ReactNode, createContext, useContext } from 'react';
import { TMessageTypes } from '@/utils/types';

export type TShowToast = {
  duration?: number;
  icon?: ReactNode;
  message: ReactNode;
  persistent?: boolean;
  type?: TMessageTypes;
};

export type TToastContext = {
  clearToasts: () => void;
  hideToast: (id: number) => void;
  showToast: (toast: TShowToast) => number;
};

export const ToastContext = createContext<TToastContext | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider.');
  }
  return context;
};
