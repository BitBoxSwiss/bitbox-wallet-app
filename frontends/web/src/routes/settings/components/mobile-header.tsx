// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { ChevronLeftDark } from '@/components/icon';
import styles from './mobile-header.module.css';

type TProps = {
  title: string;
  withGuide?: boolean;
  onClick?: () => void;
};

export const MobileHeader = ({ title, withGuide = false, onClick }: TProps) => {
  const navigate = useNavigate();
  const handleClick = () => {
    // goes to the 'general settings' page if no onClick function is provided
    if (!onClick) {
      navigate('/settings');
    } else {
      onClick();
    }
  };
  return (
    <div className={`
      ${styles.container || ''}
      ${withGuide && styles.withGuide || ''}
    `}>
      <button onClick={handleClick} className={styles.backButton}>
        <ChevronLeftDark />
      </button>
      <h1 className={styles.headerText}>
        {title}
      </h1>
    </div>
  );
};
