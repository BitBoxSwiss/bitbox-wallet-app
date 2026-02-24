// SPDX-License-Identifier: Apache-2.0

import { useTranslation } from 'react-i18next';
import * as accountApi from '@/api/account';
import { Header } from '@/components/layout';
import { SignMessageViewGate } from '../components/sign-message-view-gate';
import {
  TAddressControlsProps,
  SignMessageAddressNotFoundView,
  SignMessageInputView,
  SignMessageLoadErrorView,
  SignMessageResultView,
  SignMessageSigningView,
} from './sign-message-views';
import { useSignMessageController } from './use-sign-message-controller';
import style from './sign-message.module.css';

type TProps = {
  accounts: accountApi.TAccount[];
  code: accountApi.AccountCode;
};

export const SignMessage = ({
  accounts,
  code,
}: TProps) => {
  const { t } = useTranslation();
  const controller = useSignMessageController({ accounts, code });

  if (!controller.account) {
    return null;
  }

  const fixedAddressLoadError = (() => {
    switch (controller.fixedAddressLoadErrorCode) {
    case 'syncInProgress':
      return t('addresses.loadSyncInProgress');
    case 'notSupported':
      return t('addresses.loadNotSupported');
    case 'loadFailed':
      return t('addresses.loadFailed');
    default:
      return null;
    }
  })();

  const buildAddressControls = (showNavigation: boolean, isSigning: boolean): TAddressControlsProps => ({
    showNavigation,
    availableAddressCount: controller.availableAddressCount,
    activeIndex: controller.activeIndex,
    isSigning,
    addressLabel: t('receive.signMessage.addressLabel'),
    previousLabel: t('button.previous'),
    nextLabel: t('button.next'),
    onPrevious: controller.previous,
    onNext: controller.next,
  });

  return (
    <div className="container">
      <div className="innerContainer scrollableContainer">
        <Header hideSidebarToggler centerTitle title={<h2>{t('receive.signMessage.title')}</h2>} />
        <div className="content padded">
          <SignMessageViewGate
            isLoading={controller.isLoading}
            isConnecting={controller.connectingKeystore}
            isMessageSigningAvailable={controller.isMessageSigningAvailable}
            isKeystoreConnected={controller.bypassConnectionGate || controller.keystoreConnected}
            loadingText={t('loading')}
            unsupportedText={t('receive.signMessage.unsupportedLitecoin')}
            connectFailedText={t('addresses.signConnectFailed')}
            retryLabel={t('generic.retry')}
            backLabel={t('button.back')}
            onRetry={controller.retryKeystoreConnection}
            onBack={controller.goBack}
            pageSectionClassName={style.pageSection ?? ''}
            footerButtonsClassName={style.footerButtons ?? ''}
            loadingWrapClassName={style.loadingWrap}
          >
            {fixedAddressLoadError && (
              <SignMessageLoadErrorView
                errorText={fixedAddressLoadError}
                retryButtonText={t('generic.retry')}
                backPath={controller.backPath}
                backButtonText={t('button.back')}
                onRetry={controller.retryFixedAddressLoad}
              />
            )}
            {!fixedAddressLoadError && controller.availableAddressCount > 0 && (
              <>
                {controller.state === 'input' && (
                  <SignMessageInputView
                    addressControlsProps={buildAddressControls(!controller.isFixedAddressRoute, false)}
                    address={controller.address}
                    isFixedAddressRoute={controller.isFixedAddressRoute}
                    hasManyScriptTypes={controller.hasManyScriptTypes}
                    insured={controller.insured}
                    addressTypeDialog={controller.addressTypeDialog}
                    setAddressTypeDialog={controller.setAddressTypeDialog}
                    addressType={controller.addressType}
                    availableScriptTypes={controller.availableScriptTypes}
                    handleAddressTypeChosen={controller.handleAddressTypeChosen}
                    isUnsupported={controller.isUnsupported}
                    isTaproot={controller.isTaproot}
                    message={controller.message}
                    setMessage={controller.setMessage}
                    error={controller.error}
                    handleSign={controller.handleSign}
                    backPath={controller.backPath}
                    changeScriptTypeText={t('receive.changeScriptType')}
                    messageLabel={t('receive.signMessage.messageLabel')}
                    messagePlaceholder={t('receive.signMessage.messagePlaceholder')}
                    unsupportedTaprootText={t('receive.signMessage.unsupportedTaproot')}
                    unsupportedLitecoinText={t('receive.signMessage.unsupportedLitecoin')}
                    signButtonText={t('receive.signMessage.signButton')}
                    backButtonText={t('button.back')}
                  />
                )}
                {controller.state === 'signing' && (
                  <SignMessageSigningView
                    addressControlsProps={buildAddressControls(false, true)}
                    subtitleText={t('addresses.signOnBitBoxSubtitle')}
                    address={controller.address}
                    messageLabel={t('receive.signMessage.messageLabel')}
                    message={controller.message}
                    signingText={t('receive.signMessage.signing')}
                  />
                )}
                {controller.state === 'result' && (
                  <SignMessageResultView
                    resultAddress={controller.result?.address || ''}
                    resultMessage={controller.result?.message || ''}
                    resultSignature={controller.result?.signature || ''}
                    successText={t('receive.signMessage.resultDescription')}
                    addressLabel={t('receive.signMessage.addressLabel')}
                    messageLabel={t('receive.signMessage.messageLabel')}
                    signatureLabel={t('receive.signMessage.signatureLabel')}
                    doneButtonText={t('button.done')}
                    signAnotherButtonText={t('receive.signMessage.signAnother')}
                    goBack={controller.goBack}
                    reset={controller.reset}
                  />
                )}
              </>
            )}
            {!fixedAddressLoadError && controller.isFixedAddressRoute && controller.availableAddressCount === 0 && (
              <SignMessageAddressNotFoundView
                notFoundText={t('addresses.notFound')}
                backPath={controller.backPath}
                backButtonText={t('button.back')}
              />
            )}
          </SignMessageViewGate>
        </div>
      </div>
    </div>
  );
};
