import { h } from 'preact';
import style from './style';

export default function Dialog() {
    return (
        <div class={style.dialog}>
            {this.props.children}
        </div>
    );
}
