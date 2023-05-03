import { useTranslation } from 'react-i18next';
import { ChevronLeftDark } from '../../../components/icon';
import { route } from '../../../utils/route';
import styles from './mobile-header.module.css';

type TProps = {
  subPageTitle: string;
}

export const MobileHeader = ({ subPageTitle }: TProps) => {
  const { t } = useTranslation();
  const handleClick = () => {
    //goes to the 'general settings' page
    route('/new-settings');
  };
  return (
    <div className={styles.container}>
      <button onClick={handleClick} className={styles.backButton}><ChevronLeftDark /> {t('button.back')}</button>
      <h1 className={styles.headerText}>{subPageTitle}</h1>
    </div>
  );
};
