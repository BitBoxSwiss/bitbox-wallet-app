import { h } from 'preact';
import i18n from '../../i18n/i18n';
import Transaction from './transaction';

export default function Transactions({
    explorerURL,
    transactions,
    className,
    fiat,
}) {
    return (
        <div className={className} style="flex-grow: 1;">
            {
                transactions.length > 0 ? transactions.map(props => (
                    <Transaction key={props.id} explorerURL={explorerURL} fiat={fiat} {...props} />
                )) : (
                    <div class="flex flex-row flex-center">
                        <p class="text-bold text-gray">
                            {i18n.t('transactions.placeholder')}
                        </p>
                    </div>
                )
            }
        </div>
    );
}
