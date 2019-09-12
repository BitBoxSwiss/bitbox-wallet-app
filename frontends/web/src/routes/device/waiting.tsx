/**
 * Copyright 2018 Shift Devices AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, h, RenderableProps } from 'preact';
import { Button } from '../../components/forms';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { store as panelStore } from '../../components/guide/guide';
import { AppLogo } from '../../components/icon/logo';
import { Footer, Header } from '../../components/layout';
import { PasswordSingleInput } from '../../components/password';
import { toggleForceHide } from '../../components/sidebar/sidebar';
import { load } from '../../decorators/load';
import { translate, TranslateProps } from '../../decorators/translate';
import { debug } from '../../utils/env';
import { apiPost } from '../../utils/request';
import * as style from './device.css';

interface TestingProps {
    testing?: boolean;
}

type WaitingProps = TestingProps & TranslateProps;

class Waiting extends Component<WaitingProps> {
    public componentWillMount() {
        if (!panelStore.state.forceHiddenSidebar) {
            toggleForceHide();
        }
    }

    public render(
        { t, testing }: RenderableProps<WaitingProps>,
    ) {
        return (
            <div class="contentWithGuide">
                <div className={style.container}>
                    <Header title={<h2>{t('welcome.title')}</h2>} />
                    <div className={style.content}>
                        <div className="flex-1 flex flex-column flex-center">
                            <AppLogo />
                            <div className={style.waitingContent}>
                                <h3 className={style.waitingText}>{t('welcome.insertDevice')}</h3>
                                <span className={style.waitingDescription}>{t('welcome.insertBitBox02')}</span>
                            </div>
                            {
                                testing && (
                                    <div className={style.testingContainer}>
                                        <SkipForTesting show={!!testing} />
                                    </div>
                                )
                            }
                        </div>
                        <Footer />
                    </div>
                </div>
                <Guide>
                    <Entry entry={t('guide.waiting.welcome')} shown={true} />
                    <Entry entry={t('guide.waiting.getDevice')} />
                    <Entry entry={t('guide.waiting.lostDevice')} />
                    <Entry entry={t('guide.waiting.internet')} />
                    <Entry entry={t('guide.waiting.deviceNotRecognized')} />
                    <Entry entry={t('guide.waiting.useWithoutDevice')} />
                </Guide>
            </div>
        );
    }
}

interface SkipForTestingProps {
    show: boolean;
}

interface SkipForTestingState {
    testPIN: string;
}

class SkipForTesting extends Component<SkipForTestingProps, SkipForTestingState> {
    public state = {
        testPIN: '',
    };

    private registerTestingDevice = (e: Event) => {
        apiPost('test/register', { pin: this.state.testPIN });
        e.preventDefault();
    }

    private handleFormChange = (value: string) => {
        this.setState({ testPIN: value });
    }

    public render({ show }: RenderableProps<SkipForTestingProps>, { testPIN }: SkipForTestingState) {
        if (!show) {
            return null;
        }
        return (
            <form onSubmit={this.registerTestingDevice} style="flex-grow: 0; max-width: 400px; width: 100%; align-self: center;">
                <PasswordSingleInput
                    type="password"
                    autoFocus
                    label="Test Password"
                    onValidPassword={this.handleFormChange}
                    value={testPIN} />
                <Button type="submit" secondary>
                    Skip for Testing
                </Button>
            </form>
        );
    }
}

const loadHOC = load<TestingProps, TranslateProps>(() => debug ? { testing: 'testing' } : {})(Waiting);
const translateHOC = translate()(loadHOC);
export { translateHOC as Waiting };
