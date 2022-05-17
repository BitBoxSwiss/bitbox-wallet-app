/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2021 Shift Crypto AG
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

import { Component, createRef } from 'react';
import { translate, TranslateProps } from '../../decorators/translate';
import approve from '../../assets/icons/hold.png';
import reject from '../../assets/icons/tap.png';
import style from '../dialog/dialog.module.css';
import React from 'react';

interface WaitDialogProps {
    includeDefault?: boolean;
    prequel?: JSX.Element;
    title?: string;
    paired?: boolean;
    touchConfirm?: boolean;
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
  }

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
  }

  private activate = () => {
    this.setState({ active: true }, () => {
      if (!this.overlay.current || !this.modal.current) {
        return;
      }
      this.overlay.current.classList.add(style.activeOverlay);
      this.modal.current.classList.add(style.activeModal);
    });
  }

  public render() {
    const {
      t,
      includeDefault,
      prequel,
      title,
      paired = false,
      touchConfirm = true,
      children,
    } = this.props;
    const defaultContent = (
      <div>
        {
          prequel && (
            <p className="m-top-none">{prequel}</p>
          )
        }
        {
          paired ? (
            <div>
              <p className={[style.confirmationLabel, touchConfirm && paired ? style.disabledLabel : '', 'm-top-none'].join(' ')}>
                <span className={style.confirmationLabelNumber}>1.</span>
                {t('confirm.infoWhenPaired')}
              </p>
              <p className={[style.confirmationLabel, !touchConfirm && paired ? style.disabledLabel : ''].join(' ')}>
                <span className={style.confirmationLabelNumber}>2.</span>
                {t('confirm.info')}
              </p>
            </div>
          ) : (
            <p className={[style.confirmationLabel, style.noStep, 'm-top-none'].join(' ')}>
              {t('confirm.info')}
            </p>
          )
        }
        {
          touchConfirm && (
            <div className={['flex flex-row flex-between flex-items-stretch', style.confirmationInstructions].join(' ')}>
              <div className="flex flex-column flex-center flex-items-center">
                <img className={style.image} src={reject} alt="Reject" />
                <p>
                  {t('confirm.abortInfo')}
                  <span className="text-red">{t('confirm.abortInfoRedText')}</span>
                </p>
              </div>
              <div className="flex flex-column flex-center flex-items-center">
                <img className={style.image} src={approve} alt="Approve" />
                <p>
                  {t('confirm.approveInfo')}
                  <span className="text-green">{t('confirm.approveInfoGreenText')}</span>
                </p>
              </div>
            </div>
          )
        }
      </div>
    );

    const hasChildren = React.Children.toArray(children).length > 0;
    return (
      <div
        className={style.overlay}
        ref={this.overlay}
        style={{ zIndex: 10001 }}>
        <div className={style.modal} ref={this.modal}>
          {
            title && (
              <div className={style.header}>
                <h3 className={style.title}>{title}</h3>
              </div>
            )
          }
          <div className={style.contentContainer}>
            <div className={style.content}>
              { (hasChildren && includeDefault) ? defaultContent : null }
              { hasChildren ? (
                <div className="flex flex-column flex-start">
                  {children}
                </div>
              ) : defaultContent }
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const TranslatedWaitDialog = translate()(WaitDialog);
export { TranslatedWaitDialog as WaitDialog };
