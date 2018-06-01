import { h } from 'preact';
import i18n from '../../../i18n/i18n';
import { ButtonLink } from '../../../components/forms';
import { Guide, Entry } from '../../../components/guide/guide';
import Backups from '../../../components/backups/backups';

export default function ManageBackups({
    disabled,
    deviceID,
    displayError,
    guide,
}) {
    return (
        <div class="contentWithGuide">
            <div class="container">
                <div class="headerContainer">
                    <div class="header">
                        <h2>{i18n.t('backup.title')}</h2>
                        <div>
                            <ButtonLink primary disabled={disabled} href={`/device/${deviceID}`}>
                                {i18n.t('button.back')}
                            </ButtonLink>
                        </div>
                    </div>
                </div>
                <Backups
                    deviceID={deviceID}
                    showCreate={true}
                    displayError={displayError}
                />
            </div>
            <Guide guide={guide}>
                <Entry title="What is a backup?">
                    <p>Copy of the seed.</p>
                </Entry>
            </Guide>
        </div>
    );
}
