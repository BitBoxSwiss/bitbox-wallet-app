import { Component } from 'preact';
import style from './style'

export default class Dialog extends Component {
    render() {
        return (
            <div class={style.dialog}>
            {this.props.children}
            </div>
        )
    }
}
