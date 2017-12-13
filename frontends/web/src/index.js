import './style';
import TheApp from './components/app';
import i18n from './i18n';

import { I18nextProvider } from 'react-i18next';

export default function App() {
    return (
        <I18nextProvider i18n={ i18n }><TheApp /></I18nextProvider>
    );
}