import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import i18n from '../../i18n/i18n';
import A from '../../components/anchor/anchor';
import style from './guide.css';

export function Guide({ guide, screen, children }) {
    return (
        <div className={style.wrapper}>
            <div className={style.toggler} onClick={guide.toggle}>{guide.shown ? '✕' : '?'}</div>
            <div className={[style.guide, guide.shown && style.show].join(' ')}>
                <h1>{i18n.t('guide.title')}</h1>
                {screen && i18n.t('guide.' + screen).map(entry => <Entry entry={entry} />)}
                {children}
                <div className={style.entry}>
                    Another question? Contact us at <A href="mailto:support@shiftcrypto.ch">support@shiftcrypto.ch</A>!
                </div>
            </div>
        </div>
    );
}

@translate()
export class Entry extends Component {
    constructor(props) {
        super(props);
        this.state = {
            shown: props.shown || props.highlighted || (props.entry && props.entry.shown),
            highlighted: props.highlighted || (props.entry && props.entry.highlighted),
        };
    }

    toggle = () => {
        this.setState(state => ({
            shown: !state.shown,
            highlighted: false,
        }));
    }

    render({
        t,
        title,
        entry,
        children,
    }, {
        shown,
        highlighted,
    }) {
        return (
            <div className={highlighted ? style.highlighted : style.entry}>
                <div class={style.entryTitle} onClick={this.toggle}>
                    <div class={style.entryToggle}>{shown ? '–' : '+'}</div>
                    <div class={style.entryTitleText}>
                        <h2>
                            {title || (entry && entry.title)}
                        </h2>
                    </div>
                </div>
                <div class={[style.entryContent, shown ? style.expanded : ''].join(' ')}>
                    {shown && (
                        <div class="flex-1">
                            {entry && entry.text.map(p => <p>{p}</p>)}
                            {entry && entry.link && (
                                <p><A href={entry.link.url}>{entry.link.text}</A></p>
                            )}
                            {children}
                        </div>
                    )}
                </div>
            </div>
        );
    }
}
