import { Component } from 'preact';
import { translate } from 'react-i18next';
import style from '../dialog/dialog.css';
import approve from '../../assets/device/approve.png';
import reject from '../../assets/device/reject.png';

@translate()
export default class Confirm extends Component {
    state = {
        active: false,
    }

    componentDidMount() {
        setTimeout(this.activate, 10);
    }

    componentWillMount() {
        document.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = e => {
        e.preventDefault();
        document.activeElement.blur();
    }

    activate = () => {
        this.setState({ active: true });
    }

    render({
        t,
        includeDefault,
        prequel,
        title,
        children,
    }, {
        active,
    }) {
        const isActive = active ? style.active : '';
        const defaultContent = (
            <div class="flex flex-column flex-start">
                { prequel && (<p>{prequel}</p> ) }
                <p class={['label', style.confirmationLabel].join(' ')}>
                    {t('confirm.info')}
                </p>
                <div class={['flex', 'flex-row', 'flex-around', 'flex-items-end', style.confirmationInstructions].join(' ')}>
                    <div class="flex flex-column flex-center flex-items-center">
                        <img src={reject} alt="Reject" />
                        <p class="text-bold">
                            {t('confirm.abortInfo')}
                            <span class="text-red">{t('confirm.abortInfoRedText')}</span>
                        </p>
                    </div>
                    <div class="flex flex-column flex-center flex-items-center">
                        <img src={approve} alt="Approve" />
                        <p class="text-bold">
                            {t('confirm.approveInfo')}
                            <span class="text-green">{t('confirm.approveInfoGreenText')}</span>
                        </p>
                    </div>
                </div>
            </div>
        );
        return (
            <div class={[style.overlay, isActive].join(' ')} style="z-index: 10001; background-color: white;">
                <div class={[style.modal, isActive].join(' ')} style="border-radius: 0; box-shadow: none;">
                    <h3 class={style.modalHeader}>{title}</h3>
                    {
                        (children.length > 0 && includeDefault) && defaultContent
                    }
                    {
                        children.length > 0 ? (
                            <div class="flex flex-column flex-start">
                                {children}
                            </div>
                        ) : defaultContent
                    }
                </div>
            </div>
        );
    }
}
