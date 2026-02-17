// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useLoad } from '@/hooks/api';
import * as accountApi from '@/api/account';
import { Header } from '@/components/layout';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Message } from '@/components/message/message';
import {
  ArrowCirlceLeft,
  ArrowCirlceLeftActive,
  ArrowCirlceRight,
  ArrowCirlceRightActive,
} from '@/components/icon';
import { useSignMessage } from '../receive/components/use-sign-message';
import { AddressTypeDialog } from '../components/address-type-dialog';
import { useKeystoreConnection } from '../components/use-keystore-connection';
import { AddressPager } from '../components/address-pager';
import {
  SignMessageCopyableField,
  SignMessageMessageInput,
  SignMessageResultFields,
  SignMessageSigningPreview,
} from '../components/sign-message-sections';
import { SignMessageViewGate } from '../components/sign-message-view-gate';
import { useReceiveAddressSelection } from '../components/use-receive-address-selection';
import { findAccount, isMessageSigningSupported } from '../utils';
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
  const navigate = useNavigate();
  const { addressID: fixedAddressID } = useParams<{ addressID?: string }>();
  const isFixedAddressRoute = !!fixedAddressID;
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [fixedAddressLoadAttempt, setFixedAddressLoadAttempt] = useState(0);

  const account = findAccount(accounts, code);
  const isMessageSigningAvailable = account ? isMessageSigningSupported(account.coinCode) : false;
  const insured = account?.bitsuranceStatus === 'active';
  const listPath = `/account/${code}/addresses`;
  const infoPath = `/account/${code}/info`;
  const backPath = isFixedAddressRoute ? listPath : infoPath;

  // first array index: address types. second array index: unused addresses of that address type.
  const receiveAddresses = useLoad(isFixedAddressRoute ? null : accountApi.getReceiveAddressList(code));
  const fixedAddressResponse = useLoad(
    isFixedAddressRoute ? () => accountApi.getUsedAddresses(code) : null,
    [code, fixedAddressLoadAttempt, isFixedAddressRoute],
  );

  const {
    addressType,
    addressTypeDialog,
    setAddressTypeDialog,
    currentAddresses,
    currentAddressIndex,
    availableScriptTypes,
    hasManyScriptTypes,
    handleAddressTypeChosen: chooseAddressType,
  } = useReceiveAddressSelection({ receiveAddresses });

  const fixedAddress = useMemo(() => {
    if (!isFixedAddressRoute || !fixedAddressID || !fixedAddressResponse?.success) {
      return null;
    }
    return fixedAddressResponse.addresses.find(address => address.addressID === fixedAddressID) || null;
  }, [fixedAddressID, fixedAddressResponse, isFixedAddressRoute]);
  const currentAddress = useMemo(() => {
    if (isFixedAddressRoute) {
      return fixedAddress
        ? { address: fixedAddress.address, addressID: fixedAddress.addressID }
        : null;
    }
    return currentAddresses?.[activeIndex] || null;
  }, [activeIndex, currentAddresses, fixedAddress, isFixedAddressRoute]);
  const currentScriptType = isFixedAddressRoute ? fixedAddress?.scriptType : receiveAddresses?.[currentAddressIndex]?.scriptType;
  const isLoading = isFixedAddressRoute ? fixedAddressResponse === undefined : receiveAddresses === undefined;
  const fixedAddressLoadError = useMemo(() => {
    if (!isFixedAddressRoute || fixedAddressResponse === undefined || fixedAddressResponse.success) {
      return null;
    }
    switch (fixedAddressResponse.errorCode) {
    case 'syncInProgress':
      return t('addresses.loadSyncInProgress');
    case 'notSupported':
      return t('addresses.loadNotSupported');
    default:
      return t('addresses.loadFailed');
    }
  }, [fixedAddressResponse, isFixedAddressRoute, t]);

  const {
    message,
    setMessage,
    state,
    error,
    result,
    isUnsupported,
    isTaproot,
    handleSign,
    reset,
  } = useSignMessage({
    accountCode: code,
    address: currentAddress,
    onClose: isFixedAddressRoute ? () => navigate(backPath, { replace: true }) : undefined,
    scriptType: currentScriptType,
  });

  const handleAddressTypeChosen = (newAddressType: number) => {
    setActiveIndex(0);
    chooseAddressType(newAddressType);
    reset();
  };

  const handleConnectAbort = useCallback(() => {
    navigate(backPath, { replace: true });
  }, [backPath, navigate]);

  const {
    connected: keystoreConnected,
    connecting: connectingKeystore,
    retry: retryKeystoreConnection,
  } = useKeystoreConnection({
    enabled: !!account && isMessageSigningAvailable && !!currentAddress,
    rootFingerprint: account?.keystore.rootFingerprint,
    onUserAbort: handleConnectAbort,
  });

  const previous = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (state !== 'signing' && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
      reset();
    }
  };

  const next = (e: React.SyntheticEvent, numAddresses: number) => {
    e.preventDefault();
    if (state !== 'signing' && activeIndex < numAddresses - 1) {
      setActiveIndex(activeIndex + 1);
      reset();
    }
  };

  const availableAddressCount = isFixedAddressRoute
    ? (currentAddress ? 1 : 0)
    : (currentAddresses?.length || 0);
  const bypassConnectionGate = isFixedAddressRoute && availableAddressCount === 0;
  const address = useMemo(() => {
    if (!currentAddress || availableAddressCount === 0) {
      return '';
    }
    return currentAddress.address;
  }, [availableAddressCount, currentAddress]);

  const goBack = () => navigate(backPath, { replace: isFixedAddressRoute });

  const renderAddressControls = (showNavigation: boolean) => (
    <AddressPager
      count={showNavigation ? availableAddressCount : 1}
      label={(
        <p className={style.label}>
          {t('receive.signMessage.addressLabel')} {availableAddressCount > 1 ? `(${activeIndex + 1}/${availableAddressCount})` : ''}
        </p>
      )}
      previousLabel={t('button.previous')}
      nextLabel={t('button.next')}
      previousDisabled={state === 'signing' || activeIndex === 0}
      nextDisabled={state === 'signing' || activeIndex >= availableAddressCount - 1}
      onPrevious={previous}
      onNext={event => next(event, availableAddressCount)}
      previousIcon={<ArrowCirlceLeft />}
      previousActiveIcon={<ArrowCirlceLeftActive />}
      nextIcon={<ArrowCirlceRight />}
      nextActiveIcon={<ArrowCirlceRightActive />}
      containerClassName={style.addressHeader}
      navigationClassName={style.addressNavigation}
      previousButtonClassName={style.navigationButton}
      nextButtonClassName={style.navigationButton}
    />
  );

  const renderInput = () => (
    <div className={style.pageSection}>
      {renderAddressControls(!isFixedAddressRoute)}
      <SignMessageCopyableField
        value={address}
        showLabel={false}
        fieldLabelClassName={style.fieldLabel}
        copyInputWrapClassName={style.copyInputWrap}
        copyInputFieldClassName={style.copyInputField}
        copyInputButtonClassName={style.copyInputButton}
      />

      {!isFixedAddressRoute && (hasManyScriptTypes || insured) && (
        <div className={style.changeTypeWrap}>
          <Button
            transparent
            inline
            onClick={() => setAddressTypeDialog(true)}
          >
            {t('receive.changeScriptType')}
          </Button>
        </div>
      )}

      {isUnsupported ? (
        <Message type="info">
          {isTaproot
            ? t('receive.signMessage.unsupportedTaproot')
            : t('receive.signMessage.unsupportedLitecoin')}
        </Message>
      ) : (
        <SignMessageMessageInput
          label={t('receive.signMessage.messageLabel')}
          placeholder={t('receive.signMessage.messagePlaceholder')}
          value={message}
          onChange={setMessage}
          error={error}
          fieldLabelClassName={style.fieldLabel}
          textareaClassName={style.messageTextarea}
          autoFocus
        />
      )}

      {!isFixedAddressRoute && (
        <AddressTypeDialog
          open={addressTypeDialog}
          setOpen={setAddressTypeDialog}
          preselectedAddressType={addressType}
          availableScriptTypes={availableScriptTypes}
          insured={insured}
          handleAddressTypeChosen={handleAddressTypeChosen}
        />
      )}

      <div className={style.footerButtons}>
        <Button
          primary
          onClick={handleSign}
          disabled={!message.trim() || isUnsupported}
        >
          {t('receive.signMessage.signButton')}
        </Button>
        <BackButton to={backPath} replace={true}>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );

  const renderSigning = () => (
    <div className={style.pageSection}>
      <SignMessageSigningPreview
        subtitle={t('addresses.signOnBitBoxSubtitle')}
        subtitleClassName={style.signSubtitle}
        header={renderAddressControls(false)}
        address={address}
        showAddressLabel={false}
        messageLabel={t('receive.signMessage.messageLabel')}
        message={message}
        messageDisplayClassName={style.messageDisplay}
        deviceArrowClassName={style.deviceArrow}
        devicePreviewWrapClassName={style.devicePreviewWrapCompact}
        devicePreviewClassName={style.devicePreview}
        signingText={t('receive.signMessage.signing')}
        signingTextClassName={style.signingText}
        fieldLabelClassName={style.fieldLabel}
        copyInputWrapClassName={style.copyInputWrap}
        copyInputFieldClassName={style.copyInputField}
        copyInputButtonClassName={style.copyInputButton}
      />
    </div>
  );

  const renderResult = () => (
    <div className={style.pageSection}>
      <SignMessageResultFields
        successText={t('receive.signMessage.resultDescription')}
        successRowClassName={style.successMessage}
        successIconClassName={style.successIcon}
        addressLabel={t('receive.signMessage.addressLabel')}
        messageLabel={t('receive.signMessage.messageLabel')}
        signatureLabel={t('receive.signMessage.signatureLabel')}
        address={result?.address || ''}
        message={result?.message || ''}
        signature={result?.signature || ''}
        fieldLabelClassName={style.fieldLabel}
        copyInputWrapClassName={style.copyInputWrap}
        copyInputFieldClassName={style.copyInputField}
        copyInputButtonClassName={style.copyInputButton}
      />

      <div className={style.footerButtons}>
        <Button primary onClick={goBack}>
          {t('button.done')}
        </Button>
        <Button secondary onClick={reset}>
          {t('receive.signMessage.signAnother')}
        </Button>
      </div>
    </div>
  );

  const renderAddressNotFound = () => (
    <div className={style.pageSection}>
      <Message type="warning">{t('addresses.notFound')}</Message>
      <div className={style.footerButtons}>
        <BackButton to={backPath} replace={true}>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );

  const renderLoadError = () => (
    <div className={style.pageSection}>
      <Message type="error">{fixedAddressLoadError}</Message>
      <div className={style.footerButtons}>
        <Button primary onClick={() => setFixedAddressLoadAttempt(prev => prev + 1)}>
          {t('generic.retry')}
        </Button>
        <BackButton to={backPath} replace={true}>
          {t('button.back')}
        </BackButton>
      </div>
    </div>
  );

  if (!account) {
    return null;
  }

  return (
    <div className="container">
      <div className="innerContainer scrollableContainer">
        <Header hideSidebarToggler centerTitle title={<h2>{t('receive.signMessage.title')}</h2>} />
        <div className="content padded">
          <SignMessageViewGate
            isLoading={isLoading}
            isConnecting={connectingKeystore}
            isMessageSigningAvailable={isMessageSigningAvailable}
            isKeystoreConnected={bypassConnectionGate || keystoreConnected}
            loadingText={t('loading')}
            unsupportedText={t('receive.signMessage.unsupportedLitecoin')}
            connectFailedText={t('addresses.signConnectFailed')}
            retryLabel={t('generic.retry')}
            backLabel={t('button.back')}
            onRetry={retryKeystoreConnection}
            onBack={goBack}
            pageSectionClassName={style.pageSection || ''}
            footerButtonsClassName={style.footerButtons || ''}
            loadingWrapClassName={style.loadingWrap || ''}
          >
            {fixedAddressLoadError && renderLoadError()}
            {!fixedAddressLoadError && availableAddressCount > 0 && (
              <>
                {state === 'input' && renderInput()}
                {state === 'signing' && renderSigning()}
                {state === 'result' && renderResult()}
              </>
            )}
            {!fixedAddressLoadError && isFixedAddressRoute && availableAddressCount === 0 && renderAddressNotFound()}
          </SignMessageViewGate>
        </div>
      </div>
    </div>
  );
};
