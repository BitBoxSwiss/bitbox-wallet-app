import { Component, h } from 'preact';
import * as style from './toggle.module.css';

interface ToggleProps {
    checked: boolean;
    disabled?: boolean;
    onChange: (event: Event) => void;
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
