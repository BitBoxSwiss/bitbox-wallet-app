import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Shift } from '../../../components/icon';
import Footer from '../../../components/footer/footer';
import { Steps, Step } from './components/steps';
import style from '../device.css';

@translate()
export default class Success extends Component {
    render({
        t,
        goal,
    }, {
    }) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <div className={style.content}>
                        <Steps current={3}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3_${goal}.title`)} description={t(`goal.step.3_${goal}.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_${goal}.title`)} description={t(`goal.step.4_${goal}.description`)} />
                        </Steps>
                        <hr />
                        <h1 class={style.title}>{t(`success.${goal}.title`)}</h1>
                        <div class={style.block}>
                            {t(`success.${goal}.info`)}
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
