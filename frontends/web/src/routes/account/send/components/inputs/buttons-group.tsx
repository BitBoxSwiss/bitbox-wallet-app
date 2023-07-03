import { useTranslation } from 'react-i18next';
import { Button, ButtonLink } from '../../../../../components/forms';

type TProps = {
    onSendButtonClick: () => void;
    isSendButtonDisabled?: boolean;
    accountCode: string;
}

export const ButtonsGroup = ({ onSendButtonClick, isSendButtonDisabled, accountCode }: TProps) => {
  const { t } = useTranslation();
  return (
    <>
      <Button
        primary
        onClick={onSendButtonClick}
        disabled={isSendButtonDisabled}>
        {t('send.button')}
      </Button>
      <ButtonLink
        transparent
        to={`/account/${accountCode}`}>
        {t('button.back')}
      </ButtonLink>
    </>
  );
};