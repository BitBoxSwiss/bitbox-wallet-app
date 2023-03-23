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

import { Component, ReactNode } from 'react';
import A from '../../components/anchor/anchor';
import { Button } from '../../components/forms/button';
import { Entry } from '../../components/guide/entry';
import { Guide } from '../../components/guide/guide';
import { SwissMadeOpenSource, SwissMadeOpenSourceDark } from '../../components/icon/logo';
import { Footer, Header } from '../../components/layout';
import { translate, TranslateProps } from '../../decorators/translate';
import { getDarkmode } from '../../components/darkmode/darkmode';
import externalIcon from './assets/external-link.svg';
import { data, ExchangeData, Method, Region } from './exchanges-data';
import styles from './exchanges.module.css';

interface ExchangesProps {
}

type Props = ExchangesProps & TranslateProps;

interface State {
    region: Region | null;
    method: Method | null;
}

type TExchange = ExchangeData & {
    hostname?: string;
}

class Exchanges extends Component<Props, State> {

  constructor(props: Props) {
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

  private data: TExchange[];

  private toggleRegion = (code: Region) => {
    this.setState(({ region }) => ({ region: region !== code ? code : null }));
  };

  private toggleMethod = (code: Method) => {
    this.setState(({ method }) => ({ method: method !== code ? code : null }));
  };

  public render() {
    const { t } = this.props;
    const { method, region } = this.state;
    const results = this.data
      .filter(({ regions }) => !region || regions.includes(region))
      .filter(({ payment }) => !method || payment.includes(method))
      .map(Row);
    return (
      <div className="contentWithGuide">
        <div className="container">
          <div className="innerContainer scrollableContainer">
            <Header title={<h2>{t('exchanges.title')}</h2>} />
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
              {getDarkmode() ? <SwissMadeOpenSourceDark /> : <SwissMadeOpenSource />}
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

type TFilterButtonProps = {
    active?: boolean;
    onClick: () => void;
    children: ReactNode;
}

function FilterButton({
  active = false,
  onClick,
  children,
}: TFilterButtonProps) {
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
}: TExchange) {
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

const HOC = translate()(Exchanges);
export { HOC as Exchanges };
