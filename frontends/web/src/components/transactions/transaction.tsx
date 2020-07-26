/**
 * Copyright 2018 Shift Devices AG
 * Copyright 2020 Shift Crypto AG
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
import { Input } from '../../components/forms';
import { translate, TranslateProps } from '../../decorators/translate';
import { AmountWithConversions } from '../../routes/account/send/send';
import A from '../anchor/anchor';
import { Dialog } from '../dialog/dialog';
import { ExpandIcon } from '../icon/icon';
import { ProgressRing } from '../progressRing/progressRing';
import { FiatConversion } from '../rates/rates';
import { AmountInterface } from '../rates/rates';
import { ArrowIn, ArrowOut, ArrowSelf, Edit, Save } from './components/icons';
import * as style from './transaction.css';
import * as parentStyle from './transactions.css';

interface State {
    transactionDialog: boolean;
    newNote: string;
    editMode: boolean;
}

export interface TransactionInterface {
    type: 'send' | 'receive' | 'self';
    txID: string;
    amount: AmountInterface;
    fee: AmountWithConversions;
    feeRatePerKb: AmountWithConversions;
    gas: number;
    vsize: number;
    size: number;
    weight: number;
    numConfirmations: number;
    numConfirmationsComplete: number;
    time: string | null;
    addresses: string[];
    status: 'complete' | 'pending' | 'failed';
    internalID: string;
    note: string;
}

interface TransactionProps extends TransactionInterface {
    index: number;
    explorerURL: string;
}

type Props = TransactionProps & TranslateProps;

class Transaction extends Component<Props, State> {
    private input!: HTMLInputElement;
    private editButton!: HTMLButtonElement;

    public readonly state: State = {
        transactionDialog: false,
        newNote: this.props.note,
        editMode: !this.props.note,
    };

    private parseTimeShort = time => {
        const options = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
        };
        return new Date(Date.parse(time)).toLocaleString(this.context.i18n.language, options);
    }

    private showDetails = () => {
        this.setState({ transactionDialog: true });
    }

    private hideDetails = () => {
        this.setState({ transactionDialog: false });
    }

    private handleNoteInput = (e: Event) => {
        const target = e.target as HTMLInputElement;
        this.setState({ newNote: target.value });
    }

    private handleEdit = () => {
        if (this.state.editMode && this.props.note !== this.state.newNote) {
            // TODO: send to backend
            console.log('save', this.props.txID, this.state.newNote); // tslint:disable-line:no-console
        }
        this.setState(
            ({ editMode }) => ({ editMode: !editMode }),
            this.focusEdit,
        );
    }

    private focusEdit = () => {
        if (this.editButton) {
            this.editButton.blur();
        }
        if (this.state.editMode && this.input) {
            this.input.focus();
        }
    }

    private setInputRef = input => {
        this.input = input;
    }

    private setEditButtonRef = button => {
        this.editButton = button;
    }

    public render({
        t,
        index,
        explorerURL,
        type,
        txID,
        amount,
        fee,
        feeRatePerKb,
        gas,
        vsize,
        size,
        weight,
        numConfirmations,
        numConfirmationsComplete,
        time,
        addresses,
        status,
        note = '',
    }: RenderableProps<Props>,
                  {
        transactionDialog,
        newNote,
        editMode,
    }: State) {
        const arrow = type === 'receive' ? (
            <ArrowIn />
        ) : type === 'send' ? (
            <ArrowOut />
        ) : (
            <ArrowSelf />
        );
        const sign = ((type === 'send') && '−') || ((type === 'receive') && '+') || null;
        const typeClassName = (type === 'send' && style.send) || (type === 'receive' && style.receive) || '';
        const sDate = time ? this.parseTimeShort(time) : '---';
        const statusText = {
            complete: t('transaction.status.complete'),
            pending: t('transaction.status.pending'),
            failed: t('transaction.status.failed'),
        }[status];
        const progress = numConfirmations < numConfirmationsComplete ? (numConfirmations / numConfirmationsComplete) * 100 : 100;
        return (
            <div className={[style.container, index === 0 ? style.first : ''].join(' ')}>
                <div className={[parentStyle.columns, style.row].join(' ')}>
                    <div className={parentStyle.columnGroup}>
                        <div className={parentStyle.type}>{arrow}</div>
                        <div className={parentStyle.date}>
                            <span className={style.columnLabel}>
                                {t('transaction.details.date')}:
                            </span>
                            <span className={style.date}>{sDate}</span>
                        </div>
                        { note ? (
                            <div className={parentStyle.activity}>
                                <span className={style.address}>
                                    {note}
                                </span>
                            </div>
                        ) : (
                            <div className={parentStyle.activity}>
                                <span className={style.label}>
                                    {t(`transaction.tx.${type === 'receive' ? 'received' : 'sent'}`)}
                                </span>
                                <span className={style.address}>
                                    {addresses[0]}
                                    {addresses.length > 1 && (
                                        <span className={style.badge}>
                                            (+{addresses.length - 1})
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}
                        <div className={[parentStyle.action, parentStyle.hideOnMedium].join(' ')}>
                            <button type="button" className={style.action} onClick={this.showDetails}>
                                <ExpandIcon expand={!transactionDialog} />
                            </button>
                        </div>
                    </div>
                    <div className={parentStyle.columnGroup}>
                        <div className={parentStyle.status}>
                            <span className={style.columnLabel}>
                                {t('transaction.details.status')}:
                            </span>
                            <ProgressRing
                                className="m-right-quarter"
                                width={14}
                                value={progress}
                                isComplete={numConfirmations >= numConfirmationsComplete}
                            />
                            <span className={style.status}>{statusText}</span>
                        </div>
                        <div className={parentStyle.fiat}>
                            <span className={`${style.fiat} ${typeClassName}`}>
                                <FiatConversion amount={amount} noAction>{sign}</FiatConversion>
                            </span>
                        </div>
                        <div className={parentStyle.currency}>
                            <span className={`${style.currency} ${typeClassName}`}>
                                {sign}{amount.amount}
                                {' '}
                                <span className={style.currencyUnit}>{amount.unit}</span>
                            </span>
                        </div>
                        <div className={[parentStyle.action, parentStyle.showOnMedium].join(' ')}>
                            <button type="button" className={style.action} onClick={this.showDetails}>
                                <ExpandIcon expand={!transactionDialog} />
                            </button>
                        </div>
                    </div>
                </div>
                {
                    transactionDialog && (
                        <Dialog title="Transaction Details" onClose={this.hideDetails} slim medium>
                            <div className={style.detailInput}>
                                <label>{t('note.title')}</label>
                                <Input
                                    align="right"
                                    autoFocus={note ? 'false' : 'true'}
                                    className={style.textOnlyInput}
                                    readOnly={!editMode && !!note}
                                    type="text"
                                    transparent
                                    placeholder={t('note.input.placeholder')}
                                    value={newNote || note}
                                    onInput={this.handleNoteInput}
                                    getRef={this.setInputRef}/>
                                <button
                                    className={style.editButton}
                                    onClick={this.handleEdit}
                                    title={t(`transaction.note.${editMode ? 'save' : 'edit'}`)}
                                    type="button"
                                    ref={this.setEditButtonRef}>
                                        {editMode ? <Save /> : <Edit />}
                                </button>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.details.type')}</label>
                                <p>{arrow}</p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.confirmation')}</label>
                                <p>{numConfirmations}</p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.details.status')}</label>
                                <p className="flex flex-items-center">
                                    <ProgressRing
                                        className="m-right-quarter"
                                        width={14}
                                        value={progress}
                                        isComplete={numConfirmations >= numConfirmationsComplete}
                                    />
                                    <span className={style.status}>
                                        {statusText} {
                                            status === 'pending' && (
                                                <span>({numConfirmations}/{numConfirmationsComplete})</span>
                                            )
                                        }
                                    </span>
                                </p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.details.date')}</label>
                                <p>{sDate}</p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.details.fiat')}</label>
                                <p>
                                    <span className={`${style.fiat} ${typeClassName}`}>
                                        <FiatConversion amount={amount} noAction>{sign}</FiatConversion>
                                    </span>
                                </p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.details.amount')}</label>
                                <p>
                                    <span className={`${style.currency} ${typeClassName}`}>
                                        {sign}{amount.amount}
                                        {' '}
                                        <span className={style.currencyUnit}>{amount.unit}</span>
                                    </span>
                                </p>
                            </div>
                            <div className={style.detail}>
                                <label>{t('transaction.fee')}</label>
                                {
                                    fee && fee.amount ? (
                                        <p title={feeRatePerKb.amount ? feeRatePerKb.amount + ' ' + feeRatePerKb.unit + '/Kb' : ''}>
                                            {fee.amount}
                                            {' '}
                                            <span className={style.currencyUnit}>{fee.unit}</span>
                                        </p>
                                    ) : (
                                        <p>---</p>
                                    )
                                }
                            </div>
                            <div className={[style.detail, style.addresses].join(' ')}>
                                <label>{t('transaction.details.address')}</label>
                                <span>
                                    {
                                        addresses.map(address => (
                                            <p key={address} className="text-break">{address}</p>
                                        ))
                                    }
                                </span>
                            </div>
                            {
                                gas ? (
                                    <div className={style.detail}>
                                        <label>{t('transaction.gas')}</label>
                                        <p>{gas}</p>
                                    </div>
                                ) : null
                            }
                            {
                                weight ? (
                                    <div className={style.detail}>
                                        <label>{t('transaction.weight')}</label>
                                        <p>
                                            {weight}
                                            {' '}
                                            <span className={style.currencyUnit}>WU</span>
                                        </p>
                                    </div>
                                ) : null
                            }
                            {
                                vsize ? (
                                    <div className={style.detail}>
                                        <label>{t('transaction.vsize')}</label>
                                        <p>
                                            {vsize}
                                            {' '}
                                            <span className={style.currencyUnit}>b</span>
                                        </p>
                                    </div>
                                ) : null
                            }
                            {
                                size ? (
                                    <div className={style.detail}>
                                        <label>{t('transaction.size')}</label>
                                        <p>
                                            {size}
                                            {' '}
                                            <span className={style.currencyUnit}>b</span>
                                        </p>
                                    </div>
                                ) : null
                            }
                            <div className={style.detail}>
                                <label>{t('transaction.explorer')}</label>
                                <p className="text-break">
                                    <A className={style.externalLink} href={ explorerURL + txID } title={t('transaction.explorerTitle')}>{txID}</A>
                                </p>
                            </div>
                        </Dialog>
                    )
                }
            </div>
        );
    }
}

const HOC = translate<TransactionProps>()(Transaction);

export { HOC as Transaction };
