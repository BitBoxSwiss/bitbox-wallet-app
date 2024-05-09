import { useTranslation } from 'react-i18next';
import { Cancel, Checked } from '../../../../../components/icon/icon';
import { WaitDialog } from '../../../../../components/wait-dialog/wait-dialog';

type TProps = {
    isShown: boolean;
    messageType: 'sent' | 'abort';
}

type TIconProps = {
    messageType: TProps['messageType']
}

export const MessageWaitDialog = ({ isShown, messageType }: TProps) => {

  if (!isShown) {
    return null;
  }
  return (
    <WaitDialog>
      <div className="flex flex-row flex-center flex-items-center">
        <IconAndMessage messageType={messageType} />
      </div>
    </WaitDialog>
  );
};

const IconAndMessage = ({ messageType }: TIconProps) => {
  const { t } = useTranslation();
  switch (messageType) {
  case 'sent':
    return (
      <>
        <Checked style={{ height: 18, marginRight: '16px' }} />
        {t('send.success')}
      </>
    );
  case 'abort':
    return (
      <>
        <Cancel alt="Abort" style={{ height: 18, marginRight: '16px' }} />
        {t('send.abort')}
      </>
    );
  default:
    return null;
  }
};


