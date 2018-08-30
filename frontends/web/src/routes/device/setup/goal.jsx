import { h } from 'preact';
import i18n from '../../../i18n/i18n';
import { Button } from '../../../components/forms';
import { Shift } from '../../../components/icon/logo';
// import { Guide } from '../../../components/guide/guide';
import Footer from '../../../components/footer/footer';
// import { Steps, Step } from './components/steps';
import style from '../device.css';

export default function Goal({
    onCreate,
    onRestore,
}) {
    const title = i18n.t('goal.title');
    return (
        <div class="contentWithGuide">
            <div className={[style.container].join(' ')}>
                <div className={style.content} style="text-align: center;">
                    <h1 className={style.title}>{i18n.t('setup')}</h1>
                    {/*
                    <Steps current={0}>
                        <Step icon="?" description="" />
                        <Step />
                        <Step  />
                    </Steps>
                      */}
                    <div class={style.block}>
                        {
                            title && (
                                <h2>{title}</h2>
                            )
                        }
                        <p>{i18n.t('goal.paragraph')}</p>
                        <div class={style.verticalButtons}>
                            <Button primary onClick={onCreate}>
                                {i18n.t('goal.buttons.create')}
                            </Button>
                            <Button secondary onClick={onRestore}>
                                {i18n.t('goal.buttons.restore')}
                            </Button>
                        </div>
                    </div>
                    <hr />
                    <Footer bottomSpace>
                        <Shift />
                    </Footer>
                </div>
            </div>
        </div>
    );
}
