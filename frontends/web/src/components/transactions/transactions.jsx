import { h } from 'preact';
import Transaction from './transaction';

export default function Transactions({ explorerURL, transactions }) {
    // console.table(transactions);
    console.table(transactions)
    return (
      <div>
        {
          transactions.length > 0 ? transactions.map(props => (
            <Transaction key={props.id} explorerURL={explorerURL} {...props} />
          )) : (
            <div class="flex flex-row flex-center">
              <p style="font-weight: bold;">No transactions yet.</p>
            </div>
          )
        }
      </div>
    );
}
