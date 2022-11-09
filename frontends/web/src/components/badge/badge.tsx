import { ReactNode } from 'react';
import style from './badge.module.css';

type TProps = {
  type: string;
  className?: string;
  children: ReactNode;
}

export const Badge = ({ type, className, children }: TProps) => {
  return (
    <span className={[style.container, style[type], className].join(' ')}>
      {children}
    </span>
  );
};
