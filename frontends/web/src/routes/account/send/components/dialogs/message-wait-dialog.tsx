import { useTranslation } from 'react-i18next';
import { ISendTx } from '@/api/account';
import { Cancel, Checked } from '@/components/icon/icon';
import { WaitDialog } from '@/components/wait-dialog/wait-dialog';
import { alertUser } from '@/components/alert/Alert';

type TProps = {
    result: ISendTx | undefined;
}

export const MessageWaitDialog = ({ result }: TProps) => {
  const { t } = useTranslation();

  if (!result) {
    return null;
  }

  if (!result.aborted && !result.success) {
    switch (result.errorCode) {
    case 'erc20InsufficientGasFunds':
      alertUser(t(`send.error.${result.errorCode}`));
      break;
    default:
      const { errorMessage } = result;
      if (errorMessage) {
        alertUser(t('unknownError', { errorMessage }));
      } else {
        alertUser(t('unknownError'));
      }
    }
    return null;
  }
  return (
    <WaitDialog>
      <div className="flex flex-row flex-center flex-items-center">
        {result.success && (
          <>
            <Checked style={{ height: 18, marginRight: '1rem' }} />
            {t('send.success')}
          </>
        )}
        {result.aborted && (
          <>
            <Cancel alt="Abort" style={{ height: 18, marginRight: '1rem' }} />
            {t('send.abort')}
          </>
        )}
      </div>
    </WaitDialog>
  );
};
