import { h } from 'preact';
import Transaction from './transaction';

export default function Transactions({ explorerURL, transactions }) {

    // console.table(transactions);

    if (transactions.length === 0) {
        return <div>No transactions yet.</div>;
    }

    return (
        <div>
            {transactions.map(props => (
                <Transaction key={props.id} explorerURL={explorerURL} {...props} />
            ))}
        </div>
    );
}
