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
  previousIcon: ReactNode;
  previousActiveIcon: ReactNode;
  nextIcon: ReactNode;
  nextActiveIcon: ReactNode;
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
  previousIcon,
  previousActiveIcon,
  nextIcon,
  nextActiveIcon,
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
      {previousDisabled ? previousIcon : previousActiveIcon}
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
      {nextDisabled ? nextIcon : nextActiveIcon}
    </button>
  );

  if (count <= 1) {
    return (
      <div className={containerClassName}>
        {label}
      </div>
    );
  }

  if (navigationClassName) {
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
