// SPDX-License-Identifier: Apache-2.0

import { Button } from '@/components/forms';
import { useLocation } from 'wouter';
import { CogBlue } from '@/components/icon/icon';
import styles from './outlined-settings-button.module.css';

export const OutlinedSettingsButton = () => {
  const [, navigate] = useLocation();
  return (
    <Button className={styles.button} onClick={() => navigate('/settings')} transparent>
      <CogBlue />
    </Button>
  );
};
