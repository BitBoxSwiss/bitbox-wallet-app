import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../components/forms';
import { Shift, Alert } from '../../../components/icon';
import Footer from '../../../components/footer/footer';
import { Steps, Step } from './components/steps';
import InnerHTMLHelper from '../../../utils/innerHTML';
import style from '../device.css';

@translate()
export default class SecurityInformation extends Component {
    state = {
        showInfo: true,
    }

    handleStart = () => {
        this.setState({ showInfo: false });
    }

    render({
        t,
        goBack,
        goal,
        children,
    }, {
        showInfo,
    }) {
        if (!showInfo) {
            return children[0];
        }
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <div className={style.content}>
                        <Steps current={0}>
                            <Step title={t('goal.step.1.title')} description={t('goal.step.1.description')} />
                            <Step divider />
                            <Step title={t('goal.step.2.title')} description={t('goal.step.2.description')} />
                            <Step divider />
                            <Step title={t(`goal.step.3_${goal}.title`)} description={t(`goal.step.3_${goal}.description`)} />
                            <Step divider />
                            <Step title={t(`goal.step.4_${goal}.title`)} description={t(`goal.step.4_${goal}.description`)} />
                        </Steps>
                        <hr />
                        <h1 class={style.title}>{t(`securityInformation.${goal}.title`)}</h1>
                        {
                            goal === 'create' ? (
                                <div class={style.block}>
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.create.description_1')} />
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.create.description_2')} />
                                    <ul class={style.list}>
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.create.description_3')} />
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.create.description_4')} />
                                    </ul>
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.create.description_5')} />
                                    <div className={['buttons buttons-end', style.buttons].join(' ')}>
                                        <Button
                                            transparent
                                            onClick={goBack}>
                                            {t('button.back')}
                                        </Button>
                                        <Button primary onClick={this.handleStart}>
                                            {t('securityInformation.create.button')}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div class={style.block}>
                                    <ul class={style.list}>
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.restore.description_1')} />
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.restore.description_2')} />
                                    </ul>
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.restore.description_3')} />
                                    <Alert style="float: left; margin-right: var(--spacing-half);" />
                                    <InnerHTMLHelper tagName="p" html={t('deviceTampered')} />
                                    <div className={['buttons buttons-end', style.buttons].join(' ')}>
                                        <Button
                                            transparent
                                            onClick={goBack}>
                                            {t('button.back')}
                                        </Button>
                                        <Button primary onClick={this.handleStart}>
                                            {t('securityInformation.restore.button')}
                                        </Button>
                                    </div>
                                </div>
                            )
                        }
                        <hr />
                        <Footer bottomSpace>
                            <Shift />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
