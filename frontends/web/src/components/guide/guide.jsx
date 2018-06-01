import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import i18n from '../../i18n/i18n';
import style from './guide.css';

export function Guide({ guide, children }) {
    return (
        <div className={style.wrapper}>
            <div className={style.toggler} onClick={guide.toggle}>{guide.shown ? '!' : '?'}</div>
            {guide.shown &&
                <div className={'guide ' + style.guide}>
                    <h1>{i18n.t('guide.title')}</h1>
                    {children}
                </div>
            }
        </div>
    );
}

@translate()
export class Entry extends Component {
    constructor(props) {
        super(props);
        this.state = {
            shown: props.highlighted,
            highlighted: props.highlighted
        };
    }

    toggle = () => {
        this.setState(state => ({ shown: !state.shown, highlighted: false }));
    }

    render({
        t,
        title,
        children,
    }, {
        shown,
        highlighted,
    }) {
        return (
            <div className={highlighted ? style.highlighted : style.entry}>
                <h2 onClick={this.toggle}>{shown ? '–' : '+'} {title}</h2>
                {shown && children}
            </div>
        );
    }
}
