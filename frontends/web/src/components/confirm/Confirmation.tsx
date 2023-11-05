import { Dialog, DialogButtons } from '../dialog/dialog';
import { Message } from '../message/message';
import { Button } from '../forms';
import { useTranslation } from 'react-i18next';

type TConfirmProps = {
    title: string,
    message: string,
    open: boolean,
    onClick: (status: boolean) => void,
}

export const Confirmation = ({ title, message, open, onClick }: TConfirmProps) => {
  const { t } = useTranslation();

  return (<Dialog title={title} open={open}>
    <Message type="warning">
      {message}
    </Message>
    <DialogButtons>
      <Button primary onClick={() => onClick(true)}>{t('dialog.confirm')}</Button>
      <Button secondary onClick={() => onClick(false)}>{t('dialog.cancel')}</Button>
    </DialogButtons>
  </Dialog>
  );
};