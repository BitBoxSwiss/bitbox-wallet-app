// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import { ChevronDownDark } from '@/components/icon';
import style from './addresses.module.css';

export const AddressRow = (props: TAddressItemContentProps) => (
  <div className={style.addressRow}>
    <Content {...props} />
  </div>
);

type TAddressItemAccordionProps = TAddressItemContentProps & {
  isExpanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
};

export const AddressRowAccordion = ({
  isExpanded,
  onToggle,
  children,
  ...contentProps
}: TAddressItemAccordionProps) => (
  <>
    <button
      type="button"
      className={`${style.addressRow || ''} ${style.addressRowAccordion || ''}`}
      aria-expanded={isExpanded}
      onClick={onToggle}
    >
      <Content {...contentProps} />
      <ChevronDownDark className={`${style.rowChevron || ''} ${isExpanded ? style.rowChevronExpanded || '' : ''}`} />
    </button>
    {isExpanded && children}
  </>
);


type TAddressItemContentProps = {
  address: string;
  displayAddress: string;
  truncatedAddress: string;
  formattedDate: string;
};


const Content = ({ address, displayAddress, truncatedAddress, formattedDate }: TAddressItemContentProps) => (
  <>
    <span className={style.rowAddress} title={address}>
      <span className={style.rowAddressDesktop}>{displayAddress}</span>
      <span className={style.rowAddressMobile}>{truncatedAddress}</span>
    </span>
    <span className={style.rowDate}>{formattedDate}</span>
  </>
);
