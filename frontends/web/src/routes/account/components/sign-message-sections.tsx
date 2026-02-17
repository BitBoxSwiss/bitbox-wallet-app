// SPDX-License-Identifier: Apache-2.0

import { ChangeEvent, ReactNode } from 'react';
import { CopyableInput } from '@/components/copy/Copy';
import { BitBox02StylizedDark, StatusSuccess } from '@/components/icon';
import { Message } from '@/components/message/message';

type TCopyableFieldClasses = {
  fieldLabelClassName: string | undefined;
  copyInputWrapClassName: string | undefined;
  copyInputFieldClassName: string | undefined;
  copyInputButtonClassName: string | undefined;
};

type TSignMessageCopyableFieldProps = {
  label?: string;
  value: string;
  showLabel?: boolean;
} & TCopyableFieldClasses;

export const SignMessageCopyableField = ({
  label,
  value,
  showLabel = true,
  fieldLabelClassName,
  copyInputWrapClassName,
  copyInputFieldClassName,
  copyInputButtonClassName,
}: TSignMessageCopyableFieldProps) => (
  <>
    {showLabel && label && <label className={fieldLabelClassName}>{label}</label>}
    <CopyableInput
      key={value}
      value={value}
      flexibleHeight
      alignLeft
      className={copyInputWrapClassName}
      inputFieldClassName={copyInputFieldClassName}
      buttonClassName={copyInputButtonClassName}
    />
  </>
);

type TSignMessageMessageInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  fieldLabelClassName: string | undefined;
  textareaClassName: string | undefined;
  autoFocus?: boolean;
};

export const SignMessageMessageInput = ({
  label,
  placeholder,
  value,
  onChange,
  error,
  fieldLabelClassName,
  textareaClassName,
  autoFocus,
}: TSignMessageMessageInputProps) => (
  <>
    <label className={fieldLabelClassName}>{label}</label>
    <textarea
      id="sign-message-input"
      value={value}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.currentTarget.value)}
      placeholder={placeholder}
      className={textareaClassName}
      rows={4}
      autoFocus={autoFocus}
    />
    {error && <Message type="error">{error}</Message>}
  </>
);

type TSignMessageSigningPreviewProps = {
  subtitle: string;
  subtitleClassName: string | undefined;
  header?: ReactNode;
  addressLabel?: string;
  address: string;
  showAddressLabel?: boolean;
  messageLabel: string;
  message: string;
  messageDisplayClassName: string | undefined;
  deviceArrowClassName: string | undefined;
  devicePreviewWrapClassName: string | undefined;
  devicePreviewClassName: string | undefined;
  signingText?: string;
  signingTextClassName?: string | undefined;
} & TCopyableFieldClasses;

export const SignMessageSigningPreview = ({
  subtitle,
  subtitleClassName,
  header,
  addressLabel,
  address,
  showAddressLabel = true,
  messageLabel,
  message,
  messageDisplayClassName,
  deviceArrowClassName,
  devicePreviewWrapClassName,
  devicePreviewClassName,
  signingText,
  signingTextClassName,
  fieldLabelClassName,
  copyInputWrapClassName,
  copyInputFieldClassName,
  copyInputButtonClassName,
}: TSignMessageSigningPreviewProps) => (
  <>
    <div className={subtitleClassName}>{subtitle}</div>
    {header}
    <SignMessageCopyableField
      label={addressLabel}
      value={address}
      showLabel={showAddressLabel}
      fieldLabelClassName={fieldLabelClassName}
      copyInputWrapClassName={copyInputWrapClassName}
      copyInputFieldClassName={copyInputFieldClassName}
      copyInputButtonClassName={copyInputButtonClassName}
    />
    <label className={fieldLabelClassName}>{messageLabel}</label>
    <div className={messageDisplayClassName}>{message}</div>
    <div className={deviceArrowClassName}>▼</div>
    <div className={devicePreviewWrapClassName}>
      <BitBox02StylizedDark className={devicePreviewClassName} />
    </div>
    {signingText && signingTextClassName && <p className={signingTextClassName}>{signingText}</p>}
  </>
);

type TSignMessageResultFieldsProps = {
  successText: string;
  successRowClassName: string | undefined;
  successIconClassName: string | undefined;
  addressLabel: string;
  messageLabel: string;
  signatureLabel: string;
  address: string;
  message: string;
  signature: string;
} & TCopyableFieldClasses;

export const SignMessageResultFields = ({
  successText,
  successRowClassName,
  successIconClassName,
  addressLabel,
  messageLabel,
  signatureLabel,
  address,
  message,
  signature,
  fieldLabelClassName,
  copyInputWrapClassName,
  copyInputFieldClassName,
  copyInputButtonClassName,
}: TSignMessageResultFieldsProps) => (
  <>
    <div className={successRowClassName}>
      <StatusSuccess className={successIconClassName} />
      <span>{successText}</span>
    </div>
    <SignMessageCopyableField
      label={addressLabel}
      value={address}
      fieldLabelClassName={fieldLabelClassName}
      copyInputWrapClassName={copyInputWrapClassName}
      copyInputFieldClassName={copyInputFieldClassName}
      copyInputButtonClassName={copyInputButtonClassName}
    />
    <SignMessageCopyableField
      label={messageLabel}
      value={message}
      fieldLabelClassName={fieldLabelClassName}
      copyInputWrapClassName={copyInputWrapClassName}
      copyInputFieldClassName={copyInputFieldClassName}
      copyInputButtonClassName={copyInputButtonClassName}
    />
    <SignMessageCopyableField
      label={signatureLabel}
      value={signature}
      fieldLabelClassName={fieldLabelClassName}
      copyInputWrapClassName={copyInputWrapClassName}
      copyInputFieldClassName={copyInputFieldClassName}
      copyInputButtonClassName={copyInputButtonClassName}
    />
  </>
);
