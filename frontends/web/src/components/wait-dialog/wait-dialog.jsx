import { Component } from 'preact';
import style from './wait-dialog.css';

import approve from '../../assets/device/approve.png';
import reject from '../../assets/device/reject.png';

export default class WaitDialog extends Component {
    state = {
        active: false,
    }

    componentDidMount() {
        setTimeout(this.activate, 5);
    }

    activate = () => {
        this.setState({ active: true });
    }

    render({
        includeDefault,
        title,
        children,
    }, {
        active,
    }) {
        const isActive = active ? 'active' : '';
        const defaultContent = (
            <div class="flex flex-column flex-start">
                <p class={['label', style.confirmationLabel].join(' ')}>
                    On your device
                </p>
                <div class={['flex', 'flex-row', 'flex-around', 'flex-items-end', style.confirmationInstructions].join(' ')}>
                    <div class="flex flex-column flex-center flex-items-center">
                        <img src={reject} alt="Reject" />
                        <p class="text-bold">Tap to <span class="text-red">abort</span></p>
                    </div>
                    <div class="flex flex-column flex-center flex-items-center">
                        <img src={approve} alt="Approve" />
                        <p class="text-bold">Hold 3+ secs to <span class="text-green">confirm</span></p>
                    </div>
                </div>
            </div>
        );
        return (
            <div class={['overlay', isActive].join(' ')}>
                <div class={['modal', isActive].join(' ')}>
                    <h3 class="modalHeader">{title}</h3>
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
