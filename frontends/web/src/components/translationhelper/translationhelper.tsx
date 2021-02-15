import { Component } from 'preact';
import { i18nEditorActive } from '../../i18n/i18n';

export default class TranslationHelper extends Component {
    private lastLanguage: string | null;
    constructor(props) {
        super(props);
        this.lastLanguage = null;
    }

    private keydownHandler = e => {
        if (!i18nEditorActive) {
            return;
        }
        if (e.shiftKey && this.lastLanguage === null && this.context.i18n.language !== 'cimode') {
            this.lastLanguage = this.context.i18n.language;
            const editorModule = this.context.i18n.modules.external[0];
            // So the editor doesn't use 'cimode' and then fall back to the reference language.
            editorModule.options.lngOverride = this.lastLanguage;
            this.context.i18n.changeLanguage('cimode');
            editorModule.on();
            setTimeout(() => {
                if (this.lastLanguage !== null) {
                    editorModule.off();
                    this.context.i18n.changeLanguage(this.lastLanguage);
                    this.lastLanguage = null;
                }
            }, 3000);
        }
    }

    public componentWillMount() {
        document.addEventListener('keydown', this.keydownHandler);
    }

    public componentWillUnmount() {
        document.removeEventListener('keydown', this.keydownHandler);
    }

    public render({}, {}) { return null; }
}
