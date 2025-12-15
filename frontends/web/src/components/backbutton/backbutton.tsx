// SPDX-License-Identifier: Apache-2.0

import { ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEsc } from '@/hooks/keyboard';
import { Button } from '@/components/forms/button';

type TBackButton = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  enableEsc?: boolean;
};

export const BackButton = ({
  children,
  className,
  disabled,
  enableEsc,
}: TBackButton) => {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (!disabled) {
      navigate(-1);
    }
  }, [disabled, navigate]);

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
