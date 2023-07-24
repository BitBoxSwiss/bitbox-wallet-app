/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2023 Shift Crypto AG
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

import { FunctionComponent, useState } from 'react';
import { A } from '../anchor/anchor';
import style from './guide.module.css';

export type TEntryProp = {
    title: string;
    text: string;
    link?: {
        url: string;
        text: string;
    };
}

type TEntryProps = {
    entry: TEntryProp;
    shown?: boolean;
}

type TProps = TEntryProps;

export const Entry: FunctionComponent<TProps> = props => {
  const [shown, setShown] = useState<boolean>(props.shown || false);

  const toggle = () => {
    setShown(shown => !shown);
  };

  const entry = props.entry;
  return (
    <div className={style.entry}>
      <div className={style.entryTitle} onClick={toggle}>
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
              <p>
                <A
                  className={style.link}
                  data-testid="link"
                  href={entry.link.url}>
                  {entry.link.text}
                </A>
              </p>
            )}
            {props.children}
          </div>
        ) : null}
      </div>
    </div>
  );
};
