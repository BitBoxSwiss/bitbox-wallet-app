import { FunctionComponent } from 'react';
import style from './badge.module.css';

interface Props {
    type: string;
    className?: string;
}

export const Badge: FunctionComponent<Props> = ({ type, className, children }) => {
  return (
    <span className={[style.container, style[type], className].join(' ')}>
      {children}
    </span>
  );
};
