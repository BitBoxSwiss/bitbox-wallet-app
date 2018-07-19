import { Component } from 'preact';
import { BitBox } from '../icon/logo';
import style from './Spinner.css';

export default class Spinner extends Component {
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

    render({
        text,
        showLogo = false,
    }, {

    }) {
        return (
            <div className={style.spinnerContainer}>
                <div className={style.logo} style={showLogo && 'visibility:visible'}>
                    <BitBox  />
                </div>
                {
                    text && (
                        <p className={style.spinnerText}>{text}</p>
                    )
                }
                <div className={style.spinner}>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                <div className={style.overlay}></div>
            </div>
        );
    }
}
