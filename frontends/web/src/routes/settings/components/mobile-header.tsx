/**
 * Copyright 2023 Shift Crypto AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    <div
      className={`${styles.container} ${withGuide ? `${styles.withGuide}` : ''}`}
    >
      <button onClick={handleClick} className={styles.backButton}>
        <ChevronLeftDark />
      </button>
      <h1
        className={`${styles.headerText} ${withGuide ? '' : styles.headerTextNoGuide}`}
      >
        {title}
      </h1>
    </div>
  );
};
