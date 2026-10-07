// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/forms';
import { Header, Main } from '@/components/layout';
import { Message } from '@/components/message/message';
import { View, ViewButtons, ViewContent } from '@/components/view/view';
import { SettingsItem } from '@/routes/settings/components/settingsItem/settingsItem';
import { ContactForm } from './contact-form';
import { useContacts } from './use-contacts';
import styles from './contacts.module.css';

export const Contacts = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const response = useContacts();

  return (
    <Main>
      <Header variant="navigation" hideSidebarToggler mobileBackButton title={t('lightning.contacts.title')} onBack={() => navigate('/settings/lightning-settings')} />
      <View>
        <ViewContent>
          {response && (response.success ? (
            response.data.contacts.length > 0 ? response.data.contacts.map(contact => (
              <SettingsItem
                key={contact.id}
                settingName={contact.name || contact.address}
                onClick={() => navigate(`/lightning/contacts/${contact.id}`)}
              />
            )) : <div className={styles.empty}>{t('lightning.contacts.empty')}</div>
          ) : <Message type="warning">{t('lightning.contacts.loadError')}</Message>)}
        </ViewContent>
        <ViewButtons>
          <Button primary onClick={() => navigate('/lightning/contacts/add')}>{t('lightning.contacts.add')}</Button>
        </ViewButtons>
      </View>
    </Main>
  );
};

export const AddContact = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const backToContacts = () => navigate('/lightning/contacts');
  return (
    <Main>
      <Header variant="navigation" hideSidebarToggler title={t('lightning.contacts.add')} />
      <ContactForm onCancel={backToContacts} onDone={backToContacts} />
    </Main>
  );
};

export const ContactDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const response = useContacts();
  const contact = response?.success ? response.data.contacts.find(contact => contact.id === id) : undefined;
  const backToContacts = () => navigate('/lightning/contacts');

  return (
    <Main>
      <Header variant="navigation" hideSidebarToggler mobileBackButton title={t('lightning.contacts.details')} onBack={backToContacts} />
      {response && (contact ? (
        <ContactForm
          key={contact.id}
          contact={contact}
          onCancel={backToContacts}
          onDone={backToContacts}
          onSend={address => navigate(`/lightning/send?recipient=${encodeURIComponent(address)}`)}
        />
      ) : <View><ViewContent><Message type="warning">{t(response.success ? 'lightning.contacts.notFound' : 'lightning.contacts.loadError')}</Message></ViewContent></View>)}
    </Main>
  );
};
