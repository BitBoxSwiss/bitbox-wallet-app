import { Component} from 'react';
import style from './badge.module.css';

interface BadgeProps {
    type: string;
    className?: string;
}

class Badge extends Component<BadgeProps> {
  public render() {
    const { type, className, children } = this.props;
    return (
      <span className={[style.container, style[type], className].join(' ')}>
        {children}
      </span>
    );
  }
}

export { Badge };
