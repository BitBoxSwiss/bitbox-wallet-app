import { h } from 'preact';
import * as style from './icons.css';

export const ArrowIn = (): JSX.Element => (
    <svg
        className={`${style.txArrowType} ${style.txArrowTypeIn}`}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
);

export const ArrowOut = (): JSX.Element => (
    <svg
        className={`${style.txArrowType} ${style.txArrowTypeOut}`}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="12" y1="19" x2="12" y2="5"></line>
        <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
);

export const ArrowSelf = (): JSX.Element => (
    <svg
        className={`${style.txArrowType} ${style.txArrowTypeSelf}`}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
);

export const Edit = (): JSX.Element => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

export const Save = (): JSX.Element => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        className={style.save}>
        <defs/>
        <path d="M17.293 3.293L21 7v13a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h12.586a1 1 0 01.707.293z"/>
        <path d="M7 13h10v8H7zM8 3h8v5H8z"/>
    </svg>
);
