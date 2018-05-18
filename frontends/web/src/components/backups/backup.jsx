import { h } from 'preact';
import { Radio } from '../forms';

export default function BackupsListItem({
    backup,
    selectedBackup,
    handleChange,
    onFocus,
}) {
    return (
        <Radio
            checked={selectedBackup === backup}
            onChange={handleChange}
            id={backup}
            label={backup}
            value={backup}
            onFocus={onFocus}>
            <span className="text-small text-gray">2018/05/02 2:30PM</span>
        </Radio>
    );
}
