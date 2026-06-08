// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom';
import { ChevronLeftDark } from '@/components/icon';
import { UseBackButton } from '@/hooks/backbutton';
import styles from './mobile-header.module.css';

type TProps = {
  title: string;
  withGuide?: boolean;
  onClick?: () => void;
};

export const MobileHeader = ({ title, withGuide = false, onClick }: TProps) => {
  const navigate = useNavigate();
  const handleClick = () => {
    // goes to the previous page if no onClick function is provided
    if (!onClick) {
      navigate(-1);
    } else {
      onClick();
    }
  };
  return (
    <div className={`
      ${styles.container || ''}
      ${withGuide && styles.withGuide || ''}
    `}>
      <UseBackButton handler={() => {
        handleClick();
        return false;
      }} />
      <button onClick={handleClick} className={styles.backButton}>
        <ChevronLeftDark />
      </button>
      <h1 className={styles.headerText}>
        {title}
      </h1>
    </div>
  );
};
