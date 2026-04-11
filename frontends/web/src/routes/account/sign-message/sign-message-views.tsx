// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { CopyableInput } from '@/components/copy/Copy';
import { Message } from '@/components/message/message';
import { Spinner } from '@/components/spinner/Spinner';
import { UseDisableBackButton } from '@/hooks/backbutton';
import { View, ViewContent, ViewHeader } from '@/components/view/view';
import {
  Checked,
  PointToBitBox02,
} from '@/components/icon';
import { AddressNavigator } from '../components/address-navigator';
import { TSignMessageController } from './use-sign-message-controller';
import style from './sign-message.module.css';

type TProps = {
  controller: TSignMessageController;
};

export const SignMessageContent = ({ controller }: TProps) => {
  const { t } = useTranslation();

  const usedAddressLoadError = useMemo(() => {
    switch (controller.usedAddressLoadErrorCode) {
    case 'syncInProgress': return t('addresses.loadSyncInProgress');
    case 'notSupported': return t('addresses.loadNotSupported');
    case 'loadFailed': return t('addresses.loadFailed');
    default: return null;
    }
  }, [controller.usedAddressLoadErrorCode, t]);

  if (!controller.dataLoaded) {
    return (
      <div className={style.loadingWrap}>
        <Spinner text={t('loading')} />
      </div>
    );
  }

  if (usedAddressLoadError) {
    return (
      <SignMessageLoadErrorView
        errorText={usedAddressLoadError}
        onRetry={controller.retryUsedAddressLoad}
      />
    );
  }

  if (controller.isUsedAddressRoute && controller.availableAddressCount === 0) {
    return <SignMessageAddressNotFoundView />;
  }

  if (controller.state === 'result') {
    return <SignMessageResultView controller={controller} />;
  }

  return <SignMessageInputView controller={controller} />;
};

export const SignMessageInputView = ({ controller }: TProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <AddressNavigator controller={controller} />
      <CopyableInput value={controller.address} flexibleHeight alignLeft inputFieldClassName={style.copyableInput} />

      {controller.isTaprootAddress ? (
        <Message type="info">
          {t('signMessage.unsupportedTaproot')}
        </Message>
      ) : (
        <>
          <label className={style.fieldLabel} htmlFor="sign-message-input">{t('signMessage.messageLabel')}</label>
          <textarea
            id="sign-message-input"
            value={controller.message}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => controller.setMessage(event.currentTarget.value)}
            placeholder={t('signMessage.messagePlaceholder')}
            className={style.messageTextarea}
            rows={4}
            autoFocus
          />
          {controller.error && <Message type="error">{controller.error}</Message>}
        </>
      )}

      <div className={style.footerButtons}>
        <Button
          primary
          onClick={controller.handleSign}
          disabled={!controller.message.trim() || controller.isTaprootAddress}
        >
          {t('signMessage.signButton')}
        </Button>
        <span className={style.backButtonWrap}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </span>
      </div>
    </div>
  );
};

export const SignMessageResultView = ({ controller }: TProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className={style.successMessage}>
        <Checked className={style.successIcon} />
        <span>{t('signMessage.resultDescription')}</span>
      </div>
      <label className={style.fieldLabel}>{t('signMessage.addressLabel')}</label>
      <CopyableInput value={controller.result?.address || ''} flexibleHeight alignLeft inputFieldClassName={style.copyableInput} />
      <label className={style.fieldLabel}>{t('signMessage.messageLabel')}</label>
      <CopyableInput value={controller.result?.message || ''} flexibleHeight alignLeft inputFieldClassName={`${style.copyableInput || ''} ${style.copyableInputMessage || ''}`} />
      <label className={style.fieldLabel}>{t('signMessage.signatureLabel')}</label>
      <CopyableInput value={controller.result?.signature || ''} flexibleHeight alignLeft inputFieldClassName={style.copyableInput} />

      <div className={`${style.footerButtons || ''} ${style.footerButtonsLeft || ''}`}>
        <Button primary onClick={controller.goBack}>
          {t('button.done')}
        </Button>
      </div>
    </div>
  );
};

export const SignMessageConfirmView = ({ controller }: TProps) => {
  const { t } = useTranslation();

  if (controller.state !== 'signing') {
    return null;
  }

  return (
    <View fullscreen>
      <UseDisableBackButton />
      <ViewHeader title={<div className={style.confirmViewTitle}>{t('signMessage.signMessage')}</div>} />
      <ViewContent>
        <p className={style.signSubtitle}>{t('signMessage.signOnBitBoxSubtitle')}</p>
        <CopyableInput value={controller.address} flexibleHeight alignLeft inputFieldClassName={style.copyableInput} />
        <label className={style.fieldLabel}>{t('signMessage.messageLabel')}</label>
        <div className={style.messageDisplay}>{controller.message}</div>
        <PointToBitBox02 />
        <p className={style.signingText}>{t('signMessage.signing')}</p>
      </ViewContent>
    </View>
  );
};

export const SignMessageAddressNotFoundView = () => {
  const { t } = useTranslation();
  return (
    <div>
      <Message type="warning">{t('addresses.notFound')}</Message>
      <div className={style.footerButtons}>
        <span className={style.backButtonWrap}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </span>
      </div>
    </div>
  );
};

type TSignMessageLoadErrorViewProps = {
  errorText: string;
  onRetry: () => void;
};

export const SignMessageLoadErrorView = ({
  errorText,
  onRetry,
}: TSignMessageLoadErrorViewProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <Message type="error">{errorText}</Message>
      <div className={style.footerButtons}>
        <Button primary onClick={onRetry}>
          {t('generic.retry')}
        </Button>
        <span className={style.backButtonWrap}>
          <BackButton>
            {t('button.back')}
          </BackButton>
        </span>
      </div>
    </div>
  );
};
