import { ChangeEvent, Component } from 'react';
import style from './toggle.module.css';

interface ToggleProps {
    checked: boolean;
    disabled?: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    id?: string;
    value?: string;
    name?: string;
    [key: string]: any;
}

class Toggle extends Component<ToggleProps> {
  public render() {
    const props = this.props;
    return (
      <label className={style.container}>
        <input
          type="checkbox"
          {...props} />
        <span className={style.slider}></span>
      </label>
    );
  }
}

export { Toggle };
