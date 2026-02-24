// SPDX-License-Identifier: Apache-2.0

import { SyntheticEvent } from 'react';
import * as accountApi from '@/api/account';
import { Button } from '@/components/forms';
import { BackButton } from '@/components/backbutton/backbutton';
import { Message } from '@/components/message/message';
import {
  ArrowCirlceLeft,
  ArrowCirlceLeftActive,
  ArrowCirlceRight,
  ArrowCirlceRightActive,
} from '@/components/icon';
import { AddressTypeDialog } from '../components/address-type-dialog';
import { AddressPager } from '../components/address-pager';
import {
  TCopyableFieldStyles,
  SignMessageCopyableField,
  SignMessageMessageInput,
  SignMessageResultFields,
  SignMessageSigningPreview,
} from '../components/sign-message-sections';
import style from './sign-message.module.css';

const copyableFieldStyles: TCopyableFieldStyles = {
  fieldLabel: style.fieldLabel,
  copyInputWrap: style.copyInputWrap,
  copyInputField: style.copyInputField,
  copyInputButton: style.copyInputButton,
};

export type TAddressControlsProps = {
  showNavigation: boolean;
  availableAddressCount: number;
  activeIndex: number;
  isSigning: boolean;
  addressLabel: string;
  previousLabel: string;
  nextLabel: string;
  onPrevious: (event: SyntheticEvent) => void;
  onNext: (event: SyntheticEvent) => void;
};

