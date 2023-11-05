import React, { useState } from 'react';
import { Dialog, DialogButtons } from '../components/dialog/dialog';
import { Message } from '../components/message/message';
import { Button } from '../components/forms';
import { useTranslation } from 'react-i18next';

type TUseConfirm = [
  (title: string, message: string) => Promise<boolean>,
  React.FunctionComponent
];

type TProps = {
    title: string
    message: string
}

type TResolve = (value: boolean | PromiseLike<boolean>) => void;

type TResolver = {
    resolve: TResolve;
};

const createPromise = (): [Promise<boolean>, TResolve ] => {
  let resolver: TResolve | null = null;
  const promise = new Promise<boolean>((resolve, _reject) => {
    resolver = resolve;
  });

  if (resolver === null) {
    throw new Error('Failed to create promise');
  }
  return [promise, resolver];
};

const useConfirm = (): TUseConfirm => {
  const { t } = useTranslation();
  const [ open, setOpen ] = useState(false);
  const [ resolver, setResolver ] = useState<TResolver>();
  const [ confirmationProps, setConfirmationProps ] = useState<TProps>({ title: '', message: '' });

  const getConfirmation = async (title: string, message: string) => {
    setConfirmationProps({ title: title, message: message });
    setOpen(true);
    const [ promise, resolve ] = createPromise();
    setResolver({ resolve });
    return promise;
  };

  const onClick = async(status: boolean) => {
    setOpen(false);
    resolver?.resolve(status);
  };

  const Confirmation: React.FunctionComponent = () => (
    <Dialog title={confirmationProps.title} open={open}>
      <Message type="warning">
        {confirmationProps.message}
      </Message>
      <DialogButtons>
        <Button primary onClick={() => onClick(true)}>{t('dialog.confirm')}</Button>
        <Button secondary onClick={() => onClick(false)}>{t('dialog.cancel')}</Button>
      </DialogButtons>
    </Dialog>
  );

  return [ getConfirmation, Confirmation ];

};

export default useConfirm;