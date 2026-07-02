// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { ChevronLeftDark } from '@/components/icon';
import { useBackNavigation } from '@/contexts/BackNavigationContext';
import { UseBackButton } from '@/hooks/backbutton';
import styles from './mobile-header.module.css';

type TProps = {
  title?: string;
  variant?: 'back' | 'titleOnly';
  withGuide?: boolean;
  withViewPadding?: boolean;
  onClick?: () => void;
};

export const MobileHeader = ({
  title = '',
  variant = 'back',
  withGuide = false,
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
    <div className={`
      ${styles.container || ''}
      ${variant === 'titleOnly' && styles.titleOnly || ''}
      ${withGuide && styles.withGuide || ''}
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
      <h1 className={styles.headerText}>
        {title}
      </h1>
    </div>
  );
};
