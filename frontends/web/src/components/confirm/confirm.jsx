import { h } from 'preact';
// import style from './message.css';

export default function Confirm({
    active = false,
    children
}) {
    if (!active) {
        return children[0];
    }
    return (
        <div>
            Touch me
        </div>
    );
}
