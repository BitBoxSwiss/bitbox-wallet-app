import { h } from 'preact';

export default function Label({
    className,
    style,
    children,
    ...props
}) {
    const classes = ['label', className].join(' ');
    return (
        <label className={classes} style={style} {...props}>
            {children}
        </label>
    );
}
