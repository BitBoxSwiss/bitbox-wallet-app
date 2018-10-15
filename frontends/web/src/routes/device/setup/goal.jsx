import { Component, h } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../components/forms';
import { Shift } from '../../../components/icon/logo';
import Footer from '../../../components/footer/footer';
import * as style from '../device.css';

@translate()
export default class Goal extends Component {
    render({
        t,
        onCreate,
        onRestore,
    }) {
        return (
            <div class="contentWithGuide">
                <div className={[style.container].join(' ')}>
                    <div className={style.content} style="text-align: center;">
                        <div className="flex-1 flex flex-column flex-center">
                            <h1 className={style.title}>{t('setup')}</h1>
                            <p class="first">{t('goal.paragraph')}</p>
                            <div class={style.verticalButtons}>
                                <Button primary onClick={onCreate}>
                                    {t('goal.buttons.create')}
                                </Button>
                                <Button secondary onClick={onRestore}>
                                    {t('goal.buttons.restore')}
                                </Button>
                            </div>
                        </div>
                        <hr />
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
