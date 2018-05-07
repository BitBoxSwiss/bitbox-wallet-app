import { h } from 'preact';
import { select } from './select.css';

export default function Select({
    id,
    label = null,
    options = [],
    selected = null,
    ...props
}) {
    return (
        <div className={select}>
            {label && <label for={id}>{label}</label>}
            <select {...props}>
                {options.map(({ code }) => (
                    <option
                        key={code}
                        value={code}
                        selected={selected === code}>
                        {code}
                    </option>
                ))}
            </select>
        </div>
    );
}
