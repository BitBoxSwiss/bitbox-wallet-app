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
  to?: string;
  replace?: boolean;
  onBack?: () => void;
};

export const BackButton = ({
  children,
  className,
  disabled,
  enableEsc,
  to,
  replace = false,
  onBack,
}: TBackButton) => {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (!disabled) {
      if (onBack) {
        onBack();
        return;
      }
      if (to) {
        navigate(to, { replace });
        return;
      }
      navigate(-1);
    }
  }, [disabled, navigate, onBack, replace, to]);

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
