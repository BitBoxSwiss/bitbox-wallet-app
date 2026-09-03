// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { ChevronLeftDark } from '@/components/icon';
import { useBackNavigation } from '@/contexts/BackNavigationContext';
import { UseBackButton } from '@/hooks/backbutton';
import styles from './mobile-header.module.css';

type TProps = {
  title?: string;
  variant?: 'back' | 'titleOnly';
  withViewPadding?: boolean;
  onClick?: () => void;
};

export const MobileHeader = ({
  title = '',
  variant = 'back',
  withViewPadding = false,
  onClick,
}: TProps) => {
  const navigate = useNavigate();
  const { goBack } = useBackNavigation();
  const handleClick = () => {
    // goes to the previous page if no onClick function is provided
    if (!onClick) {
      if (!goBack()) {
        navigate(-1);
      }
    } else {
      onClick();
    }
  };
  return (
    <div className={styles.mobileHeader}>
      <div className={`
        ${styles.container || ''}
        ${withViewPadding && styles.withViewPadding || ''}
      `}>
        {variant === 'back' && (
          <>
            <UseBackButton handler={() => {
              handleClick();
              return false;
            }} />
            <button onClick={handleClick} className={styles.backButton}>
              <ChevronLeftDark />
            </button>
          </>
        )}
      </div>
      <h1 className={styles.headerText}>
        {title}
      </h1>
    </div>
  );
};