const AddressControls = ({
  showNavigation,
  availableAddressCount,
  activeIndex,
  isSigning,
  addressLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: TAddressControlsProps) => (
  <AddressPager
    count={showNavigation ? availableAddressCount : 1}
    label={(
      <p className={style.label}>
        {addressLabel} {availableAddressCount > 1 ? `(${activeIndex + 1}/${availableAddressCount})` : ''}
      </p>
    )}
    previousLabel={previousLabel}
    nextLabel={nextLabel}
    previousDisabled={isSigning || activeIndex === 0}
    nextDisabled={isSigning || activeIndex >= availableAddressCount - 1}
    onPrevious={onPrevious}
    onNext={onNext}
    previousDisabledIcon={<ArrowCirlceLeft />}
    previousEnabledIcon={<ArrowCirlceLeftActive />}
    nextDisabledIcon={<ArrowCirlceRight />}
    nextEnabledIcon={<ArrowCirlceRightActive />}
    groupNavigation
    containerClassName={style.addressHeader}
    navigationClassName={style.addressNavigation}
    previousButtonClassName={style.navigationButton}
    nextButtonClassName={style.navigationButton}
  />
);

type TSignMessageInputViewProps = {
  addressControlsProps: TAddressControlsProps;
  address: string;
  isFixedAddressRoute: boolean;
  hasManyScriptTypes: boolean;
  insured: boolean;
  addressTypeDialog: boolean;
  setAddressTypeDialog: (open: boolean) => void;
  addressType: number;
  availableScriptTypes: accountApi.ScriptType[] | undefined;
  handleAddressTypeChosen: (addressType: number) => void;
  isUnsupported: boolean;
  isTaproot: boolean;
  message: string;
  setMessage: (message: string) => void;
  error: string | null;
  handleSign: () => Promise<void>;
  backPath: string;
  changeScriptTypeText: string;
  messageLabel: string;
  messagePlaceholder: string;
  unsupportedTaprootText: string;
  unsupportedLitecoinText: string;
  signButtonText: string;
  backButtonText: string;
};

export const SignMessageInputView = ({
  addressControlsProps,
  address,
  isFixedAddressRoute,
  hasManyScriptTypes,
  insured,
  addressTypeDialog,
  setAddressTypeDialog,
  addressType,
  availableScriptTypes,
  handleAddressTypeChosen,
  isUnsupported,
  isTaproot,
  message,
  setMessage,
  error,
  handleSign,
  backPath,
  changeScriptTypeText,
  messageLabel,
  messagePlaceholder,
  unsupportedTaprootText,
  unsupportedLitecoinText,
  signButtonText,
  backButtonText,
}: TSignMessageInputViewProps) => (
  <div className={style.pageSection}>
    <AddressControls {...addressControlsProps} />
    <SignMessageCopyableField
      value={address}
      showLabel={false}
      fieldStyles={copyableFieldStyles}
    />

    {!isFixedAddressRoute && (hasManyScriptTypes || insured) && (
      <div className={style.changeTypeWrap}>
        <Button
          transparent
          inline
          onClick={() => setAddressTypeDialog(true)}
        >
          {changeScriptTypeText}
        </Button>
      </div>
    )}

    {isUnsupported ? (
      <Message type="info">
        {isTaproot ? unsupportedTaprootText : unsupportedLitecoinText}
      </Message>
    ) : (
      <SignMessageMessageInput
        label={messageLabel}
        placeholder={messagePlaceholder}
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
        {signButtonText}
      </Button>
      <BackButton to={backPath} replace={true}>
        {backButtonText}
      </BackButton>
    </div>
  </div>
);

type TSignMessageSigningViewProps = {
  addressControlsProps: TAddressControlsProps;
  subtitleText: string;
  address: string;
  messageLabel: string;
  message: string;
  signingText: string;
};

export const SignMessageSigningView = ({
  addressControlsProps,
  subtitleText,
  address,
  messageLabel,
  message,
  signingText,
}: TSignMessageSigningViewProps) => (
  <div className={style.pageSection}>
    <SignMessageSigningPreview
      subtitle={subtitleText}
      subtitleClassName={style.signSubtitle}
      header={<AddressControls {...addressControlsProps} />}
      address={address}
      showAddressLabel={false}
      messageLabel={messageLabel}
      message={message}
      messageDisplayClassName={style.messageDisplay}
      deviceArrowClassName={style.deviceArrow}
      devicePreviewWrapClassName={style.devicePreviewWrapCompact}
      devicePreviewClassName={style.devicePreview}
      signingText={signingText}
      signingTextClassName={style.signingText}
      fieldStyles={copyableFieldStyles}
    />
  </div>
);

type TSignMessageResultViewProps = {
  resultAddress: string;
  resultMessage: string;
  resultSignature: string;
  successText: string;
  addressLabel: string;
  messageLabel: string;
  signatureLabel: string;
  doneButtonText: string;
  signAnotherButtonText: string;
  goBack: () => void;
  reset: () => void;
};

export const SignMessageResultView = ({
  resultAddress,
  resultMessage,
  resultSignature,
  successText,
  addressLabel,
  messageLabel,
  signatureLabel,
  doneButtonText,
  signAnotherButtonText,
  goBack,
  reset,
}: TSignMessageResultViewProps) => (
  <div className={style.pageSection}>
    <SignMessageResultFields
      successText={successText}
      successRowClassName={style.successMessage}
      successIconClassName={style.successIcon}
      addressLabel={addressLabel}
      messageLabel={messageLabel}
      signatureLabel={signatureLabel}
      address={resultAddress}
      message={resultMessage}
      signature={resultSignature}
      fieldStyles={copyableFieldStyles}
    />

    <div className={style.footerButtons}>
      <Button primary onClick={goBack}>
        {doneButtonText}
      </Button>
      <Button secondary onClick={reset}>
        {signAnotherButtonText}
      </Button>
    </div>
  </div>
);

type TSignMessageAddressNotFoundViewProps = {
  notFoundText: string;
  backPath: string;
  backButtonText: string;
};

export const SignMessageAddressNotFoundView = ({
  notFoundText,
  backPath,
  backButtonText,
}: TSignMessageAddressNotFoundViewProps) => (
  <div className={style.pageSection}>
    <Message type="warning">{notFoundText}</Message>
    <div className={style.footerButtons}>
      <BackButton to={backPath} replace={true}>
        {backButtonText}
      </BackButton>
    </div>
  </div>
);

type TSignMessageLoadErrorViewProps = {
  errorText: string;
  retryButtonText: string;
  backPath: string;
  backButtonText: string;
  onRetry: () => void;
};

export const SignMessageLoadErrorView = ({
  errorText,
  retryButtonText,
  backPath,
  backButtonText,
  onRetry,
}: TSignMessageLoadErrorViewProps) => (
  <div className={style.pageSection}>
    <Message type="error">{errorText}</Message>
    <div className={style.footerButtons}>
      <Button primary onClick={onRetry}>
        {retryButtonText}
      </Button>
      <BackButton to={backPath} replace={true}>
        {backButtonText}
      </BackButton>
    </div>
  </div>
);
