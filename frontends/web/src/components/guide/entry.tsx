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

import { Component } from 'react';
import A from '../anchor/anchor';
import style from './guide.module.css';

export interface EntryProp {
    title: string;
    text: string;
    link?: {
        url: string;
        text: string;
    };
}

interface EntryProps {
    entry: EntryProp | string; // string could be the entry translation key in cimode, e.g. 'guide.waiting.1'.
    shown?: boolean;
    highlighted?: boolean;
}

type Props = EntryProps;

interface State {
    shown: boolean;
    highlighted: boolean;
}

export class Entry extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      shown: props.shown || props.highlighted || false,
      highlighted: props.highlighted || false,
    };
  }

  private toggle = () => {
    this.setState(state => ({
      shown: !state.shown,
      highlighted: false,
    }));
  };

  public render() {
    const props = this.props;
    const {
      shown,
      highlighted,
    } = this.state;
    let entry: EntryProp;
    if (typeof props.entry === 'string') {
      entry = {
        title: props.entry + '.title',
        text: props.entry + '.text',
        link: {
          url: props.entry + '.link.url',
          text: props.entry + '.link.text',
        },
      };
    } else {
      entry = props.entry;
    }
    return (
      <div className={highlighted ? style.highlighted : style.entry}>
        <div className={style.entryTitle} onClick={this.toggle}>
          <div className={style.entryToggle}>{shown ? '–' : '+'}</div>
          <div className={style.entryTitleText}>
            <h2>{entry.title}</h2>
          </div>
        </div>
        <div className={[style.entryContent, shown ? style.expanded : ''].join(' ')}>
          {shown ? (
            <div className="flex-1">
              {entry.text.trim().split('\n').map(p => <p key={p}>{p}</p>)}
              {entry.link && (
                <p><A href={entry.link.url}>{entry.link.text}</A></p>
              )}
              {props.children}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
