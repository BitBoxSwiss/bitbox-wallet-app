/**
 * Copyright 2020 Shift Devices AG
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

import { Component, h, JSX, RenderableProps } from 'preact';
import A from '../../components/anchor/anchor';
import Button from '../../components/forms/button';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { SwissMadeOpenSource } from '../../components/icon/logo';
import { Footer, Header } from '../../components/layout';
import { translate, TranslateProps } from '../../decorators/translate';

import externalIcon from './assets/external-link.svg';
import { data, ExchangeData, Method, Region } from './exchanges-data';
import * as styles from './exchanges.module.css';

interface ExchangesProps {
}

type Props = ExchangesProps & TranslateProps;

interface State {
    region: Region | null;
    method: Method | null;
}

interface Exchange extends ExchangeData {
    hostname?: string;
}

class Exchanges extends Component<Props, State> {

    constructor(props) {
        super(props);
        this.data = data.map(({ link, ...rest }) => ({
            ...rest,
            link,
            hostname: new URL(link).hostname,
        }));
        this.state = {
            region: null,
            method: null,
        };
    }

    private data: Exchange[];

    private toggleRegion = code => {
        this.setState(({ region }) => ({ region: region !== code ? code : null }));
    }

    private toggleMethod = code => {
        this.setState(({ method }) => ({ method: method !== code ? code : null }));
    }

    public render(
        { t }: RenderableProps<Props>,
        {
        method,
        region,
    }) {
        const results = this.data
            .filter(({ regions }) => !region || regions.includes(region))
            .filter(({ payment }) => !method || payment.includes(method))
            .map(Row);
        return (
            <div className="contentWithGuide">
                <div className="container">
                    <Header title={<h2>{t('exchanges.title')}</h2>}>
                    </Header>
                    <div className="innerContainer scrollableContainer">
                        <div className="content padded">
                            <div className={styles.filters}>
                                <div className={styles.regions}>
                                    <h4>{t('exchanges.region')}</h4>
                                    <FilterButton
                                        active={region === 'NA'}
                                        onClick={() => this.toggleRegion('NA')} >
                                        {t('exchanges.regions.NA')}
                                    </FilterButton>
                                    <FilterButton
                                        active={region === 'LA'}
                                        onClick={() => this.toggleRegion('LA')} >
                                        {t('exchanges.regions.LA')}
                                    </FilterButton>
                                    <FilterButton
                                        active={region === 'EU'}
                                        onClick={() => this.toggleRegion('EU')} >
                                        {t('exchanges.regions.EU')}
                                    </FilterButton>
                                    <FilterButton
                                        active={region === 'AF'}
                                        onClick={() => this.toggleRegion('AF')} >
                                        {t('exchanges.regions.AF')}
                                    </FilterButton>
                                    <FilterButton
                                        active={region === 'APAC'}
                                        onClick={() => this.toggleRegion('APAC')} >
                                        {t('exchanges.regions.APAC')}
                                    </FilterButton>
                                </div>
                                <div className={styles.methods}>
                                    <h4>{t('exchanges.method')}</h4>
                                    <FilterButton
                                        active={method === 'BT'}
                                        onClick={() => this.toggleMethod('BT')} >
                                        {t('exchanges.methods.BT')}
                                    </FilterButton>
                                    <FilterButton
                                        active={method === 'CC'}
                                        onClick={() => this.toggleMethod('CC')} >
                                        {t('exchanges.methods.CC')}
                                    </FilterButton>
                                    <FilterButton
                                        active={method === 'DCA'}
                                        onClick={() => this.toggleMethod('DCA')} >
                                        {t('exchanges.methods.DCA')}
                                    </FilterButton>
                                    <FilterButton
                                        active={method === 'SW'}
                                        onClick={() => this.toggleMethod('SW')} >
                                        {t('exchanges.methods.SW')}
                                    </FilterButton>
                                    <FilterButton
                                        active={method === 'P2P'}
                                        onClick={() => this.toggleMethod('P2P')} >
                                        {t('exchanges.methods.P2P')}
                                    </FilterButton>
                                </div>
                            </div>
                            <div className={styles.results}>
                                {results.length ? results : t('exchanges.nomatch')}
                            </div>
                        </div>
                        <Footer>
                            <SwissMadeOpenSource />
                        </Footer>
                    </div>
                </div>
                <Guide>
                    <Entry key="exchangeDescription" entry={t('guide.exchanges.description')} />
                    <Entry key="exchangeWhichService" entry={t('guide.exchanges.whichService')} />
                    <Entry key="accountTransactionConfirmation" entry={t('guide.exchanges.commission')} />
                </Guide>
            </div>
        );
    }
}

interface FilterButtonProps {
    active?: boolean;
    onClick: () => void;
    children: JSX.Element;
}

function FilterButton({
    active = false,
    onClick,
    children,
}: RenderableProps<FilterButtonProps>): JSX.Element {
    return (
        <Button
            primary={active}
            transparent={!active}
            onClick={onClick} >
            {children}
        </Button>
    );
}

function Row({
    key,
    description,
    hostname,
}: RenderableProps<Exchange>): JSX.Element {
    return (
        <A
            key={key}
            href={`https://ext.shiftcrypto.ch/${key}`}
            title={hostname}
            className={styles.row}
        >
            <div className={`${styles.image} ${styles[`logo-${key}`]}`}>
            </div>
            <div className={styles.description}>
                {description}
                <div className="exchange-hostname">
                    {hostname}
                </div>
            </div>
            <div className={styles.button}>
                <img src={externalIcon} />
            </div>
        </A>
    );
}

const HOC = translate<ExchangesProps>()(Exchanges);
export { HOC as Exchanges };
