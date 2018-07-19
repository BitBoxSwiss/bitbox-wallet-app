import { Component } from 'preact';
import { translate } from 'react-i18next';
import approve from '../../assets/icons/checked.svg';
import reject from '../../assets/icons/cancel.svg';
import style from '../dialog/dialog.css';

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
        paired = false,
        children,
    }, {
        active,
    }) {
        const isActive = active ? style.active : '';
        const defaultContent = (
            <div class="flex flex-column flex-start">
                {
                    prequel && (
                        <p>{prequel}</p>
                    )
                }
                <p class={['label', style.confirmationLabel].join(' ')}>
                    {paired ? t('confirm.infoWhenPaired') : t('confirm.info')}
                </p>
                <div class={['flex flex-row flex-between flex-items-stretch', style.confirmationInstructions].join(' ')}>
                    <div class="flex flex-row flex-start flex-items-center">
                        <img class={style.image} src={reject} alt="Reject" />
                        <p class="text-bold">
                            {t('confirm.abortInfo')}
                            <span class="text-red">{t('confirm.abortInfoRedText')}</span>
                        </p>
                    </div>
                    <div class="flex flex-row flex-start flex-items-center">
                        <img class={style.image} src={approve} alt="Approve" />
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
