// SPDX-License-Identifier: Apache-2.0

import { ReactNode, SyntheticEvent } from 'react';

type TProps = {
  count: number;
  label: ReactNode;
  previousLabel: string;
  nextLabel: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: (event: SyntheticEvent) => void;
  onNext: (event: SyntheticEvent) => void;
  previousDisabledIcon: ReactNode;
  previousEnabledIcon: ReactNode;
  nextDisabledIcon: ReactNode;
  nextEnabledIcon: ReactNode;
  groupNavigation?: boolean;
  containerClassName?: string;
  previousButtonClassName?: string;
  nextButtonClassName?: string;
  navigationClassName?: string;
};

export const AddressPager = ({
  count,
  label,
  previousLabel,
  nextLabel,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
  previousDisabledIcon,
  previousEnabledIcon,
  nextDisabledIcon,
  nextEnabledIcon,
  groupNavigation = false,
  containerClassName,
  previousButtonClassName,
  nextButtonClassName,
  navigationClassName,
}: TProps) => {
  const renderPreviousButton = () => (
    <button
      type="button"
      disabled={previousDisabled}
      className={previousButtonClassName}
      onClick={onPrevious}
      aria-label={previousLabel}
    >
      {previousDisabled ? previousDisabledIcon : previousEnabledIcon}
    </button>
  );

  const renderNextButton = () => (
    <button
      type="button"
      disabled={nextDisabled}
      className={nextButtonClassName}
      onClick={onNext}
      aria-label={nextLabel}
    >
      {nextDisabled ? nextDisabledIcon : nextEnabledIcon}
    </button>
  );

  if (count <= 1) {
    return (
      <div className={containerClassName}>
        {label}
      </div>
    );
  }

  if (groupNavigation) {
    return (
      <div className={containerClassName}>
        {label}
        <div className={navigationClassName}>
          {renderPreviousButton()}
          {renderNextButton()}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {renderPreviousButton()}
      {label}
      {renderNextButton()}
    </div>
  );
};
