// SPDX-License-Identifier: Apache-2.0

import { ReactNode } from 'react';
import style from './table.module.css';

type TProps = {
  children: ReactNode;
};

export const Table = ({ children, ...props }: TProps & JSX.IntrinsicElements['table']) => {
  return (
    <div className={style.table}>
      <table {...props}>
        {children}
      </table>
    </div>
  );
};

export const Colgroup = ({ children }: TProps) => (<colgroup>{children}</colgroup>);
export const Col = ({ width }: JSX.IntrinsicElements['col']) => (<col width={width} />);

export const Thead = ({ children }: TProps) => (<thead>{children}</thead>);
export const Tbody = ({ children }: TProps) => (<tbody>{children}</tbody>);

export const Tr = ({ children, ...props }: TProps & JSX.IntrinsicElements['tr']) => (
  <tr {...props}>
    {children}
  </tr>
);

export const Td = ({ children, ...props }: TProps & JSX.IntrinsicElements['td']) => (
  <td {...props}>
    {children}
  </td>
);

export const Th = ({ children, ...props }: TProps & JSX.IntrinsicElements['th']) => (
  <th {...props}>
    {children}
  </th>
);

export const Caption = ({ children }: TProps) => (<caption>{children}</caption>);
