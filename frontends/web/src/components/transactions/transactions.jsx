import { h } from 'preact';
import i18n from '../../i18n/i18n';
import Transaction from './transaction';

export default function Transactions({ explorerURL, transactions }) {
    // console.table(transactions);
    return (
        <div>
            {
                transactions.length > 0 ? transactions.map(props => (
                    <Transaction key={props.id} explorerURL={explorerURL} {...props} />
                )) : (
                    <div class="flex flex-row flex-center">
                        <p style="font-weight: bold;">
                            {i18n.t('transactions.placeholder')}
                        </p>
                    </div>
                )
            }
        </div>
    );
}
