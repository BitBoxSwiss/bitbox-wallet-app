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

import { Component, h, RenderableProps } from 'preact';
import A from '../../components/anchor/anchor';
import Button from '../../components/forms/button';
import { SwissMadeOpenSource } from '../../components/icon/logo';
import { Footer, Header } from '../../components/layout';
import { Spinner } from '../../components/spinner/Spinner';
import { translate, TranslateProps } from '../../decorators/translate';

import externalIcon from './assets/external-link.svg';
import { data, ExchangeData, Method, Region } from './exchanges-data';
import * as styles from './exchanges.css';

interface ExchangesProps {
}

type Props = ExchangesProps & TranslateProps;

type Method = 'BT' | 'DCA' | 'CC' | 'SW' | 'P2P';
type Region = 'NA' | 'LA' | 'EU' | 'AF' | 'APAC';

interface State {
    status: 'loading' | 'loaded' | 'error';
    region: Region | null;
    methods: Method[];
}

interface Exchange {
    key: string;
    link: string;
    description: string;
    regions: Region[];
    payment: Method[];
    hostname?: string;
}

class Exchanges extends Component<Props, State> {

    constructor(props) {
        super(props);
        this.state = {
            status: 'loading',
            region: null,
            methods: [],
        };
        this.data = [];
    }

    private data: Exchange[];

    public componentDidMount() {
        fetch('/assets/exchanges/exchanges.json')
            .then(res => res.json())
            .then(data => data.map(({link, ...rest}) => ({
                ...rest,
                link,
                hostname: new URL(link).hostname,
            })))
            .then(data => this.data = data)
            .then(() => this.setState({ status: 'loaded', region: null, methods: [] }))
            .catch(() => this.setState({ status: 'error' }));
    }

    private toggleRegion = code => {
        this.setState(({ region }) => ({ region: region !== code ? code : null }));
    }

    private toggleMethods = method => {
        this.setState(({ methods }) => ({
            methods: methods.includes(method)
                ? methods.filter(m => m !== method)
                : [method, ...methods],
        }));
    }

    public render(
        { t }: RenderableProps<Props>,
        {
        status,
        methods,
        region,
    }) {
        if (status === 'error') {
            return 'Error';
        }
        if (status === 'loading') {
            return <div className="contentWithGuide">
                <Spinner />
            </div>;
        }
        const results = this.data
            .filter(({ regions }) => !region || regions.includes(region))
            .filter(({ payment }) => !methods.length || methods.some(m => payment.includes(m)))
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
                                        active={methods.includes('BT')}
                                        onClick={() => this.toggleMethods('BT')} >
                                        {t('exchanges.methods.BT')}
                                    </FilterButton>
                                    <FilterButton
                                        active={methods.includes('CC')}
                                        onClick={() => this.toggleMethods('CC')} >
                                        {t('exchanges.methods.CC')}
                                    </FilterButton>
                                    <FilterButton
                                        active={methods.includes('DCA')}
                                        onClick={() => this.toggleMethods('DCA')} >
                                        {t('exchanges.methods.DCA')}
                                    </FilterButton>
                                    <FilterButton
                                        active={methods.includes('SW')}
                                        onClick={() => this.toggleMethods('SW')} >
                                        {t('exchanges.methods.SW')}
                                    </FilterButton>
                                    <FilterButton
                                        active={methods.includes('P2P')}
                                        onClick={() => this.toggleMethods('P2P')} >
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
