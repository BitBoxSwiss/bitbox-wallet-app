import { h, RenderableProps } from 'preact';
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

function Toggle(props: RenderableProps<ToggleProps>): JSX.Element {
    return (
        <label className={style.container}>
            <input
                type="checkbox"
                {...props} />
            <span className={style.slider}></span>
        </label>
    );
}

export { Toggle };
