import { h } from 'preact';
import { Radio } from '../forms';

export default function BackupsListItem({
    backup,
    selectedBackup,
    handleChange,
    onFocus,
}) {
    let date = ''
    if (backup.date != '') {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dt = new Date(backup.date);
        date = `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}, at ${dt.getHours()}:${(dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes()}`;
    } else {
        date = 'unknown'
    }
    let name = backup.name != '' ? backup.name : backup.id
    return (
        <Radio
            checked={selectedBackup === backup.id}
            onChange={handleChange}
            id={backup.id}
            label={name}
            value={backup.id}
            onFocus={onFocus}
            sizeMedium>
            <span className="text-small text-gray">{date}</span>
        </Radio>
    );
}
