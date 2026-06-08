// SPDX-License-Identifier: Apache-2.0

import { Button } from '@/components/forms';
import { useNavigate } from 'react-router-dom';
import { CogBlue } from '@/components/icon/icon';
import styles from './outlined-settings-button.module.css';

export const OutlinedSettingsButton = () => {
  const navigate = useNavigate();
  return (
    <Button className={styles.button} onClick={() => navigate('/settings')} transparent>
      <CogBlue />
    </Button>
  );
};
