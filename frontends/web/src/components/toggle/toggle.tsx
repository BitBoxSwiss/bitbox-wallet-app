import { Component, h, RenderableProps } from 'preact';
import * as style from './toggle.css';

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
    public render(props: RenderableProps<ToggleProps>) {
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
