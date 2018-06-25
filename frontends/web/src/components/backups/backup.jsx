import i18n from '../../i18n/i18n';
import { Radio } from '../forms';

export default function BackupsListItem({
    backup,
    selectedBackup,
    handleChange,
    onFocus,
}) {
    let date = '';
    if (backup.date !== '') {
        const months = i18n.t('months');
        const days = i18n.t('days');
        const dt = new Date(backup.date);
        date = `${days[dt.getDay()]}, ${dt.getDate()}${i18n.t('dayPeriod')} ${months[dt.getMonth()]} ${dt.getFullYear()}, ${i18n.t('atTime')} ${dt.getHours()}:${(dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes()}`;
    } else {
        date = 'unknown';
    }
    let name = backup.name !== '' ? backup.name : backup.id;
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
