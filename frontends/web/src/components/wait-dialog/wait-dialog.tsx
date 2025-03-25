/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021-2024 Shift Crypto AG
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

import React, { Component, createRef, ReactNode } from 'react';
import { translate, TranslateProps } from '@/decorators/translate';
import { UseDisableBackButton } from '@/hooks/backbutton';
import style from '@/components/dialog/dialog.module.css';

interface WaitDialogProps {
  includeDefault?: boolean;
  prequel?: JSX.Element;
  title?: string;
  children?: ReactNode;
}

type Props = WaitDialogProps & TranslateProps;

interface State {
  active: boolean;
}

class WaitDialog extends Component<Props, State> {
  private overlay = createRef<HTMLDivElement>();
  private modal = createRef<HTMLDivElement>();

  public readonly state: State = {
    active: false,
  };

  public UNSAFE_componentWillMount() {
    document.body.addEventListener('keydown', this.handleKeyDown);
  }

  public componentDidMount() {
    setTimeout(this.activate, 10);
  }

  public componentWillUnmount() {
    document.body.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    e.preventDefault();
    e.stopPropagation();
  };

  private activate = () => {
    this.setState({ active: true }, () => {
      if (!this.overlay.current || !this.modal.current) {
        return;
      }
      this.overlay.current.classList.add(style.activeOverlay);
      this.modal.current.classList.add(style.activeModal);
    });
  };

  public render() {
    const { t, includeDefault, prequel, title, children } = this.props;
    const defaultContent = (
      <div>
        {prequel && <p className="m-top-none">{prequel}</p>}
        <p className={style.confirmationLabel}>{t('confirm.info')}</p>
      </div>
    );

    const hasChildren = React.Children.toArray(children).length > 0;
    return (
      <div
        className={style.overlay}
        ref={this.overlay}
        style={{ zIndex: 10001 }}
      >
        <UseDisableBackButton />
        <div className={[style.modal, style.open].join(' ')} ref={this.modal}>
          {title && (
            <div className={style.header}>
              <h3 className={style.title}>{title}</h3>
            </div>
          )}
          <div className={style.contentContainer}>
            <div className={style.content}>
              {hasChildren && includeDefault ? defaultContent : null}
              {hasChildren ? (
                <div className="flex flex-column flex-start">{children}</div>
              ) : (
                defaultContent
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const TranslatedWaitDialog = translate()(WaitDialog);
export { TranslatedWaitDialog as WaitDialog };
