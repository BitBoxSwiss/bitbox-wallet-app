import { Component } from 'preact';
import { translate } from 'react-i18next';
import { Button } from '../../../components/forms';
import { Shift, Alert } from '../../../components/icon';
import Footer from '../../../components/footer/footer';
import { Steps, Step } from './components/steps';
import InnerHTMLHelper from '../../../utils/innerHTML';
import Message from '../../../components/message/message';
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
                <div className={[style.container, 'scrollableContainer'].join(' ')}>
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
                                    <ul class={[style.list, 'first'].join(' ')}>
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.create.description_3')} />
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.create.description_4')} />
                                    </ul>
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.create.description_5')} />
                                    <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                                        <Button
                                            secondary
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
                                    <ul class={[style.list, 'first'].join(' ')}>
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.restore.description_1')} />
                                        <InnerHTMLHelper tagName="li" html={t('securityInformation.restore.description_2')} />
                                    </ul>
                                    <InnerHTMLHelper tagName="p" html={t('securityInformation.restore.description_3')} />
                                    <Message type="warning">
                                        <Alert />
                                        <InnerHTMLHelper tagName="p" class="first" html={t('deviceTampered')} />
                                    </Message>
                                    <div className={['buttons flex flex-row flex-between', style.buttons].join(' ')}>
                                        <Button
                                            secondary
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
                        <Footer>
                            <Shift />
                        </Footer>
                    </div>
                </div>
            </div>
        );
    }
}
