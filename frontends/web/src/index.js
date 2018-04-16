import { I18nextProvider } from 'react-i18next';

import TheApp from './app';
import i18n from './i18n/i18n';
import './style';


export default function App() {
    return (
        <I18nextProvider i18n={ i18n }><TheApp /></I18nextProvider>
    );
}
