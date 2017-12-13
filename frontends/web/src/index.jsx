import './style';
import App from './components/app';

export default function TranslatedApp() {
    return (
            <I18nextProvider i18n={ i18n }><App /></I18nextProvider>
    );
}