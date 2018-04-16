import { h } from 'preact';
import style from './dialog.css';

export default function Dialog() {
    return (
        <div className={style.dialog}>
            {this.props.children}
        </div>
    );
}
