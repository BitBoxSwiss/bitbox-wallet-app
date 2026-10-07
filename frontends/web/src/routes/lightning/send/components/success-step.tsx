// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { UseBackButton } from '@/hooks/backbutton';
import { SimpleMarkup } from '@/utils/markup';
import { useContacts } from '../../contacts/use-contacts';
import styles from '../send.module.css';

type TProps = {
  address?: string;
  onAddContact: () => void;
  onDone: () => void;
};

export const SuccessStep = ({ address, onAddContact, onDone }: TProps) => {
  const { t } = useTranslation();
  const response = useContacts(address, Boolean(address));
  const newContact = Boolean(address && response?.success && response.data.matchingContactID === null);
  const waitForDone = Boolean(address && (!response?.success || response.data.matchingContactID === null));

  useEffect(() => {
    if (!address || waitForDone) {
      return;
    }
    const timeout = window.setTimeout(onDone, 1000);
    return () => window.clearTimeout(timeout);
  }, [address, onDone, waitForDone]);

  return (
    <View fitContent textCenter verticallyCentered>
      <UseBackButton handler={() => {
        onDone();
        return false;
      }} />
      <ViewContent withIcon="success">
        <SimpleMarkup className={styles.successMessage} markup={t('lightning.send.success.message')} tagName="p" />
        {newContact && (
          <Button transparent className={styles.addContact} onClick={onAddContact}>
            <Trans i18nKey="lightning.contacts.addAfterPayment" values={{ address }} components={{ strong: <strong /> }} />
          </Button>
        )}
      </ViewContent>
      {response !== undefined && waitForDone && <ViewButtons><Button primary onClick={onDone}>{t('button.done')}</Button></ViewButtons>}
    </View>
  );
};
