import { Button } from '@/components/forms';
import styles from './outlined-settings-button.module.css';
import { useNavigate } from 'react-router-dom';
import { Cog } from '@/components/icon/icon';
export const OutlinedSettingsButton = () => {
  const navigate = useNavigate();
  return (
    <Button className={styles.button} onClick={() => navigate('/settings')} transparent>
      <Cog />
    </Button>
  );
};
