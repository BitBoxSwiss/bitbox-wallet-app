// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback } from 'react';
import { useEsc } from '@/hooks/keyboard';
import { Button } from '@/components/forms/button';
import { useBackButton } from '@/hooks/backbutton';
import { useBackNavigation } from '@/contexts/BackNavigationContext';

type TBackButton = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  enableEsc?: boolean;
  onClick?: () => void;
};

export const BackButton = ({
  children,
  className,
  disabled,
  enableEsc,
  onClick,
}: TBackButton) => {
  const { goBack } = useBackNavigation();

  const handleBack = useCallback(() => {
    if (!disabled) {
      if (onClick) {
        onClick();
        return;
      }
      goBack();
    }
  }, [disabled, onClick, goBack]);

  useBackButton(() => {
    if (disabled) {
      return false;
    }
    handleBack();
    return false;
  });

  useEsc(useCallback(() => enableEsc && handleBack(), [enableEsc, handleBack]));

  return (
    <Button
      disabled={disabled}
      className={className}
      onClick={handleBack}
      secondary
    >
      {children}
    </Button>
  );
};
