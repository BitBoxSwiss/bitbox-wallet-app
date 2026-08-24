// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { View, ViewContent } from '@/components/view/view';
import { SimpleMarkup } from '@/utils/markup';
import styles from '../send.module.css';

export const SuccessStep = () => {
  const { t } = useTranslation();

  return (
    <View fitContent textCenter verticallyCentered>
      <ViewContent withIcon="success">
        <SimpleMarkup className={styles.successMessage} markup={t('lightning.send.success.message')} tagName="p" />
      </ViewContent>
    </View>
  );
};
