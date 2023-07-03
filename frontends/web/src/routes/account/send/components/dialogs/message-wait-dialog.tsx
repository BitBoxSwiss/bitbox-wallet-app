import { useTranslation } from 'react-i18next';
import { Cancel, Checked } from '../../../../../components/icon/icon';
import { WaitDialog } from '../../../../../components/wait-dialog/wait-dialog';

type TProps = {
    isShown: boolean;
    messageType: 'sent' | 'abort';
}
export const MessageWaitDialog = ({ isShown, messageType }: TProps) => {
  const { t } = useTranslation();

  if (!isShown) {
    return null;
  }

  const icons = {
    'sent': <Checked style={{ height: 18, marginRight: '1rem' }} />,
    'abort': <Cancel alt="Abort" style={{ height: 18, marginRight: '1rem' }} />
  };

  const messages = {
    'sent': t('send.success'),
    'abort': t('send.abort')
  };

  return (
    <WaitDialog>
      <div className="flex flex-row flex-center flex-items-center">
        {icons[messageType]}
        {messages[messageType]}
      </div>
    </WaitDialog>
  );
};
